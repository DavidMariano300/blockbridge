// Borrado de los datos de una persona (CU-14, RNF-PRI-04): lo usan /api/cuenta y la limpieza diaria.
import { auth, db } from "./firebase.js";

const LOTE = 450;

// Sus sesiones y su perfil se borran. Si era docente, sus ejercicios y quizzes quedan archivados a nombre de
// "baja" para no romper los resultados de sus estudiantes.
export async function eliminarUsuario(uid) {
  const [sesiones, ejercicios, quizzes] = await Promise.all([
    db.collection("sesiones").where("uid", "==", uid).get(),
    db.collection("ejercicios").where("autorId", "==", uid).get(),
    db.collection("quizzes").where("autorId", "==", uid).get(),
  ]);
  const escrituras = [
    ...sesiones.docs.map((d) => (lote) => lote.delete(d.ref)),
    ...ejercicios.docs.map((d) => (lote) => lote.update(d.ref, { autorId: "baja", archivado: true })),
    ...quizzes.docs.map((d) => (lote) => lote.update(d.ref, { autorId: "baja", publicado: false })),
    (lote) => lote.delete(db.doc(`usuarios/${uid}`)),
    (lote) => lote.delete(db.doc(`limites/${uid}`)),
  ];
  // Firestore admite hasta 500 escrituras por lote.
  for (let i = 0; i < escrituras.length; i += LOTE) {
    const lote = db.batch();
    escrituras.slice(i, i + LOTE).forEach((escribir) => escribir(lote));
    await lote.commit();
  }
  try {
    await auth.deleteUser(uid);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
  }
  return { sesionesBorradas: sesiones.size };
}
