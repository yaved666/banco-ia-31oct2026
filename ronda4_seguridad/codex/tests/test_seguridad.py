"""Ataques de regresión locales. CSRF permanece activo en todas las pruebas."""
import hashlib
import io
import re
import sqlite3
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from flask import Flask
from PIL import Image

from test_funcional import cliente, entrar, enviar, PNG_1PX
import app as tienda


def scalar(sql, params=()):
    with sqlite3.connect(tienda.DB) as con:
        return con.execute(sql, params).fetchone()[0]


def test_sqli_login_y_busqueda(cliente):
    r = enviar(cliente, '/login', data={'email': "' OR 1=1 --", 'password': 'x'})
    assert r.status_code == 200 and 'incorrectos' in r.text
    with cliente.session_transaction() as s:
        assert 'usuario_id' not in s
    # UNION compatible con las cinco columnas del catálogo original.
    payload = "' UNION SELECT id,email,password,0,0 FROM usuarios --"
    r = cliente.get('/', query_string={'q': payload})
    assert r.status_code == 200 and 'admin@brisa.test' not in r.text
    assert 'scrypt:' not in r.text
    assert scalar('SELECT count(*) FROM usuarios') == 3


def test_roles_y_datos_ajenos(cliente):
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    assert cliente.get('/admin').status_code == 403
    assert enviar(cliente, '/admin/precio/1', data={'precio': '0.01'}).status_code == 403
    assert scalar('SELECT precio FROM productos WHERE id=1') == 129.90
    assert cliente.get('/pedido/2').status_code == 404
    assert cliente.get('/factura?archivo=factura_2.txt').status_code == 404
    assert cliente.get('/pedido/1').status_code == 200
    assert cliente.get('/factura?archivo=factura_1.txt').status_code == 200
    assert 'Cadiz' not in cliente.get('/mis-pedidos').text
    entrar(cliente, 'admin@brisa.test', 'Admin2026!')
    assert cliente.get('/pedido/2').status_code == 200
    assert cliente.get('/factura?archivo=factura_2.txt').status_code == 200


@pytest.mark.parametrize('name', ['../tienda.db', '/etc/passwd', '../../app.py',
                                  '..%2Ftienda.db', 'factura_999.txt', '', 'factura_1.txt/../tienda.db'])
def test_facturas_rutas(cliente, name):
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    assert cliente.get('/factura', query_string={'archivo': name}).status_code == 404


def test_factura_symlink(cliente, tmp_path):
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    target = tmp_path / 'secreto'
    target.write_text('no leer')
    file = Path(tienda.FACTURAS) / 'factura_1.txt'
    file.unlink()
    file.symlink_to(target)
    assert cliente.get('/factura?archivo=factura_1.txt').status_code == 404


def test_xss_en_resena_nombre_busqueda_y_direccion(cliente):
    payload = '<script>alert(1)</script><img src=x onerror=alert(2)>'
    enviar(cliente, '/registro', data={'email':'xss@correo.test','nombre':payload,'password':'segura1234'})
    entrar(cliente, 'xss@correo.test', 'segura1234')
    enviar(cliente, '/producto/1', data={'texto':payload})
    r = cliente.get('/producto/1')
    assert payload not in r.text and '&lt;script&gt;' in r.text
    assert payload not in cliente.get('/', query_string={'q':payload}).text
    r = enviar(cliente, '/comprar/1', data={'direccion':payload}, follow_redirects=True)
    assert r.status_code == 200 and payload not in r.text and '&lt;script&gt;' in r.text


def test_csrf_todas_las_mutaciones(cliente):
    routes = ['/login', '/registro', '/producto/1', '/comprar/1', '/perfil', '/logout', '/admin/precio/1']
    for route in routes:
        assert cliente.post(route, data={'texto':'forjada'}, headers={'Origin':'https://atacante.invalid'}).status_code == 400
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    for route in routes:
        for token in ['', 'incorrecto', 'ñ']:
            assert cliente.post(route, data={'csrf_token':token}).status_code == 400
    # Un token válido de otra sesión tampoco sirve.
    with tienda.app.test_client() as other:
        other.get('/login')
        with other.session_transaction() as s:
            token = s['csrf_token']
    assert cliente.post('/logout', data={'csrf_token':token}).status_code == 400
    assert cliente.get('/logout').status_code == 405
    assert enviar(cliente, '/logout').status_code == 302
    assert cliente.get('/perfil').status_code == 302


def test_clave_antigua_no_firma_sesiones(cliente):
    forged_app = Flask('forged')
    forged_app.secret_key = 'brisa-2026-clave-sesion'
    cookie = forged_app.session_interface.get_signing_serializer(forged_app).dumps({'usuario_id':1})
    cliente.set_cookie(tienda.app.config['SESSION_COOKIE_NAME'], cookie)
    assert cliente.get('/admin').status_code == 302


