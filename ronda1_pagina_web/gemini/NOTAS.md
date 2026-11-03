# Notas de Desarrollo y Diseño — Ferretería La Esquina

## 1. Qué se hizo

Se creó desde cero la página web completa para el negocio ficticio **"Ferretería La Esquina"** (una ferretería de barrio fundada en 1984), cumpliendo estrictamente la restricción de **cero dependencias externas** (sin frameworks, sin CDNs, sin tipografías remotas ni imágenes externas).

### Archivos del proyecto (en `/home/gemini/prueba/web`)
- **`index.html`**: Documento principal HTML5 semántico en una sola página con:
  1. **Cabecera y portada (Hero)**: Franja superior con dirección, teléfono y estado de apertura dinámico; logotipo en SVG; menú de navegación adaptable; y portada con cifras del negocio e ilustración vectorial de un panel perforado de taller con herramientas.
  2. **Sección de servicios (`#servicios`)**: **6 servicios** detallados de ferretería de barrio (duplicado de llaves y mandos, corte a medida de madera y perfiles, alquiler de herramientas por días, mezcla de pintura a la carta, asesoramiento técnico de despiece y reparto a domicilio en el barrio), cada uno con su icono SVG propio y tarifa/condición orientativa.
  3. **Productos destacados con precios (`#productos`)**: **8 productos** con referencia (`SKU`), descripción técnica, etiqueta de disponibilidad ("En stock"), **precio con IVA incluido en euros (€)**, ilustración SVG individual, filtro interactivo por categorías y botón *"Reservar"* que pre-rellena automáticamente el formulario de contacto.
  4. **Horario y dirección (`#horario-direccion`)**: Tabla de horarios semanales (con resaltado automático del día actual), nota de apertura temprana para gremios, datos de dirección postal y transporte público, y un **plano callejero ilustrado en SVG** que muestra la intersección de *Calle del Roble 42 con Av. de los Artesanos*, la *Plaza del Mercado* y la parada de Metro.
  5. **Formulario de contacto (`#contacto`)**: Formulario con validación en el navegador para nombre, correo electrónico, teléfono (opcional con validación de formato), motivo de consulta, mensaje y aceptación de privacidad. Al no existir backend, intercepta el envío válido y muestra un panel de confirmación accesible con número de referencia (`FLE-2026-XXXX`), resumen de los datos enviados y opción para enviar una nueva consulta.
- **`styles.css`**: Hoja de estilos CSS nativa con variables CSS (`custom properties`), diseño *mobile-first*, retículas CSS Grid y Flexbox, estados `:focus-visible` y soporte para `prefers-reduced-motion`.
- **`app.js`**: Script en JavaScript nativo (ES6+) encapsulado en una IIFE que gestiona el menú móvil accesible, el cálculo del estado del horario comercial, el filtrado de productos con anuncio `aria-live`, la precarga de consultas de producto y la validación completa del formulario en el cliente.

---

## 2. Decisiones de diseño

### Identidad visual y paleta de alto contraste
Se buscó transmitir la cercanía, el orden y el oficio de una ferretería tradicional renovada:
- **Fondos**: Papel taller cálido (`#FAF7F2`), blanco puro (`#FFFFFF`) para tarjetas y azul acero carbón (`#18222B`) para cabecera superior, portada y pie de página.
- **Acentos**: Naranja óxido ferretero (`#B84312`) para acciones principales sobre fondo claro y amarillo cinta métrica (`#FFB703`) para resaltados sobre fondo oscuro.
- **Tipografía**: Pila tipográfica nativa del sistema (`system-ui` / `Trebuchet MS` para titulares y `ui-monospace` para referencias SKU), garantizando carga instantánea sin peticiones de red.
- **Gráficos 100 % SVG**: Los 23 gráficos de la página (logotipo, ilustración principal del taller, iconos de servicios, 8 ilustraciones de productos y el mapa callejero del barrio) están dibujados en SVG en línea con `viewBox` escalable.

### Adaptabilidad: Móvil (375 px) y Escritorio (1440 px)
- **En móvil (`375 px`)**:
  - Estructura en una sola columna fluida sin desbordamiento horizontal (`overflow-x: hidden`).
  - Menú desplegable controlado por un botón accesible (`min-height: 44px`, `min-width: 44px`) que alterna `aria-expanded` y se cierra con la tecla `Escape` o al seleccionar una sección.
  - Tipografía fluida mediante `clamp()` para evitar titulares desbordados.
