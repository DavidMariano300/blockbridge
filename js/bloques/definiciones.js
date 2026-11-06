// Catálogo de bloques independiente del lenguaje (docs/01-SRS.md, Anexo A).
// Recibe Blockly como parámetro para funcionar igual en el navegador (global) y en Node (pruebas).

// Texto blanco sobre cada color: contraste medido entre 5.0:1 y 10.4:1 (WCAG AA). "programa" es slate-700
// para que se distinga también sobre el fondo oscuro del editor.
export const COLORES = {
  programa: "#334155",
  variables: "#B45309",
  operadores: "#1E40AF",
  logica: "#6D28D9",
  salida: "#0F766E",
  control: "#4338CA",
  funciones: "#047857",
  arreglos: "#0369A1",
  cadenas: "#BE185D",
  poo: "#9F1239",
};

// "arreglo" y "objeto" se declaran con inferencia en los lenguajes tipados (var, auto, val).
export const TIPOS = [["entero", "entero"], ["decimal", "decimal"], ["texto", "texto"], ["booleano", "booleano"],
  ["arreglo", "arreglo"], ["objeto", "objeto"]];
const TIPOS_RETORNO = [["nada", "nada"], ...TIPOS];
const TIPOS_ELEMENTO = TIPOS.slice(0, 4);

// Las conexiones tipadas impiden, por ejemplo, poner un atributo dentro de un ciclo.
const INSTRUCCION = { previousStatement: "Instruccion", nextStatement: "Instruccion" };
const MIEMBRO = { previousStatement: "Miembro", nextStatement: "Miembro" };
const cuerpo = (name) => ({ type: "input_statement", name, check: "Instruccion" });
const valor = (name, check = null) => ({ type: "input_value", name, check });
const variable = (name, inicial) => ({ type: "field_variable", name, variable: inicial });
const texto = (name, inicial) => ({ type: "field_input", name, text: inicial });
const lista = (name, opciones) => ({ type: "field_dropdown", name, options: opciones });
const args3 = [valor("ARG0"), valor("ARG1"), valor("ARG2")];

