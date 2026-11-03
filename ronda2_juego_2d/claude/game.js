/* FAROL — la última llama
 * Juego original en canvas 2D. Sin dependencias.
 * Mundo en coordenadas polares alrededor del farol (radio del claro R = 400 unidades).
 */
'use strict';
(() => {
  const TAU = Math.PI * 2;
  const R = 400;              // radio del claro, en unidades de mundo
  const LANTERN_R = 26;       // radio del farol
  const BEAM_HW = 0.30;       // semiapertura del haz (rad)
  const MAX_PARTS = 600;
  const STORE_KEY = 'farol.record';

  const $ = (id) => document.getElementById(id);
  const cvs = $('lienzo');
  const ctx = cvs.getContext('2d', { alpha: false });
  const body = document.body;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => {
    let d = (a - b) % TAU;
    if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
    return d;
  };

  // ---------------------------------------------------------------- Récord
  let best = 0;
  try { best = parseInt(localStorage.getItem(STORE_KEY), 10) || 0; } catch (e) { best = 0; }
  function saveBest() { try { localStorage.setItem(STORE_KEY, String(best)); } catch (e) { /* sin almacenamiento */ } }

  // ---------------------------------------------------------------- Sonido (Web Audio)
  const Snd = {
    ac: null, out: null, sizG: null, noiseBuf: null, muted: false, quiet: true, lastKill: 0,
    init() {
      if (!this.ac) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          const ac = new AC();
          this.ac = ac;
          const comp = ac.createDynamicsCompressor();
          comp.connect(ac.destination);
          this.out = ac.createGain();
          this.out.gain.value = this.muted ? 0 : 0.5;
          this.out.connect(comp);
          const len = ac.sampleRate;
          const buf = ac.createBuffer(1, len, ac.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          this.noiseBuf = buf;
          // chisporroteo continuo mientras la luz quema sombras
          const src = ac.createBufferSource();
          src.buffer = buf; src.loop = true;
          const bp = ac.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 0.8;
          this.sizG = ac.createGain(); this.sizG.gain.value = 0;
          src.connect(bp); bp.connect(this.sizG); this.sizG.connect(this.out);
          src.start();
        } catch (e) { this.ac = null; return; }
      }
      if (this.ac.state === 'suspended') this.ac.resume();
    },
    ok() { return this.ac && !this.quiet; },
    tone(f, dur, type = 'sine', vol = 0.2, to = 0, delay = 0) {
      if (!this.ok()) return;
      const ac = this.ac, t = ac.currentTime + delay;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.out);
      o.start(t); o.stop(t + dur + 0.05);
    },
    noise(dur, vol, freq, type = 'bandpass', q = 1, delay = 0) {
      if (!this.ok()) return;
      const ac = this.ac, t = ac.currentTime + delay;
      const s = ac.createBufferSource(); s.buffer = this.noiseBuf;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.out);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    },
    sizzle(level) {
      if (!this.ac) return;
      const v = this.quiet ? 0 : Math.min(1, level) * 0.08;
      this.sizG.gain.setTargetAtTime(v, this.ac.currentTime, 0.06);
    },
    kill(type, combo) {
      const now = performance.now();
      if (now - this.lastKill < 35) return;
      this.lastKill = now;
      if (type === 'coloso') {
        this.tone(200, 0.55, 'triangle', 0.32, 55);
        this.noise(0.45, 0.25, 700, 'lowpass');
      } else {
        const f = 420 * Math.pow(2, Math.min(combo, 15) / 12);
        this.tone(f, 0.2, 'triangle', 0.13, f * 0.5);
        this.tone(f * 1.5, 0.12, 'sine', 0.05, 0, 0.03);
        this.noise(0.14, 0.07, 4500, 'highpass');
      }
    },
    fly() {
      [988, 1319, 1760].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.12, 0, i * 0.06));
    },
    flyLost() { this.tone(660, 0.25, 'sine', 0.05, 440); },
    hit() {
      this.tone(140, 0.5, 'square', 0.18, 45);
      this.noise(0.5, 0.35, 300, 'lowpass');
    },
    flash() {
      this.noise(0.6, 0.3, 2000, 'highpass');
      this.tone(300, 0.45, 'sawtooth', 0.08, 1400);
      this.tone(900, 0.6, 'sine', 0.12, 1800, 0.05);
    },
    denied() { this.tone(180, 0.12, 'square', 0.06, 150); },
    hour() { this.tone(523, 0.9, 'sine', 0.12); this.tone(784, 1.1, 'sine', 0.1, 0, 0.18); },
    low() { this.tone(880, 0.09, 'square', 0.04); },
    start() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.1, 0, i * 0.07)); },
    over() {
      this.tone(440, 1.6, 'sawtooth', 0.08, 70);
      this.tone(330, 1.8, 'triangle', 0.12, 55, 0.1);
      this.noise(1.2, 0.15, 500, 'lowpass');
    },
    setMuted(m) {
      this.muted = m;
      if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.5, this.ac.currentTime, 0.02);
    },
  };

  // ---------------------------------------------------------------- Sprites precalculados
  function makeGlow(size, stops) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }
  const sprFly = makeGlow(64, [[0, 'rgba(255,255,220,1)'], [0.12, 'rgba(235,255,150,.95)'], [0.4, 'rgba(170,235,90,.28)'], [1, 'rgba(120,200,60,0)']]);
  const sprHalo = makeGlow(256, [[0, 'rgba(255,215,140,.6)'], [0.3, 'rgba(255,165,70,.2)'], [1, 'rgba(255,140,40,0)']]);
  const sprEmber = makeGlow(32, [[0, 'rgba(255,245,210,1)'], [0.3, 'rgba(255,170,60,.8)'], [1, 'rgba(255,100,20,0)']]);
  const sprWisp = makeGlow(32, [[0, 'rgba(210,190,255,.9)'], [0.35, 'rgba(140,100,255,.4)'], [1, 'rgba(90,60,200,0)']]);
  const sprRed = makeGlow(32, [[0, 'rgba(255,200,200,1)'], [0.35, 'rgba(255,60,90,.6)'], [1, 'rgba(200,0,40,0)']]);
  const PART_SPR = [sprEmber, sprFly, sprWisp, sprRed];

  // ---------------------------------------------------------------- Pantalla y fondo
  let W = 0, H = 0, DPR = 1, K = 1, CX = 0, CY = 0;
  const bg = document.createElement('canvas');

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
    K = Math.min(W * 0.47, (H - 70) * 0.47) / R;
    CX = W / 2; CY = H / 2 + 18;
    buildBg();
  }

  function buildBg() {
    bg.width = cvs.width; bg.height = cvs.height;
    const g = bg.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    let gr = g.createRadialGradient(CX, CY, 0, CX, CY, Math.hypot(W, H) / 2);
    gr.addColorStop(0, '#111830'); gr.addColorStop(1, '#03040a');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    let seed = 1234567;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 180; i++) {
      g.fillStyle = `rgba(220,225,255,${0.15 + rnd() * 0.5})`;
      const s = rnd() < 0.9 ? 1 : 2;
      g.fillRect(rnd() * W, rnd() * H, s, s);
    }
    g.setTransform(DPR * K, 0, 0, DPR * K, DPR * CX, DPR * CY);
    // claro del bosque
    gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.05);
    gr.addColorStop(0, '#1d2340'); gr.addColorStop(0.7, '#121732'); gr.addColorStop(1, 'rgba(10,12,26,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 1.05, 0, TAU); g.fill();
    // hierba
    g.lineWidth = 1.4; g.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const a = rnd() * TAU, d = 50 + Math.sqrt(rnd()) * (R - 60);
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      g.strokeStyle = `rgba(110,150,140,${0.08 + rnd() * 0.12})`;
      g.beginPath();
      for (let j = -1; j <= 1; j++) { g.moveTo(x + j * 3, y); g.lineTo(x + j * 4 + rnd() * 2, y - 6 - rnd() * 5); }
      g.stroke();
    }
    // piedras del sendero alrededor del farol
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU + rnd() * 0.1, d = 64 + rnd() * 6;
      g.fillStyle = `rgba(150,150,180,${0.07 + rnd() * 0.06})`;
      g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, 6 + rnd() * 3, 4 + rnd() * 2, a, 0, TAU); g.fill();
    }
    // anillo de árboles (siluetas)
    for (let layer = 0; layer < 3; layer++) {
      g.fillStyle = ['#0a0d1c', '#080a17', '#05060f'][layer];
      const n = 64 + layer * 10;
      for (let i = 0; i < n; i++) {
        const a = (i + rnd() * 0.6) / n * TAU;
        const d = R * (1.0 + layer * 0.07 + rnd() * 0.05);
        const h = 34 + rnd() * 40, w = 0.045 + rnd() * 0.03;
        g.beginPath();
        g.moveTo(Math.cos(a - w) * d, Math.sin(a - w) * d);
        g.lineTo(Math.cos(a) * (d + h), Math.sin(a) * (d + h));
        g.lineTo(Math.cos(a + w) * d, Math.sin(a + w) * d);
        g.closePath(); g.fill();
      }
    }
    g.beginPath(); g.arc(0, 0, R * 1.18, 0, TAU);
    g.lineWidth = R * 0.12; g.strokeStyle = '#05060f'; g.stroke();
  }

  // ---------------------------------------------------------------- Estado
  const TYPES = {
    sombra:  { r: 19, hp: 0.70, v: 44, val: 20, rim: '150,120,255', eye: '#d9ccff' },
    brizna:  { r: 12, hp: 0.30, v: 86, val: 15, rim: '110,220,255', eye: '#c8f6ff' },
    coloso:  { r: 34, hp: 2.40, v: 24, val: 60, rim: '255,90,130',  eye: '#ffb3c4' },
    espiral: { r: 16, hp: 0.60, v: 40, val: 35, rim: '150,255,120', eye: '#e2ffcc', w: 0.55 },
  };

  let mode = 'menu';          // menu | play | paused | over
  let S = null;
  let timeScale = 1;          // sólo para pruebas automáticas
  const keys = { left: false, right: false, hold: 0 };
  let pointerA = null;        // ángulo objetivo del puntero/dedo

  function newGame(demo) {
    S = {
      demo, t: 0, score: 0, lives: 3, fuel: 100, beamA: -Math.PI / 2, beamL: R * 1.05, dps: 1,
      enemies: [], flies: [], parts: [], floats: [],
      spawnT: 1.2, flyT: 2.5, combo: 0, comboT: 0, mult: 1, maxMult: 1,
      flashCd: 0, flashT: 0, invul: 0, shake: 0, hurtT: 0,
      hour: 1, banner: demo ? null : { text: 'Hora 1', sub: 'Protege la llama', t: 2.6 },
      kills: 0, caught: 0, lowBeepT: 0, overT: 0,
    };
    pointerA = null;
    Snd.quiet = demo;
  }

  function pickType(t) {
    const r = Math.random();
    const pw = t > 15 ? Math.min(0.30, 0.10 + t / 400) : 0;
    const pc = t > 40 ? Math.min(0.16, 0.05 + (t - 40) / 900) : 0;
    const ps = t > 70 ? Math.min(0.22, 0.07 + (t - 70) / 600) : 0;
    if (r < pc) return 'coloso';
    if (r < pc + ps) return 'espiral';
    if (r < pc + ps + pw) return 'brizna';
    return 'sombra';
  }

  function spawnEnemy(type, a, d, age) {
    const s = S;
    type = type || pickType(s.t);
    if (a === undefined) {
      a = Math.random() * TAU;
      // con el tiempo, algunas sombras atacan por la espalda del haz
      if (!s.demo && s.t > 30 && Math.random() < 0.3) a = s.beamA + Math.PI + rand(-0.9, 0.9);
    }
    const T = TYPES[type];
    const spd = s.demo ? 0.8 : Math.min(2.0, 1 + s.t / 160);
    s.enemies.push({
      type, a, d: d || R + 50, r: T.r, hp: T.hp, maxhp: T.hp,
      v: T.v * spd * rand(0.9, 1.12), w: (T.w || 0) * (Math.random() < 0.5 ? -1 : 1),
      val: T.val, age: age || 0, lit: 0, seed: Math.random() * 100, dead: false,
    });
  }

  function spawnFly() {
    S.flies.push({ a: Math.random() * TAU, d: R + 40, vd: -48, age: 0, seed: rand(0, 100), scared: 0, dead: false });
  }

  function emit(x, y, vx, vy, life, size, kind) {
    const p = S.parts;
    if (p.length >= MAX_PARTS) return;
    p.push({ x, y, vx, vy, life, max: life, size, kind });
  }

  function burst(x, y, n, speed, kind, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.3 + Math.random());
      emit(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.4, 0.9), size * rand(0.6, 1.3), kind);
    }
  }

  function addFloat(x, y, text, color) { S.floats.push({ x, y, text, color, t: 0 }); }

  // ---------------------------------------------------------------- Acciones de juego
  function killEnemy(e) {
    const s = S;
    e.dead = true;
    const x = Math.cos(e.a) * e.d, y = Math.sin(e.a) * e.d;
    burst(x, y, 10 + e.r * 0.6, 60 + e.r * 3, 0, 14);
    burst(x, y, 6 + e.r * 0.3, 40, 2, 18);
    if (!s.demo) {
      s.combo = s.comboT > 0 ? s.combo + 1 : 1;
      s.comboT = 2.2;
      s.mult = Math.min(5, 1 + Math.floor(s.combo / 5));
      s.maxMult = Math.max(s.maxMult, s.mult);
      const pts = e.val * s.mult;
      s.score += pts; s.kills++;
      addFloat(x, y - e.r, '+' + pts, s.mult > 1 ? '#ffd27a' : '#f3e6c8');
    }
    if (e.type === 'coloso') {
      spawnEnemy('brizna', e.a - 0.12, e.d + 12, 0.6);
      spawnEnemy('brizna', e.a + 0.12, e.d + 12, 0.6);
    }
    Snd.kill(e.type, s.combo);
  }

  function hitLantern(e) {
    const s = S;
    e.dead = true;
    const x = Math.cos(e.a) * e.d, y = Math.sin(e.a) * e.d;
    burst(x, y, 18, 90, 3, 16);
    if (s.demo || s.invul > 0) return;
    s.lives--; s.invul = 1.3; s.shake = 14; s.hurtT = 0.6;
    s.combo = 0; s.mult = 1; s.comboT = 0;
    for (const o of s.enemies) if (o.d < 140) o.d += 55;   // la llama sopla y da un respiro
    Snd.hit();
    if (s.lives <= 0) gameOver();
  }

  function collectFly(f) {
    const s = S;
    f.dead = true;
    if (s.demo) return;
    s.fuel = Math.min(100, s.fuel + 24);
    s.score += 25; s.caught++;
    burst(Math.cos(f.a) * f.d, Math.sin(f.a) * f.d, 16, 70, 1, 14);
    addFloat(0, -LANTERN_R - 30, '+combustible', '#c8ff6a');
    Snd.fly();
  }

  function flash() {
    const s = S;
    if (mode !== 'play') return;
    if (s.flashCd > 0 || s.fuel < 20) { Snd.denied(); return; }
    s.fuel -= 20; s.flashCd = 4; s.flashT = 0.45; s.shake = Math.max(s.shake, 6);
    for (const e of s.enemies) {
      if (e.d < R * 0.65) { e.hp -= 1.0; e.d += 60; e.lit = 1; }
    }
    burst(0, 0, 40, 260, 0, 16);
    Snd.flash();
  }

  // ---------------------------------------------------------------- Actualización
  function rotateTo(target, speed, dt) {
    const d = angDiff(target, S.beamA), m = speed * dt;
    S.beamA += Math.abs(d) < m ? d : Math.sign(d) * m;
  }

  function aim(dt) {
    const s = S;
    if (s.demo) {
      let bestE = null;
      for (const e of s.enemies) if (e.age > 0.5 && (!bestE || e.d < bestE.d)) bestE = e;
      rotateTo(bestE ? bestE.a : s.beamA + 0.6, 2.6, dt);
    } else {
      const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (dir) {
        keys.hold += dt;
        s.beamA += dir * (2.6 + Math.min(1, keys.hold / 0.35) * 2.2) * dt;
      } else {
        keys.hold = 0;
        if (pointerA !== null) rotateTo(pointerA, 11, dt);
      }
    }
    s.beamA = ((s.beamA % TAU) + TAU) % TAU;
  }

  function updateParts(dt) {
    const p = S.parts;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      q.life -= dt;
      if (q.life <= 0) { p[i] = p[p.length - 1]; p.pop(); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      const drag = 1 - 2.2 * dt;
      q.vx *= drag; q.vy *= drag;
      if (q.kind === 0) q.vy -= 20 * dt;
    }
    const fl = S.floats;
    for (let i = fl.length - 1; i >= 0; i--) {
      fl[i].t += dt; fl[i].y -= 28 * dt;
      if (fl[i].t > 1) fl.splice(i, 1);
    }
  }

  function update(dt) {
    const s = S;
    updateParts(dt);
    s.shake = Math.max(0, s.shake - dt * 30);
    s.hurtT = Math.max(0, s.hurtT - dt);
    s.flashT = Math.max(0, s.flashT - dt);
    if (s.banner) { s.banner.t -= dt; if (s.banner.t <= 0) s.banner = null; }

    if (mode === 'over') {
      s.overT += dt;
      for (const e of s.enemies) { e.age += dt; e.lit = 0; }
      if (Math.random() < dt * 12) emit(rand(-6, 6), -LANTERN_R, rand(-8, 8), rand(-40, -20), 1.2, 22, 2);
      Snd.sizzle(0);
      return;
    }

    s.t += dt;
    aim(dt);
    s.invul = Math.max(0, s.invul - dt);
    s.flashCd = Math.max(0, s.flashCd - dt);
    if (s.comboT > 0) { s.comboT -= dt; if (s.comboT <= 0) { s.combo = 0; s.mult = 1; } }

    // combustible
    if (!s.demo) s.fuel = Math.max(0, s.fuel - Math.min(4, 1.8 + s.t / 200) * dt);
    const f = s.fuel / 100;
    const targetL = R * (0.32 + 0.73 * Math.min(1, f * 1.25));
    s.beamL += (targetL - s.beamL) * Math.min(1, dt * 4);
    s.dps = s.fuel > 0 ? 1.0 : 0.55;
    if (!s.demo && s.fuel < 20) {
      s.lowBeepT -= dt;
      if (s.lowBeepT <= 0) { Snd.low(); s.lowBeepT = s.fuel < 8 ? 0.45 : 0.9; }
    }

    // horas: la dificultad sube en oleadas
    const hourNow = 1 + Math.floor(s.t / 30);
    if (!s.demo && hourNow > s.hour) {
      s.hour = hourNow;
      const bonus = 100 * (s.hour - 1);
      s.score += bonus;
      s.banner = { text: 'Hora ' + s.hour, sub: '+' + bonus + ' · la noche se espesa', t: 2.6 };
      const base = Math.random() * TAU, n = 3 + s.hour;
      for (let i = 0; i < n; i++) spawnEnemy('sombra', base + (i - n / 2) * 0.16, R + 50 + rand(0, 80));
      Snd.hour();
    }

    // aparición
    s.spawnT -= dt;
    if (s.spawnT <= 0) {
      spawnEnemy();
      s.spawnT = (s.demo ? 2.0 : Math.max(0.3, 1.6 / (1 + s.t / 45))) * rand(0.7, 1.3);
    }
    s.flyT -= dt;
    if (s.flyT <= 0) {
      spawnFly();
      s.flyT = rand(4, 6.5) * (s.fuel < 30 ? 0.7 : 1);
    }

    // sombras
    let litCount = 0;
    const hw = BEAM_HW;
    for (const e of s.enemies) {
      if (e.dead) continue;
      e.age += dt;
      const tol = hw + Math.asin(Math.min(1, e.r / Math.max(e.d, 1)));
      const inBeam = e.age > 0.15 && e.d - e.r < s.beamL && Math.abs(angDiff(e.a, s.beamA)) < tol;
      if (inBeam) {
        e.hp -= s.dps * dt;
        e.lit = Math.min(1, e.lit + dt * 8);
        litCount++;
        if (Math.random() < dt * 28) {
          const x = Math.cos(e.a) * e.d, y = Math.sin(e.a) * e.d;
          emit(x + rand(-e.r, e.r) * 0.6, y + rand(-e.r, e.r) * 0.6, rand(-15, 15), rand(-50, -20), 0.6, 10, 0);
        }
      } else {
        e.lit = Math.max(0, e.lit - dt * 3);
      }
      const slow = inBeam ? 0.3 : 1;
      e.d -= e.v * slow * dt;
      const wScale = Math.min(1, 150 / Math.max(e.d, 1));
      e.a += (e.w * wScale * slow + Math.sin(e.age * 1.6 + e.seed) * 0.08) * dt;
      if (e.hp <= 0) { killEnemy(e); continue; }
      if (e.d < LANTERN_R + e.r * 0.5) hitLantern(e);
      if (mode !== 'play' && !s.demo) break;
    }
    s.enemies = s.enemies.filter((e) => !e.dead);
    Snd.sizzle(litCount * 0.4);

    // luciérnagas
    for (const fl of s.flies) {
      fl.age += dt;
      const inBeam = fl.d < s.beamL && Math.abs(angDiff(fl.a, s.beamA)) < hw + 0.05;
      if (inBeam) {
        fl.vd = Math.min(150, fl.vd + 420 * dt);
        if (fl.scared < 0.5 && Math.random() < 0.5) emit(Math.cos(fl.a) * fl.d, Math.sin(fl.a) * fl.d, 0, 0, 0.5, 18, 1);
        fl.scared = 1;
      } else {
        fl.vd += (-48 - fl.vd) * Math.min(1, dt * 1.5);
        fl.scared = Math.max(0, fl.scared - dt * 2);
      }
      fl.d += fl.vd * dt;
      fl.a += Math.sin(fl.age * 1.3 + fl.seed) * 0.35 * Math.min(1, 150 / Math.max(fl.d, 1)) * dt;
      if (fl.d < LANTERN_R + 6) collectFly(fl);
      else if (fl.d > R + 90 && fl.vd > 0) { fl.dead = true; if (!s.demo) Snd.flyLost(); }
    }
    s.flies = s.flies.filter((fl) => !fl.dead);
    if (s.demo) s.fuel = 100;
  }

  // ---------------------------------------------------------------- Dibujo
  let now = 0;

  function wedge(L, a, hw) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, L, a - hw, a + hw); ctx.closePath(); ctx.fill();
  }

  function drawBeam() {
    const s = S, L = s.beamL, a = s.beamA;
    let alpha = 1;
    if (s.fuel < 15 && !s.demo) alpha = 0.55 + 0.45 * Math.random();
    else if (s.fuel <= 0) alpha = 0.5;
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(0, 0, LANTERN_R * 0.5, 0, 0, L);
    g.addColorStop(0, 'rgba(255,228,160,.55)');
    g.addColorStop(0.55, 'rgba(255,200,120,.2)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = alpha * 0.4; wedge(L * 1.04, a, BEAM_HW * 1.25);
    ctx.globalAlpha = alpha; wedge(L, a, BEAM_HW);
    ctx.globalAlpha = alpha * 0.8; wedge(L * 0.92, a, BEAM_HW * 0.4);
    ctx.globalAlpha = 1;
  }

  function drawEnemy(e) {
    const T = TYPES[e.type];
    const x = Math.cos(e.a) * e.d, y = Math.sin(e.a) * e.d;
    const fade = mode === 'over' ? Math.max(0, 1 - S.overT * 0.6) : Math.min(1, e.age / 0.6);
    if (fade <= 0) return;
    const k = 0.55 + 0.45 * Math.max(0, e.hp) / e.maxhp;
    const r = e.r * k;
    ctx.globalAlpha = fade;
    // cuerpo ondulante
    const N = 9;
    const px = [], py = [];
    for (let i = 0; i < N; i++) {
      const an = i / N * TAU + e.age * 0.6;
      const rr = r * (1 + 0.17 * Math.sin(e.age * 6 + i * 2.1 + e.seed));
      px.push(x + Math.cos(an) * rr); py.push(y + Math.sin(an) * rr);
    }
    ctx.beginPath();
    ctx.moveTo((px[N - 1] + px[0]) / 2, (py[N - 1] + py[0]) / 2);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      ctx.quadraticCurveTo(px[i], py[i], (px[i] + px[j]) / 2, (py[i] + py[j]) / 2);
    }
    ctx.closePath();
    ctx.fillStyle = '#05040b';
    ctx.fill();
    ctx.lineWidth = 2.4;
    if (e.lit > 0.05) {
      ctx.strokeStyle = `rgba(255,${(150 + 70 * e.lit) | 0},80,${0.35 + 0.65 * e.lit})`;
    } else {
      ctx.strokeStyle = `rgba(${T.rim},0.5)`;
    }
    ctx.stroke();
    // ojos, mirando al farol
    const da = e.a + Math.PI;
    const cx = x + Math.cos(da) * r * 0.32, cy = y + Math.sin(da) * r * 0.32;
    const ox = -Math.sin(da) * r * 0.34, oy = Math.cos(da) * r * 0.34;
    const ew = r * 0.17, eh = r * (e.lit > 0.3 ? 0.06 : 0.2);
    ctx.fillStyle = e.lit > 0.3 ? '#ffe6b0' : T.eye;
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + oy, ew, eh, da + Math.PI / 2, 0, TAU);
    ctx.ellipse(cx - ox, cy - oy, ew, eh, da + Math.PI / 2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawFlame(x, y, h, w) {
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.quadraticCurveTo(x + w, y - h * 0.35, x + w * 0.7, y);
    ctx.quadraticCurveTo(x, y + w * 0.6, x - w * 0.7, y);
    ctx.quadraticCurveTo(x - w, y - h * 0.35, x, y - h);
    ctx.fill();
  }

  function drawLantern() {
    const s = S, f = s.fuel / 100;
    const alive = mode !== 'over';
    // base
    ctx.fillStyle = '#1a1e2f';
    ctx.beginPath(); ctx.arc(0, 0, LANTERN_R, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#3a3550'; ctx.stroke();
    ctx.fillStyle = '#2a2640';
    ctx.beginPath(); ctx.arc(0, 0, LANTERN_R * 0.62, 0, TAU); ctx.fill();
    // anillo de combustible
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(0, 0, LANTERN_R + 10, 0, TAU); ctx.stroke();
    if (alive && f > 0) {
      const low = f < 0.25;
      ctx.strokeStyle = low ? `rgba(255,${(80 + 60 * Math.sin(now * 0.02)) | 0},70,1)` : '#ffb347';
      ctx.beginPath(); ctx.arc(0, 0, LANTERN_R + 10, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke();
    }
    // invulnerable: anillo que parpadea
    if (s.invul > 0 && Math.floor(now / 90) % 2 === 0) {
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,120,120,.8)';
      ctx.beginPath(); ctx.arc(0, 0, LANTERN_R + 18, 0, TAU); ctx.stroke();
    }
    // llama
    if (alive) {
      const fl = 1 + Math.sin(now * 0.017) * 0.08 + Math.sin(now * 0.043) * 0.05;
      const h = (16 + 10 * f) * fl, w = 8 + 3 * f;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(sprHalo, -40, -50, 80, 80);
      ctx.fillStyle = '#ff9a3c'; drawFlame(0, 6, h, w);
      ctx.fillStyle = '#ffe9a8'; drawFlame(0, 5, h * 0.6, w * 0.55);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.fillStyle = '#3b3346';
      ctx.fillRect(-1.5, -6, 3, 8);
    }
  }

  function drawFlameIcon(x, y, size, on) {
    if (on) {
      ctx.fillStyle = '#ff9a3c'; drawFlame(x, y, size, size * 0.45);
      ctx.fillStyle = '#ffe9a8'; drawFlame(x, y - 1, size * 0.55, size * 0.25);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.12)'; drawFlame(x, y, size, size * 0.45);
    }
  }

  function drawHud() {
    const s = S;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // daño: viñeta roja
    if (s.hurtT > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2);
      g.addColorStop(0, 'rgba(255,0,40,0)');
      g.addColorStop(1, `rgba(255,20,60,${s.hurtT * 0.7})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (s.flashT > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,240,200,${s.flashT * 0.5})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (mode === 'menu' || s.demo) return;

    const pad = 16;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillStyle = '#ffe2a8';
    ctx.shadowColor = 'rgba(255,160,60,.6)'; ctx.shadowBlur = 12;
    ctx.fillText(String(Math.floor(s.score)), pad, pad + 26);
    ctx.shadowBlur = 0;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,226,168,.55)';
    ctx.fillText('RÉCORD ' + Math.max(best, Math.floor(s.score)), pad, pad + 44);

    // vidas (llamas)
    for (let i = 0; i < 3; i++) drawFlameIcon(W - pad - 10 - i * 26, pad + 26, 22, i < s.lives);

    // hora y multiplicador
    ctx.textAlign = 'center';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(200,190,255,.75)';
    ctx.fillText('HORA ' + s.hour, W / 2, pad + 12);
    if (s.mult > 1) {
      ctx.font = '800 26px system-ui, sans-serif';
      ctx.fillStyle = ['#fff', '#fff', '#ffd27a', '#ffb347', '#ff8a4a', '#ff5a7a'][s.mult];
      ctx.fillText('x' + s.mult, W / 2, pad + 40);
      ctx.fillStyle = 'rgba(255,200,120,.5)';
      ctx.fillRect(W / 2 - 22, pad + 46, 44 * (s.comboT / 2.2), 3);
    } else if (s.combo > 1) {
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,226,168,.6)';
      ctx.fillText('combo ' + s.combo, W / 2, pad + 32);
    }

    // estado del destello (sólo teclado/ratón)
    if (mode === 'play' && !body.classList.contains('tactil')) {
      const ready = s.flashCd <= 0 && s.fuel >= 20;
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = ready ? 'rgba(255,226,168,.75)' : 'rgba(255,226,168,.3)';
      ctx.fillText(ready ? 'ESPACIO · DESTELLO LISTO' : (s.fuel < 20 && s.flashCd <= 0 ? 'DESTELLO · FALTA COMBUSTIBLE' : 'DESTELLO RECARGANDO'), W / 2, H - 20);
      if (s.flashCd > 0) {
        ctx.fillStyle = 'rgba(255,200,120,.35)';
        ctx.fillRect(W / 2 - 50, H - 12, 100 * (1 - s.flashCd / 4), 3);
      }
    }

    // cartel de hora
    if (s.banner) {
      const b = s.banner, a = Math.min(1, b.t / 0.5, (2.6 - b.t) / 0.3);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = '800 34px system-ui, sans-serif';
      ctx.fillStyle = '#ffe2a8';
      ctx.shadowColor = 'rgba(255,160,60,.8)'; ctx.shadowBlur = 18;
      ctx.fillText(b.text, W / 2, CY - R * K * 0.42);
      ctx.shadowBlur = 0;
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(230,220,255,.85)';
      ctx.fillText(b.sub, W / 2, CY - R * K * 0.42 + 24);
      ctx.globalAlpha = 1;
    }
  }

  function render() {
    const s = S;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    const sx = s.shake ? rand(-1, 1) * s.shake : 0, sy = s.shake ? rand(-1, 1) * s.shake : 0;
    ctx.drawImage(bg, sx * DPR, sy * DPR);
    ctx.setTransform(DPR * K, 0, 0, DPR * K, DPR * (CX + sx), DPR * (CY + sy));

    const alive = mode !== 'over';
    const f = s.fuel / 100;
    ctx.globalCompositeOperation = 'lighter';
    // halo del farol
    const flick = 1 + Math.sin(now * 0.013) * 0.04 + Math.sin(now * 0.031) * 0.03;
    const haloR = (alive ? 80 + 70 * f : Math.max(0, 60 - s.overT * 40)) * flick;
    if (haloR > 1) ctx.drawImage(sprHalo, -haloR, -haloR, haloR * 2, haloR * 2);
    if (alive) drawBeam();
    // onda del destello
    if (s.flashT > 0) {
      const p = 1 - s.flashT / 0.45;
      ctx.strokeStyle = `rgba(255,235,180,${s.flashT * 1.8})`;
      ctx.lineWidth = 14 * (1 - p) + 2;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.65 * p + 20, 0, TAU); ctx.stroke();
    }
    // luciérnagas
    for (const fl of s.flies) {
      const x = Math.cos(fl.a) * fl.d, y = Math.sin(fl.a) * fl.d;
      const tw = 0.7 + 0.3 * Math.sin(fl.age * 9 + fl.seed);
      ctx.globalAlpha = Math.min(1, fl.age * 2) * tw;
      const sz = fl.scared > 0.2 ? 62 : 48;
      ctx.drawImage(sprFly, x - sz / 2, y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#f6ffd8';
    for (const fl of s.flies) {
      ctx.beginPath(); ctx.arc(Math.cos(fl.a) * fl.d, Math.sin(fl.a) * fl.d, 2.6, 0, TAU); ctx.fill();
    }
    // alas de las luciérnagas
    ctx.fillStyle = 'rgba(230,255,200,.35)';
    for (const fl of s.flies) {
      const x = Math.cos(fl.a) * fl.d, y = Math.sin(fl.a) * fl.d;
      const flap = 3 + 2 * Math.sin(fl.age * 40);
      ctx.beginPath();
      ctx.ellipse(x - 3, y - 2, flap, 2, -0.5, 0, TAU);
      ctx.ellipse(x + 3, y - 2, flap, 2, 0.5, 0, TAU);
      ctx.fill();
    }

    for (const e of s.enemies) drawEnemy(e);
    drawLantern();

    // partículas
    ctx.globalCompositeOperation = 'lighter';
    for (const q of s.parts) {
      ctx.globalAlpha = q.life / q.max;
      const sz = q.size;
      ctx.drawImage(PART_SPR[q.kind], q.x - sz / 2, q.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // textos flotantes
    if (s.floats.length) {
      ctx.textAlign = 'center';
      ctx.font = '800 18px system-ui, sans-serif';
      for (const t of s.floats) {
        ctx.globalAlpha = 1 - t.t;
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }
    drawHud();
  }

  // ---------------------------------------------------------------- Flujo de pantallas
  const ui = {
    menu: $('menu'), pausa: $('pausa'), fin: $('fin'),
    flashBtn: $('btnDestello'), sndBtn: $('btnSonido'), pauseBtn: $('btnPausa'),
  };
  let canRestart = false;
  let overTimer = 0;

  function show(el, on) { el.hidden = !on; }

  function refreshMenuRecord() {
    $('recordMenu').textContent = best > 0 ? 'Récord: ' + best : '';
  }

  function startGame() {
    if (mode === 'play') return;
    Snd.init();
    clearTimeout(overTimer);
    newGame(false);
    mode = 'play';
    show(ui.menu, false); show(ui.fin, false); show(ui.pausa, false);
    body.classList.add('jugando');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    Snd.start();
  }

  function gameOver() {
    mode = 'over';
    S.overT = 0;
    body.classList.remove('jugando');
    const score = Math.floor(S.score);
    const isNew = score > best;
    if (isNew) { best = score; saveBest(); }
    Snd.sizzle(0);
    Snd.over();
    canRestart = false;
    overTimer = setTimeout(() => {
      $('finPuntos').textContent = score;
      $('finRecord').innerHTML = isNew && score > 0 ? '<span class="nuevo">¡NUEVO RÉCORD!</span>' : 'Récord: ' + best;
      $('stSombras').textContent = S.kills;
      $('stLuci').textContent = S.caught;
      const secs = Math.floor(S.t);
      $('stTiempo').textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
      $('stHora').textContent = S.hour;
      show(ui.fin, true);
      setTimeout(() => { canRestart = true; $('btnOtra').focus({ preventScroll: true }); }, 350);
    }, 1300);
  }

  function pause() {
    if (mode !== 'play') return;
    mode = 'paused';
    keys.left = keys.right = false;
    Snd.sizzle(0);
    show(ui.pausa, true);
  }

  function resume() {
    if (mode !== 'paused') return;
    mode = 'play';
    show(ui.pausa, false);
    last = performance.now();
    Snd.init();
  }

  function toggleMute() {
    Snd.init();
    Snd.setMuted(!Snd.muted);
    $('icoSonido').setAttribute('d', Snd.muted
      ? 'M3 9v6h4l5 5V4L7 9H3zm13.6 3l2.7-2.7-1.2-1.2-2.7 2.7-2.7-2.7-1.2 1.2 2.7 2.7-2.7 2.7 1.2 1.2 2.7-2.7 2.7 2.7 1.2-1.2z'
      : 'M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z');
  }

  $('btnJugar').addEventListener('click', startGame);
  $('btnOtra').addEventListener('click', () => { if (canRestart) startGame(); });
  $('btnSeguir').addEventListener('click', resume);
  ui.pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); mode === 'paused' ? resume() : pause(); });
  ui.sndBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMute(); });
  ui.flashBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Snd.init(); flash(); });

  // ---------------------------------------------------------------- Entrada: teclado
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown' || k === ' ' || k === 'Enter') e.preventDefault();
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; pointerA = null; }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; pointerA = null; }
    else if (k === ' ' || k === 'Enter') {
      if (e.repeat) return;
      Snd.init();
      if (mode === 'menu') startGame();
      else if (mode === 'over') { if (canRestart) startGame(); }
      else if (mode === 'paused') resume();
      else if (mode === 'play' && k === ' ') flash();
    } else if (k === 'p' || k === 'P' || k === 'Escape') {
      if (mode === 'play') pause(); else if (mode === 'paused') resume();
    } else if (k === 'm' || k === 'M') toggleMute();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
  });

  // ---------------------------------------------------------------- Entrada: ratón y táctil
  const touches = new Set();
  let aimPointer = null;
  function aimFrom(e) {
    const x = e.clientX - CX, y = e.clientY - CY;
    if (x * x + y * y < 4) return;
    pointerA = Math.atan2(y, x);
  }
  cvs.addEventListener('pointerdown', (e) => {
    Snd.init();
    if (e.pointerType !== 'mouse') {
      body.classList.add('tactil');
      touches.add(e.pointerId);
      if (mode !== 'play') return;
      if (touches.size >= 2) { flash(); return; }   // segundo dedo = destello
      aimPointer = e.pointerId;
      aimFrom(e);
      try { cvs.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    } else {
      body.classList.remove('tactil');
      if (mode !== 'play') return;
      aimFrom(e);
      if (e.button === 0) flash();
    }
  });
  cvs.addEventListener('pointermove', (e) => {
    if (mode !== 'play') return;
    if (e.pointerType === 'mouse') aimFrom(e);
    else if (e.pointerId === aimPointer) aimFrom(e);
  });
  const endPointer = (e) => { touches.delete(e.pointerId); if (e.pointerId === aimPointer) aimPointer = null; };
  cvs.addEventListener('pointerup', endPointer);
  cvs.addEventListener('pointercancel', endPointer);
  cvs.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) body.classList.add('tactil');

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', () => { keys.left = keys.right = false; pause(); });
  window.addEventListener('resize', resize);

  // ---------------------------------------------------------------- Bucle principal
  let last = performance.now();
  let flashBtnState = null;
  function frame(t) {
    now = t;
    let dt = (t - last) / 1000;
    last = t;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    if (mode !== 'paused') {
      const steps = timeScale > 1 ? Math.round(timeScale) : 1;
      for (let i = 0; i < steps; i++) update(dt);
    }
    render();
    // estado visual del botón táctil (sólo se toca el DOM cuando cambia)
    const ready = mode === 'play' && S.flashCd <= 0 && S.fuel >= 20;
    if (ready !== flashBtnState) { flashBtnState = ready; ui.flashBtn.classList.toggle('cargando', !ready); }
    requestAnimationFrame(frame);
  }

  resize();
  newGame(true);
  refreshMenuRecord();
  requestAnimationFrame(frame);

  // Gancho de sólo lectura para pruebas automáticas
  window.__farol = {
    get mode() { return mode; },
    get state() { return S; },
    get view() { return { W, H, K, CX, CY }; },
    set timeScale(v) { timeScale = v; },
  };
})();
