// POST /api/quizzes: el docente guarda o borra sus quizzes (CU-12).
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./_lib/firebase.js";
import { manejador, despachar, exigirDocente, ErrorHttp, id } from "./_lib/http.js";
import { LENGUAJES_CURSO } from "../js/bloques/definiciones.js";
import { lenguajesComunes, LIMITES_TEXTO } from "../js/bloques/validar.js";

export const POST = manejador(async ({ usuario, cuerpo }) => {
  await exigirDocente(usuario);
  return despachar({ guardar, borrar }, cuerpo, usuario.uid);
});

const masFrecuente = (valores) =>
  [...valores.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0][0];

async function guardar(uid, cuerpo) {
  const quiz = cuerpo.quiz && typeof cuerpo.quiz === "object" ? cuerpo.quiz : {};
  const titulo = typeof quiz.titulo === "string" ? quiz.titulo.trim() : "";
  const descripcion = typeof quiz.descripcion === "string" ? quiz.descripcion.trim() : "";
  if (!titulo || titulo.length > LIMITES_TEXTO.titulo) throw new ErrorHttp(400, `El título es obligatorio y admite hasta ${LIMITES_TEXTO.titulo} caracteres.`);
  if (descripcion.length > LIMITES_TEXTO.descripcion) throw new ErrorHttp(400, `La descripción admite hasta ${LIMITES_TEXTO.descripcion} caracteres.`);
  const ejercicioIds = Array.isArray(quiz.ejercicioIds) ? quiz.ejercicioIds.map((e) => id(e, "ejercicio")) : [];
  if (!ejercicioIds.length || ejercicioIds.length > 30 || new Set(ejercicioIds).size !== ejercicioIds.length) {
    throw new ErrorHttp(400, "Elige de 1 a 30 ejercicios, sin repetir.");
  }
  const penalizacionPista = quiz.penalizacionPista;
  if (!Number.isInteger(penalizacionPista) || penalizacionPista < 0 || penalizacionPista > 50) {
    throw new ErrorHttp(400, "La penalización por pista debe ser un número entero de 0 a 50.");
  }
  const pedidos = Array.isArray(quiz.lenguajes) ? quiz.lenguajes : [];
  const lenguajes = LENGUAJES_CURSO.filter((l) => pedidos.includes(l));
  if (!lenguajes.length || lenguajes.length !== new Set(pedidos).size) throw new ErrorHttp(400, "Elige al menos un lenguaje válido.");

  const ref = quiz.id ? db.doc(`quizzes/${id(quiz.id, "id")}`) : db.collection("quizzes").doc();
  await db.runTransaction(async (tx) => {
    const [snap, ...ejercicios] = await tx.getAll(ref, ...ejercicioIds.map((e) => db.doc(`ejercicios/${e}`)));
    const previo = snap.exists ? snap.data() : null;
    if (quiz.id && previo?.autorId !== uid) throw new ErrorHttp(404, "No encontramos ese quiz entre los tuyos.");

    ejercicios.forEach((e, i) => {
      const datos = e.data();
      if (!e.exists || (datos.autorId !== uid && datos.origen !== "precargado")) {
        throw new ErrorHttp(400, `El ejercicio ${i + 1} no está disponible.`);
      }
      // Un ejercicio archivado puede quedarse donde ya estaba, pero no entra a quizzes nuevos.
      if (datos.archivado && !previo?.ejercicioIds.includes(e.id)) throw new ErrorHttp(400, `«${datos.titulo}» está archivado.`);
    });
    const comunes = lenguajesComunes(ejercicios.map((e) => e.get("lenguajes")));
    const sobran = lenguajes.filter((l) => !comunes.includes(l));
    if (sobran.length) throw new ErrorHttp(400, `No todos los ejercicios se pueden ofrecer en: ${sobran.join(", ")}.`);

    // Con sesiones registradas solo cambian textos y publicación (CU-12 FA-2).
    if (previo?.usado && (previo.ejercicioIds.join() !== ejercicioIds.join() || previo.lenguajes.join() !== lenguajes.join()
      || previo.penalizacionPista !== penalizacionPista)) {
      throw new ErrorHttp(409, "Este quiz ya tiene resultados: solo puedes cambiar su título, descripción y publicación. Duplícalo para cambiar lo demás.");
    }

    const dificultades = new Set(ejercicios.map((e) => e.get("dificultad")));
    tx.set(ref, {
      autorId: uid, origen: "docente", titulo, descripcion, ejercicioIds, lenguajes, penalizacionPista,
      publicado: quiz.publicado === true, tema: masFrecuente(ejercicios.map((e) => e.get("tema"))),
      dificultad: dificultades.size === 1 ? [...dificultades][0] : "progresivo",
      usado: previo?.usado ?? false, actualizadoEn: Timestamp.now(),
    });
  });
  return { id: ref.id };
}

async function borrar(uid, { id: quizId }) {
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`quizzes/${id(quizId, "id")}`);
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("autorId") !== uid) throw new ErrorHttp(404, "No encontramos ese quiz entre los tuyos.");
    if (snap.get("usado")) throw new ErrorHttp(409, "Este quiz ya tiene resultados: despublícalo en lugar de borrarlo.");
    tx.delete(ref);
  });
  return { borrado: true };
}
