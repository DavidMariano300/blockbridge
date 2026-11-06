import { crearGenerador } from "./generador.js";
import { sintaxisLlaves } from "./llaves.js";
import { BLOQUES_POO } from "./definiciones.js";

const AUXILIARES_NOMBRES = ["unir", "subcadena", "mayusculas", "minusculas", "texto_entero", "texto_decimal"];
const RESERVADAS = ["auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum", "extern",
  "float", "for", "goto", "if", "inline", "int", "long", "register", "restrict", "return", "short", "signed", "sizeof",
  "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while", "bool", "true", "false",
  "main", "printf", "strlen", "malloc", "free", "NULL", ...AUXILIARES_NOMBRES];

const TIPO = { entero: "int", decimal: "double", texto: "char *", booleano: "bool", arreglo: "int *", objeto: "void *" };
const INICIAL = { entero: "0", decimal: "0.0", texto: '""', booleano: "false", arreglo: "NULL", objeto: "NULL" };
const FORMATO = { entero: "%d", decimal: "%g", texto: "%s", booleano: "%d" };
const declarar = (tipo, nombre) => (TIPO[tipo].endsWith("*") ? `${TIPO[tipo]}${nombre}` : `${TIPO[tipo]} ${nombre}`);

// Funciones de apoyo para cadenas: C no tiene un tipo texto con operaciones propias.
const RESERVA = "    /* Reserva memoria nueva: libérala con free() cuando ya no la uses. */\n";
const AUXILIARES = {
  unir: `char *unir(const char *a, const char *b) {\n${RESERVA}    char *r = malloc(strlen(a) + strlen(b) + 1);\n    strcpy(r, a);\n    return strcat(r, b);\n}\n`,
  subcadena: `char *subcadena(const char *texto, int desde, int hasta) {\n${RESERVA}    char *r = malloc((size_t)(hasta - desde) + 1);\n    memcpy(r, texto + desde, (size_t)(hasta - desde));\n    r[hasta - desde] = '\\0';\n    return r;\n}\n`,
  mayusculas: `char *mayusculas(const char *texto) {\n${RESERVA}    size_t n = strlen(texto);\n    char *r = malloc(n + 1);\n    for (size_t i = 0; i <= n; i++) r[i] = (char)toupper((unsigned char)texto[i]);\n    return r;\n}\n`,
  minusculas: `char *minusculas(const char *texto) {\n${RESERVA}    size_t n = strlen(texto);\n    char *r = malloc(n + 1);\n    for (size_t i = 0; i <= n; i++) r[i] = (char)tolower((unsigned char)texto[i]);\n    return r;\n}\n`,
  texto_entero: `char *texto_entero(int n) {\n${RESERVA}    char *r = malloc(12);\n    snprintf(r, 12, "%d", n);\n    return r;\n}\n`,
  texto_decimal: `char *texto_decimal(double x) {\n${RESERVA}    char *r = malloc(32);\n    snprintf(r, 32, "%g", x);\n    return r;\n}\n`,
};

