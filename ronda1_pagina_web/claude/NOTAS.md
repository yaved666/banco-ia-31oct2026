# Ferretería La Esquina — notas

## Qué hay

| Archivo | Contenido |
|---|---|
| `index.html` | La página completa (una sola página). |
| `styles.css` | Estilos, *mobile-first*. |
| `script.js` | Menú móvil, estado «abierto/cerrado», validación y confirmación del formulario. |
| `pruebas/test.js` | Pruebas automáticas en navegador (no forman parte del sitio). |
| `pruebas/capturas/` | Capturas generadas por las pruebas (375 y 1440 px). |

Para verlo basta con abrir `index.html` en el navegador: no necesita servidor, no hay frameworks ni CDN y no hace ninguna petición externa. Las ilustraciones, los iconos, el favicon y el plano están hechos con SVG en línea, y la fuente es la del sistema.

## Secciones

1. **Cabecera fija** con logotipo SVG y navegación. En móvil se convierte en un botón «Menú» desplegable.
2. **Portada** con el titular, dos llamadas a la acción, tres datos rápidos y una ilustración de un tablero de herramientas.
3. **Servicios (6):** copia de llaves, corte de madera, mezcla de pintura, afilado y reparación, reparto a domicilio y asesoramiento.
4. **Productos destacados (6)** con precio en euros (IVA incluido). Uno lleva precio tachado de oferta y otro la etiqueta «Novedad».
5. **Horario y dirección:** tabla de horario, indicador en vivo «Abierto ahora · cierra a las 14:00» calculado con la hora local, resaltado del día actual, dirección y teléfono, y un plano esquemático en SVG.
6. **Formulario de contacto:** nombre, correo, teléfono (opcional), motivo, mensaje con contador y aceptación de privacidad. Como no hay backend, al enviarlo se sustituye por un mensaje de confirmación personalizado, que avisa de que no se ha enviado nada.
7. **Pie** con enlace «Volver arriba».

Todos los datos (dirección, teléfono, año de fundación) son ficticios, y la página lo indica.

## Decisiones de diseño

- **Identidad de ferretería de barrio:** color óxido (`#b4410f`) como color de marca, arena para los fondos, carbón para el texto y amarillo como subrayado de rotulador en el titular. Pretende ser cálido y artesanal, sin parecer una gran superficie.
- **Tipografía del sistema** (`system-ui`) para no cargar fuentes externas. Los titulares usan una pila más gruesa («Arial Black» si está disponible).
- **Mobile-first:** una columna en 375 px. A partir de 860 px aparecen la navegación horizontal y la portada a dos columnas, y a partir de 1100 px el horario, la dirección y el plano se ven en tres columnas. Las rejillas usan `auto-fit`/`minmax(min(100%, …))`, así que nunca provocan desbordamiento horizontal.
- **Sin JavaScript sigue funcionando:** el menú se muestra abierto y en línea. La clase `.js` solo se añade cuando el script se ejecuta.
- **Validación propia** (`novalidate` + JS) en lugar de las burbujas nativas, para que los mensajes estén en español, sean concretos y se puedan leer con lector de pantalla:
  - Un campo se valida al salir de él (no al pasar con Tab por uno vacío) y se revalida mientras escribes si ya tenía un error.
  - Al enviar con errores se muestra un resumen arriba con enlaces a cada campo (al estilo GOV.UK). El foco va a ese resumen y la página se desplaza teniendo en cuenta la cabecera fija para que esta no lo tape.
  - Reglas: nombre de al menos 2 letras; correo con formato `algo@dominio.ext`; teléfono español de 9 dígitos que empiece por 6, 7, 8 o 9, con prefijo +34 opcional, y admite espacios y guiones; motivo obligatorio; mensaje de 10 a 1000 caracteres; casilla de privacidad marcada.

## Accesibilidad

- Enlace «Saltar al contenido», HTML semántico (`header`, `nav`, `main`, `section` con `aria-labelledby`, `address`, `figure`) y un solo `h1`.
- Cada campo tiene su `<label for>`. Las pistas y los errores se asocian con `aria-describedby`, los campos con error llevan `aria-invalid` y los obligatorios se indican también en el texto.
- Contraste AA en todos los textos: el óxido sobre blanco da 5,9:1, el texto secundario 8,1:1 y el rojo de error 6,0:1. Los bordes de los campos dan 3,2:1.
- Foco visible en todos los elementos (contorno azul de 3 px). El menú móvil usa `aria-expanded` y se cierra con Escape devolviendo el foco al botón.
- Los SVG decorativos llevan `aria-hidden`. El plano tiene `role="img"` y un `<title>` descriptivo, y el precio tachado se lee como «Precio anterior / Precio actual».
- Se respeta `prefers-reduced-motion`. Las zonas táctiles miden al menos 44–48 px.

## Cómo lo comprobé

No había navegador en el sistema, así que instalé **Playwright + Chromium** y **axe-core** de forma temporal, fuera del proyecto, y escribí `pruebas/test.js`. Con la última versión del código pasan **todas las comprobaciones (0 fallos)**:

- **A 375 y a 1440 px:** sin errores de consola, sin ninguna petición de red externa, `scrollWidth` igual al ancho de la ventana (sin scroll horizontal), ningún elemento fuera de la pantalla, al menos 4 servicios y precios con «€».
- **axe-core** (WCAG 2.0/2.1 A y AA más buenas prácticas, incluido el contraste) con **0 violaciones** en ambos anchos.
- **Teclado:**
  - El primer Tab lleva a «Saltar al contenido».
  - El menú móvil se abre con Enter, se cierra con Escape (el foco vuelve al botón) y se cierra también al elegir un enlace.
  - El recorrido con Tab en escritorio sigue el orden lógico hasta «Enviar mensaje», y todos los elementos muestran indicador de foco.
- **Formulario:**
  - Al enviarlo vacío aparece el resumen con los 5 errores y el foco va a él, visible bajo la cabecera. Los enlaces del resumen llevan al campo correspondiente.
  - Se rechazan nombre corto, correo sin dominio, teléfono inválido y mensaje corto, y el contador de caracteres funciona.
  - Al corregir los campos desaparecen los errores. El envío válido oculta el formulario, muestra «Gracias, María. Te responderemos en maria@correo.es…» y pone el foco en la confirmación.
  - «Enviar otro mensaje» deja el formulario vacío.
- **Horario:** probé la función con fechas fijas (lunes 10:00 abierto, lunes 15:00 «abre hoy a las 17:00», sábado 13:59 abierto, domingo cerrado, lunes 8:00 «abre a las 9:00»).
- **Sin JavaScript:** el menú es visible y no hay desbordamiento.
- **Revisión visual de las capturas.** Encontré y corregí dos problemas:
  1. La etiqueta vertical «C/ del Olmo» del plano salía cortada.
  2. Al enviar con errores, el primer campo erróneo quedaba fuera de la vista o tapado por la cabecera fija. Por eso el foco va ahora al resumen de errores.

Para repetir las pruebas (las dependencias son solo de prueba):

```bash
cd pruebas
npm init -y && npm i playwright axe-core && npx playwright install chromium
node test.js
```

**Límites:** no lo probé en Safari ni en Firefox, ni con un lector de pantalla real (NVDA o VoiceOver). La parte de accesibilidad se basa en axe, en las pruebas de teclado y en revisar el marcado.
