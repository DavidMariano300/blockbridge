import { db } from "./firebase.js";
import { observarSesion, mensajeError } from "./sesion.js";
import { etiquetasDe } from "./etiquetas.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

// Programa de demostración del hero: mismo bloque, ocho lenguajes.
const DEMO = {
  Python: `calificacion = 85
if calificacion >= 60:
    print("Aprobado")
else:
    print("Reprobado")`,
  JavaScript: `let calificacion = 85;
if (calificacion >= 60) {
  console.log("Aprobado");
} else {
  console.log("Reprobado");
}`,
  Java: `public class Main {
    public static void main(String[] args) {
        int calificacion = 85;
        if (calificacion >= 60) {
            System.out.println("Aprobado");
        } else {
            System.out.println("Reprobado");
        }
    }
}`,
  Kotlin: `fun main() {
    val calificacion: Int = 85
    if (calificacion >= 60) {
        println("Aprobado")
    } else {
        println("Reprobado")
    }
}`,
  "C#": `using System;

class Program {
    static void Main() {
        int calificacion = 85;
        if (calificacion >= 60) {
            Console.WriteLine("Aprobado");
        } else {
            Console.WriteLine("Reprobado");
        }
    }
}`,
  "C++": `#include <iostream>

int main() {
    int calificacion = 85;
    if (calificacion >= 60) {
        std::cout << "Aprobado" << std::endl;
    } else {
        std::cout << "Reprobado" << std::endl;
    }
    return 0;
}`,
  C: `#include <stdio.h>

int main(void) {
    int calificacion = 85;
    if (calificacion >= 60) {
        printf("Aprobado\\n");
    } else {
        printf("Reprobado\\n");
    }
    return 0;
}`,
  PHP: `<?php
$calificacion = 85;
if ($calificacion >= 60) {
    echo "Aprobado\\n";
} else {
    echo "Reprobado\\n";
}`,
};

// Pestañas accesibles: flechas, Inicio y Fin mueven el foco y la selección.
function montarPestanas() {
  const lista = $("pestanas-lenguaje");
  const pestanas = Object.keys(DEMO).map((lenguaje, i) => {
    const b = document.createElement("button");
    Object.assign(b, { type: "button", textContent: lenguaje, id: `pestana-${i}` });
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", "panel-codigo");
    b.addEventListener("click", () => seleccionar(i));
    return b;
  });
  lista.replaceChildren(...pestanas);

  function seleccionar(i, enfocar = false) {
    pestanas.forEach((b, j) => {
      b.setAttribute("aria-selected", String(i === j));
      b.tabIndex = i === j ? 0 : -1;
    });
    $("codigo-demo").textContent = DEMO[pestanas[i].textContent];
    $("panel-codigo").setAttribute("aria-labelledby", pestanas[i].id);
    if (enfocar) pestanas[i].focus();
  }

  lista.addEventListener("keydown", (e) => {
    const actual = pestanas.indexOf(document.activeElement);
    const destino = { ArrowRight: actual + 1, ArrowLeft: actual - 1, Home: 0, End: pestanas.length - 1 }[e.key];
    if (destino === undefined || actual < 0) return;
    e.preventDefault();
    seleccionar((destino + pestanas.length) % pestanas.length, true);
  });

  seleccionar(0);
}

montarPestanas();

observarSesion(({ usuario, perfil }) => {
  const registrado = usuario && !usuario.isAnonymous;
  $("hero-visitante").hidden = registrado;
  $("hero-sesion").hidden = !registrado;
  $("banda-cta").hidden = registrado;
  $("aviso-invitado").hidden = !usuario?.isAnonymous;
  $("nota-probar").hidden = Boolean(usuario);
  if (registrado) $("hero-cuenta").textContent = perfil?.apodo ? `Cuenta de ${perfil.apodo}` : "Mi cuenta";
});

// El correo viaja a la página de registro por sessionStorage, nunca en la URL.
$("form-hero").addEventListener("submit", (e) => {
  e.preventDefault();
  try { sessionStorage.setItem("bb:correo", new FormData(e.target).get("correo")); } catch { /* sin almacenamiento: se escribe de nuevo */ }
  location.href = "cuenta.html#registro";
});

async function cargarCatalogo() {
  try {
    const snap = await getDocs(query(collection(db, "quizzes"), where("publicado", "==", true)));
    // Primero los del banco en el orden del temario; los de docentes, que no tienen orden, al final.
    const docs = [...snap.docs].sort((a, b) => (a.get("orden") ?? 1e9) - (b.get("orden") ?? 1e9)
      || a.get("titulo").localeCompare(b.get("titulo")));
    $("catalogo").replaceChildren(...docs.map((d) => {
      const q = d.data();
      const li = Object.assign(document.createElement("li"), { className: "tarjeta" });
      const etiquetas = Object.assign(document.createElement("div"), { className: "etiquetas" });
      etiquetas.append(...etiquetasDe(q.tema, q.dificultad));
      const titulo = document.createElement("h3");
      titulo.append(Object.assign(document.createElement("a"), { href: `quiz.html?id=${encodeURIComponent(d.id)}`, textContent: q.titulo }));
      const resumen = Object.assign(document.createElement("p"), {
        className: "ayuda",
        textContent: `${q.ejercicioIds.length} ejercicios`,
      });
      li.append(etiquetas, titulo, resumen);
      return li;
    }));
    $("catalogo-vacio").hidden = !snap.empty;
  } catch (err) {
    $("estado-inicio").textContent = mensajeError(err);
  }
}

cargarCatalogo();
