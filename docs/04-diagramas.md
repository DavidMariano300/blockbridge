# Diagramas de diseño — BlockBridge Academy v2

| | |
|---|---|
| **Versión** | 2.0 |
| **Fecha** | 29 de octubre de 2026 |
| **Notación** | UML 2.5 (clases, secuencia, estados) y ER (pata de gallo), en Mermaid |

Los identificadores van sin acentos para que funcionen igual en el código, Firestore y Mermaid.

---

## 1. Diagrama de clases del dominio

```mermaid
classDiagram
  direction TB

  class Usuario {
    +uid: string
    +apodo: string
    +rol: Rol
    +avisoVersion: string
    +avisoAceptadoEn: Timestamp
    +creadoEn: Timestamp
    +cambiarApodo(nuevo)
    +exportarDatos() JSON
    +eliminarCuenta()
  }
  class Visitante {
    +uid: string
    +esAnonimo = true
    +registrarse(apodo, correo, pass)
  }
  class Estudiante {
    +consultarHistorial() SesionQuiz[]
  }
  class Docente {
    +crearEjercicio(datos) Ejercicio
    +crearQuiz(datos) Quiz
    +verDashboard(quizId) Dashboard
  }
  class Rol {
    <<enumeration>>
    estudiante
    docente
    admin
  }

  class Ejercicio {
    +id: string
    +titulo: string
    +enunciado: string
    +tema: Tema
    +dificultad: Dificultad
    +toolbox: string[]
    +workspaceInicial: JSON
    +lenguajes: Lenguaje[]
    +numPistas: int
    +origen: string
    +archivado: bool
    +calcularLenguajes() Lenguaje[]
  }
  class ClaveEjercicio {
    +soluciones: JSON[1..5]
    +pistas: string[0..3]
    +explicacion: string
  }
  class Quiz {
    +id: string
    +titulo: string
    +descripcion: string
    +ejercicioIds: string[]
    +lenguajes: Lenguaje[]
    +penalizacionPista: int
    +publicado: bool
    +lenguajesPosibles() Lenguaje[]
  }
  class SesionQuiz {
    +id: string
    +uid: string
    +apodo: string
    +lenguaje: Lenguaje
    +estado: string
    +inicio: Timestamp
    +fin: Timestamp
    +puntaje: float
    +anonimo: bool
    +expiraEn: Timestamp
    +recalcularPuntaje()
  }
  class ResultadoEjercicio {
    +estado: string
    +intentos: int
    +pistas: int
    +inicio: Timestamp
    +tiempoSeg: int
    +puntaje: int
    +ultimoEnvio: Timestamp
  }
  class Evaluador {
    <<servicio>>
    +canonizar(workspace) Canon
    +comparar(canon, soluciones) Veredicto
    +puntajeEjercicio(resuelto, pistas, p) int
    +puntajeQuiz(resultados) float
  }
  class Veredicto {
    +correcto: bool
    +bloqueId: string
    +tipo: TipoDiferencia
  }
  class GeneradorCodigo {
    <<abstract>>
    +lenguaje: Lenguaje
    +generar(workspace) string
  }
  class Tema {
    <<enumeration>>
    variables
    operadores
    salida
    condicionales
    ciclos
    funciones
    arreglos
    cadenas
    poo
  }
  class Dificultad {
    <<enumeration>>
    basico
    intermedio
    avanzado
  }
  class Lenguaje {
    <<enumeration>>
    java
    kotlin
    csharp
    cpp
    c
    python
    javascript
    php
  }

  Visitante <|-- Estudiante
  Usuario <|-- Estudiante
  Estudiante <|-- Docente
  Usuario --> Rol
  Ejercicio "1" *-- "1" ClaveEjercicio : privado
  Docente "1" --> "0..*" Ejercicio : autor
  Docente "1" --> "0..*" Quiz : autor
  Quiz "0..*" o-- "1..*" Ejercicio : ordena
  Visitante "1" --> "0..*" SesionQuiz : realiza
  SesionQuiz "0..*" --> "1" Quiz
  SesionQuiz "1" *-- "1..*" ResultadoEjercicio : por ejercicio
  ResultadoEjercicio "0..*" --> "1" Ejercicio
  Evaluador ..> ClaveEjercicio : lee
  Evaluador ..> Veredicto : produce
  Evaluador ..> SesionQuiz : actualiza
  GeneradorCodigo <|-- GeneradorJava
  GeneradorCodigo <|-- GeneradorPython
  GeneradorCodigo <|-- GeneradorOtros
  Ejercicio --> Tema
  Ejercicio --> Dificultad
```

