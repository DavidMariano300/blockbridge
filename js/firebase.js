import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { initializeAppCheck, getToken, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";

// En localhost se usan los emuladores (npm run emuladores) con un proyecto "demo-" que no existe en la nube.
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);

// Configuración pública del proyecto real: Consola de Firebase → Configuración del proyecto → Tus apps.
// No es secreta; lo que protege los datos son las reglas de Firestore.
const PRODUCCION = {
  apiKey: "AIzaSyD0StaxYhXh7atJbVeuTMq9lyV8jaFaE_g",
  authDomain: "blockbridge-academy.firebaseapp.com",
  projectId: "blockbridge-academy",
  appId: "1:865955298777:web:7974cf093058d259556dc8",
};

// Clave de sitio de reCAPTCHA Enterprise, hoy Fraud Defense (pública). Vacía, App Check queda apagado; en los emuladores no aplica.
const RECAPTCHA_SITIO = "6LcAZRAuAAAAABb2sUzGBnOmsT2mgA08XxSN-4s6";

const app = initializeApp(LOCAL ? { apiKey: "demo", projectId: "demo-blockbridge" } : PRODUCCION);
const appCheck = !LOCAL && RECAPTCHA_SITIO
  ? initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITIO), isTokenAutoRefreshEnabled: true })
  : null;

// Un bloqueador puede impedir que cargue reCAPTCHA: sin este límite, la app se quedaría esperando.
const MAX_ESPERA_MS = 5000;
export const tokenAppCheck = async () => {
  if (!appCheck) return null;
  const espera = new Promise((listo) => setTimeout(() => listo(null), MAX_ESPERA_MS));
  return Promise.race([getToken(appCheck).then((r) => r.token), espera]);
};

export const auth = getAuth(app);
export const db = getFirestore(app);
auth.languageCode = "es";

if (LOCAL) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8085);
}
