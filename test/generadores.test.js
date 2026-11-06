// Pruebas de los generadores (RNF-MAN-01 y RNF-MAN-02). Ejecutar con: npm test
// Cada programa de referencia se genera en cada lenguaje, se ejecuta y su salida se compara con la esperada.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ejecutar, disponible } from "./ejecutar.js";
import * as Blockly from "blockly";
import { registrarBloques, TIPOS_BLOQUE } from "../js/bloques/definiciones.js";
import { generarCodigo } from "../js/bloques/generador.js";
import { LENGUAJES } from "../js/bloques/lenguajes.js";
import { B, V, seq, num, txt, vr, arit, comp, imprimir, declarar, asignar, programa, unir, este, workspace } from "../scripts/constructores.js";

registrarBloques(Blockly);

const REFERENCIAS = {
  variables: {
    bloques: [programa(declarar("entero", "edad", num(20)), asignar("edad", arit(vr("edad"), "SUMA", num(1))), imprimir(vr("edad")))],
    salida: "21",
  },
  operadores: {
    bloques: [programa(
      imprimir(arit(num(7), "MOD", num(3))),
      imprimir(arit(arit(num(2), "SUMA", num(3)), "MULT", num(4))),
      imprimir(arit(num(10), "RESTA", arit(num(4), "RESTA", num(1)))),
      B("si", { inputs: { COND: B("logica", { fields: { OP: "Y" }, inputs: {
        A: B("no", { inputs: { VALOR: B("booleano", { fields: { VALOR: "FALSO" } }) } }),
        B: comp(num(3), "MENOR_IGUAL", num(3)) } }), ENTONCES: imprimir(txt("ok")) } }),
    )],
    salida: "1\n20\n7\nok",
  },
  salida: {
    bloques: [programa(imprimir(txt("Hola, mundo")), imprimir(txt('Comillas "dobles" y acentos: año')))],
    salida: 'Hola, mundo\nComillas "dobles" y acentos: año',
  },
  condicionales: {
    bloques: [programa(
      declarar("entero", "nota", num(75)),
      B("si_sino", { inputs: {
        COND: comp(vr("nota"), "MAYOR_IGUAL", num(90)), ENTONCES: imprimir(txt("A")),
        SINO: B("si_sino", { inputs: {
          COND: comp(vr("nota"), "MAYOR_IGUAL", num(70)), ENTONCES: imprimir(txt("B")), SINO: imprimir(txt("C")) } }) } }),
    )],
    salida: "B",
  },
  ciclos: {
    bloques: [programa(
      B("para", { fields: { ...V("i"), PASO: 2 }, inputs: { DESDE: num(1), HASTA: num(5), CUERPO: imprimir(vr("i")) } }),
      declarar("entero", "n", num(3)),
      B("mientras", { inputs: { COND: comp(vr("n"), "MAYOR", num(0)), CUERPO: seq(
        imprimir(vr("n")),
        asignar("n", arit(vr("n"), "RESTA", num(1))),
        B("si", { inputs: { COND: comp(vr("n"), "IGUAL", num(1)), ENTONCES: B("romper") } }),
      ) } }),
    )],
    salida: "1\n3\n5\n3\n2",
  },
  funciones: {
    bloques: [
      B("definir_funcion", { fields: { NOMBRE: "cuadrado", RETORNO: "entero" }, inputs: {
        PARAMETROS: B("parametro", { fields: { TIPO: "entero", ...V("x") } }),
        CUERPO: B("retornar", { inputs: { VALOR: arit(vr("x"), "MULT", vr("x")) } }) } }),
      programa(imprimir(B("llamar_funcion_valor", { fields: { NOMBRE: "cuadrado" }, inputs: { ARG0: num(4) } }))),
    ],
    salida: "16",
  },
  arreglos: {
    bloques: [programa(
      declarar("arreglo", "datos", B("crear_arreglo", { fields: { TIPO: "entero" }, inputs: { E0: num(3), E1: num(1), E2: num(4) } })),
      B("asignar_elemento", { inputs: { LISTA: vr("datos"), INDICE: num(1), VALOR: num(9) } }),
      B("para_cada", { fields: V("d"), inputs: { LISTA: vr("datos"), CUERPO: imprimir(vr("d")) } }),
      imprimir(B("elemento_en", { inputs: { INDICE: num(0), LISTA: vr("datos") } })),
      imprimir(B("longitud", { inputs: { LISTA: vr("datos") } })),
    )],
    salida: "3\n9\n4\n3\n3",
  },
  cadenas: {
    bloques: [programa(
      declarar("texto", "s", txt("Bloques")),
      imprimir(B("mayusculas", { inputs: { TEXTO: vr("s") } })),
      imprimir(B("subcadena", { inputs: { TEXTO: vr("s"), DESDE: num(0), HASTA: num(3) } })),
      imprimir(unir(txt("Letras: "), B("longitud_texto", { inputs: { TEXTO: vr("s") } }))),
    )],
    salida: "BLOQUES\nBlo\nLetras: 7",
  },
  textos: {
    bloques: [programa(
      declarar("texto", "a", txt("hola")),
      B("si", { inputs: { COND: comp(vr("a"), "IGUAL", txt("hola")), ENTONCES: imprimir(txt("iguales")) } }),
      B("si", { inputs: { COND: comp(vr("a"), "DISTINTO", txt("adiós")), ENTONCES: imprimir(unir(txt("100"), txt("%"))) } }),
    )],
    salida: "iguales\n100%",
  },
  poo: {
    bloques: [
      B("definir_clase", { fields: { NOMBRE: "Animal", PADRE: "" }, inputs: { MIEMBROS: seq(
        B("atributo", { fields: { TIPO: "texto", NOMBRE: "nombre" } }),
        B("constructor", { inputs: {
          PARAMETROS: B("parametro", { fields: { TIPO: "texto", ...V("n") } }),
          CUERPO: B("asignar_atributo", { fields: { ATRIBUTO: "nombre" }, inputs: { OBJETO: B("este"), VALOR: vr("n") } }) } }),
        B("metodo", { fields: { NOMBRE: "hablar", RETORNO: "nada" }, inputs: {
          CUERPO: imprimir(unir(este("nombre"), txt(" hace un sonido"))) } }),
      ) } }),
      B("definir_clase", { fields: { NOMBRE: "Perro", PADRE: "Animal" }, inputs: { MIEMBROS:
        B("metodo", { fields: { NOMBRE: "hablar", RETORNO: "nada" }, inputs: { CUERPO: imprimir(unir(este("nombre"), txt(" ladra"))) } }),
      } }),
      programa(
        declarar("objeto", "p", B("crear_objeto", { fields: { CLASE: "Perro" }, inputs: { ARG0: txt("Fido") } })),
        B("llamar_metodo", { fields: { METODO: "hablar" }, inputs: { OBJETO: vr("p") } }),
        B("llamar_metodo", { fields: { METODO: "hablar" }, inputs: {
          OBJETO: B("crear_objeto", { fields: { CLASE: "Animal" }, inputs: { ARG0: txt("Michi") } }) } }),
      ),
    ],
    salida: "Fido ladra\nMichi hace un sonido",
  },
};

