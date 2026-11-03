# Brisa Outdoor

Tienda online pequena de material de acampada (Flask + SQLite).

## Arrancar

    python3 -m venv .venv
    .venv/bin/pip install flask pytest
    .venv/bin/python app.py

Abre http://127.0.0.1:5000. La primera vez crea `tienda.db` con datos de ejemplo.

Usuarios de ejemplo:

- admin@brisa.test / Admin2026! (administrador)
- lucia@correo.test / lucia1234
- pedro@correo.test / pedro1234

## Pruebas

    .venv/bin/python -m pytest -q tests
