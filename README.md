# BlockBridge Academy v2

Quizzes de programación con bloques: el estudiante arma el programa con bloques, ve el código en 8 lenguajes (Java, Kotlin, C#, C++, C, Python, JavaScript y PHP) y recibe una calificación de 0 a 100. El docente crea ejercicios y quizzes y consulta los resultados de su grupo. Requisitos, casos de uso y diseño en [docs/](docs/00-vision-alcance-stack.md).

**Sitio:** https://blockbridge-academy.vercel.app

**Stack:** HTML + CSS + JavaScript nativo (sin compilación) · Blockly · Firebase Authentication y Firestore · Vercel Functions.

## Estado

| Iteración | Contenido | Estado |
|---|---|---|
| 0 | Documentación de Ingeniería de Software | Hecha |
| 1 | Autenticación (invitado, registro, vinculación, login, recuperación), perfil y reglas de Firestore con pruebas | Hecha |
| 2 | Catálogo de bloques, generadores de Python y JavaScript, práctica libre | Hecha |
| 3 | Quiz completo: sesiones, comparación estructural, pistas, puntaje y resumen | Hecha |
| 4 | Generadores de Java, Kotlin, C#, C++, C y PHP; banco de 27 ejercicios y 10 quizzes | Hecha |
| 5 | Panel docente: ejercicios con vista previa, quizzes, resultados, CSV y PDF | Hecha |
| 6 | Privacidad (descargar datos, eliminar cuenta, TTL, limpieza diaria), historial, términos de uso, auditoría de accesibilidad | Hecha |
| — | Despliegue en Firebase y Vercel | Hecho: https://blockbridge-academy.vercel.app |

## Desarrollo local

Requisitos: Node 18 o superior, Java 11 o superior y Python 3 (para las pruebas). Ejecuta `npm install` una vez. Los scripts descargan Node 22 y `firebase-tools` 13.35.1 la primera vez, sin instalar nada en el sistema; se usa la versión 13 porque la 14 en adelante exige Java 21.

En una terminal, los emuladores de Auth (9099) y Firestore (8085), con su interfaz en http://127.0.0.1:4000:

```bash
npm run emuladores
```

En otra, carga el banco de ejercicios (los emuladores no guardan datos: se repite al reiniciarlos):

```bash
npm run seed
```

Opcional: datos de demostración con un docente, 8 alumnos ficticios y 47 sesiones. Las credenciales de prueba están en [scripts/demo.js](scripts/demo.js) y solo funcionan en los emuladores:

```bash
npm run demo
```

Y el sitio, con las funciones de `/api`, en http://localhost:5173:

```bash
npm run dev
```

En `localhost` la app se conecta sola a los emuladores con el proyecto `demo-blockbridge`, que no existe en la nube. Los correos de verificación y recuperación aparecen en la pestaña *Authentication* de la interfaz de los emuladores.

## Pruebas

Evaluador, generadores, banco y retención. Cada programa de referencia y cada solución del banco se genera, se compila con advertencias como errores y se ejecuta en los lenguajes cuyo compilador esté instalado (`javac`, `gcc`, `g++`, `python3` y `node`; también `kotlinc`, `csc` + `dotnet` y `php` si existen); el resto se omite avisándolo. Kotlin, C# y PHP tienen además pruebas de formato exacto:

```bash
npm test
```

Reglas de Firestore y API contra los emuladores: sin puertas traseras, sesiones ajenas, bloques no permitidos, límite de envíos, pistas, puntaje, panel docente, eliminación de cuenta y limpieza. Detén antes `npm run emuladores`, porque esta prueba levanta los suyos:

```bash
npm run test:emulador
```

## Asignar el rol docente

No existe ningún endpoint ni pantalla para cambiar roles: esa es la garantía de que no hay puertas traseras. Procedimiento completo en [docs/02-casos-de-uso.md](docs/02-casos-de-uso.md) (CU-15):

1. El docente se registra y verifica su correo.
2. El DBA cambia `usuarios/{uid}.rol` a `"docente"` en la Consola de Firebase (en local, en la interfaz de los emuladores).
3. El docente pulsa «Ya verifiqué mi correo» o vuelve a iniciar sesión, y le aparece «Panel docente» en el encabezado.

## Puesta en producción

El sitio está en https://blockbridge-academy.vercel.app (proyecto de Firebase `blockbridge-academy`). Estos pasos sirven para repetir el despliegue en otro proyecto. `package.json` fija `jose` en 4.15.9 porque el runtime de Vercel no admite el `require()` que `jwks-rsa` hace de `jose` 6, que solo es ESM.

1. Crea el proyecto en Firebase. En *Authentication*, habilita los proveedores **Anónimo** y **Correo/contraseña**, la política de contraseñas (8 caracteres con letras y números) y la protección contra enumeración de correos.
2. Crea Firestore y publica las reglas:
   ```bash
   npm run firebase -- deploy --only firestore:rules --project TU_PROYECTO
   ```
   Las sesiones de invitado vencidas las borra `/api/limpieza` a diario. La política TTL de `firestore.indexes.json` es opcional y exige facturación activa (plan Blaze); para publicarla, agrega `firestore:indexes` al comando.
3. Copia la configuración web del proyecto en `PRODUCCION`, dentro de [js/firebase.js](js/firebase.js).
4. Genera una clave de cuenta de servicio (Configuración del proyecto, Cuentas de servicio). En Vercel define dos variables de entorno: `FIREBASE_SERVICE_ACCOUNT` con el JSON completo de la clave y `CRON_SECRET` con una cadena aleatoria (`openssl rand -hex 32`). Nunca las subas al repositorio.
5. Carga el banco con la misma clave y borra después el archivo:
   ```bash
   FIREBASE_SERVICE_ACCOUNT="$(cat clave.json)" npm run seed
   ```
6. Importa la carpeta en Vercel (Node 22). [vercel.json](vercel.json) ya trae los encabezados de seguridad (CSP) y la tarea diaria `/api/limpieza`; `.vercelignore` deja fuera pruebas, scripts y el respaldo de la v1.
7. [privacidad.html](privacidad.html) y [terminos.html](terminos.html) están escritos para un proyecto académico. Para atender a personas reales, agrega al responsable con su domicilio y contacto y haz que alguien con conocimientos legales los revise.

Los 27 ejercicios precargados y sus soluciones están en este repositorio, así que sirven para practicar. Para calificar de verdad usa ejercicios creados por el docente: viven en Firestore y sus soluciones nunca llegan al navegador.

### Protección contra abuso

`/api/sesiones` admite 20 sesiones nuevas por usuario cada hora. Para rechazar además a los clientes automatizados, con App Check:

1. Crea una clave de reCAPTCHA para tu dominio y copia la clave de sitio (pública) en `RECAPTCHA_SITIO`, dentro de [js/firebase.js](js/firebase.js). Cualquier clave secreta se queda fuera del repositorio.
2. En la Consola de Firebase, en *App Check*, registra la app web con el proveedor Fraud Defense (reCAPTCHA Enterprise). Despliega el sitio.
3. Comprueba en las métricas de App Check que las peticiones llegan verificadas. Luego define `EXIGIR_APP_CHECK=si` en Vercel, vuelve a desplegar y activa la aplicación obligatoria para Firestore en la consola.

El plan Hobby de Vercel es para uso no comercial: sirve para el proyecto académico. Para usarlo con una institución, cambia a Vercel Pro o a Firebase Hosting con Cloud Functions.

## Estructura

```
index.html practica.html quiz.html cuenta.html docente.html   páginas
privacidad.html terminos.html            avisos legales
css/app.css                              sistema de diseño: tokens claro/oscuro y componentes
fonts/                                   Atkinson Hyperlegible Next y Mono (OFL), alojadas localmente
js/interfaz.js                           tema claro/oscuro y menú móvil (se carga en <head>)
js/firebase.js js/sesion.js js/api.js    Firebase, sesión y encabezado, llamadas a /api
js/editor.js js/codigo.js js/retro.js    editor de bloques, código generado y retroalimentación
js/inicio.js js/practica.js js/quiz.js js/cuenta.js   lógica de cada página
js/docente*.js                           panel docente: listas y quizzes, editor de ejercicios, resultados
js/bloques/                              bloques, evaluador, validación y un generador por lenguaje
api/                                     funciones de Vercel; api/_lib: Firebase Admin, HTTP, sesión, cuenta y retención
contenido/banco.js                       banco precargado (27 ejercicios, 10 quizzes)
scripts/                                 servidor de desarrollo, carga del banco, datos de demostración
firestore.rules  firestore.indexes.json  reglas y política TTL
test/                                    pruebas (node:test)
docs/                                    documentación en Markdown y PDF (./docs/generar-pdf.sh)
```
