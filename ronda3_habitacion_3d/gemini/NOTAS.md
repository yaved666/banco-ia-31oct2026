# NOTAS DE DISEÑO Y VERIFICACIÓN — Estancia 3D Interactiva (`Salón-Estudio`)

## 1. Resumen de lo realizado

Se ha creado desde cero una estancia 3D interactiva en primera persona que representa un **Salón-Estudio contemporáneo de estilo Mid-Century / Nórdico** (`8.0 m × 7.0 m × 3.2 m`), completamente amueblado, iluminado con luz solar natural y **4 lámparas independientes conmutables**, y ejecutable al 100 % en local sin ninguna dependencia externa ni conexión a internet.

### Estructura de archivos en la carpeta actual
- `index.html`: Punto de entrada principal con la interfaz HUD, mira central (`crosshair`), indicadores interactivos de estado de lámparas y controles táctiles para móvil.
- `styles.css`: Hoja de estilos responsiva (escritorio y móvil/tablet) con diseño translúcido (`backdrop-filter`) y joystick virtual táctil.
- `app.js`: Motor completo de generación de texturas procedurales con `Canvas2D`, modelado geométrico de los **14 muebles y elementos arquitectónicos**, iluminación natural e interactiva, sistema de colisiones circulares contra cajas `AABB` con deslizamiento lateral (`wall-sliding`), y controles en primera persona.
- `three.min.js`: Librería Three.js (`r128`) empaquetada localmente dentro de la carpeta del proyecto para garantizar funcionamiento 100 % offline sin CDN.
- `NOTAS.md`: Este documento de arquitectura, decisiones de diseño y pruebas realizadas.

---

## 2. Decisiones de diseño

### 2.1. Elección de la habitación y distribución espacial
Se eligió un **Salón-Estudio abierto** porque permite combinar una zona cálida de descanso (sofá chaise longue, alfombra tejida, mesa de centro, mueble de TV y lectura) con una zona de trabajo intelectual (escritorio con portátil, flexo articulado, silla ergonómica y librería de suelo a techo), ofreciendo riqueza visual y múltiples puntos de interés e iluminación sin sobrecargar el paso.

- **Dimensiones**: `8.0 m` de ancho (eje X: `-4.0` a `+4.0`), `7.0 m` de profundidad (eje Z: `-3.5` a `+3.5`) y `3.2 m` de altura.
- **Pasillos amplios**: Los muebles están distribuidos dejando corredores de entre `1.1 m` y `1.6 m` de anchura libre para que el recorrido en primera persona sea cómodo y natural.

### 2.2. Modelado 100 % por código (14 muebles y objetos, 411 sub-mallas)
En lugar de usar modelos externos (`.gltf`/`.obj`), cada mueble se ha construido ensamblando primitivas geométricas de Three.js (`BoxGeometry`, `CylinderGeometry`, `SphereGeometry`, `TorusGeometry`, `ConeGeometry`, `PlaneGeometry`, `CircleGeometry`) jerarquizadas en grupos (`THREE.Group`):

