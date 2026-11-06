// Pruebas de integración de /api contra los emuladores de Auth y Firestore. Ejecutar con: npm run test:emulador
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { Timestamp } from "firebase-admin/firestore";
import { db, auth } from "../api/_lib/firebase.js";
import { POST as sesiones } from "../api/sesiones.js";
import { POST as respuesta } from "../api/respuesta.js";
import { POST as pista } from "../api/pista.js";
import { POST as finalizar } from "../api/finalizar.js";
import { POST as ejercicios } from "../api/ejercicios.js";
import { POST as quizzes } from "../api/quizzes.js";
import { DELETE as cuenta } from "../api/cuenta.js";
import { GET as limpieza } from "../api/limpieza.js";
import { EJERCICIOS } from "../contenido/banco.js";
import { B, imprimir, txt, programa, workspace } from "../scripts/constructores.js";

const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
const solucion = (id) => EJERCICIOS.find((e) => e.id === id).soluciones[0];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function cuentaAuth(ruta, cuerpo) {
  const r = await fetch(`${AUTH}/${ruta}?key=demo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cuerpo, returnSecureToken: true }) });
  return r.json();
}

let correos = 0;
async function estudiante() {
  const { idToken, localId } = await cuentaAuth("accounts:signUp", { email: `alumno${++correos}@ejemplo.test`, password: "prueba123" });
  await db.doc(`usuarios/${localId}`).set({ apodo: `alumno${correos}`, rol: "estudiante" });
  return { token: idToken, uid: localId };
}
const invitado = async () => {
  const { idToken, localId } = await cuentaAuth("accounts:signUp", {});
  return { token: idToken, uid: localId };
};

async function llamar(funcion, quien, cuerpo) {
  const headers = { "Content-Type": "application/json", ...(quien && { Authorization: `Bearer ${quien.token}` }) };
  const r = await funcion(new Request("http://localhost/api", { method: "POST", headers, body: JSON.stringify(cuerpo) }));
  return { estado: r.status, datos: await r.json() };
}
const iniciar = (quien, extra = {}) => llamar(sesiones, quien, { quizId: "primeros-pasos", lenguaje: "python", ...extra });

before(() => {
  const r = spawnSync(process.execPath, ["scripts/seed.js"], { encoding: "utf8", env: process.env });
  assert.equal(r.status, 0, r.stderr);
});

test("sin token la API responde 401", async () => {
  assert.equal((await iniciar(null)).estado, 401);
  assert.equal((await iniciar({ token: "token-falso" })).estado, 401);
});

test("iniciar un quiz no entrega soluciones, pistas sin revelar ni explicaciones", async () => {
  const { estado, datos } = await iniciar(await estudiante());
  assert.equal(estado, 200);
  assert.equal(datos.ejercicios.length, 3);
  const texto = JSON.stringify(datos);
  assert.ok(!texto.includes("soluciones"));
  for (const e of datos.ejercicios) {
    assert.deepEqual(e.pistas, []);
    assert.equal(e.explicacion, null);
  }
  assert.equal(datos.ejercicios[2].numPistas, 3);
});

test("quiz inexistente o lenguaje fuera del quiz responde 400", async () => {
  const yo = await estudiante();
  assert.equal((await iniciar(yo, { quizId: "no-existe" })).estado, 400);
  assert.equal((await iniciar(yo, { lenguaje: "cobol" })).estado, 400);
  assert.equal((await iniciar(yo, { quizId: "../usuarios" })).estado, 400);
});

test("volver a entrar retoma la sesión en curso; nueva:true crea otra", async () => {
  const yo = await estudiante();
  const primera = (await iniciar(yo)).datos;
  const retomada = (await iniciar(yo)).datos;
  assert.equal(retomada.sesionId, primera.sesionId);
  assert.equal(retomada.retomada, true);
  assert.notEqual((await iniciar(yo, { nueva: true })).datos.sesionId, primera.sesionId);
});

test("respuesta incorrecta: retroalimentación, intento contado y límite de un envío por segundo", async () => {
  const yo = await estudiante();
  const { sesionId } = (await iniciar(yo)).datos;
  const mal = workspace(programa(imprimir(B("texto", { id: "t1", fields: { TEXTO: "Hola mundo" } }))));
  const r = await llamar(respuesta, yo, { sesionId, ejercicioId: "salida-saludo", workspace: mal });
  assert.equal(r.estado, 200);
  assert.deepEqual(r.datos, { correcto: false, diferencia: { tipo: "valor_distinto", bloqueId: "t1" }, intentos: 1 });
  assert.equal((await llamar(respuesta, yo, { sesionId, ejercicioId: "salida-saludo", workspace: mal })).estado, 429);
});

test("respuesta correcta: puntaje, explicación y el ejercicio queda cerrado", async () => {
  const yo = await estudiante();
  const { sesionId } = (await iniciar(yo)).datos;
  const r = await llamar(respuesta, yo, { sesionId, ejercicioId: "operadores-suma", workspace: solucion("operadores-suma"), segundos: 42 });
  assert.equal(r.datos.correcto, true);
  assert.equal(r.datos.puntaje, 100);
  assert.equal(r.datos.puntajeQuiz, 33.3);
  assert.match(r.datos.explicacion, /variable/);
  await espera(1100);
  assert.equal((await llamar(respuesta, yo, { sesionId, ejercicioId: "operadores-suma", workspace: solucion("operadores-suma") })).estado, 409);
  assert.equal((await llamar(pista, yo, { sesionId, ejercicioId: "operadores-suma" })).estado, 409);
});

test("pistas: se revelan en orden, penalizan y se agotan", async () => {
  const yo = await estudiante();
  const { sesionId } = (await iniciar(yo)).datos;
  const pedir = () => llamar(pista, yo, { sesionId, ejercicioId: "condicionales-aprobado" });
  const primera = (await pedir()).datos;
  assert.deepEqual([primera.usadas, primera.restantes, primera.puntajeMaximo], [1, 2, 80]);
  assert.equal(primera.pista, EJERCICIOS.find((e) => e.id === "condicionales-aprobado").pistas[0]);
  await pedir();
  await pedir();
  assert.equal((await pedir()).estado, 409);
  const r = await llamar(respuesta, yo, { sesionId, ejercicioId: "condicionales-aprobado", workspace: solucion("condicionales-aprobado") });
  assert.equal(r.datos.puntaje, 40);
  const retomada = (await iniciar(yo)).datos.ejercicios[2];
  assert.equal(retomada.pistas.length, 3);
  assert.equal(typeof retomada.explicacion, "string");
});

test("nadie puede responder, pedir pistas ni finalizar la sesión de otra persona", async () => {
  const duena = await estudiante();
  const intrusa = await estudiante();
  const { sesionId } = (await iniciar(duena)).datos;
  const cuerpo = { sesionId, ejercicioId: "salida-saludo", workspace: solucion("salida-saludo") };
  assert.equal((await llamar(respuesta, intrusa, cuerpo)).estado, 404);
  assert.equal((await llamar(pista, intrusa, cuerpo)).estado, 404);
  assert.equal((await llamar(finalizar, intrusa, { sesionId })).estado, 404);
});

test("bloques fuera de la toolbox o programas mal formados responden 400", async () => {
  const yo = await estudiante();
  const { sesionId } = (await iniciar(yo)).datos;
  const prohibido = workspace(programa(B("mientras", { inputs: { CUERPO: imprimir(txt("x")) } })));
  const r = await llamar(respuesta, yo, { sesionId, ejercicioId: "salida-saludo", workspace: prohibido });
  assert.equal(r.estado, 400);
  assert.match(r.datos.error, /no permite/);
  await espera(1100);
  assert.equal((await llamar(respuesta, yo, { sesionId, ejercicioId: "salida-saludo", workspace: "texto" })).estado, 400);
});

test("finalizar calcula el promedio, es repetible y cierra la sesión", async () => {
  const yo = await estudiante();
  const { sesionId } = (await iniciar(yo)).datos;
  await llamar(respuesta, yo, { sesionId, ejercicioId: "salida-saludo", workspace: solucion("salida-saludo") });
  await llamar(respuesta, yo, { sesionId, ejercicioId: "operadores-suma", workspace: solucion("operadores-suma") });
  const fin = (await llamar(finalizar, yo, { sesionId })).datos;
  assert.equal(fin.puntaje, 66.7);
  assert.deepEqual(fin.ejercicios.map((e) => e.estado), ["resuelto", "resuelto", "pendiente"]);
  assert.equal((await llamar(finalizar, yo, { sesionId })).datos.puntaje, 66.7);
  assert.equal((await llamar(respuesta, yo, { sesionId, ejercicioId: "condicionales-aprobado", workspace: solucion("condicionales-aprobado") })).estado, 409);
});

test("las sesiones de invitado expiran y se conservan al registrarse", async () => {
  const anonimo = await invitado();
  const { sesionId } = (await iniciar(anonimo)).datos;
  const antes = (await db.doc(`sesiones/${sesionId}`).get()).data();
  assert.equal(antes.anonimo, true);
  assert.ok(antes.expiraEn.toMillis() > Date.now() + 29 * 86_400_000);
  assert.equal((await llamar(sesiones, anonimo, { accion: "reclamar" })).estado, 400);

  const vinculada = await cuentaAuth("accounts:update", { idToken: anonimo.token, email: "vinculada@ejemplo.test", password: "prueba123" });
  await db.doc(`usuarios/${anonimo.uid}`).set({ apodo: "vinculada", rol: "estudiante" });
  const r = await llamar(sesiones, { token: vinculada.idToken }, { accion: "reclamar" });
  assert.deepEqual(r.datos, { reclamadas: 1 });
  const despues = (await db.doc(`sesiones/${sesionId}`).get()).data();
  assert.equal(despues.anonimo, false);
  assert.equal(despues.expiraEn, undefined);
  assert.equal(despues.apodo, "vinculada");
});

test("con la primera sesión, el quiz y sus ejercicios quedan marcados como usados", async () => {
  await iniciar(await estudiante());
  assert.equal((await db.doc("quizzes/primeros-pasos").get()).get("usado"), true);
  assert.equal((await db.doc("ejercicios/salida-saludo").get()).get("usado"), true);
});

// ---------- docente: /api/ejercicios y /api/quizzes ----------

async function docente({ verificado = true } = {}) {
  const correo = `docente${++correos}@ejemplo.test`;
  const { localId } = await cuentaAuth("accounts:signUp", { email: correo, password: "prueba123" });
  await db.doc(`usuarios/${localId}`).set({ apodo: `docente${correos}`, rol: "docente" });
  if (verificado) await auth.updateUser(localId, { emailVerified: true });
  const { idToken } = await cuentaAuth("accounts:signInWithPassword", { email: correo, password: "prueba123" });
  return { token: idToken, uid: localId };
}

const nuevoEjercicio = (extra = {}) => ({
  titulo: "Saluda a Grace", enunciado: "Imprime Hola, Grace.", tema: "salida", dificultad: "basico",
  toolbox: ["imprimir", "texto"], workspaceInicial: workspace(programa()),
  soluciones: [workspace(programa(imprimir(txt("Hola, Grace"))))], pistas: ["Usa imprimir."], explicacion: "Imprimir muestra un texto.", ...extra,
});
const guardarEjercicio = (quien, ejercicio) => llamar(ejercicios, quien, { accion: "guardar", ejercicio });
const guardarQuiz = (quien, quiz) => llamar(quizzes, quien, { accion: "guardar", quiz: { titulo: "Mi quiz", descripcion: "", lenguajes: ["python"], penalizacionPista: 10, publicado: true, ...quiz } });

test("docente: estudiantes y docentes sin correo verificado reciben 403", async () => {
  for (const quien of [await estudiante(), await docente({ verificado: false })]) {
    assert.equal((await guardarEjercicio(quien, nuevoEjercicio())).estado, 403);
    assert.equal((await guardarQuiz(quien, { ejercicioIds: ["salida-saludo"] })).estado, 403);
  }
});

test("docente: acciones desconocidas o heredadas de Object responden 400", async () => {
  const yo = await docente();
  assert.equal((await llamar(ejercicios, yo, { accion: "constructor" })).estado, 400);
  assert.equal((await llamar(quizzes, yo, { accion: "toString" })).estado, 400);
});

test("docente: guarda un ejercicio válido con lenguajes calculados en el servidor", async () => {
  const yo = await docente();
  const r = await guardarEjercicio(yo, { ...nuevoEjercicio(), lenguajes: ["c"] });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.lenguajes.length, 8);
  const guardado = (await db.doc(`ejercicios/${r.datos.id}`).get()).data();
  assert.equal(guardado.autorId, yo.uid);
  assert.equal(typeof guardado.workspaceInicial, "string");
  assert.equal(guardado.numPistas, 1);
  const clave = (await db.doc(`ejercicios/${r.datos.id}/privado/clave`).get()).data();
  assert.equal(typeof clave.soluciones[0], "string");
});

test("docente: rechaza soluciones con bloques fuera de la paleta o un inicio que ya es solución", async () => {
  const yo = await docente();
  const fuera = await guardarEjercicio(yo, nuevoEjercicio({ toolbox: ["imprimir"], soluciones: [workspace(programa(imprimir(B("booleano", { fields: { VALOR: "VERDADERO" } }))))] }));
  assert.equal(fuera.estado, 400);
  assert.match(fuera.datos.error, /no permite/);
  const trivial = await guardarEjercicio(yo, nuevoEjercicio({ workspaceInicial: workspace(programa(imprimir(txt("Hola, Grace")))) }));
  assert.equal(trivial.estado, 400);
  assert.match(trivial.datos.error, /ya son una solución/);
});

test("docente: no edita ejercicios ajenos ni precargados; sí los duplica", async () => {
  const yo = await docente();
  const otro = await docente();
  const { id } = (await guardarEjercicio(otro, nuevoEjercicio())).datos;
  assert.equal((await guardarEjercicio(yo, { ...nuevoEjercicio(), id })).estado, 404);
  assert.equal((await guardarEjercicio(yo, { ...nuevoEjercicio(), id: "salida-saludo" })).estado, 404);
  assert.equal((await llamar(ejercicios, yo, { accion: "duplicar", id })).estado, 404);
  const copia = await llamar(ejercicios, yo, { accion: "duplicar", id: "salida-saludo" });
  const datos = (await db.doc(`ejercicios/${copia.datos.id}`).get()).data();
  assert.deepEqual([datos.autorId, datos.origen, datos.usado, datos.titulo], [yo.uid, "docente", false, "Copia de Tu primer saludo"]);
  assert.ok((await db.doc(`ejercicios/${copia.datos.id}/privado/clave`).get()).exists);
});

test("docente: el quiz solo ofrece lenguajes comunes a sus ejercicios (RN-10)", async () => {
  const yo = await docente();
  const r = await guardarQuiz(yo, { ejercicioIds: ["salida-saludo", "poo-crear-objeto"], lenguajes: ["python", "c"] });
  assert.equal(r.estado, 400);
  assert.match(r.datos.error, /c/);
  assert.equal((await guardarQuiz(yo, { ejercicioIds: ["salida-saludo", "poo-crear-objeto"], lenguajes: ["python", "java"] })).estado, 200);
});

test("docente: si un ejercicio pasa a usar POO, sus quizzes dejan de ofrecer C", async () => {
  const yo = await docente();
  const { id } = (await guardarEjercicio(yo, nuevoEjercicio())).datos;
  const { id: quizId } = (await guardarQuiz(yo, { ejercicioIds: [id], lenguajes: ["c", "python"], publicado: false })).datos;
  const conClase = workspace(B("definir_clase", { fields: { NOMBRE: "Saludo", PADRE: "" } }), programa(imprimir(txt("Hola, Grace"))));
  const r = await guardarEjercicio(yo, { ...nuevoEjercicio({ toolbox: ["imprimir", "texto", "definir_clase"], soluciones: [conClase] }), id });
  assert.equal(r.estado, 200);
  assert.deepEqual((await db.doc(`quizzes/${quizId}`).get()).get("lenguajes"), ["python"]);
});

test("docente: no se borra un ejercicio que está en un quiz", async () => {
  const yo = await docente();
  const { id } = (await guardarEjercicio(yo, nuevoEjercicio())).datos;
  await guardarQuiz(yo, { ejercicioIds: [id], publicado: false });
  const r = await llamar(ejercicios, yo, { accion: "borrar", id });
  assert.equal(r.estado, 409);
  assert.match(r.datos.error, /Mi quiz/);
});

test("docente: un quiz creado por un docente se resuelve de punta a punta y luego queda fijo", async () => {
  const yo = await docente();
  const { id } = (await guardarEjercicio(yo, nuevoEjercicio())).datos;
  const { id: quizId } = (await guardarQuiz(yo, { ejercicioIds: [id] })).datos;

  const alumna = await estudiante();
  const sesion = (await llamar(sesiones, alumna, { quizId, lenguaje: "python" })).datos;
  const r = await llamar(respuesta, alumna, { sesionId: sesion.sesionId, ejercicioId: id, workspace: nuevoEjercicio().soluciones[0] });
  assert.equal(r.datos.correcto, true);

  // Ya hay resultados: cambian textos, no ejercicios ni penalización, y no se borra.
  assert.equal((await guardarQuiz(yo, { id: quizId, ejercicioIds: [id], titulo: "Nuevo título" })).estado, 200);
  assert.equal((await guardarQuiz(yo, { id: quizId, ejercicioIds: [id], penalizacionPista: 30 })).estado, 409);
  assert.equal((await llamar(quizzes, yo, { accion: "borrar", id: quizId })).estado, 409);
  // El ejercicio usado conserva su solución; sus pistas sí cambian.
  assert.equal((await guardarEjercicio(yo, { ...nuevoEjercicio({ pistas: ["Otra pista"] }), id })).estado, 200);
  const otraSolucion = workspace(programa(imprimir(txt("Hola, Ada"))));
  assert.equal((await guardarEjercicio(yo, { ...nuevoEjercicio({ soluciones: [otraSolucion] }), id })).estado, 409);
  assert.equal((await llamar(ejercicios, yo, { accion: "borrar", id })).estado, 409);
});

// ---------- privacidad: /api/cuenta y /api/limpieza ----------

test("eliminar cuenta: exige contraseña reciente y borra perfil, sesiones y usuario", async () => {
  const yo = await estudiante();
  const { sesionId } = (await iniciar(yo)).datos;
  const ajena = (await iniciar(await estudiante())).datos.sesionId;
  const borrarCuenta = (quien) => cuenta(new Request("http://localhost/api/cuenta", { method: "DELETE", headers: { Authorization: `Bearer ${quien.token}` } }));

  // Un inicio de sesión de hace más de 5 minutos no basta: se adelanta el reloj 10 minutos.
  const reloj = Date.now;
  Date.now = () => reloj() + 600_000;
  try {
    assert.equal((await borrarCuenta(yo)).status, 403);
  } finally {
    Date.now = reloj;
  }

  const r = await borrarCuenta(yo);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { sesionesBorradas: 1 });
  assert.equal((await db.doc(`usuarios/${yo.uid}`).get()).exists, false);
  assert.equal((await db.doc(`sesiones/${sesionId}`).get()).exists, false);
  assert.equal((await db.doc(`sesiones/${ajena}`).get()).exists, true);
  await assert.rejects(auth.getUser(yo.uid), { code: "auth/user-not-found" });
});

test("eliminar cuenta de docente: sus ejercicios y quizzes se archivan a nombre de baja", async () => {
  const yo = await docente();
  const { id } = (await guardarEjercicio(yo, nuevoEjercicio())).datos;
  const { id: quizId } = (await guardarQuiz(yo, { ejercicioIds: [id] })).datos;
  const r = await cuenta(new Request("http://localhost/api/cuenta", { method: "DELETE", headers: { Authorization: `Bearer ${yo.token}` } }));
  assert.equal(r.status, 200);
  const e = (await db.doc(`ejercicios/${id}`).get()).data();
  const q = (await db.doc(`quizzes/${quizId}`).get()).data();
  assert.deepEqual([e.autorId, e.archivado, q.autorId, q.publicado], ["baja", true, "baja", false]);
});

test("limpieza diaria: sin el secreto de Vercel Cron no hace nada", async () => {
  const r = await limpieza(new Request("http://localhost/api/limpieza"));
  assert.equal(r.status, 401);
  process.env.CRON_SECRET = "secreto-de-prueba";
  const otra = await limpieza(new Request("http://localhost/api/limpieza", { headers: { Authorization: "Bearer otro" } }));
  assert.equal(otra.status, 401);
  const ok = await limpieza(new Request("http://localhost/api/limpieza", { headers: { Authorization: "Bearer secreto-de-prueba" } }));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).borrados, 0, "nadie lleva 30 días inactivo en el emulador");
  delete process.env.CRON_SECRET;
});

test("el tope de sesiones responde 429, deja retomar y se reinicia a la hora", async () => {
  const yo = await invitado();
  await iniciar(yo);
  const limite = db.doc(`limites/${yo.uid}`);
  await limite.set({ desde: Timestamp.now(), sesiones: 20 });
  assert.equal((await iniciar(yo, { nueva: true })).estado, 429);
  assert.equal((await iniciar(yo)).estado, 200, "retomar la sesión en curso no cuenta");
  await limite.set({ desde: Timestamp.fromMillis(Date.now() - 3_700_000), sesiones: 20 });
  assert.equal((await iniciar(yo, { nueva: true })).estado, 200);
  assert.equal((await limite.get()).get("sesiones"), 1);
});

test("el tope de sesiones resiste peticiones simultáneas", async () => {
  const yo = await invitado();
  await db.doc(`limites/${yo.uid}`).set({ desde: Timestamp.now(), sesiones: 17 });
  const r = await Promise.all(Array.from({ length: 6 }, () => iniciar(yo, { nueva: true })));
  assert.equal(r.filter((x) => x.estado === 200).length, 3);
  assert.equal(r.filter((x) => x.estado === 429).length, 3);
});

test("con EXIGIR_APP_CHECK, una petición sin token válido de App Check se rechaza", async () => {
  const yo = await invitado();
  process.env.EXIGIR_APP_CHECK = "si";
  const sin = await iniciar(yo);
  const r = await sesiones(new Request("http://localhost/api", { method: "POST",
    headers: { Authorization: `Bearer ${yo.token}`, "X-Firebase-AppCheck": "falso" }, body: "{}" }));
  delete process.env.EXIGIR_APP_CHECK;
  assert.equal(sin.estado, 401);
  assert.equal(r.status, 401);
  assert.equal((await iniciar(yo)).estado, 200);
});

test("un ejercicioId con nombre heredado de Object responde 404, no 500", async () => {
  const yo = await invitado();
  const { sesionId } = (await iniciar(yo)).datos;
  for (const ejercicioId of ["__proto__", "constructor", "toString"]) {
    assert.equal((await llamar(pista, yo, { sesionId, ejercicioId })).estado, 404, ejercicioId);
  }
});

test("limpieza diaria: borra las sesiones de invitado vencidas y conserva las vigentes", async () => {
  const vencida = db.doc("sesiones/prueba-vencida");
  const vigente = db.doc("sesiones/prueba-vigente");
  await vencida.set({ expiraEn: Timestamp.fromMillis(Date.now() - 1000) });
  await vigente.set({ expiraEn: Timestamp.fromMillis(Date.now() + 86_400_000) });
  process.env.CRON_SECRET = "secreto-de-prueba";
  const r = await limpieza(new Request("http://localhost/api/limpieza", { headers: { Authorization: "Bearer secreto-de-prueba" } }));
  delete process.env.CRON_SECRET;
  assert.equal((await r.json()).sesionesVencidas, 1);
  assert.equal((await vencida.get()).exists, false);
  assert.equal((await vigente.get()).exists, true);
  await vigente.delete();
});
