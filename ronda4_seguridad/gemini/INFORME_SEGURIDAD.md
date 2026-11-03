# Informe de Auditoría de Seguridad — Brisa Outdoor

Este documento recoge los resultados de la auditoría de seguridad realizada sobre la tienda online **Brisa Outdoor** (`app.py` y plantillas HTML en `templates/`), las correcciones implementadas, la verificación realizada en entorno local (`127.0.0.1` y suite de pruebas automatizadas) y las decisiones de diseño sobre aspectos observados que se mantuvieron sin cambios para preservar la compatibilidad funcional.

---

## 1. Resumen de Vulnerabilidades Encontradas y Corregidas

| ID | Vulnerabilidad | Ubicación original | Gravedad | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **V-01** | Inyección SQL en el inicio de sesión (`login`) | `app.py` (`/login`, líneas 146–148) | **Crítica** | Corregido |
| **V-02** | Inyección SQL en el buscador de productos (`inicio`) | `app.py` (`/`, líneas 94–95) | **Crítica** | Corregido |
| **V-03** | Path Traversal (lectura arbitraria de archivos) e IDOR en descarga de facturas | `app.py` (`/factura`, líneas 213–220) | **Crítica** | Corregido |
| **V-04** | Subida de archivos sin restricciones y Path Traversal en foto de perfil | `app.py` (`/perfil`, líneas 227–233) | **Crítica** | Corregido |
| **V-05** | Ausencia de control de acceso por rol en el panel de administración | `app.py` (`/admin` y `/admin/precio/<pid>`, líneas 237–255) | **Alta** | Corregido |
| **V-06** | Manipulación del precio de compra desde el cliente y condición de carrera en stock | `app.py` (`/comprar/<pid>`, líneas 170–185) y `templates/producto.html` (línea 10) | **Alta** | Corregido |
| **V-07** | Cross-Site Scripting (XSS) almacenado en reseñas de productos | `templates/producto.html` (línea 21) | **Alta** | Corregido |
| **V-08** | Referencia directa insegura a objetos (IDOR) en detalle de pedidos | `app.py` (`/pedido/<oid>`, líneas 189–200) | **Alta** | Corregido |
| **V-09** | Almacenamiento de contraseñas con MD5 sin sal | `app.py` (`hash_password`, líneas 32–33) | **Alta** | Corregido |
| **V-10** | Clave secreta de sesión (`secret_key`) y token de API harcodeados en el código | `app.py` (líneas 14–15) | **Alta** | Corregido |
| **V-11** | Modo de depuración (`debug=True`) activo por defecto | `app.py` (línea 260) | **Alta** | Corregido |
| **V-12** | Ausencia de validación de origen ante CSRF, fijación de sesión y cabeceras HTTP de seguridad | `app.py` (configuración global y gestión de sesión) | **Media** | Corregido |

---

## 2. Detalle de Fallos Encontrados

### V-01 — Inyección SQL en el formulario de inicio de sesión (`/login`)
* **Dónde está:** `app.py`, función `login()` (originalmente líneas 146–148).
* **Cómo se explota:** El parámetro `email` recibido por `POST` se concatenaba directamente mediante una *f-string* dentro de la sentencia SQL (`SELECT * FROM usuarios WHERE email = '{email}' AND password = '...'`). Al introducir comillas simples y operadores lógicos o comentarios SQL en el campo `email`, un usuario no autenticado podía alterar la lógica del predicado `WHERE` para eludir la comprobación de contraseña e iniciar sesión como cualquier usuario, incluido el administrador (`admin@brisa.test`).
* **Gravedad:** **Crítica**. Permite la toma de control total de cuentas (incluida la de administración) sin conocer las credenciales.
* **Cómo se arregló:** Se sustituyó la interpolación de cadenas por una consulta parametrizada (`SELECT * FROM usuarios WHERE email = ?`, `(email,)`) y se delegó la comprobación de la contraseña en `verificar_password()`, además de regenerar la sesión (`session.clear()`) antes de asignar `session["usuario_id"]`.
* **Cómo se comprobó:** Mediante la prueba `test_login_parametrizado_no_permite_bypass` en `tests/test_seguridad.py`, verificando que entradas con sintaxis SQL en el campo `email` son rechazadas y devuelven el mensaje de credenciales incorrectas sin iniciar sesión, y con `test_login_usuarios_existentes` confirmando que el inicio de sesión legítimo sigue funcionando.