**Notas**
- `GeneradorOtros` resume Kotlin, C#, C++, C, JavaScript y PHP: cada uno es una instancia de `Blockly.CodeGenerator` con una función por tipo de bloque.
- `Evaluador` es un módulo de funciones puras en `api/_lib/`, sin estado. Por eso se prueba con `node:test` sin Firebase.
- `Visitante` y `Estudiante` son el mismo `uid` de Firebase: registrarse no crea otro usuario, solo vincula la credencial.

---

## 2. Modelo de datos (entidad-relación sobre Firestore)

```mermaid
erDiagram
  USUARIOS {
    string uid PK "id del documento = uid de Auth"
    string apodo "3-30 caracteres"
    string rol "estudiante | docente | admin"
    string avisoVersion
    timestamp avisoAceptadoEn
    timestamp creadoEn
  }
  EJERCICIOS {
    string id PK
    string autorId FK "uid o sistema o baja"
    string titulo
    string enunciado
    string tema
    string dificultad
    array toolbox "tipos de bloque"
    string workspaceInicial "JSON de Blockly como texto"
    array lenguajes
    int numPistas
    string origen "precargado | docente"
    bool archivado
    bool usado "true tras la primera sesion"
    timestamp actualizadoEn
  }
  CLAVE {
    string id PK "fijo: clave"
    array soluciones "1-5 workspaces, JSON como texto"
    array pistas "0-3 textos"
    string explicacion
  }
  QUIZZES {
    string id PK
    string autorId FK
    string titulo
    string descripcion
    array ejercicioIds FK "ordenados"
    array lenguajes
    int penalizacionPista "0-50"
    bool publicado
    string origen
    int orden "posición en el catálogo (solo banco)"
    string tema "para filtrar"
    string dificultad "predominante"
    timestamp actualizadoEn
  }
  SESIONES {
    string id PK
    string uid FK
    string apodo "copia, Invitado si es anonimo"
    string quizId FK
    string autorQuizId "copia para las reglas del dashboard"
    string lenguaje
    string estado "en_curso | finalizada"
    timestamp inicio
    timestamp fin
    float puntaje "0-100"
    array orden "ejercicioIds del quiz al iniciar"
    int penalizacionPista "copia del quiz al iniciar"
    map ejercicios "ejercicioId -> ResultadoEjercicio"
    bool anonimo
    timestamp expiraEn "solo anonimos, limpieza diaria"
  }

  USUARIOS ||--o{ EJERCICIOS : "es autor de"
  USUARIOS ||--o{ QUIZZES : "es autor de"
  USUARIOS ||--o{ SESIONES : "realiza"
  EJERCICIOS ||--|| CLAVE : "subcoleccion privado"
  QUIZZES }o--|{ EJERCICIOS : "contiene"
  QUIZZES ||--o{ SESIONES : "se responde en"
```

**Decisiones del modelo**

