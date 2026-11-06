# Historias de usuario — BlockBridge Academy v2

| | |
|---|---|
| **Versión** | 2.0 |
| **Fecha** | 29 de octubre de 2026 |
| **Formato** | «Como *rol*, quiero *acción*, para *beneficio*». Los criterios de aceptación siguen el esquema **Dado / Cuando / Entonces** |
| **Estimación** | Puntos de historia (Fibonacci). Prioridad MoSCoW |

## Resumen del backlog

| Épica | Historias | Puntos |
|---|---|---|
| E1 Identidad y cuenta | HU-01 a HU-05, HU-18, HU-19 | 17 |
| E2 Resolver quizzes | HU-06 a HU-13 | 42 |
| E3 Contenido docente | HU-14, HU-15, HU-21 | 26 |
| E4 Analítica docente | HU-16, HU-17 | 13 |
| E5 Administración y seguridad | HU-20 | 3 |
| **Total MVP** | **21 historias** | **101** |

> HU-08 (13 puntos) concentra el trabajo de los 8 generadores de código. Si hace falta recortar, se divide en HU-08a (Python, JavaScript y Java) y HU-08b (el resto).

---

## E1 · Identidad y cuenta

### HU-01 Probar sin cuenta
**Como** visitante, **quiero** resolver quizzes sin registrarme, **para** probar la plataforma sin dar mis datos.
*Prioridad:* M · *Puntos:* 2 · *Trazabilidad:* CU-01, RF-01, RF-39

- **CA-1** Dado que no tengo sesión, cuando pulso «Probar sin cuenta», entonces entro al catálogo sin llenar ningún formulario.
- **CA-2** Dado que estoy en modo invitado, cuando veo el catálogo, entonces aparece un aviso de que mi progreso se borra a los 30 días.
- **CA-3** Dado que creé una sesión de quiz como invitado, cuando reviso el documento en Firestore, entonces tiene `anonimo = true` y `expiraEn` a 30 días.

### HU-02 Crear cuenta
**Como** estudiante, **quiero** registrarme con un apodo, mi correo y una contraseña, **para** conservar mi progreso.
*Prioridad:* M · *Puntos:* 3 · *Trazabilidad:* CU-02, RF-02, RF-07, RF-37, RF-38

- **CA-1** Dado el formulario de registro, cuando no he marcado las casillas de aviso de privacidad y de mayoría de edad o autorización, entonces el botón «Crear cuenta» está desactivado.
- **CA-2** Dado que escribo una contraseña de menos de 8 caracteres o sin números, cuando intento enviar, entonces veo qué regla no cumple.
- **CA-3** Dado un registro exitoso, cuando reviso `usuarios/{uid}`, entonces tiene `rol = "estudiante"`, `avisoVersion` y `avisoAceptadoEn`, y me llega un correo de verificación.
- **CA-4** Dado un correo que ya existe, cuando intento registrarme, entonces veo un mensaje genérico que no confirma si el correo está registrado.
- **CA-5** Dado que manipulo la petición para crear mi perfil con `rol = "docente"`, cuando se envía a Firestore, entonces las reglas la rechazan.

### HU-03 Conservar mi progreso de invitado
**Como** visitante que ya resolvió ejercicios, **quiero** que al registrarme se conserve lo que hice, **para** no repetir mi trabajo.
*Prioridad:* M · *Puntos:* 3 · *Trazabilidad:* CU-02 FA-1, RF-03

- **CA-1** Dado que hice una sesión como invitado, cuando me registro, entonces mi `uid` no cambia y la sesión aparece en mi historial.
- **CA-2** Dado lo anterior, cuando reviso la sesión en Firestore, entonces ya no tiene `anonimo` ni `expiraEn`.

### HU-04 Iniciar y cerrar sesión
**Como** usuario registrado, **quiero** entrar con mi correo y contraseña y salir cuando termine, **para** usar mi cuenta en cualquier dispositivo con seguridad.
*Prioridad:* M · *Puntos:* 2 · *Trazabilidad:* CU-03, CU-04, RF-04, RF-06, RF-08