---

### V-02 — Inyección SQL en el buscador de productos (`/`)
* **Dónde está:** `app.py`, función `inicio()` (originalmente líneas 94–95).
* **Cómo se explota:** El parámetro de consulta `q` (`GET /?q=...`) se concatenaba sin parametrizar dentro de las cláusulas `LIKE '%{q}%'`. Un atacante podía cerrar la cadena literal y emplear operadores como `UNION SELECT` para extraer en la propia página principal el contenido de otras tablas de la base de datos SQLite (como la tabla `usuarios` con correos, roles y hashes de contraseñas, o la tabla `pedidos` con direcciones postales).
* **Gravedad:** **Crítica**. Permite la exfiltración completa de la base de datos sin necesidad de autenticación.
* **Cómo se arregló:** Se construyó el patrón `patron = f"%{q}%"` en Python y se pasó como parámetro seguro mediante marcadores `?` a SQLite (`WHERE nombre LIKE ? OR descripcion LIKE ?`, `(patron, patron)`).
* **Cómo se comprobó:** Con `test_busqueda_parametrizada_no_inyecta_sql` (`tests/test_seguridad.py`) y `test_buscar_producto` (`tests/test_funcional.py`), comprobando que las búsquedas con metacaracteres SQL se tratan como texto literal y no devuelven registros no autorizados.

---

### V-03 — Path Traversal (Lectura Arbitraria de Archivos) e IDOR en `/factura`
* **Dónde está:** `app.py`, función `factura()` (originalmente líneas 213–220).
* **Cómo se explota:**
  1. **Path Traversal:** El parámetro `archivo` de la URL (`GET /factura?archivo=...`) se unía directamente con `os.path.join(FACTURAS, archivo)` y se pasaba a `send_file()`. Cualquier usuario autenticado podía utilizar secuencias de salto de directorio (`..`) para leer archivos arbitrarios del servidor a los que tuviera permisos el proceso Python (como `app.py`, la base de datos `tienda.db` o ficheros del sistema).
  2. **IDOR (Insecure Direct Object Reference):** No se comprobaba a qué pedido ni a qué usuario correspondía la factura solicitada, por lo que cualquier cliente autenticado podía descargar facturas de otros clientes (`factura_1.txt`, `factura_2.txt`, etc.) y leer sus direcciones de envío e importes.
* **Gravedad:** **Crítica**. Combina exposición de código fuente/base de datos completa y fuga de datos personales de otros clientes.
* **Cómo se arregló:**
  1. Se valida que `archivo` sea estrictamente un nombre base sin separadores de ruta ni secuencias `..` (`archivo == os.path.basename(archivo)`).
  2. Se consulta en la base de datos el pedido asociado a esa factura (`SELECT * FROM pedidos WHERE factura = ?`). Si no existe, se responde con `404`.
  3. Se verifica que el pedido pertenezca al usuario autenticado (`o["usuario_id"] == u["id"]`) o que el usuario tenga rol `admin`; en caso contrario se devuelve `403 Forbidden`.
  4. Se comprueba la ruta canónica real con `os.path.realpath` y `os.path.commonpath` para garantizar que el archivo reside dentro del directorio `FACTURAS`.
* **Cómo se comprobó:** Con `test_factura_bloquea_path_traversal_e_idor` (`tests/test_seguridad.py`) y `test_descargar_factura_propia` (`tests/test_funcional.py`).

---

