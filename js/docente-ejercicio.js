// Editor de ejercicios del docente (CU-11): datos, paleta, bloques iniciales, soluciones y vista previa.
import { db } from "./firebase.js";
import { api } from "./api.js";
import { mensajeError } from "./sesion.js";
import { crearEditor } from "./editor.js";
import { generarCodigo, generadoresDisponibles } from "./codigo.js";
import { TOOLBOX } from "./bloques/definiciones.js";
import { tiposUsados, comparar } from "./bloques/evaluador.js";
import { validarEjercicio, TEMAS as TEMAS_IDS, DIFICULTADES as DIFICULTADES_IDS } from "./bloques/validar.js";
import { TEMAS, DIFICULTADES } from "./etiquetas.js";
import { mensajeDiferencia, crearResaltador } from "./retro.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const VACIO = () => ({ blocks: { languageVersion: 0, blocks: [{ type: "programa", x: 32, y: 32 }] } });
const MAX_SOLUCIONES = 5;

// La paleta del estudiante se elige por categorías, con los mismos bloques que la toolbox completa.
const CATEGORIAS = TOOLBOX.contents.map((c) => ({
  nombre: c.name,
  tipos: c.custom ? ["declarar_variable", "asignar", "variable"] : [...new Set(c.contents.map((b) => b.type))],
}));
const nombreBloque = (tipo) => tipo.replaceAll("_", " ");

