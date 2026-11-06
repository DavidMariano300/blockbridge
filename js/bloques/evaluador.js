// Comparación estructural de soluciones (docs/01-SRS.md, Anexo B) y cálculo de puntajes (RN-01, RN-02).
// Funciones puras sobre el JSON de Blockly.serialization: no dependen de Blockly ni de Firebase.
import { TIPOS_BLOQUE, BLOQUES_POO, LENGUAJES_CURSO } from "./definiciones.js";

export const LIMITES = { bytes: 64 * 1024, bloques: 300, profundidad: 50 };
const ORDEN_RAICES = ["definir_clase", "definir_funcion", "programa"];
const CAMPOS_NUMERICOS = new Set(["NUM", "PASO"]);
const TIPOS_VALIDOS = new Set(TIPOS_BLOQUE);

export class ErrorValidacion extends Error {}

const bloqueDe = (entrada) => entrada?.block ?? entrada?.shadow ?? null;

// Recorre todos los bloques (también los sueltos) para validar forma, tamaño y tipos permitidos.
export function validarWorkspace(workspace, permitidos) {
  const arriba = workspace?.blocks?.blocks;
  if (!Array.isArray(arriba)) throw new ErrorValidacion("El programa enviado no tiene un formato válido.");
  let total = 0;
  const visitar = (bloque, profundidad) => {
    if (!bloque || typeof bloque !== "object" || typeof bloque.type !== "string") {
      throw new ErrorValidacion("El programa enviado no tiene un formato válido.");
    }
    if (++total > LIMITES.bloques) throw new ErrorValidacion(`El programa supera el máximo de ${LIMITES.bloques} bloques.`);
    if (profundidad > LIMITES.profundidad) throw new ErrorValidacion("El programa tiene demasiados niveles anidados.");
    if (!TIPOS_VALIDOS.has(bloque.type) || (permitidos && !permitidos.has(bloque.type))) {
      throw new ErrorValidacion("Tu solución contiene bloques que este ejercicio no permite.");
    }
    for (const entrada of Object.values(bloque.inputs ?? {})) {
      for (const hijo of [entrada?.block, entrada?.shadow]) if (hijo) visitar(hijo, profundidad + 1);
    }
    if (bloque.next?.block) visitar(bloque.next.block, profundidad);
  };
  arriba.forEach((b) => visitar(b, 0));
}

// Lista de nodos en preorden. Cada nodo lleva su profundidad y la ranura por la que se llegó,
// lo que describe la estructura sin ambigüedad (como un esquema con sangría).
export function canonizar(workspace) {
  const nombres = new Map((workspace?.variables ?? []).map((v) => [v.id, v.name]));
  const alias = new Map();
  const renombrar = (nombre) => {
    if (!alias.has(nombre)) alias.set(nombre, `v${alias.size}`);
    return alias.get(nombre);
  };
  const valorCampo = (clave, valor) => {
    if (valor && typeof valor === "object") return renombrar(valor.name ?? nombres.get(valor.id) ?? valor.id);
    if (CAMPOS_NUMERICOS.has(clave)) return Number(valor);
    return typeof valor === "string" ? valor.trim() : valor;
  };

  const raices = (workspace?.blocks?.blocks ?? [])
    .filter((b) => ORDEN_RAICES.includes(b.type))
    .filter((b, i, todas) => b.type !== "programa" || todas.findIndex((x) => x.type === "programa") === i)
    .sort((a, b) => ORDEN_RAICES.indexOf(a.type) - ORDEN_RAICES.indexOf(b.type)
      || String(a.fields?.NOMBRE ?? "").localeCompare(String(b.fields?.NOMBRE ?? "")));

  const nodos = [];
  const visitar = (bloque, ruta, profundidad) => {
    const campos = Object.keys(bloque.fields ?? {}).sort()
      .map((k) => `${k}=${JSON.stringify(valorCampo(k, bloque.fields[k]))}`).join(",");
    nodos.push({ id: bloque.id ?? null, tipo: bloque.type, ruta, profundidad, campos,
      clave: `${profundidad}|${ruta}|${bloque.type}|${campos}` });
    for (const nombre of Object.keys(bloque.inputs ?? {}).sort()) {
      const hijo = bloqueDe(bloque.inputs[nombre]);
      if (hijo) visitar(hijo, nombre, profundidad + 1);
    }
    if (bloque.next?.block) visitar(bloque.next.block, "next", profundidad);
  };
  raices.forEach((r) => visitar(r, "raiz", 0));
  return nodos;
}

