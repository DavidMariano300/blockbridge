// POST /api/pista: revela la siguiente pista y registra su uso para la penalización (CU-07).
import { db } from "./_lib/firebase.js";
import { manejador, ErrorHttp, id } from "./_lib/http.js";
import { sesionPropia, resultadoDe, cargarEjercicios } from "./_lib/sesion.js";
import { puntajeEjercicio } from "../js/bloques/evaluador.js";

export const POST = manejador(async ({ usuario, cuerpo }) => {
  const sesionId = id(cuerpo.sesionId, "sesionId");
  const ejercicioId = id(cuerpo.ejercicioId, "ejercicioId");
  const ref = db.doc(`sesiones/${sesionId}`);

  return db.runTransaction(async (tx) => {
    const sesion = await sesionPropia(tx, ref, usuario.uid);
    const resultado = resultadoDe(sesion, ejercicioId);
    const { pistas } = (await cargarEjercicios([ejercicioId], tx)).get(ejercicioId).clave;
    if (resultado.pistas >= pistas.length) throw new ErrorHttp(409, "No quedan pistas para este ejercicio.");

    const usadas = resultado.pistas + 1;
    tx.update(ref, { ejercicios: { ...sesion.ejercicios, [ejercicioId]: { ...resultado, pistas: usadas } } });
    return {
      pista: pistas[resultado.pistas],
      usadas,
      restantes: pistas.length - usadas,
      puntajeMaximo: puntajeEjercicio(true, usadas, sesion.penalizacionPista),
    };
  });
});
