import { crearGenerador } from "./generador.js";
import { sintaxisLlaves } from "./llaves.js";

const RESERVADAS = ["abstract", "and", "array", "as", "break", "callable", "case", "catch", "class", "clone", "const",
  "continue", "declare", "default", "do", "echo", "else", "elseif", "empty", "enddeclare", "endfor", "endforeach",
  "endif", "endswitch", "endwhile", "eval", "exit", "extends", "final", "finally", "fn", "for", "foreach", "function",
  "global", "goto", "if", "implements", "include", "instanceof", "insteadof", "interface", "isset", "list", "match",
  "namespace", "new", "or", "print", "private", "protected", "public", "readonly", "require", "return", "static",
  "switch", "throw", "trait", "try", "unset", "use", "var", "while", "xor", "yield", "this", "true", "false", "null",
  "count", "strlen"];

const INICIAL = { entero: "0", decimal: "0.0", texto: '""', booleano: "false", arreglo: "[]", objeto: "null" };

export function generadorPHP(Blockly) {
  const g = crearGenerador(Blockly, "PHP", { reservadas: RESERVADAS });
  g.este = "$this";
  g.flecha = () => "->";
  // Las variables de PHP llevan $; "this" queda reservada para el objeto actual.
  const nombreBase = g.variable;
  g.variable = (b, campo) => `$${nombreBase(b, campo)}`;
  const O = sintaxisLlaves(g);
  // new X()->m() solo es válido desde PHP 8.4: aquí se conservan los paréntesis.
  g.ORDER_OVERRIDES = g.ORDER_OVERRIDES.filter(([, interior]) => interior !== O.NEW);
  const f = g.forBlock;
  const parametros = (b) => g.parametros(b).map((p) => p.nombre).join(", ");

  g.ensamblar = ({ clases, funciones, programa }) => ["<?php\n", ...clases, ...funciones, programa].filter(Boolean).join("\n");

  // En comillas dobles, $ inicia una interpolación.
  f.texto = (b) => [JSON.stringify(b.getFieldValue("TEXTO")).replace(/\$/g, "\\$"), O.ATOMICO];
  f.declarar_variable = (b) => `${g.variable(b)} = ${g.valor(b, "VALOR", O.NINGUNO, INICIAL[b.getFieldValue("TIPO")])};\n`;
  f.imprimir = (b) => {
    const v = g.valueToCode(b, "VALOR", O.ADITIVO);
    return v ? `echo ${v} . PHP_EOL;\n` : "echo PHP_EOL;\n";
  };
  f.para = (b) => g.paraClasico(b, "");
  f.para_cada = (b) => `foreach (${g.valor(b, "LISTA", O.NINGUNO, "[]")} as ${g.variable(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;

  f.definir_funcion = (b) => `function ${g.campo(b, "NOMBRE")}(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;

  f.crear_arreglo = (b) => [`[${g.elementos(b).join(", ")}]`, O.ATOMICO];
  f.longitud = (b) => [`count(${g.valor(b, "LISTA", O.NINGUNO, "[]")})`, O.LLAMADA];

  // Las funciones mb_ cuentan caracteres, no bytes: "año" mide 3, igual que en los demás lenguajes.
  f.concatenar = (b) => [`${g.valor(b, "A", O.ADITIVO, '""')} . ${g.valor(b, "B", O.ADITIVO, '""')}`, O.ADITIVO];
  f.longitud_texto = (b) => [`mb_strlen(${g.valor(b, "TEXTO", O.NINGUNO, '""')})`, O.LLAMADA];
  f.subcadena = (b) =>
    [`mb_substr(${g.valor(b, "TEXTO", O.NINGUNO, '""')}, ${g.valor(b, "DESDE", O.NINGUNO, "0")}, ${g.largoSubcadena(b)})`, O.LLAMADA];
  f.mayusculas = (b) => [`mb_strtoupper(${g.valor(b, "TEXTO", O.NINGUNO, '""')})`, O.LLAMADA];
  f.minusculas = (b) => [`mb_strtolower(${g.valor(b, "TEXTO", O.NINGUNO, '""')})`, O.LLAMADA];

  f.definir_clase = (b) => {
    const padre = b.getFieldValue("PADRE").trim();
    return `class ${g.campo(b, "NOMBRE")}${padre ? ` extends ${g.identificador(padre)}` : ""} {\n${g.sangrar(g.miembros(b))}}\n`;
  };
  f.atributo = (b) => `public $${g.campo(b, "NOMBRE")};\n`;
  f.constructor = (b) => `public function __construct(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;
  f.metodo = (b) => `public function ${g.campo(b, "NOMBRE")}(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;
  f.crear_objeto = (b) => [`new ${g.campo(b, "CLASE")}(${g.argumentos(b, O.NINGUNO)})`, O.NEW];

  return g;
}