export function iniciarEditorEjercicio({ alAbrir, alCerrar }) {
  const form = $("form-ejercicio");
  let editor = null;
  let generador = null;
  let resaltar = () => {};
  // espacios: bloques iniciales y soluciones; actual: "inicial" o el índice de la solución.
  let estado = null;

  form.tema.replaceChildren(new Option("Elige un tema", ""), ...TEMAS_IDS.map((t) => new Option(TEMAS[t], t)));
  form.dificultad.replaceChildren(new Option("Elige una dificultad", ""), ...DIFICULTADES_IDS.map((d) => new Option(DIFICULTADES[d], d)));
  $("paleta").replaceChildren(...CATEGORIAS.map(({ nombre, tipos }) => {
    const grupo = document.createElement("fieldset");
    grupo.append(Object.assign(document.createElement("legend"), { textContent: nombre }), ...tipos.map((t) => {
      const etiqueta = Object.assign(document.createElement("label"), { className: "casilla" });
      etiqueta.append(Object.assign(document.createElement("input"), { type: "checkbox", name: "toolbox", value: t }),
        Object.assign(document.createElement("span"), { textContent: nombreBloque(t) }));
      return etiqueta;
    }));
    return grupo;
  }));

  const espacioActual = () => (estado.actual === "inicial" ? estado.inicial : estado.soluciones[estado.actual]);
  function guardarActual() {
    if (!editor || estado.previa) return;
    const ws = editor.guardar();
    if (estado.actual === "inicial") estado.inicial = ws;
    else estado.soluciones[estado.actual] = ws;
  }

  function pintarEspacios() {
    const opciones = [["inicial", "Bloques iniciales"], ...estado.soluciones.map((_, i) => [i, `Solución ${i + 1}`])];
    $("selector-espacio").replaceChildren(...opciones.map(([valor, texto]) => {
      const etiqueta = document.createElement("label");
      const radio = Object.assign(document.createElement("input"), { type: "radio", name: "espacio", value: String(valor), checked: valor === estado.actual });
      radio.addEventListener("change", () => {
        guardarActual();
        estado.actual = valor === "inicial" ? "inicial" : Number(valor);
        editor.cargar(espacioActual());
        pintarEspacios();
      });
      etiqueta.append(radio, Object.assign(document.createElement("span"), { textContent: texto }));
      return etiqueta;
    }));
    $("ayuda-espacio").textContent = estado.actual === "inicial"
      ? "Los bloques con los que empieza el estudiante. Deja solo «programa» si debe armar todo."
      : "Una forma correcta de resolverlo. Agrega otra solución si hay más de un orden válido, por ejemplo 2 + 3 y 3 + 2.";
    $("agregar-solucion").disabled = estado.usado || estado.soluciones.length >= MAX_SOLUCIONES;
    $("quitar-solucion").disabled = estado.usado || estado.actual === "inicial" || estado.soluciones.length === 1;
  }

  function actualizarCodigo() {
    $("codigo-docente").textContent = generarCodigo(generador, editor.workspace);
  }

  async function asegurarEditor() {
    if (editor) return;
    editor = await crearEditor("blockly");
    generador = generadoresDisponibles().python;
    resaltar = crearResaltador(editor.workspace);
    editor.alCambiar(() => {
      resaltar(null);
      guardarActual();
      actualizarCodigo();
    });
  }

  function mostrarErrores(errores) {
    $("lista-errores-ejercicio").replaceChildren(...errores.map((m) => Object.assign(document.createElement("li"), { textContent: m })));
    $("errores-ejercicio").hidden = !errores.length;
  }

  function datos() {
    guardarActual();
    const valores = new FormData(form);
    const inicial = estado.inicial?.blocks?.blocks?.length ? estado.inicial : null;
    return {
      id: estado.id ?? undefined,
      titulo: valores.get("titulo"), enunciado: valores.get("enunciado"), explicacion: valores.get("explicacion"),
      tema: valores.get("tema"), dificultad: valores.get("dificultad"), toolbox: valores.getAll("toolbox"),
      pistas: valores.getAll("pista").map((p) => p.trim()).filter(Boolean),
      workspaceInicial: inicial, soluciones: estado.soluciones,
    };
  }

  async function abrir(id) {
    estado = { id, usado: false, inicial: VACIO(), soluciones: [VACIO()], actual: 0, previa: false };
    form.reset();
    mostrarErrores([]);
    salirVistaPrevia(false);
    $("titulo-editor-ejercicio").textContent = id ? "Editar ejercicio" : "Nuevo ejercicio";
    alAbrir();
    try {
      if (id) {
        const [publico, clave] = await Promise.all([getDoc(doc(db, "ejercicios", id)), getDoc(doc(db, "ejercicios", id, "privado", "clave"))]);
        const e = publico.data();
        const c = clave.data();
        Object.assign(estado, {
          usado: e.usado === true,
          inicial: e.workspaceInicial ? JSON.parse(e.workspaceInicial) : { blocks: { languageVersion: 0, blocks: [] } },
          soluciones: c.soluciones.map((s) => JSON.parse(s)),
        });
        form.titulo.value = e.titulo;
        form.enunciado.value = e.enunciado;
        form.tema.value = e.tema;
        form.dificultad.value = e.dificultad;
        form.explicacion.value = c.explicacion;
        form.querySelectorAll('input[name="pista"]').forEach((input, i) => (input.value = c.pistas[i] ?? ""));
        form.querySelectorAll('input[name="toolbox"]').forEach((casilla) => (casilla.checked = e.toolbox.includes(casilla.value)));
      }
      $("aviso-ejercicio-usado").hidden = !estado.usado;
      await asegurarEditor();
      editor.restringir(null);
      editor.cargar(espacioActual());
      pintarEspacios();
      actualizarCodigo();
    } catch (e) {
      mostrarErrores([mensajeError(e)]);
    }
  }

  // Vista previa (RF-29): la paleta y los bloques iniciales del estudiante, comparando en el navegador.
  function entrarVistaPrevia() {
    const e = datos();
    if (!e.toolbox.length) return mostrarErrores(["Elige los bloques disponibles para el estudiante antes de la vista previa."]);
    mostrarErrores([]);
    estado.previa = true;
    $("previa-titulo").textContent = e.titulo || "Ejercicio sin título";
    $("previa-enunciado").textContent = e.enunciado || "Sin enunciado.";
    $("previa-retro").hidden = true;
    for (const id of ["selector-espacio", "agregar-solucion", "quitar-solucion", "ayuda-espacio", "vista-previa", "guardar-ejercicio"]) $(id).hidden = true;
    $("vista-previa-info").hidden = false;
    editor.restringir(new Set(e.toolbox));
    editor.cargar(e.workspaceInicial ?? VACIO());
  }

  function salirVistaPrevia(recargar = true) {
    if (!estado?.previa && recargar) return;
    if (estado) estado.previa = false;
    for (const id of ["selector-espacio", "agregar-solucion", "quitar-solucion", "ayuda-espacio", "vista-previa", "guardar-ejercicio"]) $(id).hidden = false;
    $("vista-previa-info").hidden = true;
    if (recargar && editor) {
      editor.restringir(null);
      editor.cargar(espacioActual());
    }
  }

  function comprobarVistaPrevia() {
    const r = comparar(editor.guardar(), estado.soluciones);
    $("previa-retro").hidden = false;
    $("previa-retro").className = `retro retro--${r.correcto ? "ok" : "error"}`;
    $("previa-retro-titulo").textContent = r.correcto ? "Correcto" : "Todavía no";
    $("previa-retro-texto").textContent = r.correcto ? form.explicacion.value : mensajeDiferencia(r.diferencia);
    if (!r.correcto) resaltar(r.diferencia.bloqueId);
  }

  async function guardar() {
    salirVistaPrevia();
    const e = datos();
    const { errores } = validarEjercicio(e);
    mostrarErrores(errores);
    if (errores.length) return;
    const boton = $("guardar-ejercicio");
    boton.disabled = true;
    boton.textContent = "Guardando…";
    try {
      await api("ejercicios", { accion: "guardar", ejercicio: e });
      await alCerrar(estado.id ? "Ejercicio actualizado." : "Ejercicio creado. Ya puedes agregarlo a un quiz.");
    } catch (err) {
      mostrarErrores([mensajeError(err)]);
    } finally {
      boton.disabled = false;
      boton.textContent = "Guardar ejercicio";
    }
  }

  $("agregar-solucion").addEventListener("click", () => {
    guardarActual();
    // La nueva solución parte de la actual: lo común es registrar una variante.
    const base = estado.actual === "inicial" ? VACIO() : structuredClone(espacioActual());
    estado.soluciones.push(base);
    estado.actual = estado.soluciones.length - 1;
    editor.cargar(espacioActual());
    pintarEspacios();
  });
  $("quitar-solucion").addEventListener("click", () => {
    if (!confirm(`¿Quitar la solución ${estado.actual + 1}?`)) return;
    estado.soluciones.splice(estado.actual, 1);
    estado.actual = 0;
    editor.cargar(espacioActual());
    pintarEspacios();
  });
  $("usar-bloques").addEventListener("click", () => {
    guardarActual();
    const tipos = new Set(estado.soluciones.flatMap((s) => [...tiposUsados(s)]));
    form.querySelectorAll('input[name="toolbox"]').forEach((c) => { if (tipos.has(c.value)) c.checked = true; });
  });
  $("vista-previa").addEventListener("click", entrarVistaPrevia);
  $("previa-salir").addEventListener("click", () => salirVistaPrevia());
  $("previa-comprobar").addEventListener("click", comprobarVistaPrevia);
  $("guardar-ejercicio").addEventListener("click", guardar);
  const cancelar = () => { salirVistaPrevia(); alCerrar(null); };
  $("cancelar-ejercicio").addEventListener("click", cancelar);
  $("volver-ejercicios").addEventListener("click", cancelar);

  return { abrir };
}
