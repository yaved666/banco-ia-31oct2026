import hashlib
import os
import re
import secrets
import sqlite3
import time
import warnings
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from werkzeug.security import check_password_hash, generate_password_hash

from flask import (Flask, abort, g, redirect, render_template, request,
                   send_file, session, url_for)

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, "tienda.db")
FACTURAS = os.path.join(BASE, "facturas")
AVATARES = os.path.join(BASE, "instance", "avatares")

app = Flask(__name__)
# A persistent, private local key keeps development sessions across restarts.
# Production workers must share BRISA_SECRET_KEY (see README).
app.config.update(
    MAX_CONTENT_LENGTH=2 * 1024 * 1024,
    MAX_FORM_MEMORY_SIZE=256 * 1024,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("BRISA_HTTPS") == "1",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
)

def session_key():
    configured = os.environ.get("BRISA_SECRET_KEY")
    if configured is not None:
        if len(configured) < 32:
            raise RuntimeError("BRISA_SECRET_KEY debe tener al menos 32 caracteres aleatorios")
        return configured
    os.makedirs(app.instance_path, mode=0o700, exist_ok=True)
    path = os.path.join(app.instance_path, "session.key")
    # flock prevents workers from reading a key while it is still being written.
    import fcntl
    fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "r+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        key = f.read()
        if not key:
            key = secrets.token_hex(32)
            f.write(key)
            f.flush()
        return key

app.secret_key = session_key()
DUMMY_PASSWORD_HASH = generate_password_hash(secrets.token_hex(32))
Image.MAX_IMAGE_PIXELS = 4_000_000


def csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)
    return session["csrf_token"]


app.jinja_env.globals["csrf_token"] = csrf_token


@app.before_request
def proteger_peticion():
    # Old uploads in static must never remain an executable content endpoint.
    if request.endpoint == "static" and os.path.normpath(request.view_args.get("filename", "")).split(os.sep)[0] == "avatares":
        abort(404)
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        supplied = request.form.get("csrf_token", "")
        expected = session.get("csrf_token", "")
        if not expected or not secrets.compare_digest(supplied.encode(), expected.encode()):
            abort(400, "Token CSRF ausente o incorrecto")


@app.after_request
def cabeceras_seguras(response):
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'none'; object-src 'none'; "
        "base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Cache-Control"] = "no-store"
    if app.config["SESSION_COOKIE_SECURE"]:
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


def require_admin(u):
    if u["rol"] != "admin":
        abort(403)


def valid_price(value):
    try:
        price = Decimal(value)
        if not price.is_finite() or price <= 0 or price > 1_000_000:
            raise ValueError
        return float(price.quantize(Decimal("0.01"))) if price >= Decimal("0.01") else abort(400)
    except (InvalidOperation, ValueError, TypeError):
        abort(400)


def login_bucket(email):
    # Do not trust X-Forwarded-For from arbitrary clients.
    ip = request.remote_addr or "unknown"
    return ("ip:" + ip, "pair:" + hashlib.sha256((ip + "\0" + email).encode()).hexdigest())


def login_limited(email):
    con = db()
    now = int(time.time())
    con.execute("CREATE TABLE IF NOT EXISTS login_intentos "
                "(clave TEXT PRIMARY KEY, intentos INTEGER NOT NULL, inicio INTEGER NOT NULL)")
    con.execute("DELETE FROM login_intentos WHERE inicio <= ?", (now - 900,))
    # Reserve attempts atomically, before computing expensive password hashes.
    limited = False
    for key, limit in zip(login_bucket(email), (100, 10)):
        con.execute("INSERT INTO login_intentos VALUES (?, 1, ?) ON CONFLICT(clave) "
                    "DO UPDATE SET intentos = intentos + 1", (key, now))
        count = con.execute("SELECT intentos FROM login_intentos WHERE clave = ?", (key,)).fetchone()[0]
        if count > limit:
            limited = True
            break
    con.commit()
    return limited



def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def cerrar_db(_exc):
    con = g.pop("db", None)
    if con is not None:
        con.close()


def hash_password(password):
    return generate_password_hash(password)


def usuario_actual():
    uid = session.get("usuario_id")
    if uid is None:
        return None
    return db().execute("SELECT * FROM usuarios WHERE id = ?", (uid,)).fetchone()


