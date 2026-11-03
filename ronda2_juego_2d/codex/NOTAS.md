# HEBRA — Un jardín en el vacío

Juego 2D original, creado para este proyecto con HTML, CSS y JavaScript nativos. El archivo de entrada es **index.html**: se puede abrir directamente en el navegador. No necesita instalación, compilación, conexión a Internet ni servidor.

## Idea

Una aguja y una raíz están unidas por una hebra luminosa. El jugador mueve la aguja para barrer el espacio con el hilo: **toda la longitud del hilo recoge rocío y toda su longitud es vulnerable a la ceniza**. El objetivo es llevar la luz a casa y hacer crecer seis flores.

El movimiento tiene una consecuencia geométrica: al alejarse de la raíz se recoge más superficie, pero también se expone más hilo. Volver al centro permite asegurar la cosecha. El pulso protege temporalmente esa conexión. Esta combinación de barrido, regreso y protección define la propuesta del juego; no utiliza plantillas, código de otros juegos ni recursos gráficos descargados.

## Cómo jugar

- Pulsa **Sembrar una partida**. También puedes iniciar con **Enter**.
- **WASD** o **flechas** mueven la aguja; la velocidad diagonal está normalizada.
- En móvil, **mantén el dedo sobre el campo y deslízalo**. La aguja sigue el punto indicado a velocidad limitada. También funciona con el ratón manteniendo pulsado.
- Haz que la hebra toque los pequeños rombos amarillos. Puedes transportar **hasta 6 gotas**.
- Regresa al círculo central para entregar automáticamente todo el rocío. Cada 6 gotas entregadas abren una flor.
- Entrega **36 gotas antes de 90 segundos** para ganar. Pierdes si se agota el tiempo o las **3 vidas**.
- La ceniza son los fragmentos triangulares coral. Si tocan el hilo, pierdes una vida y hasta dos gotas transportadas. Las gotas ya sembradas permanecen. Después del golpe hay 1,8 segundos de inmunidad.
- **Espacio** o el botón **Pulso** protegen todo el hilo durante 1,15 segundos y disuelven la ceniza cercana. La recarga dura 4,5 segundos.
- **P**, **Escape** o **Ⅱ** pausan la partida. Al cambiar de pestaña o perder el foco, la partida se pausa automáticamente y limpia los controles retenidos.
- El sonido es opcional y está apagado al inicio. El botón superior lo activa; son notas generadas con osciladores y envolventes de Web Audio.
- Al terminar puedes **volver a sembrar** o regresar al inicio.

### Puntuación y dificultad

Cada gota entregada vale **100 puntos**. Entregar seis de una vez añade **150 puntos**. Al ganar se suman **20 puntos por segundo restante**, redondeado hacia arriba, y **200 por cada vida conservada**. La mejor marca se guarda con `localStorage`; si el navegador lo bloquea, el juego continúa y conserva la marca en memoria durante esa sesión.

Hay cinco mareas. La siguiente empieza cada **18 segundos**: aumenta la velocidad de la ceniza y disminuye el intervalo entre apariciones. Las primeras amenazas llegan después de unos segundos para dar tiempo a entender la hebra. La raíz es un refugio y la ceniza desaparece antes de entrar en ella.

## Decisiones de diseño

- **Un jardín como recompensa visible.** Cada flor aparece en el propio campo; la raíz también muestra el avance parcial de la siguiente flor. Los segmentos de la interfaz cuentan las seis flores.
- **Botánica orbital.** Fondo verde carbón, trazados cartográficos tenues, flores de curvas y elipses, rocío amarillo y ceniza coral. La forma también diferencia recursos y amenazas. Todos los gráficos del juego se dibujan con canvas; el pequeño favicon es SVG escrito a mano dentro del HTML. Las tipografías son fuentes del sistema.
- **Objetivo corto y legible.** Una sola partida, sin menús de configuración ni tutorial obligatorio. Hay guía permanente, mensajes contextuales y una indicación para volver a la raíz cuando llevas rocío.
- **Móvil.** El espacio lógico se adapta a la proporción de la pantalla. Los controles táctiles son Pointer Events con captura y cancelación del puntero. La puntuación, el reloj, la carga, las vidas y el pulso siguen visibles en pantallas estrechas. Redimensionar conserva las posiciones relativas y cancela el destino táctil anterior.
- **Fluidez.** Bucle único con `requestAnimationFrame`, velocidades en segundos, subpasos de como máximo 1/120 s y delta total limitado a 50 ms. El tiempo oculto de una pestaña no se acumula. Máximo de 42 gotas, 25 cenizas y 220 partículas; partículas caducan y los nodos de audio se desconectan. La densidad de píxeles se limita a 2 y la interfaz numérica se actualiza aproximadamente 12 veces por segundo.
- **Movimiento reducido.** Se respeta `prefers-reduced-motion` para la oscilación ambiental y las transiciones. Los movimientos necesarios para jugar se mantienen.
- **Sin dependencias.** No hay frameworks, CDN, imágenes, fuentes, muestras de audio, analítica ni peticiones a servicios externos. Los archivos de comprobación no se cargan desde el juego.

