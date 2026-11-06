// Validación de ejercicios y quizzes. La comparten el editor del docente (antes de guardar), /api (al guardar),
// el script de carga del banco y las pruebas: una sola fuente de reglas.
import { TIPOS_BLOQUE, LENGUAJES_CURSO } from "./definiciones.js";
import { validarWorkspace, tiposUsados, lenguajesAplicables, canonizar, permitidos } from "./evaluador.js";

export const TEMAS = ["variables", "operadores", "salida", "condicionales", "ciclos", "funciones", "arreglos", "cadenas", "poo"];
export const DIFICULTADES = ["basico", "intermedio", "avanzado"];
export const LIMITES_TEXTO = { titulo: 120, enunciado: 2000, explicacion: 2000, pista: 500, descripcion: 1000 };

const texto = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const firma = (ws) => JSON.stringify(canonizar(ws).map((n) => n.clave));
export const firmaSoluciones = (soluciones) => soluciones.map(firma).sort().join("\n");

// Devuelve los errores en lenguaje del usuario y los lenguajes en que se puede ofrecer (RN-10).
export function validarEjercicio(e) {
  const errores = [];
  if (!texto(e.titulo, LIMITES_TEXTO.titulo)) errores.push(`El título es obligatorio y admite hasta ${LIMITES_TEXTO.titulo} caracteres.`);
  if (!texto(e.enunciado, LIMITES_TEXTO.enunciado)) errores.push(`El enunciado es obligatorio y admite hasta ${LIMITES_TEXTO.enunciado} caracteres.`);
  if (!texto(e.explicacion, LIMITES_TEXTO.explicacion)) errores.push(`La explicación es obligatoria y admite hasta ${LIMITES_TEXTO.explicacion} caracteres.`);
  if (!TEMAS.includes(e.tema)) errores.push("Elige un tema.");
  if (!DIFICULTADES.includes(e.dificultad)) errores.push("Elige una dificultad.");
  if (!Array.isArray(e.toolbox) || !e.toolbox.length || !e.toolbox.every((t) => TIPOS_BLOQUE.includes(t))) {
    errores.push("Elige al menos un bloque para la paleta del ejercicio.");
  }
  const pistas = e.pistas ?? [];
  if (!Array.isArray(pistas) || pistas.length > 3 || !pistas.every((p) => texto(p, LIMITES_TEXTO.pista))) {
    errores.push(`Puede haber hasta 3 pistas, cada una de hasta ${LIMITES_TEXTO.pista} caracteres.`);
  }
  if (!Array.isArray(e.soluciones) || !e.soluciones.length || e.soluciones.length > 5) {
    errores.push("Arma de 1 a 5 soluciones.");
    return { errores, lenguajes: [] };
  }
  if (errores.some((m) => m.startsWith("Elige al menos"))) return { errores, lenguajes: [] };

  if (e.workspaceInicial) {
    try {
      validarWorkspace(e.workspaceInicial, null);
    } catch (err) {
      errores.push(`Bloques iniciales: ${err.message}`);
    }
  }
  const firmas = new Set();
  const tipos = new Set();
  e.soluciones.forEach((s, i) => {
    try {
      validarWorkspace(s, permitidos(e));
    } catch (err) {
      errores.push(`Solución ${i + 1}: ${err.message}`);
      return;
    }
    if (!s.blocks.blocks.some((b) => b.type === "programa")) errores.push(`Solución ${i + 1}: falta el bloque programa.`);
    const f = firma(s);
    if (firmas.has(f)) errores.push(`Solución ${i + 1}: es idéntica a otra solución.`);
    firmas.add(f);
    tiposUsados(s).forEach((t) => tipos.add(t));
  });
  // El punto de partida no puede ser ya una respuesta correcta.
  if (e.workspaceInicial && !errores.length && firmas.has(firma(e.workspaceInicial))) {
    errores.push("Los bloques iniciales ya son una solución: el estudiante no tendría nada que hacer.");
  }
  return { errores, lenguajes: lenguajesAplicables(tipos) };
}

// Lenguajes que puede ofrecer un quiz: los que admiten todos sus ejercicios.
export const lenguajesComunes = (listas) => LENGUAJES_CURSO.filter((l) => listas.every((ls) => ls.includes(l)));

export function validarBanco(ejercicios, quizzes) {
  const errores = [];
  const lenguajesDe = new Map();
  for (const e of ejercicios) {
    if (lenguajesDe.has(e.id)) errores.push(`Ejercicio ${e.id}: id repetido`);
    const r = validarEjercicio(e);
    r.errores.forEach((m) => errores.push(`Ejercicio ${e.id}: ${m}`));
    lenguajesDe.set(e.id, r.lenguajes);
  }
  for (const q of quizzes) {
    const desconocidos = q.ejercicioIds.filter((id) => !lenguajesDe.has(id));
    if (desconocidos.length) errores.push(`Quiz ${q.id}: ejercicios inexistentes ${desconocidos.join(", ")}`);
    if (!(q.penalizacionPista >= 0 && q.penalizacionPista <= 50)) errores.push(`Quiz ${q.id}: penalización fuera de 0 a 50`);
  }
  return { errores, lenguajesDe };
}
