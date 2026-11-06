// Pruebas de firestore.rules contra el emulador (RNF-SEG-13). Ejecutar con: npm run test:reglas
// Usa la API REST del emulador: cero dependencias. "Bearer owner" salta las reglas para sembrar datos.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const PROYECTO = "demo-blockbridge";
const HOST = `http://${process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8085"}`;
const RAIZ = `projects/${PROYECTO}/databases/(default)/documents`;

// Token sin firma: el emulador lo acepta como si viniera de Firebase Auth.
function token(uid, { proveedor = "password", verificado = true } = {}) {
  if (uid === "owner") return "owner";
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const ahora = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    sub: uid, user_id: uid, aud: PROYECTO, iss: `https://securetoken.google.com/${PROYECTO}`,
    iat: ahora, exp: ahora + 3600, auth_time: ahora,
    email: `${uid}@ejemplo.test`, email_verified: verificado,
    firebase: { sign_in_provider: proveedor },
  })}.`;
}

function valor(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === "number") return { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: campos(v) } };
}
const campos = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, valor(v)]));

const AHORA = Symbol("serverTimestamp");

// Escribe con :commit para poder usar serverTimestamp (request.time en las reglas).
function operacion(ruta, datos, mascara) {
  const fijos = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== AHORA));
  const tiempos = Object.keys(datos).filter((k) => datos[k] === AHORA);
  const write = {
    update: { name: `${RAIZ}/${ruta}`, fields: campos(fijos) },
    updateTransforms: tiempos.map((fieldPath) => ({ fieldPath, setToServerValue: "REQUEST_TIME" })),
  };
  if (mascara) write.updateMask = { fieldPaths: mascara.filter((k) => !tiempos.includes(k)) };
  return write;
}

const escribir = (quien, ruta, datos, { mascara } = {}) => lote(quien, [[ruta, datos, mascara]]);
const lote = (quien, ops) =>
  pedir(quien, "POST", `${HOST}/v1/${RAIZ}:commit`, { writes: ops.map((o) => operacion(...o)) });

const leer = (quien, ruta) => pedir(quien, "GET", `${HOST}/v1/${RAIZ}/${ruta}`);
const borrar = (quien, ruta) => pedir(quien, "DELETE", `${HOST}/v1/${RAIZ}/${ruta}`);

async function pedir(quien, metodo, url, cuerpo) {
  const auth = quien && (typeof quien === "string" ? token(quien) : token(quien.uid, quien));
  const r = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(auth && { Authorization: `Bearer ${auth}` }) },
    body: cuerpo && JSON.stringify(cuerpo),
  });
  return r.status;
}

const permitido = (s) => assert.equal(s, 200, `se esperaba 200, llegó ${s}`);
const denegado = (s) => assert.equal(s, 403, `se esperaba 403, llegó ${s}`);

const perfil = (extra = {}) => ({
  apodo: "pixel", rol: "estudiante", avisoVersion: "2.0", avisoAceptadoEn: AHORA, creadoEn: AHORA, ...extra,
});
const ejercicio = (autorId, extra = {}) => ({
  autorId, titulo: "Suma", enunciado: "Imprime 2 + 3", tema: "operadores", dificultad: "basico",
  toolbox: ["programa", "imprimir", "aritmetica", "numero"], workspaceInicial: {},
  lenguajes: ["python", "java"], numPistas: 1, origen: "docente", archivado: false, actualizadoEn: AHORA, ...extra,
});
const quiz = (autorId, extra = {}) => ({
  autorId, titulo: "Operadores", descripcion: "", ejercicioIds: ["e1"], lenguajes: ["python"],
  penalizacionPista: 20, publicado: true, origen: "docente", tema: "operadores", dificultad: "basico",
  actualizadoEn: AHORA, ...extra,
});

beforeEach(async () => {
  await fetch(`${HOST}/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`, { method: "DELETE" });
  // Semilla: dos docentes, un docente sin verificar y una estudiante.
  await escribir("owner", "usuarios/doc1", perfil({ rol: "docente" }));
  await escribir("owner", "usuarios/doc2", perfil({ rol: "docente" }));
  await escribir("owner", "usuarios/docNoVerif", perfil({ rol: "docente" }));
  await escribir("owner", "usuarios/ana", perfil());
});

// ---------- usuarios ----------

test("estudiante crea su propio perfil válido", async () => {
  permitido(await escribir("nuevo", "usuarios/nuevo", perfil()));
});

test("nadie se crea un perfil con rol docente (sin puertas traseras)", async () => {
  denegado(await escribir("nuevo", "usuarios/nuevo", perfil({ rol: "docente" })));
  denegado(await escribir("nuevo", "usuarios/nuevo", perfil({ rol: "admin" })));
});

test("no se crea el perfil de otro uid", async () => {
  denegado(await escribir("nuevo", "usuarios/otro", perfil()));
});

test("una sesión anónima no crea perfil", async () => {
  denegado(await escribir({ uid: "anon", proveedor: "anonymous", verificado: false }, "usuarios/anon", perfil()));
});

test("el perfil no admite campos extra, apodos inválidos ni fechas del cliente", async () => {
  denegado(await escribir("nuevo", "usuarios/nuevo", perfil({ esAdmin: true })));
  denegado(await escribir("nuevo", "usuarios/nuevo", perfil({ apodo: "ab" })));
  denegado(await escribir("nuevo", "usuarios/nuevo", perfil({ apodo: "x".repeat(31) })));
  denegado(await escribir("nuevo", "usuarios/nuevo", perfil({ creadoEn: "2020-01-01" })));
});

test("el usuario cambia su apodo y vuelve a aceptar el aviso", async () => {
  permitido(await escribir("ana", "usuarios/ana", { apodo: "pixel2" }, { mascara: ["apodo"] }));
  permitido(await escribir("ana", "usuarios/ana", { avisoVersion: "2.1", avisoAceptadoEn: AHORA },
    { mascara: ["avisoVersion", "avisoAceptadoEn"] }));
});

test("el usuario no cambia su rol", async () => {
  denegado(await escribir("ana", "usuarios/ana", { rol: "docente" }, { mascara: ["rol"] }));
});

test("perfiles: solo se lee el propio y el cliente no los borra", async () => {
  permitido(await leer("ana", "usuarios/ana"));
  denegado(await leer("ana", "usuarios/doc1"));
  denegado(await leer(null, "usuarios/ana"));
  denegado(await borrar("ana", "usuarios/ana"));
});

// ---------- ejercicios ----------

test("nadie escribe ejercicios ni su clave desde el cliente, ni siquiera un docente (solo /api)", async () => {
  denegado(await lote("doc1", [
    ["ejercicios/e1", ejercicio("doc1")],
    ["ejercicios/e1/privado/clave", { soluciones: [], pistas: ["Usa +"], explicacion: "x" }],
  ]));
  denegado(await escribir("doc1", "ejercicios/e1", ejercicio("doc1")));
  await escribir("owner", "ejercicios/e1", ejercicio("doc1"));
  denegado(await escribir("doc1", "ejercicios/e1", ejercicio("doc1", { usado: false })));
  denegado(await borrar("doc1", "ejercicios/e1"));
});

test("los docentes verificados leen ejercicios; estudiantes y docentes sin verificar, no", async () => {
  await escribir("owner", "ejercicios/e1", ejercicio("doc1"));
  permitido(await leer("doc2", "ejercicios/e1"));
  denegado(await leer("ana", "ejercicios/e1"));
  denegado(await leer({ uid: "docNoVerif", verificado: false }, "ejercicios/e1"));
});

test("la clave solo la lee su autor; nunca un estudiante", async () => {
  await escribir("owner", "ejercicios/e1", ejercicio("doc1"));
  await escribir("owner", "ejercicios/e1/privado/clave", { soluciones: [], pistas: [], explicacion: "x" });
  permitido(await leer("doc1", "ejercicios/e1/privado/clave"));
  denegado(await leer("doc2", "ejercicios/e1/privado/clave"));
  denegado(await leer("ana", "ejercicios/e1/privado/clave"));
});

// ---------- quizzes ----------

test("catálogo: cualquiera lee quizzes publicados; borradores solo docentes", async () => {
  await escribir("owner", "quizzes/pub", quiz("doc1"));
  await escribir("owner", "quizzes/borr", quiz("doc1", { publicado: false }));
  permitido(await leer(null, "quizzes/pub"));
  denegado(await leer("ana", "quizzes/borr"));
  permitido(await leer("doc2", "quizzes/borr"));
});

test("nadie escribe quizzes desde el cliente (solo /api)", async () => {
  denegado(await escribir("doc1", "quizzes/q1", quiz("doc1")));
  await escribir("owner", "quizzes/q1", quiz("doc1"));
  denegado(await escribir("doc1", "quizzes/q1", quiz("doc1", { titulo: "Otro" })));
  denegado(await borrar("doc1", "quizzes/q1"));
});

// ---------- sesiones ----------

test("sesiones: el cliente nunca escribe, ni siquiera la propia", async () => {
  denegado(await escribir("ana", "sesiones/s1", { uid: "ana", puntaje: 100, autorQuizId: "doc1" }));
});

test("sesiones: el estudiante lee las suyas; el docente las de sus quizzes y las precargadas", async () => {
  await escribir("owner", "sesiones/s1", { uid: "ana", quizId: "q1", autorQuizId: "doc1", puntaje: 80 });
  await escribir("owner", "sesiones/s2", { uid: "ana", quizId: "pre", autorQuizId: "sistema", puntaje: 50 });
  permitido(await leer("ana", "sesiones/s1"));
  denegado(await leer("otra", "sesiones/s1"));
  permitido(await leer("doc1", "sesiones/s1"));
  denegado(await leer("doc2", "sesiones/s1"));
  permitido(await leer("doc2", "sesiones/s2"));
});

test("cualquier otra colección está denegada", async () => {
  denegado(await escribir("doc1", "grupos/g1", { nombre: "x" }));
  denegado(await leer("doc1", "grupos/g1"));
});
