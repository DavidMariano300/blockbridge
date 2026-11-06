// POST /api/sesiones: inicia o retoma una sesión de quiz (CU-05). Con {accion: "reclamar"} conserva
// las sesiones de invitado al registrarse (CU-02 FA-1).
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./_lib/firebase.js";
import { manejador, ErrorHttp, id } from "./_lib/http.js";
import { cargarEjercicios, vista } from "./_lib/sesion.js";
import { LENGUAJES_CURSO } from "../js/bloques/definiciones.js";

const DIAS_INVITADO = 30;
const MAX_SESIONES_POR_HORA = 20;
const HORA_MS = 3_600_000;

export const POST = manejador(({ usuario, cuerpo }) => (cuerpo.accion === "reclamar" ? reclamar(usuario) : iniciar(usuario, cuerpo)));

// Transacción: peticiones simultáneas no pueden rebasar el tope. Retomar una sesión no cuenta.
async function respetarTope(uid) {
  const ref = db.doc(`limites/${uid}`);
  await db.runTransaction(async (tx) => {
    const previo = (await tx.get(ref)).data();
    const ahora = Date.now();
    const vigente = previo && ahora - previo.desde.toMillis() < HORA_MS;
    if (vigente && previo.sesiones >= MAX_SESIONES_POR_HORA) {
      throw new ErrorHttp(429, "Iniciaste demasiados quizzes en poco tiempo. Intenta de nuevo en una hora.");
    }
    tx.set(ref, vigente ? { ...previo, sesiones: previo.sesiones + 1 } : { desde: Timestamp.fromMillis(ahora), sesiones: 1 });
  });
}

async function iniciar(usuario, { quizId, lenguaje, nueva }) {
  id(quizId, "quizId");
  if (!LENGUAJES_CURSO.includes(lenguaje)) throw new ErrorHttp(400, "El lenguaje elegido no es válido.");

  const quizRef = db.doc(`quizzes/${quizId}`);
  const quiz = (await quizRef.get()).data();
  if (!quiz?.publicado || !quiz.lenguajes.includes(lenguaje)) throw new ErrorHttp(400, "Este quiz ya no está disponible.");
  const ejercicios = await cargarEjercicios(quiz.ejercicioIds);

  if (nueva !== true) {
    const enCurso = await db.collection("sesiones").where("uid", "==", usuario.uid)
      .where("quizId", "==", quizId).where("estado", "==", "en_curso").limit(1).get();
    if (!enCurso.empty) {
      const doc = enCurso.docs[0];
      return { ...vista(doc.id, doc.data(), quiz, ejercicios), retomada: true };
    }
  }

  await respetarTope(usuario.uid);
  const apodo = usuario.anonimo ? "Invitado" : (await db.doc(`usuarios/${usuario.uid}`).get()).get("apodo") ?? "Sin apodo";
  const sesion = {
    uid: usuario.uid, apodo, quizId, autorQuizId: quiz.autorId, lenguaje,
    estado: "en_curso", inicio: Timestamp.now(), fin: null, puntaje: 0,
    penalizacionPista: quiz.penalizacionPista, orden: quiz.ejercicioIds,
    ejercicios: Object.fromEntries(quiz.ejercicioIds.map((e) => [e,
      { estado: "pendiente", intentos: 0, pistas: 0, tiempoSeg: 0, puntaje: 0, ultimoEnvio: null }])),
    anonimo: usuario.anonimo,
    // /api/limpieza borra a diario las vencidas; con facturación activa, también la política TTL (RN-12).
    ...(usuario.anonimo && { expiraEn: Timestamp.fromMillis(Date.now() + DIAS_INVITADO * 86_400_000) }),
  };

  const ref = db.collection("sesiones").doc();
  const lote = db.batch().create(ref, sesion);
  // Con la primera sesión, el quiz y sus ejercicios pasan a "usados": ya no se borran ni se reordenan (RN-13).
  if (!quiz.usado) {
    lote.update(quizRef, { usado: true });
    quiz.ejercicioIds.forEach((e) => lote.update(db.doc(`ejercicios/${e}`), { usado: true }));
  }
  await lote.commit();
  return vista(ref.id, sesion, quiz, ejercicios);
}

async function reclamar(usuario) {
  if (usuario.anonimo) throw new ErrorHttp(400, "Primero crea tu cuenta para conservar tu progreso.");
  const apodo = (await db.doc(`usuarios/${usuario.uid}`).get()).get("apodo") ?? "Sin apodo";
  const anonimas = await db.collection("sesiones").where("uid", "==", usuario.uid).where("anonimo", "==", true).get();
  const lote = db.batch();
  anonimas.docs.forEach((d) => lote.update(d.ref, { anonimo: false, apodo, expiraEn: FieldValue.delete() }));
  await lote.commit();
  return { reclamadas: anonimas.size };
}
