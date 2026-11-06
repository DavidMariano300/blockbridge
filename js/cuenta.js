import { auth, db } from "./firebase.js";
import { api } from "./api.js";
import { AVISO_VERSION, cargarPerfil, esDocente, perfilCompleto, observarSesion, pintarEncabezado, enviar, mensajeError } from "./sesion.js";
import {
  EmailAuthProvider, linkWithCredential, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, signOut, reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, setDoc, updateDoc, serverTimestamp, getDoc, getDocs, collection, query, where }
  from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { LENGUAJES } from "./bloques/lenguajes.js";

const $ = (id) => document.getElementById(id);

// Aviso simplificado (docs/05 Parte B).
const AVISO_SIMPLIFICADO = "BlockBridge Academy usará tu apodo, correo y resultados solo para darte acceso, " +
  "calificar tus quizzes y mostrar tus resultados a tus docentes con tu apodo, nunca con tu correo. No los usamos " +
  "para publicidad ni los vendemos. Google (Firebase) y Vercel los almacenan en Estados Unidos. Puedes descargar o " +
  "eliminar tus datos desde «Mi cuenta».";
document.querySelectorAll(".aviso-simplificado").forEach((p) => (p.textContent = AVISO_SIMPLIFICADO));

// Correo capturado en el hero de la página de inicio.
try {
  const correo = sessionStorage.getItem("bb:correo");
  if (correo) {
    $("form-registro").correo.value = correo;
    sessionStorage.removeItem("bb:correo");
  }
} catch { /* almacenamiento no disponible */ }

// Mientras se registra, onAuthStateChanged dispara antes de que exista el perfil: no repintar a medias.
let ocupado = false;

observarSesion(({ usuario, perfil }) => {
  if (!ocupado) mostrar(usuario, perfil);
});
addEventListener("hashchange", () => !ocupado && refrescar());

async function refrescar() {
  const usuario = auth.currentUser;
  const perfil = await cargarPerfil(usuario);
  pintarEncabezado(usuario, perfil);
  mostrar(usuario, perfil);
}

function mostrar(usuario, perfil) {
  const registrado = usuario && !usuario.isAnonymous;
  $("cargando").hidden = true;
  $("acceso").hidden = registrado;
  $("completar").hidden = !registrado || perfilCompleto(perfil);
  $("mi-cuenta").hidden = !registrado || !perfilCompleto(perfil);

  if (!registrado) {
    const panel = ["entrar", "registro", "recuperar"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "entrar";
    for (const p of ["entrar", "registro", "recuperar"]) $(`panel-${p}`).hidden = p !== panel;
    for (const [tab, activa] of [["tab-entrar", panel !== "registro"], ["tab-registro", panel === "registro"]]) {
      if (activa) $(tab).setAttribute("aria-current", "page");
      else $(tab).removeAttribute("aria-current");
    }
    $("registro-invitado").hidden = !usuario?.isAnonymous;
    return;
  }

  if (!perfilCompleto(perfil)) {
    $("form-completar").apodo.value = perfil?.apodo ?? "";
    return;
  }

  $("dato-correo").textContent = usuario.email;
  $("dato-rol").textContent = perfil.rol === "docente" ? "Docente" : "Estudiante";
  $("dato-verificado").textContent = usuario.emailVerified ? "Correo verificado" : "Correo sin verificar";
  $("acciones-verificar").hidden = usuario.emailVerified;
  if (perfil.rol === "docente" && !esDocente(usuario, perfil)) {
    $("estado-verificar").textContent = "Verifica tu correo para acceder a las funciones de docente.";
  }
  $("form-apodo").apodo.value = perfil.apodo;
  cargarHistorial(usuario.uid);
}

// Historial (CU-10). Se ordena en el navegador para no requerir un índice compuesto.
const fecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });
const misSesiones = async (uid) => (await getDocs(query(collection(db, "sesiones"), where("uid", "==", uid)))).docs
  .map((d) => d.data()).sort((a, b) => b.inicio.toMillis() - a.inicio.toMillis());

