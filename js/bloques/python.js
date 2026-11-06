import { crearGenerador, devuelveTexto, sinoEncadenado } from "./generador.js";

// Precedencia de operadores de Python (menor número = se evalúa antes).
const O = { ATOMICO: 0, MIEMBRO: 1, LLAMADA: 2, UNARIO: 4, MULT: 5, ADITIVO: 6, RELACIONAL: 11, NO: 12, Y: 13, O: 14, NINGUNO: 99 };

const RESERVADAS = ["False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
  "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
  "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
  "print", "len", "str", "int", "float", "bool", "list", "range", "input", "type", "self", "object"];

const TIPO = { entero: "int", decimal: "float", texto: "str", booleano: "bool", arreglo: "list", objeto: "object" };
const INICIAL = { entero: "0", decimal: "0.0", texto: '""', booleano: "False", arreglo: "[]", objeto: "None" };
const ARITMETICA = { SUMA: ["+", O.ADITIVO], RESTA: ["-", O.ADITIVO], MULT: ["*", O.MULT], DIV: ["/", O.MULT], MOD: ["%", O.MULT] };
const COMPARACION = { IGUAL: "==", DISTINTO: "!=", MENOR: "<", MENOR_IGUAL: "<=", MAYOR: ">", MAYOR_IGUAL: ">=" };

