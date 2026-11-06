import { crearEditor } from "./editor.js";
import { generarCodigo, generadoresDisponibles, mensajeBloquesSueltos } from "./codigo.js";
import { LENGUAJES } from "./bloques/lenguajes.js";

const $ = (id) => document.getElementById(id);
const CLAVE_PROGRAMA = "bb:practica";
const CLAVE_LENGUAJE = "bb:lenguaje";

const INICIAL = {
  blocks: { languageVersion: 0, blocks: [{ type: "programa", x: 32, y: 32, inputs: { CUERPO: { block: {
    type: "imprimir", inputs: { VALOR: { block: { type: "texto", fields: { TEXTO: "Hola, mundo" } } } },
  } } } }] },
};

const leer = (clave) => { try { return localStorage.getItem(clave); } catch { return null; } };
const escribir = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: el trabajo dura la visita */ } };

const generadores = generadoresDisponibles();
let lenguaje = LENGUAJES[leer(CLAVE_LENGUAJE)] ? leer(CLAVE_LENGUAJE) : "python";
let editor;

function montarSelector() {
  const selector = $("selector-lenguaje");
  for (const [id, { nombre }] of Object.entries(LENGUAJES)) {
    const etiqueta = document.createElement("label");
    const radio = Object.assign(document.createElement("input"), { type: "radio", name: "lenguaje", value: id, checked: id === lenguaje });
    etiqueta.append(radio, Object.assign(document.createElement("span"), { textContent: nombre }));
    selector.append(etiqueta);
  }
  selector.addEventListener("change", (e) => {
    lenguaje = e.target.value;
    escribir(CLAVE_LENGUAJE, lenguaje);
    actualizarCodigo();
  });
}

function actualizarCodigo() {
  const codigo = generarCodigo(generadores[lenguaje], editor.workspace);
  $("titulo-codigo").textContent = LENGUAJES[lenguaje].nombre;
  $("codigo-generado").textContent = codigo;
  $("codigo-vacio").hidden = Boolean(codigo);
  const aviso = mensajeBloquesSueltos(editor.workspace);
  $("bloques-sueltos").hidden = !aviso;
  $("bloques-sueltos").textContent = aviso;
}

// Manejo de las pestañas Bloques / Código en pantallas angostas.
function montarPestanas() {
  const area = document.querySelector(".practica__area");
  const pestanas = [$("tab-bloques"), $("tab-codigo")];
  const mostrar = (i, enfocar = false) => {
    pestanas.forEach((p, j) => {
      p.setAttribute("aria-selected", String(i === j));
      p.tabIndex = i === j ? 0 : -1;
    });
    area.dataset.vista = i === 0 ? "bloques" : "codigo";
    if (enfocar) pestanas[i].focus();
    if (i === 0) editor.redimensionar();
  };
  pestanas.forEach((p, i) => p.addEventListener("click", () => mostrar(i)));
  document.querySelector(".practica__pestanas").addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") mostrar(pestanas.indexOf(document.activeElement) === 0 ? 1 : 0, true);
  });
}

async function iniciar() {
  montarSelector();
  editor = await crearEditor("blockly");

  let guardado = null;
  try { guardado = JSON.parse(leer(CLAVE_PROGRAMA)); } catch { /* estado corrupto: se empieza de cero */ }
  try { editor.cargar(guardado ?? INICIAL); } catch { editor.cargar(INICIAL); }

  editor.alCambiar(() => {
    actualizarCodigo();
    escribir(CLAVE_PROGRAMA, JSON.stringify(editor.guardar()));
  });
  actualizarCodigo();
  $("cargando-editor").hidden = true;

  $("reiniciar").addEventListener("click", () => {
    if (confirm("Se borrará tu programa actual para empezar de nuevo. ¿Continuar?")) editor.cargar(INICIAL);
  });

  $("copiar").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("codigo-generado").textContent);
      $("copiar").textContent = "Copiado";
      $("estado-copiar").textContent = "Código copiado al portapapeles.";
      setTimeout(() => ($("copiar").textContent = "Copiar código"), 2000);
    } catch {
      $("estado-copiar").textContent = "No se pudo copiar. Selecciona el código y cópialo manualmente.";
    }
  });

  montarPestanas();
}

iniciar();
