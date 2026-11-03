# Brisa Outdoor

Tienda online pequeña de material de acampada (Flask + SQLite).

## Instalación y arranque local

    python3 -m venv .venv
    .venv/bin/pip install -r requirements-dev.txt
    .venv/bin/python app.py

Abre http://127.0.0.1:5000. El primer arranque crea `tienda.db` y el catálogo, **sin cuentas ni pedidos de ejemplo**. El depurador está desactivado.

Para crear el administrador con una contraseña propia:

    .venv/bin/flask --app app crear-admin

También puedes crear la base antes de arrancar con `.venv/bin/flask --app app init-db`. Ese comando se niega a sobrescribir una base existente. La función interna `init_db` recrea tablas: se usa exclusivamente para inicialización y pruebas; no debe llamarse sobre datos reales.

## Demostración local

Sobre una carpeta sin `tienda.db`, inicia con:

    BRISA_DEMO=1 .venv/bin/python app.py

Sólo este modo crea las cuentas y pedidos de ejemplo:

- admin@brisa.test / Admin2026! (administrador)
- lucia@correo.test / lucia1234
- pedro@correo.test / pedro1234

No publiques una base de demostración. La variable sólo afecta a la creación de una base nueva: quitarla no elimina usuarios que ya existan.

## Pruebas

    .venv/bin/python -m pytest -q tests
    .venv/bin/python tools/comprobar_local.py
    .venv/bin/pip check

Las pruebas usan bases y archivos temporales; no modifican los pedidos reales. La segunda orden levanta su propio servidor en `127.0.0.1`, con puerto libre, ejecuta ataques y operaciones normales por HTTP y lo detiene al terminar. No envía peticiones a sistemas externos.

## Configuración antes de producción

- Instala `requirements.txt`; usa un servidor WSGI detrás de HTTPS, sin exponer el servidor de desarrollo de Flask.
- Define `BRISA_SECRET_KEY` con al menos 32 caracteres generados aleatoriamente; por ejemplo, genera un valor con `.venv/bin/python -c 'import secrets; print(secrets.token_hex(32))'` y guárdalo en el gestor de secretos del despliegue. Todos los procesos deben compartirlo. No lo guardes en el repositorio. Rotarlo invalida las sesiones anteriores.
- Define `BRISA_HTTPS=1` para cookies `Secure` y HSTS cuando el sitio se sirva por HTTPS. No lo actives para la prueba local por HTTP. `HttpOnly`, `SameSite=Lax`, CSRF y las otras cabeceras están activos también en local.
- En local, sin `BRISA_SECRET_KEY`, se genera y conserva una clave privada en `instance/session.key` (modo 0600). Mantén privado `instance/`; no publiques ese archivo ni lo empaquetes como código.
- Mantén privados `tienda.db`, sus archivos auxiliares, `facturas/`, `instance/` y las copias de seguridad. El servidor web debe entregar los estáticos mediante Flask o bloquear explícitamente `static/avatares/`; los archivos antiguos de esa carpeta ya no se sirven desde Flask. Los nuevos avatares están fuera de `static/` y se recodifican como PNG.
- Si partes de una base antigua, conserva una copia de seguridad y retira las cuentas de ejemplo o cambia sus contraseñas mediante administración local antes de publicar. Los hashes MD5 antiguos se migran a scrypt al entrar correctamente; las cuentas inactivas necesitan un cambio de contraseña para eliminar esos hashes. No ejecutes `init_db` para migrar una base real.
- Los avatares antiguos no se sirven: cada usuario puede volver a subir su imagen. No reutilices archivos sin validarlos; podrían proceder de la subida vulnerable.
- El límite de acceso persiste en SQLite: 10 intentos por pareja IP/email y 100 por IP en ventanas de 15 minutos. No se confía en `X-Forwarded-For`. Si hay un proxy, configura el servidor para recibir una IP fiable y evita que todas las visitas compartan el mismo límite. No habilites confianza indiscriminada en cabeceras del cliente.

Los formularios POST requieren `csrf_token` de la misma sesión, obtenido de un formulario GET. Salir usa POST. La sesión autenticada se renueva al acceder y caduca tras ocho horas de inactividad.

Consulta `INFORME_SEGURIDAD.md` para hallazgos, evidencias y límites de la revisión.
