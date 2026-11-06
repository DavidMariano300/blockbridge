import { crearGenerador } from "./generador.js";
import { sintaxisLlaves } from "./llaves.js";

const RESERVADAS = ["as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in", "interface", "is",
  "null", "object", "package", "return", "super", "this", "throw", "true", "try", "typealias", "typeof", "val", "var",
  "when", "while", "println", "Int", "Double", "String", "Boolean", "Any", "Unit", "main"];

const TIPO = { entero: "Int", decimal: "Double", texto: "String", booleano: "Boolean", arreglo: "IntArray", objeto: "Any?" };
const INICIAL = { entero: "0", decimal: "0.0", texto: '""', booleano: "false", arreglo: "IntArray(0)", objeto: "null" };
const CREAR_ARREGLO = { entero: "intArrayOf", decimal: "doubleArrayOf", texto: "arrayOf", booleano: "booleanArrayOf" };

// Kotlin no convierte Int en Double: un 3 donde se espera decimal se escribe 3.0.
const comoDecimal = (codigo) => (/^-?\d+$/.test(codigo) ? `${codigo}.0` : codigo);

export function generadorKotlin(Blockly) {
  const g = crearGenerador(Blockly, "Kotlin", { reservadas: RESERVADAS });
  g.este = "this";
  const O = sintaxisLlaves(g, { fin: "" });
  const f = g.forBlock;
  const parametros = (b) => g.parametros(b).map((p) => `${p.nombre}: ${TIPO[p.tipo]}`).join(", ");
  const retorno = (b) => (b.getFieldValue("RETORNO") === "nada" ? "" : `: ${TIPO[b.getFieldValue("RETORNO")]}`);

  g.ensamblar = ({ clases, funciones, programa }) => [...clases, ...funciones, `fun main() {\n${g.sangrar(programa)}}\n`].join("\n");

  // El "$" inicia una plantilla en las cadenas de Kotlin.
  f.texto = (b) => [JSON.stringify(b.getFieldValue("TEXTO")).replace(/\$/g, "\\$"), O.ATOMICO];

  // val si la variable nunca se reasigna; var si algún bloque "asignar" la cambia.
  f.declarar_variable = (b) => {
    const tipo = b.getFieldValue("TIPO");
    const id = b.getField("VAR").getVariable().getId();
    const palabra = g.info.asignadas.has(id) ? "var" : "val";
    let valor = g.valueToCode(b, "VALOR", O.NINGUNO);
    if ((tipo === "arreglo" || tipo === "objeto") && valor) return `${palabra} ${g.variable(b)} = ${valor}\n`;
    if (tipo === "decimal" && valor) valor = comoDecimal(valor);
    return `${tipo === "objeto" ? "var" : palabra} ${g.variable(b)}: ${TIPO[tipo]} = ${valor || INICIAL[tipo]}\n`;
  };
  f.imprimir = (b) => `println(${g.valor(b, "VALOR", O.NINGUNO, "")})\n`;
  f.para = (b) => {
    const paso = Number(b.getFieldValue("PASO"));
    return `for (${g.variable(b)} in ${g.valor(b, "DESDE", O.ADITIVO, "0")}..${g.valor(b, "HASTA", O.ADITIVO, "0")}`
      + `${paso === 1 ? "" : ` step ${paso}`}) {\n${g.bloque(b, "CUERPO")}}\n`;
  };
  f.para_cada = (b) => `for (${g.variable(b)} in ${g.valor(b, "LISTA", O.NINGUNO, "IntArray(0)")}) {\n${g.bloque(b, "CUERPO")}}\n`;

  f.definir_funcion = (b) => `fun ${g.campo(b, "NOMBRE")}(${parametros(b)})${retorno(b)} {\n${g.bloque(b, "CUERPO")}}\n`;

  f.crear_arreglo = (b) => {
    const tipo = b.getFieldValue("TIPO");
    const elementos = g.elementos(b).map((e) => (tipo === "decimal" ? comoDecimal(e) : e));
    return [`${CREAR_ARREGLO[tipo]}(${elementos.join(", ")})`, O.LLAMADA];
  };
  f.longitud = (b) => [`${g.valor(b, "LISTA", O.MIEMBRO, "IntArray(0)")}.size`, O.MIEMBRO];

  f.concatenar = (b) => {
    const a = g.tipoEntrada(b, "A") === "texto" ? g.valor(b, "A", O.ADITIVO, '""') : `${g.valor(b, "A", O.MIEMBRO, '""')}.toString()`;
    return [`${a} + ${g.valor(b, "B", O.ADITIVO, '""')}`, O.ADITIVO];
  };
  f.longitud_texto = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.length`, O.MIEMBRO];
  f.subcadena = (b) =>
    [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.substring(${g.valor(b, "DESDE", O.NINGUNO, "0")}, ${g.valor(b, "HASTA", O.NINGUNO, "0")})`, O.LLAMADA];
  f.mayusculas = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.uppercase()`, O.LLAMADA];
  f.minusculas = (b) => [`${g.valor(b, "TEXTO", O.MIEMBRO, '""')}.lowercase()`, O.LLAMADA];

  // Una clase con hijas debe ser open; sin constructores propios ni heredados, la superclase se invoca con ().
  f.definir_clase = (b) => {
    const nombre = b.getFieldValue("NOMBRE");
    const padre = b.getFieldValue("PADRE").trim();
    const heredado = g.constructorHeredado(nombre);
    const reenvio = heredado
      ? `constructor(${parametros(heredado)}) : super(${g.parametros(heredado).map((p) => p.nombre).join(", ")})\n`
      : "";
    const llamaSuper = padre && !heredado && !g.info.clases.get(nombre)?.constructorBloque ? "()" : "";
    const cabecera = `${g.tieneHijas(nombre) ? "open " : ""}class ${g.identificador(nombre)}${padre ? ` : ${g.identificador(padre)}${llamaSuper}` : ""}`;
    const miembros = [reenvio, g.miembros(b)].filter(Boolean).join("\n");
    return miembros ? `${cabecera} {\n${g.sangrar(miembros)}}\n` : `${cabecera}\n`;
  };
  f.atributo = (b) => {
    const tipo = b.getFieldValue("TIPO");
    return `var ${g.campo(b, "NOMBRE")}: ${TIPO[tipo]} = ${INICIAL[tipo]}\n`;
  };
  f.constructor = (b) => {
    const padre = g.info.clases.get(g.claseDe(b))?.padre;
    const delPadre = padre && (g.info.clases.get(padre)?.constructorBloque ?? g.constructorHeredado(padre));
    const superVacio = padre && (!delPadre || g.parametros(delPadre).length === 0) ? " : super()" : "";
    return `constructor(${parametros(b)})${superVacio} {\n${g.bloque(b, "CUERPO")}}\n`;
  };
  f.metodo = (b) => {
    const clase = g.claseDe(b);
    const nombre = b.getFieldValue("NOMBRE");
    const modificador = g.sobrescribe(clase, nombre) ? "override " : g.esSobrescrito(clase, nombre) ? "open " : "";
    return `${modificador}fun ${g.campo(b, "NOMBRE")}(${parametros(b)})${retorno(b)} {\n${g.bloque(b, "CUERPO")}}\n`;
  };
  f.crear_objeto = (b) => [`${g.campo(b, "CLASE")}(${g.argumentos(b, O.NINGUNO)})`, O.LLAMADA];

  return g;
}