def init_db(demo=False):
    con = sqlite3.connect(DB)
    con.executescript("""
        DROP TABLE IF EXISTS usuarios;
        DROP TABLE IF EXISTS productos;
        DROP TABLE IF EXISTS resenas;
        DROP TABLE IF EXISTS pedidos;
        CREATE TABLE usuarios (id INTEGER PRIMARY KEY, email TEXT UNIQUE, nombre TEXT,
                               password TEXT, rol TEXT DEFAULT 'cliente', avatar TEXT);
        CREATE TABLE productos (id INTEGER PRIMARY KEY, nombre TEXT, descripcion TEXT,
                                precio REAL, stock INTEGER);
        CREATE TABLE resenas (id INTEGER PRIMARY KEY, producto_id INTEGER, autor TEXT, texto TEXT);
        CREATE TABLE pedidos (id INTEGER PRIMARY KEY, usuario_id INTEGER, producto_id INTEGER,
                              cantidad INTEGER, total REAL, direccion TEXT, factura TEXT);
    """)
    usuarios = [
        ("admin@brisa.test", "Marta Admin", "Admin2026!", "admin"),
        ("lucia@correo.test", "Lucia Ramos", "lucia1234", "cliente"),
        ("pedro@correo.test", "Pedro Gil", "pedro1234", "cliente"),
    ]
    for email, nombre, pw, rol in usuarios if demo else []:
        con.execute("INSERT INTO usuarios (email, nombre, password, rol) VALUES (?, ?, ?, ?)",
                    (email, nombre, hash_password(pw), rol))
    productos = [
        ("Tienda de campana 2 plazas", "Ligera, 2,1 kg, montaje en 5 minutos.", 129.90, 12),
        ("Saco de dormir -5 C", "Relleno sintetico, bolsa de compresion incluida.", 74.50, 30),
        ("Hornillo de gas plegable", "Encendido piezoelectrico, 2.800 W.", 32.00, 45),
        ("Linterna frontal 400 lm", "Recargable por USB-C, resistente a la lluvia.", 24.99, 60),
        ("Mochila 45 L", "Espalda regulable y funda impermeable.", 89.00, 18),
    ]
    con.executemany("INSERT INTO productos (nombre, descripcion, precio, stock) VALUES (?, ?, ?, ?)",
                    productos)
    if demo:
        con.execute("INSERT INTO resenas (producto_id, autor, texto) VALUES (1, 'Lucia', "
                    "'Aguanto una noche de viento sin problemas.')")
    os.makedirs(FACTURAS, exist_ok=True)
    pedidos = [(2, 1, 1, 129.90, "Calle Mayor 3, Valencia"), (3, 4, 2, 49.98, "Av. del Puerto 18, Cadiz")]
    for uid, pid, cant, total, direccion in pedidos if demo else []:
        cur = con.execute("INSERT INTO pedidos (usuario_id, producto_id, cantidad, total, direccion) "
                          "VALUES (?, ?, ?, ?, ?)", (uid, pid, cant, total, direccion))
        nombre = f"factura_{cur.lastrowid}.txt"
        with open(os.path.join(FACTURAS, nombre), "w") as f:
            f.write(f"Factura {cur.lastrowid}\nTotal: {total:.2f} EUR\nEnvio: {direccion}\n")
        con.execute("UPDATE pedidos SET factura = ? WHERE id = ?", (nombre, cur.lastrowid))
    con.commit()
    con.close()


@app.route("/")
def inicio():
    q = request.args.get("q", "")
    if q:
        productos = db().execute(
            "SELECT * FROM productos WHERE nombre LIKE ? OR descripcion LIKE ?",
            (f"%{q}%", f"%{q}%")).fetchall()
    else:
        productos = db().execute("SELECT * FROM productos").fetchall()
    return render_template("inicio.html", productos=productos, q=q, usuario=usuario_actual())


@app.route("/producto/<int:pid>", methods=["GET", "POST"])
def producto(pid):
    p = db().execute("SELECT * FROM productos WHERE id = ?", (pid,)).fetchone()
    if p is None:
        abort(404)
    u = usuario_actual()
    if request.method == "POST":
        if u is None:
            return redirect(url_for("login"))
        texto = request.form.get("texto", "").strip()
        if len(texto) > 5000:
            abort(400)
        if texto:
            db().execute("INSERT INTO resenas (producto_id, autor, texto) VALUES (?, ?, ?)",
                         (pid, u["nombre"], texto))
            db().commit()
        return redirect(url_for("producto", pid=pid))
    resenas = db().execute("SELECT * FROM resenas WHERE producto_id = ?", (pid,)).fetchall()
    return render_template("producto.html", p=p, resenas=resenas, usuario=u)


