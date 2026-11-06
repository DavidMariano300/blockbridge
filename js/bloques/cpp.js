import { crearGenerador } from "./generador.js";
import { sintaxisLlaves } from "./llaves.js";

const RESERVADAS = ["alignas", "alignof", "and", "asm", "auto", "bool", "break", "case", "catch", "char", "class", "const",
  "constexpr", "continue", "decltype", "default", "delete", "do", "double", "else", "enum", "explicit", "export", "extern",
  "false", "float", "for", "friend", "goto", "if", "inline", "int", "long", "mutable", "namespace", "new", "noexcept", "not",
  "nullptr", "operator", "or", "private", "protected", "public", "register", "return", "short", "signed", "sizeof", "static",
  "struct", "switch", "template", "this", "throw", "true", "try", "typedef", "typeid", "typename", "union", "unsigned",
  "using", "virtual", "void", "volatile", "while", "xor", "std", "main", "mayusculas", "minusculas"];

const TIPO = { entero: "int", decimal: "double", texto: "std::string", booleano: "bool", arreglo: "std::vector<int>", objeto: "auto" };
const INICIAL = { entero: "0", decimal: "0.0", texto: '""', booleano: "false" };

const AUXILIARES = {
  mayusculas: "std::string mayusculas(std::string texto) {\n    for (auto &c : texto) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));\n    return texto;\n}\n",
  minusculas: "std::string minusculas(std::string texto) {\n    for (auto &c : texto) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));\n    return texto;\n}\n",
};