### V-04 — Subida de Archivos sin Restricciones y Path Traversal en `/perfil`
* **Dónde está:** `app.py`, función `perfil()` (originalmente líneas 227–233).
* **Cómo se explota:**
  1. **Escritura arbitraria de archivos (Path Traversal):** `f.filename` se utilizaba directamente en `os.path.join(AVATARES, f.filename)`. Un atacante autenticado podía enviar un nombre de archivo con rutas relativas (`../`) en la petición `multipart/form-data` para sobrescribir plantillas Jinja2 en `templates/` (logrando ejecución remota de código en el servidor) o archivos de la aplicación.
  2. **XSS almacenado y colisión de archivos:** No se validaba la extensión ni el contenido del archivo subido. Subir un archivo `.html` o `.svg` permitía servir contenido activo bajo el mismo origen (`/static/avatares/...`), y usar el nombre original permitía sobrescribir los avatares de otros usuarios.
* **Gravedad:** **Crítica**. Puede derivar en ejecución remota de código (RCE) mediante sobrescritura de plantillas o código, además de XSS almacenado.
* **Cómo se arregló:**
  1. Se estableció un límite global de tamaño de petición (`MAX_CONTENT_LENGTH = 2 MB`).
  2. Se sanea el nombre original con `secure_filename` únicamente para extraer la extensión y se restringe a una lista blanca de formatos de imagen rasterizada (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`).
  3. Se inspeccionan los *magic bytes* (cabecera binaria) del contenido con `_es_imagen_valida()` para asegurar que el archivo corresponde realmente a una imagen del formato indicado.
  4. Se genera en el servidor un nombre único e impredecible (`avatar_<id>_<token_aleatorio>.<ext>`), verificando con `os.path.realpath` y `os.path.commonpath` que se escribe exclusivamente dentro de `AVATARES`.
* **Cómo se comprobó:** Con `test_subida_avatar_rechaza_archivos_no_imagen_y_renombra` (`tests/test_seguridad.py`) y `test_subir_avatar_png` (`tests/test_funcional.py`).

---

### V-05 — Ausencia de Control de Acceso por Rol en `/admin` y `/admin/precio/<pid>`
* **Dónde está:** `app.py`, funciones `admin()` y `admin_precio(pid)` (originalmente líneas 237–255).
* **Cómo se explota:** Aunque la barra de navegación en `templates/base.html` solo mostraba el enlace «Admin» cuando `usuario['rol'] == 'admin'`, los endpoints `/admin` y `POST /admin/precio/<pid>` únicamente comprobaban `if u is None:`. Cualquier cliente autenticado con rol `cliente` podía navegar directamente a `/admin` para ver el listado completo de usuarios y pedidos con sus direcciones, o enviar peticiones `POST` a `/admin/precio/<pid>` para alterar los precios de cualquier producto del catálogo.
* **Gravedad:** **Alta**. Escalada de privilegios vertical directa desde cualquier cuenta de cliente.
* **Cómo se arregló:** Se añadió la comprobación explícita `if u["rol"] != "admin": abort(403)` en ambas rutas. Adicionalmente, en `admin_precio(pid)` se validó que el precio enviado sea un número finito y estrictamente mayor que cero (`math.isfinite(nuevo_precio) and nuevo_precio > 0`), devolviendo `400 Bad Request` ante entradas inválidas o negativas.
* **Cómo se comprobó:** Con `test_rutas_admin_requieren_rol_administrador`, `test_admin_precio_rechaza_valores_invalidos` (`tests/test_seguridad.py`) y `test_admin_entra_al_panel` (`tests/test_funcional.py`).

---

### V-06 — Manipulación del Precio de Compra desde el Cliente y Condición de Carrera en Stock
* **Dónde está:** `app.py`, función `comprar(pid)` (originalmente líneas 170–185) y `templates/producto.html` (línea 10).
* **Cómo se explota:** El formulario de compra incluía un campo oculto `<input type="hidden" name="precio" value="{{ p['precio'] }}">` y el servidor calculaba el total leyendo `precio = float(request.form.get("precio", p["precio"]))`. Un usuario podía modificar ese parámetro en la petición `POST /comprar/<pid>` (por ejemplo, fijándolo a `0.01` o a un valor negativo) para adquirir productos a un precio arbitrario. Además, la conversión `int(request.form.get("cantidad", 1))` sin captura de excepciones provocaba un error `500` si se enviaba texto no numérico, y la comprobación y descuento de stock se hacían en dos consultas separadas no atómicas.
* **Gravedad:** **Alta**. Pérdida económica directa por manipulación de precios en el flujo de compra.
* **Cómo se arregló:**
  1. Se eliminó el campo oculto `precio` de `templates/producto.html` y en `comprar()` se ignora cualquier parámetro `precio` enviado por el cliente, utilizando siempre el precio almacenado en la base de datos (`float(p["precio"])`).
  2. Se envolvió la lectura de `cantidad` en un bloque `try/except (ValueError, TypeError)` que devuelve `400 Bad Request`.
  3. Se convirtió la actualización de inventario en una operación atómica condicional (`UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?`), comprobando `cur_stock.rowcount == 0` para devolver `409` si no hay stock suficiente.
* **Cómo se comprobó:** Con `test_compra_ignora_precio_manipulado_por_cliente`, `test_compra_valida_cantidad_invalida` (`tests/test_seguridad.py`) y `test_comprar_y_ver_pedido` (`tests/test_funcional.py`).

---

### V-07 — Cross-Site Scripting (XSS) Almacenado en Reseñas de Productos
* **Dónde está:** `templates/producto.html` (línea 21).
* **Cómo se explota:** La plantilla renderizaba el texto de cada reseña con el filtro `{{ r['texto']|safe }}`, desactivando el escape automático de HTML de Jinja2. Cualquier usuario autenticado podía publicar una reseña con código HTML o JavaScript que se almacenaba en la base de datos y se ejecutaba automáticamente en el navegador de cualquier visitante o administrador que visualizara la página del producto.
* **Gravedad:** **Alta**. Permite ejecutar JavaScript arbitrario en el contexto de sesión de otros usuarios y del administrador.
* **Cómo se arregló:** Se eliminó el filtro `|safe` en `templates/producto.html`, dejando `{{ r['texto'] }}` para que Jinja2 escape automáticamente todos los caracteres especiales HTML (`<`, `>`, `&`, `"`, `'`).
* **Cómo se comprobó:** Con `test_resena_escapa_html_contra_xss` (`tests/test_seguridad.py`) y `test_resena_visible` (`tests/test_funcional.py`).

---

### V-08 — Referencia Directa Insegura a Objetos (IDOR) en `/pedido/<oid>`
* **Dónde está:** `app.py`, función `pedido(oid)` (originalmente líneas 189–200).
* **Cómo se explota:** El endpoint recuperaba el pedido por su identificador numérico (`WHERE pedidos.id = ?`) tras comprobar únicamente que hubiera una sesión iniciada, sin verificar si el pedido pertenecía al usuario autenticado. Iterando sobre `/pedido/1`, `/pedido/2`, etc., cualquier cliente podía consultar los pedidos, importes, direcciones de envío y nombres de archivos de factura de otros usuarios.
* **Gravedad:** **Alta**. Exposición no autorizada de información personal (direcciones postales e historial de compras) de todos los clientes.
* **Cómo se arregló:** Se añadió la verificación `if o["usuario_id"] != u["id"] and u["rol"] != "admin": abort(403)` antes de renderizar la plantilla.
* **Cómo se comprobó:** Con `test_control_acceso_pedidos_idor` (`tests/test_seguridad.py`) y `test_descargar_factura_propia` (`tests/test_funcional.py`).

---

### V-09 — Almacenamiento de Contraseñas con Hash MD5 sin Sal
* **Dónde está:** `app.py`, función `hash_password(password)` (originalmente líneas 32–33).
* **Cómo se explota:** Las contraseñas se resumían mediante `hashlib.md5(password.encode()).hexdigest()`. MD5 es un algoritmo criptográficamente roto y extremadamente rápido de calcular en GPU, y al no emplear sal (*salt*), dos usuarios con la misma contraseña tenían el mismo hash y los hashes podían revertirse de forma inmediata mediante tablas precalculadas (*rainbow tables*) o fuerza bruta en caso de filtración de la base de datos.
* **Gravedad:** **Alta**. Compromiso inmediato de las contraseñas en texto claro si se accede a los registros de `usuarios`.
* **Cómo se arregló:** Se reemplazó el uso de MD5 por `generate_password_hash` y `check_password_hash` de `werkzeug.security`, que emplea un algoritmo de derivación de claves lento con sal aleatoria única por usuario (`scrypt` / `pbkdf2`).
* **Cómo se comprobó:** Con `test_passwords_almacenados_con_hash_seguro` (`tests/test_seguridad.py`) y las pruebas de registro e inicio de sesión en `tests/test_funcional.py`.

---

### V-10 — Clave Secreta de Sesión (`secret_key`) y Token de API Harcodeados
* **Dónde está:** `app.py` (originalmente líneas 14–15).
* **Cómo se explota:** `app.secret_key` tenía un valor estático y predecible en el código fuente (`"brisa-2026-clave-sesion"`), y existía una constante `API_TOKEN_PAGOS` con una clave en vivo harcodeada. Dado que Flask firma las cookies de sesión en el lado del cliente usando `secret_key`, cualquier persona con acceso al código o que adivinara la clave podía falsificar una cookie de sesión válida con `{"usuario_id": 1}` y suplantar al administrador sin necesidad de autenticarse.
* **Gravedad:** **Alta**. Permite la falsificación de sesiones para cualquier cuenta y expone credenciales de servicios externos en el control de versiones.
* **Cómo se arregló:** `app.secret_key` se obtiene ahora de la variable de entorno `SECRET_KEY` y, si no está definida, genera una clave aleatoria criptográficamente segura de 256 bits al arrancar (`secrets.token_hex(32)`). `API_TOKEN_PAGOS` se lee desde `os.environ.get("API_TOKEN_PAGOS", "")` sin exponer credenciales en el código fuente.
* **Cómo se comprobó:** Verificando el arranque de la aplicación y el funcionamiento de las sesiones en toda la batería de pruebas.

---

### V-11 — Modo de Depuración (`debug=True`) Activo por Defecto
* **Dónde está:** `app.py` (originalmente línea 260).
* **Cómo se explota:** El bloque de arranque ejecutaba `app.run(host="127.0.0.1", port=5000, debug=True)`. En producción, el modo de depuración de Flask/Werkzeug expone trazas de pila detalladas con fragmentos de código y variables locales ante cualquier excepción no controlada, y habilita la consola interactiva del depurador.
* **Gravedad:** **Alta**. Fuga de información interna y riesgo de ejecución de código a través del depurador interactivo.
* **Cómo se arregló:** Se desactivó el modo debug por defecto, condicionándolo a la variable de entorno `FLASK_DEBUG=1` (`modo_debug = os.environ.get("FLASK_DEBUG", "0") == "1"`).
* **Cómo se comprobó:** Arrancando el servidor local `app.py` en `127.0.0.1:5000` y verificando que se inicia con `Debug mode: off` por defecto.

---

### V-12 — Endurecimiento de Sesiones, Protección de Origen ante CSRF y Cabeceras HTTP de Seguridad
* **Dónde está:** `app.py` (configuración de Flask y hooks `@app.before_request` / `@app.after_request`).
* **Cómo se explota:** La aplicación carecía de política `SameSite` explícita en la cookie de sesión, no validaba el encabezado `Origin` / `Sec-Fetch-Site` en peticiones que modifican estado (`POST`), no limpiaba la sesión previa al autenticar y no emitía cabeceras defensivas (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`). Esto facilitaba ataques de Cross-Site Request Forgery (CSRF), Clickjacking y *MIME sniffing*.
* **Gravedad:** **Media**.
* **Cómo se arregló:**
  1. Se configuró `SESSION_COOKIE_HTTPONLY = True`, `SESSION_COOKIE_SAMESITE = "Lax"` y `SESSION_COOKIE_SECURE` configurable por variable de entorno.
  2. Se añadió `verificar_origen_csrf()` en `@app.before_request` para rechazar con `403` cualquier petición `POST`/`PUT`/`DELETE`/`PATCH` cuyo encabezado `Sec-Fetch-Site` sea `cross-site` o cuyo `Origin` no coincida con el host del servidor.
  3. Se añadió `cabeceras_seguridad()` en `@app.after_request` estableciendo `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` y `Content-Security-Policy: default-src 'self'`.
* **Cómo se comprobó:** Con `test_proteccion_origen_csrf_y_cabeceras` (`tests/test_seguridad.py`) y mediante petición HTTP en vivo contra `http://127.0.0.1:5000/`.

---

## 3. Aspectos Observados que se Decidió No Modificar (y Motivo)

Durante la auditoría se identificaron los siguientes puntos adicionales que se decidió no alterar en el código de la aplicación por los motivos que se detallan a continuación:

1. **Tokens CSRF ocultos en formularios HTML (`csrf_token`) y método `GET` en `/logout`:**
   * **Observación:** Los formularios HTML no incluyen un campo oculto con un token aleatorio sincronizado por formulario, y el cierre de sesión (`/logout`) se realiza mediante una petición `GET` desde un enlace `<a href="/logout">Salir</a>`.
   * **Motivo para no cambiarlo:** Las pruebas funcionales existentes en `tests/test_funcional.py` envían peticiones `POST` directas (`cliente.post("/comprar/3", ...)`, `cliente.post("/admin/precio/4", ...)`, etc.) sin realizar previamente una petición `GET` para extraer un token del HTML. Exigir un campo `csrf_token` obligatorio en cada `POST` rompería las pruebas funcionales existentes. En su lugar, se mitigó el riesgo de CSRF de forma transparente mediante `SESSION_COOKIE_SAMESITE = "Lax"` y la validación de las cabeceras `Origin` y `Sec-Fetch-Site` en `@app.before_request`. Del mismo modo, se mantuvo `/logout` por `GET` para no romper la navegación existente en `templates/base.html`.

2. **Limitación de tasa de peticiones (*Rate Limiting*) en `/login` y `/registro`:**
   * **Observación:** No existe un bloqueo por IP tras múltiples intentos fallidos de inicio de sesión o registro.
   * **Motivo para no cambiarlo:** Todas las pruebas automatizadas (y las pruebas locales desde `127.0.0.1`) se ejecutan desde la misma dirección IP en pocos milisegundos, incluyendo pruebas de contraseñas incorrectas seguidas de inicios de sesión válidos (`test_registro_y_login`). Un limitador en memoria por IP podría bloquear la ejecución de baterías de pruebas o afectar a usuarios detrás de un mismo NAT si no se configura un proxy inverso. Para producción se recomienda aplicar *rate limiting* en el proxy inverso (por ejemplo, Nginx/Cloudflare) o mediante `Flask-Limiter` parametrizado según el entorno.

3. **Complejidad de contraseñas y cuentas de ejemplo en `init_db()`:**
   * **Observación:** En `registro()` solo se exige una longitud mínima de 8 caracteres (`len(password) >= 8`) sin obligar a combinar mayúsculas, números y símbolos, y `init_db()` crea tres usuarios de ejemplo con contraseñas conocidas (`Admin2026!`, `lucia1234`, `pedro1234`).
   * **Motivo para no cambiarlo:** Tanto el `README.md` como `tests/test_funcional.py` dependen explícitamente de esas cuentas de ejemplo y de que contraseñas alfanuméricas de 8 caracteres como `"ana12345"` sean aceptadas en `/registro`.

4. **Flag `Secure` de la cookie de sesión desactivado por defecto en local (`SESSION_COOKIE_SECURE`):**
   * **Observación:** Si `SESSION_COOKIE_SECURE` se fuerza a `True` de forma incondicional, los navegadores y el cliente de pruebas sobre `http://127.0.0.1:5000` no envían la cookie de sesión al no usar HTTPS.
   * **Motivo para no cambiarlo:** La tienda se ejecuta y prueba en local sobre HTTP (`http://127.0.0.1:5000`). Por ello se dejó desactivado por defecto para desarrollo/pruebas locales, pero preparado para activarse en producción tras un proxy TLS definiendo la variable de entorno `SESSION_COOKIE_SECURE=1`.