- **CA-1** Dado que mis credenciales son correctas, cuando inicio sesión, entonces veo el catálogo con mi apodo.
- **CA-2** Dado que son incorrectas, cuando inicio sesión, entonces veo «Correo o contraseña incorrectos».
- **CA-3** Dado que soy docente con el correo verificado, cuando inicio sesión, entonces veo el menú Docente. Si mi correo no está verificado, no lo veo y se me ofrece reenviar la verificación.
- **CA-4** Dado que cierro sesión, cuando recargo la página, entonces no hay sesión activa ni workspace guardado.

### HU-05 Recuperar contraseña
**Como** usuario registrado, **quiero** restablecer mi contraseña por correo, **para** recuperar el acceso si la olvido.
*Prioridad:* M · *Puntos:* 1 · *Trazabilidad:* CU-03 FA-1, RF-05

- **CA-1** Dado cualquier correo, exista o no, cuando pido recuperar la contraseña, entonces veo el mismo mensaje: «Si el correo está registrado, te enviamos un enlace».

### HU-18 Eliminar mi cuenta y mis datos
**Como** usuario registrado, **quiero** descargar mis datos y eliminar mi cuenta, **para** ejercer mis derechos sobre mi información.
*Prioridad:* M · *Puntos:* 5 · *Trazabilidad:* CU-14, RF-09, RNF-PRI-04

- **CA-1** Dado que estoy en «Mi cuenta», cuando pulso «Descargar mis datos», entonces obtengo un JSON con mi perfil y mis sesiones.
- **CA-2** Dado que pulso «Eliminar», cuando no escribo «ELIMINAR» o no me reautentico, entonces no se borra nada.
- **CA-3** Dado que confirmo y me reautentico, cuando termina el proceso, entonces no queda en Firestore ningún documento con mi `uid` y mi usuario ya no existe en Authentication.
- **CA-4** Dado que soy docente, cuando elimino mi cuenta, entonces mis quizzes quedan archivados con `autorId = "baja"` y los resultados de mis estudiantes se conservan.

### HU-19 Cambiar mi apodo
**Como** usuario registrado, **quiero** cambiar mi apodo, **para** corregirlo o dejar de usar uno que me identifique.
*Prioridad:* S · *Puntos:* 1 · *Trazabilidad:* CU-14 FA-2, RF-10

- **CA-1** Dado un apodo de 3 a 30 caracteres, cuando lo guardo, entonces se refleja en mis sesiones nuevas.
- **CA-2** Dado que intento modificar otro campo de mi perfil, como `rol`, cuando se envía, entonces las reglas lo rechazan.

---

## E2 · Resolver quizzes

### HU-06 Elegir quiz y lenguaje
**Como** estudiante, **quiero** filtrar los quizzes por tema, dificultad y lenguaje y elegir en qué lenguaje ver mi código, **para** practicar lo que necesito en el lenguaje de mi curso.
*Prioridad:* M · *Puntos:* 3 · *Trazabilidad:* CU-05, RF-11, RF-12, RF-13

- **CA-1** Dado el catálogo, cuando filtro por «Ciclos» y «Básico», entonces solo veo quizzes que cumplen ambos filtros.
- **CA-2** Dado un quiz de POO, cuando elijo el lenguaje, entonces C no aparece entre las opciones.
- **CA-3** Dado que inicio un quiz, cuando inspecciono la respuesta de `/api/sesiones`, entonces no contiene soluciones, pistas ni explicaciones.
- **CA-4** Dado que tengo una sesión en curso del mismo quiz, cuando vuelvo a entrar, entonces se me ofrece continuarla o empezar de nuevo.

### HU-07 Armar mi programa con bloques
**Como** estudiante, **quiero** arrastrar y conectar bloques en cualquier dispositivo, **para** construir la solución sin preocuparme por la sintaxis.
*Prioridad:* M · *Puntos:* 5 · *Trazabilidad:* CU-06, RF-14, RF-16, RF-22, RF-26, RNF-USA-01, RNF-USA-02