export function generadorPython(Blockly) {
  const g = crearGenerador(Blockly, "Python", { reservadas: RESERVADAS });
  g.ORDER_OVERRIDES = [[O.MIEMBRO, O.MIEMBRO], [O.MIEMBRO, O.LLAMADA]];
  const f = g.forBlock;
  const bloqueOPass = (codigo) => codigo || `${g.INDENT}pass\n`;
  const cuerpo = (b, entrada) => bloqueOPass(g.statementToCode(b, entrada));
  const comoTexto = (b, entrada) => {
    const v = g.valor(b, entrada, O.NINGUNO, '""');
    return devuelveTexto(b, entrada) ? v : `str(${v})`;
  };
  const funcion = (nombre, params, b) => `def ${nombre}(${params.join(", ")}):\n${cuerpo(b, "CUERPO")}`;

  g.ensamblar = ({ clases, funciones, programa }) => {
    const definiciones = [...clases, ...funciones].join("\n\n");
    return definiciones && programa ? `${definiciones}\n\n${programa}` : definiciones + programa;
  };

  f.declarar_variable = (b) => `${g.variable(b)} = ${g.valor(b, "VALOR", O.NINGUNO, INICIAL[b.getFieldValue("TIPO")])}\n`;
  f.asignar = (b) => `${g.variable(b)} = ${g.valor(b, "VALOR", O.NINGUNO, "None")}\n`;
  f.variable = (b) => [g.variable(b), O.ATOMICO];
  f.numero = (b) => {
    const n = Number(b.getFieldValue("NUM"));
    return [String(n), n < 0 ? O.UNARIO : O.ATOMICO];
  };
  f.texto = (b) => [JSON.stringify(b.getFieldValue("TEXTO")), O.ATOMICO];
  f.booleano = (b) => [b.getFieldValue("VALOR") === "VERDADERO" ? "True" : "False", O.ATOMICO];

  f.aritmetica = (b) => {
    const [op, orden] = ARITMETICA[b.getFieldValue("OP")];
    return [`${g.valor(b, "A", orden, "0")} ${op} ${g.valor(b, "B", orden, "0")}`, orden];
  };
  f.comparacion = (b) => [`${g.valor(b, "A", O.RELACIONAL, "0")} ${COMPARACION[b.getFieldValue("OP")]} ${g.valor(b, "B", O.RELACIONAL, "0")}`, O.RELACIONAL];
  f.logica = (b) => {
    const [op, orden] = b.getFieldValue("OP") === "Y" ? ["and", O.Y] : ["or", O.O];
    return [`${g.valor(b, "A", orden, "False")} ${op} ${g.valor(b, "B", orden, "False")}`, orden];
  };
  f.no = (b) => [`not ${g.valor(b, "VALOR", O.NO, "False")}`, O.NO];

  f.imprimir = (b) => `print(${g.valor(b, "VALOR", O.NINGUNO, "")})\n`;

  f.si = (b) => `if ${g.valor(b, "COND", O.NINGUNO, "False")}:\n${cuerpo(b, "ENTONCES")}`;
  f.si_sino = (b) => {
    const inicio = f.si(b);
    const encadenado = sinoEncadenado(b);
    return encadenado ? `${inicio}el${g.blockToCode(encadenado, true)}` : `${inicio}else:\n${cuerpo(b, "SINO")}`;
  };
  f.mientras = (b) => `while ${g.valor(b, "COND", O.NINGUNO, "False")}:\n${cuerpo(b, "CUERPO")}`;
  f.para = (b) => {
    const desde = g.valor(b, "DESDE", O.NINGUNO, "0");
    const hasta = g.valor(b, "HASTA", O.ADITIVO, "0");
    const limite = /^-?\d+$/.test(hasta) ? String(Number(hasta) + 1) : `${hasta} + 1`;
    const paso = Number(b.getFieldValue("PASO"));
    return `for ${g.variable(b)} in range(${desde}, ${limite}${paso === 1 ? "" : `, ${paso}`}):\n${cuerpo(b, "CUERPO")}`;
  };
  f.para_cada = (b) => `for ${g.variable(b)} in ${g.valor(b, "LISTA", O.NINGUNO, "[]")}:\n${cuerpo(b, "CUERPO")}`;
  f.romper = () => "break\n";
  f.continuar = () => "continue\n";

  f.definir_funcion = (b) => funcion(g.campo(b, "NOMBRE"), g.parametros(b).map((p) => p.nombre), b);
  f.retornar = (b) => {
    const v = g.valueToCode(b, "VALOR", O.NINGUNO);
    return v ? `return ${v}\n` : "return\n";
  };
  f.llamar_funcion = (b) => `${g.campo(b, "NOMBRE")}(${g.argumentos(b, O.NINGUNO)})\n`;
  f.llamar_funcion_valor = (b) => [`${g.campo(b, "NOMBRE")}(${g.argumentos(b, O.NINGUNO)})`, O.LLAMADA];

  f.crear_arreglo = (b) => {
    const elementos = ["E0", "E1", "E2", "E3", "E4"].map((e) => g.valueToCode(b, e, O.NINGUNO)).filter(Boolean);
    return [`[${elementos.join(", ")}]`, O.ATOMICO];
  };
  f.elemento_en = (b) => [`${g.valor(b, "LISTA", O.MIEMBRO, "[]")}[${g.valor(b, "INDICE", O.NINGUNO, "0")}]`, O.MIEMBRO];
  f.asignar_elemento = (b) =>
    `${g.valor(b, "LISTA", O.MIEMBRO, "[]")}[${g.valor(b, "INDICE", O.NINGUNO, "0")}] = ${g.valor(b, "VALOR", O.NINGUNO, "None")}\n`;
  f.longitud = (b) => [`len(${g.valor(b, "LISTA", O.NINGUNO, "[]")})`, O.LLAMADA];

  f.concatenar = (b) => [`${comoTexto(b, "A")} + ${comoTexto(b, "B")}`, O.ADITIVO];
  f.longitud_texto = (b) => [`len(${g.valor(b, "TEXTO", O.NINGUNO, '""')})`, O.LLAMADA];
  f.subcadena = (b) =>
    [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}[${g.valor(b, "DESDE", O.NINGUNO, "0")}:${g.valor(b, "HASTA", O.NINGUNO, "0")}]`, O.MIEMBRO];
  f.mayusculas = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.upper()`, O.LLAMADA];
  f.minusculas = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.lower()`, O.LLAMADA];

  f.definir_clase = (b) => {
    const padre = b.getFieldValue("PADRE").trim();
    const miembros = g.miembros(b);
    return `class ${g.campo(b, "NOMBRE")}${padre ? `(${g.identificador(padre)})` : ""}:\n${bloqueOPass(g.sangrar(miembros))}`;
  };
  f.atributo = (b) => `${g.campo(b, "NOMBRE")}: ${TIPO[b.getFieldValue("TIPO")]}\n`;
  f.constructor = (b) => funcion("__init__", ["self", ...g.parametros(b).map((p) => p.nombre)], b);
  f.metodo = (b) => funcion(g.campo(b, "NOMBRE"), ["self", ...g.parametros(b).map((p) => p.nombre)], b);
  f.crear_objeto = (b) => [`${g.campo(b, "CLASE")}(${g.argumentos(b, O.NINGUNO)})`, O.LLAMADA];
  f.obtener_atributo = (b) => [`${g.valor(b, "OBJETO", O.MIEMBRO, "self")}.${g.campo(b, "ATRIBUTO")}`, O.MIEMBRO];
  f.asignar_atributo = (b) =>
    `${g.valor(b, "OBJETO", O.MIEMBRO, "self")}.${g.campo(b, "ATRIBUTO")} = ${g.valor(b, "VALOR", O.NINGUNO, "None")}\n`;
  f.llamar_metodo = (b) => `${g.valor(b, "OBJETO", O.MIEMBRO, "self")}.${g.campo(b, "METODO")}(${g.argumentos(b, O.NINGUNO)})\n`;
  f.llamar_metodo_valor = (b) =>
    [`${g.valor(b, "OBJETO", O.MIEMBRO, "self")}.${g.campo(b, "METODO")}(${g.argumentos(b, O.NINGUNO)})`, O.LLAMADA];
  f.este = () => ["self", O.ATOMICO];

  return g;
}
