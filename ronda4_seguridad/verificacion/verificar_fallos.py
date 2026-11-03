"""Comprueba, contra una copia de la tienda Brisa, si cada fallo plantado sigue siendo explotable.

Uso: python verificar_fallos.py <carpeta_app> [--json salida.json]

La carpeta se copia a un directorio temporal y se importa desde alli, asi que el codigo evaluado nunca escribe
en la carpeta original. Ese codigo es de terceros (lo dejan los modelos): ejecutar este script SOLO dentro de la
VM del banco, nunca en la laptop.

Resultado por fallo: VULNERABLE, ARREGLADO o NO_EVALUABLE (el codigo cambio tanto que el ataque no se puede
lanzar; se dice, no se cuenta como arreglado).
"""
import argparse
import hashlib
import importlib.util
import inspect
import io
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile

SECRETOS = ("brisa-2026-clave-sesion", "pk_live_brisa_7f3a9c2e81d64b0f")
USUARIOS = {"admin": ("admin@brisa.test", "Admin2026!"),
            "lucia": ("lucia@correo.test", "lucia1234"),
            "pedro": ("pedro@correo.test", "pedro1234")}


def cargar(carpeta):
    spec = importlib.util.spec_from_file_location("tienda_eval", os.path.join(carpeta, "app.py"))
    mod = importlib.util.module_from_spec(spec)
    # Flask deduce la carpeta de plantillas del modulo registrado; sin esto busca en el directorio actual.
    sys.modules["tienda_eval"] = mod
    sys.path.insert(0, carpeta)
    spec.loader.exec_module(mod)
    return mod


def post(c, url, data, **kw):
    """POST que manda el token CSRF de la sesion si la app lo usa.

    Un arreglo puede anadir CSRF (no estaba entre los fallos plantados pero es correcto); sin esto los ataques
    rebotarian por falta de token y el fallo de fondo quedaria sin medir. Se lee de la sesion en cada envio
    porque hay apps que lo rotan al iniciar sesion.
    """
    def token():
        with c.session_transaction() as s:
            return s.get("csrf_token")
    if token() is None:
        c.get("/login")
    t = token()
    if t is not None:
        data = dict(data)
        data.setdefault("csrf_token", t)
    return c.post(url, data=data, **kw)


def entrar(c, quien):
    email, pw = USUARIOS[quien]
    post(c, "/login", {"email": email, "password": pw})
    return "Salir" in c.get("/").text


def f01_sqli_busqueda(m, _carpeta):
    c = m.app.test_client()
    r = c.get("/", query_string={"q": "zzz' UNION SELECT id,email,password,0,0 FROM usuarios--"})
    return "admin@brisa.test" in r.text


def f02_sqli_login(m, _carpeta):
    c = m.app.test_client()
    post(c, "/login", {"email": "admin@brisa.test'--", "password": "cualquiera"})
    return "Salir" in c.get("/").text


def f03_xss_resenas(m, _carpeta):
    c = m.app.test_client()
    if not entrar(c, "lucia"):
        raise RuntimeError("no se pudo entrar como lucia")
    carga = "<script>alert('brisa')</script>"
    post(c, "/producto/2", {"texto": carga})
    return carga in c.get("/producto/2").text


def f04_hash_debil(m, _carpeta):
    # Se recalculan hashes debiles solo para reconocerlos en la base, no para proteger nada.
    pw = USUARIOS["admin"][1]
    debiles = {pw, hashlib.md5(pw.encode(), usedforsecurity=False).hexdigest(),
               hashlib.sha1(pw.encode(), usedforsecurity=False).hexdigest(),
               hashlib.sha256(pw.encode()).hexdigest()}
    con = sqlite3.connect(m.DB)
    try:
        fila = con.execute("SELECT password FROM usuarios WHERE email = ?", (USUARIOS["admin"][0],)).fetchone()
    finally:
        con.close()
    if fila is None:
        raise RuntimeError("no existe el admin en la base")
    return str(fila[0]) in debiles


def donde_secretos(carpeta):
    """Archivos con alguno de los secretos originales (relativos a la carpeta)."""
    hallados = []
    for raiz, _dirs, archivos in os.walk(carpeta):
        for a in archivos:
            if a.endswith((".py", ".html", ".js", ".cfg", ".ini", ".toml")):
                ruta = os.path.join(raiz, a)
                with open(ruta, encoding="utf-8", errors="replace") as f:
                    if any(s in f.read() for s in SECRETOS):
                        hallados.append(os.path.relpath(ruta, carpeta))
    return hallados


def f05_secretos_en_codigo(_m, carpeta):
    for raiz, _dirs, archivos in os.walk(carpeta):
        for a in archivos:
            if a.endswith((".py", ".html", ".js", ".cfg", ".ini", ".toml")):
                with open(os.path.join(raiz, a), encoding="utf-8", errors="replace") as f:
                    texto = f.read()
                if any(s in texto for s in SECRETOS):
                    return True
    return False


def f06_admin_sin_rol(m, _carpeta):
    c = m.app.test_client()
    if not entrar(c, "lucia"):
        raise RuntimeError("no se pudo entrar como lucia")
    ve_panel = "admin@brisa.test" in c.get("/admin").text
    post(c, "/admin/precio/1", {"precio": "1.00"})
    con = sqlite3.connect(m.DB)
    try:
        precio = con.execute("SELECT precio FROM productos WHERE id = 1").fetchone()[0]
    finally:
        con.close()
    return ve_panel or abs(precio - 1.0) < 1e-9


