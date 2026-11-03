# Salón 3D: notas del proyecto

Un salón de unos 7 × 5,5 m (2,7 m de alto) que se recorre en primera persona en el navegador.
Para abrirlo basta con hacer **doble clic en `index.html`**: no hace falta servidor ni conexión a internet.

## Qué hay en la carpeta

| Archivo | Contenido |
|---|---|
| `index.html` | Página principal: lienzo, interfaz (pantalla de inicio, mira, avisos, botones, joystick) y estilos. |
| `js/texturas.js` | Todas las texturas, generadas con `<canvas>` y un generador pseudoaleatorio con semilla (salen siempre iguales). |
| `js/muebles.js` | Utilidades de geometría y los modelos de cada mueble u objeto. |
| `js/app.js` | Escena, materiales, colocación de los muebles, luces, momentos del día, controles, colisiones, interacción y bucle. |
| `lib/three.min.js` | Three.js r158 (copia local, licencia MIT en `lib/three-LICENSE.txt`). |

No se carga nada de fuera: ni CDN, ni modelos, ni imágenes, ni fuentes. Las únicas peticiones que hace la página son a estos 5 archivos (comprobado, ver más abajo).

## Controles

**Ordenador**
- `W A S D` o flechas: moverse. `Mayús`: ir más rápido.
- Ratón: mirar (se bloquea el puntero al pulsar «Entrar»; `Esc` pausa).
- Clic o `E` sobre una lámpara (o la tele, o el interruptor junto a la puerta): encender o apagar. Cuando la mira pasa por encima de algo que se puede usar, se agranda y aparece una etiqueta.
- `1` `2` `3` `4`: atajos para la lámpara de pie, la de mesa, la de techo y la tele.
- `T` o el botón ☀️: alternar día, atardecer y noche. `F`: mostrar los fps.
- Si el navegador no permite bloquear el puntero, se pasa a mirar arrastrando con el ratón.

**Móvil o tableta**
- El pulgar izquierdo (en cualquier punto del 42 % izquierdo de la pantalla) hace aparecer un joystick para caminar.
- Arrastrar en el resto de la pantalla sirve para mirar. Se puede andar y mirar a la vez con dos dedos.
- Un toque corto sobre una lámpara la enciende o la apaga.
- En vertical se amplía el campo de visión para no ver la habitación «por una rendija».

## La habitación y sus objetos (todos modelados por código)

1. **Sofá** de tres plazas: base, cojines de asiento y de respaldo, brazos, patas troncocónicas de nogal, dos cojines decorativos y una manta sobre el brazo.
2. **Sillón** mostaza con patas abiertas en ángulo y un cojín.
3. **Mesa de centro** de roble con balda inferior. Encima hay libros, una taza (torno), un cuenco de nogal con fruta y revistas.
4. **Estantería** de nogal con unos 150 libros generados al azar (de pie, tumbados o inclinados), un jarrón, una esfera cerámica, una suculenta y una foto.
5. **Mueble de TV** con puertas de listones, tiradores de latón y un **televisor** que se enciende al hacer clic.
6. **Lámpara de pie** de trípode con pantalla de lino (interactiva).
7. **Mesa auxiliar** de mármol con **lámpara de mesa** de cerámica (interactiva).
8. **Lámpara de techo** de campana (interactiva, también desde el **interruptor** de la pared).
9. **Planta** grande en maceta de terracota: hojas curvadas con textura transparente.
10. **Aparador** blanco con jarrón de espigas secas, foto enmarcada y tocadiscos.
11. **Alfombra** tipo kilim, **cortinas** con pliegues, **radiador** de columnas, **puerta** con cuarterones, dos **cuadros**, un **reloj** de pared que da la hora real, rodapiés, molduras, ventana con parteluz y una maceta en el alféizar.