const DEFINICIONES = [
  // Programa
  { type: "programa", message0: "programa", message1: "%1", args1: [cuerpo("CUERPO")], colour: COLORES.programa,
    tooltip: "Punto de inicio: sus instrucciones se ejecutan de arriba hacia abajo." },

  // Variables y literales
  { type: "declarar_variable", message0: "declarar %1 %2 = %3", args0: [lista("TIPO", TIPOS), variable("VAR", "x"), valor("VALOR")],
    inputsInline: true, ...INSTRUCCION, colour: COLORES.variables, tooltip: "Crea una variable con un tipo y un valor inicial." },
  { type: "asignar", message0: "asignar a %1 el valor %2", args0: [variable("VAR", "x"), valor("VALOR")],
    inputsInline: true, ...INSTRUCCION, colour: COLORES.variables, tooltip: "Cambia el valor de una variable existente." },
  { type: "variable", message0: "%1", args0: [variable("VAR", "x")], output: null, colour: COLORES.variables },
  { type: "numero", message0: "%1", args0: [{ type: "field_number", name: "NUM", value: 0 }], output: "Number", colour: COLORES.operadores },
  { type: "texto", message0: "“%1”", args0: [texto("TEXTO", "")], output: "String", colour: COLORES.cadenas },
  { type: "booleano", message0: "%1", args0: [lista("VALOR", [["verdadero", "VERDADERO"], ["falso", "FALSO"]])],
    output: "Boolean", colour: COLORES.logica },

  // Operadores
  { type: "aritmetica", message0: "%1 %2 %3", inputsInline: true, output: "Number", colour: COLORES.operadores,
    args0: [valor("A"), lista("OP", [["+", "SUMA"], ["−", "RESTA"], ["×", "MULT"], ["÷", "DIV"], ["%", "MOD"]]), valor("B")] },
  { type: "comparacion", message0: "%1 %2 %3", inputsInline: true, output: "Boolean", colour: COLORES.logica,
    args0: [valor("A"), lista("OP", [["=", "IGUAL"], ["≠", "DISTINTO"], ["<", "MENOR"], ["≤", "MENOR_IGUAL"], [">", "MAYOR"], ["≥", "MAYOR_IGUAL"]]), valor("B")] },
  { type: "logica", message0: "%1 %2 %3", inputsInline: true, output: "Boolean", colour: COLORES.logica,
    args0: [valor("A", "Boolean"), lista("OP", [["y", "Y"], ["o", "O"]]), valor("B", "Boolean")] },
  { type: "no", message0: "no %1", args0: [valor("VALOR", "Boolean")], output: "Boolean", colour: COLORES.logica },

  // Salida
  { type: "imprimir", message0: "imprimir %1", args0: [valor("VALOR")], ...INSTRUCCION, colour: COLORES.salida,
    tooltip: "Muestra un valor en la pantalla." },

  // Control. "sino si" se arma poniendo otro bloque "si" dentro de "si no"; los generadores lo convierten en elif / else if.
  { type: "si", message0: "si %1", args0: [valor("COND", "Boolean")], message1: "entonces %1", args1: [cuerpo("ENTONCES")],
    ...INSTRUCCION, colour: COLORES.control },
  { type: "si_sino", message0: "si %1", args0: [valor("COND", "Boolean")], message1: "entonces %1", args1: [cuerpo("ENTONCES")],
    message2: "si no %1", args2: [cuerpo("SINO")], ...INSTRUCCION, colour: COLORES.control },
  { type: "mientras", message0: "mientras %1", args0: [valor("COND", "Boolean")], message1: "hacer %1", args1: [cuerpo("CUERPO")],
    ...INSTRUCCION, colour: COLORES.control },
  { type: "para", message0: "para %1 desde %2 hasta %3 con paso %4", inputsInline: true, ...INSTRUCCION, colour: COLORES.control,
    args0: [variable("VAR", "i"), valor("DESDE"), valor("HASTA"), { type: "field_number", name: "PASO", value: 1, min: 1, precision: 1 }],
    message1: "hacer %1", args1: [cuerpo("CUERPO")], tooltip: "Repite contando desde un valor hasta otro, incluido." },
  { type: "para_cada", message0: "para cada %1 en %2", args0: [variable("VAR", "elemento"), valor("LISTA")],
    message1: "hacer %1", args1: [cuerpo("CUERPO")], ...INSTRUCCION, colour: COLORES.control },
  { type: "romper", message0: "salir del ciclo", ...INSTRUCCION, colour: COLORES.control },
  { type: "continuar", message0: "pasar a la siguiente vuelta", ...INSTRUCCION, colour: COLORES.control },

  // Funciones
  { type: "definir_funcion", message0: "función %1 que devuelve %2", args0: [texto("NOMBRE", "calcular"), lista("RETORNO", TIPOS_RETORNO)],
    message1: "parámetros %1", args1: [{ type: "input_statement", name: "PARAMETROS", check: "Parametro" }],
    message2: "%1", args2: [cuerpo("CUERPO")], colour: COLORES.funciones },
  { type: "parametro", message0: "parámetro %1 %2", args0: [lista("TIPO", TIPOS), variable("VAR", "a")],
    previousStatement: "Parametro", nextStatement: "Parametro", colour: COLORES.funciones },
  { type: "retornar", message0: "devolver %1", args0: [valor("VALOR")], ...INSTRUCCION, colour: COLORES.funciones },
  { type: "llamar_funcion", message0: "llamar %1 ( %2 %3 %4 )", args0: [texto("NOMBRE", "calcular"), ...args3],
    inputsInline: true, ...INSTRUCCION, colour: COLORES.funciones },
  { type: "llamar_funcion_valor", message0: "resultado de %1 ( %2 %3 %4 )", args0: [texto("NOMBRE", "calcular"), ...args3],
    inputsInline: true, output: null, colour: COLORES.funciones },

  // Arreglos (índices desde 0, como en los ocho lenguajes)
  { type: "crear_arreglo", message0: "arreglo de %1 con %2 %3 %4 %5 %6", inputsInline: true, output: "Array", colour: COLORES.arreglos,
    args0: [lista("TIPO", TIPOS_ELEMENTO), valor("E0"), valor("E1"), valor("E2"), valor("E3"), valor("E4")] },
  { type: "elemento_en", message0: "elemento %1 de %2", args0: [valor("INDICE", "Number"), valor("LISTA")],
    inputsInline: true, output: null, colour: COLORES.arreglos, tooltip: "La primera posición es 0." },
  { type: "asignar_elemento", message0: "en %1 posición %2 poner %3", args0: [valor("LISTA"), valor("INDICE", "Number"), valor("VALOR")],
    inputsInline: true, ...INSTRUCCION, colour: COLORES.arreglos },
  { type: "longitud", message0: "tamaño de %1", args0: [valor("LISTA")], output: "Number", colour: COLORES.arreglos },

  // Cadenas
  { type: "concatenar", message0: "unir %1 con %2", args0: [valor("A"), valor("B")], inputsInline: true, output: "String", colour: COLORES.cadenas },
  { type: "longitud_texto", message0: "longitud de %1", args0: [valor("TEXTO")], output: "Number", colour: COLORES.cadenas },
  { type: "subcadena", message0: "subcadena de %1 desde %2 hasta %3", args0: [valor("TEXTO"), valor("DESDE", "Number"), valor("HASTA", "Number")],
    inputsInline: true, output: "String", colour: COLORES.cadenas, tooltip: "Desde incluye la posición; hasta no la incluye." },
  { type: "mayusculas", message0: "%1 en mayúsculas", args0: [valor("TEXTO")], output: "String", colour: COLORES.cadenas },
  { type: "minusculas", message0: "%1 en minúsculas", args0: [valor("TEXTO")], output: "String", colour: COLORES.cadenas },

  // Programación orientada a objetos (no se ofrece en C)
  { type: "definir_clase", message0: "clase %1 hereda de %2", args0: [texto("NOMBRE", "Animal"), texto("PADRE", "")],
    message1: "%1", args1: [{ type: "input_statement", name: "MIEMBROS", check: "Miembro" }], colour: COLORES.poo,
    tooltip: "Deja vacío \"hereda de\" si la clase no extiende a otra." },
  { type: "atributo", message0: "atributo %1 %2", args0: [lista("TIPO", TIPOS), texto("NOMBRE", "nombre")], ...MIEMBRO, colour: COLORES.poo },
  { type: "constructor", message0: "constructor", message1: "parámetros %1", args1: [{ type: "input_statement", name: "PARAMETROS", check: "Parametro" }],
    message2: "%1", args2: [cuerpo("CUERPO")], ...MIEMBRO, colour: COLORES.poo },
  { type: "metodo", message0: "método %1 que devuelve %2", args0: [texto("NOMBRE", "hablar"), lista("RETORNO", TIPOS_RETORNO)],
    message1: "parámetros %1", args1: [{ type: "input_statement", name: "PARAMETROS", check: "Parametro" }],
    message2: "%1", args2: [cuerpo("CUERPO")], ...MIEMBRO, colour: COLORES.poo },
  { type: "crear_objeto", message0: "nuevo %1 ( %2 %3 %4 )", args0: [texto("CLASE", "Animal"), ...args3],
    inputsInline: true, output: "Objeto", colour: COLORES.poo },
  { type: "obtener_atributo", message0: "%1 . %2", args0: [valor("OBJETO"), texto("ATRIBUTO", "nombre")],
    inputsInline: true, output: null, colour: COLORES.poo },
  { type: "asignar_atributo", message0: "en %1 . %2 poner %3", args0: [valor("OBJETO"), texto("ATRIBUTO", "nombre"), valor("VALOR")],
    inputsInline: true, ...INSTRUCCION, colour: COLORES.poo },
  { type: "llamar_metodo", message0: "%1 . %2 ( %3 %4 %5 )", args0: [valor("OBJETO"), texto("METODO", "hablar"), ...args3],
    inputsInline: true, ...INSTRUCCION, colour: COLORES.poo },
  { type: "llamar_metodo_valor", message0: "resultado de %1 . %2 ( %3 %4 %5 )", args0: [valor("OBJETO"), texto("METODO", "hablar"), ...args3],
    inputsInline: true, output: null, colour: COLORES.poo },
  { type: "este", message0: "este objeto", output: "Objeto", colour: COLORES.poo },
];

