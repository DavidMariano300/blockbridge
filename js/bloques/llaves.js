// Sintaxis común de los lenguajes con llaves: Java, Kotlin, C#, C++, C y PHP.
import { sinoEncadenado } from "./generador.js";

// Precedencia estilo C (menor número = se evalúa antes).
export const O = { ATOMICO: 0, NEW: 1.1, MIEMBRO: 1.2, LLAMADA: 2, UNARIO: 4, MULT: 5, ADITIVO: 6, DESPLAZAMIENTO: 7,
  RELACIONAL: 8, IGUALDAD: 9, Y: 13, O: 14, NINGUNO: 99 };

const ARITMETICA = { SUMA: ["+", O.ADITIVO], RESTA: ["-", O.ADITIVO], MULT: ["*", O.MULT], DIV: ["/", O.MULT], MOD: ["%", O.MULT] };
const COMPARACION = {
  IGUAL: ["==", O.IGUALDAD], DISTINTO: ["!=", O.IGUALDAD], MENOR: ["<", O.RELACIONAL],
  MENOR_IGUAL: ["<=", O.RELACIONAL], MAYOR: [">", O.RELACIONAL], MAYOR_IGUAL: [">=", O.RELACIONAL],
};

// fin: terminador de instrucción. textoIgual(a, b, distinto): comparación de cadenas cuando == no compara contenido.
export function sintaxisLlaves(g, { fin = ";", nulo = "null", textoIgual = null } = {}) {
  const f = g.forBlock;
  g.fin = fin;
  // Acceso a miembro sobre una llamada, un new u otro acceso no necesita paréntesis: f().g, new A().b, a.b.c.
  g.ORDER_OVERRIDES = [[O.MIEMBRO, O.MIEMBRO], [O.MIEMBRO, O.LLAMADA], [O.MIEMBRO, O.NEW]];
  g.bloque = (b, entrada) => g.statementToCode(b, entrada);

  f.numero = (b) => {
    const n = Number(b.getFieldValue("NUM"));
    return [String(n), n < 0 ? O.UNARIO : O.ATOMICO];
  };
  f.texto = (b) => [JSON.stringify(b.getFieldValue("TEXTO")), O.ATOMICO];
  f.booleano = (b) => [b.getFieldValue("VALOR") === "VERDADERO" ? "true" : "false", O.ATOMICO];
  f.variable = (b) => [g.variable(b), O.ATOMICO];
  f.asignar = (b) => `${g.variable(b)} = ${g.valor(b, "VALOR", O.NINGUNO, nulo)}${fin}\n`;

  f.aritmetica = (b) => {
    const [op, orden] = ARITMETICA[b.getFieldValue("OP")];
    return [`${g.valor(b, "A", orden, "0")} ${op} ${g.valor(b, "B", orden, "0")}`, orden];
  };
  f.comparacion = (b) => {
    const op = b.getFieldValue("OP");
    if (textoIgual && (op === "IGUAL" || op === "DISTINTO") && (g.tipoEntrada(b, "A") === "texto" || g.tipoEntrada(b, "B") === "texto")) {
      return textoIgual(b, op === "DISTINTO");
    }
    const [simbolo, orden] = COMPARACION[op];
    return [`${g.valor(b, "A", orden, "0")} ${simbolo} ${g.valor(b, "B", orden, "0")}`, orden];
  };
  f.logica = (b) => {
    const [op, orden] = b.getFieldValue("OP") === "Y" ? ["&&", O.Y] : ["||", O.O];
    return [`${g.valor(b, "A", orden, "false")} ${op} ${g.valor(b, "B", orden, "false")}`, orden];
  };
  f.no = (b) => [`!${g.valor(b, "VALOR", O.UNARIO, "false")}`, O.UNARIO];

  f.si = (b) => `if (${g.valor(b, "COND", O.NINGUNO, "false")}) {\n${g.bloque(b, "ENTONCES")}}\n`;
  f.si_sino = (b) => {
    const inicio = f.si(b).slice(0, -1);
    const encadenado = sinoEncadenado(b);
    return encadenado ? `${inicio} else ${g.blockToCode(encadenado, true)}` : `${inicio} else {\n${g.bloque(b, "SINO")}}\n`;
  };
  f.mientras = (b) => `while (${g.valor(b, "COND", O.NINGUNO, "false")}) {\n${g.bloque(b, "CUERPO")}}\n`;
  f.romper = () => `break${fin}\n`;
  f.continuar = () => `continue${fin}\n`;
  f.retornar = (b) => {
    const v = g.valueToCode(b, "VALOR", O.NINGUNO);
    return v ? `return ${v}${fin}\n` : `return${fin}\n`;
  };
  f.llamar_funcion = (b) => `${g.campo(b, "NOMBRE")}(${g.argumentos(b, O.NINGUNO)})${fin}\n`;
  f.llamar_funcion_valor = (b) => [`${g.campo(b, "NOMBRE")}(${g.argumentos(b, O.NINGUNO)})`, O.LLAMADA];
  f.elemento_en = (b) => [`${g.valor(b, "LISTA", O.MIEMBRO, nulo)}[${g.valor(b, "INDICE", O.NINGUNO, "0")}]`, O.MIEMBRO];
  f.asignar_elemento = (b) =>
    `${g.valor(b, "LISTA", O.MIEMBRO, nulo)}[${g.valor(b, "INDICE", O.NINGUNO, "0")}] = ${g.valor(b, "VALOR", O.NINGUNO, nulo)}${fin}\n`;

  // Bucle contado clásico: for (tipo i = desde; i <= hasta; i++).
  g.paraClasico = (b, declaracion) => {
    const i = g.variable(b);
    const paso = Number(b.getFieldValue("PASO"));
    return `for (${declaracion}${i} = ${g.valor(b, "DESDE", O.NINGUNO, "0")}; ${i} <= ${g.valor(b, "HASTA", O.RELACIONAL, "0")}; `
      + `${paso === 1 ? `${i}++` : `${i} += ${paso}`}) {\n${g.bloque(b, "CUERPO")}}\n`;
  };

  // Para funciones que piden inicio y longitud (substr, Substring, mb_substr) en vez de inicio y fin.
  g.largoSubcadena = (b) => {
    const desde = g.valor(b, "DESDE", O.ADITIVO, "0");
    const hasta = g.valor(b, "HASTA", O.ADITIVO, "0");
    return desde === "0" ? hasta : `${hasta} - ${desde}`;
  };

  // Elementos no vacíos de "crear arreglo".
  g.elementos = (b, orden = O.NINGUNO) => ["E0", "E1", "E2", "E3", "E4"].map((e) => g.valueToCode(b, e, orden)).filter(Boolean);

  // "este.nombre" en C++ y PHP usa ->; en el resto, punto.
  g.acceso = (b, campo) => `${g.valor(b, "OBJETO", O.MIEMBRO, g.este)}${g.flecha?.(b) ?? "."}${g.campo(b, campo)}`;
  f.obtener_atributo = (b) => [g.acceso(b, "ATRIBUTO"), O.MIEMBRO];
  f.asignar_atributo = (b) => `${g.acceso(b, "ATRIBUTO")} = ${g.valor(b, "VALOR", O.NINGUNO, nulo)}${fin}\n`;
  f.llamar_metodo = (b) => `${g.acceso(b, "METODO")}(${g.argumentos(b, O.NINGUNO)})${fin}\n`;
  f.llamar_metodo_valor = (b) => [`${g.acceso(b, "METODO")}(${g.argumentos(b, O.NINGUNO)})`, O.LLAMADA];
  f.este = () => [g.este, O.ATOMICO];

  return O;
}
