# NOTAS DE DESARROLLO — SINTONÍA: Tejedor de Fase

## 1. Idea del juego y concepto original

**SINTONÍA: Tejedor de Fase** es un videojuego 2D de acción geométrica y física armónica diseñado desde cero para el navegador. En lugar de recurrir a mecánicas convencionales como disparar proyectiles o esquivar pasivamente, el jugador pilota un sistema dual compuesto por dos cuerpos unidos físicamente:

1. **El Ancla Resonante (núcleo que controlas directamente):** es el centro de mando vulnerable (cuenta con 5 puntos de Integridad/Escudo). Si cualquier anomalía o proyectil impacta contra el Ancla, pierde un punto de integridad.
2. **El Orbe Armónico y la Cuerda de Fase:** una esfera cinética indestructible unida al Ancla mediante un filamento elástico gobernado por una simulación física de muelle-péndulo amortiguado (Ley de Hooke + impulso tangencial orbital).

El combate y la puntuación giran alrededor de **tres mecánicas entrelazadas**:
- **Corte por Sintonía Cromática (Polaridad Dual):** Tanto tu sistema como las anomalías poseen una fase activa: **Fase Cian (`+`)** o **Fase Magenta (`-`)**. Cuando el Orbe o la Cuerda de Fase tocan una anomalía de su **misma polaridad**, la armonizan al instante, sumando puntos, incrementando el multiplicador de combo (hasta `×12`) y emitiendo una nota musical en escala pentatónica/dórica. Si tocan una anomalía de la **polaridad opuesta**, la cuerda chisporrotea y la repele físicamente sin destruirla (útil para apartar amenazas del Ancla).
- **Latigazo de Tensión (Impulso Cinético):** Al activarlo, la cuerda se contrae y lanza el Orbe a gran velocidad cruzando el Ancla hacia el lado opuesto (o hacia el cursor). Durante el Latigazo, la cuerda vibra con ondas estacionarias visibles, **rompe los escudos frontales** de los *Prismas Blindados*, disipa proyectiles enemigos de la misma fase y otorga un bono de puntuación del +40%.
- **Cierre de Lazo Armónico (Geometría de Estela):** Al moverse, el Orbe deja una estela luminosa temporal. Si logras que el trazo reciente del Orbe **cruce un segmento anterior de su propia estela** formando un polígono cerrado, se produce un **Colapso Armónico**: todas las anomalías y proyectiles encerrados dentro del polígono son purificados instantáneamente **sin importar su polaridad ni sus escudos**. Encerrar 3 o más anomalías en un mismo lazo (*¡Gran Constelación!*) restaura además +1 punto de Integridad al Ancla.

Adicionalmente, el escenario genera periódicamente **Tríadas de Sintonía** (3 nodos triangulares conectados en constelación). Pasar el Orbe o la Cuerda por los 3 nodos antes de que se agote su tiempo desencadena una onda purificadora que limpia los proyectiles de la pantalla, otorga `1000 × Multiplicador` puntos y restaura +1 escudo.

---

## 2. Cómo se juega y controles

### Objetivo de la partida
Mantener la estabilidad de la Cámara Armónica sobreviviendo a niveles crecientes de frecuencia, armonizando anomalías con el Orbe y la Cuerda, cerrando Lazos Armónicos con la estela y superando el encuentro con el jefe (**Arconte de Discordia**) cada 3 niveles para alcanzar la máxima puntuación y rango armónico.

### Controles en Ordenador (Teclado y Ratón)
| Acción | Teclado | Ratón (opcional) |
| :--- | :--- | :--- |
| **Mover el Ancla** | `W A S D` o `Flechas de dirección` | — |
| **Latigazo de Tensión** | `Espacio` o `J` (cruza el Orbe al lado opuesto) | `Clic Izquierdo` (lanza el Orbe hacia el cursor) |
| **Cambiar Polaridad (`+` / `-`)** | `Shift`, `Q` o `K` | `Clic Derecho` |
| **Sobrecarga Áurea (al 100%)** | `E`, `R` o `L` | `Clic Central` |
| **Pausar / Reanudar** | `P` o `Escape` | Botón `⏸ Pausa` en el HUD |
| **Silenciar / Activar Audio** | `M` | Botón `🔊 Sonido` en el HUD |

### Controles Táctiles (Móvil y Tablet)
El juego detecta automáticamente pantallas táctiles o móviles (y también permite activar o desactivar la interfaz táctil en cualquier momento con el botón `📱 Táctil` del HUD):
- **Mitad izquierda de la pantalla:** **Joystick virtual analógico flotante**. Al apoyar el pulgar izquierdo en cualquier punto de la zona izquierda, la base del joystick se sitúa bajo tu dedo para mover el Ancla con velocidad proporcional en 360°.
- **Mitad derecha de la pantalla:** Tres botones táctiles ergonómicos con respuesta inmediata en `touchstart` (sin retardo de 300 ms):
  - **Botón `⚡ Latigazo`:** ejecuta el Latigazo de Tensión.
  - **Botón `⇄ Fase`:** alterna entre Fase Cian (`+`) y Fase Magenta (`-`).
  - **Botón `★ Áurea`:** se ilumina y pulsa en dorado al alcanzar el 100% de carga para activar la **Fase Áurea Dual** (durante 6,5 s armoniza ambas polaridades a la vez).

---

## 3. Decisiones de diseño y arquitectura técnica

