import { crearGenerador, devuelveTexto, sinoEncadenado } from "./generador.js";

// Precedencia de operadores de JavaScript (menor número = se evalúa antes).
const O = { ATOMICO: 0, NEW: 1.1, MIEMBRO: 1.2, LLAMADA: 2, UNARIO: 4, MULT: 5, ADITIVO: 6, RELACIONAL: 8, IGUALDAD: 9,
  Y: 13, O: 14, NINGUNO: 99 };

const RESERVADAS = ["break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else",
  "enum", "export", "extends", "false", "finally", "for", "function", "if", "implements", "import", "in", "instanceof",
  "interface", "let", "new", "null", "package", "private", "protected", "public", "return", "static", "super", "switch",
  "this", "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield", "await",
  "arguments", "eval", "undefined", "NaN", "Infinity", "console", "String", "Number", "Object", "Array"];

const INICIAL = { entero: "0", decimal: "0", texto: '""', booleano: "false", arreglo: "[]", objeto: "null" };
const ARITMETICA = { SUMA: ["+", O.ADITIVO], RESTA: ["-", O.ADITIVO], MULT: ["*", O.MULT], DIV: ["/", O.MULT], MOD: ["%", O.MULT] };
const COMPARACION = {
  IGUAL: ["===", O.IGUALDAD], DISTINTO: ["!==", O.IGUALDAD], MENOR: ["<", O.RELACIONAL],
  MENOR_IGUAL: ["<=", O.RELACIONAL], MAYOR: [">", O.RELACIONAL], MAYOR_IGUAL: [">=", O.RELACIONAL],
};

