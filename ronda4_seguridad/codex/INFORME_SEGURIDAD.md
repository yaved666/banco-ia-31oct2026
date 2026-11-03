# Informe de seguridad — Brisa Outdoor

Fecha: 31 de octubre de 2026.

## Alcance y resultado

Se revisaron íntegramente `app.py`, las nueve plantillas, los estáticos, las instrucciones de arranque y las pruebas originales. Las carpetas de facturas y avatares no contenían datos de clientes. No había una base `tienda.db` existente que migrar. Se corrigieron los fallos descritos a continuación y se añadieron comprobaciones de regresión.

Las gravedades son cualitativas, según el impacto observado y las condiciones indicadas; no son puntuaciones CVSS. No se presume que esta revisión garantice ausencia de otros fallos.

Las reproducciones se hicieron con bases y archivos temporales: primero contra una copia del código original y después contra la versión corregida. Se usó el cliente de pruebas de Flask, sin conexiones de red, y un servidor HTTP real enlazado exclusivamente a `127.0.0.1`, en un puerto efímero. No se atacó ningún sistema externo. Los nombres de dominio empleados como cabeceras o datos de prueba no se resolvieron ni visitaron.

## Fallos encontrados y corregidos

### 1. Inyección SQL en el inicio de sesión — Crítica

- **Dónde:** `app.py`, `login()`, interpolación del email dentro de SQL.
- **Explotación:** enviar `email=' OR 1=1 --` y cualquier contraseña. En el original se obtuvo una sesión con `usuario_id=1`, el administrador.
- **Arreglo:** consulta parametrizada por email y comprobación separada de la contraseña. Se normaliza el email como en el registro y se renueva la sesión al autenticar.
- **Verificación:** el mismo ataque muestra credenciales incorrectas y no crea una sesión autenticada; comprobado con pytest y HTTP real. Los accesos normales siguen funcionando.

### 2. Inyección SQL en el buscador — Alta

- **Dónde:** `app.py`, `inicio()`, interpolación de `q` en dos expresiones `LIKE`.
- **Explotación:** `' UNION SELECT id,email,password,0,0 FROM usuarios --` adapta la tabla de usuarios a las cinco columnas del catálogo. Ejecutar la consulta original con ese parámetro devolvió emails y hashes. La exposición no necesita autenticación.
- **Arreglo:** ambos patrones `LIKE` se pasan como parámetros SQLite.
- **Verificación:** el payload se busca como texto, sin devolver emails ni hashes y sin dañar las tablas; pruebas automatizadas y HTTP real. Se conserva la búsqueda normal por subcadena.

### 3. Clave de sesión fija y publicada en el código — Crítica

- **Dónde:** `app.py`, asignación original de `app.secret_key`.
- **Explotación:** firmar una cookie Flask con la clave original y `usuario_id=1`. La cookie fabricada abrió `/admin` con respuesta 200 en el original.
- **Arreglo:** clave mediante `BRISA_SECRET_KEY` o, en local, secreto aleatorio persistente en `instance/session.key`, creado con permisos 0600 y bloqueo durante su inicialización. No se usa la antigua clave ni claves alternativas de compatibilidad. Se exige longitud mínima al valor configurado.
- **Verificación:** la misma cookie antigua ya no autentica y recibe redirección al acceso. Comprobado en pytest y HTTP real. La nueva autenticación mantiene sesiones válidas; rotar el secreto invalida las anteriores.

### 4. Ausencia de autorización administrativa — Alta

- **Dónde:** `app.py`, `admin()` y `admin_precio()`.
- **Explotación:** cualquier cliente autenticado podía leer todos los usuarios, pedidos y direcciones y modificar precios mediante POST. Ocultar el enlace en la plantilla no protegía las rutas.
- **Arreglo:** ambas rutas comprueban el rol obtenido de la base de datos y devuelven 403 para un cliente.
- **Verificación:** Lucía recibe 403 al consultar el panel y al intentar modificar un precio con un token CSRF válido; el precio queda intacto. El administrador conserva acceso y capacidad de edición. También se comprueba que enviar `rol=admin` al registro no eleva privilegios.

### 5. Lectura de pedidos y facturas de otros clientes — Alta