@pytest.mark.parametrize('price', ['0.01', '-10', 'NaN', 'Infinity', 'texto'])
def test_precio_cliente_ignorado(cliente, price):
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    r = enviar(cliente, '/comprar/3', data={'cantidad':'2','precio':price,'direccion':'Local'})
    assert r.status_code == 302
    assert scalar('SELECT total FROM pedidos ORDER BY id DESC') == 64.0
    assert scalar('SELECT stock FROM productos WHERE id=3') == 43


@pytest.mark.parametrize('qty', ['-1','0','no','1.5','99999999999999999999999999999'])
def test_cantidad_invalida(cliente, qty):
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    assert enviar(cliente, '/comprar/1', data={'cantidad':qty,'direccion':'Local'}).status_code == 400
    assert scalar('SELECT count(*) FROM pedidos') == 2
    assert scalar('SELECT stock FROM productos WHERE id=1') == 12


@pytest.mark.parametrize('price', ['0','-1','NaN','Infinity','-Infinity','abc','1000001','0.001',''])
def test_precio_admin_invalido(cliente, price):
    entrar(cliente, 'admin@brisa.test', 'Admin2026!')
    assert enviar(cliente, '/admin/precio/1', data={'precio':price}).status_code == 400
    assert scalar('SELECT precio FROM productos WHERE id=1') == 129.90


def test_stock_concurrente(cliente, monkeypatch):
    with sqlite3.connect(tienda.DB) as con:
        con.execute('UPDATE productos SET stock=1 WHERE id=1')
    barrier = threading.Barrier(2)
    first_read = threading.local()
    original_db = tienda.db

    class Cursor:
        def __init__(self, cursor):
            self.cursor = cursor

        def fetchone(self):
            row = self.cursor.fetchone()
            barrier.wait(timeout=10)
            return row

    class Connection:
        def __init__(self, connection):
            self.connection = connection

        def execute(self, sql, params=()):
            cursor = self.connection.execute(sql, params)
            if sql == 'SELECT * FROM productos WHERE id = ?' and not getattr(first_read, 'done', False):
                first_read.done = True
                return Cursor(cursor)
            return cursor

        def __getattr__(self, name):
            return getattr(self.connection, name)

    # Fuerza ambas lecturas iniciales antes de permitir reservar la última unidad.
    monkeypatch.setattr(tienda, 'db', lambda: Connection(original_db()))

    def buy(_):
        with tienda.app.test_client() as c:
            entrar(c, 'pedro@correo.test', 'pedro1234')
            c.get('/producto/1')
            with c.session_transaction() as s:
                token = s['csrf_token']
            barrier.wait(timeout=10)
            return c.post('/comprar/1', data={'cantidad':'1','direccion':'Local','csrf_token':token}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(buy, range(2)))
    assert sorted(results) == [302,409]
    assert scalar('SELECT stock FROM productos WHERE id=1') == 0
    assert scalar('SELECT count(*) FROM pedidos WHERE producto_id=1') == 2


@pytest.mark.parametrize('name', ['../../fuera.txt', '/tmp/fuera.txt', 'app.py', 'yo.svg', 'yo.html'])
def test_upload_no_imagen(cliente, tmp_path, name):
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    assert enviar(cliente, '/perfil', data={'avatar':(io.BytesIO(b'<svg onload="alert(1)"></svg>'),name)}).status_code == 400
    assert not list(Path(tienda.AVATARES).iterdir())
    assert not (tmp_path / 'fuera.txt').exists()


def test_upload_nombre_hostil_y_colision(cliente, tmp_path):
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    data = PNG_1PX + b'<script>alert(1)</script>'
    for _ in range(2):
        assert enviar(cliente, '/perfil', data={'avatar':(io.BytesIO(data),'../../fuera.png')}).status_code == 302
    name = scalar('SELECT avatar FROM usuarios WHERE id=2')
    assert re.fullmatch(r'[0-9a-f]{32}\.png', name)
    assert not (tmp_path / 'fuera.png').exists()
    r = cliente.get('/avatar/2')
    assert r.status_code == 200 and r.mimetype == 'image/png'
    assert b'<script>' not in r.data
    with Image.open(io.BytesIO(r.data)) as image:
        assert image.format == 'PNG'
    for route in ['/static/avatares/yo.html', '/static/./avatares/yo.html']:
        assert cliente.get(route).status_code == 404


def test_upload_limites(cliente):
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    r = enviar(cliente, '/perfil', data={'avatar':(io.BytesIO(b'x'*(2*1024*1024)), 'grande.png')})
    assert r.status_code == 413
    buf = io.BytesIO()
    Image.new('1', (2001,2000)).save(buf, format='PNG')
    assert enviar(cliente, '/perfil', data={'avatar':(io.BytesIO(buf.getvalue()),'bomba.png')}).status_code == 400