export const TIPOS_BLOQUE = DEFINICIONES.map((d) => d.type);
export const LENGUAJES_CURSO = ["java", "kotlin", "csharp", "cpp", "c", "python", "javascript", "php"];
export const BLOQUES_POO = ["definir_clase", "atributo", "constructor", "metodo", "crear_objeto",
  "obtener_atributo", "asignar_atributo", "llamar_metodo", "llamar_metodo_valor", "este"];

export function registrarBloques(Blockly) {
  Blockly.common.defineBlocksWithJsonArray(DEFINICIONES);
}

// Toolbox completa; cada ejercicio la recortará a su lista de bloques permitidos (iteración 3).
const bloque = (type, extra = {}) => ({ kind: "block", type, ...extra });
const num = (n) => ({ shadow: { type: "numero", fields: { NUM: n } } });
const txt = (t) => ({ shadow: { type: "texto", fields: { TEXTO: t } } });

export const TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    { kind: "category", name: "Programa", colour: COLORES.programa, contents: [bloque("programa")] },
    { kind: "category", name: "Variables", colour: COLORES.variables, custom: "VARIABLES_BB" },
    { kind: "category", name: "Operadores", colour: COLORES.operadores, contents: [
      bloque("numero"),
      bloque("aritmetica", { inputs: { A: num(1), B: num(1) } }),
      bloque("comparacion", { inputs: { A: num(0), B: num(0) } }),
      bloque("booleano"), bloque("logica"), bloque("no"),
    ] },
    { kind: "category", name: "Salida", colour: COLORES.salida, contents: [bloque("imprimir", { inputs: { VALOR: txt("Hola") } })] },
    { kind: "category", name: "Control", colour: COLORES.control, contents: [
      bloque("si"), bloque("si_sino"), bloque("mientras"),
      bloque("para", { inputs: { DESDE: num(1), HASTA: num(10) } }),
      bloque("para_cada"), bloque("romper"), bloque("continuar"),
    ] },
    { kind: "category", name: "Funciones", colour: COLORES.funciones, contents: [
      bloque("definir_funcion"), bloque("parametro"), bloque("retornar"),
      bloque("llamar_funcion"), bloque("llamar_funcion_valor"),
    ] },
    { kind: "category", name: "Arreglos", colour: COLORES.arreglos, contents: [
      bloque("crear_arreglo", { inputs: { E0: num(1), E1: num(2), E2: num(3) } }),
      bloque("elemento_en", { inputs: { INDICE: num(0) } }),
      bloque("asignar_elemento", { inputs: { INDICE: num(0) } }),
      bloque("longitud"),
    ] },
    { kind: "category", name: "Cadenas", colour: COLORES.cadenas, contents: [
      bloque("texto"), bloque("concatenar", { inputs: { A: txt("Hola, "), B: txt("mundo") } }),
      bloque("longitud_texto"), bloque("subcadena", { inputs: { DESDE: num(0), HASTA: num(3) } }),
      bloque("mayusculas"), bloque("minusculas"),
    ] },
    { kind: "category", name: "Objetos", colour: COLORES.poo, contents: BLOQUES_POO.map((t) => bloque(t)) },
  ],
};

// Categoría dinámica de variables: botón para crear una y bloques para las existentes.
export function categoriaVariables(workspace) {
  const contenido = [{ kind: "button", text: "Crear variable", callbackkey: "crear-variable" }];
  const variables = workspace.getVariableMap().getAllVariables();
  if (variables.length) {
    const primera = { VAR: { id: variables[0].getId() } };
    contenido.push(
      bloque("declarar_variable", { fields: primera, inputs: { VALOR: num(0) } }),
      bloque("asignar", { fields: primera, inputs: { VALOR: num(0) } }),
      ...variables.map((v) => bloque("variable", { fields: { VAR: { id: v.getId() } } })),
    );
  } else {
    contenido.push(bloque("declarar_variable", { inputs: { VALOR: num(0) } }));
  }
  return contenido;
}