const firma = (nodos) => nodos.map((n) => n.clave).join("\n");
const RANURAS_INSTRUCCION = new Set(["raiz", "next", "CUERPO", "ENTONCES", "SINO", "PARAMETROS", "MIEMBROS"]);

// Agrupa cada instrucción con los valores que contiene. La ranura de la instrucción no forma parte
// de la clave, para reconocerla aunque se haya movido una posición.
function instrucciones(nodos) {
  const grupos = [];
  for (const n of nodos) {
    if (RANURAS_INSTRUCCION.has(n.ruta) || !grupos.length) {
      grupos.push({ id: n.id, partes: [`${n.profundidad}|${n.tipo}|${n.campos}`] });
    } else {
      grupos.at(-1).partes.push(n.clave);
    }
  }
  return grupos.map((g) => ({ id: g.id, clave: g.partes.join("\n") }));
}

// Primer punto donde el programa se aparta de la solución. Comparando instrucciones completas
// con una de anticipación se distingue un bloque faltante o sobrante de uno distinto.
function diferencia(est, sol, k) {
  if (k >= est.length) return { tipo: "falta_bloque", bloqueId: est.at(-1)?.id ?? null };
  const ie = instrucciones(est);
  const is = instrucciones(sol);
  let j = 0;
  while (j < ie.length && j < is.length && ie[j].clave === is[j].clave) j++;
  if (j < ie.length && j >= is.length) return { tipo: "sobra_bloque", bloqueId: ie[j].id };
  if (j < ie.length && ie[j].clave === is[j + 1]?.clave) return { tipo: "falta_bloque", bloqueId: ie[j].id };
  if (j < is.length && ie[j + 1]?.clave === is[j].clave) return { tipo: "sobra_bloque", bloqueId: ie[j].id };
  const mismoLugar = k < sol.length && est[k].tipo === sol[k].tipo && est[k].ruta === sol[k].ruta;
  return { tipo: mismoLugar ? "valor_distinto" : "bloque_distinto", bloqueId: est[k].id };
}

export function comparar(estudiante, soluciones) {
  const est = canonizar(estudiante);
  let masCercana = null;
  for (const sol of soluciones.map(canonizar)) {
    if (firma(est) === firma(sol)) return { correcto: true };
    let k = 0;
    while (k < est.length && k < sol.length && est[k].clave === sol[k].clave) k++;
    if (!masCercana || k > masCercana.k) masCercana = { k, sol };
  }
  return { correcto: false, diferencia: diferencia(est, masCercana.sol, masCercana.k) };
}

export const puntajeEjercicio = (resuelto, pistas, penalizacion) => (resuelto ? Math.max(0, 100 - pistas * penalizacion) : 0);

export function puntajeQuiz(puntajes) {
  if (!puntajes.length) return 0;
  return Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 10) / 10;
}

export function tiposUsados(workspace) {
  const tipos = new Set();
  const visitar = (b) => {
    if (!b) return;
    tipos.add(b.type);
    Object.values(b.inputs ?? {}).forEach((e) => { visitar(e?.block); visitar(e?.shadow); });
    visitar(b.next?.block);
  };
  (workspace?.blocks?.blocks ?? []).forEach(visitar);
  return tipos;
}

// Bloques aceptados en una respuesta: la toolbox, los del workspace inicial y los literales básicos.
export const permitidos = (ejercicio) =>
  new Set([...ejercicio.toolbox, ...tiposUsados(ejercicio.workspaceInicial), "programa", "numero", "texto"]);

// La POO no aplica a C (RN-10).
export const lenguajesAplicables = (tipos) =>
  [...tipos].some((t) => BLOQUES_POO.includes(t)) ? LENGUAJES_CURSO.filter((l) => l !== "c") : [...LENGUAJES_CURSO];
