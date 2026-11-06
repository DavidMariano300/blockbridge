// Constructores compactos del JSON de Blockly.serialization para pruebas y para el banco de ejercicios.

export const V = (nombre) => ({ VAR: { id: nombre } });

export const B = (type, { fields = {}, inputs = {}, id } = {}) => ({
  type, ...(id && { id }), fields,
  inputs: Object.fromEntries(Object.entries(inputs).filter(([, v]) => v).map(([k, v]) => [k, { block: v }])),
});

export function seq(...bloques) {
  for (let i = bloques.length - 2; i >= 0; i--) bloques[i].next = { block: bloques[i + 1] };
  return bloques[0];
}

export const num = (n) => B("numero", { fields: { NUM: n } });
export const txt = (t) => B("texto", { fields: { TEXTO: t } });
export const vr = (n) => B("variable", { fields: V(n) });
export const arit = (a, op, b) => B("aritmetica", { fields: { OP: op }, inputs: { A: a, B: b } });
export const comp = (a, op, b) => B("comparacion", { fields: { OP: op }, inputs: { A: a, B: b } });
export const imprimir = (v) => B("imprimir", { inputs: { VALOR: v } });
export const declarar = (tipo, n, v) => B("declarar_variable", { fields: { TIPO: tipo, ...V(n) }, inputs: { VALOR: v } });
export const asignar = (n, v) => B("asignar", { fields: V(n), inputs: { VALOR: v } });
export const programa = (...instrucciones) => B("programa", { inputs: { CUERPO: instrucciones.length ? seq(...instrucciones) : null } });
export const unir = (a, b) => B("concatenar", { inputs: { A: a, B: b } });
export const este = (atributo) => B("obtener_atributo", { fields: { ATRIBUTO: atributo }, inputs: { OBJETO: B("este") } });

// Workspace serializado; las variables se toman de los campos que referencian una.
export function workspace(...bloques) {
  const ids = new Set();
  const visitar = (b) => {
    if (!b) return;
    for (const v of Object.values(b.fields ?? {})) if (v && typeof v === "object" && v.id) ids.add(v.id);
    Object.values(b.inputs ?? {}).forEach((e) => visitar(e.block));
    visitar(b.next?.block);
  };
  bloques.forEach(visitar);
  return { blocks: { languageVersion: 0, blocks: bloques }, variables: [...ids].map((id) => ({ name: id, id })) };
}
