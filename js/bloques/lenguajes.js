import { generadorJava } from "./java.js";
import { generadorKotlin } from "./kotlin.js";
import { generadorCSharp } from "./csharp.js";
import { generadorCpp } from "./cpp.js";
import { generadorC } from "./c.js";
import { generadorPython } from "./python.js";
import { generadorJavaScript } from "./javascript.js";
import { generadorPHP } from "./php.js";

// Los 8 lenguajes del curso, en el orden en que se muestran.
export const LENGUAJES = {
  java: { nombre: "Java", crear: generadorJava },
  kotlin: { nombre: "Kotlin", crear: generadorKotlin },
  csharp: { nombre: "C#", crear: generadorCSharp },
  cpp: { nombre: "C++", crear: generadorCpp },
  c: { nombre: "C", crear: generadorC },
  python: { nombre: "Python", crear: generadorPython },
  javascript: { nombre: "JavaScript", crear: generadorJavaScript },
  php: { nombre: "PHP", crear: generadorPHP },
};
