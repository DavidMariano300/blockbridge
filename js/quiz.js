import { auth, db } from "./firebase.js";
import { observarSesion, mensajeError } from "./sesion.js";
import { api } from "./api.js";
import { crearEditor } from "./editor.js";
import { generarCodigo, generadoresDisponibles, mensajeBloquesSueltos } from "./codigo.js";
import { LENGUAJES } from "./bloques/lenguajes.js";
import { etiquetasDe } from "./etiquetas.js";
import { mensajeDiferencia, crearResaltador } from "./retro.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const quizId = new URLSearchParams(location.search).get("id");

const reloj = (seg) => `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(Math.floor(seg % 60)).padStart(2, "0")}`;
const leer = (clave) => { try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; } };
const escribir = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ } };
const mostrarSolo = (id) => ["cargando", "error-quiz", "portada", "resolucion", "resumen"].forEach((s) => ($(s).hidden = s !== id));

let quiz;
let vista;
let actual = 0;
let editor;
let generadores;
let lenguaje;
// Segundos acumulados por ejercicio; el reloj corre solo mientras el ejercicio está a la vista.
let tiempos = {};
let desde = null;
let intervalo;
// Evita guardar el editor vacío sobre el progreso antes de cargar el primer ejercicio.
let ejercicioCargado = false;
let resaltar = () => {};

function fallar(texto) {
  $("error-texto").textContent = texto;
  mostrarSolo("error-quiz");
}

// Portada

async function cargarPortada() {
  if (!quizId) return fallar("El enlace no indica qué quiz abrir.");
  try {
    const snap = await getDoc(doc(db, "quizzes", quizId));
    quiz = snap.data();
  } catch {
    quiz = null;
  }
  if (!quiz?.publicado) return fallar("Este quiz no existe o ya no está publicado.");

  document.title = `${quiz.titulo} · BlockBridge Academy`;
  $("portada-titulo").textContent = quiz.titulo;
  $("portada-descripcion").textContent = quiz.descripcion;
  $("portada-etiquetas").replaceChildren(...etiquetasDe(quiz.tema, quiz.dificultad));
  $("regla-ejercicios").textContent = `${quiz.ejercicioIds.length} ejercicios; todos valen lo mismo y la calificación va de 0 a 100`;
  $("regla-pistas").textContent = quiz.penalizacionPista
    ? `Cada pista resta ${quiz.penalizacionPista} puntos al ejercicio donde la uses`
    : "Las pistas no restan puntos en este quiz";

  const disponibles = quiz.lenguajes.filter((l) => LENGUAJES[l]);
  if (!disponibles.length) return fallar("Este quiz todavía no está disponible en los lenguajes del editor.");
  $("portada-lenguajes").replaceChildren(...disponibles.map((l, i) => {
    const opcion = document.createElement("label");
    opcion.append(Object.assign(document.createElement("input"), { type: "radio", name: "lenguaje", value: l, checked: i === 0 }),
      Object.assign(document.createElement("span"), { textContent: LENGUAJES[l].nombre }));
    return opcion;
  }));
  mostrarSolo("portada");
}

// Si no hay sesión se crea una de invitado en silencio (CU-05 incluye CU-01).
async function comenzar(nueva) {
  const boton = $("comenzar");
  boton.disabled = true;
  $("estado-portada").textContent = "";
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
    // Repetir o empezar de nuevo conserva el lenguaje de la sesión; desde la portada se usa el elegido.
    const elegido = (nueva && lenguaje) || document.querySelector('input[name="lenguaje"]:checked')?.value;
    await abrirSesion(await api("sesiones", { quizId, lenguaje: elegido, nueva }));
  } catch (e) {
    $("estado-portada").className = "estado error";
    $("estado-portada").textContent = mensajeError(e);
    if (!$("portada").hidden) return;
    mostrarSolo("portada");
  } finally {
    boton.disabled = false;
  }
}

// Resolución

