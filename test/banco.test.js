// Pruebas del banco precargado (RF-36): pasa la validación de carga y cada solución compila y se ejecuta
// sin errores en los lenguajes instalados. Ejecutar con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import * as Blockly from "blockly";
import { registrarBloques } from "../js/bloques/definiciones.js";
import { generarCodigo } from "../js/bloques/generador.js";
import { LENGUAJES } from "../js/bloques/lenguajes.js";
import { EJERCICIOS, QUIZZES } from "../contenido/banco.js";
import { validarBanco } from "../js/bloques/validar.js";
import { ejecutar, disponible } from "./ejecutar.js";

registrarBloques(Blockly);
const { errores, lenguajesDe } = validarBanco(EJERCICIOS, QUIZZES);

test("el banco pasa la misma validación que el script de carga", () => {
  assert.deepEqual(errores, []);
});

test("RF-36: 27 ejercicios, uno por tema y dificultad, y un quiz por tema", () => {
  assert.equal(EJERCICIOS.length, 27);
  const combinaciones = new Set(EJERCICIOS.map((e) => `${e.tema}/${e.dificultad}`));
  assert.equal(combinaciones.size, 27);
  for (const tema of new Set(EJERCICIOS.map((e) => e.tema))) {
    assert.ok(QUIZZES.some((q) => q.tema === tema && q.ejercicioIds.length === 3), `falta el quiz de ${tema}`);
  }
});

test("RN-10: los ejercicios de POO no se ofrecen en C; el resto, en los 8 lenguajes", () => {
  for (const e of EJERCICIOS) assert.equal(lenguajesDe.get(e.id).includes("c"), e.tema !== "poo", e.id);
});

function generar(lenguaje, solucion) {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(solucion, ws);
  const codigo = generarCodigo(LENGUAJES[lenguaje].crear(Blockly), ws);
  ws.dispose();
  return codigo;
}

// Compilar decenas de programas en serie tarda; se ejecutan en paralelo.
test("cada solución del banco compila y se ejecuta sin errores", { concurrency: 8 }, async (t) => {
  const casos = EJERCICIOS.flatMap((e) => e.soluciones.flatMap((s, i) =>
    lenguajesDe.get(e.id).filter(disponible).map((lenguaje) => ({ e, s, i, lenguaje }))));
  await Promise.all(casos.map(({ e, s, i, lenguaje }) => t.test(`${e.id} (solución ${i + 1}) en ${lenguaje}`, async () => {
    const codigo = generar(lenguaje, s);
    const r = await ejecutar(lenguaje, codigo);
    assert.equal(r.status, 0, `${codigo}\n${r.stderr}`);
    assert.ok(r.stdout.trim().length > 0, `no imprimió nada:\n${codigo}`);
  })));
});