- **En escritorio (`1440 px`)**:
  - Contenedor centrado (`max-width: 1240px`) con márgenes laterales amplios.
  - Navegación horizontal visible permanentemente en la cabecera fija (`sticky`).
  - Portada a dos columnas (texto + ilustración de taller), cuadrícula de **3 columnas** para los 6 servicios, cuadrícula de **4 columnas** para los 8 productos destacados y distribución en **2 columnas** para horario/mapa y formulario/panel de ayuda urgente.

### Accesibilidad (WCAG 2.1 AA/AAA)
- **Navegación con teclado**: Enlace `"Saltar al contenido principal"` (`.skip-link`) al inicio del `<body>`, orden de tabulación lógico, contorno `:focus-visible` de 3 px (`#005FCC`) con `outline-offset` en todos los elementos interactivos, y gestión automática del foco hacia el primer campo con error o hacia el título del mensaje de confirmación tras enviar el formulario.
- **Formulario accesible**: Todos los controles (`input`, `select`, `textarea`) tienen su `<label for="...">` explícito, atributos `required` y `aria-required="true"`, e indicadores de error vinculados mediante `aria-describedby` y `role="alert"`.
- **Contraste verificado matemáticamente**:
  - Texto principal (`#18222B`) sobre fondo página (`#FAF7F2`): **15.09:1** (AAA)
  - Texto principal (`#18222B`) sobre tarjetas (`#FFFFFF`): **16.12:1** (AAA)
  - Texto secundario (`#414E5C`) sobre fondo página (`#FAF7F2`): **7.96:1** (AAA)
  - Texto claro (`#F8FAFC`) sobre fondo oscuro (`#18222B`): **15.41:1** (AAA)
  - Botón primario (`#FFFFFF` sobre `#B84312`): **5.46:1** (AA) y en `:hover` (`#94330B`): **7.67:1** (AAA)
  - Acento ámbar (`#FFB703`) sobre fondo oscuro (`#18222B`): **9.23:1** (AAA)
  - Mensajes de error (`#B42318` sobre `#FEF3F2`): **6.05:1** (AA)
  - Confirmación de envío (`#136534` sobre `#ECFDF3`): **6.78:1** (AA)

---

## 3. Cómo se comprobó

Se realizó una verificación automatizada con un script en Python 3 (`verify_site.py`) que ejecutó las siguientes pruebas sobre los archivos del proyecto:

1. **Prueba de servidor HTTP local**: Se levantó un servidor `http.server` local y se verificó mediante peticiones `GET` reales que `/index.html`, `/styles.css` y `/app.js` responden con código `HTTP 200 OK`.
2. **Validación sintáctica de HTML5 y XML/SVG**: Se analizó el árbol DOM con `HTMLParser` confirmando 0 etiquetas sin cerrar y 37 atributos `id` únicos sin colisiones, y se validaron los **23 bloques `<svg>`** con `xml.etree.ElementTree` para garantizar que son XML bien formado.
3. **Auditoría de cero recursos externos**: Se escanearon `index.html`, `styles.css` y `app.js` mediante expresiones regulares confirmando que no existe ninguna referencia `http://`, `https://`, `//` ni `@import`.
4. **Comprobación de requisitos funcionales**: Se verificó programáticamente la presencia de las 6 tarjetas de servicio (`>= 4`), las 8 tarjetas de producto con precios en `€`, la tabla de horarios, la dirección y los 6 controles del formulario de contacto.
5. **Auditoría de accesibilidad y contraste**: Se verificó que cada control del formulario posee su `<label for>` correspondiente y su contenedor de error referenciado en `aria-describedby`, y se calcularon las luminancias relativas según la fórmula oficial WCAG 2.1 para los 12 pares de color de la interfaz (todos por encima de 4.5:1).
6. **Integridad DOM-JavaScript**: Se cruzaron todos los selectores `getElementById` y contenedores `error-*` utilizados en `app.js` contra los `id` presentes en `index.html`, confirmando un 100 % de coincidencia.
