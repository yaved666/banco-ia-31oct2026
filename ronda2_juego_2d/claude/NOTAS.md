# FAROL — la última llama

Juego 2D original para navegador. Abre `index.html` (no hace falta servidor) y pulsa **ENCENDER**.

## La idea

Es de noche en un claro del bosque. En el centro hay un farol con la última llama, y su haz de luz es tu única arma. Desde los árboles se acercan **sombras** que quieren apagarla; la luz las disuelve si las mantienes iluminadas el tiempo suficiente.

La tensión está en otra parte: el farol gasta **combustible** sin parar, y solo lo recargan las **luciérnagas** que llegan volando hasta él. Pero la luz también las asusta y las aleja. En todo momento hay que decidir hacia dónde apuntar: hacia la sombra que se acerca o lejos de la luciérnaga que necesitas. Si te quedas sin combustible, el haz se encoge y quema más despacio, y las sombras llegan más cerca.

## Cómo se juega

| Acción | Teclado / ratón | Móvil |
|---|---|---|
| Girar el haz | `←` `→` o `A` `D` (acelera si mantienes pulsado), o mover el ratón | Tocar o arrastrar el dedo hacia donde quieras la luz |
| Destello | `Espacio` o clic | Botón ✸ DESTELLO, o tocar con un segundo dedo |
| Pausa | `P` / `Esc` | Botón ❚❚ |
| Sonido | `M` | Botón del altavoz |
| Empezar / reintentar | `Enter` o `Espacio` | Botón en pantalla |

- **Objetivo:** que la llama dure el mayor tiempo posible y conseguir la máxima puntuación.
- **Vidas:** 3 llamas (arriba a la derecha). Cada sombra que toca el farol apaga una. Tras un golpe tienes un momento de invulnerabilidad y las sombras cercanas salen despedidas hacia atrás. Con 0 llamas la partida termina.
- **Combustible:** es el anillo naranja alrededor del farol. Cada luciérnaga que llega da +24. Por debajo de 20 suena un aviso y el haz parpadea.
- **Destello:** una onda en todas direcciones que daña y empuja a las sombras cercanas. Cuesta 20 de combustible y tarda 4 s en recargarse. Sirve para salir de un apuro, pero no se puede abusar de él.
- **Puntos:** cada sombra disuelta da puntos según su tipo. Si disuelves varias seguidas (con menos de 2,2 s entre una y otra) subes el multiplicador, de ×2 a ×5. Recibir un golpe lo reinicia. Cada luciérnaga da +25, y cada nueva hora da un bonus. El récord se guarda en `localStorage`.

### Enemigos

| Sombra | Aspecto | Comportamiento |
|---|---|---|
| Sombra común | borde violeta | velocidad media, ondulante |
| Brizna (desde 15 s) | pequeña, borde cian | muy rápida y frágil |
| Coloso (desde 40 s) | grande, borde rosa | lenta y resistente; al disolverse se parte en dos briznas |
| Espiral (desde 70 s) | borde verde | se acerca girando alrededor del farol, así que no basta con apuntar una vez |

### Dificultad

La noche avanza por **horas** de 30 s. Al empezar cada hora sale un cartel, se da un bonus y llega una oleada agrupada de sombras. Además, de forma continua:

- las sombras aparecen cada vez más a menudo (intervalo `1,6 / (1 + t/45)` s, con un mínimo de 0,3 s);
- se mueven más rápido (hasta ×2);
- aparecen tipos nuevos;
- desde los 30 s, el 30 % de las sombras llegan **por la espalda** del haz;
- el combustible se gasta más deprisa (de 1,8 a 4 por segundo).

## Decisiones de diseño

- **Un solo eje de control.** Todo el juego se maneja apuntando un ángulo, así que funciona igual con flechas, ratón o un dedo. En táctil no hay joystick: tocas donde quieres la luz. El haz gira hacia el objetivo a una velocidad máxima limitada, de modo que apuntar con el ratón no es instantáneo y la posición sigue importando.
- **Una mecánica con dos caras.** La luz ataca a las sombras y a la vez espanta tu recurso. Así cada decisión cuesta algo y el juego no se reduce a «apunta a lo más cercano». Un bot que hace solo eso aguanta unos 2 minutos.
- **El haz depende del combustible.** Con poco combustible no pierdes de golpe, sino que el haz se acorta. Es un castigo gradual que se ve en pantalla.
- **Información dentro de la escena.** El combustible es un anillo en el propio farol, las sombras se encogen al perder vida y entornan los ojos cuando les da la luz, y las luciérnagas asustadas brillan más.
- **Estilo visual.** Oscuro y cálido: fondo azul noche, luz ámbar con mezcla aditiva y sombras negras perfiladas con colores fríos, para que se distingan en la oscuridad sin dejar de parecer sombras.
- **Coordenadas polares.** Cada entidad se guarda como (ángulo, distancia) respecto al farol. Así la colisión con el haz es una simple comparación de ángulos, y el movimiento hacia el centro o en espiral sale casi gratis.
- **Rendimiento:**
  - el fondo (estrellas, hierba, piedras y anillo de árboles) se dibuja una sola vez en un canvas aparte cada vez que cambia el tamaño de la ventana;
  - los brillos son sprites precalculados que se pintan con `drawImage`;
  - las partículas tienen un tope de 600 y se borran por intercambio con la última;
  - el `devicePixelRatio` se limita a 2, y el paso de tiempo a 50 ms para evitar saltos.