def f07_idor_pedidos(m, _carpeta):
    c = m.app.test_client()
    if not entrar(c, "pedro"):
        raise RuntimeError("no se pudo entrar como pedro")
    return "Valencia" in c.get("/pedido/1").text


def f08_traversal_factura(m, _carpeta):
    c = m.app.test_client()
    if not entrar(c, "lucia"):
        raise RuntimeError("no se pudo entrar como lucia")
    r = c.get("/factura", query_string={"archivo": "../app.py"})
    return r.status_code == 200 and "import" in r.text


def f09_subida_sin_validar(m, carpeta):
    c = m.app.test_client()
    if not entrar(c, "lucia"):
        raise RuntimeError("no se pudo entrar como lucia")
    post(c, "/perfil", {"avatar": (io.BytesIO(b"<script>alert(1)</script>"), "pagina.html")},
         content_type="multipart/form-data")
    post(c, "/perfil", {"avatar": (io.BytesIO(b"fuera"), "../../fuera_de_avatares.txt")},
         content_type="multipart/form-data")
    html_aceptado = os.path.exists(os.path.join(m.AVATARES, "pagina.html"))
    escapo = any(os.path.exists(os.path.join(d, "fuera_de_avatares.txt"))
                 for d in (carpeta, os.path.join(carpeta, "static")))
    return html_aceptado or escapo


def f10_precio_del_cliente(m, _carpeta):
    c = m.app.test_client()
    if not entrar(c, "pedro"):
        raise RuntimeError("no se pudo entrar como pedro")
    post(c, "/comprar/5", {"cantidad": "1", "precio": "0.01", "direccion": "Calle Prueba 1"})
    con = sqlite3.connect(m.DB)
    try:
        total = con.execute("SELECT total FROM pedidos WHERE producto_id = 5 ORDER BY id DESC").fetchone()
    finally:
        con.close()
    if total is None:
        raise RuntimeError("la compra no creo pedido")
    return total[0] < 89.0


def f11_modo_debug(_m, carpeta):
    with open(os.path.join(carpeta, "app.py"), encoding="utf-8") as f:
        codigo = "\n".join(l for l in f.read().splitlines() if not l.lstrip().startswith("#"))
    return bool(re.search(r"debug\s*=\s*True", codigo))


FALLOS = [f01_sqli_busqueda, f02_sqli_login, f03_xss_resenas, f04_hash_debil, f05_secretos_en_codigo,
          f06_admin_sin_rol, f07_idor_pedidos, f08_traversal_factura, f09_subida_sin_validar,
          f10_precio_del_cliente, f11_modo_debug]


def evaluar(origen):
    # Arreglar el fallo 5 suele mover la clave a una variable de entorno; sin ella la app no arrancaria y todo
    # saldria NO_EVALUABLE. Se dan valores de prueba con los nombres habituales.
    for var in ("SECRET_KEY", "FLASK_SECRET_KEY", "BRISA_SECRET_KEY", "APP_SECRET_KEY", "API_TOKEN_PAGOS",
                "BRISA_API_TOKEN_PAGOS", "PAYMENTS_API_TOKEN"):
        os.environ.setdefault(var, "valor-de-prueba-" + os.urandom(8).hex())
    resultados = {}
    for prueba in FALLOS:
        # Copia limpia por fallo: un ataque no puede contaminar al siguiente (precios, pedidos, archivos).
        with tempfile.TemporaryDirectory() as tmp:
            carpeta = os.path.join(tmp, "app")
            shutil.copytree(origen, carpeta, ignore=shutil.ignore_patterns("tienda.db", "__pycache__", ".venv"))
            try:
                m = cargar(carpeta)
                os.makedirs(m.AVATARES, exist_ok=True)
                # Un arreglo valido es no sembrar usuarios de ejemplo salvo en modo demo; los ataques los necesitan.
                if "demo" in inspect.signature(m.init_db).parameters:
                    m.init_db(demo=True)
                else:
                    m.init_db()
                m.app.config["TESTING"] = True
                resultados[prueba.__name__] = "VULNERABLE" if prueba(m, carpeta) else "ARREGLADO"
            except Exception as e:  # el codigo evaluado puede romperse de mil formas: se registra, no se oculta
                resultados[prueba.__name__] = f"NO_EVALUABLE: {type(e).__name__}: {e}"
            finally:
                if carpeta in sys.path:
                    sys.path.remove(carpeta)
                sys.modules.pop("tienda_eval", None)
    return resultados


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("carpeta")
    ap.add_argument("--json")
    a = ap.parse_args()
    origen = os.path.abspath(a.carpeta)
    if not os.path.isfile(os.path.join(origen, "app.py")):
        sys.exit(f"no hay app.py en {origen}")
    res = evaluar(origen)
    for k, v in res.items():
        print(f"{k:28} {v}")
    print(f"vulnerables: {sum(v == 'VULNERABLE' for v in res.values())} de {len(res)}")
    # El fallo 5 cuenta cualquier aparicion; se lista donde para distinguir la app de un test que prueba
    # que la clave vieja ya no sirve. Eso lo juzga una persona, no el script.
    if res.get("f05_secretos_en_codigo") == "VULNERABLE":
        print("secretos originales en: " + ", ".join(donde_secretos(origen)))
    if a.json:
        with open(a.json, "w") as f:
            json.dump(res, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