async function cargarHistorial(uid) {
  try {
    const sesiones = await misSesiones(uid);
    // Un quiz despublicado ya no se puede leer: se muestra sin enlace.
    const titulos = new Map(await Promise.all([...new Set(sesiones.map((s) => s.quizId))].map(async (id) => {
      try {
        return [id, (await getDoc(doc(db, "quizzes", id))).get("titulo") ?? null];
      } catch {
        return [id, null];
      }
    })));
    const celda = (texto) => Object.assign(document.createElement("td"), { textContent: texto });
    $("filas-historial").replaceChildren(...sesiones.map((s) => {
      const fila = document.createElement("tr");
      const quiz = document.createElement("th");
      quiz.scope = "row";
      const titulo = titulos.get(s.quizId);
      quiz.append(titulo ? Object.assign(document.createElement("a"), { href: `quiz.html?id=${encodeURIComponent(s.quizId)}`, textContent: titulo })
        : "Quiz ya no disponible");
      fila.append(quiz, celda(LENGUAJES[s.lenguaje]?.nombre ?? s.lenguaje), celda(fecha.format(s.inicio.toDate())),
        celda(String(s.puntaje)), celda(s.estado === "finalizada" ? "Finalizado" : "En curso"));
      return fila;
    }));
    $("historial-vacio").hidden = sesiones.length > 0;
  } catch (e) {
    $("historial-vacio").textContent = mensajeError(e);
    $("historial-vacio").hidden = false;
  }
}

// Derecho de acceso: todo lo que el sistema guarda de la persona, en un archivo JSON.
const plano = (v) => (v?.toDate ? v.toDate().toISOString() : Array.isArray(v) ? v.map(plano)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plano(x)])) : v);

async function descargarDatos() {
  const usuario = auth.currentUser;
  try {
    const datos = {
      exportadoEn: new Date().toISOString(),
      cuenta: { uid: usuario.uid, correo: usuario.email, correoVerificado: usuario.emailVerified },
      perfil: plano((await getDoc(doc(db, "usuarios", usuario.uid))).data()),
      sesiones: plano(await misSesiones(usuario.uid)),
    };
    const enlace = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" })),
      download: "mis-datos-blockbridge.json",
    });
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
    $("estado-datos").className = "estado ok";
    $("estado-datos").textContent = "Descargamos tus datos en el archivo mis-datos-blockbridge.json.";
  } catch (e) {
    $("estado-datos").className = "estado error";
    $("estado-datos").textContent = mensajeError(e);
  }
}

// Eliminar la cuenta (CU-14): confirmación escrita y contraseña reciente; el servidor borra todo.
async function eliminarCuenta(evento) {
  evento.preventDefault();
  const form = evento.target;
  const estado = form.querySelector(".estado");
  if (form.confirmacion.value.trim() !== "ELIMINAR") {
    estado.className = "estado error";
    estado.textContent = "Escribe ELIMINAR, en mayúsculas, para confirmar.";
    return;
  }
  const boton = form.querySelector("button[type=submit]");
  boton.disabled = true;
  ocupado = true;
  try {
    const usuario = auth.currentUser;
    await reauthenticateWithCredential(usuario, EmailAuthProvider.credential(usuario.email, form.contrasena.value));
    await api("cuenta", undefined, "DELETE");
    await signOut(auth).catch(() => {});
    $("dialogo-eliminar").close();
    $("mi-cuenta").hidden = true;
    $("cuenta-eliminada").hidden = false;
    pintarEncabezado(null, null);
  } catch (e) {
    ocupado = false;
    estado.className = "estado error";
    estado.textContent = mensajeError(e);
  } finally {
    boton.disabled = false;
  }
}

$("descargar-datos").addEventListener("click", descargarDatos);
$("abrir-eliminar").addEventListener("click", () => {
  $("form-eliminar").reset();
  $("form-eliminar").querySelector(".estado").textContent = "";
  $("dialogo-eliminar").showModal();
});
$("cancelar-eliminar").addEventListener("click", () => $("dialogo-eliminar").close());
$("form-eliminar").addEventListener("submit", eliminarCuenta);

