import { crearGenerador } from "./generador.js";
import { sintaxisLlaves } from "./llaves.js";

const RESERVADAS = ["abstract", "as", "base", "bool", "break", "byte", "case", "catch", "char", "checked", "class", "const",
  "continue", "decimal", "default", "delegate", "do", "double", "else", "enum", "event", "explicit", "extern", "false",
  "finally", "fixed", "float", "for", "foreach", "goto", "if", "implicit", "in", "int", "interface", "internal", "is",
  "lock", "long", "namespace", "new", "null", "object", "operator", "out", "override", "params", "private", "protected",
  "public", "readonly", "ref", "return", "sbyte", "sealed", "short", "sizeof", "stackalloc", "static", "string", "struct",
  "switch", "this", "throw", "true", "try", "typeof", "uint", "ulong", "unchecked", "unsafe", "ushort", "using",
  "virtual", "void", "volatile", "while", "var", "Console", "Program", "Main", "System", "String"];

const TIPO = { entero: "int", decimal: "double", texto: "string", booleano: "bool", arreglo: "int[]", objeto: "object" };
const INICIAL = { entero: "0", decimal: "0.0", texto: '""', booleano: "false", arreglo: "new int[0]", objeto: "null" };
const retorno = (t) => (t === "nada" ? "void" : TIPO[t]);

export function generadorCSharp(Blockly) {
  const g = crearGenerador(Blockly, "C#", { reservadas: RESERVADAS });
  g.este = "this";
  const O = sintaxisLlaves(g);
  const f = g.forBlock;
  const parametros = (b) => g.parametros(b).map((p) => `${TIPO[p.tipo]} ${p.nombre}`).join(", ");

  g.ensamblar = ({ clases, funciones, programa }) => {
    const main = `static void Main() {\n${g.sangrar(programa)}}\n`;
    return ["using System;\n", ...clases, `class Program {\n${g.sangrar([...funciones, main].join("\n"))}}\n`].join("\n");
  };

  f.declarar_variable = (b) => {
    const tipo = b.getFieldValue("TIPO");
    const valor = g.valueToCode(b, "VALOR", O.NINGUNO);
    if ((tipo === "arreglo" || tipo === "objeto") && valor) return `var ${g.variable(b)} = ${valor};\n`;
    return `${TIPO[tipo]} ${g.variable(b)} = ${valor || INICIAL[tipo]};\n`;
  };
  f.imprimir = (b) => `Console.WriteLine(${g.valor(b, "VALOR", O.NINGUNO, "")});\n`;
  f.para = (b) => g.paraClasico(b, "int ");
  f.para_cada = (b) => `foreach (var ${g.variable(b)} in ${g.valor(b, "LISTA", O.NINGUNO, "new int[0]")}) {\n${g.bloque(b, "CUERPO")}}\n`;

  f.definir_funcion = (b) =>
    `static ${retorno(b.getFieldValue("RETORNO"))} ${g.campo(b, "NOMBRE")}(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;

  f.crear_arreglo = (b) => [`new ${TIPO[b.getFieldValue("TIPO")]}[] { ${g.elementos(b).join(", ")} }`, O.NEW];
  f.longitud = (b) => [`${g.valor(b, "LISTA", O.MIEMBRO, "new int[0]")}.Length`, O.MIEMBRO];

  f.concatenar = (b) => {
    const a = g.tipoEntrada(b, "A") === "texto" ? g.valor(b, "A", O.ADITIVO, '""') : `${g.valor(b, "A", O.MIEMBRO, '""')}.ToString()`;
    return [`${a} + ${g.valor(b, "B", O.ADITIVO, '""')}`, O.ADITIVO];
  };
  f.longitud_texto = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.Length`, O.MIEMBRO];
  // Substring de C# recibe inicio y longitud, no inicio y fin.
  f.subcadena = (b) => {
    return [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.Substring(${g.valor(b, "DESDE", O.NINGUNO, "0")}, ${g.largoSubcadena(b)})`, O.LLAMADA];
  };
  f.mayusculas = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.ToUpper()`, O.LLAMADA];
  f.minusculas = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.ToLower()`, O.LLAMADA];

  f.definir_clase = (b) => {
    const nombre = b.getFieldValue("NOMBRE");
    const padre = b.getFieldValue("PADRE").trim();
    const heredado = g.constructorHeredado(nombre);
    const reenvio = heredado
      ? `public ${g.identificador(nombre)}(${parametros(heredado)}) : base(${g.parametros(heredado).map((p) => p.nombre).join(", ")}) {\n}\n`
      : "";
    const miembros = [reenvio, g.miembros(b)].filter(Boolean).join("\n");
    return `class ${g.identificador(nombre)}${padre ? ` : ${g.identificador(padre)}` : ""} {\n${g.sangrar(miembros)}}\n`;
  };
  f.atributo = (b) => `public ${TIPO[b.getFieldValue("TIPO")]} ${g.campo(b, "NOMBRE")};\n`;
  f.constructor = (b) => `public ${g.identificador(g.claseDe(b))}(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;
  f.metodo = (b) => {
    const clase = g.claseDe(b);
    const nombre = b.getFieldValue("NOMBRE");
    const modificador = g.sobrescribe(clase, nombre) ? "override " : g.esSobrescrito(clase, nombre) ? "virtual " : "";
    return `public ${modificador}${retorno(b.getFieldValue("RETORNO"))} ${g.campo(b, "NOMBRE")}(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;
  };
  f.crear_objeto = (b) => [`new ${g.campo(b, "CLASE")}(${g.argumentos(b, O.NINGUNO)})`, O.NEW];

  return g;
}
