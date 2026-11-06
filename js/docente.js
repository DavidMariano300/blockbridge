import { db } from "./firebase.js";
import { observarSesion, esDocente, mensajeError } from "./sesion.js";
import { api } from "./api.js";
import { LENGUAJES } from "./bloques/lenguajes.js";
import { LENGUAJES_CURSO } from "./bloques/definiciones.js";
import { lenguajesComunes, TEMAS as TEMAS_IDS } from "./bloques/validar.js";
import { TEMAS, DIFICULTADES, etiqueta, etiquetasDe } from "./etiquetas.js";
import { iniciarEditorEjercicio } from "./docente-ejercicio.js";
import { iniciarResultados } from "./docente-resultados.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const crear = (tag, props = {}, ...hijos) => {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...hijos.filter((h) => h !== null && h !== undefined && h !== false));
  return el;
};
const boton = (texto, accion, clase = "boton boton--secundario") => {
  const b = crear("button", { type: "button", className: clase, textContent: texto });
  b.addEventListener("click", accion);
  return b;
};

let uid = null;
const ejercicios = { mios: [], banco: [] };
const quizzes = { mios: [], banco: [] };
const todosLosEjercicios = () => new Map([...ejercicios.mios, ...ejercicios.banco].map((e) => [e.id, e]));

function avisar(texto, error = false) {
  $("estado-panel").className = `estado ${error ? "error" : "ok"}`;
  $("estado-panel").textContent = texto;
}

// Ejecuta una acción de la API y avisa del resultado; devuelve false si falló.
async function intentar(accion, exito) {
  try {
    await accion();
    if (exito) avisar(exito);
    return true;
  } catch (e) {
    avisar(mensajeError(e), true);
    return false;
  }
}

const docs = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
const porTitulo = (a, b) => a.titulo.localeCompare(b.titulo);

async function cargarDatos() {
  const [mios, banco, quizMios, quizBanco] = await Promise.all([
    docs(query(collection(db, "ejercicios"), where("autorId", "==", uid))),
    docs(query(collection(db, "ejercicios"), where("origen", "==", "precargado"))),
    docs(query(collection(db, "quizzes"), where("autorId", "==", uid))),
    docs(query(collection(db, "quizzes"), where("origen", "==", "precargado"))),
  ]);
  ejercicios.mios = mios.sort(porTitulo);
  ejercicios.banco = banco.sort((a, b) => TEMAS_IDS.indexOf(a.tema) - TEMAS_IDS.indexOf(b.tema) || porTitulo(a, b));
  quizzes.mios = quizMios.sort(porTitulo);
  quizzes.banco = quizBanco.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  pintarEjercicios();
  pintarQuizzes();
}

// Ejercicios

function pintarEjercicios() {
  $("filas-mis-ejercicios").replaceChildren(...ejercicios.mios.map((e) => crear("tr", {},
    crear("th", { scope: "row" }, e.titulo, e.archivado ? crear("span", {}, " ", etiqueta("Archivado")) : null),
    crear("td", { textContent: TEMAS[e.tema] ?? e.tema }),
    crear("td", { textContent: e.usado ? "Con respuestas" : "Sin respuestas" }),
    crear("td", { className: "docente__acciones-fila" },
      boton("Editar", () => editorEjercicio.abrir(e.id)),
      boton("Duplicar", () => duplicar(e.id)),
      boton(e.archivado ? "Desarchivar" : "Archivar", () => intentar(
        () => api("ejercicios", { accion: "archivar", id: e.id, archivado: !e.archivado }).then(cargarDatos),
        e.archivado ? "Ejercicio desarchivado." : "Ejercicio archivado: ya no se ofrece para quizzes nuevos.")),
      e.usado ? null : boton("Borrar", () => confirm(`¿Borrar «${e.titulo}»? No se puede deshacer.`)
        && intentar(() => api("ejercicios", { accion: "borrar", id: e.id }).then(cargarDatos), "Ejercicio borrado."))),
  )));
  $("sin-ejercicios").hidden = ejercicios.mios.length > 0;
  $("filas-banco").replaceChildren(...ejercicios.banco.map((e) => crear("tr", {},
    crear("th", { scope: "row", textContent: e.titulo }),
    crear("td", { textContent: TEMAS[e.tema] ?? e.tema }),
    crear("td", { textContent: DIFICULTADES[e.dificultad] ?? e.dificultad }),
    crear("td", { className: "docente__acciones-fila" }, boton("Duplicar", () => duplicar(e.id))),
  )));
}

async function duplicar(id) {
  let nuevo;
  const ok = await intentar(async () => {
    nuevo = await api("ejercicios", { accion: "duplicar", id });
    await cargarDatos();
  }, "Copia creada: ya puedes editarla.");
  if (ok) editorEjercicio.abrir(nuevo.id);
}