- **Sonido sintetizado con Web Audio.** Hay osciladores y ruido filtrado:
  - un chisporroteo continuo cuyo volumen depende de cuántas sombras se están quemando;
  - un tono por cada sombra disuelta que sube de nota con el combo;
  - un arpegio al recoger una luciérnaga y otros sonidos para el golpe, el destello, el aviso de poco combustible, el cambio de hora y el fin de partida.

  El audio se crea con el primer gesto del usuario, como exigen los navegadores.
- **Pantalla de inicio viva.** Detrás del menú, el farol juega solo en modo demostración.
- **Pausa automática.** El juego se pausa al cambiar de pestaña o al perder el foco de la ventana.

## Archivos

- `index.html`: estructura, estilos y pantallas (inicio, pausa, fin).
- `game.js`: todo el juego (lógica, dibujo, entrada y sonido), sin dependencias.
- `pruebas/prueba-navegador.mjs`: prueba automática de extremo a extremo (no hace falta para jugar).

## Cómo lo comprobé

Escribí un script en Node (`pruebas/prueba-navegador.mjs`) que abre Chromium sin interfaz y lo controla por el Chrome DevTools Protocol, enviando eventos reales de teclado, ratón y toques. Se ejecuta así:

```
node pruebas/prueba-navegador.mjs /ruta/temporal   # usa CHROME=/ruta/a/chrome si hace falta
```

Comprueba, en este orden:

1. Arranca en el menú y el menú es visible.
2. `Enter` empieza la partida y oculta el menú.
3. La flecha derecha gira el haz.
4. El ratón orienta el haz hacia el cursor.
5. `P` pausa (el tiempo de juego se congela) y vuelve a reanudar.
6. `Espacio` lanza el destello y gasta combustible.
7. Un bot que apunta con eventos de ratón a la sombra más cercana juega a velocidad ×3. Comprueba que disuelve sombras, que puntúa, que sube el multiplicador hasta ×5, que avanzan las horas y que se recogen luciérnagas. Este bot «perfecto pero ingenuo» suele perder hacia el minuto 1:50–2:00 de juego (hora 4–5), así que la curva de dificultad aprieta de verdad.
8. Si se deja de defender, la partida termina y aparece la pantalla de fin con las estadísticas y «¡NUEVO RÉCORD!».
9. `Enter` reinicia una partida limpia (3 llamas, puntuación a 0) y el récord queda guardado.
10. Con un móvil emulado (390×844, táctil): tocar y arrastrar orientan el haz, el botón DESTELLO es visible y funciona.
11. No hay ningún error en la consola en toda la ejecución.

Resultado: las 19 comprobaciones pasan.

Además medí la fluidez contando fotogramas con `requestAnimationFrame`:

| Escenario | Resultado |
|---|---|
| Menú, partida y móvil | 60 fps estables (fotograma máximo de 16,8 ms) |
| Prueba de carga: 120 sombras, 40 luciérnagas, 600 partículas (unas 6 veces más que el máximo de una partida real, que ronda las 15–20 sombras) | 60 fps |
| La misma carga con la CPU limitada ×4 | unos 47 fps |

También revisé a ojo capturas del menú, la pausa, la partida avanzada, el fin de partida y la vista de móvil. A raíz de esa revisión hice algunos ajustes:

- el menú se compacta en pantallas bajas;
- las luciérnagas son más grandes y brillantes;
- las sombras son algo mayores;
- el aviso del destello se oculta fuera de la partida.

**Límites de la comprobación:** el sonido no lo pude escuchar. Comprobé que el código de Web Audio se ejecuta sin errores, pero no cómo suena. Tampoco lo probé en un móvil físico, solo en la emulación táctil de Chromium.