- **CA-1** Dado un ejercicio, cuando abro la toolbox, entonces solo aparecen los bloques que el ejercicio permite.
- **CA-2** Dado un teléfono de 360 px, cuando abro el ejercicio, entonces el enunciado, los bloques y el código aparecen en pestañas, puedo arrastrar bloques con el dedo y la página no se desplaza horizontalmente.
- **CA-3** Dado que estoy resolviendo, cuando miro la pantalla, entonces veo un cronómetro del ejercicio y otro del quiz.
- **CA-4** Dado que recargo la página por accidente, cuando vuelvo al ejercicio, entonces mis bloques siguen ahí.
- **CA-5** Dado que pulso «Omitir», cuando avanzo, entonces el ejercicio queda pendiente y puedo volver a él.

### HU-08 Ver el código en el lenguaje que elija
**Como** estudiante, **quiero** ver en tiempo real el código que generan mis bloques y cambiar de lenguaje, **para** relacionar la lógica con la sintaxis real.
*Prioridad:* M · *Puntos:* 13 · *Trazabilidad:* CU-06, RF-15, RNF-REN-04, RNF-MAN-01, RNF-MAN-02

- **CA-1** Dado un programa de bloques, cuando muevo o edito un bloque, entonces el código se actualiza en menos de 100 ms.
- **CA-2** Dado un programa, cuando cambio de Python a Java, entonces los bloques no cambian y el código aparece en Java, con `public class Main` y `main`.
- **CA-3** Dado el programa de referencia de cada tema, cuando ejecuto `node --test`, entonces los 8 generadores producen exactamente la salida esperada.
- **CA-4** Dado un bloque nuevo sin función en algún generador, cuando ejecuto las pruebas, entonces fallan indicando qué lenguaje falta.

### HU-09 Pedir una pista
**Como** estudiante atorado, **quiero** pedir pistas sabiendo cuánto me costarán, **para** decidir si me conviene usarlas.
*Prioridad:* M · *Puntos:* 3 · *Trazabilidad:* CU-07, RF-17, RN-01, RN-04

- **CA-1** Dado un quiz con penalización de 20, cuando pulso «Pista», entonces veo «Esta pista resta 20 puntos. Puntaje máximo: de 100 a 80» y puedo cancelar sin penalización.
- **CA-2** Dado que confirmo, cuando recibo la pista, entonces el servidor registra `pistas = 1` en la sesión.
- **CA-3** Dado que ya usé las 3 pistas o el ejercicio ya está resuelto, cuando miro el botón, entonces está desactivado.
- **CA-4** Dado que resuelvo después de usar 2 pistas con penalización de 20, cuando veo mi puntaje, entonces es 60.

### HU-10 Saber al momento que acerté
**Como** estudiante, **quiero** saber de inmediato si mi respuesta es correcta y por qué, **para** reforzar lo que aprendí.
*Prioridad:* M · *Puntos:* 8 · *Trazabilidad:* CU-08, RF-18, RF-19, RF-23, RN-07

- **CA-1** Dada una solución idéntica a la registrada pero con otros nombres de variable y en otra posición del lienzo, cuando pulso «Comprobar», entonces el sistema la acepta.
- **CA-2** Dada una respuesta correcta, cuando recibo la respuesta, entonces veo «¡Correcto!», mi puntaje del ejercicio y la explicación.
- **CA-3** Dado un ejercicio resuelto, cuando intento enviar otra vez o pedir una pista, entonces el sistema no lo permite.
- **CA-4** Dado que modifico en el navegador la petición para marcar el ejercicio como resuelto o escribir mi puntaje en Firestore, cuando se envía, entonces se rechaza.

### HU-11 Saber dónde me equivoqué y reintentar
**Como** estudiante, **quiero** que se me indique en qué bloque me equivoqué y poder reintentar sin perder puntos, **para** aprender del error sin miedo.
*Prioridad:* M · *Puntos:* 5 · *Trazabilidad:* CU-08 FA-1, RF-20, RF-21, RN-03

- **CA-1** Dada una solución con un valor distinto (por ejemplo `i < 10` en vez de `i <= 10`), cuando la compruebo, entonces el bloque de comparación queda resaltado con el mensaje «revisa el valor».
- **CA-2** Dada una solución a la que le falta un bloque, cuando la compruebo, entonces el mensaje indica que falta un bloque a partir del bloque resaltado.
- **CA-3** Dado que fallé 5 veces y luego acierto sin pistas, cuando veo mi puntaje, entonces es 100 y el resumen muestra 6 intentos.
- **CA-4** Dado que envío dos veces en menos de 1 segundo, cuando llega el segundo envío, entonces veo «Espera un momento».

