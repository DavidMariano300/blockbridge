// Lectura de sesiones y ejercicios compartida por las funciones del quiz.
import { db } from "./firebase.js";
import { ErrorHttp } from "./http.js";

// Una sesión ajena responde igual que una inexistente para no revelar cuáles existen.
export async function sesionPropia(tx, ref, uid, { abierta = true } = {}) {
  const snap = await tx.get(ref);
  if (!snap.exists || snap.get("uid") !== uid) throw new ErrorHttp(404, "No encontramos esta sesión de quiz.");
  const sesion = snap.data();
  if (abierta && sesion.estado !== "en_curso") throw new ErrorHttp(409, "Este quiz ya terminó.");
  return sesion;
}

export function resultadoDe(sesion, ejercicioId) {
  // hasOwn: el id llega del cliente y "__proto__" o "constructor" también pasan el formato de id.
  const resultado = Object.hasOwn(sesion.ejercicios, ejercicioId) ? sesion.ejercicios[ejercicioId] : null;
  if (!resultado) throw new ErrorHttp(404, "Este ejercicio no forma parte del quiz.");
  if (resultado.estado === "resuelto") throw new ErrorHttp(409, "Ya resolviste este ejercicio.");
  return resultado;
}

// Los workspaces se guardan como texto JSON (Firestore no admite más de 20 niveles de anidamiento).
function comoObjeto(valor) {
  if (typeof valor !== "string") return valor ?? null;
  try {
    return JSON.parse(valor);
  } catch {
    throw new ErrorHttp(409, "Este quiz tiene un ejercicio dañado. Avísale a tu docente.");
  }
}

// Datos públicos y clave privada de cada ejercicio, en el orden pedido.
export async function cargarEjercicios(ids, lector = db) {
  const refs = ids.flatMap((id) => [db.doc(`ejercicios/${id}`), db.doc(`ejercicios/${id}/privado/clave`)]);
  const snaps = await lector.getAll(...refs);
  return new Map(ids.map((id, i) => {
    const [publico, clave] = [snaps[2 * i], snaps[2 * i + 1]];
    if (!publico.exists || !clave.exists) throw new ErrorHttp(409, "Este quiz tiene ejercicios que ya no existen.");
    const datos = publico.data();
    const { soluciones, ...privado } = clave.data();
    return [id, { ...datos, workspaceInicial: comoObjeto(datos.workspaceInicial),
      clave: { ...privado, soluciones: soluciones.map(comoObjeto) } }];
  }));
}

// Lo que el estudiante puede ver de su sesión: nunca soluciones ni pistas sin revelar.
export function vista(sesionId, sesion, quiz, ejercicios) {
  return {
    sesionId,
    quiz: { id: sesion.quizId, titulo: quiz.titulo, penalizacionPista: sesion.penalizacionPista },
    lenguaje: sesion.lenguaje,
    estado: sesion.estado,
    inicio: sesion.inicio.toMillis(),
    puntaje: sesion.puntaje,
    ejercicios: sesion.orden.map((id) => {
      const e = ejercicios.get(id);
      const r = sesion.ejercicios[id];
      return {
        id, titulo: e.titulo, enunciado: e.enunciado, tema: e.tema, dificultad: e.dificultad,
        toolbox: e.toolbox, workspaceInicial: e.workspaceInicial ?? null, numPistas: e.clave.pistas.length,
        estado: r.estado, intentos: r.intentos, puntaje: r.puntaje, tiempoSeg: r.tiempoSeg,
        pistas: e.clave.pistas.slice(0, r.pistas),
        explicacion: r.estado === "resuelto" ? e.clave.explicacion : null,
      };
    }),
  };
}
