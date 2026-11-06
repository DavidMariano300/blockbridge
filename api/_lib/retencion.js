// Plazos de conservación (docs/05 §C.5). Función pura: decide a quién borrar, no borra.
export const PLAZOS = { invitadoDias: 30, inactivoDias: 365 };
const DIA = 86_400_000;

// usuarios: [{ uid, anonimo, ultimaActividad (ms) }]. Una fecha desconocida nunca provoca un borrado.
export function seleccionarParaBorrar(usuarios, ahora = Date.now()) {
  return usuarios
    .filter((u) => Number.isFinite(u.ultimaActividad)
      && ahora - u.ultimaActividad > (u.anonimo ? PLAZOS.invitadoDias : PLAZOS.inactivoDias) * DIA)
    .map((u) => u.uid);
}
