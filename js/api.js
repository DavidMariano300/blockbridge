// Llamadas a las funciones de /api con el ID token de Firebase.
import { auth, tokenAppCheck } from "./firebase.js";

export class ErrorApi extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
  }
}

// Un token vencido se renueva una vez antes de rendirse.
export async function api(ruta, cuerpo, metodo = "POST") {
  const pedir = async (renovar) => {
    const verificacion = await tokenAppCheck();
    return fetch(`/api/${ruta}`, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await auth.currentUser.getIdToken(renovar)}`,
        ...(verificacion && { "X-Firebase-AppCheck": verificacion }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  };
  let respuesta = await pedir(false);
  if (respuesta.status === 401) respuesta = await pedir(true);
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos.error ?? "No pudimos completar la acción. Intenta de nuevo.");
  return datos;
}