@app.route("/registro", methods=["GET", "POST"])
def registro():
    error = None
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        nombre = request.form.get("nombre", "").strip()
        password = request.form.get("password", "")
        if not email or len(email) > 254 or not nombre or len(nombre) > 100 or not 8 <= len(password) <= 1024:
            error = "Rellena todos los campos; la contrasena necesita 8 caracteres."
        else:
            try:
                db().execute("INSERT INTO usuarios (email, nombre, password) VALUES (?, ?, ?)",
                             (email, nombre, hash_password(password)))
                db().commit()
                return redirect(url_for("login"))
            except sqlite3.IntegrityError:
                error = "Ese email ya esta registrado."
    return render_template("registro.html", error=error, usuario=None)


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        if len(email) > 254 or len(password) > 1024:
            abort(400)
        if login_limited(email):
            return "Demasiados intentos. Espera 15 minutos.", 429, {"Retry-After": "900"}
        u = db().execute("SELECT * FROM usuarios WHERE email = ?", (email,)).fetchone()
        stored = u["password"] if u else DUMMY_PASSWORD_HASH
        legacy = bool(re.fullmatch(r"[0-9a-f]{32}", stored))
        valid = (secrets.compare_digest(stored, hashlib.md5(password.encode()).hexdigest())
                 if legacy else check_password_hash(stored, password))
        if u and valid:
            if legacy:
                db().execute("UPDATE usuarios SET password = ? WHERE id = ?", (hash_password(password), u["id"]))
            db().execute("DELETE FROM login_intentos WHERE clave = ?", (login_bucket(email)[1],))
            db().commit()
            session.clear()
            session.permanent = True
            session["usuario_id"] = u["id"]
            return redirect(url_for("inicio"))
        error = "Email o contrasena incorrectos."
    return render_template("login.html", error=error, usuario=None)


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("inicio"))


@app.route("/comprar/<int:pid>", methods=["POST"])
def comprar(pid):
    u = usuario_actual()
    if u is None:
        return redirect(url_for("login"))
    p = db().execute("SELECT * FROM productos WHERE id = ?", (pid,)).fetchone()
    if p is None:
        abort(404)
    try:
        cantidad = int(request.form.get("cantidad", "1"))
    except ValueError:
        abort(400)
    direccion = request.form.get("direccion", "").strip()
    if cantidad < 1 or cantidad > 2_147_483_647 or not direccion or len(direccion) > 500:
        abort(400)
    # Acquire the SQLite write lock before reading price or reserving stock.
    db().execute("BEGIN IMMEDIATE")
    p = db().execute("SELECT * FROM productos WHERE id = ?", (pid,)).fetchone()
    changed = db().execute("UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?",
                           (cantidad, pid, cantidad)).rowcount
    if not changed:
        db().rollback()
        return "No hay stock suficiente", 409
    total = float((Decimal(str(p["precio"])) * cantidad).quantize(Decimal("0.01")))
    cur = db().execute("INSERT INTO pedidos (usuario_id, producto_id, cantidad, total, direccion) "
                       "VALUES (?, ?, ?, ?, ?)", (u["id"], pid, cantidad, total, direccion))
    nombre = f"factura_{secrets.token_hex(16)}.txt"
    os.makedirs(FACTURAS, mode=0o700, exist_ok=True)
    with open(os.path.join(FACTURAS, nombre), "x") as f:
        f.write(f"Factura {cur.lastrowid}\nTotal: {total:.2f} EUR\nEnvio: {direccion}\n")
    db().execute("UPDATE pedidos SET factura = ? WHERE id = ?", (nombre, cur.lastrowid))
    db().commit()
    return redirect(url_for("pedido", oid=cur.lastrowid))


@app.route("/pedido/<int:oid>")
def pedido(oid):
    u = usuario_actual()
    if u is None:
        return redirect(url_for("login"))
    o = db().execute("SELECT pedidos.*, productos.nombre AS producto FROM pedidos "
                     "JOIN productos ON productos.id = pedidos.producto_id WHERE pedidos.id = ?",
                     (oid,)).fetchone()
    if o is None or (o["usuario_id"] != u["id"] and u["rol"] != "admin"):
        abort(404)
    return render_template("pedido.html", o=o, usuario=u)


@app.route("/mis-pedidos")
def mis_pedidos():
    u = usuario_actual()
    if u is None:
        return redirect(url_for("login"))
    pedidos = db().execute("SELECT pedidos.*, productos.nombre AS producto FROM pedidos "
                           "JOIN productos ON productos.id = pedidos.producto_id "
                           "WHERE usuario_id = ? ORDER BY pedidos.id DESC", (u["id"],)).fetchall()
    return render_template("mis_pedidos.html", pedidos=pedidos, usuario=u)