### HU-12 Ver mi calificación final
**Como** estudiante, **quiero** ver al terminar mi calificación de 0 a 100 y el detalle por ejercicio, **para** saber qué repasar.
*Prioridad:* M · *Puntos:* 3 · *Trazabilidad:* CU-09, RF-24, RN-02

- **CA-1** Dado un quiz de 4 ejercicios con puntajes 100, 80, 0 (omitido) y 60, cuando finalizo, entonces mi calificación es 60.0.
- **CA-2** Dado que tengo ejercicios pendientes, cuando pulso «Finalizar», entonces se me avisa que valdrán 0 y se pide confirmación.
- **CA-3** Dado el resumen, cuando lo veo, entonces cada ejercicio muestra estado, intentos, pistas, tiempo y puntaje.
- **CA-4** Dado que soy invitado, cuando veo el resumen, entonces se me ofrece crear una cuenta para conservarlo.

### HU-13 Consultar mi historial
**Como** estudiante registrado, **quiero** ver mis quizzes anteriores, **para** medir mi avance.
*Prioridad:* S · *Puntos:* 2 · *Trazabilidad:* CU-10, RF-25

- **CA-1** Dado que hice 3 sesiones, cuando abro «Mi historial», entonces las veo ordenadas de la más reciente a la más antigua, con quiz, lenguaje, fecha, puntaje y estado.
- **CA-2** Dado que intento leer sesiones de otro `uid` desde la consola del navegador, cuando se ejecuta la consulta, entonces las reglas la rechazan.

---

## E3 · Contenido docente

### HU-14 Crear ejercicios
**Como** docente, **quiero** crear ejercicios armando la solución con bloques y escribiendo pistas y explicación, **para** adaptar la práctica a mi curso.
*Prioridad:* M · *Puntos:* 13 · *Trazabilidad:* CU-11, RF-27, RF-28, RF-29, RF-31

- **CA-1** Dado el editor de ejercicios, cuando guardo sin solución o sin bloque `programa`, entonces no se permite.
- **CA-2** Dado que mi solución usa un bloque que no está en la toolbox, cuando guardo, entonces se señala ese bloque y no se guarda.
- **CA-3** Dado un ejercicio con bloques de POO, cuando lo guardo, entonces sus lenguajes aplicables no incluyen C.
- **CA-4** Dado que pulso «Vista previa», cuando lo resuelvo como estudiante, entonces la validación funciona igual que en un quiz real, sin guardar resultados.
- **CA-5** Dado un ejercicio precargado, cuando pulso «Duplicar», entonces obtengo una copia editable a mi nombre y el original no cambia.
- **CA-6** Dado un ejercicio de otro docente, cuando intento editarlo por la API de Firestore, entonces las reglas lo rechazan.
- **CA-7** Dado un ejercicio ya usado en sesiones, cuando lo elimino, entonces se archiva en lugar de borrarse.

### HU-15 Armar y publicar quizzes
**Como** docente, **quiero** agrupar ejercicios en un quiz, elegir lenguajes y la penalización por pista, **para** evaluar a mis estudiantes.
*Prioridad:* M · *Puntos:* 5 · *Trazabilidad:* CU-12, RF-30

- **CA-1** Dados ejercicios propios y precargados, cuando armo un quiz, entonces puedo agregarlos y reordenarlos.
- **CA-2** Dado un quiz con un ejercicio de POO, cuando elijo lenguajes, entonces C no está disponible.
- **CA-3** Dada una penalización fuera de 0–50, cuando guardo, entonces se rechaza.
- **CA-4** Dado un quiz publicado, cuando lo despublico, entonces desaparece del catálogo y las sesiones existentes se conservan.
- **CA-5** Dado un quiz con sesiones, cuando intento cambiar sus ejercicios, entonces se me ofrece duplicarlo en lugar de editarlo.