async function abrirSesion(datos) {
  vista = datos;
  lenguaje = vista.lenguaje;
  ejercicioCargado = false;
  desde = null;
  tiempos = leer(`bb:quiz:${vista.sesionId}:tiempos`) ?? Object.fromEntries(vista.ejercicios.map((e) => [e.id, e.tiempoSeg ?? 0]));
  mostrarSolo("resolucion");
  $("aviso-retomada").hidden = !vista.retomada;
  $("quiz-titulo").textContent = vista.quiz.titulo;
  $("quiz-lenguaje").textContent = `Código en ${LENGUAJES[lenguaje]?.nombre ?? lenguaje}`;
  $("titulo-codigo").textContent = LENGUAJES[lenguaje]?.nombre ?? lenguaje;

  if (!editor) {
    editor = await crearEditor("blockly");
    resaltar = crearResaltador(editor.workspace);
    generadores = generadoresDisponibles();
    editor.alCambiar(() => {
      if (!ejercicioCargado) return;
      resaltar(null);
      escribir(claveEjercicio(), editor.guardar());
      actualizarCodigo();
    });
  }
  const primeraPendiente = vista.ejercicios.findIndex((e) => e.estado !== "resuelto");
  mostrarEjercicio(primeraPendiente === -1 ? 0 : primeraPendiente);
  clearInterval(intervalo);
  intervalo = setInterval(pintarRelojes, 1000);
  pintarRelojes();
}

const claveEjercicio = (i = actual) => `bb:quiz:${vista.sesionId}:${vista.ejercicios[i].id}`;

function acumularTiempo() {
  const ej = vista?.ejercicios[actual];
  if (desde !== null && ej && ej.estado !== "resuelto") tiempos[ej.id] += (Date.now() - desde) / 1000;
  desde = document.hidden || !ej || ej.estado === "resuelto" ? null : Date.now();
  if (vista) escribir(`bb:quiz:${vista.sesionId}:tiempos`, tiempos);
}

const segundosEjercicio = () => {
  const ej = vista.ejercicios[actual];
  return tiempos[ej.id] + (desde !== null && ej.estado !== "resuelto" ? (Date.now() - desde) / 1000 : 0);
};

function pintarRelojes() {
  $("tiempo-total").textContent = reloj(Math.max(0, (Date.now() - vista.inicio) / 1000));
  $("tiempo-ejercicio").textContent = reloj(segundosEjercicio());
}

function mostrarEjercicio(i) {
  if (ejercicioCargado) {
    escribir(claveEjercicio(), editor.guardar());
    acumularTiempo();
  }
  actual = i;
  desde = null;
  acumularTiempo();

  const ej = vista.ejercicios[i];
  $("ej-numero").textContent = `Ejercicio ${i + 1} de ${vista.ejercicios.length}`;
  $("ej-etiquetas").replaceChildren(...etiquetasDe(ej.tema, ej.dificultad));
  $("ej-titulo").textContent = ej.titulo;
  $("ej-enunciado").textContent = ej.enunciado;
  editor.restringir(new Set(ej.toolbox));
  try {
    editor.cargar(leer(claveEjercicio()) ?? ej.workspaceInicial);
  } catch {
    editor.cargar(ej.workspaceInicial);
  }
  ejercicioCargado = true;
  $("anterior").disabled = i === 0;
  $("siguiente").disabled = i === vista.ejercicios.length - 1;
  pintarEstadoEjercicio();
  pintarProgreso();
  actualizarCodigo();
}

