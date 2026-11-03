"""Pruebas HTTP reales; servidor, cookies, DB y archivos aislados; sólo 127.0.0.1."""
import http.cookiejar
import io
import json
import re
import sqlite3
import sys
import tempfile
import threading
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPCookieProcessor, HTTPRedirectHandler, build_opener

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as tienda
from flask import Flask
from PIL import Image
from werkzeug.serving import WSGIRequestHandler, make_server


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class QuietHandler(WSGIRequestHandler):
    def log(self, kind, message, *args):
        pass


def main():
    results = {}
    with tempfile.TemporaryDirectory(prefix='brisa-http-') as tmp:
        tienda.DB = str(Path(tmp) / 'tienda.db')
        tienda.FACTURAS = str(Path(tmp) / 'facturas')
        tienda.AVATARES = str(Path(tmp) / 'avatares')
        tienda.init_db(demo=True)
        tienda.app.config.update(TESTING=False, SESSION_COOKIE_SECURE=False)
        server = make_server('127.0.0.1', 0, tienda.app, threaded=True, request_handler=QuietHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        cookies = http.cookiejar.CookieJar()
        opener = build_opener(HTTPCookieProcessor(cookies), NoRedirect())

        def req(path, data=None, headers=None):
            url = base + path
            assert urlsplit(url).hostname == '127.0.0.1'
            if isinstance(data, dict):
                data = urlencode(data).encode()
            from urllib.request import Request
            try:
                response = opener.open(Request(url, data=data, headers=headers or {}), timeout=10)
            except HTTPError as error:
                response = error
            with response:
                return response.status, response.read(), response.headers

        def token():
            status, body, _ = req('/login')
            assert status == 200
            return re.search(rb'name="csrf_token" value="([^"]+)"', body)[1].decode()

        def post(path, data):
            return req(path, {**data, 'csrf_token': token()})

        def check(name, condition):
            assert condition, name
            results[name] = 'OK'

        try:
            # Cookie signed using the exposed original key.
            forged = Flask('forged')
            forged.secret_key = 'brisa-2026-clave-sesion'
            cookie = forged.session_interface.get_signing_serializer(forged).dumps({'usuario_id':1})
            check('cookie_original_rechazada', req('/admin', headers={'Cookie': 'session='+cookie})[0] == 302)
            status, body, _ = post('/login', {'email': "' OR 1=1 --", 'password':'x'})
            check('sqli_login', status == 200 and b'incorrectos' in body)
            payload = "' UNION SELECT id,email,password,0,0 FROM usuarios --"
            status, body, _ = req('/?' + urlencode({'q':payload}))
            check('sqli_busqueda', status == 200 and b'admin@brisa.test' not in body)
            check('login_normal', post('/login', {'email':'lucia@correo.test','password':'lucia1234'})[0] == 302)
            check('rol_admin', req('/admin')[0] == 403)
            check('precio_admin_ajeno', post('/admin/precio/1', {'precio':'0.01'})[0] == 403)
            check('pedido_ajeno', req('/pedido/2')[0] == 404)
            check('factura_ajena', req('/factura?archivo=factura_2.txt')[0] == 404)
            check('factura_propia', req('/factura?archivo=factura_1.txt')[0] == 200)
            check('traversal_lectura', req('/factura?' + urlencode({'archivo':'../tienda.db'}))[0] == 404)
            check('csrf', req('/comprar/1', {'cantidad':'1','direccion':'Forjada'}, {'Origin':'https://atacante.invalid'})[0] == 400)
            payload = '<script>alert(1)</script>'
            post('/producto/1', {'texto':payload})
            status, body, headers = req('/producto/1')
            check('xss_escapado', status == 200 and payload.encode() not in body and b'&lt;script&gt;' in body)
            check('csp', "script-src 'none'" in headers['Content-Security-Policy'])
            status, body, headers = post('/comprar/3', {'cantidad':'2','precio':'-100','direccion':'Local'})
            check('compra_normal', status == 302)
            _, body, _ = req(headers['Location'])
            check('precio_autoritativo', b'64.00' in body)
            with sqlite3.connect(tienda.DB) as con:
                check('stock', con.execute('SELECT stock FROM productos WHERE id=3').fetchone()[0] == 43)
            csrf = token()
            boundary = 'brisa-local-boundary'
            def upload(data, filename):
                body = (f'--{boundary}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n{csrf}\r\n'
                        f'--{boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="{filename}"\r\n'
                        'Content-Type: image/png\r\n\r\n').encode() + data + f'\r\n--{boundary}--\r\n'.encode()
                return req('/perfil', body, {'Content-Type': f'multipart/form-data; boundary={boundary}'})
            check('html_upload', upload(b'<script>alert(1)</script>', '../../fuera.html')[0] == 400)
            png = io.BytesIO()
            Image.new('RGB', (1,1)).save(png, 'PNG')
            check('traversal_upload', upload(png.getvalue(), '../../fuera.png')[0] == 302 and not (Path(tmp)/'fuera.png').exists())
            status, body, headers = req('/avatar/2')
            check('avatar_normal', status == 200 and headers['Content-Type'].startswith('image/png'))
            check('logout_get', req('/logout')[0] == 405)
            check('logout_normal', post('/logout', {})[0] == 302 and req('/perfil')[0] == 302)
        finally:
            server.shutdown()
            thread.join(timeout=5)
            server.server_close()
    print(json.dumps({'host':'127.0.0.1','comprobaciones':len(results),'resultados':results}, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