function generar(lenguaje, bloques) {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(workspace(...bloques), ws);
  const codigo = generarCodigo(LENGUAJES[lenguaje].crear(Blockly), ws);
  ws.dispose();
  return codigo;
}

test("cada bloque del catálogo tiene función en cada generador", () => {
  for (const [lenguaje, { crear }] of Object.entries(LENGUAJES)) {
    const faltan = TIPOS_BLOQUE.filter((t) => typeof crear(Blockly).forBlock[t] !== "function");
    assert.deepEqual(faltan, [], `${lenguaje} no genera: ${faltan.join(", ")}`);
  }
});

for (const lenguaje of Object.keys(LENGUAJES)) {
  for (const [tema, { bloques, salida }] of Object.entries(REFERENCIAS)) {
    // RN-10: la POO no se ofrece en C.
    const omitir = !disponible(lenguaje) ? "compilador no instalado" : lenguaje === "c" && tema === "poo" ? "C no tiene clases" : false;
    test(`${lenguaje}: el programa de ${tema} se ejecuta y produce la salida esperada`, { skip: omitir }, async () => {
      const codigo = generar(lenguaje, bloques);
      const r = await ejecutar(lenguaje, codigo);
      assert.equal(r.status, 0, `falló la ejecución:\n${codigo}\n${r.stderr}`);
      assert.equal(r.stdout.trimEnd(), salida, `código generado:\n${codigo}`);
    });
  }
}


