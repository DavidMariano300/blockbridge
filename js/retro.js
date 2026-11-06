// Retroalimentación de una respuesta incorrecta: mensaje según el tipo de diferencia y bloque resaltado.
const MENSAJES = {
  valor_distinto: "Vas bien hasta el bloque resaltado, pero su valor no es el esperado. Revisa sus números, textos u opciones.",
  bloque_distinto: "El bloque resaltado no es el que se esperaba en esa posición.",
  falta_bloque: "Falta al menos un bloque cerca del bloque resaltado.",
  sobra_bloque: "El bloque resaltado sobra: tu programa tiene más instrucciones de las necesarias.",
};

export const mensajeDiferencia = ({ tipo, bloqueId }) =>
  bloqueId ? MENSAJES[tipo] : "Tu programa está vacío o incompleto: arma la solución dentro de «programa».";

// Contorno propio: el resaltado nativo de Blockly en el renderizador thrasos es casi imperceptible.
export function crearResaltador(workspace) {
  let resaltado = null;
  return (bloqueId) => {
    resaltado?.getSvgRoot()?.classList.remove("bloque-resaltado");
    let bloque = bloqueId ? workspace.getBlockById(bloqueId) : null;
    if (bloque?.isShadow()) bloque = bloque.getParent();
    resaltado = bloque;
    if (!bloque) return;
    bloque.getSvgRoot().classList.add("bloque-resaltado");
    workspace.centerOnBlock(bloque.id);
  };
}
