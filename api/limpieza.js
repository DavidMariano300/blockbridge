// GET /api/limpieza: tarea diaria de Vercel Cron que aplica los plazos de conservación (docs/05 §C.5).
// Vercel envía "Authorization: Bearer <CRON_SECRET>"; sin ese secreto configurado, la ruta no hace nada.
import { Timestamp } from "firebase-admin/firestore";
import { auth, db } from "./_lib/firebase.js";
import { eliminarUsuario } from "./_lib/cuenta.js";
import { seleccionarParaBorrar } from "./_lib/retencion.js";

// ponytail: topes por ejecución para no exceder el tiempo de la función; lo que falte se borra al día siguiente.
const MAXIMO_POR_DIA = 200;
const SESIONES_POR_DIA = 450;

// La política TTL de Firestore exige facturación activa: en el plan Spark esto cumple RN-12.
async function borrarSesionesVencidas() {
  const vencidas = await db.collection("sesiones").where("expiraEn", "<", Timestamp.now()).limit(SESIONES_POR_DIA).get();
  const lote = db.batch();
  vencidas.docs.forEach((d) => lote.delete(d.ref));
  await lote.commit();
  return vencidas.size;
}

export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  const sesionesVencidas = await borrarSesionesVencidas();
  const usuarios = [];
  let pagina;
  do {
    const r = await auth.listUsers(1000, pagina);
    usuarios.push(...r.users);
    pagina = r.pageToken;
  } while (pagina);

  const borrar = seleccionarParaBorrar(usuarios.map((u) => ({
    uid: u.uid,
    anonimo: u.providerData.length === 0,
    ultimaActividad: Date.parse(u.metadata.lastRefreshTime ?? u.metadata.lastSignInTime ?? u.metadata.creationTime),
  })));
  for (const uid of borrar.slice(0, MAXIMO_POR_DIA)) await eliminarUsuario(uid);
  console.log(`limpieza: ${usuarios.length} revisados, ${Math.min(borrar.length, MAXIMO_POR_DIA)} borrados, ${sesionesVencidas} sesiones vencidas`);
  return Response.json({ revisados: usuarios.length, borrados: Math.min(borrar.length, MAXIMO_POR_DIA),
    pendientes: Math.max(0, borrar.length - MAXIMO_POR_DIA), sesionesVencidas });
}