const editorEjercicio = iniciarEditorEjercicio({
  alAbrir: () => { $("lista-ejercicios").hidden = true; $("editor-ejercicio").hidden = false; window.scrollTo(0, 0); },
  alCerrar: async (mensaje) => {
    $("editor-ejercicio").hidden = true;
    $("lista-ejercicios").hidden = false;
    if (mensaje) {
      avisar(mensaje);
      await cargarDatos();
    }
  },
});

// Quizzes

function pintarQuizzes() {
  $("filas-quizzes").replaceChildren(...quizzes.mios.map((q) => crear("tr", {},
    crear("th", { scope: "row" }, q.titulo),
    crear("td", { textContent: String(q.ejercicioIds.length) }),
    crear("td", {}, etiqueta(q.publicado ? "Publicado" : "Borrador"), q.usado ? crear("span", {}, " ", etiqueta("Con resultados")) : null),
    crear("td", { className: "docente__acciones-fila" },
      boton("Editar", () => abrirQuiz(q)),
      boton("Resultados", () => { mostrarSeccion(2); resultados.mostrar(q.id); }),
      boton(q.publicado ? "Despublicar" : "Publicar", () => intentar(
        () => api("quizzes", { accion: "guardar", quiz: { ...q, publicado: !q.publicado } }).then(cargarDatos),
        q.publicado ? "Quiz despublicado: ya no aparece en el catálogo." : "Quiz publicado: ya aparece en el catálogo.")),
      q.usado ? null : boton("Borrar", () => confirm(`¿Borrar «${q.titulo}»? No se puede deshacer.`)
        && intentar(() => api("quizzes", { accion: "borrar", id: q.id }).then(cargarDatos), "Quiz borrado."))),
  )));
  $("sin-quizzes").hidden = quizzes.mios.length > 0;
}

let quizEditado = null;

function abrirQuiz(q = null) {
  const form = $("editor-quiz");
  quizEditado = { id: q?.id ?? null, usado: q?.usado === true, elegidos: [...(q?.ejercicioIds ?? [])],
    marcados: new Set(q?.lenguajes ?? LENGUAJES_CURSO) };
  $("titulo-editor-quiz").textContent = q ? "Editar quiz" : "Nuevo quiz";
  $("aviso-quiz-usado").hidden = !quizEditado.usado;
  $("errores-quiz").hidden = true;
  form.titulo.value = q?.titulo ?? "";
  form.descripcion.value = q?.descripcion ?? "";
  form.penalizacionPista.value = q?.penalizacionPista ?? 20;
  form.penalizacionPista.disabled = quizEditado.usado;
  form.publicado.checked = q?.publicado ?? false;
  $("lista-quizzes").hidden = true;
  form.hidden = false;
  pintarEditorQuiz();
  form.titulo.focus();
}

function cerrarQuiz() {
  $("editor-quiz").hidden = true;
  $("lista-quizzes").hidden = false;
}

function pintarEditorQuiz() {
  const mapa = todosLosEjercicios();
  const { elegidos, usado } = quizEditado;
  const mover = (i, paso) => {
    [elegidos[i], elegidos[i + paso]] = [elegidos[i + paso], elegidos[i]];
    pintarEditorQuiz();
  };
  $("quiz-elegidos").replaceChildren(...elegidos.map((id, i) => {
    const e = mapa.get(id);
    const acciones = usado ? [] : [
      i > 0 && boton("Subir", () => mover(i, -1)),
      i < elegidos.length - 1 && boton("Bajar", () => mover(i, 1)),
      boton("Quitar", () => { elegidos.splice(i, 1); pintarEditorQuiz(); }),
    ];
    return crear("li", {}, crear("span", { className: "docente__nombre", textContent: e?.titulo ?? id }),
      crear("span", { className: "etiquetas" }, ...(e ? etiquetasDe(e.tema, e.dificultad) : [])),
      crear("span", { className: "docente__acciones-fila" }, ...acciones));
  }));
  $("quiz-sin-elegidos").hidden = elegidos.length > 0;

  const tema = $("quiz-filtro-tema").value;
  const disponibles = [...ejercicios.mios.filter((e) => !e.archivado), ...ejercicios.banco]
    .filter((e) => !elegidos.includes(e.id) && (!tema || e.tema === tema));
  $("quiz-disponibles").replaceChildren(...disponibles.map((e) => crear("li", {},
    crear("span", { className: "docente__nombre", textContent: e.titulo }),
    crear("span", { className: "etiquetas" }, ...etiquetasDe(e.tema, e.dificultad), e.origen === "precargado" ? etiqueta("Banco") : null),
    usado ? null : boton("Agregar", () => { elegidos.push(e.id); pintarEditorQuiz(); }),
  )));

  // Solo se ofrecen los lenguajes que admiten todos los ejercicios elegidos (RN-10).
  const comunes = lenguajesComunes(elegidos.map((id) => mapa.get(id)?.lenguajes ?? []));
  $("quiz-lenguajes").replaceChildren(...LENGUAJES_CURSO.map((l) => {
    const casilla = crear("input", { type: "checkbox", value: l, checked: quizEditado.marcados.has(l) && comunes.includes(l),
      disabled: usado || !comunes.includes(l) });
    casilla.addEventListener("change", () => (casilla.checked ? quizEditado.marcados.add(l) : quizEditado.marcados.delete(l)));
    return crear("label", { className: "casilla" }, casilla, crear("span", { textContent: LENGUAJES[l].nombre }));
  }));
}