export function generadorC(Blockly) {
  const g = crearGenerador(Blockly, "C", { reservadas: RESERVADAS });
  g.este = "NULL";
  const O = sintaxisLlaves(g, {
    nulo: "NULL",
    textoIgual: (b, distinto) => {
      g.incluir("<string.h>");
      return [`strcmp(${g.valor(b, "A", O.NINGUNO, '""')}, ${g.valor(b, "B", O.NINGUNO, '""')}) ${distinto ? "!=" : "=="} 0`, O.IGUALDAD];
    },
  });
  const f = g.forBlock;
  const auxiliar = (nombre, ...cabeceras) => {
    ["<stdlib.h>", "<string.h>", ...cabeceras].forEach(g.incluir);
    g.requerir(nombre, AUXILIARES[nombre]);
  };
  const parametros = (b) => g.parametros(b).map((p) => (p.tipo === "arreglo" ? `int ${p.nombre}[]` : declarar(p.tipo, p.nombre))).join(", ") || "void";
  const retorno = (t) => (t === "nada" ? "void" : TIPO[t].trim());

  g.ensamblar = ({ clases, funciones, programa }) => {
    const cabeceras = ["<stdio.h>", "<stdbool.h>", ...[...g.cabeceras].sort()].map((c) => `#include ${c}`).join("\n");
    const main = `int main(void) {\n${g.sangrar(`${programa}return 0;\n`)}}\n`;
    return [`${cabeceras}\n`, ...g.extras.values(), ...clases, ...funciones, main].join("\n");
  };

  // Número de elementos de un arreglo: sizeof funciona con arreglos declarados, no con punteros.
  const largo = (lista, codigo) => (lista?.type === "crear_arreglo"
    ? String(g.elementos(lista).length)
    : `(int)(sizeof(${codigo}) / sizeof(${codigo}[0]))`);

  f.declarar_variable = (b) => {
    const tipo = b.getFieldValue("TIPO");
    const nombre = g.variable(b);
    const valor = b.getInputTargetBlock("VALOR");
    if (tipo === "arreglo" && valor?.type === "crear_arreglo") {
      return `${declarar(valor.getFieldValue("TIPO"), nombre)}[] = {${g.elementos(valor).join(", ")}};\n`;
    }
    return `${declarar(tipo, nombre)} = ${g.valueToCode(b, "VALOR", O.NINGUNO) || INICIAL[tipo]};\n`;
  };

  // imprimir(unir(...)) se escribe como un solo printf con su formato, sin reservar memoria.
  f.imprimir = (b) => {
    const partes = [];
    const recorrer = (bloque) => {
      if (bloque?.type === "concatenar") return ["A", "B"].forEach((e) => recorrer(bloque.getInputTargetBlock(e)));
      if (bloque) partes.push(bloque);
    };
    recorrer(b.getInputTargetBlock("VALOR"));
    let formato = "";
    const argumentos = [];
    for (const parte of partes) {
      if (parte.type === "texto") {
        formato += JSON.stringify(parte.getFieldValue("TEXTO")).slice(1, -1).replace(/%/g, "%%");
      } else {
        formato += FORMATO[g.tipoDe(parte)] ?? "%d";
        argumentos.push(g.blockToCode(parte)[0]);
      }
    }
    return `printf(${[`"${formato}\\n"`, ...argumentos].join(", ")});\n`;
  };
  f.para = (b) => g.paraClasico(b, "int ");
  f.para_cada = (b) => {
    const elemento = g.variable(b);
    const lista = b.getInputTargetBlock("LISTA");
    const codigo = g.valor(b, "LISTA", O.MIEMBRO, "(int[]){0}");
    const indice = `${elemento}_i`;
    const declaracion = `${g.INDENT}${declarar(g.tipoElemento(lista) ?? "entero", elemento)} = ${codigo}[${indice}];\n`;
    return `for (int ${indice} = 0; ${indice} < ${largo(lista, codigo)}; ${indice}++) {\n${declaracion}${g.bloque(b, "CUERPO")}}\n`;
  };

  f.definir_funcion = (b) => `${retorno(b.getFieldValue("RETORNO"))} ${g.campo(b, "NOMBRE")}(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;

  f.crear_arreglo = (b) => [`(${TIPO[b.getFieldValue("TIPO")].trim()}[]){${g.elementos(b).join(", ")}}`, O.ATOMICO];
  f.longitud = (b) => [largo(b.getInputTargetBlock("LISTA"), g.valor(b, "LISTA", O.MIEMBRO, "(int[]){0}")), O.UNARIO];

  f.concatenar = (b) => {
    auxiliar("unir");
    const lado = (entrada) => {
      const tipo = g.tipoEntrada(b, entrada);
      if (tipo === "texto") return g.valor(b, entrada, O.NINGUNO, '""');
      const conversion = tipo === "decimal" ? "texto_decimal" : "texto_entero";
      auxiliar(conversion, "<stdio.h>");
      return `${conversion}(${g.valor(b, entrada, O.NINGUNO, "0")})`;
    };
    return [`unir(${lado("A")}, ${lado("B")})`, O.LLAMADA];
  };
  f.longitud_texto = (b) => {
    g.incluir("<string.h>");
    return [`(int)strlen(${g.valor(b, "TEXTO", O.NINGUNO, '""')})`, O.UNARIO];
  };
  f.subcadena = (b) => {
    auxiliar("subcadena");
    return [`subcadena(${g.valor(b, "TEXTO", O.NINGUNO, '""')}, ${g.valor(b, "DESDE", O.NINGUNO, "0")}, ${g.valor(b, "HASTA", O.NINGUNO, "0")})`, O.LLAMADA];
  };
  for (const nombre of ["mayusculas", "minusculas"]) {
    f[nombre] = (b) => {
      auxiliar(nombre, "<ctype.h>");
      return [`${nombre}(${g.valor(b, "TEXTO", O.NINGUNO, '""')})`, O.LLAMADA];
    };
  }

  // C no tiene clases (RN-10): los ejercicios de POO no se ofrecen en C.
  const sinClases = "/* C no tiene clases: este programa usa programación orientada a objetos. */\n";
  for (const tipo of BLOQUES_POO) {
    f[tipo] = (b) => (b.outputConnection ? ["NULL", O.ATOMICO] : ["definir_clase", "llamar_metodo", "asignar_atributo"].includes(tipo) ? sinClases : "");
  }

  return g;
}
