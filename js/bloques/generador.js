// Base común de los generadores: nombres válidos, valores por defecto y ensamblado del programa.

export function crearGenerador(Blockly, nombre, { reservadas, sangria = "    " }) {
  const g = new Blockly.CodeGenerator(nombre);
  const prohibidas = new Set(reservadas);
  g.INDENT = sangria;

  // Encadena el bloque siguiente; las definiciones de primer nivel no tienen siguiente.
  g.scrub_ = (bloque, codigo, soloEste) => {
    const siguiente = bloque.nextConnection?.targetBlock();
    return codigo + (siguiente && !soloEste ? g.blockToCode(siguiente) : "");
  };

  // "año escolar" -> "ano_escolar"; palabras reservadas reciben "_" al final.
  g.identificador = (texto) => {
    let id = String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/[^A-Za-z0-9_]/g, "_");
    if (!id || /^\d/.test(id)) id = `_${id}`;
    return prohibidas.has(id) ? `${id}_` : id;
  };
  g.variable = (bloque, campo = "VAR") => g.identificador(bloque.getField(campo).getVariable().getName());
  g.campo = (bloque, campo) => g.identificador(bloque.getFieldValue(campo));
  g.valor = (bloque, entrada, orden, porDefecto) => g.valueToCode(bloque, entrada, orden) || porDefecto;
  g.argumentos = (bloque, orden) => ["ARG0", "ARG1", "ARG2"].map((n) => g.valueToCode(bloque, n, orden)).filter(Boolean).join(", ");
  g.parametros = (bloque) => hijos(bloque, "PARAMETROS").map((p) => ({ nombre: g.variable(p), tipo: p.getFieldValue("TIPO") }));
  g.sangrar = (codigo) => g.prefixLines(codigo, g.INDENT).replace(/^[ \t]+$/gm, "");

  // Atributos seguidos; una línea en blanco antes de cada constructor o método.
  g.miembros = (bloque) => hijos(bloque, "MIEMBROS")
    .map((m, i) => (i && m.type !== "atributo" ? "\n" : "") + g.blockToCode(m, true)).join("");

  // El cuerpo de "programa" sale sin sangría; cada lenguaje la agrega al ensamblar si la necesita.
  g.forBlock.programa = (bloque) => {
    const primero = bloque.getInputTargetBlock("CUERPO");
    return primero ? g.blockToCode(primero) : "";
  };

  // Bloques que solo cobran sentido dentro de otro (los procesa su padre).
  g.forBlock.parametro = () => "";

  // Tipo de dato de una expresión, deducido de las declaraciones del programa (null si no se sabe).
  g.tipoDe = (b) => {
    if (!b) return null;
    const info = g.info;
    switch (b.type) {
      case "numero": return Number.isInteger(Number(b.getFieldValue("NUM"))) ? "entero" : "decimal";
      case "texto": case "concatenar": case "subcadena": case "mayusculas": case "minusculas": return "texto";
      case "booleano": case "comparacion": case "logica": case "no": return "booleano";
      case "longitud": case "longitud_texto": return "entero";
      case "aritmetica": {
        const tipos = ["A", "B"].map((e) => g.tipoDe(b.getInputTargetBlock(e)));
        return tipos.includes("decimal") ? "decimal" : "entero";
      }
      case "variable": return info.variables.get(idVariable(b)) ?? null;
      case "elemento_en": return tipoElemento(info, b.getInputTargetBlock("LISTA"));
      case "llamar_funcion_valor": return sinNada(info.funciones.get(b.getFieldValue("NOMBRE")));
      case "llamar_metodo_valor": return sinNada(info.metodos.get(b.getFieldValue("METODO")));
      case "obtener_atributo": return info.atributos.get(b.getFieldValue("ATRIBUTO")) ?? null;
      case "crear_arreglo": return "arreglo";
      case "crear_objeto": case "este": return "objeto";
      default: return null;
    }
  };
  g.tipoEntrada = (b, entrada) => g.tipoDe(b.getInputTargetBlock(entrada));
  g.tipoElemento = (lista) => tipoElemento(g.info, lista);

  // Herencia, para open/virtual/override y para reenviar constructores, que no se heredan en los lenguajes tipados.
  const clase = (nombre) => g.info.clases.get(nombre);
  g.claseDe = (miembro) => miembro.getSurroundParent()?.getFieldValue("NOMBRE");
  g.tieneHijas = (nombre) => [...g.info.clases.values()].some((c) => c.padre === nombre);
  g.sobrescribe = (nombre, metodo) => {
    for (let p = clase(nombre)?.padre, vueltas = 0; p && vueltas < 20; p = clase(p)?.padre, vueltas++) {
      if (clase(p)?.metodos.has(metodo)) return true;
    }
    return false;
  };
  g.esSobrescrito = (nombre, metodo, vueltas = 0) => vueltas < 20 && [...g.info.clases].some(([hija, c]) =>
    c.padre === nombre && (c.metodos.has(metodo) || g.esSobrescrito(hija, metodo, vueltas + 1)));
  g.constructorHeredado = (nombre) => {
    if (clase(nombre)?.constructorBloque) return null;
    for (let p = clase(nombre)?.padre, vueltas = 0; p && vueltas < 20; p = clase(p)?.padre, vueltas++) {
      if (clase(p)?.constructorBloque) return clase(p).constructorBloque;
    }
    return null;
  };

  // Código auxiliar (funciones de apoyo, includes) que algunos lenguajes agregan al principio.
  g.requerir = (nombre, codigo) => g.extras.set(nombre, codigo);
  g.incluir = (cabecera) => g.cabeceras.add(cabecera);

  return g;
}