function pintarEstadoEjercicio() {
  const ej = vista.ejercicios[actual];
  const resuelto = ej.estado === "resuelto";
  $("comprobar").disabled = resuelto;
  $("pistas").replaceChildren(...ej.pistas.map((p) => Object.assign(document.createElement("li"), { textContent: p })));
  $("bloque-pistas").hidden = ej.numPistas === 0;
  const restantes = ej.numPistas - ej.pistas.length;
  $("pedir-pista").hidden = resuelto || restantes === 0;
  $("pedir-pista").textContent = `Pedir pista (${restantes} ${restantes === 1 ? "disponible" : "disponibles"})`;
  if (resuelto) retro("ok", `Resuelto: ${ej.puntaje} puntos`, ej.explicacion ?? "");
  else $("retro").hidden = true;
  $("puntaje-quiz").textContent = String(vista.puntaje);
}

function pintarProgreso() {
  $("progreso").replaceChildren(...vista.ejercicios.map((e, i) => {
    const b = Object.assign(document.createElement("button"), { type: "button", className: "paso", textContent: String(i + 1) });
    b.dataset.estado = e.estado;
    b.setAttribute("aria-label", `Ejercicio ${i + 1}: ${e.titulo}, ${e.estado === "resuelto" ? "resuelto" : "sin resolver"}`);
    if (i === actual) b.setAttribute("aria-current", "step");
    b.addEventListener("click", () => mostrarEjercicio(i));
    return b;
  }));
}

function actualizarCodigo() {
  $("codigo-generado").textContent = generadores[lenguaje] ? generarCodigo(generadores[lenguaje], editor.workspace) : "";
  const aviso = mensajeBloquesSueltos(editor.workspace);
  $("bloques-sueltos").hidden = !aviso;
  $("bloques-sueltos").textContent = aviso;
}

function retro(tipo, titulo, texto) {
  $("retro").hidden = false;
  $("retro").className = `retro retro--${tipo}`;
  $("retro-titulo").textContent = titulo;
  $("retro-texto").textContent = texto;
}

async function comprobar() {
  const ej = vista.ejercicios[actual];
  $("comprobar").disabled = true;
  try {
    const r = await api("respuesta", { sesionId: vista.sesionId, ejercicioId: ej.id, workspace: editor.guardar(), segundos: Math.round(segundosEjercicio()) });
    if (r.correcto) {
      acumularTiempo();
      Object.assign(ej, { estado: "resuelto", puntaje: r.puntaje, explicacion: r.explicacion });
      vista.puntaje = r.puntajeQuiz;
      desde = null;
      pintarEstadoEjercicio();
      pintarProgreso();
      if (vista.ejercicios.every((e) => e.estado === "resuelto")) {
        retro("ok", `Correcto: ${r.puntaje} puntos. Completaste todos los ejercicios`, `${r.explicacion} Pulsa «Finalizar quiz» para ver tu resultado.`);
      }
    } else {
      ej.intentos = r.intentos;
      resaltar(r.diferencia.bloqueId);
      retro("error", `Todavía no. Intento ${r.intentos}`, `${mensajeDiferencia(r.diferencia)} Reintentar no resta puntos.`);
    }
  } catch (e) {
    retro("error", "No se pudo comprobar", mensajeError(e));
  } finally {
    $("comprobar").disabled = vista.ejercicios[actual].estado === "resuelto";
  }
}

async function pedirPista() {
  const ej = vista.ejercicios[actual];
  const p = vista.quiz.penalizacionPista;
  const maximo = Math.max(0, 100 - ej.pistas.length * p);
  $("dialogo-texto").textContent = p
    ? `Esta pista resta ${p} puntos. El puntaje máximo de este ejercicio bajará de ${maximo} a ${Math.max(0, maximo - p)}.`
    : "En este quiz las pistas no restan puntos.";
  const dialogo = $("dialogo-pista");
  dialogo.returnValue = "";
  dialogo.showModal();
  dialogo.addEventListener("close", async () => {
    if (dialogo.returnValue !== "confirmar") return;
    try {
      const r = await api("pista", { sesionId: vista.sesionId, ejercicioId: ej.id });
      ej.pistas.push(r.pista);
      pintarEstadoEjercicio();
    } catch (e) {
      retro("error", "No se pudo mostrar la pista", mensajeError(e));
    }
  }, { once: true });
}