async function guardarQuiz(evento) {
  evento.preventDefault();
  const form = $("editor-quiz");
  const lenguajes = [...$("quiz-lenguajes").querySelectorAll("input:checked")].map((c) => c.value);
  const quiz = {
    id: quizEditado.id ?? undefined, titulo: form.titulo.value, descripcion: form.descripcion.value,
    penalizacionPista: Number(form.penalizacionPista.value), publicado: form.publicado.checked,
    ejercicioIds: quizEditado.elegidos, lenguajes,
  };
  const boton = form.querySelector("button[type=submit]");
  boton.disabled = true;
  try {
    await api("quizzes", { accion: "guardar", quiz });
    cerrarQuiz();
    avisar(quiz.publicado ? "Quiz guardado y publicado." : "Quiz guardado como borrador.");
    await cargarDatos();
  } catch (e) {
    $("texto-errores-quiz").textContent = mensajeError(e);
    $("errores-quiz").hidden = false;
  } finally {
    boton.disabled = false;
  }
}

// Pestañas y acceso

const resultados = iniciarResultados({ quizzes, ejercicio: (id) => todosLosEjercicios().get(id) });
const SECCIONES = ["ejercicios", "quizzes", "resultados"];

function mostrarSeccion(i, enfocar = false) {
  SECCIONES.forEach((s, j) => {
    $(`tab-${s}`).setAttribute("aria-selected", String(i === j));
    $(`tab-${s}`).tabIndex = i === j ? 0 : -1;
    $(`seccion-${s}`).hidden = i !== j;
  });
  avisar("");
  if (enfocar) $(`tab-${SECCIONES[i]}`).focus();
  if (SECCIONES[i] === "resultados") resultados.mostrar();
}

function montar() {
  SECCIONES.forEach((s, i) => $(`tab-${s}`).addEventListener("click", () => mostrarSeccion(i)));
  document.querySelector('[role="tablist"]').addEventListener("keydown", (e) => {
    const paso = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    const actual = SECCIONES.findIndex((s) => $(`tab-${s}`) === document.activeElement);
    if (paso && actual >= 0) mostrarSeccion((actual + paso + SECCIONES.length) % SECCIONES.length, true);
  });
  $("nuevo-ejercicio").addEventListener("click", () => editorEjercicio.abrir(null));
  $("nuevo-quiz").addEventListener("click", () => abrirQuiz(null));
  $("volver-quizzes").addEventListener("click", cerrarQuiz);
  $("cancelar-quiz").addEventListener("click", cerrarQuiz);
  $("editor-quiz").addEventListener("submit", guardarQuiz);
  $("quiz-filtro-tema").replaceChildren(crear("option", { value: "", textContent: "Todos los temas" }),
    ...TEMAS_IDS.map((t) => crear("option", { value: t, textContent: TEMAS[t] })));
  $("quiz-filtro-tema").addEventListener("change", pintarEditorQuiz);
}

let iniciado = false;
observarSesion(async ({ usuario, perfil }) => {
  if (iniciado) return;
  iniciado = true;
  $("cargando").hidden = true;
  if (!esDocente(usuario, perfil)) {
    const registrado = usuario && !usuario.isAnonymous;
    $("sin-acceso-texto").textContent = !registrado
      ? "Inicia sesión con tu cuenta de docente para crear ejercicios y ver resultados."
      : perfil?.rol === "docente"
        ? "Verifica tu correo para usar el panel. Puedes reenviar el correo de verificación desde Mi cuenta."
        : "Esta sección es para docentes. Si das clases, solicita el rol al administrador desde tu correo institucional.";
    $("sin-acceso-enlace").href = registrado ? "cuenta.html" : "cuenta.html#entrar";
    $("sin-acceso-enlace").textContent = registrado ? "Ir a mi cuenta" : "Entrar";
    $("sin-acceso").hidden = false;
    return;
  }
  uid = usuario.uid;
  montar();
  $("panel").hidden = false;
  try {
    await cargarDatos();
  } catch (e) {
    avisar(mensajeError(e), true);
  }
});
