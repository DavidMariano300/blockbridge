// POST /api/finalizar: cierra la sesión y devuelve el resumen (CU-09). Repetirla devuelve el mismo resumen.
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./_lib/firebase.js";
import { manejador, id } from "./_lib/http.js";
import { sesionPropia, cargarEjercicios } from "./_lib/sesion.js";
import { puntajeQuiz } from "../js/bloques/evaluador.js";

export const POST = manejador(async ({ usuario, cuerpo }) => {
  const ref = db.doc(`sesiones/${id(cuerpo.sesionId, "sesionId")}`);

  const sesion = await db.runTransaction(async (tx) => {
    const s = await sesionPropia(tx, ref, usuario.uid, { abierta: false });
    if (s.estado === "finalizada") return s;
    const cierre = { estado: "finalizada", fin: Timestamp.now(), puntaje: puntajeQuiz(s.orden.map((e) => s.ejercicios[e].puntaje)) };
    tx.update(ref, cierre);
    return { ...s, ...cierre };
  });

  const ejercicios = await cargarEjercicios(sesion.orden);
  return {
    puntaje: sesion.puntaje,
    duracionSeg: Math.round((sesion.fin.toMillis() - sesion.inicio.toMillis()) / 1000),
    ejercicios: sesion.orden.map((e) => {
      const r = sesion.ejercicios[e];
      return { id: e, titulo: ejercicios.get(e).titulo, estado: r.estado, intentos: r.intentos, pistas: r.pistas, tiempoSeg: r.tiempoSeg, puntaje: r.puntaje };
    }),
  };
});
