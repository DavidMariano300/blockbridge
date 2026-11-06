// Nombres visibles de temas y dificultades, y la etiqueta que los muestra.
export const TEMAS = {
  variables: "Variables", operadores: "Operadores", salida: "Salida", condicionales: "Condicionales",
  ciclos: "Ciclos", funciones: "Funciones", arreglos: "Arreglos", cadenas: "Cadenas", poo: "POO",
};
export const DIFICULTADES = { basico: "Básico", intermedio: "Intermedio", avanzado: "Avanzado", progresivo: "De básico a avanzado" };

export const etiqueta = (texto) => Object.assign(document.createElement("span"), { className: "etiqueta", textContent: texto });
export const etiquetasDe = (tema, dificultad) => [etiqueta(TEMAS[tema] ?? tema), etiqueta(DIFICULTADES[dificultad] ?? dificultad)];
