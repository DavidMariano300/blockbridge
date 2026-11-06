// POST /api/respuesta: compara la solución con las registradas y actualiza el puntaje (CU-08).
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./_lib/firebase.js";
import { manejador, ErrorHttp, id } from "./_lib/http.js";
import { sesionPropia, resultadoDe, cargarEjercicios } from "./_lib/sesion.js";
import { comparar, validarWorkspace, puntajeEjercicio, puntajeQuiz, permitidos } from "../js/bloques/evaluador.js";

const ESPERA_MS = 1000;

export const POST = manejador(async ({ usuario, cuerpo }) => {
  const sesionId = id(cuerpo.sesionId, "sesionId");
  const ejercicioId = id(cuerpo.ejercicioId, "ejercicioId");
  const ref = db.doc(`sesiones/${sesionId}`);

  return db.runTransaction(async (tx) => {
    const sesion = await sesionPropia(tx, ref, usuario.uid);
    const resultado = resultadoDe(sesion, ejercicioId);
    const ahora = Date.now();
    if (resultado.ultimoEnvio && ahora - resultado.ultimoEnvio.toMillis() < ESPERA_MS) {
      throw new ErrorHttp(429, "Espera un momento antes de volver a comprobar.");
    }

    const ejercicio = (await cargarEjercicios([ejercicioId], tx)).get(ejercicioId);
    validarWorkspace(cuerpo.workspace, permitidos(ejercicio));
    const veredicto = comparar(cuerpo.workspace, ejercicio.clave.soluciones);

    // El cronómetro del ejercicio lo reporta el navegador; es informativo (RN-06) y se acota al tiempo real de la sesión.
    const transcurrido = Math.floor((ahora - sesion.inicio.toMillis()) / 1000);
    const segundos = Math.min(Math.max(0, Math.floor(Number(cuerpo.segundos) || 0)), transcurrido);

    const nuevo = { ...resultado, intentos: resultado.intentos + 1, ultimoEnvio: Timestamp.fromMillis(ahora), tiempoSeg: segundos };
    if (veredicto.correcto) {
      nuevo.estado = "resuelto";
      nuevo.puntaje = puntajeEjercicio(true, resultado.pistas, sesion.penalizacionPista);
    }
    const ejercicios = { ...sesion.ejercicios, [ejercicioId]: nuevo };
    const puntaje = puntajeQuiz(sesion.orden.map((e) => ejercicios[e].puntaje));
    tx.update(ref, { ejercicios, puntaje });

    return veredicto.correcto
      ? { correcto: true, puntaje: nuevo.puntaje, puntajeQuiz: puntaje, explicacion: ejercicio.clave.explicacion }
      : { correcto: false, diferencia: veredicto.diferencia, intentos: nuevo.intentos };
  });
});
