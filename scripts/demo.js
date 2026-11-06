// Datos de demostración para los emuladores: un docente, alumnos ficticios y sus sesiones de quiz.
// Uso: npm run emuladores, npm run seed y después npm run demo. Nunca se ejecuta contra un proyecto real.
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("demo.js solo funciona con los emuladores: quita FIREBASE_SERVICE_ACCOUNT.");
  process.exit(1);
}
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.GCLOUD_PROJECT ??= "demo-blockbridge";

const { Timestamp } = await import("firebase-admin/firestore");
const { db, auth } = await import("../api/_lib/firebase.js");
const { puntajeEjercicio, puntajeQuiz } = await import("../js/bloques/evaluador.js");
const { QUIZZES } = await import("../contenido/banco.js");

// Credenciales de prueba, válidas solo en los emuladores locales.
const DOCENTE = { uid: "docente-demo", email: "docente@demo.test", password: "demo1234", apodo: "profe-demo" };
const APODOS = ["pixel", "cometa", "byte", "nebula", "quasar", "lambda", "orbita", "vector"];

// Generador pseudoaleatorio con semilla: la demo produce siempre los mismos datos.
let semilla = 20261030;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));

async function usuario({ uid, email, password, apodo, rol, verificado }) {
  try {
    await auth.deleteUser(uid);
  } catch { /* no existía */ }
  await auth.createUser({ uid, email, password, emailVerified: verificado });
  await db.doc(`usuarios/${uid}`).set({ apodo, rol, avisoVersion: "2.0", avisoAceptadoEn: Timestamp.now(), creadoEn: Timestamp.now() });
}

function sesion({ uid, apodo, anonimo }, quiz) {
  const inicio = Date.now() - entre(1, 14) * 86_400_000 - entre(0, 600) * 60_000;
  const habilidad = azar();
  const ejercicios = {};
  let total = 0;
  for (const id of quiz.ejercicioIds) {
    const resuelto = azar() < 0.35 + habilidad * 0.6;
    const pistas = resuelto ? (azar() < 0.3 ? entre(1, 2) : 0) : entre(0, 2);
    const tiempoSeg = entre(40, 420);
    total += tiempoSeg;
    ejercicios[id] = { estado: resuelto ? "resuelto" : "pendiente", intentos: resuelto ? entre(1, 4) : entre(0, 5), pistas, tiempoSeg,
      puntaje: puntajeEjercicio(resuelto, pistas, quiz.penalizacionPista), ultimoEnvio: Timestamp.fromMillis(inicio + total * 1000) };
  }
  const finalizada = azar() < 0.85;
  return {
    uid, apodo, quizId: quiz.id, autorQuizId: "sistema", lenguaje: ["python", "java", "javascript", "cpp"][entre(0, 3)],
    estado: finalizada ? "finalizada" : "en_curso", inicio: Timestamp.fromMillis(inicio),
    fin: finalizada ? Timestamp.fromMillis(inicio + (total + 30) * 1000) : null,
    puntaje: puntajeQuiz(quiz.ejercicioIds.map((e) => ejercicios[e].puntaje)), penalizacionPista: quiz.penalizacionPista,
    orden: quiz.ejercicioIds, ejercicios, anonimo,
    ...(anonimo && { expiraEn: Timestamp.fromMillis(inicio + 30 * 86_400_000) }),
  };
}

await usuario({ ...DOCENTE, rol: "docente", verificado: true });
const alumnos = APODOS.map((apodo, i) => ({ uid: `alumno-demo-${i + 1}`, apodo, anonimo: false }));
for (const [i, a] of alumnos.entries()) {
  await usuario({ uid: a.uid, email: `alumno${i + 1}@demo.test`, password: DOCENTE.password, apodo: a.apodo, rol: "estudiante", verificado: true });
}
const invitados = [1, 2, 3].map((i) => ({ uid: `invitado-demo-${i}`, apodo: "Invitado", anonimo: true }));

const previas = await db.collection("sesiones").where("uid", ">=", "alumno-demo-").where("uid", "<", "alumno-demo-~").get();
const lote = db.batch();
previas.docs.forEach((d) => lote.delete(d.ref));
let creadas = 0;
for (const quiz of QUIZZES.filter((q) => ["primeros-pasos", "quiz-condicionales", "quiz-ciclos"].includes(q.id))) {
  for (const persona of [...alumnos, ...invitados]) {
    for (let n = persona.anonimo ? 1 : entre(1, 2); n > 0; n--) {
      lote.set(db.collection("sesiones").doc(), sesion(persona, quiz));
      creadas++;
    }
  }
  lote.update(db.doc(`quizzes/${quiz.id}`), { usado: true });
}
await lote.commit();
console.log(`Demo lista: docente ${DOCENTE.email}, ${alumnos.length} alumnos ficticios y ${creadas} sesiones en 3 quizzes del banco.`);
