"""Pruebas de regresion de seguridad para Brisa Outdoor."""
import io
import os
import sqlite3
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import app as tienda  # noqa: E402
from tests.test_funcional import PNG_1PX, cliente, entrar  # noqa: E402, F401


def test_busqueda_parametrizada_no_inyecta_sql(cliente):
    consulta = "' OR 1=1 --"
    r = cliente.get("/", query_string={"q": consulta})
    assert r.status_code == 200
    assert "No hay productos." in r.text
    assert "admin@brisa.test" not in r.text


def test_login_parametrizado_no_permite_bypass(cliente):
    r = entrar(cliente, "admin@brisa.test' --", "cualquiera")
    assert r.status_code == 200
    assert "incorrectos" in r.text
    assert "Salir" not in r.text


def test_passwords_almacenados_con_hash_seguro(cliente):
    con = sqlite3.connect(tienda.DB)
    fila = con.execute("SELECT password FROM usuarios WHERE email = 'lucia@correo.test'").fetchone()
    con.close()
    assert fila is not None
    # Werkzeug genera hashes con prefijo de algoritmo y sal (scrypt o pbkdf2), no MD5 de 32 hex
    assert len(fila[0]) > 32
    assert ":" in fila[0] or "$" in fila[0]


def test_resena_escapa_html_contra_xss(cliente):
    entrar(cliente, "lucia@correo.test", "lucia1234")
    etiqueta_prueba = "<b>Texto con <script>alert(1)</script></b>"
    cliente.post("/producto/2", data={"texto": etiqueta_prueba})
    r = cliente.get("/producto/2")
    assert r.status_code == 200
    assert "<script>alert(1)</script>" not in r.text
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in r.text


def test_compra_ignora_precio_manipulado_por_cliente(cliente):
    entrar(cliente, "pedro@correo.test", "pedro1234")
    r = cliente.post(
        "/comprar/3",
        data={"cantidad": "2", "precio": "0.01", "direccion": "Calle Sol 1, Malaga"},
        follow_redirects=True,
    )
    assert r.status_code == 200
    # El producto 3 cuesta 32.00 EUR; 2 unidades deben cobrar 64.00 EUR y no 0.02 EUR
    assert "64.00 EUR" in r.text
    assert "0.02 EUR" not in r.text


def test_compra_valida_cantidad_invalida(cliente):
    entrar(cliente, "pedro@correo.test", "pedro1234")
    r = cliente.post("/comprar/3", data={"cantidad": "no-numero", "direccion": "Calle Sol 1"})
    assert r.status_code == 400


def test_control_acceso_pedidos_idor(cliente):
    # El pedido 1 pertenece a lucia (id=2). Pedro (id=3) no debe poder verlo.
    entrar(cliente, "pedro@correo.test", "pedro1234")
    r = cliente.get("/pedido/1")
    assert r.status_code == 403
    # El administrador si puede consultarlo
    entrar(cliente, "admin@brisa.test", "Admin2026!")
    r_admin = cliente.get("/pedido/1")
    assert r_admin.status_code == 200


def test_factura_bloquea_path_traversal_e_idor(cliente):
    entrar(cliente, "pedro@correo.test", "pedro1234")
    # Intento de lectura fuera de la carpeta de facturas
    r_traversal = cliente.get("/factura", query_string={"archivo": "../app.py"})
    assert r_traversal.status_code in (400, 404)
    # Intento de lectura de la factura de otro usuario (factura_1.txt es de lucia)
    r_idor = cliente.get("/factura", query_string={"archivo": "factura_1.txt"})
    assert r_idor.status_code == 403


def test_rutas_admin_requieren_rol_administrador(cliente):
    entrar(cliente, "lucia@correo.test", "lucia1234")
    assert cliente.get("/admin").status_code == 403
    r = cliente.post("/admin/precio/4", data={"precio": "1.00"})
    assert r.status_code == 403
    # Verificar que el precio original (24.99) no cambio
    assert "24.99" in cliente.get("/").text


def test_admin_precio_rechaza_valores_invalidos(cliente):
    entrar(cliente, "admin@brisa.test", "Admin2026!")
    assert cliente.post("/admin/precio/4", data={"precio": "-5.00"}).status_code == 400
    assert cliente.post("/admin/precio/4", data={"precio": "nan"}).status_code == 400
    assert cliente.post("/admin/precio/4", data={"precio": "abc"}).status_code == 400


def test_subida_avatar_rechaza_archivos_no_imagen_y_renombra(cliente):
    entrar(cliente, "lucia@correo.test", "lucia1234")
    # Archivo HTML rechazado
    r_html = cliente.post(
        "/perfil",
        data={"avatar": (io.BytesIO(b"<html></html>"), "malo.html")},
        content_type="multipart/form-data",
    )
    assert r_html.status_code == 400
    # Archivo con extension .png pero contenido que no es imagen PNG
    r_falso = cliente.post(
        "/perfil",
        data={"avatar": (io.BytesIO(b"no es un png real"), "falso.png")},
        content_type="multipart/form-data",
    )
    assert r_falso.status_code == 400
    # Subida valida renombra el archivo en el servidor
    r_ok = cliente.post(
        "/perfil",
        data={"avatar": (io.BytesIO(PNG_1PX), "../../peligroso.png")},
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert r_ok.status_code == 200
    assert "peligroso.png" not in r_ok.text
    assert "/static/avatares/avatar_2_" in r_ok.text


def test_proteccion_origen_csrf_y_cabeceras(cliente):
    entrar(cliente, "lucia@correo.test", "lucia1234")
    r_cross = cliente.post(
        "/comprar/1",
        data={"cantidad": "1", "direccion": "Calle 1"},
        headers={"Origin": "https://otro-dominio.example"},
    )
    assert r_cross.status_code == 403
    r_home = cliente.get("/")
    assert r_home.headers.get("X-Content-Type-Options") == "nosniff"
    assert r_home.headers.get("X-Frame-Options") == "DENY"
    assert "default-src 'self'" in r_home.headers.get("Content-Security-Policy", "")
