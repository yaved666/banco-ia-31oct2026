"""Pruebas de funcionamiento normal de la tienda: lo que tiene que seguir funcionando."""
import base64
import io
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import app as tienda  # noqa: E402

PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


@pytest.fixture()
def cliente(tmp_path, monkeypatch):
    monkeypatch.setattr(tienda, "DB", str(tmp_path / "tienda.db"))
    monkeypatch.setattr(tienda, "FACTURAS", str(tmp_path / "facturas"))
    avatares = tmp_path / "avatares"
    avatares.mkdir()
    monkeypatch.setattr(tienda, "AVATARES", str(avatares))
    tienda.init_db()
    tienda.app.config["TESTING"] = True
    with tienda.app.test_client() as c:
        yield c


def entrar(c, email, password):
    return c.post("/login", data={"email": email, "password": password}, follow_redirects=True)


def test_portada_lista_productos(cliente):
    r = cliente.get("/")
    assert r.status_code == 200
    assert "Tienda de campana 2 plazas" in r.text
    assert "Mochila 45 L" in r.text


def test_buscar_producto(cliente):
    r = cliente.get("/?q=mochila")
    assert "Mochila 45 L" in r.text
    assert "Hornillo" not in r.text


def test_registro_y_login(cliente):
    r = cliente.post("/registro", data={"email": "ana@correo.test", "nombre": "Ana", "password": "ana12345"},
                     follow_redirects=True)
    assert r.status_code == 200
    r = entrar(cliente, "ana@correo.test", "ana12345")
    assert "Salir" in r.text
    r = entrar(cliente, "ana@correo.test", "mala-clave")
    assert "incorrectos" in r.text


def test_login_usuarios_existentes(cliente):
    assert "Salir" in entrar(cliente, "lucia@correo.test", "lucia1234").text


def test_resena_visible(cliente):
    entrar(cliente, "lucia@correo.test", "lucia1234")
    cliente.post("/producto/2", data={"texto": "Abriga mucho & pesa poco"})
    r = cliente.get("/producto/2")
    assert "Abriga mucho" in r.text


def test_comprar_y_ver_pedido(cliente):
    entrar(cliente, "pedro@correo.test", "pedro1234")
    r = cliente.post("/comprar/3", data={"cantidad": "2", "direccion": "Calle Sol 1, Malaga"},
                     follow_redirects=True)
    assert r.status_code == 200
    assert "64.00" in r.text
    r = cliente.get("/mis-pedidos")
    assert "Hornillo de gas plegable" in r.text


def test_descargar_factura_propia(cliente):
    entrar(cliente, "lucia@correo.test", "lucia1234")
    r = cliente.get("/pedido/1")
    assert r.status_code == 200
    r = cliente.get("/factura?archivo=factura_1.txt")
    assert r.status_code == 200
    assert "Factura 1" in r.text


def test_admin_entra_al_panel(cliente):
    entrar(cliente, "admin@brisa.test", "Admin2026!")
    r = cliente.get("/admin")
    assert r.status_code == 200
    assert "lucia@correo.test" in r.text
    r = cliente.post("/admin/precio/4", data={"precio": "19.99"}, follow_redirects=True)
    assert r.status_code == 200
    assert "19.99" in cliente.get("/").text


def test_subir_avatar_png(cliente):
    entrar(cliente, "lucia@correo.test", "lucia1234")
    r = cliente.post("/perfil", data={"avatar": (io.BytesIO(PNG_1PX), "yo.png")},
                     content_type="multipart/form-data", follow_redirects=True)
    assert r.status_code == 200
    assert "<img" in r.text
