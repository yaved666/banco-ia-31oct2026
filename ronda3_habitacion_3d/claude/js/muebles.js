/* Muebles y objetos modelados con código (geometrías de Three.js + utilidades propias). */
(function () {
  'use strict';
  const F = {};
  const V3 = THREE.Vector3;

  /* ================= utilidades de geometría ================= */

  function sombra(m, emite = true, recibe = true) { m.castShadow = emite; m.receiveShadow = recibe; return m; }
  F.sombra = sombra;

  function malla(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return sombra(m);
  }

  function caja(w, h, d, mat, x, y, z) { return malla(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }
  F.caja = caja;

  function cil(rt, rb, h, mat, x, y, z, seg = 20) { return malla(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z); }
  F.cil = cil;

  /* Caja con aristas redondeadas: se reparte la rejilla de la caja para concentrar
     vértices junto a las aristas y se proyectan sobre esferas de radio r. */
  function geoCajaRedondeada(w, h, d, r, k = 3) {
    const n = 2 * k + 1;
    const geo = new THREE.BoxGeometry(w, h, d, n, n, n);
    const half = [w / 2, h / 2, d / 2];
    r = Math.min(r, half[0], half[1], half[2]);
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    const p = [0, 0, 0], inner = [0, 0, 0], dims = [w, h, d];
    for (let i = 0; i < pos.count; i++) {
      // eje de la cara original (para recalcular las UV sin distorsión)
      const ax = Math.abs(nor.getX(i)) > 0.5 ? 0 : Math.abs(nor.getY(i)) > 0.5 ? 1 : 2;
      for (let a = 0; a < 3; a++) {
        const hh = half[a], c = pos.getComponent(i, a);
        const idx = Math.round((c + hh) / (2 * hh) * n);
        let nc;
        if (idx <= k) nc = -hh + r * (1 - Math.cos((idx / k) * Math.PI / 2));
        else nc = hh - r * (1 - Math.cos(((n - idx) / k) * Math.PI / 2));
        p[a] = nc;
        inner[a] = Math.max(-hh + r, Math.min(hh - r, nc));
      }
      const ua = ax === 0 ? 2 : 0, va = ax === 1 ? 2 : 1;
      const su = ax === 0 ? -Math.sign(nor.getX(i)) : ax === 2 ? Math.sign(nor.getZ(i)) : 1;
      const sv = ax === 1 ? -Math.sign(nor.getY(i)) : 1;
      uv.setXY(i, 0.5 + su * p[ua] / dims[ua], 0.5 + sv * p[va] / dims[va]);
      let dx = p[0] - inner[0], dy = p[1] - inner[1], dz = p[2] - inner[2];
      let len = Math.hypot(dx, dy, dz);
      if (len < 1e-7) { dx = nor.getX(i); dy = nor.getY(i); dz = nor.getZ(i); len = 1; }
      dx /= len; dy /= len; dz /= len;
      pos.setXYZ(i, inner[0] + dx * r, inner[1] + dy * r, inner[2] + dz * r);
      nor.setXYZ(i, dx, dy, dz);
    }
    return geo;
  }
  F.geoCajaRedondeada = geoCajaRedondeada;

  function cajaR(w, h, d, r, mat, x, y, z) { return malla(geoCajaRedondeada(w, h, d, r), mat, x, y, z); }
  F.cajaR = cajaR;

  function torno(perfil, mat, x = 0, y = 0, z = 0, seg = 32) {
    const pts = perfil.map(p => new THREE.Vector2(p[0], p[1]));
    return malla(new THREE.LatheGeometry(pts, seg), mat, x, y, z);
  }
  F.torno = torno;

  /* Une varias geometrías (ya transformadas) en una sola => una única llamada de dibujo. */
  function fusionar(geos) {
    const attrs = Object.keys(geos[0].attributes);
    const out = new THREE.BufferGeometry();
    let total = 0, totalIdx = 0;
    for (const g of geos) { total += g.attributes.position.count; totalIdx += g.index ? g.index.count : g.attributes.position.count; }
    for (const name of attrs) {
      const size = geos[0].attributes[name].itemSize;
      const arr = new Float32Array(total * size);
      let off = 0;
      for (const g of geos) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    const idx = new Uint32Array(totalIdx);
    let o = 0, base = 0;
    for (const g of geos) {
      const n = g.attributes.position.count;
      if (g.index) { for (let i = 0; i < g.index.count; i++) idx[o++] = g.index.array[i] + base; }
      else { for (let i = 0; i < n; i++) idx[o++] = i + base; }
      base += n;
    }
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
  }
  F.fusionar = fusionar;

  /* UV en coordenadas de mundo (proyección por cara) para que la textura tenga escala real. */
  function uvMundo(geo, escala) {
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (nx >= ny && nx >= nz) uv.setXY(i, z * escala, y * escala);
      else if (ny >= nz) uv.setXY(i, x * escala, z * escala);
      else uv.setXY(i, x * escala, y * escala);
    }
    uv.needsUpdate = true;
    return geo;
  }
  F.uvMundo = uvMundo;

  // Pata troncocónica abierta en ángulo
  function pata(mat, x, z, h, rt, rb, abrirX = 0, abrirZ = 0) {
    const m = cil(rt, rb, h, mat, x, h / 2, z, 12);
    m.rotation.z = -abrirX; m.rotation.x = abrirZ;
    return m;
  }

  /* Controlador de lámpara: intensidad de luz + materiales emisivos */
  function controlLampara(nombre, luz, intensidad, emisivos) {
    const c = {
      nombre, luz, encendida: false, intensidad,
      set(on) {
        this.encendida = on;
        luz.intensity = on ? intensidad : 0;
        for (const [m, e] of emisivos) m.emissiveIntensity = on ? e : 0;
        if (this.onCambio) this.onCambio(on);
      },
      alternar() { this.set(!this.encendida); }
    };
    return c;
  }

  /* ================= muebles ================= */

  // SOFÁ de tres plazas. Origen en el suelo, frente hacia +z.
  F.sofa = function (M) {
    const g = new THREE.Group();
    const w = 2.1, d = 0.92;
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      g.add(pata(M.nogal, sx * (w / 2 - 0.12), sz * (d / 2 - 0.12), 0.13, 0.026, 0.017));
    g.add(cajaR(w, 0.2, d, 0.04, M.telaSofa, 0, 0.23, 0));
    const ancho = (w - 0.38) / 2;
    for (const sx of [-1, 1]) {
      const c = cajaR(ancho - 0.01, 0.17, d - 0.24, 0.07, M.telaSofa, sx * ancho / 2, 0.41, 0.1);
      g.add(c);
      const r = cajaR(ancho - 0.02, 0.44, 0.17, 0.08, M.telaSofa, sx * ancho / 2, 0.68, -d / 2 + 0.27);
      r.rotation.x = -0.13; g.add(r);
    }
    g.add(cajaR(w, 0.5, 0.2, 0.06, M.telaSofa, 0, 0.58, -d / 2 + 0.1));
    for (const sx of [-1, 1]) g.add(cajaR(0.19, 0.38, d, 0.07, M.telaSofa, sx * (w / 2 - 0.095), 0.5, 0));
    // cojines decorativos
    const c1 = cajaR(0.44, 0.42, 0.14, 0.07, M.cojinTerracota, -w / 2 + 0.42, 0.66, -0.12);
    c1.rotation.set(-0.25, 0.25, 0.08); g.add(c1);
    const c2 = cajaR(0.42, 0.4, 0.14, 0.07, M.cojinCrema, w / 2 - 0.42, 0.66, -0.12);
    c2.rotation.set(-0.25, -0.3, -0.1); g.add(c2);
    // manta doblada sobre el brazo
    const manta = cajaR(0.26, 0.05, d * 0.9, 0.02, M.manta, w / 2 - 0.095, 0.71, 0.0);
    g.add(manta);
    const caida = cajaR(0.035, 0.32, d * 0.9, 0.015, M.manta, w / 2 + 0.01, 0.56, 0);
    g.add(caida);
    return g;
  };

  // SILLÓN orejero moderno. Frente +z.
  F.sillon = function (M) {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      g.add(pata(M.nogal, sx * 0.31, sz * 0.31, 0.18, 0.024, 0.014, sx * 0.12, -sz * 0.12));
    g.add(cajaR(0.82, 0.14, 0.8, 0.04, M.telaSillon, 0, 0.25, 0));
    g.add(cajaR(0.58, 0.13, 0.62, 0.06, M.telaSillon, 0, 0.38, 0.07));
    const resp = cajaR(0.8, 0.62, 0.16, 0.07, M.telaSillon, 0, 0.62, -0.33);
    resp.rotation.x = -0.12; g.add(resp);
    for (const sx of [-1, 1]) g.add(cajaR(0.12, 0.27, 0.74, 0.05, M.telaSillon, sx * 0.35, 0.44, 0.0));
    const coj = cajaR(0.4, 0.32, 0.12, 0.06, M.cojinCrema, 0, 0.6, -0.18);
    coj.rotation.x = -0.25; g.add(coj);
    return g;
  };

  // MESA DE CENTRO con balda inferior y objetos encima. Largo en x.
  F.mesaCentro = function (M) {
    const g = new THREE.Group();
    g.add(cajaR(1.1, 0.045, 0.6, 0.018, M.roble, 0, 0.42, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      g.add(pata(M.roble, sx * 0.47, sz * 0.22, 0.4, 0.024, 0.016, sx * 0.05, -sz * 0.05));
    g.add(caja(0.98, 0.02, 0.46, M.roble, 0, 0.12, 0));
    // revistas en la balda
    g.add(caja(0.3, 0.012, 0.22, M.revista1, -0.2, 0.137, 0.02));
    const rv = caja(0.3, 0.012, 0.22, M.revista2, -0.17, 0.149, 0.0); rv.rotation.y = 0.2; g.add(rv);
    // pila de libros
    const libros = [[0.26, 0.035, 0.19, M.libroA, 0.08], [0.24, 0.03, 0.17, M.libroB, -0.1], [0.22, 0.028, 0.16, M.libroC, 0.25]];
    let y = 0.443;
    for (const [w, h, d, m, rot] of libros) {
      const l = caja(w, h, d, m, 0.3, y + h / 2, -0.05); l.rotation.y = rot; g.add(l); y += h;
    }
    // taza
    const taza = torno([[0, 0], [0.036, 0], [0.04, 0.005], [0.042, 0.09], [0.038, 0.09], [0.035, 0.012], [0, 0.012]], M.ceramica, -0.15, 0.443, 0.1);
    g.add(taza);
    const asa = malla(new THREE.TorusGeometry(0.022, 0.006, 8, 16, Math.PI), M.ceramica, -0.15 + 0.042, 0.443 + 0.045, 0.1);
    asa.rotation.z = -Math.PI / 2; g.add(asa);
    // cuenco de madera con frutas
    g.add(torno([[0, 0], [0.06, 0], [0.11, 0.03], [0.13, 0.07], [0.125, 0.072], [0.1, 0.035], [0.05, 0.012], [0, 0.012]], M.nogal, -0.3, 0.443, -0.1));
    const colores = [M.naranja, M.naranja, M.manzana];
    [[-0.33, -0.12], [-0.27, -0.08], [-0.3, -0.05]].forEach((p, i) => {
      g.add(malla(new THREE.SphereGeometry(0.035, 16, 12), colores[i], p[0], 0.443 + 0.05, p[1]));
    });
    return g;
  };

  // LIBROS: todos fusionados en una única geometría con colores por vértice.
  const COLORES_LIBRO = ['#7a2e2a', '#24476b', '#2f5d4a', '#c2a15a', '#4a3a5c', '#b55a30', '#1f2d3a', '#8c8c7a', '#d8cfb8', '#5e7d8c', '#a03c3c', '#3b3b3b'];
  function geoLibro(t, h, d, color) {
    const geo = new THREE.BoxGeometry(t, h, d);
    const col = new THREE.Color(color), pag = new THREE.Color('#efe6cf');
    const cols = new Float32Array(24 * 3);
    const uv = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const esPag = f === 2 || f === 3 || f === 5;
      const c = esPag ? pag : col;
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
        if (f !== 4) uv.setXY(i, 0.985, 0.995);
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return geo;
  }

  F.estanteria = function (M) {
    const g = new THREE.Group();
    const W = 1.6, H = 2.0, D = 0.34, e = 0.026;
    const r = TX.rng(123);
    g.add(caja(e, H, D, M.nogal, -W / 2 + e / 2, H / 2, 0));
    g.add(caja(e, H, D, M.nogal, W / 2 - e / 2, H / 2, 0));
    g.add(caja(W, e, D, M.nogal, 0, H - e / 2, 0));
    g.add(caja(W - 2 * e, 0.08, D - 0.02, M.nogal, 0, 0.04, 0.0));
    g.add(caja(W - 2 * e, H - 0.1, 0.01, M.nogalOscuro, 0, H / 2, -D / 2 + 0.005));
    g.add(caja(e, H * 0.92, e, M.nogal, 0, H * 0.46 + 0.08, D / 2 - e / 2)); // montante central
    const niveles = [0.08, 0.44, 0.8, 1.16, 1.52];
    for (const y of niveles.slice(1)) g.add(caja(W - 2 * e, e, D - 0.02, M.nogal, 0, y, 0));
    const libros = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(1, 1, 1);
    const decor = { 1: 'jarron', 3: 'esfera', 4: 'planta', 0: 'foto' };
    niveles.forEach((y0, nivel) => {
      const yb = y0 + (nivel === 0 ? 0.0 : e / 2);
      const alto = (niveles[nivel + 1] || H - e) - yb - (nivel + 1 < niveles.length ? e / 2 : 0);
      // dos huecos por nivel (a cada lado del montante central)
      for (const lado of [-1, 1]) {
        const x0 = lado < 0 ? -W / 2 + e : e / 2, x1 = lado < 0 ? -e / 2 : W / 2 - e;
        let x = x0 + 0.01;
        let reservado = 0;
        if (decor[nivel] && ((nivel % 2 === 0) === (lado > 0))) reservado = 0.26;
        const fin = x1 - 0.01 - reservado;
        let tumbados = r() < 0.3;
        while (x < fin - 0.03) {
          if (tumbados && x < x0 + 0.05) {
            // pila de libros tumbados
            let yy = yb; const n = 3 + (r() * 3) | 0; const ancho = 0.2 + r() * 0.05;
            if (x + ancho > fin) break;
            for (let i = 0; i < n; i++) {
              const t = 0.025 + r() * 0.03, d = 0.17 + r() * 0.06, w = ancho - r() * 0.04;
              const geo = geoLibro(t, w, d, COLORES_LIBRO[(r() * COLORES_LIBRO.length) | 0]);
              q.setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.15, Math.PI / 2));
              m.compose(new V3(x + ancho / 2, yy + t / 2, D / 2 - 0.05 - d / 2), q, s);
              geo.applyMatrix4(m); libros.push(geo); yy += t;
            }
            x += ancho + 0.01; tumbados = false; continue;
          }
          const t = 0.022 + r() * 0.035, h = Math.min(alto - 0.03, 0.18 + r() * 0.12), d = 0.16 + r() * 0.07;
          if (x + t > fin) break;
          const geo = geoLibro(t, h, d, COLORES_LIBRO[(r() * COLORES_LIBRO.length) | 0]);
          m.compose(new V3(x + t / 2, yb + h / 2, D / 2 - 0.035 - d / 2 - r() * 0.02), q.identity(), s);
          geo.applyMatrix4(m); libros.push(geo);
          x += t + (r() < 0.08 ? 0.03 : 0.002);
          if (r() < 0.04) break; // hueco
        }
        // un libro inclinado al final de algunas filas
        if (!reservado && r() < 0.5 && x < fin - 0.05) {
          const t = 0.03, h = Math.min(alto - 0.05, 0.24), d = 0.18;
          const geo = geoLibro(t, h, d, COLORES_LIBRO[(r() * COLORES_LIBRO.length) | 0]);
          const ang = 0.32;
          q.setFromEuler(new THREE.Euler(0, 0, -ang));
          m.compose(new V3(x + Math.sin(ang) * h / 2 + t / 2, yb + Math.cos(ang) * h / 2 + 0.005, D / 2 - 0.05 - d / 2), q, s);
          geo.applyMatrix4(m); libros.push(geo);
        }
        if (reservado) {
          const cx = x1 - 0.14, tipo = decor[nivel];
          if (tipo === 'jarron') g.add(torno([[0, 0], [0.05, 0], [0.075, 0.06], [0.07, 0.14], [0.035, 0.2], [0.04, 0.23], [0.035, 0.23], [0, 0.2]], M.ceramicaAzul, cx, yb, 0.02));
          if (tipo === 'esfera') {
            g.add(cil(0.04, 0.05, 0.03, M.laton, cx, yb + 0.015, 0.02));
            g.add(malla(new THREE.SphereGeometry(0.08, 24, 16), M.ceramicaTerracota, cx, yb + 0.11, 0.02));
          }
          if (tipo === 'planta') {
            g.add(torno([[0, 0], [0.06, 0], [0.075, 0.11], [0.07, 0.11], [0, 0.1]], M.ceramica, cx, yb, 0.02));
            for (let i = 0; i < 9; i++) {
              const sph = malla(new THREE.SphereGeometry(0.03, 10, 8), M.suculenta, cx + Math.cos(i * 2.4) * 0.035 * (i % 3), yb + 0.12 + (i % 3) * 0.015, 0.02 + Math.sin(i * 2.4) * 0.035 * (i % 3));
              sph.scale.set(1, 0.6, 1); g.add(sph);
            }
          }
          if (tipo === 'foto') {
            const fr = caja(0.16, 0.2, 0.015, M.laton, cx, yb + 0.1, 0.0); fr.rotation.x = -0.12; g.add(fr);
            const ft = malla(new THREE.PlaneGeometry(0.13, 0.17), M.foto, cx, yb + 0.1, 0.009); ft.rotation.x = -0.12; g.add(ft);
          }
        }
      }
    });
    const libMesh = new THREE.Mesh(fusionar(libros), M.libros);
    sombra(libMesh);
    g.add(libMesh);
    return g;
  };

  // MUEBLE DE TV con televisor. Frente +z.
  F.muebleTV = function (M) {
    const g = new THREE.Group();
    const W = 1.8, H = 0.46, D = 0.42, y0 = 0.16;
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      g.add(pata(M.metalNegro, sx * (W / 2 - 0.08), sz * (D / 2 - 0.07), y0, 0.012, 0.012));
    g.add(cajaR(W, H, D, 0.012, M.nogal, 0, y0 + H / 2, 0));
    // frentes de puertas de listones
    for (let i = 0; i < 3; i++) {
      const cx = -W / 3 + i * W / 3;
      g.add(caja(W / 3 - 0.02, H - 0.05, 0.012, M.roble, cx, y0 + H / 2, D / 2 + 0.003));
      for (let k = -6; k <= 6; k++) g.add(sombra(new THREE.Mesh(new THREE.BoxGeometry(0.006, H - 0.07, 0.006), M.nogalOscuro), false, true)).children.slice(-1)[0].position.set(cx + k * 0.042, y0 + H / 2, D / 2 + 0.011);
      g.add(cil(0.008, 0.008, 0.012, M.laton, cx, y0 + H - 0.08, D / 2 + 0.015, 10)).children.slice(-1)[0].rotation.x = Math.PI / 2;
    }
    // televisor
    const tv = new THREE.Group();
    const yb = y0 + H;
    tv.add(caja(0.3, 0.012, 0.2, M.metalNegro, 0, yb + 0.006, 0));
    tv.add(caja(0.05, 0.08, 0.03, M.metalNegro, 0, yb + 0.05, -0.02));
    const tw = 1.24, th = 0.72, ty = yb + 0.08 + th / 2;
    tv.add(caja(tw, th, 0.035, M.plasticoNegro, 0, ty, -0.02));
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(tw - 0.03, th - 0.03), M.pantallaApagada);
    pantalla.position.set(0, ty, -0.002);
    tv.add(pantalla);
    g.add(tv);
    // altavoz pequeño y jarrón
    g.add(torno([[0, 0], [0.04, 0], [0.06, 0.08], [0.03, 0.2], [0.035, 0.24], [0, 0.24]], M.ceramicaTerracota, W / 2 - 0.16, yb, 0.02));
    g.add(cajaR(0.12, 0.2, 0.12, 0.02, M.telaGris, -W / 2 + 0.16, yb + 0.1, 0.03));
    const ctrl = {
      nombre: 'Televisor', encendida: false, pantalla,
      set(on) { this.encendida = on; pantalla.material = on ? M.pantallaEncendida : M.pantallaApagada; if (this.onCambio) this.onCambio(on); },
      alternar() { this.set(!this.encendida); }
    };
    return { grupo: g, tv: ctrl, pantalla };
  };

  // LÁMPARA DE PIE trípode con pantalla de lino
  F.lamparaPie = function (M) {
    const g = new THREE.Group();
    const top = 1.25;
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      const ab = 0.22;
      const len = Math.hypot(top, ab);
      const leg = cil(0.014, 0.018, len, M.roble, Math.cos(a) * ab / 2, top / 2, Math.sin(a) * ab / 2, 10);
      // inclinar la pata hacia fuera
      const dir = new V3(Math.cos(a) * ab, -top, Math.sin(a) * ab).normalize().negate();
      leg.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
      g.add(leg);
    }
    g.add(cil(0.012, 0.012, 0.22, M.laton, 0, top + 0.11, 0, 10));
    g.add(cil(0.022, 0.022, 0.05, M.laton, 0, top + 0.24, 0, 12)); // portalámparas
    const matPantalla = M.pantallaLino.clone();
    const pant = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.32, 40, 1, true), matPantalla);
    pant.position.y = 1.62; pant.castShadow = false; pant.receiveShadow = false;
    g.add(pant);
    const matBomb = M.bombilla.clone();
    const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), matBomb);
    bomb.position.y = 1.58; g.add(bomb);
    const luz = new THREE.PointLight(0xffc887, 0, 0, 2);
    luz.position.set(0, 1.58, 0);
    g.add(luz);
    const ctrl = controlLampara('Lámpara de pie', luz, 7, [[matPantalla, 1.3], [matBomb, 6]]);
    return { grupo: g, ctrl, luz };
  };

  // MESA AUXILIAR redonda
  F.mesaAuxiliar = function (M) {
    const g = new THREE.Group();
    g.add(cil(0.25, 0.25, 0.03, M.marmol, 0, 0.565, 0, 40));
    g.add(cil(0.03, 0.04, 0.53, M.metalNegro, 0, 0.285, 0, 16));
    g.add(cil(0.17, 0.18, 0.02, M.metalNegro, 0, 0.01, 0, 32));
    return g;
  };

  // LÁMPARA DE MESA con pie cerámico
  F.lamparaMesa = function (M) {
    const g = new THREE.Group();
    g.add(torno([[0, 0], [0.07, 0], [0.09, 0.03], [0.1, 0.1], [0.07, 0.19], [0.03, 0.23], [0.025, 0.26], [0, 0.26]], M.ceramicaVerde, 0, 0, 0));
    g.add(cil(0.006, 0.006, 0.1, M.laton, 0, 0.3, 0, 8));
    const matPantalla = M.pantallaLino.clone();
    const pant = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 0.2, 36, 1, true), matPantalla);
    pant.position.y = 0.37; g.add(pant);
    const matBomb = M.bombilla.clone();
    const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), matBomb);
    bomb.position.y = 0.34; g.add(bomb);
    const luz = new THREE.PointLight(0xffbf78, 0, 0, 2);
    luz.position.set(0, 0.36, 0); g.add(luz);
    const ctrl = controlLampara('Lámpara de mesa', luz, 2.5, [[matPantalla, 1.1], [matBomb, 5]]);
    return { grupo: g, ctrl, luz };
  };

  // LÁMPARA DE TECHO tipo campana
  F.lamparaTecho = function (M, caida) {
    const g = new THREE.Group();
    g.add(cil(0.06, 0.06, 0.025, M.metalNegro, 0, -0.012, 0, 24));
    g.add(cil(0.004, 0.004, caida, M.metalNegro, 0, -caida / 2, 0, 6));
    const perfil = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; perfil.push([0.02 + Math.sin(t * Math.PI / 2) * 0.23, -Math.cos(t * Math.PI / 2) * 0.0 - t * t * 0.2]); }
    const pts = perfil.map(p => new THREE.Vector2(p[0], p[1]));
    const campana = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), M.campanaTecho);
    campana.position.y = -caida;
    campana.castShadow = true;
    g.add(campana);
    const matBomb = M.bombilla.clone();
    const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), matBomb);
    bomb.position.y = -caida - 0.12; g.add(bomb);
    const luz = new THREE.PointLight(0xffd29a, 0, 0, 2);
    luz.position.y = -caida - 0.17; g.add(luz);
    const ctrl = controlLampara('Lámpara de techo', luz, 9, [[matBomb, 8]]);
    return { grupo: g, ctrl, luz, bombilla: bomb };
  };

  // PLANTA grande en maceta de terracota (hojas con textura con transparencia)
  F.planta = function (M) {
    const g = new THREE.Group();
    g.add(torno([[0, 0], [0.15, 0], [0.2, 0.36], [0.215, 0.37], [0.215, 0.4], [0.19, 0.4], [0.18, 0.37], [0, 0.36]], M.terracota, 0, 0, 0));
    g.add(cil(0.18, 0.18, 0.01, M.tierra, 0, 0.375, 0, 24));
    const r = TX.rng(77);
    const geoHoja = new THREE.PlaneGeometry(0.16, 0.3, 2, 6);
    geoHoja.translate(0, 0.15, 0);
    const p = geoHoja.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i);
      p.setZ(i, (y * y) * 0.9 - Math.abs(x) * 0.25); // curvatura
    }
    geoHoja.computeVertexNormals();
    const tallos = 7;
    for (let s = 0; s < tallos; s++) {
      const a = s / tallos * Math.PI * 2 + r();
      const alto = 0.9 + r() * 0.75, incl = 0.08 + r() * 0.15;
      const tallo = cil(0.008, 0.012, alto, M.tallo, Math.cos(a) * incl * alto / 2, 0.37 + alto / 2, Math.sin(a) * incl * alto / 2, 6);
      tallo.rotation.set(Math.sin(a) * incl, 0, -Math.cos(a) * incl);
      g.add(tallo);
      const nh = 4 + (r() * 3) | 0;
      for (let k = 0; k < nh; k++) {
        const t = 0.35 + (k / nh) * 0.65;
        const h = new THREE.Mesh(geoHoja, M.hoja);
        h.castShadow = true; h.receiveShadow = true;
        const ang = a + (r() - 0.5) * 2.2;
        h.position.set(Math.cos(a) * incl * alto * t, 0.37 + alto * t, Math.sin(a) * incl * alto * t);
        h.rotation.set(0, 0, 0);
        h.rotateY(-ang + Math.PI / 2);
        h.rotateX(-(0.5 + r() * 0.7));
        const sc = 0.8 + r() * 0.6; h.scale.set(sc, sc, sc);
        g.add(h);
      }
    }
    return g;
  };

  // APARADOR bajo con objetos
  F.aparador = function (M) {
    const g = new THREE.Group();
    const W = 1.6, H = 0.62, D = 0.42, y0 = 0.18;
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      g.add(pata(M.roble, sx * (W / 2 - 0.08), sz * (D / 2 - 0.08), y0, 0.022, 0.014, sx * 0.08, -sz * 0.06));
    g.add(cajaR(W, H, D, 0.012, M.pinturaBlanca, 0, y0 + H / 2, 0));
    g.add(caja(W + 0.02, 0.025, D + 0.02, M.roble, 0, y0 + H + 0.012, 0));
    for (let i = 0; i < 4; i++) {
      const cx = -W / 2 + W / 8 + i * W / 4;
      g.add(caja(W / 4 - 0.015, H - 0.04, 0.01, M.pinturaBlanca, cx, y0 + H / 2, D / 2 + 0.004));
      const tir = cajaR(0.012, 0.12, 0.02, 0.005, M.roble, cx + (i % 2 ? -1 : 1) * (W / 8 - 0.04), y0 + H / 2, D / 2 + 0.015);
      g.add(tir);
    }
    const yt = y0 + H + 0.025;
    // jarrón alto con ramas secas
    g.add(torno([[0, 0], [0.07, 0], [0.09, 0.08], [0.085, 0.22], [0.05, 0.32], [0.045, 0.36], [0.05, 0.38], [0, 0.37]], M.ceramica, -0.5, yt, 0));
    const r = TX.rng(5);
    for (let i = 0; i < 9; i++) {
      const len = 0.35 + r() * 0.35;
      const geo = new THREE.CylinderGeometry(0.003, 0.005, len, 5); geo.translate(0, len / 2, 0);
      const rama = sombra(new THREE.Mesh(geo, M.ramaSeca));
      rama.position.set(-0.5, yt + 0.3, 0);
      rama.rotation.set((r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8);
      g.add(rama);
      const ge = new THREE.CylinderGeometry(0.004, 0.014, 0.16, 6); ge.translate(0, len + 0.06, 0);
      const esp = sombra(new THREE.Mesh(ge, M.espiga));
      esp.position.copy(rama.position); esp.rotation.copy(rama.rotation);
      g.add(esp);
    }
    // marco de foto
    const fr = caja(0.2, 0.26, 0.02, M.nogal, 0.15, yt + 0.13, -0.05); fr.rotation.x = -0.1; g.add(fr);
    const ft = malla(new THREE.PlaneGeometry(0.16, 0.21), M.foto, 0.15, yt + 0.13, -0.039); ft.rotation.x = -0.1; g.add(ft);
    // tocadiscos
    g.add(cajaR(0.42, 0.08, 0.34, 0.01, M.nogal, 0.5, yt + 0.04, 0.0));
    g.add(cil(0.15, 0.15, 0.01, M.plasticoNegro, 0.46, yt + 0.085, 0.0, 40));
    g.add(cil(0.04, 0.04, 0.012, M.cojinTerracota, 0.46, yt + 0.087, 0.0, 20));
    const brazo = caja(0.012, 0.01, 0.2, M.laton, 0.66, yt + 0.095, -0.02); brazo.rotation.y = 0.35; g.add(brazo);
    return g;
  };

  // CORTINA con pliegues
  F.cortina = function (M, ancho, alto) {
    const geo = new THREE.PlaneGeometry(ancho, alto, 48, 8);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const fondo = 0.5 - y / alto; // más vuelo abajo
      p.setZ(i, Math.sin(x / ancho * Math.PI * 9) * (0.035 + fondo * 0.02));
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M.lino);
    return sombra(m);
  };

  // RADIADOR de columnas
  F.radiador = function (M, ancho) {
    const g = new THREE.Group();
    const n = Math.floor(ancho / 0.06);
    const geos = [];
    for (let i = 0; i < n; i++) {
      const geo = geoCajaRedondeada(0.045, 0.55, 0.08, 0.018, 2);
      geo.translate(-ancho / 2 + 0.03 + i * 0.06, 0.4, 0);
      geos.push(geo);
    }
    const tubo1 = new THREE.CylinderGeometry(0.015, 0.015, ancho, 10); tubo1.rotateZ(Math.PI / 2); tubo1.translate(0, 0.17, 0);
    const tubo2 = tubo1.clone(); tubo2.translate(0, 0.46, 0);
    g.add(sombra(new THREE.Mesh(fusionar(geos), M.radiador)));
    g.add(sombra(new THREE.Mesh(tubo1, M.radiador)), sombra(new THREE.Mesh(tubo2, M.radiador)));
    return g;
  };

  // PUERTA con marco y manilla (frente +z)
  F.puerta = function (M) {
    const g = new THREE.Group();
    const W = 0.86, H = 2.08;
    g.add(caja(W, H, 0.04, M.pinturaBlanca, 0, H / 2, 0));
    // molduras de cuarterones
    for (const y of [0.55, 1.45]) {
      const ph = y < 1 ? 0.7 : 0.9;
      g.add(caja(W - 0.22, 0.02, 0.012, M.pinturaBlanca, 0, y + ph / 2 - 0.1, 0.024));
      g.add(caja(W - 0.22, 0.02, 0.012, M.pinturaBlanca, 0, y - ph / 2 + 0.1, 0.024));
      g.add(caja(0.02, ph - 0.18, 0.012, M.pinturaBlanca, -(W - 0.24) / 2, y, 0.024));
      g.add(caja(0.02, ph - 0.18, 0.012, M.pinturaBlanca, (W - 0.24) / 2, y, 0.024));
    }
    // marco
    g.add(caja(0.08, H + 0.08, 0.06, M.pinturaBlanca, -W / 2 - 0.04, (H + 0.08) / 2, 0.01));
    g.add(caja(0.08, H + 0.08, 0.06, M.pinturaBlanca, W / 2 + 0.04, (H + 0.08) / 2, 0.01));
    g.add(caja(W + 0.16, 0.08, 0.06, M.pinturaBlanca, 0, H + 0.04, 0.01));
    // manilla
    g.add(cil(0.028, 0.028, 0.01, M.laton, W / 2 - 0.08, 1.02, 0.025, 20)).children.slice(-1)[0].rotation.x = Math.PI / 2;
    const man = cajaR(0.12, 0.018, 0.018, 0.008, M.laton, W / 2 - 0.12, 1.02, 0.06); g.add(man);
    g.add(cil(0.008, 0.008, 0.04, M.laton, W / 2 - 0.08, 1.02, 0.045, 8)).children.slice(-1)[0].rotation.x = Math.PI / 2;
    return g;
  };

  // CUADRO enmarcado (frente +z)
  F.cuadro = function (M, mat, w, h, colorMarco) {
    const g = new THREE.Group();
    const mm = colorMarco || M.nogalOscuro, f = 0.035, d = 0.035;
    g.add(caja(w + 2 * f, f, d, mm, 0, h / 2 + f / 2, 0));
    g.add(caja(w + 2 * f, f, d, mm, 0, -h / 2 - f / 2, 0));
    g.add(caja(f, h, d, mm, -w / 2 - f / 2, 0, 0));
    g.add(caja(f, h, d, mm, w / 2 + f / 2, 0, 0));
    g.add(caja(w, h, 0.005, M.pinturaBlanca, 0, 0, -0.01));
    const lienzo = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), mat);
    lienzo.position.z = -0.005; lienzo.receiveShadow = true; g.add(lienzo);
    return g;
  };

  // RELOJ de pared con manecillas animadas (frente +z)
  F.reloj = function (M) {
    const g = new THREE.Group();
    const aro = malla(new THREE.TorusGeometry(0.17, 0.015, 10, 48), M.metalNegro, 0, 0, 0.0); g.add(aro);
    const esfera = new THREE.Mesh(new THREE.CircleGeometry(0.17, 48), M.esferaReloj);
    esfera.position.z = -0.004; esfera.receiveShadow = true; g.add(esfera);
    function manecilla(l, a, mat, z) {
      const geo = new THREE.BoxGeometry(a, l, 0.004); geo.translate(0, l / 2 - 0.02, 0);
      const m = new THREE.Mesh(geo, mat); m.position.z = z; g.add(m); return m;
    }
    const horas = manecilla(0.09, 0.012, M.metalNegro, 0.004);
    const minutos = manecilla(0.135, 0.008, M.metalNegro, 0.008);
    const segundos = manecilla(0.145, 0.003, M.cojinTerracota, 0.012);
    g.add(cil(0.01, 0.01, 0.02, M.laton, 0, 0, 0.01, 12)).children.slice(-1)[0].rotation.x = Math.PI / 2;
    return {
      grupo: g,
      actualizar() {
        const d = new Date();
        const s = d.getSeconds() + d.getMilliseconds() / 1000, mi = d.getMinutes() + s / 60, h = (d.getHours() % 12) + mi / 60;
        segundos.rotation.z = -s / 60 * Math.PI * 2;
        minutos.rotation.z = -mi / 60 * Math.PI * 2;
        horas.rotation.z = -h / 12 * Math.PI * 2;
      }
    };
  };

  // INTERRUPTOR de pared (frente +z)
  F.interruptor = function (M) {
    const g = new THREE.Group();
    g.add(cajaR(0.085, 0.085, 0.012, 0.004, M.pinturaBlanca, 0, 0, 0));
    const tecla = cajaR(0.05, 0.05, 0.012, 0.004, M.ceramica, 0, 0, 0.008);
    g.add(tecla);
    return { grupo: g, tecla };
  };

  window.MUEBLES = F;
})();
