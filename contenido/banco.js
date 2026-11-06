// Banco precargado (CU-16, RF-36): 27 ejercicios, 3 por tema y uno por dificultad, y un quiz por tema.
// Se carga con: npm run seed. Los nombres de variable son libres: la comparación los renombra (Anexo B).
import { B, V, seq, num, txt, vr, arit, comp, imprimir, declarar, asignar, programa, unir, workspace }
  from "../scripts/constructores.js";

const si = (cond, entonces) => B("si", { inputs: { COND: cond, ENTONCES: entonces } });
const siSino = (cond, entonces, sino) => B("si_sino", { inputs: { COND: cond, ENTONCES: entonces, SINO: sino } });
const mientras = (cond, ...cuerpo) => B("mientras", { inputs: { COND: cond, CUERPO: seq(...cuerpo) } });
const para = (v, desde, hasta, ...cuerpo) => B("para", { fields: { ...V(v), PASO: 1 }, inputs: { DESDE: num(desde), HASTA: num(hasta), CUERPO: seq(...cuerpo) } });
const paraCada = (v, lista, ...cuerpo) => B("para_cada", { fields: V(v), inputs: { LISTA: lista, CUERPO: seq(...cuerpo) } });
const arreglo = (tipo, ...valores) => B("crear_arreglo", { fields: { TIPO: tipo }, inputs: Object.fromEntries(valores.map((v, i) => [`E${i}`, v])) });
const elemento = (indice, lista) => B("elemento_en", { inputs: { INDICE: num(indice), LISTA: lista } });
const funcion = (nombre, retorno, parametros, ...cuerpo) => B("definir_funcion", {
  fields: { NOMBRE: nombre, RETORNO: retorno },
  inputs: { PARAMETROS: parametros.length ? seq(...parametros) : null, CUERPO: seq(...cuerpo) },
});
const parametro = (tipo, v) => B("parametro", { fields: { TIPO: tipo, ...V(v) } });
const retornar = (v) => B("retornar", { inputs: { VALOR: v } });
const resultado = (nombre, ...args) => B("llamar_funcion_valor", { fields: { NOMBRE: nombre }, inputs: Object.fromEntries(args.map((a, i) => [`ARG${i}`, a])) });
const texto = (tipo, valor) => B(tipo, { inputs: { TEXTO: valor } });
const clase = (nombre, padre, ...miembros) => B("definir_clase", { fields: { NOMBRE: nombre, PADRE: padre }, inputs: { MIEMBROS: miembros.length ? seq(...miembros) : null } });
const metodo = (nombre, ...cuerpo) => B("metodo", { fields: { NOMBRE: nombre, RETORNO: "nada" }, inputs: { CUERPO: seq(...cuerpo) } });
const nuevo = (nombre, ...args) => B("crear_objeto", { fields: { CLASE: nombre }, inputs: Object.fromEntries(args.map((a, i) => [`ARG${i}`, a])) });
const llamarMetodo = (objeto, nombre) => B("llamar_metodo", { fields: { METODO: nombre }, inputs: { OBJETO: objeto } });
const atributo = (objeto, nombre) => B("obtener_atributo", { fields: { ATRIBUTO: nombre }, inputs: { OBJETO: objeto } });

const vacio = () => workspace(programa());
const VARIABLES = ["declarar_variable", "variable"];

