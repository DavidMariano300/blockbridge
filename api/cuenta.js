// DELETE /api/cuenta: elimina la cuenta y todos sus datos (CU-14). Exige haber escrito la contraseña hace poco.
import { manejador, ErrorHttp } from "./_lib/http.js";
import { eliminarUsuario } from "./_lib/cuenta.js";

const MAX_SEGUNDOS_DESDE_LOGIN = 5 * 60;

export const DELETE = manejador(async ({ usuario }) => {
  if (usuario.anonimo) throw new ErrorHttp(400, "Las sesiones de invitado se borran solas a los 30 días.");
  if (Date.now() / 1000 - usuario.autenticadoEn > MAX_SEGUNDOS_DESDE_LOGIN) {
    throw new ErrorHttp(403, "Por seguridad, vuelve a escribir tu contraseña antes de eliminar la cuenta.");
  }
  return eliminarUsuario(usuario.uid);
});