const idVariable = (b) => b.getField("VAR")?.getVariable()?.getId();
const sinNada = (tipo) => (tipo && tipo !== "nada" ? tipo : null);
function tipoElemento(info, lista) {
  if (lista?.type === "crear_arreglo") return lista.getFieldValue("TIPO");
  if (lista?.type === "variable") return info.elementos.get(idVariable(lista)) ?? null;
  return null;
}

// Tipos de variables, funciones, métodos, atributos y clases del programa.
export function analizar(workspace) {
  const info = { variables: new Map(), elementos: new Map(), funciones: new Map(), metodos: new Map(),
    atributos: new Map(), clases: new Map(), asignadas: new Set() };
  const bloques = workspace.getAllBlocks(false);
  for (const b of bloques) {
    if (b.type === "declarar_variable" || b.type === "parametro") {
      const id = idVariable(b);
      if (!info.variables.has(id)) info.variables.set(id, b.getFieldValue("TIPO"));
      const valor = b.getInputTargetBlock?.("VALOR");
      if (valor?.type === "crear_arreglo") info.elementos.set(id, valor.getFieldValue("TIPO"));
    } else if (b.type === "asignar") {
      info.asignadas.add(idVariable(b));
    } else if (b.type === "para") {
      info.variables.set(idVariable(b), "entero");
      info.asignadas.add(idVariable(b));
    } else if (b.type === "definir_funcion") {
      info.funciones.set(b.getFieldValue("NOMBRE"), b.getFieldValue("RETORNO"));
    } else if (b.type === "metodo") {
      info.metodos.set(b.getFieldValue("NOMBRE"), b.getFieldValue("RETORNO"));
    } else if (b.type === "atributo") {
      info.atributos.set(b.getFieldValue("NOMBRE"), b.getFieldValue("TIPO"));
    } else if (b.type === "definir_clase") {
      const miembros = hijos(b, "MIEMBROS");
      info.clases.set(b.getFieldValue("NOMBRE"), {
        padre: b.getFieldValue("PADRE").trim() || null,
        metodos: new Set(miembros.filter((m) => m.type === "metodo").map((m) => m.getFieldValue("NOMBRE"))),
        constructorBloque: miembros.find((m) => m.type === "constructor") ?? null,
      });
    }
  }
  // Segunda pasada: el elemento de "para cada" toma el tipo de los elementos de su arreglo.
  for (const b of bloques.filter((x) => x.type === "para_cada")) {
    const tipo = tipoElemento(info, b.getInputTargetBlock("LISTA"));
    if (tipo) info.variables.set(idVariable(b), tipo);
  }
  return info;
}

export function hijos(bloque, entrada) {
  const lista = [];
  for (let b = bloque.getInputTargetBlock(entrada); b; b = b.getNextBlock()) lista.push(b);
  return lista;
}

// Bloques de texto: no necesitan conversión al concatenarse.
export const devuelveTexto = (bloque, entrada) =>
  ["texto", "concatenar", "subcadena", "mayusculas", "minusculas"].includes(bloque.getInputTargetBlock(entrada)?.type);

// "si no" que contiene un único bloque "si": se escribe como elif / else if.
export function sinoEncadenado(bloque) {
  const unico = bloque.getInputTargetBlock("SINO");
  return unico && ["si", "si_sino"].includes(unico.type) && !unico.getNextBlock() ? unico : null;
}

// Clases, luego funciones, luego el cuerpo del primer bloque "programa". Los bloques sueltos se ignoran.
export function generarCodigo(g, workspace) {
  g.init(workspace);
  g.info = analizar(workspace);
  g.extras = new Map();
  g.cabeceras = new Set();
  const arriba = workspace.getTopBlocks(true);
  const de = (tipo) => arriba.filter((b) => b.type === tipo).map((b) => g.blockToCode(b));
  const programa = arriba.find((b) => b.type === "programa");
  return g.ensamblar({
    clases: de("definir_clase"),
    funciones: de("definir_funcion"),
    programa: programa ? g.blockToCode(programa) : "",
  });
}
