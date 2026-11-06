// Generación de código en el navegador, compartida por la práctica y el quiz.
import { Blockly } from "./editor.js";
import { generarCodigo } from "./bloques/generador.js";
import { LENGUAJES } from "./bloques/lenguajes.js";

export { generarCodigo };

export const generadoresDisponibles = () =>
  Object.fromEntries(Object.entries(LENGUAJES).map(([id, l]) => [id, l.crear(Blockly)]));

const RAICES = ["programa", "definir_funcion", "definir_clase"];

export function mensajeBloquesSueltos(workspace) {
  const sueltos = workspace.getTopBlocks(false).filter((b) => !RAICES.includes(b.type)).length;
  if (!sueltos) return "";
  return sueltos === 1
    ? "Hay 1 bloque suelto: conéctalo dentro de «programa» para que forme parte de tu solución."
    : `Hay ${sueltos} bloques sueltos: conéctalos dentro de «programa» para que formen parte de tu solución.`;
}