// El token debe reflejar la cuenta ya no anónima antes de escribir el perfil (las reglas lo revisan).
async function guardarPerfil(usuario, apodo, perfilActual) {
  await usuario.getIdToken(true);
  const ref = doc(db, "usuarios", usuario.uid);
  if (perfilActual) {
    await updateDoc(ref, { apodo, avisoVersion: AVISO_VERSION, avisoAceptadoEn: serverTimestamp() });
  } else {
    await setDoc(ref, {
      apodo, rol: "estudiante", avisoVersion: AVISO_VERSION, avisoAceptadoEn: serverTimestamp(), creadoEn: serverTimestamp(),
    });
  }
}

$("form-entrar").addEventListener("submit", (e) => {
  e.preventDefault();
  if (auth.currentUser?.isAnonymous && !confirm("Lo que hiciste como invitado no se pasará a esta cuenta. ¿Continuar?")) return;
  enviar(e.target, async (datos) => {
    await signInWithEmailAndPassword(auth, datos.get("correo"), datos.get("contrasena"));
  });
});

$("form-recuperar").addEventListener("submit", (e) => {
  e.preventDefault();
  enviar(e.target, async (datos) => {
    try {
      await sendPasswordResetEmail(auth, datos.get("correo"));
    } catch (err) {
      // Mismo mensaje exista o no la cuenta; solo se reportan fallas de red.
      if (err.code === "auth/network-request-failed") throw err;
      console.error(err);
    }
    return "Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.";
  });
});

$("form-registro").addEventListener("submit", (e) => {
  e.preventDefault();
  ocupado = true;
  enviar(e.target, async (datos) => {
    const correo = datos.get("correo");
    const contrasena = datos.get("contrasena");
    const actual = auth.currentUser;
    // linkWithCredential cambia el mismo objeto de usuario: hay que leerlo antes de vincular.
    const eraInvitado = actual?.isAnonymous === true;
    // Si era invitado, se vincula la credencial al mismo uid para conservar su progreso (RF-03).
    const { user } = eraInvitado
      ? await linkWithCredential(actual, EmailAuthProvider.credential(correo, contrasena))
      : await createUserWithEmailAndPassword(auth, correo, contrasena);
    await guardarPerfil(user, datos.get("apodo").trim(), null);
    // Las sesiones de invitado dejan de expirar y pasan a la cuenta. Si falla, la cuenta sigue creada.
    if (eraInvitado) await api("sesiones", { accion: "reclamar" }).catch(console.error);
    await sendEmailVerification(user);
  }).finally(() => {
    ocupado = false;
    refrescar();
  });
});

$("form-completar").addEventListener("submit", (e) => {
  e.preventDefault();
  enviar(e.target, async (datos) => {
    const usuario = auth.currentUser;
    await guardarPerfil(usuario, datos.get("apodo").trim(), await cargarPerfil(usuario));
    await refrescar();
  });
});

$("form-apodo").addEventListener("submit", (e) => {
  e.preventDefault();
  enviar(e.target, async (datos) => {
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { apodo: datos.get("apodo").trim() });
    pintarEncabezado(auth.currentUser, await cargarPerfil(auth.currentUser));
    return "Apodo guardado.";
  });
});

$("reenviar").addEventListener("click", async () => {
  try {
    await sendEmailVerification(auth.currentUser);
    $("estado-verificar").textContent = "Te enviamos un nuevo correo de verificación.";
  } catch (err) {
    $("estado-verificar").textContent = mensajeError(err);
  }
});

// emailVerified y el token solo se actualizan al recargar el usuario.
$("ya-verifique").addEventListener("click", async () => {
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  $("estado-verificar").textContent = auth.currentUser.emailVerified ? "" : "Tu correo aún no aparece como verificado.";
  refrescar();
});

document.querySelectorAll(".salir").forEach((b) => b.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
}));