- **Dónde:** `app.py`, `pedido()` y `factura()`.
- **Explotación:** Lucía podía abrir `/pedido/2` y descargar `factura_2.txt`, pertenecientes a Pedro, cambiando identificadores predecibles. Ambas peticiones devolvieron 200 en el original.
- **Arreglo:** comprobar propietario o rol administrativo antes de devolver datos. Una factura debe estar asociada a un pedido autorizado en la base; conocer su nombre no concede acceso. Se usa 404 para recursos inexistentes o ajenos.
- **Verificación:** los dos accesos ajenos reciben 404; los propios y los del administrador siguen devolviendo 200. `mis_pedidos()` ya filtraba por usuario y se conserva y verifica ese aislamiento.

### 6. Lectura arbitraria de archivos mediante la descarga — Alta

- **Dónde:** `app.py`, `factura()`, `send_file(os.path.join(FACTURAS, archivo))`.
- **Explotación:** `archivo=../db` en la instalación temporal original devolvió la cabecera `SQLite format 3`, confirmando la lectura de la base fuera del directorio de facturas. Las rutas absolutas también podían eludir `os.path.join`.
- **Arreglo:** formato de nombre restringido, asociación con pedido autorizado y comprobación de archivo regular, directorio resuelto y ausencia de enlace simbólico. Las nuevas facturas usan nombres aleatorios y creación exclusiva.
- **Verificación:** rutas relativas, absolutas, codificadas, vacías, inexistentes y enlaces simbólicos reciben 404. La descarga propia sigue funcionando, como adjunto de texto.

### 7. XSS almacenado en las reseñas — Alta

- **Dónde:** `templates/producto.html`, `r['texto']|safe`.
- **Explotación:** publicar `<script>alert(1)</script>` guardaba y devolvía una etiqueta ejecutable a quienes consultasen el producto. Se confirmó que el original incluía el payload sin escapar. Esto podría permitir actuar con la sesión del visitante; no se ejecutó JavaScript en un navegador durante esta revisión.
- **Arreglo:** eliminar `safe` y usar el escape automático de Jinja. Como protección adicional, CSP sin ejecución de scripts.
- **Verificación:** las reseñas guardadas se muestran con `&lt;script&gt;`, sin etiquetas ejecutables. También se comprueban nombre, búsqueda y dirección con contenido HTML hostil. Las reseñas normales, incluidos caracteres como `&`, siguen siendo visibles.

### 8. Subida con escritura arbitraria y contenido activo — Crítica

- **Dónde:** `app.py`, `perfil()`, nombre del cliente utilizado directamente como ruta dentro de `static/avatares`.
- **Explotación:** subir un archivo con `filename=../fuera.txt` escribió fuera del directorio permitido en el original. Rutas adicionales permitían alcanzar archivos modificables por el proceso, incluidas potencialmente plantillas o código. También se admitía HTML/SVG servido bajo el mismo origen. Se demostró escritura inocua fuera de la carpeta; no se ejecutó código del sistema ni se sobrescribió código real.
- **Arreglo:** ignorar por completo el nombre recibido; decodificar imágenes PNG/JPEG/GIF/WebP con Pillow, limitar dimensiones, convertir y volver a codificar a PNG, reducir a 512×512 y guardar con nombre aleatorio exclusivo fuera de `static/`. Límite de petición de 2 MiB y de imagen de cuatro millones de píxeles. La ruta `/avatar/<uid>` sólo entrega los PNG generados. Se bloquea la antigua ruta estática, también con componentes `./` normalizables.
- **Verificación:** HTML/SVG y archivos no válidos se rechazan, imágenes enormes y peticiones excesivas reciben 400/413. Un PNG válido con nombre `../../fuera.png` se guarda dentro del directorio seguro, sin escribir fuera; el contenido añadido de script desaparece al recodificar. Subir repetidamente el mismo nombre no sobrescribe el destino elegido por otro usuario. La prueba funcional original del PNG sigue pasando.

### 9. Falta de protección CSRF y cierre por GET — Alta

