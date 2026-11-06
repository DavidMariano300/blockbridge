// Servidor de desarrollo: archivos estáticos y funciones de /api con la misma firma que en Vercel.
// Sin FIREBASE_SERVICE_ACCOUNT usa los emuladores (npm run emuladores).
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.GCLOUD_PROJECT ??= "demo-blockbridge";
}

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PUERTO = Number(process.env.PORT ?? 5173);
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".pdf": "application/pdf", ".png": "image/png",
};
const PRIVADOS = ["api", "node_modules", "scripts", "test", ".git", ".env", "package.json", "firebase.json", "firestore.rules", ".claude"];

async function api(req, res, nombre) {
  // Solo nombres simples: ni rutas relativas ni los módulos internos de api/_lib.
  if (!/^[a-z]+$/.test(nombre)) return enviar(res, 404, "No encontrado");
  const archivo = join(RAIZ, "api", `${nombre}.js`);
  try {
    await stat(archivo);
  } catch {
    return enviar(res, 404, "No encontrado");
  }
  const manejador = (await import(archivo))[req.method];
  if (!manejador) return enviar(res, 405, "Método no permitido");
  const partes = [];
  for await (const parte of req) partes.push(parte);
  const respuesta = await manejador(new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(partes),
  }));
  res.writeHead(respuesta.status, Object.fromEntries(respuesta.headers));
  res.end(Buffer.from(await respuesta.arrayBuffer()));
}

async function estatico(res, ruta) {
  const relativa = normalize(decodeURIComponent(ruta)).replace(/^([/\\])+/, "");
  if (PRIVADOS.some((p) => relativa === p || relativa.startsWith(p + sep))) return enviar(res, 404, "No encontrado");
  // Igual que cleanUrls de Vercel: /practica sirve practica.html.
  for (const candidata of [relativa || "index.html", `${relativa}.html`, join(relativa, "index.html")]) {
    const archivo = join(RAIZ, candidata);
    if (!archivo.startsWith(RAIZ)) return enviar(res, 403, "Prohibido");
    try {
      if (!(await stat(archivo)).isFile()) continue;
      res.writeHead(200, { "Content-Type": TIPOS[extname(archivo)] ?? "application/octet-stream" });
      return res.end(await readFile(archivo));
    } catch { /* se prueba la siguiente forma de la ruta */ }
  }
  enviar(res, 404, "No encontrado");
}

function enviar(res, estado, texto) {
  res.writeHead(estado, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(texto);
}

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  try {
    const coincide = pathname.match(/^\/api\/([^/]+)$/);
    await (coincide ? api(req, res, coincide[1]) : estatico(res, pathname));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) enviar(res, 500, "Error del servidor de desarrollo");
  }
}).listen(PUERTO, "127.0.0.1", () => console.log(`Sitio en http://localhost:${PUERTO}`));