## Comprobación realizada

Pruebas ejecutadas el **31 de octubre de 2026** en **Firefox 159 headless** mediante **geckodriver 0.37.1**, con un script propio de Node.js que usa WebDriver y WebDriver BiDi. Se comprobó además la sintaxis con `node --check game.js`. La versión final pasa todos los controles automatizados que figuran en `comprobacion/resultado.json`.

Se comprobó:

1. Inicio y canvas operativo; los recursos de la página pertenecen al mismo origen.
2. Movimiento mediante eventos reales de teclado, pulso con Espacio, pausa y continuación con restauración del foco.
3. Distancia punto-segmento en interior, extremos y segmento degenerado; recogida por el tramo central del hilo y límite de seis gotas.
4. Entrega, puntuación de cosecha completa y floración; daño, pérdida de carga e inmunidad; protección del hilo mediante pulso.
5. Progresión de dificultad; victoria, derrota por tiempo, derrota por vidas y reinicio completo.
6. Pausa al perder el foco y limpieza de entradas.
7. Vista de **390 × 844 px**, una secuencia táctil nativa de WebDriver, botón táctil de pulso y cambio de dimensiones. También se comprobó el diseño a **320 px** de ancho y que los controles permanezcan dentro del campo.
8. Persistencia del récord al recargar y apertura de `index.html` mediante **file://**, sin servidor.
9. Activación y desactivación de la interfaz de Web Audio, sin errores JavaScript.
10. Cinco partidas completas con un piloto reproducible y semillas 13, 71, 239, 503 y 1021. **Las cinco alcanzaron las 36 gotas**. El piloto solo elige un destino y activa el pulso: durante cada partida no modifica recursos, tiempo ni vidas. Sirve para comprobar que el objetivo se alcanza jugando con las reglas normales; sus tiempos no representan la dificultad para una persona.

También se inspeccionaron visualmente capturas de escritorio y móvil. Las capturas de partida y victoria usan escenarios controlados para revisar sus elementos de interfaz. Están en `comprobacion/` junto con el registro y los scripts de prueba.

### Rendimiento observado y límites

En la medición de **120 fotogramas de partida**, el promedio fue de aproximadamente **16,67 ms por fotograma (60 fps)**, sin intervalos superiores a 34 ms. Los valores exactos de la última ejecución están en `comprobacion/resultado.json`. Es una medición en este entorno, no una garantía sobre cualquier dispositivo.

No se ha probado en un teléfono físico, Safari ni Chrome. La entrada táctil se comprobó con Firefox a tamaño móvil y eventos táctiles nativos de WebDriver. El contexto de audio se crea, pero este entorno sin interfaz lo mantiene en estado `suspended` incluso tras un clic real y con reproducción automática permitida; su salida predeterminada es virtual. Por tanto, **la salida audible no se ha verificado**. El juego se puede jugar con el sonido desactivado.

## Archivos

- `index.html`: estructura, pantallas, botones e instrucciones.
- `style.css`: diseño, adaptación móvil y estados visuales.
- `game.js`: simulación, entrada, dibujo procedural y síntesis de audio.
- `NOTAS.md`: este documento.
- `comprobacion/probar.mjs`: pruebas de navegador sin bibliotecas de terceros.
- `comprobacion/piloto.js`: piloto reproducible utilizado por las pruebas.
- `comprobacion/resultado.json`: resultados de la última ejecución.
- `comprobacion/*.png`: capturas de inicio, partida, victoria y tamaños móviles.

Para repetir las pruebas se necesitan Node.js 22 o posterior, Python 3, Firefox y geckodriver con soporte de WebDriver BiDi. Desde esta carpeta, ejecutar cada proceso en su terminal:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

```sh
geckodriver --host 127.0.0.1 --port 4444
```

```sh
node comprobacion/probar.mjs
```

El script abre un perfil temporal, genera sus capturas y resultados, y cierra su sesión de navegador al terminar. El servidor y geckodriver se detienen con Ctrl+C. Para jugar no se necesita ninguna de estas herramientas: basta con abrir `index.html`.
