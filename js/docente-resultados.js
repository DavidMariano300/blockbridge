// Resultados de un quiz (CU-13): cifras, distribución, detalle por ejercicio y por estudiante; CSV y PDF.
import { db } from "./firebase.js";
import { mensajeError } from "./sesion.js";
import { LENGUAJES } from "./bloques/lenguajes.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const crear = (tag, props = {}, ...hijos) => {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...hijos);
  return el;
};
const RANGOS = [[0, 20], [21, 40], [41, 60], [61, 80], [81, 100]];
const promedio = (valores) => (valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null);
const uno = (n) => (n === null ? "—" : n.toLocaleString("es-MX", { maximumFractionDigits: 1 }));
const reloj = (seg) => (seg === null ? "—" : `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, "0")}`);
const fecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });
const tiempoTotal = (s) => s.orden.reduce((t, e) => t + (s.ejercicios[e]?.tiempoSeg ?? 0), 0);

export function iniciarResultados({ quizzes, ejercicio }) {
  let quiz = null;
  let sesiones = [];
  let filas = [];

  const todos = () => [...quizzes.mios, ...quizzes.banco];

  function llenarSelector(elegido) {
    const grupo = (etiqueta, lista) => {
      const g = crear("optgroup", { label: etiqueta });
      g.append(...lista.map((q) => new Option(q.titulo, q.id)));
      return g;
    };
    const anterior = elegido ?? $("resultados-quiz").value;
    $("resultados-quiz").replaceChildren(...[["Mis quizzes", quizzes.mios], ["Banco precargado", quizzes.banco]]
      .filter(([, lista]) => lista.length).map(([e, lista]) => grupo(e, lista)));
    if (anterior && todos().some((q) => q.id === anterior)) $("resultados-quiz").value = anterior;
  }

  async function cargar() {
    quiz = todos().find((q) => q.id === $("resultados-quiz").value);
    if (!quiz) return;
    $("resultados-lenguaje").replaceChildren(new Option("Todos los lenguajes", ""),
      ...quiz.lenguajes.map((l) => new Option(LENGUAJES[l]?.nombre ?? l, l)));
    try {
      // La consulta filtra por autorQuizId: así las reglas pueden comprobar que el docente puede leerlas.
      const snap = await getDocs(query(collection(db, "sesiones"), where("quizId", "==", quiz.id), where("autorQuizId", "==", quiz.autorId)));
      sesiones = snap.docs.map((d) => d.data());
      pintar();
    } catch (e) {
      $("resultados-vacio").textContent = mensajeError(e);
      $("resultados-vacio").hidden = false;
      $("resultados").hidden = true;
    }
  }

  function filtradas() {
    const lenguaje = $("resultados-lenguaje").value;
    const desde = $("resultados-desde").value ? new Date(`${$("resultados-desde").value}T00:00:00`).getTime() : -Infinity;
    const hasta = $("resultados-hasta").value ? new Date(`${$("resultados-hasta").value}T23:59:59.999`).getTime() : Infinity;
    return sesiones.filter((s) => (!lenguaje || s.lenguaje === lenguaje) && s.inicio.toMillis() >= desde && s.inicio.toMillis() <= hasta);
  }

  function pintar() {
    const lista = filtradas();
    $("resultados-vacio").textContent = "Aún no hay resultados para este quiz con estos filtros.";
    $("resultados-vacio").hidden = lista.length > 0;
    $("resultados").hidden = lista.length === 0;
    $("impresion-titulo").textContent = `Resultados: ${quiz.titulo}`;
    $("impresion-detalle").textContent = [
      `Generado el ${fecha.format(new Date())}`,
      $("resultados-lenguaje").value ? `Lenguaje: ${LENGUAJES[$("resultados-lenguaje").value]?.nombre}` : "Todos los lenguajes",
      $("resultados-desde").value && `Desde ${$("resultados-desde").value}`,
      $("resultados-hasta").value && `Hasta ${$("resultados-hasta").value}`,
    ].filter(Boolean).join(". ") + ".";
    if (!lista.length) return;

    const registradas = lista.filter((s) => !s.anonimo);
    $("cifra-sesiones").textContent = String(lista.length);
    $("cifra-estudiantes").textContent = String(new Set(registradas.map((s) => s.uid)).size);
    $("cifra-promedio").textContent = uno(promedio(lista.map((s) => s.puntaje)));
    $("cifra-finalizadas").textContent = `${Math.round((lista.filter((s) => s.estado === "finalizada").length / lista.length) * 100)} %`;

    pintarDistribucion(lista);
    pintarEjercicios(lista);
    pintarEstudiantes(lista, registradas);
  }

  // Columnas de una sola serie: un solo color, sin leyenda (el título la nombra), valor sobre cada columna.
  function pintarDistribucion(lista) {
    // 20 cae en 0–20 y 20.5 en 21–40: el rango es el primer múltiplo de 20 que no se excede.
    const conteos = RANGOS.map(() => 0);
    for (const s of lista) conteos[Math.min(4, Math.max(0, Math.ceil(s.puntaje / 20) - 1))]++;
    const maximo = Math.max(...conteos, 1);
    $("grafica-distribucion").replaceChildren(...RANGOS.map(([a, b], i) => {
      const texto = `${a}–${b}: ${conteos[i]} ${conteos[i] === 1 ? "sesión" : "sesiones"}`;
      const columna = crear("div", { className: "grafica__columna", tabIndex: 0 });
      columna.dataset.tip = texto;
      columna.setAttribute("aria-label", texto);
      const barra = crear("div", { className: "grafica__barra" });
      barra.style.setProperty("--alto", `${(conteos[i] / maximo) * 100}%`);
      columna.append(crear("span", { className: "grafica__valor", textContent: String(conteos[i]) }), barra,
        crear("span", { className: "grafica__eje", textContent: `${a}–${b}` }));
      return columna;
    }));
    $("grafica-resumen").textContent = RANGOS.map(([a, b], i) => `${a} a ${b}: ${conteos[i]}`).join("; ");
  }

  function pintarEjercicios(lista) {
    $("filas-por-ejercicio").replaceChildren(...quiz.ejercicioIds.map((id) => {
      const resultados = lista.map((s) => s.ejercicios[id]).filter(Boolean);
      const resueltos = resultados.filter((r) => r.estado === "resuelto");
      const acierto = resultados.length ? Math.round((resueltos.length / resultados.length) * 100) : 0;
      const barra = crear("progress", { max: 100, value: acierto, textContent: `${acierto} %` });
      return crear("tr", {},
        crear("th", { scope: "row", textContent: ejercicio(id)?.titulo ?? id }),
        crear("td", { textContent: `${acierto} %` }),
        crear("td", { className: "barra" }, barra),
        crear("td", { textContent: uno(promedio(resultados.map((r) => r.intentos))) }),
        crear("td", { textContent: uno(promedio(resultados.map((r) => r.pistas))) }),
        crear("td", { textContent: reloj(promedio(resueltos.map((r) => r.tiempoSeg))) }));
    }));
  }

  // Mejor calificación por estudiante (RN-08); los invitados solo aparecen agregados (RF-33).
  function pintarEstudiantes(lista, registradas) {
    const porUid = new Map();
    for (const s of registradas) porUid.set(s.uid, [...(porUid.get(s.uid) ?? []), s]);
    filas = [...porUid.values()].map((propias) => {
      const mejor = propias.reduce((a, b) => (b.puntaje > a.puntaje ? b : a));
      const ultima = propias.reduce((a, b) => (b.inicio.toMillis() > a.inicio.toMillis() ? b : a));
      return { apodo: ultima.apodo, mejor: mejor.puntaje, sesiones: propias.length, tiempo: tiempoTotal(mejor), ultima: ultima.inicio.toDate() };
    }).sort((a, b) => b.mejor - a.mejor || a.apodo.localeCompare(b.apodo));
    const invitadas = lista.filter((s) => s.anonimo);
    if (invitadas.length) {
      filas.push({ apodo: "Invitados (sin cuenta)", mejor: promedio(invitadas.map((s) => s.puntaje)), sesiones: invitadas.length,
        tiempo: null, ultima: null, agregado: true });
    }
    $("filas-por-estudiante").replaceChildren(...filas.map((f) => crear("tr", { className: f.agregado ? "docente__fila-agregada" : "" },
      crear("th", { scope: "row", textContent: f.apodo }),
      crear("td", { textContent: f.agregado ? `${uno(f.mejor)} (promedio)` : uno(f.mejor) }),
      crear("td", { textContent: String(f.sesiones) }),
      crear("td", { textContent: reloj(f.tiempo) }),
      crear("td", { textContent: f.ultima ? fecha.format(f.ultima) : "—" }))));
  }

  // CSV en UTF-8 con BOM para que Excel muestre bien los acentos (RF-34). Una celda que empieza con
  // = + - @ se antepone con ' para que la hoja de cálculo no la ejecute como fórmula.
  function exportarCsv() {
    if (!quiz || !filas.length) return;
    const celda = (v) => {
      let t = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
      return /[",\n\r]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
    };
    const iso = (d) => (d ? `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}` : "");
    const lineas = [["Estudiante", "Mejor calificación", "Sesiones", "Tiempo del mejor intento (min:seg)", "Última sesión"],
      ...filas.map((f) => [f.apodo, f.agregado ? uno(f.mejor) : f.mejor, f.sesiones, f.tiempo === null ? "" : reloj(f.tiempo), iso(f.ultima)])];
    const csv = `﻿${lineas.map((l) => l.map(celda).join(",")).join("\r\n")}\r\n`;
    const enlace = crear("a", {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
      download: `resultados-${quiz.id}-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  }

  $("resultados-quiz").addEventListener("change", cargar);
  for (const id of ["resultados-lenguaje", "resultados-desde", "resultados-hasta"]) $(id).addEventListener("change", () => quiz && pintar());
  $("exportar-csv").addEventListener("click", exportarCsv);
  $("exportar-pdf").addEventListener("click", () => window.print());

  return {
    mostrar(quizId) {
      llenarSelector(quizId);
      cargar();
    },
  };
}