export const EJERCICIOS = [
  // Variables
  {
    id: "variables-edad", tema: "variables", dificultad: "basico",
    titulo: "Guarda una edad",
    enunciado: "Declara una variable entera con el valor 18 y después imprímela.",
    toolbox: [...VARIABLES, "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(declarar("entero", "edad", num(18)), imprimir(vr("edad"))))],
    pistas: ["El bloque declarar está en la categoría Variables; elige el tipo entero.", "Para imprimir la variable usa el bloque con su nombre, no un número."],
    explicacion: "Declarar una variable reserva un lugar con nombre para un dato. Al imprimir la variable se muestra el valor que guarda, no su nombre.",
  },
  {
    id: "variables-cumpleanos", tema: "variables", dificultad: "intermedio",
    titulo: "Un año más",
    enunciado: "Declara una variable entera con el valor 17. Después asígnale su propio valor más 1 e imprímela.",
    toolbox: [...VARIABLES, "asignar", "aritmetica", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [
      workspace(programa(declarar("entero", "edad", num(17)), asignar("edad", arit(vr("edad"), "SUMA", num(1))), imprimir(vr("edad")))),
      workspace(programa(declarar("entero", "edad", num(17)), asignar("edad", arit(num(1), "SUMA", vr("edad"))), imprimir(vr("edad")))),
    ],
    pistas: ["Usa el bloque asignar para cambiar el valor de una variable que ya existe.", "El nuevo valor es una suma: la misma variable + 1."],
    explicacion: "Una asignación primero calcula el lado derecho con el valor actual y después lo guarda. Por eso edad = edad + 1 no es una contradicción: es la forma de aumentar un valor en uno.",
  },
  {
    id: "variables-intercambio", tema: "variables", dificultad: "avanzado",
    titulo: "Intercambia dos valores",
    enunciado: "Declara una variable entera con 5 y otra con 9. Intercambia sus valores usando una tercera variable entera auxiliar y después imprime la primera y luego la segunda.",
    toolbox: [...VARIABLES, "asignar", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [
      workspace(programa(declarar("entero", "a", num(5)), declarar("entero", "b", num(9)), declarar("entero", "aux", vr("a")),
        asignar("a", vr("b")), asignar("b", vr("aux")), imprimir(vr("a")), imprimir(vr("b")))),
      workspace(programa(declarar("entero", "a", num(5)), declarar("entero", "b", num(9)), declarar("entero", "aux", vr("b")),
        asignar("b", vr("a")), asignar("a", vr("aux")), imprimir(vr("a")), imprimir(vr("b")))),
    ],
    pistas: [
      "Si haces a = b directamente, pierdes el valor original de a. Guárdalo antes en la variable auxiliar.",
      "El orden es: auxiliar = a; a = b; b = auxiliar.",
      "Al final imprime primero a (que ahora vale 9) y luego b (que ahora vale 5).",
    ],
    explicacion: "Una variable solo guarda un valor a la vez. Para intercambiar dos, una tercera variable conserva temporalmente uno de ellos; es el mismo truco que usan los algoritmos de ordenamiento.",
  },

  // Operadores
  {
    id: "operadores-suma", tema: "operadores", dificultad: "basico",
    titulo: "Guarda una suma",
    enunciado: "Declara una variable entera que guarde el resultado de 2 + 3 y después imprímela.",
    toolbox: [...VARIABLES, "aritmetica", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [
      workspace(programa(declarar("entero", "total", arit(num(2), "SUMA", num(3))), imprimir(vr("total")))),
      workspace(programa(declarar("entero", "total", arit(num(3), "SUMA", num(2))), imprimir(vr("total")))),
    ],
    pistas: ["Primero declara la variable con el tipo entero; después imprímela.", "El valor de la variable es un bloque de operación con 2 + 3."],
    explicacion: "Una variable guarda un valor para usarlo después. Al declararla como entero indicas qué tipo de dato contiene, algo que lenguajes como Java o C# exigen y que Python deduce solo.",
  },
  {
    id: "operadores-promedio", tema: "operadores", dificultad: "intermedio",
    titulo: "Promedio de dos calificaciones",
    enunciado: "Declara una variable decimal con el promedio de 8 y 10: súmalos y divide el resultado entre 2. Después imprímela.",
    toolbox: [...VARIABLES, "aritmetica", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [
      workspace(programa(declarar("decimal", "promedio", arit(arit(num(8), "SUMA", num(10)), "DIV", num(2))), imprimir(vr("promedio")))),
      workspace(programa(declarar("decimal", "promedio", arit(arit(num(10), "SUMA", num(8)), "DIV", num(2))), imprimir(vr("promedio")))),
    ],
    pistas: ["El tipo de la variable es decimal.", "Pon un bloque de suma dentro del lado izquierdo de un bloque de división."],
    explicacion: "La división se hace después de la suma porque la suma está anidada dentro de ella. En el código aparecen paréntesis: sin ellos, 8 + 10 / 2 daría 13, porque la división tiene prioridad.",
  },
  {
    id: "operadores-par", tema: "operadores", dificultad: "avanzado",
    titulo: "¿Es par?",
    enunciado: "Declara una variable entera con el valor 14 e imprime el resultado de comparar si el residuo de dividirla entre 2 es igual a 0.",
    toolbox: [...VARIABLES, "aritmetica", "comparacion", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [
      workspace(programa(declarar("entero", "n", num(14)), imprimir(comp(arit(vr("n"), "MOD", num(2)), "IGUAL", num(0))))),
      workspace(programa(declarar("entero", "n", num(14)), imprimir(comp(num(0), "IGUAL", arit(vr("n"), "MOD", num(2)))))),
    ],
    pistas: ["El operador % calcula el residuo de una división.", "Compara n % 2 con 0 usando el bloque de comparación con =.", "Imprime directamente la comparación: su resultado es verdadero o falso."],
    explicacion: "Un número es par cuando el residuo de dividirlo entre 2 es 0. La comparación produce un valor booleano que se puede imprimir o usar en una condición.",
  },

  // Salida
  {
    id: "salida-saludo", tema: "salida", dificultad: "basico",
    titulo: "Tu primer saludo",
    enunciado: "Escribe un programa que imprima el texto Hola, mundo.",
    toolbox: ["imprimir", "texto"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(imprimir(txt("Hola, mundo"))))],
    pistas: ["El bloque imprimir está en la categoría Salida. Colócalo dentro de programa.", "Dentro de imprimir va un bloque de texto con exactamente Hola, mundo."],
    explicacion: "Imprimir muestra un valor en la pantalla. Es la forma más simple de comprobar que un programa se ejecuta, y casi todos los cursos empiezan con este mismo ejercicio.",
  },
  {
    id: "salida-tres-lineas", tema: "salida", dificultad: "intermedio",
    titulo: "Tres líneas",
    enunciado: "Imprime, en este orden y cada una en su propia línea: Uno, Dos y Tres.",
    toolbox: ["imprimir", "texto"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(imprimir(txt("Uno")), imprimir(txt("Dos")), imprimir(txt("Tres"))))],
    pistas: ["Cada línea necesita su propio bloque imprimir.", "Apila los tres bloques uno debajo del otro dentro de programa."],
    explicacion: "Las instrucciones se ejecutan de arriba hacia abajo, y cada imprimir termina con un salto de línea. El orden de los bloques es el orden de la salida.",
  },
  {
    id: "salida-mensaje-compuesto", tema: "salida", dificultad: "avanzado",
    titulo: "Saludo personalizado",
    enunciado: "Declara una variable de texto con el valor Ada. Imprime Hola, Ada uniendo el texto «Hola, » (con espacio al final) y la variable.",
    toolbox: [...VARIABLES, "texto", "concatenar", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(declarar("texto", "nombre", txt("Ada")), imprimir(unir(txt("Hola, "), vr("nombre")))))],
    pistas: ["El bloque unir está en la categoría Cadenas.", "Primero va el texto «Hola, » y después la variable."],
    explicacion: "Unir (concatenar) junta dos textos en uno. Así un mismo programa puede saludar a cualquier persona cambiando solo el valor de la variable.",
  },

  // Condicionales
  {
    id: "condicionales-positivo", tema: "condicionales", dificultad: "basico",
    titulo: "¿Es positivo?",
    enunciado: "Declara una variable entera con el valor 7. Si es mayor que 0, imprime Positivo.",
    toolbox: [...VARIABLES, "numero", "si", "comparacion", "imprimir", "texto"],
    workspaceInicial: vacio(),
    soluciones: [
      workspace(programa(declarar("entero", "n", num(7)), si(comp(vr("n"), "MAYOR", num(0)), imprimir(txt("Positivo"))))),
      workspace(programa(declarar("entero", "n", num(7)), si(comp(num(0), "MENOR", vr("n")), imprimir(txt("Positivo"))))),
    ],
    pistas: ["Usa el bloque si de la categoría Control.", "La condición compara la variable con 0 usando >."],
    explicacion: "Un si ejecuta su bloque solo cuando la condición es verdadera. Si la condición fuera falsa, el programa simplemente seguiría con la siguiente instrucción.",
  },
  {
    id: "condicionales-aprobado", tema: "condicionales", dificultad: "intermedio",
    titulo: "¿Aprobado o reprobado?",
    enunciado: "Declara una variable entera calificacion con el valor 85. Si es mayor o igual que 60, imprime Aprobado; si no, imprime Reprobado.",
    toolbox: [...VARIABLES, "numero", "si_sino", "comparacion", "imprimir", "texto"],
    workspaceInicial: vacio(),
    soluciones: [
      workspace(programa(declarar("entero", "calificacion", num(85)),
        siSino(comp(vr("calificacion"), "MAYOR_IGUAL", num(60)), imprimir(txt("Aprobado")), imprimir(txt("Reprobado"))))),
      workspace(programa(declarar("entero", "calificacion", num(85)),
        siSino(comp(vr("calificacion"), "MENOR", num(60)), imprimir(txt("Reprobado")), imprimir(txt("Aprobado"))))),
    ],
    pistas: [
      "Usa el bloque si / si no de la categoría Control.",
      "La condición compara la variable con 60 usando ≥.",
      "En entonces va imprimir Aprobado y en si no, imprimir Reprobado.",
    ],
    explicacion: "Un condicional elige qué instrucciones ejecutar según una condición verdadera o falsa. Aquí 85 ≥ 60 es verdadero, así que el programa imprime Aprobado.",
  },
  {
    id: "condicionales-letra", tema: "condicionales", dificultad: "avanzado",
    titulo: "Calificación con letra",
    enunciado: "Declara una variable entera con el valor 85. Si es mayor o igual que 90, imprime A; si no, si es mayor o igual que 80, imprime B; en cualquier otro caso, imprime C.",
    toolbox: [...VARIABLES, "numero", "si_sino", "comparacion", "imprimir", "texto"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(declarar("entero", "nota", num(85)),
      siSino(comp(vr("nota"), "MAYOR_IGUAL", num(90)), imprimir(txt("A")),
        siSino(comp(vr("nota"), "MAYOR_IGUAL", num(80)), imprimir(txt("B")), imprimir(txt("C"))))))],
    pistas: [
      "Necesitas dos bloques si / si no, uno dentro del otro.",
      "El segundo si / si no va dentro de la parte si no del primero.",
      "Revisa las condiciones de mayor a menor: primero 90 y después 80.",
    ],
    explicacion: "Encadenar condicionales en la rama si no crea una cadena de casos: la primera condición verdadera gana. En Python se escribe con elif y en los lenguajes con llaves, con else if.",
  },

  // Ciclos
  {
    id: "ciclos-contar", tema: "ciclos", dificultad: "basico",
    titulo: "Cuenta del 1 al 10",
    enunciado: "Usa el bloque para con paso 1 para imprimir los números del 1 al 10.",
    toolbox: ["para", "variable", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(para("i", 1, 10, imprimir(vr("i")))))],
    pistas: ["Configura el bloque para desde 1 hasta 10.", "Dentro del ciclo imprime la variable del contador."],
    explicacion: "Un ciclo para repite su cuerpo una vez por cada valor del contador. Escribir diez imprimir funcionaría, pero el ciclo escala igual de bien a mil números.",
  },
  {
    id: "ciclos-suma", tema: "ciclos", dificultad: "intermedio",
    titulo: "Suma del 1 al 100",
    enunciado: "Declara una variable entera en 0. Usa un ciclo para del 1 al 100 que le sume el contador en cada vuelta. Al terminar el ciclo, imprime la variable.",
    toolbox: [...VARIABLES, "asignar", "para", "aritmetica", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [
      workspace(programa(declarar("entero", "suma", num(0)), para("i", 1, 100, asignar("suma", arit(vr("suma"), "SUMA", vr("i")))), imprimir(vr("suma")))),
      workspace(programa(declarar("entero", "suma", num(0)), para("i", 1, 100, asignar("suma", arit(vr("i"), "SUMA", vr("suma")))), imprimir(vr("suma")))),
    ],
    pistas: [
      "Dentro del ciclo va un bloque asignar: suma = suma + i.",
      "El imprimir va después del ciclo, no dentro; si no, verías 100 números.",
    ],
    explicacion: "Una variable acumuladora empieza en 0 y crece en cada vuelta. El resultado, 5050, es la suma que según la anécdota calculó Gauss de niño con una fórmula: n × (n + 1) / 2.",
  },
  {
    id: "ciclos-cuenta-regresiva", tema: "ciclos", dificultad: "avanzado",
    titulo: "Cuenta regresiva",
    enunciado: "Declara una variable entera con el valor 5. Mientras sea mayor que 0, imprímela y réstale 1. Al terminar, imprime Despegue.",
    toolbox: [...VARIABLES, "asignar", "mientras", "comparacion", "aritmetica", "numero", "imprimir", "texto"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(declarar("entero", "n", num(5)),
      mientras(comp(vr("n"), "MAYOR", num(0)), imprimir(vr("n")), asignar("n", arit(vr("n"), "RESTA", num(1)))),
      imprimir(txt("Despegue"))))],
    pistas: [
      "El bloque mientras repite su cuerpo mientras la condición sea verdadera.",
      "Dentro del ciclo van dos instrucciones: imprimir n y después n = n - 1.",
      "Si olvidas restar 1, la condición nunca se vuelve falsa y el ciclo no termina.",
    ],
    explicacion: "Un ciclo mientras se usa cuando no sabes de antemano cuántas vueltas dará. Cada vuelta debe acercar la condición a ser falsa; si no, el ciclo es infinito.",
  },

  // Funciones
  {
    id: "funciones-saludar", tema: "funciones", dificultad: "basico",
    titulo: "Tu primera función",
    enunciado: "Crea una función llamada saludar que no devuelva nada e imprima Hola. Después llámala desde programa.",
    toolbox: ["definir_funcion", "llamar_funcion", "imprimir", "texto"],
    workspaceInicial: vacio(),
    soluciones: [workspace(funcion("saludar", "nada", [], imprimir(txt("Hola"))), programa(B("llamar_funcion", { fields: { NOMBRE: "saludar" } })))],
    pistas: ["El bloque función va fuera de programa; escribe saludar en su nombre.", "Dentro de programa usa el bloque llamar con el mismo nombre: saludar."],
    explicacion: "Una función agrupa instrucciones bajo un nombre. Definirla no la ejecuta: su código corre cada vez que alguien la llama.",
  },
  {
    id: "funciones-doble", tema: "funciones", dificultad: "intermedio",
    titulo: "El doble de un número",
    enunciado: "Crea una función doble que reciba un parámetro entero y devuelva un entero: el parámetro multiplicado por 2. En programa, imprime el resultado de doble con el argumento 21.",
    toolbox: ["definir_funcion", "parametro", "retornar", "llamar_funcion_valor", "variable", "aritmetica", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [
      workspace(funcion("doble", "entero", [parametro("entero", "x")], retornar(arit(vr("x"), "MULT", num(2)))), programa(imprimir(resultado("doble", num(21))))),
      workspace(funcion("doble", "entero", [parametro("entero", "x")], retornar(arit(num(2), "MULT", vr("x")))), programa(imprimir(resultado("doble", num(21))))),
    ],
    pistas: [
      "Coloca un bloque parámetro en la ranura parámetros de la función y elige entero en devuelve.",
      "El cuerpo de la función es un solo bloque devolver con x × 2.",
      "En programa usa resultado de doble (21) dentro de imprimir.",
    ],
    explicacion: "Los parámetros son los datos que recibe una función y devolver es su resultado. Así la misma función calcula el doble de cualquier número que le pases.",
  },
  {
    id: "funciones-mayor", tema: "funciones", dificultad: "avanzado",
    titulo: "El mayor de dos números",
    enunciado: "Crea una función mayor que reciba dos parámetros enteros y devuelva un entero: si el primero es mayor que el segundo devuelve el primero; si no, el segundo. En programa, imprime mayor con los argumentos 4 y 9.",
    toolbox: ["definir_funcion", "parametro", "retornar", "llamar_funcion_valor", "variable", "si_sino", "comparacion", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [workspace(
      funcion("mayor", "entero", [parametro("entero", "a"), parametro("entero", "b")],
        siSino(comp(vr("a"), "MAYOR", vr("b")), retornar(vr("a")), retornar(vr("b")))),
      programa(imprimir(resultado("mayor", num(4), num(9)))),
    )],
    pistas: [
      "La función tiene dos bloques parámetro apilados en su ranura.",
      "Dentro de la función usa si / si no con la condición a > b.",
      "Cada rama tiene su propio devolver.",
    ],
    explicacion: "Una función puede tener varios devolver: en cuanto se ejecuta uno, la función termina con ese valor. Combinar condicionales y funciones es la base de casi cualquier programa.",
  },

  // Arreglos
  {
    id: "arreglos-primero", tema: "arreglos", dificultad: "basico",
    titulo: "El primer elemento",
    enunciado: "Declara un arreglo con los enteros 7, 2 y 5. Imprime su primer elemento, que está en la posición 0.",
    toolbox: [...VARIABLES, "crear_arreglo", "elemento_en", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(declarar("arreglo", "datos", arreglo("entero", num(7), num(2), num(5))), imprimir(elemento(0, vr("datos")))))],
    pistas: ["Declara la variable con el tipo arreglo y su valor es un bloque arreglo de entero.", "Para leer un elemento usa elemento 0 de la variable."],
    explicacion: "Un arreglo guarda varios valores en orden. En los ocho lenguajes del curso las posiciones empiezan en 0, así que el primer elemento es el 0 y no el 1.",
  },
  {
    id: "arreglos-recorrer", tema: "arreglos", dificultad: "intermedio",
    titulo: "Recorre un arreglo",
    enunciado: "Declara un arreglo con los enteros 4, 8 y 15 y usa para cada para imprimir cada uno de sus elementos.",
    toolbox: [...VARIABLES, "crear_arreglo", "para_cada", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(declarar("arreglo", "datos", arreglo("entero", num(4), num(8), num(15))),
      paraCada("d", vr("datos"), imprimir(vr("d")))))],
    pistas: ["El bloque para cada está en la categoría Control.", "Dentro del ciclo imprime la variable del elemento, no el arreglo completo."],
    explicacion: "Para cada recorre un arreglo de principio a fin sin manejar índices. Es la forma más segura de visitar todos los elementos: no hay riesgo de salirse del arreglo.",
  },
  {
    id: "arreglos-suma", tema: "arreglos", dificultad: "avanzado",
    titulo: "Suma los elementos",
    enunciado: "Declara primero un arreglo con los enteros 3, 6 y 9 y después una variable entera en 0. Recorre el arreglo con para cada sumando cada elemento a esa variable. Al final, imprímela.",
    toolbox: [...VARIABLES, "asignar", "crear_arreglo", "para_cada", "aritmetica", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [
      workspace(programa(declarar("arreglo", "datos", arreglo("entero", num(3), num(6), num(9))), declarar("entero", "total", num(0)),
        paraCada("d", vr("datos"), asignar("total", arit(vr("total"), "SUMA", vr("d")))), imprimir(vr("total")))),
      workspace(programa(declarar("arreglo", "datos", arreglo("entero", num(3), num(6), num(9))), declarar("entero", "total", num(0)),
        paraCada("d", vr("datos"), asignar("total", arit(vr("d"), "SUMA", vr("total")))), imprimir(vr("total")))),
    ],
    pistas: [
      "Es el mismo patrón del acumulador: total = total + elemento.",
      "La asignación va dentro del para cada; el imprimir, después.",
    ],
    explicacion: "Recorrer un arreglo acumulando un resultado es uno de los patrones más usados: así se calculan sumas, promedios, máximos y conteos.",
  },

  // Cadenas
  {
    id: "cadenas-mayusculas", tema: "cadenas", dificultad: "basico",
    titulo: "Grita el mensaje",
    enunciado: "Declara una variable de texto con el valor hola mundo e imprímela en mayúsculas.",
    toolbox: [...VARIABLES, "texto", "mayusculas", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(declarar("texto", "mensaje", txt("hola mundo")), imprimir(texto("mayusculas", vr("mensaje")))))],
    pistas: ["El bloque en mayúsculas está en la categoría Cadenas.", "Pon la variable dentro de en mayúsculas y eso dentro de imprimir."],
    explicacion: "Convertir a mayúsculas crea un texto nuevo: la variable original sigue igual. Es útil para comparar palabras sin importar cómo las escribió el usuario.",
  },
  {
    id: "cadenas-longitud", tema: "cadenas", dificultad: "intermedio",
    titulo: "¿Cuántas letras?",
    enunciado: "Declara una variable de texto con el valor programar e imprime su longitud.",
    toolbox: [...VARIABLES, "texto", "longitud_texto", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(declarar("texto", "palabra", txt("programar")), imprimir(texto("longitud_texto", vr("palabra")))))],
    pistas: ["Usa el bloque longitud de de la categoría Cadenas."],
    explicacion: "La longitud de un texto es su número de caracteres; programar tiene 9. En C se calcula con strlen y en Java con length().",
  },
  {
    id: "cadenas-inicio", tema: "cadenas", dificultad: "avanzado",
    titulo: "Las primeras letras",
    enunciado: "Declara una variable de texto con el valor Blockly. Imprime el texto «Inicio: » (con espacio al final) unido a la subcadena de la variable desde 0 hasta 3.",
    toolbox: [...VARIABLES, "texto", "subcadena", "concatenar", "numero", "imprimir"],
    workspaceInicial: vacio(),
    soluciones: [workspace(programa(declarar("texto", "nombre", txt("Blockly")),
      imprimir(unir(txt("Inicio: "), B("subcadena", { inputs: { TEXTO: vr("nombre"), DESDE: num(0), HASTA: num(3) } })))))],
    pistas: [
      "Subcadena incluye la posición desde y excluye la posición hasta: de 0 a 3 son 3 letras.",
      "Dentro de unir va primero el texto «Inicio: » y después la subcadena.",
    ],
    explicacion: "Una subcadena extrae una parte de un texto. El resultado, Inicio: Blo, combina dos operaciones: extraer y unir.",
  },

  // Programación orientada a objetos
  {
    id: "poo-crear-objeto", tema: "poo", dificultad: "basico",
    titulo: "Crea tu primer objeto",
    enunciado: "Ya existe la clase Perro con un método ladrar. En programa, declara una variable objeto con un nuevo Perro y llama a su método ladrar.",
    toolbox: [...VARIABLES, "crear_objeto", "llamar_metodo"],
    workspaceInicial: workspace(clase("Perro", "", metodo("ladrar", imprimir(txt("Guau")))), programa()),
    soluciones: [workspace(clase("Perro", "", metodo("ladrar", imprimir(txt("Guau")))),
      programa(declarar("objeto", "firulais", nuevo("Perro")), llamarMetodo(vr("firulais"), "ladrar")))],
    pistas: [
      "En el bloque nuevo escribe Perro como nombre de la clase.",
      "Para llamar el método, conecta la variable al bloque . ladrar ( ).",
    ],
    explicacion: "Una clase es un molde y un objeto es una pieza hecha con ese molde. Crear el objeto con nuevo y luego llamar sus métodos es el ciclo básico de la programación orientada a objetos.",
  },
  {
    id: "poo-constructor", tema: "poo", dificultad: "intermedio",
    titulo: "Un constructor",
    enunciado: "Completa la clase Persona: primero un atributo de texto nombre y después un constructor que reciba un parámetro de texto y lo guarde en este objeto . nombre. En programa, crea una Persona con el argumento Ada e imprime su atributo nombre.",
    toolbox: ["atributo", "constructor", "parametro", "asignar_atributo", "este", ...VARIABLES, "crear_objeto", "obtener_atributo", "texto", "imprimir"],
    workspaceInicial: workspace(clase("Persona", ""), programa()),
    soluciones: [workspace(
      clase("Persona", "", B("atributo", { fields: { TIPO: "texto", NOMBRE: "nombre" } }),
        B("constructor", { inputs: { PARAMETROS: parametro("texto", "n"),
          CUERPO: B("asignar_atributo", { fields: { ATRIBUTO: "nombre" }, inputs: { OBJETO: B("este"), VALOR: vr("n") } }) } })),
      programa(declarar("objeto", "p", nuevo("Persona", txt("Ada"))), imprimir(atributo(vr("p"), "nombre"))),
    )],
    pistas: [
      "Dentro de la clase van, en orden, un bloque atributo y un bloque constructor.",
      "En el cuerpo del constructor usa en este objeto . nombre poner con el parámetro.",
      "En programa, el bloque nuevo Persona recibe el texto Ada como argumento.",
    ],
    explicacion: "El constructor se ejecuta al crear el objeto y prepara su estado inicial. este se refiere al objeto que se está construyendo: this en Java o C#, self en Python.",
  },
  {
    id: "poo-herencia", tema: "poo", dificultad: "avanzado",
    titulo: "Herencia",
    enunciado: "Ya existe la clase Animal con un método hablar. Crea una clase Gato que herede de Animal y tenga su propio método hablar que imprima Miau. En programa, declara una variable objeto con un nuevo Gato y llama a hablar.",
    toolbox: ["definir_clase", "metodo", "imprimir", "texto", ...VARIABLES, "crear_objeto", "llamar_metodo"],
    workspaceInicial: workspace(clase("Animal", "", metodo("hablar", imprimir(txt("...")))), programa()),
    soluciones: [workspace(
      clase("Animal", "", metodo("hablar", imprimir(txt("...")))),
      clase("Gato", "Animal", metodo("hablar", imprimir(txt("Miau")))),
      programa(declarar("objeto", "michi", nuevo("Gato")), llamarMetodo(vr("michi"), "hablar")),
    )],
    pistas: [
      "Crea un bloque clase con el nombre Gato y escribe Animal en hereda de.",
      "El método de Gato debe llamarse igual que el de Animal: hablar.",
      "En programa crea un nuevo Gato, no un Animal.",
    ],
    explicacion: "Heredar permite reutilizar una clase y cambiar solo lo necesario. Al sobrescribir hablar, un Gato responde con su propia versión aunque también sea un Animal.",
  },
];