def test_hash_scrypt_y_migracion(cliente):
    assert scalar('SELECT password FROM usuarios WHERE id=2').startswith('scrypt:')
    assert tienda.hash_password('igual') != tienda.hash_password('igual')
    legacy = hashlib.md5(b'lucia1234').hexdigest()
    with sqlite3.connect(tienda.DB) as con:
        con.execute('UPDATE usuarios SET password=? WHERE id=2', (legacy,))
    assert 'Salir' in entrar(cliente, 'lucia@correo.test', 'lucia1234').text
    assert scalar('SELECT password FROM usuarios WHERE id=2').startswith('scrypt:')


def test_limite_login_y_caducidad(cliente, monkeypatch):
    for _ in range(10):
        assert enviar(cliente, '/login', data={'email':'lucia@correo.test','password':'mala'}).status_code == 200
    r = enviar(cliente, '/login', data={'email':'lucia@correo.test','password':'lucia1234'})
    assert r.status_code == 429 and r.headers['Retry-After'] == '900'
    # Otra conexión al mismo SQLite conserva el límite.
    with tienda.app.test_client() as c:
        assert enviar(c, '/login', data={'email':'lucia@correo.test','password':'x'}).status_code == 429
    now = tienda.time.time()
    monkeypatch.setattr(tienda.time, 'time', lambda: now+901)
    assert enviar(cliente, '/login', data={'email':'lucia@correo.test','password':'lucia1234'}).status_code == 302


def test_cabeceras_y_cookie(cliente):
    r = entrar(cliente, 'lucia@correo.test', 'lucia1234')
    assert "script-src 'none'" in r.headers['Content-Security-Policy']
    assert r.headers['X-Frame-Options'] == 'DENY'
    assert r.headers['X-Content-Type-Options'] == 'nosniff'
    assert r.headers['Cache-Control'] == 'no-store'
    r = cliente.get('/perfil')
    assert tienda.app.config['SESSION_COOKIE_HTTPONLY'] is True
    assert tienda.app.config['SESSION_COOKIE_SAMESITE'] == 'Lax'
    assert tienda.app.debug is False


def test_init_sin_cuentas_publicas(cliente):
    tienda.init_db()
    assert scalar('SELECT count(*) FROM usuarios') == 0
    assert scalar('SELECT count(*) FROM pedidos') == 0
    assert scalar('SELECT count(*) FROM productos') == 5


def test_cli_no_sobrescribe_y_crea_admin(cliente):
    runner = tienda.app.test_cli_runner()
    assert runner.invoke(args=['init-db']).exit_code != 0
    assert scalar('SELECT count(*) FROM usuarios') == 3
    r = runner.invoke(args=['crear-admin'], input='nuevo@brisa.test\nAdmin nuevo\nUnaClaveNueva2026!\nUnaClaveNueva2026!\n')
    assert r.exit_code == 0
    assert scalar("SELECT rol FROM usuarios WHERE email='nuevo@brisa.test'") == 'admin'


def test_cookie_https_y_hsts(cliente, monkeypatch):
    monkeypatch.setitem(tienda.app.config, 'SESSION_COOKIE_SECURE', True)
    r = cliente.get('/login', base_url='https://127.0.0.1')
    cookie = r.headers['Set-Cookie']
    assert '; Secure;' in cookie
    assert '; HttpOnly;' in cookie
    assert 'SameSite=Lax' in cookie
    assert r.headers['Strict-Transport-Security'] == 'max-age=31536000'


def test_rotacion_token_al_entrar(cliente):
    cliente.get('/login')
    with cliente.session_transaction() as s:
        before = s['csrf_token']
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    with cliente.session_transaction() as s:
        assert s['csrf_token'] != before
    assert cliente.post('/logout', data={'csrf_token':before}).status_code == 400


def test_campos_largos_y_sin_asignacion_de_rol(cliente):
    enviar(cliente, '/registro', data={'email':'rol@correo.test','nombre':'Cliente','password':'Segura1234','rol':'admin'})
    assert scalar("SELECT rol FROM usuarios WHERE email='rol@correo.test'") == 'cliente'
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    assert enviar(cliente, '/producto/1', data={'texto':'x'*5001}).status_code == 400
    assert enviar(cliente, '/comprar/1', data={'direccion':'x'*501}).status_code == 400
    assert enviar(cliente, '/login', data={'email':'x'*255,'password':'x'}).status_code == 400


def test_rollback_si_falla_factura(cliente, monkeypatch):
    entrar(cliente, 'lucia@correo.test', 'lucia1234')
    # Una avería del disco no debe descontar stock ni confirmar el pedido.
    from unittest.mock import patch
    with patch('builtins.open', side_effect=OSError('disco no disponible')):
        with pytest.raises(OSError):
            enviar(cliente, '/comprar/1', data={'direccion':'Local'})
    assert scalar('SELECT stock FROM productos WHERE id=1') == 12
    assert scalar('SELECT count(*) FROM pedidos') == 2
