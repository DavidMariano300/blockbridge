// Carga el banco precargado en Firestore (CU-16). Valida todo antes de escribir: si algo falla, no carga nada.
// Uso: npm run seed (emuladores). Para producción, define FIREBASE_SERVICE_ACCOUNT antes de ejecutarlo.
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.GCLOUD_PROJECT ??= "demo-blockbridge";
}

const { Timestamp } = await import("firebase-admin/firestore");
const { db } = await import("../api/_lib/firebase.js");
const { validarBanco } = await import("../js/bloques/validar.js");
const { EJERCICIOS, QUIZZES } = await import("../contenido/banco.js");

const { errores, lenguajesDe } = validarBanco(EJERCICIOS, QUIZZES);
if (errores.length) {
  console.error(`No se cargó nada. Corrige:\n- ${errores.join("\n- ")}`);
  process.exit(1);
}

// Los workspaces se guardan como texto JSON: Firestore no admite más de 20 niveles de anidamiento
// y cada bloque encadenado de Blockly agrega unos tres. merge conserva la marca "usado" del servidor.
const lote = db.batch();
const ahora = Timestamp.now();
for (const { id, soluciones, pistas = [], explicacion, ...publico } of EJERCICIOS) {
  lote.set(db.doc(`ejercicios/${id}`), {
    ...publico, workspaceInicial: publico.workspaceInicial ? JSON.stringify(publico.workspaceInicial) : null,
    autorId: "sistema", origen: "precargado",
    lenguajes: lenguajesDe.get(id), numPistas: pistas.length, archivado: false, actualizadoEn: ahora,
  }, { merge: true });
  lote.set(db.doc(`ejercicios/${id}/privado/clave`), { soluciones: soluciones.map((s) => JSON.stringify(s)), pistas, explicacion });
}
// orden: posición en el catálogo, la del temario.
for (const [orden, { id, ...quiz }] of QUIZZES.entries()) {
  const lenguajes = quiz.ejercicioIds.map((e) => lenguajesDe.get(e)).reduce((a, b) => a.filter((l) => b.includes(l)));
  lote.set(db.doc(`quizzes/${id}`), { ...quiz, orden, autorId: "sistema", origen: "precargado", lenguajes, publicado: true, actualizadoEn: ahora }, { merge: true });
}
await lote.commit();
console.log(`Cargados ${EJERCICIOS.length} ejercicios y ${QUIZZES.length} quizzes.`);
