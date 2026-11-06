import { crearGenerador } from "./generador.js";
import { sintaxisLlaves } from "./llaves.js";

const RESERVADAS = ["abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue",
  "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "goto", "if", "implements",
  "import", "instanceof", "int", "interface", "long", "native", "new", "package", "private", "protected", "public",
  "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this", "throw", "throws", "transient",
  "try", "void", "volatile", "while", "true", "false", "null", "var", "record", "yield", "Main", "String", "System", "Object", "Math"];

const TIPO = { entero: "int", decimal: "double", texto: "String", booleano: "boolean", arreglo: "int[]", objeto: "Object" };
const INICIAL = { entero: "0", decimal: "0.0", texto: '""', booleano: "false", arreglo: "new int[0]", objeto: "null" };
const retorno = (t) => (t === "nada" ? "void" : TIPO[t]);

export function generadorJava(Blockly) {
  const g = crearGenerador(Blockly, "Java", { reservadas: RESERVADAS });
  g.este = "this";
  const O = sintaxisLlaves(g, {
    textoIgual: (b, distinto) => [`${distinto ? "!" : ""}${g.valor(b, "A", O.MIEMBRO, '""')}.equals(${g.valor(b, "B", O.NINGUNO, '""')})`,
      distinto ? O.UNARIO : O.LLAMADA],
  });
  const f = g.forBlock;
  const parametros = (b) => g.parametros(b).map((p) => `${TIPO[p.tipo]} ${p.nombre}`).join(", ");

  g.ensamblar = ({ clases, funciones, programa }) => {
    const main = `public static void main(String[] args) {\n${g.sangrar(programa)}}\n`;
    return [...clases, `public class Main {\n${g.sangrar([...funciones, main].join("\n"))}}\n`].join("\n");
  };

  // arreglo y objeto se declaran con var (Java 10+), que deduce el tipo del valor.
  f.declarar_variable = (b) => {
    const tipo = b.getFieldValue("TIPO");
    const valor = g.valueToCode(b, "VALOR", O.NINGUNO);
    if ((tipo === "arreglo" || tipo === "objeto") && valor) return `var ${g.variable(b)} = ${valor};\n`;
    return `${TIPO[tipo]} ${g.variable(b)} = ${valor || INICIAL[tipo]};\n`;
  };
  f.imprimir = (b) => `System.out.println(${g.valor(b, "VALOR", O.NINGUNO, "")});\n`;
  f.para = (b) => g.paraClasico(b, "int ");
  f.para_cada = (b) => `for (var ${g.variable(b)} : ${g.valor(b, "LISTA", O.NINGUNO, "new int[0]")}) {\n${g.bloque(b, "CUERPO")}}\n`;

  f.definir_funcion = (b) =>
    `static ${retorno(b.getFieldValue("RETORNO"))} ${g.campo(b, "NOMBRE")}(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;

  f.crear_arreglo = (b) => [`new ${TIPO[b.getFieldValue("TIPO")]}[]{${g.elementos(b).join(", ")}}`, O.NEW];
  f.longitud = (b) => [`${g.valor(b, "LISTA", O.MIEMBRO, "new int[0]")}.length`, O.MIEMBRO];

  f.concatenar = (b) => {
    const a = g.tipoEntrada(b, "A") === "texto" ? g.valor(b, "A", O.ADITIVO, '""') : `String.valueOf(${g.valor(b, "A", O.NINGUNO, '""')})`;
    return [`${a} + ${g.valor(b, "B", O.ADITIVO, '""')}`, O.ADITIVO];
  };
  f.longitud_texto = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.length()`, O.LLAMADA];
  f.subcadena = (b) =>
    [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.substring(${g.valor(b, "DESDE", O.NINGUNO, "0")}, ${g.valor(b, "HASTA", O.NINGUNO, "0")})`, O.LLAMADA];
  f.mayusculas = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.toUpperCase()`, O.LLAMADA];
  f.minusculas = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.toLowerCase()`, O.LLAMADA];

  f.definir_clase = (b) => {
    const nombre = b.getFieldValue("NOMBRE");
    const padre = b.getFieldValue("PADRE").trim();
    const heredado = g.constructorHeredado(nombre);
    // Los constructores no se heredan: se reenvía el del padre con super(...).
    const reenvio = heredado
      ? `${g.identificador(nombre)}(${parametros(heredado)}) {\n${g.INDENT}super(${g.parametros(heredado).map((p) => p.nombre).join(", ")});\n}\n`
      : "";
    const miembros = [reenvio, g.miembros(b)].filter(Boolean).join("\n");
    return `class ${g.identificador(nombre)}${padre ? ` extends ${g.identificador(padre)}` : ""} {\n${g.sangrar(miembros)}}\n`;
  };
  f.atributo = (b) => `${TIPO[b.getFieldValue("TIPO")]} ${g.campo(b, "NOMBRE")};\n`;
  f.constructor = (b) => `${g.identificador(g.claseDe(b))}(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;
  f.metodo = (b) => {
    const anotacion = g.sobrescribe(g.claseDe(b), b.getFieldValue("NOMBRE")) ? "@Override\n" : "";
    return `${anotacion}${retorno(b.getFieldValue("RETORNO"))} ${g.campo(b, "NOMBRE")}(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;
  };
  f.crear_objeto = (b) => [`new ${g.campo(b, "CLASE")}(${g.argumentos(b, O.NINGUNO)})`, O.NEW];

  return g;
}