export function generadorJavaScript(Blockly) {
  const g = crearGenerador(Blockly, "JavaScript", { reservadas: RESERVADAS, sangria: "  " });
  g.ORDER_OVERRIDES = [[O.MIEMBRO, O.MIEMBRO], [O.MIEMBRO, O.LLAMADA], [O.MIEMBRO, O.NEW]];
  const f = g.forBlock;
  const cuerpo = (b, entrada) => g.statementToCode(b, entrada);
  const comoTexto = (b, entrada) => {
    const v = g.valor(b, entrada, O.NINGUNO, '""');
    return devuelveTexto(b, entrada) ? v : `String(${v})`;
  };
  const funcion = (cabecera, b) => `${cabecera}(${g.parametros(b).map((p) => p.nombre).join(", ")}) {\n${cuerpo(b, "CUERPO")}}\n`;

  g.ensamblar = ({ clases, funciones, programa }) => {
    const definiciones = [...clases, ...funciones].join("\n");
    return definiciones && programa ? `${definiciones}\n${programa}` : definiciones + programa;
  };

  f.declarar_variable = (b) => `let ${g.variable(b)} = ${g.valor(b, "VALOR", O.NINGUNO, INICIAL[b.getFieldValue("TIPO")])};\n`;
  f.asignar = (b) => `${g.variable(b)} = ${g.valor(b, "VALOR", O.NINGUNO, "null")};\n`;
  f.variable = (b) => [g.variable(b), O.ATOMICO];
  f.numero = (b) => {
    const n = Number(b.getFieldValue("NUM"));
    return [String(n), n < 0 ? O.UNARIO : O.ATOMICO];
  };
  f.texto = (b) => [JSON.stringify(b.getFieldValue("TEXTO")), O.ATOMICO];
  f.booleano = (b) => [b.getFieldValue("VALOR") === "VERDADERO" ? "true" : "false", O.ATOMICO];

  f.aritmetica = (b) => {
    const [op, orden] = ARITMETICA[b.getFieldValue("OP")];
    return [`${g.valor(b, "A", orden, "0")} ${op} ${g.valor(b, "B", orden, "0")}`, orden];
  };
  f.comparacion = (b) => {
    const [op, orden] = COMPARACION[b.getFieldValue("OP")];
    return [`${g.valor(b, "A", orden, "0")} ${op} ${g.valor(b, "B", orden, "0")}`, orden];
  };
  f.logica = (b) => {
    const [op, orden] = b.getFieldValue("OP") === "Y" ? ["&&", O.Y] : ["||", O.O];
    return [`${g.valor(b, "A", orden, "false")} ${op} ${g.valor(b, "B", orden, "false")}`, orden];
  };
  f.no = (b) => [`!${g.valor(b, "VALOR", O.UNARIO, "false")}`, O.UNARIO];

  f.imprimir = (b) => `console.log(${g.valor(b, "VALOR", O.NINGUNO, "")});\n`;

  f.si = (b) => `if (${g.valor(b, "COND", O.NINGUNO, "false")}) {\n${cuerpo(b, "ENTONCES")}}\n`;
  f.si_sino = (b) => {
    const inicio = f.si(b).slice(0, -1);
    const encadenado = sinoEncadenado(b);
    return encadenado ? `${inicio} else ${g.blockToCode(encadenado, true)}` : `${inicio} else {\n${cuerpo(b, "SINO")}}\n`;
  };
  f.mientras = (b) => `while (${g.valor(b, "COND", O.NINGUNO, "false")}) {\n${cuerpo(b, "CUERPO")}}\n`;
  f.para = (b) => {
    const i = g.variable(b);
    const paso = Number(b.getFieldValue("PASO"));
    return `for (let ${i} = ${g.valor(b, "DESDE", O.NINGUNO, "0")}; ${i} <= ${g.valor(b, "HASTA", O.RELACIONAL, "0")}; `
      + `${paso === 1 ? `${i}++` : `${i} += ${paso}`}) {\n${cuerpo(b, "CUERPO")}}\n`;
  };
  f.para_cada = (b) => `for (const ${g.variable(b)} of ${g.valor(b, "LISTA", O.NINGUNO, "[]")}) {\n${cuerpo(b, "CUERPO")}}\n`;
  f.romper = () => "break;\n";
  f.continuar = () => "continue;\n";

  f.definir_funcion = (b) => funcion(`function ${g.campo(b, "NOMBRE")}`, b);
  f.retornar = (b) => {
    const v = g.valueToCode(b, "VALOR", O.NINGUNO);
    return v ? `return ${v};\n` : "return;\n";
  };
  f.llamar_funcion = (b) => `${g.campo(b, "NOMBRE")}(${g.argumentos(b, O.NINGUNO)});\n`;
  f.llamar_funcion_valor = (b) => [`${g.campo(b, "NOMBRE")}(${g.argumentos(b, O.NINGUNO)})`, O.LLAMADA];

  f.crear_arreglo = (b) => {
    const elementos = ["E0", "E1", "E2", "E3", "E4"].map((e) => g.valueToCode(b, e, O.NINGUNO)).filter(Boolean);
    return [`[${elementos.join(", ")}]`, O.ATOMICO];
  };
  f.elemento_en = (b) => [`${g.valor(b, "LISTA", O.MIEMBRO, "[]")}[${g.valor(b, "INDICE", O.NINGUNO, "0")}]`, O.MIEMBRO];
  f.asignar_elemento = (b) =>
    `${g.valor(b, "LISTA", O.MIEMBRO, "[]")}[${g.valor(b, "INDICE", O.NINGUNO, "0")}] = ${g.valor(b, "VALOR", O.NINGUNO, "null")};\n`;
  f.longitud = (b) => [`${g.valor(b, "LISTA", O.MIEMBRO, "[]")}.length`, O.MIEMBRO];

  f.concatenar = (b) => [`${comoTexto(b, "A")} + ${comoTexto(b, "B")}`, O.ADITIVO];
  f.longitud_texto = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.length`, O.MIEMBRO];
  f.subcadena = (b) =>
    [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.substring(${g.valor(b, "DESDE", O.NINGUNO, "0")}, ${g.valor(b, "HASTA", O.NINGUNO, "0")})`, O.LLAMADA];
  f.mayusculas = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.toUpperCase()`, O.LLAMADA];
  f.minusculas = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.toLowerCase()`, O.LLAMADA];

  f.definir_clase = (b) => {
    const padre = b.getFieldValue("PADRE").trim();
    return `class ${g.campo(b, "NOMBRE")}${padre ? ` extends ${g.identificador(padre)}` : ""} {\n${g.sangrar(g.miembros(b))}}\n`;
  };
  f.atributo = (b) => `${g.campo(b, "NOMBRE")};\n`;
  f.constructor = (b) => funcion("constructor", b);
  f.metodo = (b) => funcion(g.campo(b, "NOMBRE"), b);
  f.crear_objeto = (b) => [`new ${g.campo(b, "CLASE")}(${g.argumentos(b, O.NINGUNO)})`, O.NEW];
  f.obtener_atributo = (b) => [`${g.valor(b, "OBJETO", O.MIEMBRO, "this")}.${g.campo(b, "ATRIBUTO")}`, O.MIEMBRO];
  f.asignar_atributo = (b) =>
    `${g.valor(b, "OBJETO", O.MIEMBRO, "this")}.${g.campo(b, "ATRIBUTO")} = ${g.valor(b, "VALOR", O.NINGUNO, "null")};\n`;
  f.llamar_metodo = (b) => `${g.valor(b, "OBJETO", O.MIEMBRO, "this")}.${g.campo(b, "METODO")}(${g.argumentos(b, O.NINGUNO)});\n`;
  f.llamar_metodo_valor = (b) =>
    [`${g.valor(b, "OBJETO", O.MIEMBRO, "this")}.${g.campo(b, "METODO")}(${g.argumentos(b, O.NINGUNO)})`, O.LLAMADA];
  f.este = () => ["this", O.ATOMICO];

  return g;
}
