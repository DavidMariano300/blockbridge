# BlockBridge Academy

Programming quizzes built with blocks. Students assemble a program with blocks, see the generated code in 8 languages (Java, Kotlin, C#, C++, C, Python, JavaScript and PHP) and get a score from 0 to 100. Teachers create exercises and quizzes and review their students' results.

**Live site:** https://blockbridge-academy.vercel.app

**Stack:** HTML + CSS + vanilla JavaScript (no build step) · Blockly · Firebase Authentication and Firestore · Vercel Functions.

The app and its engineering documents ([docs/](docs/00-vision-alcance-stack.md)) are in Spanish, because the project targets Spanish-speaking students.

## Highlights

- **Structural grading:** answers are compared block by block against registered solutions, on the server. Variable names don't affect the result, and the feedback points to the block where the program diverges.
- **Eight code generators** that share a type inference and class analysis layer. Reference programs are compiled and run in the tests.
- **No back doors:** clients can't write exercises, quizzes or sessions. Those writes go through the API, and roles can only be changed from the Firebase console.
- **Privacy:** data export, account deletion and automatic retention cleanup.
- **Tested and audited:** 278 unit tests, 45 tests against the Firebase emulators, a WCAG 2.1 AA audit with axe-core and a security review.

## Status

| Iteration | Scope | Status |
|---|---|---|
| 0 | Software engineering documentation | Done |
| 1 | Authentication (guest, sign-up, account linking, login, recovery), profiles and tested Firestore rules | Done |
| 2 | Block catalog, Python and JavaScript generators, free practice | Done |
| 3 | Full quiz flow: sessions, structural comparison, hints, scoring and summary | Done |
| 4 | Java, Kotlin, C#, C++, C and PHP generators; bank of 27 exercises and 10 quizzes | Done |
| 5 | Teacher panel: exercises with preview, quizzes, results, CSV and PDF | Done |
| 6 | Privacy (data download, account deletion, daily cleanup), history, terms of use, accessibility audit | Done |
| — | Deployment on Firebase and Vercel | Done |

## Local development

Requirements: Node 18 or later, Java 11 or later and Python 3 (for the tests). Run `npm install` once. The scripts download Node 22 and `firebase-tools` 13.35.1 on first use without installing anything system-wide; version 13 is used because 14 and later require Java 21.

In one terminal, start the Auth (9099) and Firestore (8085) emulators, with their UI at http://127.0.0.1:4000:

```bash
npm run emuladores
```

In another, load the exercise bank (the emulators don't persist data, so repeat this after restarting them):

```bash
npm run seed
```

Optional demo data, with one teacher, 8 fictional students and 47 sessions. The test credentials are in [scripts/demo.js](scripts/demo.js) and only work on the emulators:

```bash
npm run demo
```

Then start the site and the `/api` functions at http://localhost:5173:

```bash
npm run dev
```

On `localhost` the app connects to the emulators automatically, using the `demo-blockbridge` project, which doesn't exist in the cloud. Verification and recovery emails appear in the *Authentication* tab of the emulator UI.

## Tests

Evaluator, generators, exercise bank and retention. Every reference program and every bank solution is generated, compiled with warnings as errors and run in each language whose compiler is installed (`javac`, `gcc`, `g++`, `python3` and `node`, plus `kotlinc`, `csc` + `dotnet` and `php` if present). The rest are skipped with a notice. Kotlin, C# and PHP also have exact-format tests:

```bash
npm test
```

Firestore rules and API against the emulators: back doors, other users' sessions, disallowed blocks, rate limits, hints, scoring, teacher panel, account deletion and cleanup. Stop `npm run emuladores` first, because this command starts its own:

```bash
npm run test:emulador
```

## Assigning the teacher role

There is no endpoint or screen for changing roles, which is what guarantees there are no back doors. The full procedure is in [docs/02-casos-de-uso.md](docs/02-casos-de-uso.md) (CU-15):

1. The teacher signs up and verifies their email.
2. The DBA changes `usuarios/{uid}.rol` to `"docente"` in the Firebase console (locally, in the emulator UI).
3. The teacher signs in again and sees «Panel docente» in the header.

## Production

The site runs at https://blockbridge-academy.vercel.app (Firebase project `blockbridge-academy`). To deploy it to another project:

1. Create a Firebase project. In *Authentication*, enable the **Anonymous** and **Email/password** providers, a password policy and email enumeration protection.
2. Create Firestore and publish the rules:
   ```bash
   npm run firebase -- deploy --only firestore:rules --project YOUR_PROJECT
   ```
   Expired guest sessions are deleted daily by `/api/limpieza`. The TTL policy in `firestore.indexes.json` is optional and requires active billing (Blaze plan); to publish it, add `firestore:indexes` to the command.
3. Copy the project's web configuration into `PRODUCCION`, in [js/firebase.js](js/firebase.js).
4. Generate a service account key (Project settings, Service accounts). In Vercel, set two environment variables: `FIREBASE_SERVICE_ACCOUNT` with the full JSON key and `CRON_SECRET` with a random string (`openssl rand -hex 32`). Never commit them.
5. Load the exercise bank with the same key, then delete the file:
   ```bash
   FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" npm run seed
   ```
6. Import the folder into Vercel (Node 22). [vercel.json](vercel.json) already includes the security headers (CSP) and the daily `/api/limpieza` job; `.vercelignore` leaves out tests, scripts and internal files. `package.json` pins `jose` to 4.15.9 because the Vercel runtime doesn't support the `require()` that `jwks-rsa` makes of `jose` 6, which is ESM-only.
7. [privacidad.html](privacidad.html) and [terminos.html](terminos.html) are written for an academic project. To serve real users, add the data controller's name, address and contact details, and have someone with legal expertise review them.

The 27 preloaded exercises and their solutions are in this repository, so they are meant for practice. For real grading, use exercises created by teachers: those live in Firestore and their solutions never reach the browser.

### Abuse protection

`/api/sesiones` allows 20 new sessions per user per hour. To also reject automated clients with App Check:

1. Create a reCAPTCHA key for your domain and copy the site key (public) into `RECAPTCHA_SITIO`, in [js/firebase.js](js/firebase.js). Any secret key stays out of the repository.
2. In the Firebase console, under *App Check*, register the web app with the Fraud Defense provider (reCAPTCHA Enterprise). Deploy the site.
3. Check in the App Check metrics that requests arrive verified. Then set `EXIGIR_APP_CHECK=si` in Vercel, redeploy and turn on enforcement for Firestore in the console.

Vercel's Hobby plan is for non-commercial use, which fits this academic project. To use it with an institution, move to Vercel Pro or to Firebase Hosting with Cloud Functions.

## Structure

```
index.html practica.html quiz.html cuenta.html docente.html   pages
privacidad.html terminos.html            legal notices
css/app.css                              design system: light/dark tokens and components
fonts/                                   Atkinson Hyperlegible Next and Mono (OFL), self-hosted
js/interfaz.js                           light/dark theme and mobile menu (loaded in <head>)
js/firebase.js js/sesion.js js/api.js    Firebase, session and header, /api calls
js/editor.js js/codigo.js js/retro.js    block editor, generated code and feedback
js/inicio.js js/practica.js js/quiz.js js/cuenta.js   per-page logic
js/docente*.js                           teacher panel: lists and quizzes, exercise editor, results
js/bloques/                              blocks, evaluator, validation and one generator per language
api/                                     Vercel functions; api/_lib: Firebase Admin, HTTP, session, account and retention
contenido/banco.js                       preloaded bank (27 exercises, 10 quizzes)
scripts/                                 dev server, bank loader, demo data
firestore.rules  firestore.indexes.json  rules and TTL policy
test/                                    tests (node:test)
docs/                                    Markdown and PDF documentation (./docs/generar-pdf.sh)
```
