import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Subirla obliga a todos a volver a aceptar el aviso (docs/05 §C.8).
export const AVISO_VERSION = "2.0";

export async function cargarPerfil(usuario) {
  if (!usuario || usuario.isAnonymous) return null;
  const snap = await getDoc(doc(db, "usuarios", usuario.uid));
  return snap.exists() ? snap.data() : null;
}

export const esDocente = (usuario, perfil) => perfil?.rol === "docente" && usuario?.emailVerified === true;
export const perfilCompleto = (perfil) => perfil?.avisoVersion === AVISO_VERSION;

// Llama a cb({usuario, perfil}) en cada cambio de sesión. Una cuenta sin perfil o con un aviso
// viejo se manda a completarlo antes de usar el sistema.
export function observarSesion(cb) {
  onAuthStateChanged(auth, async (usuario) => {
    // Si verificó su correo en otra pestaña, el token guardado aún dice que no; las reglas leen el token.
    if (usuario?.emailVerified && !(await usuario.getIdTokenResult()).claims.email_verified) await usuario.getIdToken(true);
    const perfil = await cargarPerfil(usuario);
    pintarEncabezado(usuario, perfil);
    if (usuario && !usuario.isAnonymous && !perfilCompleto(perfil) && !location.pathname.startsWith("/cuenta")) {
      location.href = "cuenta.html#completar";
      return;
    }
    cb?.({ usuario, perfil });
  });
}

export function pintarEncabezado(usuario, perfil) {
  const nav = document.getElementById("nav-sesion");
  if (!nav) return;
  const enlaces = !usuario
    ? [enlace("cuenta.html#entrar", "Entrar", "enlace-sesion"), enlace("cuenta.html#registro", "Comenzar gratis", "boton boton--primario")]
    : usuario.isAnonymous
      ? [etiqueta("Invitado"), enlace("cuenta.html#entrar", "Entrar", "enlace-sesion"), enlace("cuenta.html#registro", "Crear cuenta", "boton boton--primario")]
      : [esDocente(usuario, perfil) && enlace("docente.html", "Panel docente", "enlace-sesion"),
        enlace("cuenta.html", perfil?.apodo ?? "Mi cuenta", "boton boton--secundario")];
  nav.replaceChildren(...enlaces.filter(Boolean));
}

const etiqueta = (texto) => Object.assign(document.createElement("span"), { className: "etiqueta", textContent: texto });
const enlace = (href, texto, className) => Object.assign(document.createElement("a"), { href, textContent: texto, className });

// Mensajes de Firebase Auth en español. Los de cuenta existente son genéricos para no revelar correos.
const MENSAJES = {
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "Correo o contraseña incorrectos.",
  "auth/invalid-email": "Escribe un correo válido.",
  "auth/email-already-in-use": "No se pudo crear la cuenta con esos datos. Si ya tienes una, inicia sesión.",
  "auth/credential-already-in-use": "No se pudo crear la cuenta con esos datos. Si ya tienes una, inicia sesión.",
  "auth/weak-password": "La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.",
  "auth/password-does-not-meet-requirements": "La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
  "auth/requires-recent-login": "Por seguridad, vuelve a iniciar sesión.",
  "auth/network-request-failed": "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.",
  "unavailable": "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.",
};

export function mensajeError(e) {
  console.error(e);
  // Los errores de /api ya traen un mensaje pensado para el usuario; un TypeError de fetch es falta de conexión.
  if (e?.name === "ErrorApi") return e.message;
  if (e instanceof TypeError && /fetch/i.test(e.message)) return MENSAJES["auth/network-request-failed"];
  return MENSAJES[e?.code] ?? "Algo salió mal. Inténtalo de nuevo.";
}

// Deshabilita el botón, muestra el resultado en el <p class="estado"> del formulario.
export async function enviar(form, accion) {
  const boton = form.querySelector("button[type=submit]");
  const estado = form.querySelector(".estado");
  boton.disabled = true;
  estado.className = "estado";
  estado.textContent = "";
  try {
    const ok = await accion(new FormData(form));
    if (ok) Object.assign(estado, { className: "estado ok", textContent: ok });
  } catch (e) {
    Object.assign(estado, { className: "estado error", textContent: mensajeError(e) });
  } finally {
    boton.disabled = false;
  }
}
