// POST /api/ejercicios: el docente guarda, duplica, archiva o borra sus ejercicios (CU-11).
// Validación con las mismas reglas que el banco precargado (js/bloques/validar.js).
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./_lib/firebase.js";
import { manejador, despachar, exigirDocente, ErrorHttp, id } from "./_lib/http.js";
import { validarEjercicio, firmaSoluciones, LIMITES_TEXTO } from "../js/bloques/validar.js";

export const POST = manejador(async ({ usuario, cuerpo }) => {
  await exigirDocente(usuario);
  return despachar({ guardar, duplicar, archivar, borrar }, cuerpo, usuario.uid);
}, { bytes: 256 * 1024 });

const clave = (ref) => ref.collection("privado").doc("clave");

async function propio(tx, uid, ejercicioId) {
  const ref = db.doc(`ejercicios/${id(ejercicioId, "id")}`);
  const snap = await tx.get(ref);
  if (!snap.exists || snap.get("autorId") !== uid) throw new ErrorHttp(404, "No encontramos ese ejercicio entre los tuyos.");
  return { ref, datos: snap.data() };
}

async function guardar(uid, cuerpo) {
  const ejercicio = cuerpo.ejercicio && typeof cuerpo.ejercicio === "object" ? cuerpo.ejercicio : {};
  const e = {
    titulo: ejercicio.titulo, enunciado: ejercicio.enunciado, explicacion: ejercicio.explicacion,
    tema: ejercicio.tema, dificultad: ejercicio.dificultad, toolbox: ejercicio.toolbox,
    workspaceInicial: ejercicio.workspaceInicial ?? null, soluciones: ejercicio.soluciones,
    pistas: Array.isArray(ejercicio.pistas) ? ejercicio.pistas.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim()) : [],
  };
  const { errores, lenguajes } = validarEjercicio(e);
  if (errores.length) throw new ErrorHttp(400, errores.join(" "));

  const ref = ejercicio.id ? db.doc(`ejercicios/${id(ejercicio.id, "id")}`) : db.collection("ejercicios").doc();
  await db.runTransaction(async (tx) => {
    const [publico, privado] = await tx.getAll(ref, clave(ref));
    const previo = publico.exists ? publico.data() : null;
    if (ejercicio.id && previo?.autorId !== uid) throw new ErrorHttp(404, "No encontramos ese ejercicio entre los tuyos.");
    const quizzes = await tx.get(db.collection("quizzes").where("ejercicioIds", "array-contains", ref.id));

    // RN-13: con sesiones registradas, la solución queda fija para no alterar calificaciones.
    if (previo?.usado) {
      const firma = (paleta, inicial, soluciones) =>
        [[...paleta].sort().join(), inicial ? firmaSoluciones([inicial]) : "", firmaSoluciones(soluciones)].join("|");
      const antes = firma(previo.toolbox, previo.workspaceInicial && JSON.parse(previo.workspaceInicial), privado.get("soluciones").map((s) => JSON.parse(s)));
      if (antes !== firma(e.toolbox, e.workspaceInicial, e.soluciones)) {
        throw new ErrorHttp(409, "Este ejercicio ya se respondió en algún quiz: solo puedes cambiar sus textos y pistas. Duplícalo para cambiar la solución.");
      }
    }

    // Si la nueva solución usa POO, los quizzes que lo contienen dejan de ofrecer C (RN-10).
    for (const q of quizzes.docs) {
      const restantes = q.get("lenguajes").filter((l) => lenguajes.includes(l));
      if (!restantes.length) throw new ErrorHttp(409, `El quiz «${q.get("titulo")}» se quedaría sin lenguajes disponibles.`);
      if (restantes.length !== q.get("lenguajes").length) tx.update(q.ref, { lenguajes: restantes });
    }

    tx.set(ref, {
      autorId: uid, origen: "docente", titulo: e.titulo.trim(), enunciado: e.enunciado.trim(), tema: e.tema, dificultad: e.dificultad,
      toolbox: e.toolbox, workspaceInicial: e.workspaceInicial ? JSON.stringify(e.workspaceInicial) : null, lenguajes,
      numPistas: e.pistas.length, archivado: previo?.archivado ?? false, usado: previo?.usado ?? false, actualizadoEn: Timestamp.now(),
    });
    tx.set(clave(ref), { soluciones: e.soluciones.map((s) => JSON.stringify(s)), pistas: e.pistas, explicacion: e.explicacion.trim() });
  });
  return { id: ref.id, lenguajes };
}

// Copia editable de un ejercicio propio o precargado (RF-31).
async function duplicar(uid, { id: origenId }) {
  const nuevo = db.collection("ejercicios").doc();
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`ejercicios/${id(origenId, "id")}`);
    const [publico, privado] = await tx.getAll(ref, clave(ref));
    const datos = publico.data();
    if (!publico.exists || !privado.exists || (datos.autorId !== uid && datos.origen !== "precargado")) {
      throw new ErrorHttp(404, "Solo puedes duplicar tus ejercicios o los precargados.");
    }
    tx.set(nuevo, {
      ...datos, titulo: `Copia de ${datos.titulo}`.slice(0, LIMITES_TEXTO.titulo), autorId: uid, origen: "docente",
      archivado: false, usado: false, actualizadoEn: Timestamp.now(),
    });
    tx.set(clave(nuevo), privado.data());
  });
  return { id: nuevo.id };
}

// Un ejercicio archivado deja de ofrecerse para quizzes nuevos (RN-13).
async function archivar(uid, { id: ejercicioId, archivado }) {
  await db.runTransaction(async (tx) => {
    const { ref } = await propio(tx, uid, ejercicioId);
    tx.update(ref, { archivado: archivado === true, actualizadoEn: Timestamp.now() });
  });
  return { archivado: archivado === true };
}

async function borrar(uid, { id: ejercicioId }) {
  await db.runTransaction(async (tx) => {
    const { ref, datos } = await propio(tx, uid, ejercicioId);
    if (datos.usado) throw new ErrorHttp(409, "Este ejercicio ya se respondió en algún quiz: archívalo en lugar de borrarlo.");
    const quizzes = await tx.get(db.collection("quizzes").where("ejercicioIds", "array-contains", ref.id));
    if (!quizzes.empty) {
      throw new ErrorHttp(409, `Primero quítalo de estos quizzes: ${quizzes.docs.map((q) => `«${q.get("titulo")}»`).join(", ")}.`);
    }
    tx.delete(clave(ref));
    tx.delete(ref);
  });
  return { borrado: true };
}