### HU-21 Banco de ejercicios precargado
**Como** DBA, **quiero** cargar un banco inicial de ejercicios y quizzes con un script, **para** que el sistema sea útil desde el primer día.
*Prioridad:* M · *Puntos:* 8 · *Trazabilidad:* CU-16, RF-36

- **CA-1** Dados los archivos de contenido, cuando ejecuto el script, entonces hay al menos 27 ejercicios (3 por tema, uno por dificultad) y al menos 9 quizzes publicados.
- **CA-2** Dado un ejercicio inválido en el JSON, cuando ejecuto el script, entonces se informa cuál es y no se carga.
- **CA-3** Dado que ejecuto el script dos veces, cuando reviso Firestore, entonces no hay duplicados.

---

## E4 · Analítica docente

### HU-16 Ver el desempeño de un quiz
**Como** docente, **quiero** un dashboard por quiz con promedios, distribución y detalle por ejercicio y por estudiante, **para** detectar qué temas cuestan más.
*Prioridad:* M · *Puntos:* 8 · *Trazabilidad:* CU-13, RF-32, RF-33, RN-08, RNF-PRI-05

- **CA-1** Dado un quiz con sesiones, cuando abro su dashboard, entonces veo número de sesiones, promedio, distribución en 5 rangos y, por ejercicio, % de acierto, intentos, pistas y tiempo promedio.
- **CA-2** Dado un estudiante con 3 sesiones (40, 85 y 70), cuando veo la tabla, entonces aparece una vez con mejor puntaje 85 y 3 sesiones.
- **CA-3** Dadas sesiones de invitados, cuando veo la tabla, entonces solo aparecen en una fila agregada, nunca por separado.
- **CA-4** Dada la tabla, cuando la reviso, entonces muestra apodos y nunca correos.
- **CA-5** Dado un quiz de otro docente, cuando intento leer sus sesiones, entonces las reglas lo rechazan.

### HU-17 Exportar resultados
**Como** docente, **quiero** descargar los resultados en CSV y en PDF, **para** registrarlos en mis listas y entregarlos.
*Prioridad:* M · *Puntos:* 5 · *Trazabilidad:* CU-13 FA-1 y FA-2, RF-34, RF-35

- **CA-1** Dado el dashboard filtrado, cuando pulso «CSV», entonces se descarga `resultados-<quiz>-<fecha>.csv`, que se abre en Excel con los acentos correctos y solo contiene las filas filtradas.
- **CA-2** Dado el dashboard, cuando pulso «PDF», entonces la vista de impresión oculta la navegación, incluye encabezado con quiz, fecha y filtros, y las tablas no se cortan a mitad de fila.

---

## E5 · Administración y seguridad

### HU-20 Asignar rol docente sin puertas traseras
**Como** DBA, **quiero** que el rol docente solo pueda asignarse desde la Consola de Firebase, **para** que nadie se otorgue privilegios desde la aplicación.
*Prioridad:* M · *Puntos:* 3 · *Trazabilidad:* CU-15, RF-07, RF-08, RNF-SEG-02, RNF-SEG-13

- **CA-1** Dado el código fuente, cuando busco endpoints, parámetros o cuentas especiales que cambien roles, entonces no existe ninguno.
- **CA-2** Dadas las pruebas del emulador, cuando un estudiante intenta escribir `rol` en su perfil, entonces se rechaza.
- **CA-3** Dado que cambio un rol en la consola, cuando el usuario vuelve a iniciar sesión, entonces ve (o deja de ver) el menú Docente.
- **CA-4** Dado el procedimiento documentado, cuando asigno un rol, entonces queda anotado en la bitácora.

---

## Definición de terminado (DoD)

Una historia está terminada cuando:
1. Cumple todos sus criterios de aceptación, verificados manualmente o con pruebas.
2. La lógica nueva (canonicalización, puntaje, generadores, reglas) tiene su prueba en `node:test` o en el emulador.
3. Funciona a 360 px y a 1440 px, con contraste AA.
4. No introduce secretos en el repositorio ni texto renderizado con `innerHTML`.
5. Está desplegada en el entorno de Vercel.
