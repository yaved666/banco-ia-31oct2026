# Estancia — La pausa cotidiana

## Abrir la habitación

Abre `index.html` directamente en un navegador con WebGL. No hace falta instalar dependencias, compilar ni disponer de conexión. Todos los recursos están en esta carpeta.

Como alternativa, desde esta carpeta ejecuta `python3 -m http.server 8000` y visita `http://localhost:8000`. Para usarla desde un móvil conectado a la misma red, abre `http://IP_DEL_ORDENADOR:8000`.

## Controles

- **Ordenador:** WASD o flechas para caminar; arrastrar con el botón izquierdo para mirar. «Entrar a explorar» solicita captura del ratón; si se permite, basta moverlo. Esc libera el puntero. Si no se permite, sigue funcionando el arrastre.
- **Móvil:** joystick izquierdo para caminar y deslizamiento sobre la habitación para mirar. Los gestos pueden usarse simultáneamente.
- **Lámpara:** clic o toque directamente sobre ella. Al apuntar hacia ella desde el centro aparece una indicación y se puede usar E, o el botón táctil ☼. La barra inferior también permite conmutarla y muestra su estado.
- **Barra inferior:** ayuda, luz cálida, volver al punto de entrada y pantalla completa cuando el navegador la admite.
- El plano muestra la posición y orientación en tiempo real.

## Diseño y modelado

Elegí un salón de 10 × 8 metros, con techo y cuatro paredes, una ventana real abierta en la geometría del muro, cortinas, zócalos y puerta decorativa cerrada. La altura de los ojos es de 1,64 m. El encuadre inicial enseña el conjunto; al entrar desaparece la introducción.

La paleta combina salvia, lino, terracota y madera cálida. La interfaz utiliza fuentes del sistema, sin fuentes externas. El encuadre y la interfaz se adaptan a pantallas verticales.

Todo el mobiliario está construido en `room.js` con cajas, cilindros, esferas, toro y formas extruidas con biseles. Incluye:

1. Sofá con patas, brazos, cojines, almohadones y manta.
2. Butaca de madera y tapizado.
3. Mesa de centro con tablero redondeado y dos soportes.
4. Mesa auxiliar de tres patas.
5. Lámpara de pie con base, mástil, pantalla y bombilla.
6. Aparador con frentes acanalados y tiradores.
7. Estantería con baldas y libros individuales.
8. Alfombra con bordes y flecos.
9. Dos plantas con macetas, tallos y hojas.
10. Tocadiscos con disco, brazo y dos altavoces.
11. Cuadro geométrico original con marco.
12. Jarrón, libros apilados, taza con asa y platillo.

Las vetas de madera, el tejido y el revoco se generan en Canvas con un generador pseudoaleatorio de semilla fija. El cuadro también está dibujado por código. El paisaje exterior está compuesto de geometrías sencillas. No hay modelos, fotografías, texturas, fuentes ni imágenes descargados.

## Luz y colisiones

La luz direccional cálida representa el sol de tarde y entra por el hueco de la ventana, proyectando la carpintería y los objetos sobre el suelo. Se complementa con luz de cielo hemisférica, relleno de ventana y ambiente suave. La lámpara utiliza una luz puntual cálida; al apagarla se desactivan tanto la luz como la emisión de la pantalla y de la bombilla. La iluminación natural permanece.

El jugador se representa por un círculo de radio 24 cm sobre el plano del suelo. Los muebles tienen volúmenes conservadores independientes de la geometría visual; las paredes limitan el recinto, incluida la ventana y la puerta cerrada. El movimiento se divide en pasos de hasta 7 cm para evitar atravesar obstáculos; resolver los dos ejes por separado permite deslizarse junto a ellos. No se puede saltar ni subirse al mobiliario. La alfombra se considera suelo, y los objetos pequeños colocados sobre muebles quedan dentro de sus obstáculos.

## Rendimiento y dependencias

- Three.js r158 está incluido en `vendor/three.min.js`, con su licencia MIT en `vendor/THREE-LICENSE.txt`. La distribución clásica permite abrir la página también mediante `file://`, sin restricciones de importación de módulos locales. Es la única dependencia de ejecución.
- Se agrupa la geometría estática por material: en la vista inicial se midieron **36 llamadas de dibujo** y aproximadamente **27.500 triángulos**.
- Geometría de complejidad moderada, materiales compartidos, resolución de píxel limitada a 1,65 y texturas procedurales de 512 × 512.
- Un único mapa de sombras de 2048 × 2048 se calcula al iniciar. Como el mobiliario y el sol son estáticos, no se recalcula en cada fotograma. La luz puntual de la lámpara no genera mapas de sombras adicionales.
- No hay posprocesado, cargas remotas, servicios, telemetría ni peticiones de red desde la aplicación.
- Se limpia el estado de movimiento al perder el foco y se informa si no se puede crear el contexto WebGL.

## Comprobaciones realizadas

Se comprobó la sintaxis con `node --check room.js`. Se ejecutó la aplicación en Chromium 134 con Playwright 1.51.1, usando renderizado gráfico por software en este entorno. El navegador más reciente fallaba al iniciar WebGL; en Chromium 134 se resolvió eliminando la variable DISPLAY de la ejecución sin pantalla.

La prueba automatizada `tests/verify.cjs` comprueba:

- Creación real de la escena WebGL y ausencia de excepciones JavaScript.
- Mobiliario y presupuesto de llamadas de dibujo.
- Colisiones en el centro de cada mueble, en las cuatro paredes y punto inicial libre.
- Movimiento mediante teclado y cambio de orientación por arrastre real del ratón.
- Recorrido sostenido contra paredes y muebles sin penetrarlos.
- Clic sobre la geometría de la lámpara para apagar y encender, y conmutación desde la interfaz.
- Reinicio de posición.
- Apertura directa de `index.html` desde disco en un contexto **sin conexión**.
- Pantalla móvil de 390 × 844 con eventos táctiles: toque sobre la lámpara, joystick y deslizamiento para mirar.
- Ausencia de solicitudes a dominios externos.

Los resultados están guardados en `tests/results.json`. Se revisaron capturas reales del navegador: `tests/desktop.png`, `tests/exploring.png` y `tests/mobile.png`. Durante la revisión se corrigió una maceta que invadía el punto de entrada y se ajustó la vista vertical del móvil. También se comprobó que el fondo exterior no bloqueara las sombras del sol.

Las comprobaciones funcionales pasaron. El renderizado por software de este entorno es lento y no permite acreditar una tasa de fotogramas de un portátil con GPU; las cifras de FPS de diagnóstico corresponden a ese entorno, no a una medición en hardware real. El rendimiento en portátil se ha cuidado mediante el presupuesto geométrico, la agrupación de objetos y las sombras estáticas. No se ha probado en un móvil físico ni se ha automatizado el diálogo de pantalla completa del sistema.

Para repetir las pruebas, instala Playwright en un entorno de desarrollo separado, inicia el servidor local y ejecuta:

```sh
node --check room.js
PLAYWRIGHT_MODULE=/ruta/a/node_modules/playwright node tests/verify.cjs
```

En este entorno Linux se utilizó además `env -u DISPLAY PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`. Playwright es solo una herramienta de comprobación: no se incluye ni se necesita para usar la habitación.
