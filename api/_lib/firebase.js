// Firebase Admin para las funciones. En producción usa FIREBASE_SERVICE_ACCOUNT; en local, los emuladores.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function iniciar() {
  const cuenta = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (cuenta) return initializeApp({ credential: cert(JSON.parse(cuenta)) });
  // Sin credenciales solo se permite trabajar contra los emuladores, nunca contra un proyecto real.
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT");
  }
  return initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-blockbridge" });
}

const app = getApps()[0] ?? iniciar();
export const appCheck = getAppCheck(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
