/* Texturas generadas por código con <canvas>. Nada se descarga.
   Todas son deterministas (PRNG con semilla) para que el resultado sea siempre igual. */
(function () {
  'use strict';
  const TX = {};

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  TX.rng = rng;

  function lienzo(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  }

  function aTextura(c, opts) {
    opts = opts || {};
    const t = new THREE.CanvasTexture(c);
    if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    if (opts.repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    t.anisotropy = opts.aniso || 4;
    return t;
  }
  TX.aTextura = aTextura;

  // Ruido por píxel (grano fino)
  function ruido(g, w, h, cantidad, r) {
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * cantidad;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(id, 0, 0);
  }

  // Dibuja algo en (x,y) y en sus copias desplazadas para que la textura enlace sin costuras
  function enlazado(w, h, x, y, rad, fn) {
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const xx = x + ox * w, yy = y + oy * h;
      if (xx + rad < 0 || xx - rad > w || yy + rad < 0 || yy - rad > h) continue;
      fn(xx, yy);
    }
  }

  /* ---------- Suelo de tarima de roble ---------- */
  TX.tarima = function () {
    const W = 1024, H = 1024, [c, g] = lienzo(W, H), r = rng(11);
    const filas = 8, ph = H / filas;
    function tabla(x, y, len, sem) {
      const q = rng(sem);
      const hue = 29 + q() * 4, sat = 40 + q() * 9, lum = 54 + q() * 7;
      g.save();
      g.beginPath(); g.rect(x, y, len, ph); g.clip();
      g.fillStyle = `hsl(${hue},${sat}%,${lum}%)`;
      g.fillRect(x, y, len, ph);
      // vetas suaves de tono
      const grd = g.createLinearGradient(x, y, x, y + ph);
      grd.addColorStop(0, `hsla(${hue},${sat}%,${lum - 6}%,0.35)`);
      grd.addColorStop(0.5, `hsla(${hue},${sat}%,${lum + 4}%,0.15)`);
      grd.addColorStop(1, `hsla(${hue},${sat}%,${lum - 8}%,0.35)`);
      g.fillStyle = grd; g.fillRect(x, y, len, ph);
      // vetas
      for (let k = 0; k < 46; k++) {
        const y0 = y + q() * ph, amp = 1 + q() * 4, f = 0.004 + q() * 0.012, f0 = q() * 6;
        g.strokeStyle = `hsla(${hue - 4},${sat + 5}%,${lum - 14 - q() * 14}%,${0.12 + q() * 0.3})`;
        g.lineWidth = 0.6 + q() * 1.6;
        g.beginPath();
        for (let xx = x; xx <= x + len + 8; xx += 8) {
          const yy = y0 + Math.sin(xx * f + f0) * amp + Math.sin(xx * f * 3.1) * amp * 0.3;
          if (xx === x) g.moveTo(xx, yy); else g.lineTo(xx, yy);
        }
        g.stroke();
      }
      // nudos
      if (q() < 0.35) {
        const kx = x + len * (0.2 + q() * 0.6), ky = y + ph * (0.3 + q() * 0.4);
        for (let i = 6; i > 0; i--) {
          g.strokeStyle = `hsla(${hue - 6},${sat + 10}%,${lum - 20 - i * 2}%,0.35)`;
          g.lineWidth = 1.2;
          g.beginPath(); g.ellipse(kx, ky, 4 + i * 5, 2 + i * 1.6, 0, 0, Math.PI * 2); g.stroke();
        }
        g.fillStyle = `hsla(${hue - 8},${sat}%,${lum - 30}%,0.8)`;
        g.beginPath(); g.ellipse(kx, ky, 4, 2.5, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      // junta de testa
      g.fillStyle = 'rgba(45,28,16,0.85)'; g.fillRect(x, y, 2, ph);
    }
    for (let fila = 0; fila < filas; fila++) {
      let x = -r() * W * 0.6;
      const y = fila * ph;
      const inicio = x;
      while (x < inicio + W) {
        const len = W * (0.32 + r() * 0.45);
        const sem = (r() * 1e9) | 0;
        const lenReal = Math.min(len, inicio + W - x);
        tabla(x, y, lenReal, sem);
        if (x < 0) tabla(x + W, y, lenReal, sem);
        if (x + lenReal > W) tabla(x - W, y, lenReal, sem);
        x += len;
      }
      g.fillStyle = 'rgba(45,28,16,0.9)'; g.fillRect(0, y, W, 2.5);
    }
    ruido(g, W, H, 12, r);
    return c;
  };

  /* ---------- Yeso de pared ---------- */
  TX.yeso = function (base, semilla) {
    const W = 512, H = 512, [c, g] = lienzo(W, H), r = rng(semilla || 3);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {
      const x = r() * W, y = r() * H, rad = 30 + r() * 90, claro = r() < 0.5;
      enlazado(W, H, x, y, rad, (xx, yy) => {
        const grd = g.createRadialGradient(xx, yy, 0, xx, yy, rad);
        grd.addColorStop(0, claro ? 'rgba(255,255,255,0.025)' : 'rgba(90,70,50,0.018)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.fillRect(xx - rad, yy - rad, rad * 2, rad * 2);
      });
    }
    ruido(g, W, H, 9, r);
    return c;
  };

  /* ---------- Tela tejida ---------- */
  TX.tela = function (base, semilla) {
    const W = 256, H = 256, [c, g] = lienzo(W, H), r = rng(semilla || 5);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 2) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, y, W, 1); }
    for (let x = 0; x < W; x += 2) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, 0, 1, H); }
    for (let i = 0; i < 900; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
      g.fillRect(r() * W, r() * H, 1 + r() * 5, 1);
    }
    ruido(g, W, H, 16, r);
    return c;
  };

  /* ---------- Madera para muebles ---------- */
  TX.madera = function (base, semilla) {
    const W = 512, H = 512, [c, g] = lienzo(W, H), r = rng(semilla || 9);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 110; k++) {
      const x0 = r() * W, amp = 2 + r() * 8, f = 0.004 + r() * 0.01, f0 = r() * 6;
      const oscuro = r() < 0.75;
      g.strokeStyle = oscuro ? `rgba(30,15,5,${0.04 + r() * 0.11})` : `rgba(255,230,190,${0.04 + r() * 0.07})`;
      g.lineWidth = 0.5 + r() * 2;
      enlazado(W, H, x0, H / 2, W, (xx) => {
        g.beginPath();
        for (let y = -8; y <= H + 8; y += 8) {
          const x = xx + Math.sin(y * f + f0) * amp;
          if (y === -8) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      });
    }
    ruido(g, W, H, 10, r);
    return c;
  };

  /* ---------- Alfombra tipo kilim ---------- */
  TX.alfombra = function () {
    const W = 512, H = 768, [c, g] = lienzo(W, H), r = rng(21);
    const terracota = '#a9472f', crema = '#eadfc4', marino = '#203148', mostaza = '#c99a3a', rosa = '#d98b73';
    g.fillStyle = crema; g.fillRect(0, 0, W, H);
    // bordes
    const bandas = [[0, 26, marino], [26, 10, crema], [36, 22, terracota], [58, 8, crema], [66, 12, mostaza]];
    for (const [o, t, col] of bandas) {
      g.fillStyle = col;
      g.fillRect(o, o, W - o * 2, t); g.fillRect(o, H - o - t, W - o * 2, t);
      g.fillRect(o, o, t, H - o * 2); g.fillRect(W - o - t, o, t, H - o * 2);
    }
    // dientes de sierra en la banda terracota
    g.fillStyle = crema;
    for (let x = 40; x < W - 40; x += 16) {
      g.beginPath(); g.moveTo(x, 58); g.lineTo(x + 8, 48); g.lineTo(x + 16, 58); g.fill();
      g.beginPath(); g.moveTo(x, H - 58); g.lineTo(x + 8, H - 48); g.lineTo(x + 16, H - 58); g.fill();
    }
    // campo central
    const m = 78;
    g.fillStyle = terracota; g.fillRect(m, m, W - 2 * m, H - 2 * m);
    g.save(); g.beginPath(); g.rect(m, m, W - 2 * m, H - 2 * m); g.clip();
    function rombo(cx, cy, rx, ry, col) {
      g.fillStyle = col; g.beginPath();
      g.moveTo(cx, cy - ry); g.lineTo(cx + rx, cy); g.lineTo(cx, cy + ry); g.lineTo(cx - rx, cy); g.closePath(); g.fill();
    }
    for (let y = m; y < H - m + 60; y += 60) {
      for (let x = m; x < W - m + 60; x += 60) {
        rombo(x, y, 22, 22, rosa); rombo(x, y, 14, 14, crema); rombo(x, y, 6, 6, marino);
      }
    }
    // medallón
    const cx = W / 2, cy = H / 2;
    rombo(cx, cy, 150, 220, marino); rombo(cx, cy, 130, 196, crema); rombo(cx, cy, 108, 166, mostaza);
    rombo(cx, cy, 84, 130, terracota); rombo(cx, cy, 54, 86, crema); rombo(cx, cy, 30, 48, marino);
    for (let i = -3; i <= 3; i++) if (i) rombo(cx, cy + i * 30, 8, 8, i % 2 ? crema : marino);
    g.restore();
    // fibras
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
      g.fillRect(r() * W, r() * H, 1, 2 + r() * 3);
    }
    ruido(g, W, H, 22, r);
    return c;
  };

  /* ---------- Lomo de libro (escala de grises, se tiñe con color de vértice) ---------- */
  TX.lomo = function () {
    const W = 64, H = 256, [c, g] = lienzo(W, H), r = rng(31);
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, W, H);
    const grd = g.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0.25)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 18, W, 5); g.fillRect(0, 28, W, 2); g.fillRect(0, H - 30, W, 2); g.fillRect(0, H - 23, W, 5);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(10, 80, W - 20, 70);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 6; i++) g.fillRect(16 + r() * 6, 90 + i * 9, 16 + r() * 18, 3);
    ruido(g, W, H, 10, r);
    // esquina superior derecha blanca: la usan las caras de las páginas
    g.fillStyle = '#ffffff'; g.fillRect(W - 6, 0, 6, 6);
    return c;
  };

  /* ---------- Hoja de planta (con alfa) ---------- */
  TX.hoja = function () {
    const W = 128, H = 256, [c, g] = lienzo(W, H), r = rng(41);
    g.clearRect(0, 0, W, H);
    g.beginPath();
    g.moveTo(W / 2, H - 4);
    g.bezierCurveTo(W * 1.02, H * 0.72, W * 0.98, H * 0.22, W / 2, 4);
    g.bezierCurveTo(W * 0.02, H * 0.22, -W * 0.02, H * 0.72, W / 2, H - 4);
    const grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#3f7a3a'); grd.addColorStop(0.6, '#2c5e2b'); grd.addColorStop(1, '#22491f');
    g.fillStyle = grd; g.fill();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(190,220,150,0.6)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, 8); g.stroke();
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(180,215,140,0.35)';
    for (let y = 30; y < H - 10; y += 16) {
      g.beginPath(); g.moveTo(W / 2, y + 14); g.quadraticCurveTo(W * 0.3, y + 6, 6, y - 6); g.stroke();
      g.beginPath(); g.moveTo(W / 2, y + 14); g.quadraticCurveTo(W * 0.7, y + 6, W - 6, y - 6); g.stroke();
    }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,200,${r() * 0.05})`; g.fillRect(r() * W, r() * H, 2, 2); }
    g.restore();
    return c;
  };

  /* ---------- Cuadro 1: paisaje abstracto ---------- */
  TX.cuadroPaisaje = function () {
    const W = 600, H = 420, [c, g] = lienzo(W, H), r = rng(51);
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#f2d9b1'); grd.addColorStop(1, '#efc49b');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d9643f'; g.beginPath(); g.arc(W * 0.68, H * 0.36, 62, 0, Math.PI * 2); g.fill();
    const capas = ['#c98a5b', '#8d5a3b', '#4f6b5b', '#2f4a45', '#1f2f33'];
    capas.forEach((col, i) => {
      g.fillStyle = col; g.beginPath();
      const base = H * (0.45 + i * 0.12);
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 10) {
        g.lineTo(x, base - Math.sin(x * (0.006 + i * 0.002) + i * 1.7) * (40 - i * 4) - Math.sin(x * 0.02 + i) * 8);
      }
      g.lineTo(W, H); g.closePath(); g.fill();
    });
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = 'rgba(60,40,30,0.7)'; g.lineWidth = 2;
      const bx = 80 + i * 26 + r() * 10, by = H * 0.3 + r() * 20;
      g.beginPath(); g.moveTo(bx - 7, by); g.quadraticCurveTo(bx - 3, by - 5, bx, by); g.quadraticCurveTo(bx + 3, by - 5, bx + 7, by); g.stroke();
    }
    ruido(g, W, H, 18, r);
    return c;
  };

  /* ---------- Cuadro 2: composición geométrica ---------- */
  TX.cuadroGeometrico = function () {
    const W = 420, H = 560, [c, g] = lienzo(W, H), r = rng(61);
    g.fillStyle = '#efe7d8'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1f3148'; g.fillRect(40, 300, 230, 220);
    g.fillStyle = '#d2a13e'; g.beginPath(); g.arc(270, 190, 110, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b6492f'; g.beginPath(); g.arc(150, 300, 90, Math.PI, 0); g.fill();
    g.fillStyle = '#6f8e7f'; g.fillRect(250, 340, 120, 180);
    g.strokeStyle = '#222'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(40, 120); g.lineTo(380, 120); g.stroke();
    g.beginPath(); g.arc(120, 420, 40, 0, Math.PI * 2); g.strokeStyle = '#efe7d8'; g.stroke();
    ruido(g, W, H, 16, r);
    return c;
  };

  /* ---------- Foto pequeña ---------- */
  TX.foto = function () {
    const W = 200, H = 260, [c, g] = lienzo(W, H), r = rng(71);
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#9cc3d8'); grd.addColorStop(0.55, '#e8d6b8'); grd.addColorStop(0.56, '#3f7f9a'); grd.addColorStop(1, '#2b5c73');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e9d3a5'; g.fillRect(0, H * 0.82, W, H * 0.18);
    g.fillStyle = '#5a3c2a'; g.fillRect(60, 120, 6, 95);
    g.fillStyle = '#2e5a2e';
    for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(63, 120, 45, 9, i * 0.45, 0, Math.PI * 2); g.fill(); }
    ruido(g, W, H, 14, r);
    return c;
  };

  /* ---------- Esfera de reloj ---------- */
  TX.reloj = function () {
    const S = 256, [c, g] = lienzo(S, S);
    g.fillStyle = '#f4efe6'; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2a2a';
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * Math.PI * 2, larga = i % 5 === 0;
      g.save(); g.translate(S / 2, S / 2); g.rotate(a);
      g.fillRect(-(larga ? 3 : 1), -S / 2 + 10, larga ? 6 : 2, larga ? 20 : 8);
      g.restore();
    }
    g.font = 'bold 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let h = 1; h <= 12; h++) {
      const a = h / 12 * Math.PI * 2;
      g.fillText(String(h), S / 2 + Math.sin(a) * 84, S / 2 - Math.cos(a) * 84);
    }
    return c;
  };

  /* ---------- Vista exterior por la ventana (día / atardecer / noche) ---------- */
  TX.exterior = function (modo) {
    const W = 2048, H = 1024, [c, g] = lienzo(W, H), r = rng(81);
    const P = {
      dia:   { cielo: ['#4f8fd6', '#9cc6ec', '#e7f1f6'], sol: '#fffbe8', solY: 0.18, solX: 0.62, monte: '#8aa0b4', colina: '#7a9a55', colina2: '#5d7f40', arbol: '#355f2e', suelo: '#6f9a48', nubes: 1 },
      tarde: { cielo: ['#3d4a7a', '#d97a5a', '#f7c27a'], sol: '#ffd9a0', solY: 0.40, solX: 0.72, monte: '#7a5f78', colina: '#6b5a45', colina2: '#52452f', arbol: '#2f3226', suelo: '#5b5338', nubes: 0.8 },
      noche: { cielo: ['#04070f', '#0b1530', '#1b2a4a'], sol: '#e9eefc', solY: 0.16, solX: 0.35, monte: '#141b2c', colina: '#0f1a1a', colina2: '#0b1414', arbol: '#070c0c', suelo: '#0c1412', nubes: 0.15 }
    }[modo];
    const hz = H * 0.52; // horizonte
    const grd = g.createLinearGradient(0, 0, 0, hz);
    grd.addColorStop(0, P.cielo[0]); grd.addColorStop(0.65, P.cielo[1]); grd.addColorStop(1, P.cielo[2]);
    g.fillStyle = grd; g.fillRect(0, 0, W, hz + 4);
    if (modo === 'noche') {
      for (let i = 0; i < 500; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
        const s = r() < 0.1 ? 2 : 1;
        g.fillRect(r() * W, r() * hz * 0.9, s, s);
      }
    }
    // sol o luna con halo
    const sx = W * P.solX, sy = H * P.solY;
    const halo = g.createRadialGradient(sx, sy, 0, sx, sy, modo === 'noche' ? 120 : 260);
    halo.addColorStop(0, P.sol); halo.addColorStop(0.15, hexA(P.sol, 0.6)); halo.addColorStop(1, hexA(P.sol, 0));
    g.fillStyle = halo; g.fillRect(sx - 300, sy - 300, 600, 600);
    g.fillStyle = P.sol; g.beginPath(); g.arc(sx, sy, modo === 'noche' ? 26 : 38, 0, Math.PI * 2); g.fill();
    // nubes
    for (let i = 0; i < 14; i++) {
      const cx = r() * W, cy = H * (0.08 + r() * 0.28), n = 6 + (r() * 6) | 0;
      for (let k = 0; k < n; k++) {
        const x = cx + (r() - 0.5) * 220, y = cy + (r() - 0.5) * 30, rad = 30 + r() * 50;
        const ng = g.createRadialGradient(x, y, 0, x, y, rad);
        const col = modo === 'tarde' ? '255,200,170' : modo === 'noche' ? '120,130,160' : '255,255,255';
        ng.addColorStop(0, `rgba(${col},${0.35 * P.nubes})`); ng.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = ng; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }
    // montañas lejanas
    perfil(P.monte, hz + 10, 90, 0.003, 0.011, 1);
    perfil(P.colina, hz + 40, 50, 0.004, 0.017, 2);
    // suelo
    g.fillStyle = P.suelo; g.fillRect(0, hz + 40, W, H - hz);
    perfil(P.colina2, hz + 70, 28, 0.006, 0.02, 3);
    g.fillStyle = P.colina2; g.fillRect(0, hz + 70, W, H);
    // árboles
    for (let i = 0; i < 70; i++) {
      const x = r() * W, cerca = r(), y = hz + 40 + cerca * 120, s = 16 + cerca * 50;
      g.fillStyle = '#3b2a1e'; g.fillRect(x - s * 0.06, y - s * 0.6, s * 0.12, s * 0.7);
      g.fillStyle = P.arbol;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (r() - 0.5) * s * 0.6, y - s * 0.7 - r() * s * 0.6, s * (0.3 + r() * 0.2), 0, Math.PI * 2); g.fill(); }
    }
    // casita lejana con ventana (de noche, encendida)
    const hx = W * 0.2, hy = hz + 52;
    g.fillStyle = modo === 'noche' ? '#151a22' : '#d8cbb5'; g.fillRect(hx, hy - 30, 50, 30);
    g.fillStyle = modo === 'noche' ? '#1d1414' : '#9a4b35';
    g.beginPath(); g.moveTo(hx - 6, hy - 30); g.lineTo(hx + 25, hy - 50); g.lineTo(hx + 56, hy - 30); g.fill();
    g.fillStyle = modo === 'noche' ? '#ffcf7a' : '#4a5a66'; g.fillRect(hx + 10, hy - 22, 9, 9); g.fillRect(hx + 30, hy - 22, 9, 9);
    // seto cercano
    g.fillStyle = modo === 'noche' ? '#060a08' : '#2c4a22';
    for (let x = 0; x < W; x += 30) { g.beginPath(); g.arc(x, H * 0.93, 40 + r() * 15, 0, Math.PI * 2); g.fill(); }
    g.fillRect(0, H * 0.93, W, H);
    ruido(g, W, H, 8, r);
    return c;

    function perfil(col, base, alt, f1, f2, sem) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, base - (Math.sin(x * f1 + sem) * 0.6 + Math.sin(x * f2 + sem * 2) * 0.4 + 1) * alt * 0.5);
      g.lineTo(W, H); g.closePath(); g.fill();
    }
    function hexA(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
  };

  /* ---------- Pantalla de TV encendida ---------- */
  TX.tv = function () {
    const W = 512, H = 288, [c, g] = lienzo(W, H), r = rng(91);
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#0d2a4a'); grd.addColorStop(0.6, '#1e6a8a'); grd.addColorStop(1, '#0a3a4a');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // rayos de luz bajo el agua
    for (let i = 0; i < 8; i++) {
      g.fillStyle = 'rgba(180,230,255,0.06)';
      g.beginPath(); const x = r() * W; g.moveTo(x, 0); g.lineTo(x + 40, 0); g.lineTo(x + 140, H); g.lineTo(x + 60, H); g.fill();
    }
    // peces
    for (let i = 0; i < 12; i++) {
      const x = r() * W, y = 40 + r() * (H - 100), s = 6 + r() * 14;
      g.fillStyle = ['#ffb347', '#ffd166', '#f08a5d', '#9be3ff'][i % 4];
      g.beginPath(); g.ellipse(x, y, s, s * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * 1.6, y - s * 0.5); g.lineTo(x - s * 1.6, y + s * 0.5); g.fill();
    }
    // corales
    for (let i = 0; i < 18; i++) {
      g.fillStyle = ['#d96c6c', '#e8a87c', '#7fbf7f', '#c38fd1'][i % 4];
      const x = r() * W; g.beginPath(); g.ellipse(x, H - 10, 14 + r() * 20, 30 + r() * 30, 0, Math.PI, 0); g.fill();
    }
    g.fillStyle = '#c9b48a'; g.fillRect(0, H - 14, W, 14);
    return c;
  };

  window.TX = TX;
})();