1. **Ventanal panorámico con cortinas y jardín exterior (`ventana_exterior`)**: Abertura real en el muro este con carpintería metálica, alféizar de roble, barra de latón, cortinas plisadas, paisaje exterior soleado (cielo, sol, prado y árboles) y haces volumétricos de sol (`AdditiveBlending`).
2. **Sofá Chaise Longue de 3 plazas (`sofa`)**: Bastidor de nogal, 6 patas troncocónicas, 3 cojines de asiento (uno extendido en chaise longue), estructura trasera, 3 respaldos inclinados, 2 reposabrazos y 3 cojines decorativos en contraste (mostaza y terracota).
3. **Mesa de centro (`mesa_centro`)**: Tablero de roble, estructura de acero negro mate, balda inferior, bandeja cerámica, taza de café con asa toroidal y libros de arte apilados.
4. **Alfombra bereber tejida (`alfombra`)**: Cuerpo textil bajo la zona de estar con patrón geométrico nórdico y 62 flecos perimetrales en los extremos.
5. **Aparador de TV de listones con Televisor de 65" y Altavoces Hi-Fi (`mueble_tv`)**: Mueble bajo en nogal con frente de listones verticales de roble (`slatted wood`), televisor panorámico con pantalla emisiva pintada por código y dos monitores de audio con conos de latón.
6. **Estantería librería de nogal (`estanteria`)**: Estructura de 6 baldas poblada algorítmicamente con más de 110 libros de lomos variados y esferas decorativas de latón.
7. **Escritorio de estudio con cajonera y portátil (`escritorio`)**: Tablero de nogal, pata metálica en marco, cajonera de 3 cajones con tiradores, ordenador portátil abierto con pantalla de código retroiluminada y portalápices con lápices de colores.
8. **Silla ergonómica giratoria (`silla_estudio`)**: Base en estrella de 5 radios con ruedas, pistón cromado, asiento acolchado, respaldo curvado y reposabrazos.
9. **Planta Monstera en maceta de terracota (`planta_maceta`)**: Plato cerámico, maceta troncocónica, sustrato y 13 tallos curvados radialmente con hojas verdes a distintas alturas.
10. **Tríptico de cuadros, Reloj de pared en tiempo real y Puerta de entrada (`cuadros_reloj_puerta`)**: Tres cuadros enmarcados con arte generativo, reloj de pared 3D cuyas agujas marcan la hora real del sistema segundo a segundo, y puerta de madera moldurada con manilla de latón.
11. **Lámpara de pie articulada de lectura (`lampara_pie`) [Interactiva #1]**: Base de latón, fuste estilizado, brazo superior inclinado, pantalla troncocónica translúcida y bombilla interior emisiva.
12. **Flexo articulado de escritorio (`lampara_escritorio`) [Interactiva #2]**: Base pesada con interruptor, doble brazo articulado con rótula esférica y campana cónica metálica.
13. **Mesa auxiliar trípode con lámpara de cerámica (`mesa_auxiliar_lampara`) [Interactiva #3]**: Mesita circular de roble sobre tres patas inclinadas con lámpara de sobremesa de cuerpo cerámico y pantalla textil.
14. **Lámpara colgante de techo de anillos concéntricos (`lampara_techo`) [Interactiva #4]**: Luminaria suspendida con florón, tensores, anillo de latón y difusor toroidal luminoso.

### 2.3. Texturas generadas por código (`THREE.CanvasTexture`)
Se programaron generadores deterministas sobre `<canvas>` 2D para producir **11 texturas procedurales** al iniciar la página (sin cargar imágenes externas):
- Parquet de madera en tablones alternados con vetas bezier y su mapa de relieve (`bumpMap`) correspondiente.
- Estuco cálido granulado para las paredes.
- Vetas orgánicas de madera de nogal oscuro y roble claro.
- Tejido tramado en espiga para el tapizado del sofá, cojines y pantallas textiles.
- Tejido con motivos geométricos de rombos para la alfombra.
- Tres lienzos pictóricos distintos (paisaje de atardecer, composición Bauhaus y arte botánico).
- Pantallas digitales para la TV de 65" (paisaje nocturno con aurora) y el ordenador portátil (IDE de código).
- Esfera analógica dinámica del reloj de pared.

### 2.4. Iluminación natural e interactiva
- **Luz natural por la ventana**: Combinación de `HemisphereLight` (luz cenital celeste y rebote cálido del parquet), `DirectionalLight` solar entrando en diagonal a través del ventanal este con proyección de sombras suaves (`PCFSoftShadowMap`), `PointLight` de rebote atmosférico en el vano de la ventana, planos translúcidos que simulan haces volumétricos de sol (`god-rays`) y un sistema de partículas (`THREE.Points`) que simula motas de polvo flotando al sol.
- **4 Lámparas interactivas**: Cada lámpara puede encenderse y apagarse haciendo **clic** sobre ella con el ratón, **tocándola** en dispositivos móviles, pulsando la tecla **`E`**, o mediante los botones rápidos del HUD. Al conmutarlas, cambian su `PointLight.intensity`, el brillo emisivo (`emissive` y `emissiveIntensity`) de su bombilla y pantalla, y se reproduce un sonido de clic mecánico sintetizado en tiempo real con `Web Audio API`.

### 2.5. Controles multiplataforma y motor de colisiones
- **Ordenador**: Movimiento con `WASD` o teclas de `Flechas`, vista en 360° mediante `Pointer Lock API` (o arrastrando con el ratón si no se bloquea el puntero) y clic directo o tecla `E` para interactuar con las lámparas.
- **Móvil y Tablet**: Joystick virtual analógico en la esquina inferior izquierda para caminar en cualquier dirección, arrastre táctil en el lado derecho para girar la cámara, toque directo (`tap`) sobre cualquier lámpara 3D en pantalla y botón táctil dedicado (`💡 Lámpara cercana`).
- **Colisiones con deslizamiento (`Wall-Sliding`)**: El jugador se modela como un cilindro vertical de radio `0.36 m`. El motor `resolveMovement()` subdivide cada desplazamiento y evalúa los ejes `X` y `Z` por separado frente a los límites de las 4 paredes y las 10 cajas `AABB` de los muebles físicos. Así se impide atravesar cualquier pared o mueble permitiendo deslizarse suavemente a lo largo de sus bordes.

### 2.6. Optimización y fluidez en portátiles normales
- Conteo geométrico contenido (**411 mallas en total**) usando primitivas limpias y materiales compartidos.
- Limitación de `devicePixelRatio` a un máximo de `2.0` (`Math.min(window.devicePixelRatio, 2)`).
- Mapas de sombras acotados (`1024×1024` para el sol y `512×512` para la lámpara principal) con `shadow.camera` ajustada exactamente a las dimensiones de la habitación.

---

## 3. Cómo se comprobó el funcionamiento

1. **Verificación de autonomía y cero recursos externos**:
   - Se inspeccionaron `index.html`, `styles.css`, `app.js` y `three.min.js` verificando que todos los archivos existen en la carpeta local y que no existe ninguna referencia `http://` ni `https://` a CDNs, fuentes o activos externos.
2. **Suite de pruebas automatizadas con Node.js sobre `three.min.js` y `app.js`**:
   - Se ejecutó el código real de `three.min.js` y `app.js` verificando la creación sin errores del grafo de escena (`THREE.Scene`), cámara, luces, texturas procedurales (`11 CanvasTextures`) y catálogo de muebles (`14 muebles/objetos`, superando el mínimo de 8).
   - **Detección y corrección de un bug real durante las pruebas**: En la primera ejecución del test automatizado se detectó un `ReferenceError` por orden de declaración de `crosshairEl` al inicializar las lámparas y un pasillo estrecho entre la mesa auxiliar y la silla de estudio. Ambos se corrigieron inmediatamente y se re-verificaron.
   - **Prueba de Raycasting 3D e interacción con lámparas**: Se orientó la cámara hacia cada una de las 4 lámparas (`lampara_pie`, `lampara_escritorio`, `lampara_sobremesa`, `lampara_techo`), se lanzó `raycastLampAt(0, 0)` y se invocó `toggle()`, confirmando que el rayo intersecta las mallas de cada lámpara y que la intensidad lumínica y emisión de materiales pasan de encendido a apagado y viceversa.
   - **Prueba exhaustiva de colisiones**: Se simuló el avance del jugador contra las 4 paredes (Norte, Sur, Este y Oeste) y contra los 10 colisionadores de muebles desde el exterior hacia su centro, comprobando que `checkPointCollision()` bloquea el paso en todos los casos sin penetración y que el deslizamiento diagonal (`wall-sliding`) funciona suavemente.
   - **Prueba de controles de entrada**: Se dispararon eventos simulados de teclado (`KeyW`, `ArrowRight`), ratón (`mousedown`, `mousemove`, `mouseup`) y eventos táctiles (`touchstart`, `touchmove`, `touchend` sobre el joystick virtual), comprobando la actualización de posición `(x, z)` y orientación `(yaw, pitch)` de la cámara en primera persona.
3. **Prueba de servidor HTTP local**:
   - Se levantó un servidor HTTP local y se realizaron peticiones `GET` a `/index.html`, `/styles.css`, `/app.js` y `/three.min.js`, confirmando respuestas `200 OK`, tipos MIME correctos y tamaños íntegros.
