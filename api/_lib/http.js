// Autenticación, lectura del cuerpo y respuestas JSON comunes a todas las funciones.
import { appCheck, auth, db } from "./firebase.js";
import { LIMITES, ErrorValidacion } from "../../js/bloques/evaluador.js";

export class ErrorHttp extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

const FORMATO_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function id(valor, nombre) {
  if (typeof valor !== "string" || !FORMATO_ID.test(valor)) throw new ErrorHttp(400, `El campo ${nombre} no es válido.`);
  return valor;
}

const responder = (datos, estado = 200) => Response.json(datos, { status: estado, headers: { "Cache-Control": "no-store" } });

// Se activa con EXIGIR_APP_CHECK=si, una vez que el sitio ya envía los tokens: rechaza clientes que no sean la app.
async function exigirAppCheck(request) {
  if (process.env.EXIGIR_APP_CHECK !== "si") return;
  try {
    await appCheck.verifyToken(request.headers.get("x-firebase-appcheck"));
  } catch {
    throw new ErrorHttp(401, "No pudimos verificar tu navegador. Vuelve a cargar la página.");
  }
}

// verifyIdToken con checkRevoked rechaza también los tokens de sesiones revocadas (RNF-SEG-05).
async function autenticar(request) {
  const [tipo, token] = (request.headers.get("authorization") ?? "").split(" ");
  if (tipo !== "Bearer" || !token) throw new ErrorHttp(401, "Inicia sesión para continuar.");
  try {
    const decodificado = await auth.verifyIdToken(token, true);
    return {
      uid: decodificado.uid,
      anonimo: decodificado.firebase?.sign_in_provider === "anonymous",
      correoVerificado: decodificado.email_verified === true,
      autenticadoEn: decodificado.auth_time,
    };
  } catch {
    throw new ErrorHttp(401, "Tu sesión expiró. Vuelve a cargar la página.");
  }
}

// Despacha {accion: "..."} a la función correspondiente sin heredar propiedades de Object.
export function despachar(acciones, cuerpo, ...args) {
  if (typeof cuerpo.accion !== "string" || !Object.hasOwn(acciones, cuerpo.accion)) throw new ErrorHttp(400, "Acción no válida.");
  return acciones[cuerpo.accion](...args, cuerpo);
}

// Funciones de docente (RF-08): rol asignado por el DBA en la consola y correo verificado.
export async function exigirDocente(usuario) {
  const rol = usuario.anonimo ? null : (await db.doc(`usuarios/${usuario.uid}`).get()).get("rol");
  if (rol !== "docente" || !usuario.correoVerificado) {
    throw new ErrorHttp(403, "Esta función es solo para docentes con el correo verificado.");
  }
}

async function leerCuerpo(request, maximo) {
  const texto = await request.text();
  if (Buffer.byteLength(texto) > maximo) throw new ErrorHttp(413, "El contenido es demasiado grande para enviarlo.");
  try {
    const cuerpo = texto ? JSON.parse(texto) : {};
    if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) throw new Error();
    return cuerpo;
  } catch {
    throw new ErrorHttp(400, "La petición no tiene un formato válido.");
  }
}

// Envuelve cada función: autentica, lee el cuerpo y traduce los errores a respuestas JSON.
// bytes: tamaño máximo del cuerpo (los ejercicios del docente llevan varias soluciones).
export function manejador(fn, { bytes = LIMITES.bytes } = {}) {
  return async (request) => {
    try {
      await exigirAppCheck(request);
      const usuario = await autenticar(request);
      return responder(await fn({ usuario, cuerpo: await leerCuerpo(request, bytes) }));
    } catch (e) {
      if (e instanceof ErrorHttp) return responder({ error: e.message }, e.estado);
      if (e instanceof ErrorValidacion) return responder({ error: e.message }, 400);
      // Solo ruta y tipo de error: nunca tokens, correos ni el programa enviado (docs/05 §C.3).
      console.error(`${new URL(request.url).pathname}: ${e?.name ?? "Error"} ${e?.code ?? ""}`.trim());
      return responder({ error: "Ocurrió un error en el servidor. Intenta de nuevo." }, 500);
    }
  };
}