1. **Estética visual procedural ("Osciloscopio de Geometría Sagrada"):**
   - Todos los gráficos se renderizan por código en un `<canvas>` 2D sin una sola imagen externa ni fuente de terceros.
   - El fondo presenta una **malla geométrica reactiva** que se deforma elásticamente al paso del Orbe y ante las ondas expansivas de los colapsos armónicos.
   - La **Cuerda de Fase** se dibuja como una curva segmentada con una envolvente sinusoidal que simula la vibración física de una cuerda pulsada tras cada corte o latigazo.
   - Cada arquetipo enemigo tiene una silueta poligonal distinguible de un vistazo (además de su color):
     - *Mota Fulsar* (Triángulo, 3 lados): rápida, aparece en enjambres cohesivos.
     - *Deriva Armónica* (Rombo, 4 lados): persecución suave con oscilación lateral.
     - *Prisma Blindado* (Pentágono, 5 lados + arco reflector blanco frontal): bloquea cortes frontales normales; exige usar el Latigazo de Tensión, golpearlo por la espalda o encerrarlo en un Lazo Armónico.
     - *Oscilador Bipolar* (Hexágono, 6 lados): emite un anillo de aviso 1 segundo antes de invertir su polaridad.
     - *Tejedor de Vórtice* (Octógono, 8 lados): mantiene distancia media y dispara proyectiles de fase que pueden cortarse con el Orbe.
     - *Arconte de Discordia* (Jefe multianillo con 3 sellos concéntricos): requiere romper sus 3 sellos mientras invierte su polaridad tras cada impacto.

2. **Rendimiento constante a 60 FPS en portátiles estándar:**
   - Se evitó el uso intensivo de `ctx.shadowBlur` en partículas y entidades múltiples (que suele penalizar las GPU integradas en portátiles), sustituyéndolo por trazos vectoriales multicapa y halos de opacidad controlada (`alpha: false` en el contexto principal).
   - Se establecieron cotas superiores estrictas para los contenedores dinámicos (`particles <= 180`, `orbTrail <= 95`, `shockwaves <= 20`, `gridRipples <= 10`, `enemies <= 28`), evitando picos del recolector de basura (GC).
   - La física utiliza paso de tiempo diferencial (`dt`) acotado a `0.05 s` para mantener estabilidad numérica incluso si el usuario cambia de pestaña.

3. **Síntesis musical interactiva con Web Audio API (`audio.js`):**
   - En lugar de ruidos genéricos, cada anomalía armonizada dispara un oscilador afinado en una **escala Dórica/Pentatónica en Re (`D4` a `D6`)** cuya altura sube progresivamente con el combo actual, convirtiendo las cadenas de combos en melodías ascendentes.
   - Los cierres de Lazo Armónico reproducen acordes arpegiados, el cambio de polaridad alterna intervalos ascendentes/descendentes y el Latigazo sintetiza el chasquido tenso de una cuerda.

---

## 4. Cómo se comprobó el funcionamiento

Se llevó a cabo una verificación multicapa para asegurar que todos los requisitos funcionales y técnicos se cumplen sin errores:

1. **Verificación estática y de enlaces DOM/CSS/JS mediante script en Python:**
   - Se analizaron `index.html`, `styles.css`, `audio.js` y `game.js` comprobando que las **46 llamadas a `document.getElementById()`** en `game.js` coinciden exactamente con los IDs presentes en `index.html`, sin IDs duplicados ni referencias huérfanas.
   - Se verificó que las **61 llamadas a métodos internos (`this.<metodo>()`)** en `SyntoniaGame` y las **13 llamadas a `SyntoniaAudio.<metodo>()`** están definidas y con delimitadores equilibrados.
   - Se comprobó la ausencia total de URLs externas (`http://`, `https://`, `//`), CDNs o recursos fuera de la carpeta actual.

2. **Simulación numérica de física e intersección de lazos a 60 FPS:**
   - Se ejecutó una simulación matemática de **3.600 fotogramas consecutivos (equivalentes a 60 segundos a 60 FPS, `dt = 1/60 s`)** probando la integración elástica de la Cuerda de Fase, los impulsos del Latigazo de Tensión y el algoritmo de detección de auto-intersección de segmentos (`getSegmentIntersection` + área por fórmula de Shoelace `computePolygonArea`), confirmando estabilidad numérica (`0` valores `NaN` o `Infinity`) y detección efectiva de polígonos cerrados.

3. **Suite de autocomprobación integrada (`window.SyntoniaGame.runSelfTest()`):**
   - El motor incluye un método `runSelfTest()` invocable desde la consola del navegador que ejecuta automáticamente una batería de pruebas de extremo a extremo sobre el estado real del juego: inicio de partida (`PLAYING`), alternancia de polaridad (`cyan <-> magenta`), ejecución de Latigazo de Tensión, armonización por colisión con el Orbe, colapso de un enemigo blindado mediante cierre de Lazo Armónico, activación de Sobrecarga Áurea al 100%, transición a pantalla de fin de partida (`GAMEOVER`) y retorno limpio al menú principal (`MENU`).

4. **Prueba de entrega HTTP local:**
   - Se levantó un servidor local con `python3 -m http.server` y se realizaron peticiones HTTP a `index.html`, `styles.css`, `audio.js` y `game.js`, verificando respuestas `200 OK` e integridad de todos los archivos.