| Decisión | Motivo |
|---|---|
| Soluciones, pistas y explicación en la subcolección `ejercicios/{id}/privado/clave` | Firestore autoriza documentos completos, no campos. Para ocultarlos hay que ponerlos en un documento aparte |
| `ejercicios` (resultados) es un *map* dentro de la sesión, no una subcolección | Un quiz tiene de 5 a 15 ejercicios: cabe de sobra en 1 MiB, se actualiza en una sola escritura y el dashboard lee un documento por sesión |
| `apodo` y `autorQuizId` copiados en la sesión | El dashboard no necesita leer `usuarios` (el docente nunca ve correos) y las reglas validan al lector sin hacer `get()` del quiz |
| No se guardan los workspaces enviados | Minimización (RNF-PRI-02); solo cuentan los intentos |
| Soluciones y workspace inicial como texto JSON | Firestore admite como máximo 20 niveles de anidamiento y cada bloque encadenado de Blockly agrega unos tres; el servidor los interpreta al leerlos |
| `expiraEn` solo en sesiones anónimas + limpieza diaria | Borrado automático a los 30 días (RN-12) |
| Correo y contraseña solo en Firebase Auth | El perfil no duplica el correo; la contraseña nunca llega a la aplicación |

**Índices compuestos:** `sesiones(quizId, inicio desc)`, `sesiones(uid, inicio desc)`, `quizzes(publicado, tema, dificultad)`, `ejercicios(autorId, actualizadoEn desc)`.

---

## 3. Diagramas de secuencia

### SD-01 Registro con vinculación de la sesión anónima (CU-02, FA-1)

```mermaid
sequenceDiagram
  autonumber
  actor V as Visitante
  participant UI as Navegador
  participant AU as Firebase Auth
  participant FS as Firestore
  participant API as /api/sesiones

  V->>UI: Llena apodo, correo y contraseña y acepta el aviso
  UI->>UI: Valida formato y casillas
  UI->>AU: linkWithCredential(usuarioAnonimo, EmailAuthProvider.credential)
  AU-->>UI: Mismo uid, ya no es anónimo
  UI->>FS: set usuarios/{uid} {apodo, rol: "estudiante", avisoVersion, avisoAceptadoEn}
  FS->>FS: Reglas: uid propio y rol == "estudiante"
  FS-->>UI: OK
  UI->>API: POST {accion: "reclamar"} + ID token
  API->>AU: verifyIdToken(token, true)
  API->>FS: Quita anonimo y expiraEn de las sesiones del uid y copia el apodo
  API-->>UI: 200 {sesionesReclamadas: n}
  UI->>AU: sendEmailVerification()
  UI-->>V: Catálogo con la sesión iniciada
```

### SD-02 Iniciar quiz (CU-05)

```mermaid
sequenceDiagram
  autonumber
  actor E as Estudiante
  participant UI as Navegador
  participant AU as Firebase Auth
  participant API as /api/sesiones
  participant FS as Firestore

  E->>UI: Elige quiz y lenguaje
  opt Sin sesión
    UI->>AU: signInAnonymously()
  end
  UI->>AU: getIdToken()
  UI->>API: POST {quizId, lenguaje} + Bearer token
  API->>AU: verifyIdToken(token, true)
  API->>FS: get quizzes/{quizId}
  alt No publicado o lenguaje no permitido
    API-->>UI: 400
  else Válido
    API->>FS: getAll(ejercicios públicos)
    API->>FS: create sesiones/{id} {uid, quizId, lenguaje, inicio: serverTimestamp, ejercicios: pendientes, expiraEn?}
    API-->>UI: 201 {sesionId, ejercicios públicos, numPistas}
    UI-->>E: Primer ejercicio + cronómetros
  end
```

### SD-03 Enviar respuesta (CU-08)

```mermaid
sequenceDiagram
  autonumber
  actor E as Estudiante
  participant UI as Navegador (Blockly)
  participant API as /api/respuesta
  participant AU as Firebase Auth
  participant FS as Firestore
  participant EV as Evaluador (módulo puro)

  E->>UI: Pulsa «Comprobar»
  UI->>UI: workspace = serialization.workspaces.save()
  UI->>API: POST {sesionId, ejercicioId, workspace} + token
  API->>AU: verifyIdToken(token, true)
  API->>FS: runTransaction: get sesiones/{sesionId}
  API->>API: ¿sesión del uid? ¿en curso? ¿no resuelto? ¿más de 1 s desde el último envío?
  API->>FS: get ejercicios/{id} y privado/clave
  API->>API: ¿tamaño ≤ 64 KB? ¿bloques dentro de la toolbox?
  API->>EV: comparar(canonizar(workspace), soluciones.map(canonizar))
  EV-->>API: Veredicto
  alt Correcto
    API->>EV: puntajeEjercicio(true, pistas, p) y puntajeQuiz(...)
    API->>FS: update sesión: estado resuelto, intentos+1, tiempoSeg, puntaje del ejercicio y de la sesión
    API-->>UI: 200 {correcto: true, puntaje, explicacion}
    UI-->>E: «¡Correcto!» + explicación
  else Incorrecto
    API->>FS: update sesión: intentos+1, ultimoEnvio
    API-->>UI: 200 {correcto: false, diferencia: {bloqueId, tipo}}
    UI->>UI: Resalta el bloque bloqueId
    UI-->>E: Mensaje según el tipo de diferencia
  end
```