Texturas generadas: tarima de roble (tablas con vetas, nudos, juntas y una textura que enlaza sin costuras), yeso de pared, tela tejida (varios colores), madera de nogal y de roble, alfombra, lomos de libro, hoja, dos cuadros, foto, esfera del reloj, contenido de la tele y la vista exterior en tres versiones: día, atardecer (con sol) y noche (con estrellas, luna y una casa con luz).

## Decisiones de diseño

**Three.js r158 como script clásico (UMD).** Es la última versión que trae `build/three.min.js`. Con módulos ES, Chrome bloquea la carga desde `file://`, así que el usuario tendría que montar un servidor. Con el script clásico funciona con doble clic. Three avisa por consola de que ese formato está en desuso; es un aviso, no un error.

**Iluminación.**
- **Sol direccional** con mapa de sombras de 2048 px. Entra por la ventana y dibuja en el suelo el parche de luz con la sombra del parteluz. Al atardecer entra rasante y se proyecta en la pared de la estantería.
- **Luz de cielo**: un foco suave sin sombras, colocado detrás de la ventana, que hace de luz difusa del cielo.
- **Rebote**: una luz puntual situada *bajo* el parche de sol. Ilumina el techo y las paredes desde abajo, como la luz que rebota en el suelo soleado, pero no el propio suelo. Es una iluminación global barata.
- **Luz hemisférica** y un **mapa de entorno** (PMREM) generado a partir de una pequeña escena sintética, sin descargar ningún HDR. Gracias a él el latón y la cerámica tienen reflejos.
- **Haz de luz falso**: un prisma aditivo calculado a partir de las esquinas de la ventana y la dirección del sol, más 350 motas de polvo animadas en la GPU.
- **Lámparas** con luces puntuales y materiales emisivos (pantalla y bombilla). La de techo proyecta sombras, así que la campana deja el techo en penumbra, como una lámpara real.
- Tone mapping ACES y unidades físicas de luz (el modo por defecto de r158).
- Tres momentos del día. Cada uno cambia el color y la intensidad de las luces, el fondo exterior, la intensidad de los reflejos y la exposición.

**Colisiones.** Se hacen en 2D, en el plano del suelo. El jugador es un círculo de 26 cm de radio y cada pared o mueble es un rectángulo, que se calcula sobre todo con la caja envolvente del modelo ya colocado. Los muebles con formas raras (planta, lámpara de pie) usan un rectángulo a mano. El movimiento va eje a eje y en subpasos de 5 cm como máximo, de modo que se desliza a lo largo de paredes y muebles en vez de quedarse pegado, y no hay forma de «saltarse» un obstáculo aunque baje mucho la tasa de fotogramas.

**Rendimiento** (requisito de que vaya fluido en un portátil normal):
- La escena es estática, así que **los mapas de sombras no se recalculan cada fotograma** (`shadowMap.autoUpdate = false`). Sólo se recalculan al cambiar el momento del día.
- Los ~150 libros forman **una sola geometría** con colores por vértice: una única llamada de dibujo. Los radiadores también van fusionados.
- La lámpara de pie no proyecta sombras propias (su pantalla es de tela). Así nos ahorramos un mapa de sombras cúbico. Midiendo en el renderizador por software, cada sombra puntual costaba alrededor de un 12 % del fotograma.
- **Calidad adaptativa**: la resolución interna empieza como mucho en 1,5× y baja en pasos de 0,25 (hasta 0,75×) si la media cae por debajo de 40 fps. Los fps se miden con el tiempo real; en una primera versión usaba el `dt` recortado y el contador daba siempre 60 aunque fuera lento.
- Los shaders se **precompilan** (`renderer.compile`) antes del primer fotograma para evitar tirones al empezar.
- El raycast de la mira se hace 10 veces por segundo, no en cada fotograma (tarda unos 0,16 ms).
- Coste medido: **232 llamadas de dibujo y unos 33 000 triángulos** por fotograma, 24 texturas y 17 programas de shader.