- **Dónde:** todos los formularios POST y `/logout`, que modificaba la sesión por GET.
- **Explotación:** el servidor original aceptó una reseña sin token y con `Origin: https://atacante.invalid`. Cuando el navegador envía la cookie, una página atacante podía provocar compras, reseñas, subidas o cambios de precio administrativos. El envío de cookies entre sitios depende del navegador y de SameSite; no se afirma que todo POST entre sitios las incluya. Además, el acceso era vulnerable a login CSRF y cerrar sesión requería sólo cargar una URL.
- **Arreglo:** token aleatorio vinculado a la sesión, comprobado globalmente en métodos de escritura, incluido acceso y registro. Token en todos los formularios; se renueva al entrar. Cierre mediante POST. Cookies `SameSite=Lax` como defensa adicional.
- **Verificación:** todos los POST relevantes rechazan tokens ausentes, falsos, Unicode o de otra sesión. El token anterior al acceso queda invalidado. GET de cierre devuelve 405 y el formulario correcto sí cierra sesión. CSRF permanece activo en las pruebas, también con `TESTING=True`.

### 10. Precio de compra controlado por el cliente — Alta

- **Dónde:** `app.py`, `comprar()`, lectura del campo `precio`; campo oculto en la plantilla del producto.
- **Explotación:** una compra con `precio=-10` produjo un pedido con total −10 en el original. Cambiar un campo oculto permitía comprar por cualquier precio.
- **Arreglo:** retirar ese campo del formulario e ignorarlo en el servidor, tomando siempre el precio del catálogo dentro de la transacción. Cálculo decimal del total y redondeo a céntimos.
- **Verificación:** valores `0.01`, negativos, `NaN`, `Infinity` y texto no alteran el importe. Dos hornillos cuestan 64,00 y descuentan dos unidades, comprobado en BD y HTTP.

### 11. Carrera al reservar existencias — Media

- **Dónde:** `app.py`, `comprar()`, lectura del stock separada de su actualización y sin reserva condicional.
- **Explotación:** dos peticiones leyeron deliberadamente la misma última unidad antes de continuar. El original aceptó ambas con 302 y terminó con stock −1.
- **Arreglo:** transacción SQLite `BEGIN IMMEDIATE`, nueva lectura del precio dentro de ella y descuento condicionado por `stock >= cantidad`. Si no se puede reservar, se revierte y responde 409. Pedido y stock se confirman juntos.
- **Verificación:** una prueba con dos clientes y barrera fuerza ambas lecturas iniciales; sólo una compra recibe 302, la otra 409 y el stock final es cero. También se simula un fallo al escribir la factura: no quedan ni pedido confirmado ni descuento de stock.

### 12. Contraseñas con MD5 sin sal — Alta ante una filtración de datos

- **Dónde:** `app.py`, `hash_password()` y comparación original durante el acceso.
- **Explotación:** los hashes deterministas y rápidos permiten probar diccionarios fuera de línea y detectar contraseñas iguales. La inyección SQL y la descarga arbitraria facilitaban obtenerlos. No se realizó una campaña de cracking.
- **Arreglo:** hashes scrypt de Werkzeug con sal aleatoria. Registro, cuentas nuevas y administrador local usan el nuevo formato. Compatibilidad con MD5 únicamente para comprobar una contraseña antigua y reemplazar inmediatamente su hash tras un acceso válido.
- **Verificación:** contraseñas iguales producen hashes distintos; la base nueva contiene scrypt. Se introduce un hash MD5 antiguo en una base temporal, se entra con su contraseña y se verifica la migración a scrypt. Las cuentas inactivas antiguas requieren restablecimiento o acceso para migrar; no es posible convertir su hash sin la contraseña.

### 13. Cuentas de ejemplo con credenciales públicas por defecto — Alta si se publicaba ese arranque

- **Dónde:** `app.py`, inicialización automática original, y credenciales documentadas en `README.md`.
- **Explotación:** una instalación nueva creaba un administrador con la contraseña pública `Admin2026!`. Cualquiera que conociera el ejemplo podía entrar como administrador si se desplegaba así.
- **Arreglo:** la inicialización normal no crea usuarios ni pedidos de ejemplo. Sólo `BRISA_DEMO=1` en el arranque, o `init_db(demo=True)` explícito en pruebas, permite la demostración. Comando local `crear-admin` con contraseña propia oculta y confirmación; `init-db` se niega a sobrescribir una base existente.
- **Verificación:** inicialización normal con cero usuarios y pedidos y cinco productos; demostración y pruebas funcionales conservan sus cuentas. Se comprueba la creación del administrador local y que el comando de inicialización no borra una base existente. No había cuentas reales o antiguas que retirar en este directorio. Las instrucciones advierten que quitar la variable demo no limpia una base ya creada.

