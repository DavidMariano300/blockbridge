// Estado de sesión en el encabezado para páginas públicas, sin redirigir a completar el perfil.
import { auth } from "./firebase.js";
import { cargarPerfil, pintarEncabezado } from "./sesion.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Sin conexión se pinta el encabezado sin apodo en lugar de fallar.
onAuthStateChanged(auth, async (usuario) => pintarEncabezado(usuario, await cargarPerfil(usuario).catch(() => null)));