**Problemas encontrados y corregidos durante las pruebas**
- *Sombras puntuales que no tapaban*: en three.js el `bias` de las luces puntuales se aplica sobre la distancia normalizada por `far`. Con `far = 500`, un `bias` de −0,004 equivalía a unos 2 m de desfase, y la luz de la lámpara de techo «atravesaba» la campana. Ahora `far = 10`.
- *UV de las cajas redondeadas*: al redistribuir los vértices hacia las aristas, la textura se estiraba (la alfombra salía como rayas gigantes). Ahora las UV se recalculan a partir de la posición final.
- *Sol demasiado débil*: con unidades físicas, una intensidad de 3,6 sobre un suelo inclinado apenas destacaba. Subí el sol a 14 y bajé la luz de rebote bajo el suelo para que el parche de sol tenga contraste.
- *Salto de cámara al bloquear el ratón*: Chrome puede mandar un `movementX` enorme justo después de `requestPointerLock`. Se descartan los saltos de más de 250 px.

## Cómo lo he comprobado

Usé Chromium 130 sin interfaz, controlado con Playwright (instalado sólo en una carpeta temporal, no en el proyecto) y con WebGL por software (SwiftShader). Primero tuve que quitar la variable `DISPLAY` del entorno, porque ANGLE intentaba conectarse a un servidor X sin permisos.

1. **Carga sin red ni errores**: registré todas las peticiones de la página. Sólo se piden los 5 archivos locales (`file://`) y no hay ninguna externa. La consola no muestra errores (sólo el aviso de desuso de `three.min.js`).
2. **Capturas** desde varios puntos de vista y en los tres momentos del día, con distintas combinaciones de lámparas. Las fui revisando y con ellas encontré y corregí: un techo demasiado oscuro, un yeso con manchas, motas de polvo gigantes, la alfombra estirada, el fallo de sombras de la lámpara de techo y la falta de contraste del parche de sol.
3. **Pruebas funcionales automáticas** (36 comprobaciones; resultado final: todas correctas):
   - Teclado: `W` avanza en la dirección de la mirada y las flechas desplazan.
   - Ratón con el puntero bloqueado: `movementX` gira la vista.
   - Colisiones: caminar 3 s corriendo contra las cuatro paredes y contra el sofá (por delante y por detrás), la mesa, la estantería, el mueble de TV, el sillón, el aparador, la lámpara de pie y la planta. En todos los casos el jugador avanza y se detiene sin solapar nada. Además hice un paseo aleatorio de 20 000 pasos (unos 700 m) con la función de movimiento real: 0 posiciones dentro de obstáculos o fuera de la habitación.
   - Interacción: clic sobre cada una de las tres lámparas → cambian de estado; tecla `E` → vuelven a cambiar; clic en una pared → no cambia nada. `T` y el botón cambian el momento del día. `Esc` muestra la pausa.
   - **Móvil** (emulación de 390 × 844 con pantalla táctil, eventos táctiles reales por el protocolo DevTools): se detecta el dispositivo táctil, el joystick mueve al jugador, arrastrar gira la vista, dos dedos permiten andar y mirar a la vez, tocar la lámpara de pie la apaga y el botón de día/noche responde al toque.
4. **Rendimiento**: no tengo GPU en este entorno, así que no puedo dar los fps reales de un portátil (SwiftShader renderiza con la CPU y va a pocos fps). Lo que sí medí es el coste relativo de cada parte para decidir qué recortar (las sombras puntuales, por ejemplo). Además dejé el contador de fps (`F`) y la calidad adaptativa, que se encarga de mantener la fluidez en equipos modestos. La escena es ligera para cualquier GPU actual: unas 230 llamadas de dibujo, 33 000 triángulos y sombras estáticas.

**Limitaciones honestas**
- No lo he probado en un móvil ni en un portátil físicos; el táctil se probó por emulación.
- Si el navegador no tiene WebGL, sólo se muestra un aviso pidiendo que se active.
- La puerta es decorativa (no se abre) y la habitación es la única estancia.