async function finalizar() {
  const pendientes = vista.ejercicios.filter((e) => e.estado !== "resuelto").length;
  if (pendientes && !confirm(`Tienes ${pendientes} ${pendientes === 1 ? "ejercicio" : "ejercicios"} sin resolver, que valdrán 0. ¿Finalizar el quiz?`)) return;
  $("finalizar").disabled = true;
  try {
    acumularTiempo();
    mostrarResumen(await api("finalizar", { sesionId: vista.sesionId }));
  } catch (e) {
    retro("error", "No se pudo finalizar", mensajeError(e));
  } finally {
    $("finalizar").disabled = false;
  }
}

// Resumen

function mostrarResumen(r) {
  clearInterval(intervalo);
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(`bb:quiz:${vista.sesionId}:`)).forEach((k) => localStorage.removeItem(k));
  } catch { /* sin almacenamiento */ }
  $("resumen-puntaje").textContent = String(r.puntaje);
  $("resumen-duracion").textContent = `Duración total: ${Math.floor(r.duracionSeg / 60)} min ${r.duracionSeg % 60} s.`;
  $("resumen-invitado").hidden = !auth.currentUser?.isAnonymous;
  $("resumen-filas").replaceChildren(...r.ejercicios.map((e) => {
    const fila = document.createElement("tr");
    const celdas = [e.titulo, e.estado === "resuelto" ? "Resuelto" : "Sin resolver", e.intentos, e.pistas, reloj(e.tiempoSeg), e.puntaje];
    fila.append(...celdas.map((c, i) => Object.assign(document.createElement(i === 0 ? "th" : "td"), { textContent: String(c) })));
    fila.firstChild.scope = "row";
    return fila;
  }));
  mostrarSolo("resumen");
  window.scrollTo(0, 0);
}

// Manejo de las pestañas Enunciado / Bloques / Código en pantallas angostas.
function montarPestanas() {
  const area = document.querySelector(".quiz__area");
  const vistas = ["enunciado", "bloques", "codigo"];
  const pestanas = vistas.map((v) => $(`tab-${v}`));
  const mostrar = (i, enfocar = false) => {
    pestanas.forEach((p, j) => {
      p.setAttribute("aria-selected", String(i === j));
      p.tabIndex = i === j ? 0 : -1;
    });
    area.dataset.vista = vistas[i];
    if (enfocar) pestanas[i].focus();
    if (vistas[i] === "bloques") editor?.redimensionar();
  };
  pestanas.forEach((p, i) => p.addEventListener("click", () => mostrar(i)));
  document.querySelector(".quiz__pestanas").addEventListener("keydown", (e) => {
    const paso = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (paso) mostrar((pestanas.indexOf(document.activeElement) + paso + vistas.length) % vistas.length, true);
  });
}

$("comenzar").addEventListener("click", () => comenzar(false));
$("empezar-nuevo").addEventListener("click", () => {
  if (confirm("Se abrirá una sesión nueva desde cero; la actual quedará sin terminar. ¿Continuar?")) comenzar(true);
});
$("repetir").addEventListener("click", () => comenzar(true));
$("comprobar").addEventListener("click", comprobar);
$("pedir-pista").addEventListener("click", pedirPista);
$("finalizar").addEventListener("click", finalizar);
$("anterior").addEventListener("click", () => mostrarEjercicio(actual - 1));
$("siguiente").addEventListener("click", () => mostrarEjercicio(actual + 1));
$("reiniciar-ejercicio").addEventListener("click", () => {
  if (confirm("Se borrarán los bloques de este ejercicio. ¿Continuar?")) editor.cargar(vista.ejercicios[actual].workspaceInicial);
});
document.addEventListener("visibilitychange", () => vista && acumularTiempo());
montarPestanas();

let portadaCargada = false;
observarSesion(() => {
  if (portadaCargada) return;
  portadaCargada = true;
  cargarPortada();
});