export function generadorCpp(Blockly) {
  const g = crearGenerador(Blockly, "C++", { reservadas: RESERVADAS });
  g.este = "this";
  g.flecha = (b) => (b.getInputTargetBlock("OBJETO")?.type === "este" || !b.getInputTargetBlock("OBJETO") ? "->" : ".");
  const O = sintaxisLlaves(g, { nulo: "{}" });
  const f = g.forBlock;
  const tipoC = (t) => (t === "arreglo" ? "std::vector<int>" : TIPO[t]);
  const parametros = (b) => g.parametros(b).map((p) => `${tipoC(p.tipo)} ${p.nombre}`).join(", ");
  const retorno = (t) => (t === "nada" ? "void" : tipoC(t));
  // Un literal "abc" es const char*: para usar métodos de std::string hay que convertirlo.
  const comoString = (b, entrada) => {
    const v = g.valor(b, entrada, O.MIEMBRO, 'std::string("")');
    return b.getInputTargetBlock(entrada)?.type === "texto" ? `std::string(${v})` : v;
  };

  g.ensamblar = ({ clases, funciones, programa }) => {
    const cabeceras = ["<iostream>", "<string>", ...g.cabeceras].map((c) => `#include ${c}`).join("\n");
    const main = `int main() {\n${g.sangrar(`${programa}return 0;\n`)}}\n`;
    return [`${cabeceras}\n`, ...g.extras.values(), ...clases, ...funciones, main].join("\n");
  };

  f.declarar_variable = (b) => {
    const tipo = b.getFieldValue("TIPO");
    const nombre = g.variable(b);
    const valor = b.getInputTargetBlock("VALOR");
    if (tipo === "arreglo") {
      g.incluir("<vector>");
      if (valor?.type === "crear_arreglo") return `std::vector<${TIPO[valor.getFieldValue("TIPO")]}> ${nombre} = {${g.elementos(valor).join(", ")}};\n`;
    }
    const codigo = g.valueToCode(b, "VALOR", O.NINGUNO);
    if (tipo === "arreglo" || tipo === "objeto") return codigo ? `auto ${nombre} = ${codigo};\n` : `${tipo === "arreglo" ? "std::vector<int>" : "void *"} ${nombre}${tipo === "objeto" ? " = nullptr" : ""};\n`;
    return `${TIPO[tipo]} ${nombre} = ${codigo || INICIAL[tipo]};\n`;
  };
  f.imprimir = (b) => `std::cout << ${g.valor(b, "VALOR", O.DESPLAZAMIENTO, '""')} << std::endl;\n`;
  f.para = (b) => g.paraClasico(b, "int ");
  f.para_cada = (b) => `for (auto ${g.variable(b)} : ${g.valor(b, "LISTA", O.NINGUNO, "std::vector<int>{}")}) {\n${g.bloque(b, "CUERPO")}}\n`;

  f.definir_funcion = (b) => `${retorno(b.getFieldValue("RETORNO"))} ${g.campo(b, "NOMBRE")}(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;

  f.crear_arreglo = (b) => {
    g.incluir("<vector>");
    return [`std::vector<${TIPO[b.getFieldValue("TIPO")]}>{${g.elementos(b).join(", ")}}`, O.LLAMADA];
  };
  f.longitud = (b) => [`${g.valor(b, "LISTA", O.MIEMBRO, "std::vector<int>{}")}.size()`, O.LLAMADA];

  // std::string + número no compila: los números pasan por std::to_string.
  f.concatenar = (b) => {
    const lado = (entrada, primero) => {
      if (g.tipoEntrada(b, entrada) !== "texto") return `std::to_string(${g.valor(b, entrada, O.NINGUNO, "0")})`;
      return primero ? comoString(b, entrada) : g.valor(b, entrada, O.ADITIVO, '""');
    };
    return [`${lado("A", true)} + ${lado("B", false)}`, O.ADITIVO];
  };
  f.longitud_texto = (b) => [`${comoString(b, "TEXTO")}.length()`, O.LLAMADA];
  f.subcadena = (b) => {
    return [`${comoString(b, "TEXTO")}.substr(${g.valor(b, "DESDE", O.NINGUNO, "0")}, ${g.largoSubcadena(b)})`, O.LLAMADA];
  };
  for (const nombre of ["mayusculas", "minusculas"]) {
    f[nombre] = (b) => {
      g.incluir("<cctype>");
      g.requerir(nombre, AUXILIARES[nombre]);
      return [`${nombre}(${g.valor(b, "TEXTO", O.NINGUNO, '""')})`, O.LLAMADA];
    };
  }

  f.definir_clase = (b) => {
    const nombre = b.getFieldValue("NOMBRE");
    const padre = b.getFieldValue("PADRE").trim();
    // Los constructores no se heredan; using Padre::Padre los toma del padre.
    const reenvio = padre && g.constructorHeredado(nombre) ? `using ${g.identificador(padre)}::${g.identificador(padre)};\n` : "";
    const miembros = [reenvio, g.miembros(b)].filter(Boolean).join("\n");
    return `class ${g.identificador(nombre)}${padre ? ` : public ${g.identificador(padre)}` : ""} {\npublic:\n${g.sangrar(miembros)}};\n`;
  };
  f.atributo = (b) => `${tipoC(b.getFieldValue("TIPO"))} ${g.campo(b, "NOMBRE")}{};\n`;
  f.constructor = (b) => `${g.identificador(g.claseDe(b))}(${parametros(b)}) {\n${g.bloque(b, "CUERPO")}}\n`;
  f.metodo = (b) => {
    const clase = g.claseDe(b);
    const nombre = b.getFieldValue("NOMBRE");
    const cabecera = `${retorno(b.getFieldValue("RETORNO"))} ${g.campo(b, "NOMBRE")}(${parametros(b)})`;
    if (g.sobrescribe(clase, nombre)) return `${cabecera} override {\n${g.bloque(b, "CUERPO")}}\n`;
    return `${g.esSobrescrito(clase, nombre) ? "virtual " : ""}${cabecera} {\n${g.bloque(b, "CUERPO")}}\n`;
  };
  f.crear_objeto = (b) => [`${g.campo(b, "CLASE")}(${g.argumentos(b, O.NINGUNO)})`, O.LLAMADA];

  return g;
}
