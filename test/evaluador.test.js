// Pruebas de la comparación estructural (Anexo B) y del puntaje (RN-01, RN-02). Ejecutar con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { comparar, validarWorkspace, puntajeEjercicio, puntajeQuiz, lenguajesAplicables, tiposUsados, ErrorValidacion, LIMITES }
  from "../js/bloques/evaluador.js";
import { B, V, num, txt, vr, arit, comp, imprimir, declarar, programa, workspace } from "../scripts/constructores.js";

// Solución de referencia: total = 2 + 3; imprimir total.
const solucion = () => workspace(programa(declarar("entero", "total", arit(num(2), "SUMA", num(3))), imprimir(vr("total"))));
const correcto = (est, ...sols) => comparar(est, sols.length ? sols : [solucion()]).correcto;

test("la misma solución es correcta", () => {
  assert.equal(correcto(solucion()), true);
});

test("la posición en el lienzo y los id de bloque no importan", () => {
  const ws = solucion();
  Object.assign(ws.blocks.blocks[0], { x: 500, y: 300, id: "otro-id" });
  assert.equal(correcto(ws), true);
});

test("el nombre de la variable no importa, pero debe usarse de forma consistente", () => {
  const renombrada = workspace(programa(declarar("entero", "suma", arit(num(2), "SUMA", num(3))), imprimir(vr("suma"))));
  assert.equal(correcto(renombrada), true);
  const inconsistente = workspace(programa(declarar("entero", "suma", arit(num(2), "SUMA", num(3))), imprimir(vr("otra"))));
  assert.equal(correcto(inconsistente), false);
});

test("los nombres de variable con acentos y los id del mapa de variables se resuelven", () => {
  const ws = solucion();
  ws.variables = [{ id: "total", name: "año" }];
  assert.equal(correcto(ws), true);
});

test("el orden de las instrucciones sí importa", () => {
  const invertido = workspace(programa(imprimir(vr("total")), declarar("entero", "total", arit(num(2), "SUMA", num(3)))));
  assert.equal(correcto(invertido), false);
});

test("un valor distinto se señala en el bloque que difiere", () => {
  const ws = workspace(programa(declarar("entero", "total", arit(num(2), "SUMA", B("numero", { id: "n4", fields: { NUM: 4 } }))), imprimir(vr("total"))));
  assert.deepEqual(comparar(ws, [solucion()]), { correcto: false, diferencia: { tipo: "valor_distinto", bloqueId: "n4" } });
});

test("un número como texto o como número es el mismo valor", () => {
  const ws = workspace(programa(declarar("entero", "total", arit(num("2"), "SUMA", num(3.0))), imprimir(vr("total"))));
  assert.equal(correcto(ws), true);
});

test("un tipo de dato distinto en la declaración es incorrecto", () => {
  const ws = workspace(programa(declarar("decimal", "total", arit(num(2), "SUMA", num(3))), imprimir(vr("total"))));
  assert.equal(comparar(ws, [solucion()]).diferencia.tipo, "valor_distinto");
});

test("un bloque faltante se señala antes del bloque que sigue", () => {
  const sol = workspace(programa(imprimir(txt("a")), imprimir(txt("b")), imprimir(txt("c"))));
  const est = workspace(programa(imprimir(txt("a")), B("imprimir", { id: "c", inputs: { VALOR: txt("c") } })));
  assert.deepEqual(comparar(est, [sol]).diferencia, { tipo: "falta_bloque", bloqueId: "c" });
});

test("un bloque faltante al final se señala en el último bloque", () => {
  const sol = workspace(programa(imprimir(txt("a")), imprimir(txt("b"))));
  const ultimo = B("texto", { id: "ultimo", fields: { TEXTO: "a" } });
  assert.deepEqual(comparar(workspace(programa(imprimir(ultimo))), [sol]).diferencia, { tipo: "falta_bloque", bloqueId: "ultimo" });
});

test("un bloque de más se señala", () => {
  const sol = workspace(programa(imprimir(txt("a")), imprimir(txt("c"))));
  const est = workspace(programa(imprimir(txt("a")), B("imprimir", { id: "extra", inputs: { VALOR: txt("b") } }), imprimir(txt("c"))));
  assert.deepEqual(comparar(est, [sol]).diferencia, { tipo: "sobra_bloque", bloqueId: "extra" });
});