### 14. Depurador de Flask activado en el arranque — Alta si se hacía accesible

- **Dónde:** final de `app.py`, `app.run(..., debug=True)`.
- **Explotación/condiciones:** una excepción podía mostrar el depurador interactivo y detalles internos. Su consola podría permitir ejecución de código si se cumplieran las condiciones de acceso/desbloqueo. El original enlazaba a loopback, lo que limitaba la exposición directa; un proxy podría publicarlo. No se intentó obtener el PIN ni se afirma haber explotado la consola.
- **Arreglo:** `debug=False`, manteniendo el enlace local. Documentado el uso de WSGI y HTTPS para producción.
- **Verificación:** configuración sin debug en las pruebas y servidor de comprobación sin depurador. Los valores numéricos inválidos ahora producen respuestas controladas.

### 15. Entradas sin límites y conversiones numéricas sin validar — Media para disponibilidad e integridad

- **Dónde:** conversiones `int`/`float` de compra y precio administrativo, subida y campos de texto sin límites.
- **Explotación:** cantidades como `no` provocaban una excepción; precios no finitos o negativos podían producir datos inválidos y errores. Las subidas no tenían tope de tamaño. No se ejecutó una prueba destructiva de agotamiento de disco o memoria.
- **Arreglo:** cantidades enteras positivas acotadas; precios administrativos finitos entre 0,01 y 1.000.000, con redondeo a céntimos; 400 para datos inválidos. Límites de formulario y petición, contraseña hasta 1024 caracteres, email hasta 254, nombre hasta 100, reseña hasta 5000 y dirección hasta 500.
- **Verificación:** casos parametrizados para texto, negativos, ceros, fracciones en cantidades, enteros enormes y no finitos; no cambian el stock ni los pedidos o precios. Pruebas de límites de texto, imagen y cuerpo HTTP. Se conserva el mínimo original de ocho caracteres para registros normales.

### 16. Intentos de acceso ilimitados — Media

- **Dónde:** `app.py`, `login()` original.
- **Explotación:** no existía un contador o espera que frenase intentos repetidos de contraseña. Se confirma por inspección del flujo; no se hizo fuerza bruta contra usuarios reales.
- **Arreglo:** contadores transaccionales en SQLite: máximo diez intentos por pareja IP/email y cien por IP, en ventanas de quince minutos. Reserva del intento antes del hash costoso, persistencia entre procesos y respuesta 429 con `Retry-After`. La pareja se reinicia con un acceso correcto; el límite global por IP se conserva. No se confía en `X-Forwarded-For` enviado por el cliente.
- **Verificación:** diez intentos fallidos y bloqueo del undécimo, incluso desde otro cliente; tras adelantar el reloj de prueba quince minutos se permite entrar. El límite global evita seguir creando nuevas parejas cuando una IP ya está bloqueada. No sustituye a protección distribuida del perímetro.

## Refuerzos adicionales

Sin atribuirles por sí solos una explotación demostrada: cookies HttpOnly y SameSite explícitas, caducidad por ocho horas de inactividad, `Secure` y HSTS al activar `BRISA_HTTPS=1`, CSP, prohibición de marcos, `nosniff`, política de referencia y `Cache-Control: no-store`. Se comprueba la emisión real de los atributos de cookie para HTTPS y HSTS. Se añadieron dependencias fijadas y exclusiones para secretos, base, facturas y entorno virtual.

## Verificación reproducible

Desde este directorio:

```sh
.venv/bin/python -m pytest -q tests
.venv/bin/python tools/comprobar_local.py
.venv/bin/pip check
```

Resultados finales: **58 pruebas aprobadas**, incluidas las nueve funcionales originales, y **21 comprobaciones HTTP locales aprobadas**. `pip check` no encuentra dependencias incompatibles. Antes de los cambios las nueve pruebas originales también pasaban: por sí solas no detectaban los problemas de seguridad.