### SD-04 Solicitar pista (CU-07)

```mermaid
sequenceDiagram
  autonumber
  actor E as Estudiante
  participant UI as Navegador
  participant API as /api/pista
  participant FS as Firestore

  E->>UI: Pulsa «Pista»
  UI-->>E: «Resta p puntos. Máximo: X → Y. ¿Continuar?»
  E->>UI: Confirma
  UI->>API: POST {sesionId, ejercicioId} + token
  API->>FS: runTransaction: get sesión y clave
  alt Resuelto o sin pistas restantes
    API-->>UI: 409
  else
    API->>FS: update ejercicios.{id}.pistas += 1
    API-->>UI: 200 {pista: pistas[n], numero: n+1, maximo: Y}
    UI-->>E: Muestra la pista
  end
```

### SD-05 Dashboard y exportación (CU-13)

```mermaid
sequenceDiagram
  autonumber
  actor D as Docente
  participant UI as Navegador
  participant FS as Firestore

  D->>UI: Abre Resultados y elige un quiz
  UI->>FS: query sesiones where quizId == q and autorQuizId == uid o "sistema"
  FS->>FS: Reglas: rol docente, correo verificado, y autorQuizId == uid o "sistema"
  FS-->>UI: Sesiones
  UI->>UI: Agrega en memoria: promedios, rangos, por ejercicio, mejor por uid, anónimos en una fila
  UI-->>D: Tarjetas, gráfica y tablas
  alt CSV
    D->>UI: Pulsa «CSV»
    UI->>UI: Blob(BOM + filas, text/csv) y descarga con un enlace temporal
  else PDF
    D->>UI: Pulsa «PDF»
    UI->>UI: window.print() con @media print
    UI-->>D: Diálogo «Guardar como PDF»
  end
```

### SD-06 Eliminar cuenta (CU-14)

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuario
  participant UI as Navegador
  participant AU as Firebase Auth
  participant API as /api/cuenta
  participant FS as Firestore

  U->>UI: «Eliminar mi cuenta», escribe ELIMINAR y su contraseña
  UI->>AU: reauthenticateWithCredential()
  AU-->>UI: OK (token reciente)
  UI->>API: DELETE + token
  API->>AU: verifyIdToken(token, true) y auth_time < 5 min
  API->>FS: Borra por lotes las sesiones del uid
  opt Es docente
    API->>FS: Sus ejercicios y quizzes pasan a autorId "baja" y quedan archivados
  end
  API->>FS: Borra usuarios/{uid}
  API->>AU: deleteUser(uid)
  API-->>UI: 204
  UI-->>U: «Tu cuenta y tus datos fueron eliminados»
```

---

## 4. Diagramas de estados

### 4.1 Ejercicio dentro de una sesión

```mermaid
stateDiagram-v2
  [*] --> Pendiente : Iniciar quiz
  Pendiente --> Pendiente : Envío incorrecto / intentos+1
  Pendiente --> Pendiente : Pista / pistas+1
  Pendiente --> Resuelto : Envío correcto / puntaje = max(0, 100 - h*p)
  Pendiente --> SinResolver : Finalizar quiz / puntaje = 0
  Resuelto --> [*]
  SinResolver --> [*]