test("un bloque distinto en la misma posición se señala", () => {
  const est = workspace(programa(declarar("entero", "total", arit(num(2), "SUMA", num(3))), B("asignar", { id: "mal", fields: V("total"), inputs: { VALOR: num(1) } })));
  assert.deepEqual(comparar(est, [solucion()]).diferencia, { tipo: "bloque_distinto", bloqueId: "mal" });
});

test("un programa vacío reporta que faltan bloques", () => {
  assert.deepEqual(comparar(workspace(), [solucion()]).diferencia, { tipo: "falta_bloque", bloqueId: null });
});

test("un bloque real en lugar de uno sombra equivalente es correcto", () => {
  const ws = solucion();
  const suma = ws.blocks.blocks[0].inputs.CUERPO.block.inputs.VALOR.block;
  suma.inputs.A = { shadow: { type: "numero", fields: { NUM: 2 } } };
  assert.equal(correcto(ws), true);
});

test("los bloques sueltos fuera de programa no cuentan", () => {
  const ws = solucion();
  ws.blocks.blocks.push(imprimir(txt("suelto")));
  assert.equal(correcto(ws), true);
});

test("se acepta cualquiera de varias soluciones registradas", () => {
  const alterna = workspace(programa(declarar("entero", "total", arit(num(3), "SUMA", num(2))), imprimir(vr("total"))));
  assert.equal(correcto(alterna), false);
  assert.equal(correcto(alterna, solucion(), alterna), true);
});

test("las funciones se comparan sin importar el orden en que se colocaron", () => {
  const f = (nombre) => B("definir_funcion", { fields: { NOMBRE: nombre, RETORNO: "nada" }, inputs: { CUERPO: imprimir(txt(nombre)) } });
  assert.equal(correcto(workspace(f("b"), programa(), f("a")), workspace(f("a"), f("b"), programa())), true);
});

test("validación: rechaza tipos desconocidos, bloques fuera de la toolbox y formatos inválidos", () => {
  assert.throws(() => validarWorkspace({}, null), ErrorValidacion);
  assert.throws(() => validarWorkspace(workspace(B("bloque_inventado")), null), ErrorValidacion);
  assert.throws(() => validarWorkspace(solucion(), new Set(["programa", "imprimir"])), ErrorValidacion);
  assert.doesNotThrow(() => validarWorkspace(solucion(), tiposUsados(solucion())));
});

test("validación: rechaza programas demasiado grandes o anidados", () => {
  const muchos = workspace(programa(...Array.from({ length: LIMITES.bloques + 1 }, () => B("romper"))));
  assert.throws(() => validarWorkspace(muchos, null), /máximo/);
  let anidado = B("romper");
  for (let i = 0; i <= LIMITES.profundidad; i++) anidado = B("si", { inputs: { ENTONCES: anidado } });
  assert.throws(() => validarWorkspace(workspace(programa(anidado)), null), /anidados/);
});

test("RN-01: puntaje de un ejercicio con pistas", () => {
  assert.equal(puntajeEjercicio(true, 0, 20), 100);
  assert.equal(puntajeEjercicio(true, 2, 20), 60);
  assert.equal(puntajeEjercicio(true, 3, 50), 0);
  assert.equal(puntajeEjercicio(false, 0, 20), 0);
});

test("RN-02: el puntaje del quiz es el promedio, redondeado a un decimal", () => {
  assert.equal(puntajeQuiz([100, 80, 0, 60]), 60);
  assert.equal(puntajeQuiz([100, 0, 0]), 33.3);
  assert.equal(puntajeQuiz([]), 0);
});

test("RN-10: los ejercicios con POO no se ofrecen en C", () => {
  assert.ok(!lenguajesAplicables(new Set(["programa", "definir_clase"])).includes("c"));
  assert.equal(lenguajesAplicables(new Set(["programa", "imprimir"])).length, 8);
});

test("las comparaciones se construyen con el bloque de comparación", () => {
  const sol = workspace(programa(B("si", { inputs: { COND: comp(vr("x"), "MAYOR", num(1)), ENTONCES: imprimir(txt("si")) } })));
  const est = workspace(programa(B("si", { inputs: { COND: comp(vr("y"), "MAYOR", num(1)), ENTONCES: imprimir(txt("si")) } })));
  assert.equal(correcto(est, sol), true);
});