En `tests/test_funcional.py` se mantienen todos los casos y sus aserciones originales. Se añadió un auxiliar que obtiene y envía el token de los formularios y se hizo explícita la inicialización de datos demo. No se deshabilitó CSRF ni se cambiaron expectativas para admitir un fallo de seguridad. `tests/test_seguridad.py` amplía la cobertura con ataques, aislamiento, límites, migración de contraseña, concurrencia y rollback. `tools/comprobar_local.py` usa cookies y multipart reales por HTTP y elimina su servidor y datos temporales al finalizar.

## Observaciones, decisiones y límites

- **Token de pagos aparente:** la constante `API_TOKEN_PAGOS` no tenía ningún uso ni integración de pagos. Se retiró del código. Su nombre/formato no demuestra que fuera una credencial real o secreta; no se intentó validarla contra un proveedor. No se afirma una filtración efectiva. Si correspondiese a un secreto real, su propietario deberá revocarlo; quitarlo del archivo no lo revoca.
- **Avatares antiguos:** no había imágenes de usuario en la carpeta recibida. Los nuevos se sirven recodificados fuera de estáticos. Se bloquea la antigua carpeta desde Flask, sin borrar archivos arbitrariamente. En una instalación previa haría falta volver a subir los avatares y bloquear esa carpeta también si un servidor frontal entrega estáticos directamente. Se prioriza no volver a publicar archivos potencialmente hostiles.
- **HTTPS y despliegue:** no se recibió configuración de proxy, dominio, certificados ni servidor productivo; no se puede afirmar cómo se protegería el tráfico real. Se conserva HTTP local para el funcionamiento solicitado y se documentan `BRISA_HTTPS=1`, secreto compartido y WSGI. No se desplegó nada ni se modificaron sistemas externos.
- **Proxy y rate limit:** la IP fiable depende del despliegue. Sin configuración adicional detrás de un proxy, los visitantes pueden compartir el límite. No se añadió confianza automática en cabeceras que permitiría falsificar la IP. Los contadores no garantizan protección frente a múltiples IP o agotamiento general de recursos.
- **Registro y funcionalidad:** se conserva el mensaje de email ya registrado, que revela si existe una cuenta; es una exposición limitada aceptada para conservar ese comportamiento. Se mantiene el mínimo de ocho caracteres, sin imponer reglas de composición, correo de confirmación ni MFA que no existían. No hay recuperación de contraseña o gestión completa de usuarios que auditar.
- **Búsqueda:** `%` y `_` siguen siendo comodines de `LIKE`, como antes. Con parámetros no permiten introducir SQL; se conserva su comportamiento de búsqueda.
- **Dinero y persistencia:** los totales se calculan con Decimal, pero se conserva el esquema REAL de SQLite para evitar una migración incompatible. La escritura de un archivo y el commit SQLite no forman una transacción común: una caída después de crear la factura puede dejar un archivo huérfano, sin pedido confirmado. No se añadió recuperación ante caídas, conciliación contable, idempotencia de compras ni un sistema de pagos; un nuevo POST válido continúa siendo una compra nueva.
- **Almacenamiento:** facturas y direcciones se conservan en texto, como antes; el usuario del proceso y las copias deben protegerse con permisos y controles del despliegue. Las subidas están limitadas individualmente, pero no hay cuota total por usuario y pueden acumular versiones de avatares; no se borraron datos anteriores automáticamente. Tampoco se realizó una prueba de saturación sostenida ni se implementó un perímetro anti-DoS.
- **Sesiones robadas:** cambiar el secreto revoca todas las sesiones. No hay registro central de sesiones para revocación selectiva inmediata; se conserva el modelo de cookies firmadas de Flask. Se limita su vida y se evita el cacheado de páginas con datos.
- **Dependencias:** se instalaron y fijaron Flask 3.1.3, Werkzeug 3.1.9 y Pillow 13.0.0 para esta ejecución; pytest 9.2.0 se usa en desarrollo. `pip check` comprueba compatibilidad, no ausencia de CVE. No se consultó una base externa de vulnerabilidades ni se certifican las dependencias como libres de fallos. Hará falta mantenerlas actualizadas.
- **Límites del ensayo:** no se probó ejecución en un navegador, un proxy productivo, explotación del depurador, cracking de contraseñas ni ejecución remota mediante archivos sobrescritos. Las afirmaciones se limitan a código revisado, efectos observados, respuestas HTTP y comprobaciones de base/archivos; los impactos potenciales se identifican como tales.
