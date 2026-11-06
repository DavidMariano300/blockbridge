// Plazos de conservación (docs/05 §C.5). Ejecutar con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { seleccionarParaBorrar } from "../api/_lib/retencion.js";

const DIA = 86_400_000;
const ahora = Date.UTC(2026, 9, 30);
const usuario = (uid, anonimo, dias) => ({ uid, anonimo, ultimaActividad: ahora - dias * DIA });

test("invitados: se borran después de 30 días sin actividad", () => {
  assert.deepEqual(seleccionarParaBorrar([usuario("a", true, 29), usuario("b", true, 31)], ahora), ["b"]);
});

test("cuentas registradas: se borran después de 12 meses sin actividad", () => {
  assert.deepEqual(seleccionarParaBorrar([usuario("c", false, 31), usuario("d", false, 364), usuario("e", false, 366)], ahora), ["e"]);
});

test("una fecha desconocida nunca provoca un borrado", () => {
  assert.deepEqual(seleccionarParaBorrar([{ uid: "f", anonimo: true, ultimaActividad: NaN }], ahora), []);
});