```

### 4.2 Sesión de quiz

```mermaid
stateDiagram-v2
  [*] --> EnCurso : POST /api/sesiones
  EnCurso --> EnCurso : respuesta o pista
  EnCurso --> Finalizada : POST /api/finalizar
  EnCurso --> Expirada : anónima y expiraEn vencido (limpieza)
  Finalizada --> Expirada : anónima y expiraEn vencido (limpieza)
  EnCurso --> Reclamada : el usuario se registra
  Reclamada --> EnCurso
  Finalizada --> Eliminada : el usuario elimina su cuenta
  Expirada --> [*]
  Eliminada --> [*]
```

---

## 5. Matriz de permisos (Security Rules)

`C` crear · `L` leer · `A` actualizar · `B` borrar · `—` denegado · **Servidor** = Admin SDK desde Vercel, que salta las reglas.

| Ruta | Visitante / Estudiante | Docente (correo verificado) | Servidor |
|---|---|---|---|
| `usuarios/{uid}` propio | C (solo `rol == "estudiante"`), L, A (solo `apodo`) | igual | CLAB |
| `usuarios/{otro}` | — | — | CLAB |
| `ejercicios/{id}` | — (los recibe de `/api/sesiones`, sin soluciones) | L todos (escribe por `/api/ejercicios`) | CLAB |
| `ejercicios/{id}/privado/clave` | — | L solo si es autor del ejercicio | CLAB |
| `quizzes/{id}` | L si `publicado` | L todos (escribe por `/api/quizzes`) | CLAB |
| `sesiones/{id}` | L si `uid` propio | L si `autorQuizId == uid` o `"sistema"` (la consulta debe filtrar por `autorQuizId`) | CLAB |
| Cualquier otra ruta | — | — | — |

Desde la iteración 5, ejercicios y quizzes los escribe solo el servidor: `/api/ejercicios` y `/api/quizzes` exigen rol docente con correo verificado y validan con las mismas reglas que el banco precargado (`js/bloques/validar.js`): bloques dentro de la paleta, de 1 a 5 soluciones distintas, lenguajes calculados (RN-10), solución fija si el ejercicio ya se respondió (RN-13) y quizzes con resultados que solo cambian sus textos. Las reglas de Firestore quedan en "el cliente lee, el servidor escribe".

Cada regla tiene su prueba de permitir y de denegar en el emulador (RNF-SEG-13): [firestore.rules](../firestore.rules) y [test/reglas.test.js](../test/reglas.test.js).

---

## 6. Despliegue

```mermaid
flowchart TB
  subgraph Cliente["Dispositivo del usuario"]
    B["Navegador"]
  end
  subgraph CDN["CDN público (jsDelivr)"]
    LIB["Blockly y Firebase JS SDK, versión exacta"]
  end
  subgraph VER["Vercel (Hobby)"]
    S["/ (HTML, CSS, JS estáticos)"]
    F["/api/* Node.js Functions + firebase-admin"]
    ENV[["Variables de entorno: FIREBASE_SERVICE_ACCOUNT"]]
  end
  subgraph GCP["Firebase (Spark)"]
    A["Authentication"]
    D[("Firestore, región nam5")]
  end
  B -->|HTTPS| S
  B -->|HTTPS| LIB
  B -->|HTTPS + ID token| F
  B -->|SDK| A
  B -->|SDK + reglas| D
  F --> A
  F --> D
  ENV -.-> F
```

**Estructura de carpetas prevista**

```
index.html  quiz.html  docente.html  cuenta.html  privacidad.html
css/app.css
js/firebase.js  js/bloques.js  js/generadores/{java,kotlin,csharp,cpp,c,python,javascript,php}.js
js/quiz.js  js/docente.js  js/dashboard.js
api/sesiones.js  api/respuesta.js  api/pista.js  api/finalizar.js  api/cuenta.js
api/_lib/{auth.js, evaluador.js}
firestore.rules  firestore.indexes.json  vercel.json
scripts/seed.js  contenido/{ejercicios,quizzes}.json
test/{evaluador,generadores}.test.js  test/reglas.test.js
```
