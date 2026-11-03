# Ferretería La Esquina

Página de una sola vista para una ferretería ficticia, realizada desde cero con HTML semántico, CSS y JavaScript propios. Todo el contenido del negocio, su antigüedad, su dirección y los precios son ficticios.

## Archivos y uso

- `index.html`: página principal. Se puede abrir directamente en el navegador, sin instalar nada.
- `styles.css`: diseño y adaptaciones para móvil y escritorio.
- `script.js`: validación adicional y confirmación del formulario.
- `comprobaciones/`: capturas completas a 375 y 1440 px y resultados de las comprobaciones en `resultados.json`.

También se puede servir desde esta carpeta con `python3 -m http.server 8000` y abrir `http://localhost:8000`.

## Qué incluye

Cabecera con navegación por anclas, presentación, cuatro servicios (llaves, pintura, fontanería/electricidad y asesoramiento), cuatro productos con precios en euros, dirección, horario y formulario con nombre, correo y mensaje.

El formulario usa restricciones nativas del navegador: campos obligatorios, formato de correo y límites de longitud. JavaScript impide nombres con menos de dos caracteres y mensajes con menos de diez, descontando los espacios de los extremos. Los errores nativos señalan el campo que debe corregirse. Una entrada válida muestra una confirmación accesible y limpia el formulario. Un nuevo intento borra la confirmación anterior.

No existe backend, almacenamiento, analítica ni envío de datos. La confirmación lo indica expresamente. Si JavaScript está desactivado, la página sigue siendo legible y navegable; el botón queda desactivado y aparece un aviso para evitar un envío accidental.

## Decisiones de diseño

Paleta crema, verde oscuro y naranja inspirada en talleres y comercios tradicionales. Títulos con tipografía serif del sistema y texto con tipografía sans serif del sistema, sin descargas de fuentes. Ilustraciones e iconos SVG escritos a mano; fachada creada con CSS. Ninguna imagen ni recurso de la web procede de una fuente externa.

En escritorio, la presentación y el contacto usan dos columnas; los servicios y productos se distribuyen en cuatro. En móvil, la presentación y el contacto pasan a una columna y las tarjetas a dos; la navegación permanece visible sin menú desplegable.

Se incluyen etiquetas explícitas, jerarquía de títulos, regiones semánticas, enlace para saltar al contenido, foco visible y mensajes anunciados mediante `role="status"`. Las ilustraciones informativas tienen nombre accesible; los iconos decorativos se ocultan a lectores de pantalla. Se respeta la preferencia de movimiento reducido.

## Comprobaciones realizadas

Pruebas reales en Chromium con Playwright, a 375 × 900 y 1440 × 900 px:

- Carga correcta, cuatro servicios y cuatro productos presentes.
- Sin desbordamiento horizontal en ambos tamaños.
- Revisión visual de las capturas completas guardadas en esta carpeta.
- Navegación por las cuatro anclas; acceso al enlace de salto mediante Tab y activación con Enter.
- Paso del mensaje al botón con Tab y envío con Enter, sin trampas de foco.
- Rechazo de campos vacíos, nombre con solo espacios, correo inválido y mensaje demasiado corto.
- Confirmación tras datos válidos, limpieza de campos y eliminación de la confirmación al volver a escribir.
- Ninguna petición de red al enviar el formulario y ninguna petición a dominios externos al cargar la página.
- Sin excepciones JavaScript durante las pruebas.
- Auditoría axe-core con reglas WCAG 2 A/AA y 2.1 AA: cero infracciones detectadas en ambos tamaños, incluidas las comprobaciones automáticas de contraste.
- Con JavaScript desactivado: botón desactivado y aviso disponible.
- Apertura directa de `index.html` mediante `file://`: formulario y confirmación funcionan.
- Sintaxis de JavaScript verificada con `node --check script.js`.

Playwright, Chromium y axe-core se utilizaron únicamente como herramientas temporales de comprobación; no son dependencias de la página y se retiraron al terminar. Las capturas y el informe se conservan. La auditoría automática no sustituye una evaluación completa con lectores de pantalla; no se probaron Safari ni dispositivos físicos.