@app.route("/factura")
def factura():
    u = usuario_actual()
    if u is None:
        return redirect(url_for("login"))
    archivo = request.args.get("archivo", "")
    if not re.fullmatch(r"factura_(?:[0-9]+|[0-9a-f]{32})\.txt", archivo):
        abort(404)
    o = db().execute("SELECT usuario_id FROM pedidos WHERE factura = ?", (archivo,)).fetchone()
    if o is None or (o["usuario_id"] != u["id"] and u["rol"] != "admin"):
        abort(404)
    path = Path(FACTURAS) / archivo
    if path.is_symlink() or not path.is_file() or path.resolve().parent != Path(FACTURAS).resolve():
        abort(404)
    return send_file(path, mimetype="text/plain", as_attachment=True, download_name=archivo)


@app.route("/perfil", methods=["GET", "POST"])
def perfil():
    u = usuario_actual()
    if u is None:
        return redirect(url_for("login"))
    if request.method == "POST":
        f = request.files.get("avatar")
        if f and f.filename:
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("error", Image.DecompressionBombWarning)
                    with Image.open(f.stream) as image:
                        if image.format not in {"PNG", "JPEG", "GIF", "WEBP"} or image.width * image.height > 4_000_000:
                            abort(400)
                        image.load()
                        image = image.convert("RGBA")
                        image.thumbnail((512, 512))
                        output = BytesIO()
                        image.save(output, format="PNG")
            except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
                abort(400, "Imagen no valida")
            os.makedirs(AVATARES, mode=0o700, exist_ok=True)
            name = secrets.token_hex(16) + ".png"
            with open(os.path.join(AVATARES, name), "xb") as dest:
                dest.write(output.getvalue())
            db().execute("UPDATE usuarios SET avatar = ? WHERE id = ?", (name, u["id"]))
            db().commit()
        return redirect(url_for("perfil"))
    return render_template("perfil.html", usuario=u)


@app.route("/admin")
def admin():
    u = usuario_actual()
    if u is None:
        return redirect(url_for("login"))
    require_admin(u)
    usuarios = db().execute("SELECT id, email, nombre, rol FROM usuarios").fetchall()
    pedidos = db().execute("SELECT * FROM pedidos ORDER BY id DESC").fetchall()
    return render_template("admin.html", usuarios=usuarios, pedidos=pedidos, usuario=u)


@app.route("/admin/precio/<int:pid>", methods=["POST"])
def admin_precio(pid):
    u = usuario_actual()
    if u is None:
        return redirect(url_for("login"))
    require_admin(u)
    precio = valid_price(request.form.get("precio"))
    cur = db().execute("UPDATE productos SET precio = ? WHERE id = ?", (precio, pid))
    if not cur.rowcount:
        abort(404)
    db().commit()
    return redirect(url_for("admin"))


@app.route("/avatar/<int:uid>")
def avatar(uid):
    u = db().execute("SELECT avatar FROM usuarios WHERE id = ?", (uid,)).fetchone()
    if u is None or not re.fullmatch(r"[0-9a-f]{32}\.png", u["avatar"] or ""):
        abort(404)
    path = Path(AVATARES) / u["avatar"]
    if path.is_symlink() or not path.is_file():
        abort(404)
    return send_file(path, mimetype="image/png")


@app.cli.command("init-db")
def iniciar_db():
    import click
    if os.path.exists(DB):
        raise click.ClickException("La base ya existe; no se sobrescribe")
    init_db(demo=False)
    click.echo("Base creada sin usuarios de ejemplo")


@app.cli.command("crear-admin")
def crear_admin():
    import click
    email = click.prompt("Email").strip().lower()
    nombre = click.prompt("Nombre")
    password = click.prompt("Contrasena (minimo 12 caracteres)", hide_input=True, confirmation_prompt=True)
    if not email or not nombre or not 12 <= len(password) <= 1024:
        raise click.ClickException("Datos no validos")
    try:
        db().execute("INSERT INTO usuarios (email, nombre, password, rol) VALUES (?, ?, ?, 'admin')",
                     (email, nombre, hash_password(password)))
        db().commit()
    except sqlite3.IntegrityError:
        raise click.ClickException("El email ya existe") from None
    click.echo("Administrador creado")


if __name__ == "__main__":
    if not os.path.exists(DB):
        init_db(demo=os.environ.get("BRISA_DEMO") == "1")
    app.run(host="127.0.0.1", port=5000, debug=False)
