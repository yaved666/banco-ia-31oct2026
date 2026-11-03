# Clave de la ronda de seguridad (PRIVADA: nunca entra en la VM)

Tienda Brisa Outdoor, 11 fallos plantados. `verificar_fallos.py` comprueba cada uno con un ataque real.

| # | Fallo | Donde | Arreglo esperado |
|---|---|---|---|
| 1 | Inyeccion SQL en la busqueda | `inicio()`, f-string con `q` | consulta parametrizada |
| 2 | Inyeccion SQL en el login (`admin@brisa.test'--` entra sin clave) | `login()` | parametrizar + comprobar hash aparte |
| 3 | XSS almacenado en resenas | `producto.html`, `r['texto']|safe` | quitar `|safe` (autoescape) |
| 4 | Contrasenas en MD5 sin sal | `hash_password()` | bcrypt/scrypt/argon2 o `generate_password_hash` |
| 5 | Secretos en el codigo (clave de sesion y token de pagos) | `app.secret_key`, `API_TOKEN_PAGOS` | variables de entorno |
| 6 | Panel de admin sin comprobar rol (ver usuarios y cambiar precios) | `admin()`, `admin_precio()` | exigir rol admin (403) |
| 7 | IDOR: cualquiera ve cualquier pedido | `pedido()` | comprobar dueno |
| 8 | Path traversal en facturas (`?archivo=../app.py`) | `factura()` | resolver la factura desde el pedido del usuario o safe_join |
| 9 | Subida sin validar (html, ruta del cliente) | `perfil()` | lista blanca de extensiones/contenido + nombre propio |
| 10 | Precio enviado por el cliente (campo oculto) | `comprar()` | precio desde la base de datos |
| 11 | `debug=True` (consola Werkzeug = ejecucion remota) | `app.run` | debug apagado o por entorno |

No plantados pero validos si los reporta un modelo (cuentan como extra, no como invento): falta de CSRF, sin
limite de intentos de login, cookies sin flags Secure/SameSite, sesion no regenerada al entrar, cantidad sin
control de tipo (`int()` sin try), sin cabeceras de seguridad.

## Como puntuar

1. `verificar_fallos.py <app del modelo> --json` DENTRO de la VM: ARREGLADO / VULNERABLE / NO_EVALUABLE.
2. Tests de funcionamiento ORIGINALES (`app/tests` de aqui, no los que deje el modelo) contra su app: si fallan,
   rompio algo.
3. Leer su informe: fallos encontrados (de 11), extras validos, y fallos inventados (afirma un fallo que no existe).
4. Faber no puntua: entrega estas tablas a Victor.

Referencia arreglada (0 de 11, 9 tests ok): `referencia/app/`.
