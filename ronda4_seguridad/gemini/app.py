import math
import os
import secrets
import sqlite3
from urllib.parse import urlsplit

from flask import (Flask, abort, g, redirect, render_template, request,
                   send_file, session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, "tienda.db")
FACTURAS = os.path.join(BASE, "facturas")
AVATARES = os.path.join(BASE, "static", "avatares")
EXTENSIONES_AVATAR = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SESSION_COOKIE_SECURE", "0") == "1"
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024
API_TOKEN_PAGOS = os.environ.get("API_TOKEN_PAGOS", "")


@app.before_request
def verificar_origen_csrf():
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        if request.headers.get("Sec-Fetch-Site") == "cross-site":
            abort(403)
        origen = request.headers.get("Origin")
        if origen and urlsplit(origen).netloc != request.host:
            abort(403)


@app.after_request
def cabeceras_seguridad(respuesta):
    respuesta.headers.setdefault("X-Content-Type-Options", "nosniff")
    respuesta.headers.setdefault("X-Frame-Options", "DENY")
    respuesta.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    respuesta.headers.setdefault("Content-Security-Policy", "default-src 'self'")
    return respuesta


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


def verificar_password(password_hash, password):
    if not password_hash or not password:
        return False
    return check_password_hash(password_hash, password)


def _es_imagen_valida(datos, ext):
    if not datos:
        return False
    if ext == ".png":
        return datos.startswith(b"\x89PNG\r\n\x1a\n")
    if ext in (".jpg", ".jpeg"):
        return datos.startswith(b"\xff\xd8\xff")
    if ext == ".gif":
        return datos.startswith((b"GIF87a", b"GIF89a"))
    if ext == ".webp":
        return len(datos) >= 12 and datos.startswith(b"RIFF") and datos[8:12] == b"WEBP"
    return False


def usuario_actual():
    uid = session.get("usuario_id")
    if uid is None:
        return None
    return db().execute("SELECT * FROM usuarios WHERE id = ?", (uid,)).fetchone()


def init_db():
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
    for email, nombre, pw, rol in usuarios:
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
    con.execute("INSERT INTO resenas (producto_id, autor, texto) VALUES (1, 'Lucia', "
                "'Aguanto una noche de viento sin problemas.')")
    os.makedirs(FACTURAS, exist_ok=True)
    pedidos = [(2, 1, 1, 129.90, "Calle Mayor 3, Valencia"), (3, 4, 2, 49.98, "Av. del Puerto 18, Cadiz")]
    for uid, pid, cant, total, direccion in pedidos:
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
        patron = f"%{q}%"
        productos = db().execute(
            "SELECT * FROM productos WHERE nombre LIKE ? OR descripcion LIKE ?",
            (patron, patron),
        ).fetchall()
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
        if not email or not nombre or len(password) < 8:
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
        u = db().execute(
            "SELECT * FROM usuarios WHERE email = ?", (email,)
        ).fetchone()
        if u and verificar_password(u["password"], password):
            session.clear()
            session["usuario_id"] = u["id"]
            return redirect(url_for("inicio"))
        error = "Email o contrasena incorrectos."
    return render_template("login.html", error=error, usuario=None)


@app.route("/logout")
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
        cantidad = int(request.form.get("cantidad", 1))
    except (ValueError, TypeError):
        abort(400)
    direccion = request.form.get("direccion", "").strip()
    if cantidad < 1 or not direccion:
        abort(400)
    cur_stock = db().execute(
        "UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?",
        (cantidad, pid, cantidad),
    )
    if cur_stock.rowcount == 0:
        return "No hay stock suficiente", 409
    total = round(float(p["precio"]) * cantidad, 2)
    cur = db().execute("INSERT INTO pedidos (usuario_id, producto_id, cantidad, total, direccion) "
                       "VALUES (?, ?, ?, ?, ?)", (u["id"], pid, cantidad, total, direccion))
    nombre = f"factura_{cur.lastrowid}.txt"
    os.makedirs(FACTURAS, exist_ok=True)
    with open(os.path.join(FACTURAS, nombre), "w") as f:
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
    if o is None:
        abort(404)
    if o["usuario_id"] != u["id"] and u["rol"] != "admin":
        abort(403)
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
    if not archivo or archivo != os.path.basename(archivo) or ".." in archivo:
        abort(400)
    o = db().execute("SELECT * FROM pedidos WHERE factura = ?", (archivo,)).fetchone()
    if o is None:
        abort(404)
    if o["usuario_id"] != u["id"] and u["rol"] != "admin":
        abort(403)
    base_facturas = os.path.realpath(FACTURAS)
    ruta_factura = os.path.realpath(os.path.join(base_facturas, archivo))
    if os.path.commonpath([base_facturas, ruta_factura]) != base_facturas or not os.path.isfile(ruta_factura):
        abort(404)
    return send_file(ruta_factura, mimetype="text/plain")


@app.route("/perfil", methods=["GET", "POST"])
def perfil():
    u = usuario_actual()
    if u is None:
        return redirect(url_for("login"))
    if request.method == "POST":
        f = request.files.get("avatar")
        if f and f.filename:
            nombre_limpio = secure_filename(f.filename)
            ext = os.path.splitext(nombre_limpio)[1].lower()
            if ext not in EXTENSIONES_AVATAR:
                abort(400)
            datos = f.read()
            if not _es_imagen_valida(datos, ext):
                abort(400)
            nombre_seguro = f"avatar_{u['id']}_{secrets.token_hex(8)}{ext}"
            os.makedirs(AVATARES, exist_ok=True)
            base_avatares = os.path.realpath(AVATARES)
            ruta_destino = os.path.realpath(os.path.join(base_avatares, nombre_seguro))
            if os.path.commonpath([base_avatares, ruta_destino]) != base_avatares:
                abort(400)
            with open(ruta_destino, "wb") as archivo_salida:
                archivo_salida.write(datos)
            db().execute("UPDATE usuarios SET avatar = ? WHERE id = ?", (nombre_seguro, u["id"]))
            db().commit()
        return redirect(url_for("perfil"))
    return render_template("perfil.html", usuario=u)


@app.route("/admin")
def admin():
    u = usuario_actual()
    if u is None:
        return redirect(url_for("login"))
    if u["rol"] != "admin":
        abort(403)
    usuarios = db().execute("SELECT id, email, nombre, rol FROM usuarios").fetchall()
    pedidos = db().execute("SELECT * FROM pedidos ORDER BY id DESC").fetchall()
    return render_template("admin.html", usuarios=usuarios, pedidos=pedidos, usuario=u)


@app.route("/admin/precio/<int:pid>", methods=["POST"])
def admin_precio(pid):
    u = usuario_actual()
    if u is None:
        return redirect(url_for("login"))
    if u["rol"] != "admin":
        abort(403)
    try:
        nuevo_precio = float(request.form.get("precio", ""))
    except (ValueError, TypeError):
        abort(400)
    if not math.isfinite(nuevo_precio) or nuevo_precio <= 0:
        abort(400)
    db().execute("UPDATE productos SET precio = ? WHERE id = ?", (nuevo_precio, pid))
    db().commit()
    return redirect(url_for("admin"))


if __name__ == "__main__":
    if not os.path.exists(DB):
        init_db()
    modo_debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="127.0.0.1", port=5000, debug=modo_debug)
