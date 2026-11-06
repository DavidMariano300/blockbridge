// Comportamiento común del encabezado. Se carga sin defer en <head> para aplicar el tema antes del primer pintado.
(function () {
  var CLAVE = "bb:tema";
  var raiz = document.documentElement;
  var sistema = window.matchMedia("(prefers-color-scheme: dark)");

  function guardado() {
    try { return localStorage.getItem(CLAVE); } catch (e) { return null; }
  }

  function aplicar(tema) {
    raiz.setAttribute("data-tema", tema);
    var boton = document.getElementById("tema");
    if (boton) boton.setAttribute("aria-pressed", String(tema === "oscuro"));
  }

  aplicar(guardado() || (sistema.matches ? "oscuro" : "claro"));

  // Sin preferencia guardada, el tema sigue al del sistema operativo.
  sistema.addEventListener("change", function (e) {
    if (!guardado()) aplicar(e.matches ? "oscuro" : "claro");
  });

  document.addEventListener("DOMContentLoaded", function () {
    var botonTema = document.getElementById("tema");
    var encabezado = document.querySelector(".encabezado");
    var botonMenu = document.querySelector(".menu-boton");

    aplicar(raiz.getAttribute("data-tema"));

    botonTema.addEventListener("click", function () {
      var nuevo = raiz.getAttribute("data-tema") === "oscuro" ? "claro" : "oscuro";
      aplicar(nuevo);
      try { localStorage.setItem(CLAVE, nuevo); } catch (e) { /* almacenamiento no disponible: el tema dura la visita */ }
    });

    // Manejo del estado del menú móvil
    function abrir(estado) {
      encabezado.toggleAttribute("data-abierto", estado);
      botonMenu.setAttribute("aria-expanded", String(estado));
      botonMenu.setAttribute("aria-label", estado ? "Cerrar menú" : "Abrir menú");
    }

    botonMenu.addEventListener("click", function () {
      abrir(botonMenu.getAttribute("aria-expanded") !== "true");
    });

    document.getElementById("menu").addEventListener("click", function (e) {
      if (e.target.closest("a")) abrir(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && encabezado.hasAttribute("data-abierto")) {
        abrir(false);
        botonMenu.focus();
      }
    });

    window.matchMedia("(min-width: 70rem)").addEventListener("change", function (e) {
      if (e.matches) abrir(false);
    });
  });
})();