const porTema = (tema) => EJERCICIOS.filter((e) => e.tema === tema).map((e) => e.id);
const quizTema = (tema, titulo, descripcion) => ({
  id: `quiz-${tema}`, titulo, descripcion, ejercicioIds: porTema(tema), penalizacionPista: 20, tema, dificultad: "progresivo",
});

export const QUIZZES = [
  {
    id: "primeros-pasos", titulo: "Primeros pasos", descripcion: "Salida en pantalla, variables y tu primer condicional.",
    ejercicioIds: ["salida-saludo", "operadores-suma", "condicionales-aprobado"], penalizacionPista: 20, tema: "salida", dificultad: "basico",
  },
  quizTema("variables", "Variables", "Declarar, cambiar e intercambiar valores."),
  quizTema("operadores", "Operadores", "Suma, división, residuo y el orden de las operaciones."),
  quizTema("salida", "Salida en pantalla", "Imprimir textos, varias líneas y mensajes armados con variables."),
  quizTema("condicionales", "Condicionales", "Decidir con si, si no y cadenas de casos."),
  quizTema("ciclos", "Ciclos", "Repetir con para y mientras, y acumular resultados."),
  quizTema("funciones", "Funciones", "Definir, llamar, recibir parámetros y devolver resultados."),
  quizTema("arreglos", "Arreglos", "Guardar varios valores, leerlos y recorrerlos."),
  quizTema("cadenas", "Cadenas de texto", "Mayúsculas, longitud y subcadenas."),
  quizTema("poo", "Programación orientada a objetos", "Objetos, constructores y herencia."),
];