// Formato exacto de los lenguajes que pueden no tener compilador en la máquina de pruebas (revisado a mano).
const FORMATO = {
  "kotlin/condicionales": "fun main() {\n    val nota: Int = 75\n    if (nota >= 90) {\n        println(\"A\")\n    } else if (nota >= 70) {\n        println(\"B\")\n    } else {\n        println(\"C\")\n    }\n}\n",
  "kotlin/ciclos": "fun main() {\n    for (i in 1..5 step 2) {\n        println(i)\n    }\n    var n: Int = 3\n    while (n > 0) {\n        println(n)\n        n = n - 1\n        if (n == 1) {\n            break\n        }\n    }\n}\n",
  "kotlin/poo": "open class Animal {\n    var nombre: String = \"\"\n\n    constructor(n: String) {\n        this.nombre = n\n    }\n\n    open fun hablar() {\n        println(this.nombre + \" hace un sonido\")\n    }\n}\n\nclass Perro : Animal {\n    constructor(n: String) : super(n)\n\n    override fun hablar() {\n        println(this.nombre + \" ladra\")\n    }\n}\n\nfun main() {\n    val p = Perro(\"Fido\")\n    p.hablar()\n    Animal(\"Michi\").hablar()\n}\n",
  "csharp/condicionales": "using System;\n\nclass Program {\n    static void Main() {\n        int nota = 75;\n        if (nota >= 90) {\n            Console.WriteLine(\"A\");\n        } else if (nota >= 70) {\n            Console.WriteLine(\"B\");\n        } else {\n            Console.WriteLine(\"C\");\n        }\n    }\n}\n",
  "csharp/ciclos": "using System;\n\nclass Program {\n    static void Main() {\n        for (int i = 1; i <= 5; i += 2) {\n            Console.WriteLine(i);\n        }\n        int n = 3;\n        while (n > 0) {\n            Console.WriteLine(n);\n            n = n - 1;\n            if (n == 1) {\n                break;\n            }\n        }\n    }\n}\n",
  "csharp/poo": "using System;\n\nclass Animal {\n    public string nombre;\n\n    public Animal(string n) {\n        this.nombre = n;\n    }\n\n    public virtual void hablar() {\n        Console.WriteLine(this.nombre + \" hace un sonido\");\n    }\n}\n\nclass Perro : Animal {\n    public Perro(string n) : base(n) {\n    }\n\n    public override void hablar() {\n        Console.WriteLine(this.nombre + \" ladra\");\n    }\n}\n\nclass Program {\n    static void Main() {\n        var p = new Perro(\"Fido\");\n        p.hablar();\n        new Animal(\"Michi\").hablar();\n    }\n}\n",
  "php/condicionales": "<?php\n\n$nota = 75;\nif ($nota >= 90) {\n    echo \"A\" . PHP_EOL;\n} else if ($nota >= 70) {\n    echo \"B\" . PHP_EOL;\n} else {\n    echo \"C\" . PHP_EOL;\n}\n",
  "php/ciclos": "<?php\n\nfor ($i = 1; $i <= 5; $i += 2) {\n    echo $i . PHP_EOL;\n}\n$n = 3;\nwhile ($n > 0) {\n    echo $n . PHP_EOL;\n    $n = $n - 1;\n    if ($n == 1) {\n        break;\n    }\n}\n",
  "php/poo": "<?php\n\nclass Animal {\n    public $nombre;\n\n    public function __construct($n) {\n        $this->nombre = $n;\n    }\n\n    public function hablar() {\n        echo ($this->nombre . \" hace un sonido\") . PHP_EOL;\n    }\n}\n\nclass Perro extends Animal {\n    public function hablar() {\n        echo ($this->nombre . \" ladra\") . PHP_EOL;\n    }\n}\n\n$p = new Perro(\"Fido\");\n$p->hablar();\n(new Animal(\"Michi\"))->hablar();\n",
};

for (const [clave, esperado] of Object.entries(FORMATO)) {
  const [lenguaje, tema] = clave.split("/");
  test(`${lenguaje}: formato exacto del programa de ${tema}`, () => {
    assert.equal(generar(lenguaje, REFERENCIAS[tema].bloques), esperado);
  });
}

// Ejecutar no basta: con literales iguales, == también "funciona" en Java y C por el interning de cadenas.
test("java y c comparan el contenido de las cadenas, no la referencia", () => {
  assert.match(generar("java", REFERENCIAS.textos.bloques), /a\.equals\("hola"\)/);
  assert.match(generar("java", REFERENCIAS.textos.bloques), /!a\.equals\("adiós"\)/);
  assert.match(generar("c", REFERENCIAS.textos.bloques), /strcmp\(a, "hola"\) == 0/);
});

test("c imprime con un solo printf y escapa el signo %", () => {
  assert.match(generar("c", REFERENCIAS.textos.bloques), /printf\("100%%\\n"\);/);
  assert.match(generar("c", REFERENCIAS.cadenas.bloques), /printf\("Letras: %d\\n", \(int\)strlen\(s\)\);/);
});

test("c no genera clases: avisa en un comentario", () => {
  assert.match(generar("c", REFERENCIAS.poo.bloques), /C no tiene clases/);
});

test("python: formato exacto de condicionales encadenados", () => {
  assert.equal(generar("python", REFERENCIAS.condicionales.bloques),
    'nota = 75\nif nota >= 90:\n    print("A")\nelif nota >= 70:\n    print("B")\nelse:\n    print("C")\n');
});

test("javascript: formato exacto de condicionales encadenados", () => {
  assert.equal(generar("javascript", REFERENCIAS.condicionales.bloques),
    'let nota = 75;\nif (nota >= 90) {\n  console.log("A");\n} else if (nota >= 70) {\n  console.log("B");\n} else {\n  console.log("C");\n}\n');
});

test("los nombres se convierten en identificadores válidos", () => {
  const py = LENGUAJES.python.crear(Blockly);
  const js = LENGUAJES.javascript.crear(Blockly);
  assert.equal(py.identificador("año escolar"), "ano_escolar");
  assert.equal(py.identificador("2do lugar"), "_2do_lugar");
  assert.equal(py.identificador("class"), "class_");
  assert.equal(py.identificador("str"), "str_");
  assert.equal(js.identificador("new"), "new_");
});

test("los bloques sueltos fuera de programa, funciones y clases se ignoran", () => {
  assert.equal(generar("python", [programa(imprimir(num(1))), imprimir(num(2))]), "print(1)\n");
});
