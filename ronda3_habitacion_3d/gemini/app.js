/**
 * Estancia 3D Interactiva — Salón y Estudio
 * Creado desde cero con Three.js local: geometrías, materiales, texturas procedurales,
 * iluminación natural + 4 lámparas interactivas, controles primera persona (PC + Móvil)
 * y motor de colisiones AABB con deslizamiento lateral.
 */
(function () {
  'use strict';

  // Dimensiones de la habitación (en metros)
  const ROOM = {
    width: 8.0,   // X: -4.0 a +4.0
    depth: 7.0,   // Z: -3.5 a +3.5
    height: 3.2,  // Y:  0.0 a +3.2
    halfW: 4.0,
    halfD: 3.5
  };

  // Parámetros del jugador en primera persona
  const PLAYER = {
    eyeHeight: 1.66,
    radius: 0.36,
    moveSpeed: 3.1,
    lookSensitivityMouse: 0.0022,
    lookSensitivityTouch: 0.0042,
    maxPitch: Math.PI * 0.44
  };

  // Estado global exportable para inspección y pruebas automatizadas
  const state = {
    x: 0.0,
    y: PLAYER.eyeHeight,
    z: 1.85,
    yaw: 0.12,   // Mirando ligeramente hacia el salón/ventana
    pitch: -0.04,
    walkTime: 0,
    isPointerLocked: false,
    isDraggingMouse: false,
    mouseDragMoved: false,
    lastMouseX: 0,
    lastMouseY: 0,
    keys: {
      forward: false,
      backward: false,
      left: false,
      right: false
    },
    joystick: {
      active: false,
      touchId: null,
      originX: 0,
      originY: 0,
      dx: 0, // -1 a 1
      dy: 0  // -1 a 1
    },
    touchLook: {
      active: false,
      touchId: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      moved: false
    },
    hoveredLamp: null,
    lamps: [],
    furnitureCatalog: [],
    colliders: [],
    textures: {}
  };

  // ============================================================================
  // 1. GENERADOR DE TEXTURAS PROCEDURALES (100% CÓDIGO CON CANVAS 2D)
  // ============================================================================

  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  /**
   * Textura de parquet de madera cálida en tablones con vetas y juntas
   */
  function createParquetTextures() {
    const w = 512, h = 512;
    const colorCanvas = createCanvas(w, h);
    const ctx = colorCanvas.getContext('2d');

    const bumpCanvas = createCanvas(w, h);
    const bctx = bumpCanvas.getContext('2d');

    ctx.fillStyle = '#8d5b36';
    ctx.fillRect(0, 0, w, h);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, w, h);

    const rows = 8;
    const cols = 2;
    const plankH = h / rows;
    const plankW = w / cols;

    // Semilla determinista para colores consistentes
    let seed = 42;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (plankW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const px = c * plankW + offset;
        const py = r * plankH;

        const toneShift = Math.floor((rand() - 0.5) * 24);
        const R = Math.min(255, Math.max(0, 148 + toneShift));
        const G = Math.min(255, Math.max(0, 98 + Math.floor(toneShift * 0.7)));
        const B = Math.min(255, Math.max(0, 58 + Math.floor(toneShift * 0.5)));

        ctx.fillStyle = `rgb(${R},${G},${B})`;
        ctx.fillRect(px + 1, py + 1, plankW - 2, plankH - 2);

        // Vetas longitudinales dentro del tablón
        for (let i = 0; i < 18; i++) {
          const vy = py + 3 + rand() * (plankH - 6);
          const alpha = 0.05 + rand() * 0.08;
          ctx.strokeStyle = rand() > 0.5 ? `rgba(60,32,14,${alpha})` : `rgba(210,160,110,${alpha * 0.7})`;
          ctx.lineWidth = 1 + rand() * 1.5;
          ctx.beginPath();
          ctx.moveTo(px + 2, vy);
          ctx.bezierCurveTo(
            px + plankW * 0.33, vy + (rand() - 0.5) * 4,
            px + plankW * 0.66, vy + (rand() - 0.5) * 4,
            px + plankW - 2, vy
          );
          ctx.stroke();

          bctx.strokeStyle = `rgba(100,100,100,${alpha})`;
          bctx.lineWidth = 1;
          bctx.beginPath();
          bctx.moveTo(px + 2, vy);
          bctx.lineTo(px + plankW - 2, vy);
          bctx.stroke();
        }

        // Juntas oscuras entre tablones
        ctx.strokeStyle = '#3d2310';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, plankW, plankH);

        bctx.strokeStyle = '#202020';
        bctx.lineWidth = 2.5;
        bctx.strokeRect(px, py, plankW, plankH);
      }
    }

    const map = new THREE.CanvasTexture(colorCanvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(4.5, 4.0);

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.set(4.5, 4.0);

    return { map, bumpMap };
  }

  /**
   * Textura de estuco suave cálido para las paredes
   */
  function createWallTexture() {
    const w = 256, h = 256;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ede6d8';
    ctx.fillRect(0, 0, w, h);

    let seed = 101;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    for (let i = 0; i < 2400; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const shade = rand() > 0.5 ? 'rgba(255,252,245,0.22)' : 'rgba(195,182,162,0.18)';
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    return tex;
  }

  /**
   * Textura de vetas de madera para muebles (nogal oscuro o roble natural)
   */
  function createWoodTexture(baseColor, grainColor, repeatX = 1, repeatY = 1) {
    const w = 256, h = 256;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, w, h);

    let seed = baseColor.charCodeAt(1) * 37 + 19;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    ctx.strokeStyle = grainColor;
    for (let i = 0; i < 95; i++) {
      const y = rand() * h;
      ctx.globalAlpha = 0.08 + rand() * 0.16;
      ctx.lineWidth = 0.8 + rand() * 2.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        w * 0.3, y + (rand() - 0.5) * 14,
        w * 0.7, y + (rand() - 0.5) * 14,
        w, y + (rand() - 0.5) * 6
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    return tex;
  }

  /**
   * Textura de tejido tapizado (espiga / lino) para el sofá y cojines
   */
  function createFabricTexture(baseHex, threadHex, repeat = 6) {
    const w = 128, h = 128;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = threadHex;
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        if ((x + y) % 8 === 0) {
          ctx.fillRect(x, y, 3, 1.5);
        } else {
          ctx.fillRect(x, y, 1.5, 3);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    return tex;
  }

  /**
   * Textura de alfombra tejida con motivos geométricos estilo nórdico/bereber
   */
  function createRugTexture() {
    const w = 512, h = 512;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    // Fondo crema lana tejida
    ctx.fillStyle = '#e5dccb';
    ctx.fillRect(0, 0, w, h);

    // Trama textil de fondo
    ctx.fillStyle = 'rgba(180, 166, 145, 0.28)';
    for (let y = 0; y < h; y += 4) {
      for (let x = (y % 8 === 0 ? 0 : 2); x < w; x += 4) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Marco exterior doble en tonos terracota y carbón
    ctx.strokeStyle = '#333740';
    ctx.lineWidth = 10;
    ctx.strokeRect(22, 22, w - 44, h - 44);

    ctx.strokeStyle = '#c86d51';
    ctx.lineWidth = 6;
    ctx.strokeRect(38, 38, w - 76, h - 76);

    // Rombos geométricos centrales
    const rows = 3;
    const cols = 3;
    const cellW = (w - 110) / cols;
    const cellH = (h - 110) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = 55 + cellW * (c + 0.5);
        const cy = 55 + cellH * (r + 0.5);
        const rx = cellW * 0.38;
        const ry = cellH * 0.38;

        ctx.strokeStyle = '#2f343d';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - ry);
        ctx.lineTo(cx + rx, cy);
        ctx.lineTo(cx, cy + ry);
        ctx.lineTo(cx - rx, cy);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = (r + c) % 2 === 0 ? '#c86d51' : '#d99b38';
        ctx.beginPath();
        ctx.moveTo(cx, cy - ry * 0.45);
        ctx.lineTo(cx + rx * 0.45, cy);
        ctx.lineTo(cx, cy + ry * 0.45);
        ctx.lineTo(cx - rx * 0.45, cy);
        ctx.closePath();
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  /**
   * Texturas pictóricas para los cuadros enmarcados
   */
  function createArtworkTexture(styleIndex) {
    const w = 256, h = 256;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    if (styleIndex === 1) {
      // Paisaje de atardecer minimalista con montañas y sol cálido
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#f4a261');
      grad.addColorStop(0.55, '#e76f51');
      grad.addColorStop(1, '#264653');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Sol
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(w * 0.62, h * 0.38, 42, 0, Math.PI * 2);
      ctx.fill();

      // Cordilleras
      const layers = [
        { color: '#6d597a', y0: 145, p1: 95, p2: 130 },
        { color: '#355070', y0: 175, p1: 135, p2: 115 },
        { color: '#1d2d44', y0: 210, p1: 180, p2: 190 }
      ];
      layers.forEach((l) => {
        ctx.fillStyle = l.color;
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, l.y0);
        ctx.lineTo(w * 0.35, l.p1);
        ctx.lineTo(w * 0.72, l.p2);
        ctx.lineTo(w, l.y0 - 10);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      });
    } else if (styleIndex === 2) {
      // Composición geométrica Bauhaus
      ctx.fillStyle = '#f2e9dc';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#d1495b';
      ctx.beginPath();
      ctx.arc(95, 105, 62, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#00798c';
      ctx.fillRect(110, 85, 105, 125);

      ctx.fillStyle = '#edae49';
      ctx.beginPath();
      ctx.moveTo(40, 220);
      ctx.lineTo(145, 220);
      ctx.lineTo(92, 130);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#1f2421';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(25, 45);
      ctx.lineTo(230, 210);
      ctx.stroke();
    } else {
      // Arte botánico abstracto
      ctx.fillStyle = '#e9e2d0';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#c97b63';
      ctx.beginPath();
      ctx.arc(128, 148, 70, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#2b4c3f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(128, 235);
      ctx.quadraticCurveTo(115, 140, 140, 35);
      ctx.stroke();

      const leafOffsets = [-50, -25, 0, 25, 45];
      leafOffsets.forEach((dy, idx) => {
        ctx.fillStyle = idx % 2 === 0 ? '#2b4c3f' : '#4a7c59';
        ctx.beginPath();
        ctx.ellipse(105, 125 + dy, 32, 13, -0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(152, 115 + dy, 32, 13, 0.45, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Textura de pantalla para el Televisor y el Ordenador Portátil
   */
  function createScreenTexture(mode) {
    const w = 512, h = 288;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    if (mode === 'tv') {
      // Paisaje nocturno relajante con aurora y lago reflejado
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0b132b');
      grad.addColorStop(0.5, '#1c2541');
      grad.addColorStop(0.75, '#3a506b');
      grad.addColorStop(1, '#1b263b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Aurora boreal suave
      const aurora = ctx.createLinearGradient(60, 20, 440, 140);
      aurora.addColorStop(0, 'rgba(6, 214, 160, 0.0)');
      aurora.addColorStop(0.5, 'rgba(6, 214, 160, 0.42)');
      aurora.addColorStop(1, 'rgba(17, 138, 178, 0.0)');
      ctx.fillStyle = aurora;
      ctx.beginPath();
      ctx.ellipse(256, 78, 210, 42, -0.08, 0, Math.PI * 2);
      ctx.fill();

      // Luna llena
      ctx.fillStyle = '#fefae0';
      ctx.beginPath();
      ctx.arc(380, 68, 22, 0, Math.PI * 2);
      ctx.fill();

      // Silueta de montañas junto al lago
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, 195);
      ctx.lineTo(95, 130);
      ctx.lineTo(190, 175);
      ctx.lineTo(310, 115);
      ctx.lineTo(430, 168);
      ctx.lineTo(w, 140);
      ctx.lineTo(w, 195);
      ctx.closePath();
      ctx.fill();

      // Reflejo de la luna en el agua
      ctx.fillStyle = 'rgba(254, 250, 224, 0.35)';
      for (let y = 202; y < 270; y += 6) {
        const rw = 28 - (y - 200) * 0.25;
        ctx.fillRect(380 - rw * 0.5, y, rw, 2.5);
      }
    } else {
      // Editor de código en la pantalla del portátil
      ctx.fillStyle = '#1e222a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#282c34';
      ctx.fillRect(0, 0, 90, h);

      const colors = ['#61afef', '#98c379', '#e5c07b', '#c678dd', '#e06c75'];
      for (let i = 0; i < 16; i++) {
        const y = 18 + i * 16;
        ctx.fillStyle = '#4b5263';
        ctx.fillRect(102, y, 14, 6);

        const indent = (i % 4) * 18;
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(128 + indent, y, 45 + ((i * 29) % 120), 7);

        ctx.fillStyle = colors[(i + 2) % colors.length];
        ctx.fillRect(280 + indent * 0.5, y, 35 + ((i * 17) % 80), 7);
      }
    }

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Esfera del reloj de pared con hora actualizable
   */
  function createClockTexture() {
    const w = 256, h = 256;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);

    function drawClock() {
      const cx = w / 2, cy = h / 2, r = 112;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#f8f5ee';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Marcas de las 12 horas
      for (let i = 0; i < 12; i++) {
        const ang = (i * Math.PI) / 6;
        const inner = i % 3 === 0 ? r - 20 : r - 12;
        ctx.strokeStyle = '#22262e';
        ctx.lineWidth = i % 3 === 0 ? 5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
        ctx.lineTo(cx + Math.cos(ang) * (r - 4), cy + Math.sin(ang) * (r - 4));
        ctx.stroke();
      }

      const now = new Date();
      const sec = now.getSeconds();
      const min = now.getMinutes() + sec / 60;
      const hr = (now.getHours() % 12) + min / 60;

      // Aguja horaria
      const hrAng = (hr * Math.PI) / 6 - Math.PI / 2;
      ctx.strokeStyle = '#1e2229';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(hrAng) * 58, cy + Math.sin(hrAng) * 58);
      ctx.stroke();

      // Aguja minutera
      const minAng = (min * Math.PI) / 30 - Math.PI / 2;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(minAng) * 82, cy + Math.sin(minAng) * 82);
      ctx.stroke();

      // Segundero
      const secAng = (sec * Math.PI) / 30 - Math.PI / 2;
      ctx.strokeStyle = '#d1495b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(secAng) * 88, cy + Math.sin(secAng) * 88);
      ctx.stroke();

      ctx.fillStyle = '#d1495b';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      tex.needsUpdate = true;
    }

    drawClock();
    return { texture: tex, update: drawClock };
  }

  // ============================================================================
  // 2. INICIALIZACIÓN DE ESCENA, CÁMARA Y RENDERIZADOR
  // ============================================================================

  const container = document.getElementById('canvas-container');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.FogExp2(0x232120, 0.015);

  const camera = new THREE.PerspectiveCamera(
    68,
    window.innerWidth / window.innerHeight,
    0.08,
    45
  );
  camera.rotation.order = 'YXZ';

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    if (container) {
      container.appendChild(renderer.domElement);
    }
  } catch (err) {
    // Fallback por si se ejecuta en un entorno headless sin GPU
    renderer = {
      domElement: document.createElement('canvas'),
      setSize: function () {},
      setPixelRatio: function () {},
      render: function () {},
      shadowMap: {}
    };
  }

  // Inicializar texturas procedurales y guardarlas en el estado
  const parquet = createParquetTextures();
  const wallTex = createWallTexture();
  const darkWalnutTex = createWoodTexture('#4a2e1b', '#26150a', 1, 1);
  const lightOakTex = createWoodTexture('#b88655', '#7a5229', 1, 1);
  const sofaFabricTex = createFabricTexture('#354f52', '#283d40', 8);
  const cushionMustardTex = createFabricTexture('#e09f3e', '#b87d24', 5);
  const cushionTerraTex = createFabricTexture('#c86d51', '#9c4e36', 5);
  const lampShadeTex = createFabricTexture('#f6ebd8', '#e2d2b5', 4);
  const rugTex = createRugTexture();
  const clockData = createClockTexture();

  state.textures = {
    parquetMap: parquet.map,
    parquetBump: parquet.bumpMap,
    wall: wallTex,
    darkWalnut: darkWalnutTex,
    lightOak: lightOakTex,
    sofaFabric: sofaFabricTex,
    cushionMustard: cushionMustardTex,
    cushionTerra: cushionTerraTex,
    lampShade: lampShadeTex,
    rug: rugTex,
    clock: clockData.texture
  };

  // Materiales reutilizables
  const mats = {
    floor: new THREE.MeshStandardMaterial({
      map: parquet.map,
      bumpMap: parquet.bumpMap,
      bumpScale: 0.012,
      roughness: 0.42,
      metalness: 0.05
    }),
    wall: new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.85,
      metalness: 0.0
    }),
    accentWall: new THREE.MeshStandardMaterial({
      map: wallTex,
      color: 0xd6cfc2,
      roughness: 0.85
    }),
    ceiling: new THREE.MeshStandardMaterial({
      color: 0xf7f5f0,
      roughness: 0.92
    }),
    baseboard: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5
    }),
    walnut: new THREE.MeshStandardMaterial({
      map: darkWalnutTex,
      roughness: 0.38,
      metalness: 0.06
    }),
    oak: new THREE.MeshStandardMaterial({
      map: lightOakTex,
      roughness: 0.44,
      metalness: 0.04
    }),
    blackMetal: new THREE.MeshStandardMaterial({
      color: 0x1e2229,
      roughness: 0.35,
      metalness: 0.78
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xd4a84f,
      roughness: 0.25,
      metalness: 0.85
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xd8dde6,
      roughness: 0.18,
      metalness: 0.9
    }),
    sofa: new THREE.MeshStandardMaterial({
      map: sofaFabricTex,
      bumpMap: sofaFabricTex,
      bumpScale: 0.008,
      roughness: 0.82
    }),
    mustardCushion: new THREE.MeshStandardMaterial({
      map: cushionMustardTex,
      roughness: 0.8
    }),
    terraCushion: new THREE.MeshStandardMaterial({
      map: cushionTerraTex,
      roughness: 0.8
    }),
    ceramicWhite: new THREE.MeshStandardMaterial({
      color: 0xf2efe9,
      roughness: 0.28,
      metalness: 0.05
    }),
    terracottaPot: new THREE.MeshStandardMaterial({
      color: 0xb55d3f,
      roughness: 0.68
    }),
    leafGreen: new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.42,
      side: THREE.DoubleSide
    }),
    leafLight: new THREE.MeshStandardMaterial({
      color: 0x40916c,
      roughness: 0.45,
      side: THREE.DoubleSide
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xd8f3dc,
      transparent: true,
      opacity: 0.28,
      roughness: 0.08,
      metalness: 0.15
    })
  };

  // Utilidad para activar sombras en mallas
  function enableShadows(mesh, cast = true, receive = true) {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }

  // Utilidad para registrar colisionadores AABB (Cajas 2D en plano XZ)
  function addCollider(id, name, minX, maxX, minZ, maxZ) {
    state.colliders.push({ id, name, minX, maxX, minZ, maxZ });
  }

  // Utilidad para registrar muebles modelados por código
  function registerFurniture(id, name, description, group) {
    scene.add(group);
    state.furnitureCatalog.push({ id, name, description, object3D: group });
    return group;
  }

  // ============================================================================
  // 3. ARQUITECTURA DE LA HABITACIÓN Y EXTERIOR SOLEADO
  // ============================================================================

  function buildRoomArchitecture() {
    const archGroup = new THREE.Group();
    archGroup.name = 'arquitectura_estancia';

    // Suelo de parquet
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
      mats.floor
    );
    floorMesh.rotation.x = -Math.PI / 2;
    enableShadows(floorMesh, false, true);
    archGroup.add(floorMesh);

    // Techo
    const ceilingMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
      mats.ceiling
    );
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.y = ROOM.height;
    enableShadows(ceilingMesh, false, true);
    archGroup.add(ceilingMesh);

    const wallThickness = 0.16;

    // Pared Norte / Frontal (z = -3.5)
    const northWall = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM.width + wallThickness * 2, ROOM.height, wallThickness),
      mats.accentWall
    );
    northWall.position.set(0, ROOM.height / 2, -ROOM.halfD - wallThickness / 2);
    enableShadows(northWall, true, true);
    archGroup.add(northWall);

    // Pared Sur / Trasera (z = +3.5)
    const southWall = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM.width + wallThickness * 2, ROOM.height, wallThickness),
      mats.wall
    );
    southWall.position.set(0, ROOM.height / 2, ROOM.halfD + wallThickness / 2);
    enableShadows(southWall, true, true);
    archGroup.add(southWall);

    // Pared Oeste / Izquierda (x = -4.0)
    const westWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, ROOM.height, ROOM.depth),
      mats.wall
    );
    westWall.position.set(-ROOM.halfW - wallThickness / 2, ROOM.height / 2, 0);
    enableShadows(westWall, true, true);
    archGroup.add(westWall);

    // Pared Este / Derecha (x = +4.0) con abertura real para el gran ventanal
    // El ventanal ocupa z de -1.65 a +1.65 (3.3m de ancho) y y de 0.65 a 2.65 (2.0m de alto)
    const eastX = ROOM.halfW + wallThickness / 2;
    // Muro inferior bajo la ventana (y: 0 a 0.65)
    const eastBottom = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, 0.65, 3.3),
      mats.wall
    );
    eastBottom.position.set(eastX, 0.325, 0);
    enableShadows(eastBottom, true, true);
    archGroup.add(eastBottom);

    // Dintel superior sobre la ventana (y: 2.65 a 3.2)
    const eastTop = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, 0.55, 3.3),
      mats.wall
    );
    eastTop.position.set(eastX, 2.65 + 0.275, 0);
    enableShadows(eastTop, true, true);
    archGroup.add(eastTop);

    // Tramo lateral norte de la pared este (z: -3.5 a -1.65)
    const eastNorth = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, ROOM.height, 1.85),
      mats.wall
    );
    eastNorth.position.set(eastX, ROOM.height / 2, -2.575);
    enableShadows(eastNorth, true, true);
    archGroup.add(eastNorth);

    // Tramo lateral sur de la pared este (z: +1.65 a +3.5)
    const eastSouth = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, ROOM.height, 1.85),
      mats.wall
    );
    eastSouth.position.set(eastX, ROOM.height / 2, 2.575);
    enableShadows(eastSouth, true, true);
    archGroup.add(eastSouth);

    // Rodapiés / Zócalos blancos perimetrales
    const baseboardH = 0.11;
    const baseboardD = 0.025;
    const bbNorth = new THREE.Mesh(new THREE.BoxGeometry(ROOM.width, baseboardH, baseboardD), mats.baseboard);
    bbNorth.position.set(0, baseboardH / 2, -ROOM.halfD + baseboardD / 2);
    archGroup.add(bbNorth);

    const bbSouth = new THREE.Mesh(new THREE.BoxGeometry(ROOM.width, baseboardH, baseboardD), mats.baseboard);
    bbSouth.position.set(0, baseboardH / 2, ROOM.halfD - baseboardD / 2);
    archGroup.add(bbSouth);

    const bbWest = new THREE.Mesh(new THREE.BoxGeometry(baseboardD, baseboardH, ROOM.depth), mats.baseboard);
    bbWest.position.set(-ROOM.halfW + baseboardD / 2, baseboardH / 2, 0);
    archGroup.add(bbWest);

    const bbEast = new THREE.Mesh(new THREE.BoxGeometry(baseboardD, baseboardH, ROOM.depth), mats.baseboard);
    bbEast.position.set(ROOM.halfW - baseboardD / 2, baseboardH / 2, 0);
    archGroup.add(bbEast);

    scene.add(archGroup);
  }

  // ============================================================================
  // 4. MODELADO DE LOS 14 MUEBLES Y OBJETOS (100% POR CÓDIGO)
  // ============================================================================

  /**
   * Objeto 1: Ventanal panorámico con cortinas y paisaje exterior soleado
   */
  function buildWindowAndExterior() {
    const group = new THREE.Group();
    group.name = 'ventana_y_exterior';

    const winX = ROOM.halfW;
    // Alféizar de madera de roble
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 3.46), mats.oak);
    sill.position.set(winX - 0.02, 0.65, 0);
    enableShadows(sill, true, true);
    group.add(sill);

    // Marcos perimetrales del ventanal (aluminio negro mate)
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 3.32), mats.blackMetal);
    frameTop.position.set(winX + 0.04, 2.63, 0);
    enableShadows(frameTop, true, true);
    group.add(frameTop);

    const framePostsZ = [-1.62, -0.54, 0.54, 1.62];
    framePostsZ.forEach((zPos) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.98, 0.055), mats.blackMetal);
      post.position.set(winX + 0.04, 1.65, zPos);
      enableShadows(post, true, true);
      group.add(post);
    });

    // Travesaño horizontal intermedio
    const transom = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 3.24), mats.blackMetal);
    transom.position.set(winX + 0.04, 1.95, 0);
    enableShadows(transom, true, true);
    group.add(transom);

    // Cristales translúcidos
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(3.24, 1.96), mats.glass);
    glassPane.rotation.y = -Math.PI / 2;
    glassPane.position.set(winX + 0.04, 1.65, 0);
    group.add(glassPane);

    // Barra de cortina y cortinas plisadas a ambos lados
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 3.85, 12), mats.brass);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(winX - 0.14, 2.82, 0);
    enableShadows(rod, true, false);
    group.add(rod);

    const curtainMat = new THREE.MeshStandardMaterial({
      map: lampShadeTex,
      color: 0xf4eee1,
      roughness: 0.88
    });

    [-1.68, 1.68].forEach((sideZ) => {
      for (let i = 0; i < 5; i++) {
        const pleat = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.07, 2.72, 12),
          curtainMat
        );
        const zOffset = (i - 2) * 0.075;
        pleat.position.set(winX - 0.14 + (i % 2) * 0.02, 1.44, sideZ + zOffset);
        enableShadows(pleat, true, true);
        group.add(pleat);
      }
    });

    // Diorama exterior soleado más allá de la ventana (x > 4.2)
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x9ad1f5, side: THREE.BackSide });
    const skyBox = new THREE.Mesh(new THREE.BoxGeometry(10, 9, 12), skyMat);
    skyBox.position.set(winX + 4.8, 2.2, 0);
    group.add(skyBox);

    // Disco solar exterior brillante
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
    );
    sunDisc.position.set(winX + 6.5, 4.3, -1.6);
    group.add(sunDisc);

    // Prado exterior y árboles estilizados visibles por la ventana
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 12),
      new THREE.MeshLambertMaterial({ color: 0x528247 })
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(winX + 4.5, -0.2, 0);
    group.add(lawn);

    const treePositions = [
      { x: winX + 3.2, z: -1.1, s: 1.0 },
      { x: winX + 4.4, z: 0.85, s: 1.25 },
      { x: winX + 3.8, z: 2.1, s: 0.9 }
    ];
    treePositions.forEach((tp) => {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11 * tp.s, 0.16 * tp.s, 1.5 * tp.s, 10),
        mats.walnut
      );
      trunk.position.set(tp.x, 0.55 * tp.s, tp.z);
      group.add(trunk);

      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.75 * tp.s, 14, 14),
        mats.leafLight
      );
      crown.position.set(tp.x, 1.65 * tp.s, tp.z);
      group.add(crown);
    });

    // Haces volumétricos de luz solar entrando por la ventana (God-rays sutiles)
    const sunbeamMat = new THREE.MeshBasicMaterial({
      color: 0xffe8a3,
      transparent: true,
      opacity: 0.065,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    [-0.9, 0.1, 1.0].forEach((zOff) => {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.75), sunbeamMat);
      beam.position.set(winX - 1.55, 1.22, zOff + 0.25);
      beam.rotation.z = 0.46;
      beam.rotation.y = 0.18;
      group.add(beam);
    });

    return registerFurniture(
      'ventana_exterior',
      'Ventanal Panorámico con Cortinas y Jardín Exterior',
      'Ventanal de carpintería metálica, cortinas plisadas, alféizar de roble, jardín exterior y rayos volumétricos de sol.',
      group
    );
  }

  /**
   * Objeto 2: Sofá de 3 plazas con Chaise Longue y cojines decorativos
   */
  function buildSofa() {
    const group = new THREE.Group();
    group.name = 'sofa_chaise_longue';
    // Ubicación del sofá: centrado en x = -1.35, z = 0.55, mirando hacia el norte (-Z)
    const sx = -1.35;
    const sz = 0.55;
    group.position.set(sx, 0, sz);

    // Bastidor inferior de madera de nogal
    const baseFrame = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.12, 0.96), mats.walnut);
    baseFrame.position.set(0, 0.18, 0);
    enableShadows(baseFrame, true, true);
    group.add(baseFrame);

    // Extensión de madera del chaise longue en el lado izquierdo (-X)
    const chaiseFrame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 0.72), mats.walnut);
    chaiseFrame.position.set(-0.895, 0.18, -0.82);
    enableShadows(chaiseFrame, true, true);
    group.add(chaiseFrame);

    // Patas troncocónicas de madera con casquillo de latón
    const legCoords = [
      [-1.24, -0.4], [1.24, -0.4], [-1.24, 0.4], [1.24, 0.4],
      [-1.24, -1.12], [-0.54, -1.12]
    ];
    legCoords.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.02, 0.14, 10), mats.walnut);
      leg.position.set(lx, 0.07, lz);
      enableShadows(leg, true, true);
      group.add(leg);
    });

    // Cojines de asiento principales (3 plazas + chaise longue)
    const seatPositionsX = [-0.88, 0, 0.88];
    seatPositionsX.forEach((px, idx) => {
      const isChaise = idx === 0;
      const depth = isChaise ? 1.62 : 0.88;
      const zCenter = isChaise ? -0.37 : 0;
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, depth), mats.sofa);
      cushion.position.set(px, 0.33, zCenter);
      enableShadows(cushion, true, true);
      group.add(cushion);
    });

    // Respaldo tapizado trasero y 3 cojines de respaldo mullidos
    const backStructure = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.56, 0.18), mats.sofa);
    backStructure.position.set(0, 0.52, 0.41);
    enableShadows(backStructure, true, true);
    group.add(backStructure);

    seatPositionsX.forEach((px) => {
      const backPillow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.42, 0.18), mats.sofa);
      backPillow.position.set(px, 0.61, 0.25);
      backPillow.rotation.x = -0.12;
      enableShadows(backPillow, true, true);
      group.add(backPillow);
    });

    // Dos reposabrazos laterales
    [-1.26, 1.26].forEach((ax) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.94), mats.sofa);
      arm.position.set(ax, 0.45, 0);
      enableShadows(arm, true, true);
      group.add(arm);
    });

    // Cojines decorativos en contraste (mostaza y terracota)
    const decoPillows = [
      { x: -1.02, y: 0.54, z: 0.08, ry: 0.35, mat: mats.mustardCushion },
      { x: -0.72, y: 0.52, z: 0.12, ry: -0.2, mat: mats.terraCushion },
      { x: 0.98, y: 0.54, z: 0.08, ry: -0.38, mat: mats.mustardCushion }
    ];
    decoPillows.forEach((dp) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.12), dp.mat);
      p.position.set(dp.x, dp.y, dp.z);
      p.rotation.y = dp.ry;
      p.rotation.z = 0.08;
      enableShadows(p, true, true);
      group.add(p);
    });

    // Colisionadores AABB para el cuerpo principal del sofá y la extensión chaise longue
    addCollider('sofa_main', 'Sofá Principal', sx - 1.35, sx + 1.35, sz - 0.48, sz + 0.5);
    addCollider('sofa_chaise', 'Sofá Chaise Longue', sx - 1.35, sx - 0.44, sz - 1.2, sz - 0.45);

    return registerFurniture(
      'sofa',
      'Sofá Chaise Longue de 3 Plazas',
      'Sofá tapizado con tejido en espiga, base de nogal, 3 asientos, extensión chaise longue y cojines decorativos.',
      group
    );
  }

  /**
   * Objeto 3: Mesa de centro con bandeja, taza de café y libros
   */
  function buildCoffeeTable() {
    const group = new THREE.Group();
    group.name = 'mesa_centro';
    const tx = -0.85;
    const tz = -1.25;
    group.position.set(tx, 0, tz);

    // Tablero principal de madera de roble con bordes redondeados simulados
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.045, 0.66), mats.oak);
    top.position.set(0, 0.42, 0);
    enableShadows(top, true, true);
    group.add(top);

    // Balda inferior para revistas
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.025, 0.54), mats.walnut);
    shelf.position.set(0, 0.16, 0);
    enableShadows(shelf, true, true);
    group.add(shelf);

    // Estructura metálica negra en las 4 esquinas
    const legOffsets = [
      [-0.56, -0.27], [0.56, -0.27], [-0.56, 0.27], [0.56, 0.27]
    ];
    legOffsets.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.41, 10), mats.blackMetal);
      leg.position.set(lx, 0.205, lz);
      enableShadows(leg, true, true);
      group.add(leg);
    });

    // Bandeja cerámica circular sobre la mesa
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.025, 20), mats.ceramicWhite);
    tray.position.set(0.24, 0.455, 0.04);
    enableShadows(tray, true, true);
    group.add(tray);

    // Taza de café con asa toroidal y café oscuro en el interior
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.085, 16), mats.terraCushion);
    mug.position.set(0.22, 0.51, 0.05);
    enableShadows(mug, true, true);
    group.add(mug);

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 16), mats.terraCushion);
    handle.position.set(0.265, 0.51, 0.05);
    group.add(handle);

    // Libros apilados sobre la mesa de centro
    const book1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.032, 0.19),
      new THREE.MeshStandardMaterial({ color: 0x264653, roughness: 0.5 })
    );
    book1.position.set(-0.28, 0.458, -0.04);
    book1.rotation.y = 0.15;
    enableShadows(book1, true, true);
    group.add(book1);

    const book2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.23, 0.028, 0.17),
      new THREE.MeshStandardMaterial({ color: 0xe76f51, roughness: 0.5 })
    );
    book2.position.set(-0.28, 0.488, -0.04);
    book2.rotation.y = -0.08;
    enableShadows(book2, true, true);
    group.add(book2);

    addCollider('mesa_centro', 'Mesa de Centro', tx - 0.64, tx + 0.64, tz - 0.34, tz + 0.34);

    return registerFurniture(
      'mesa_centro',
      'Mesa de Centro con Bandeja, Café y Libros',
      'Mesa de centro en roble y acero negro con balda inferior, bandeja cerámica, taza de café y libros de arte.',
      group
    );
  }

  /**
   * Objeto 4: Alfombra grande tejida con flecos
   */
  function buildAreaRug() {
    const group = new THREE.Group();
    group.name = 'alfombra_tejida';
    group.position.set(-1.1, 0.006, -0.35);

    const rugMat = new THREE.MeshStandardMaterial({
      map: rugTex,
      bumpMap: rugTex,
      bumpScale: 0.006,
      roughness: 0.92
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.012, 2.5), rugMat);
    enableShadows(body, false, true);
    group.add(body);

    // Flecos tejidos en los bordes izquierdo y derecho
    const fringeMat = new THREE.MeshStandardMaterial({ color: 0xdfd5c2, roughness: 0.9 });
    for (let z = -1.2; z <= 1.2; z += 0.08) {
      [-1.69, 1.69].forEach((fx) => {
        const tassel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.006, 0.024), fringeMat);
        tassel.position.set(fx, 0, z);
        group.add(tassel);
      });
    }

    // La alfombra no añade colisionador para que el jugador camine por encima de ella
    return registerFurniture(
      'alfombra',
      'Alfombra Bereber Tejida con Flecos',
      'Alfombra con textura geométrica generada por código y flecos perimetrales.',
      group
    );
  }

  /**
   * Objeto 5: Mueble de TV bajo (Aparador de listones), Televisor 65" y Altavoces Hi-Fi
   */
  function buildTVConsoleAndSet() {
    const group = new THREE.Group();
    group.name = 'mueble_tv_y_televisor';
    const mx = -1.1;
    const mz = -3.12;
    group.position.set(mx, 0, mz);

    // Cuerpo del aparador de nogal
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.42, 0.48), mats.walnut);
    cabinet.position.set(0, 0.35, 0);
    enableShadows(cabinet, true, true);
    group.add(cabinet);

    // Puertas frontales con listones verticales de roble claro (slatted doors)
    for (let x = -1.08; x <= 1.08; x += 0.06) {
      if (Math.abs(x) < 0.32) continue; // Hueco central abierto para consola/reproductor
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.34, 0.02), mats.oak);
      slat.position.set(x, 0.35, 0.245);
      enableShadows(slat, true, true);
      group.add(slat);
    }

    // Patas cónicas del mueble de TV
    [-1.05, -0.35, 0.35, 1.05].forEach((lx) => {
      [-0.18, 0.18].forEach((lz) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.014, 0.14, 10), mats.blackMetal);
        leg.position.set(lx, 0.07, lz);
        enableShadows(leg, true, true);
        group.add(leg);
      });
    });

    // Televisor panorámico de 65 pulgadas
    const tvStandBase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.018, 0.26), mats.blackMetal);
    tvStandBase.position.set(0, 0.57, 0);
    group.add(tvStandBase);

    const tvNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.16, 12), mats.blackMetal);
    tvNeck.position.set(0, 0.64, -0.04);
    group.add(tvNeck);

    const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.9, 0.035), mats.blackMetal);
    tvFrame.position.set(0, 1.12, 0);
    enableShadows(tvFrame, true, true);
    group.add(tvFrame);

    const tvScreenTex = createScreenTexture('tv');
    const tvScreenMat = new THREE.MeshStandardMaterial({
      map: tvScreenTex,
      emissive: 0x223344,
      emissiveMap: tvScreenTex,
      emissiveIntensity: 0.55,
      roughness: 0.15
    });
    const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.84), tvScreenMat);
    tvScreen.position.set(0, 1.12, 0.019);
    group.add(tvScreen);

    // Par de altavoces Hi-Fi a ambos lados del televisor
    [-0.96, 0.96].forEach((sx) => {
      const spkBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.22), mats.blackMetal);
      spkBox.position.set(sx, 0.74, 0.02);
      enableShadows(spkBox, true, true);
      group.add(spkBox);

      const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.02, 16), mats.brass);
      woofer.rotation.x = Math.PI / 2;
      woofer.position.set(sx, 0.69, 0.132);
      group.add(woofer);

      const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.02, 16), mats.brass);
      tweeter.rotation.x = Math.PI / 2;
      tweeter.position.set(sx, 0.82, 0.132);
      group.add(tweeter);
    });

    addCollider('mueble_tv', 'Mueble de TV y Equipo Multimedia', mx - 1.2, mx + 1.2, mz - 0.28, mz + 0.28);

    return registerFurniture(
      'mueble_tv',
      'Aparador de TV de Listones con Televisor 65" y Altavoces Hi-Fi',
      'Consola baja de nogal y listones de roble, televisor panorámico con pantalla retroiluminada y monitores de audio.',
      group
    );
  }

  /**
   * Objeto 6: Estantería librería de madera con colección de libros generados por código
   */
  function buildBookcase() {
    const group = new THREE.Group();
    group.name = 'estanteria_libreria';
    const bx = -3.68;
    const bz = -1.75;
    group.position.set(bx, 0, bz);

    const height = 2.35;
    const depth = 0.36;
    const width = 1.35; // A lo largo del eje Z porque está adosada a la pared oeste

    // Paneles laterales verticales
    [-width / 2, width / 2].forEach((zSide) => {
      const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(depth, height, 0.035), mats.walnut);
      sidePanel.position.set(0, height / 2, zSide);
      enableShadows(sidePanel, true, true);
      group.add(sidePanel);
    });

    // Panel trasero
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.02, height, width), mats.oak);
    backPanel.position.set(-depth / 2 + 0.01, height / 2, 0);
    group.add(backPanel);

    // 6 Baldas horizontales y libros en cada balda
    const shelfCount = 6;
    const bookColors = [
      0x264653, 0x2a9d8f, 0xe9c46a, 0xf4a261, 0xe76f51,
      0x6d597a, 0x355070, 0xb56576, 0x457b9d, 0x8d99ae
    ];

    let seed = 77;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    for (let s = 0; s < shelfCount; s++) {
      const sy = 0.08 + s * 0.44;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(depth, 0.032, width), mats.walnut);
      shelf.position.set(0, sy, 0);
      enableShadows(shelf, true, true);
      group.add(shelf);

      if (s < shelfCount - 1) {
        // Poblar balda con libros y objetos decorativos
        let curZ = -width / 2 + 0.06;
        while (curZ < width / 2 - 0.14) {
          if (rand() < 0.14) {
            curZ += 0.12; // Pequeño hueco o sujetalibros
            const globe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), mats.brass);
            globe.position.set(0.02, sy + 0.07, curZ - 0.06);
            enableShadows(globe, true, true);
            group.add(globe);
            continue;
          }
          const bThick = 0.026 + rand() * 0.026;
          const bHeight = 0.22 + rand() * 0.12;
          const bDepth = 0.2 + rand() * 0.06;
          const color = bookColors[Math.floor(rand() * bookColors.length)];
          const bookMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
          const book = new THREE.Mesh(new THREE.BoxGeometry(bDepth, bHeight, bThick), bookMat);
          book.position.set(0.02, sy + 0.016 + bHeight / 2, curZ + bThick / 2);
          enableShadows(book, true, true);
          group.add(book);

          curZ += bThick + 0.004;
        }
      }
    }

    addCollider('estanteria', 'Estantería Librería', bx - 0.22, bx + 0.22, bz - 0.7, bz + 0.7);

    return registerFurniture(
      'estanteria',
      'Estantería Librería de Nogal con Colección de Libros',
      'Estantería de 6 niveles repleta de libros generados proceduralmente y esferas de latón.',
      group
    );
  }

  /**
   * Objeto 7: Escritorio de estudio con cajonera, ordenador portátil y accesorios
   */
  function buildStudyDesk() {
    const group = new THREE.Group();
    group.name = 'escritorio_estudio';
    const dx = 2.45;
    const dz = 2.75;
    group.position.set(dx, 0, dz);

    // Tablero amplio de madera de nogal
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.045, 0.74), mats.walnut);
    deskTop.position.set(0, 0.75, 0);
    enableShadows(deskTop, true, true);
    group.add(deskTop);

    // Pata metálica izquierda en forma de marco rectangular
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.73, 0.68), mats.blackMetal);
    leftLeg.position.set(-0.71, 0.365, 0);
    enableShadows(leftLeg, true, true);
    group.add(leftLeg);

    // Cajonera derecha con 3 cajones y tiradores de latón
    const drawerUnit = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.72, 0.68), mats.oak);
    drawerUnit.position.set(0.51, 0.36, 0);
    enableShadows(drawerUnit, true, true);
    group.add(drawerUnit);

    [0.18, 0.38, 0.58].forEach((dy) => {
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.17, 0.02), mats.walnut);
      front.position.set(0.51, dy, -0.345);
      group.add(front);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), mats.brass);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0.51, dy, -0.365);
      group.add(handle);
    });

    // Ordenador portátil abierto sobre el escritorio (mirando hacia el norte -Z donde está la silla)
    const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.014, 0.25), mats.chrome);
    laptopBase.position.set(-0.12, 0.78, -0.04);
    enableShadows(laptopBase, true, true);
    group.add(laptopBase);

    const keyboard = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.14), mats.blackMetal);
    keyboard.rotation.x = -Math.PI / 2;
    keyboard.position.set(-0.12, 0.788, -0.06);
    group.add(keyboard);

    const laptopLid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.01), mats.chrome);
    laptopLid.position.set(-0.12, 0.895, 0.095);
    laptopLid.rotation.x = 0.22;
    enableShadows(laptopLid, true, true);
    group.add(laptopLid);

    const laptopScreenTex = createScreenTexture('laptop');
    const laptopScreenMat = new THREE.MeshStandardMaterial({
      map: laptopScreenTex,
      emissive: 0x223344,
      emissiveMap: laptopScreenTex,
      emissiveIntensity: 0.75
    });
    const laptopScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.21), laptopScreenMat);
    laptopScreen.position.set(-0.12, 0.895, 0.088);
    laptopScreen.rotation.y = Math.PI;
    laptopScreen.rotation.x = -0.22;
    group.add(laptopScreen);

    // Portalápices con lápices de colores
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 14), mats.ceramicWhite);
    cup.position.set(-0.52, 0.82, 0.14);
    enableShadows(cup, true, true);
    group.add(cup);

    [-0.012, 0.012, 0].forEach((ox, idx) => {
      const pen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.14, 8),
        idx === 0 ? mats.mustardCushion : idx === 1 ? mats.terraCushion : mats.leafGreen
      );
      pen.position.set(-0.52 + ox, 0.86, 0.14 + (idx - 1) * 0.01);
      pen.rotation.z = (idx - 1) * 0.14;
      group.add(pen);
    });

    addCollider('escritorio', 'Escritorio de Estudio', dx - 0.79, dx + 0.79, dz - 0.39, dz + 0.39);

    return registerFurniture(
      'escritorio',
      'Escritorio de Estudio con Cajonera y Portátil',
      'Escritorio de nogal y roble con 3 cajones, ordenador portátil retroiluminado y portalápices.',
      group
    );
  }

  /**
   * Objeto 8: Silla ergonómica de estudio giratoria
   */
  function buildStudyChair() {
    const group = new THREE.Group();
    group.name = 'silla_estudio';
    const cx = 2.32;
    const cz = 1.92;
    group.position.set(cx, 0, cz);
    group.rotation.y = 0.2;

    // Base en estrella de 5 radios con ruedas
    for (let i = 0; i < 5; i++) {
      const ang = (i * Math.PI * 2) / 5;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.035), mats.blackMetal);
      arm.position.set(Math.cos(ang) * 0.14, 0.06, Math.sin(ang) * 0.14);
      arm.rotation.y = -ang;
      enableShadows(arm, true, true);
      group.add(arm);

      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.025, 10), mats.blackMetal);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(Math.cos(ang) * 0.26, 0.025, Math.sin(ang) * 0.26);
      group.add(wheel);
    }

    // Pistón central cromado
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.38, 12), mats.chrome);
    piston.position.set(0, 0.25, 0);
    enableShadows(piston, true, true);
    group.add(piston);

    // Asiento acolchado
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.075, 0.46), mats.sofa);
    seat.position.set(0, 0.46, 0);
    enableShadows(seat, true, true);
    group.add(seat);

    // Respaldo ergonómico curvado (orientado hacia el norte -Z)
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.48, 0.06), mats.sofa);
    backrest.position.set(0, 0.74, -0.21);
    backrest.rotation.x = 0.1;
    enableShadows(backrest, true, true);
    group.add(backrest);

    // Reposabrazos laterales
    [-0.25, 0.25].forEach((ax) => {
      const support = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 8), mats.blackMetal);
      support.position.set(ax, 0.56, -0.04);
      group.add(support);

      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.24), mats.walnut);
      pad.position.set(ax, 0.66, -0.04);
      enableShadows(pad, true, true);
      group.add(pad);
    });

    addCollider('silla_estudio', 'Silla Ergonómica de Estudio', cx - 0.3, cx + 0.3, cz - 0.3, cz + 0.3);

    return registerFurniture(
      'silla_estudio',
      'Silla Ergonómica Giratoria de Estudio',
      'Silla con base de 5 radios y ruedas, pistón hidráulico, asiento tapizado y reposabrazos.',
      group
    );
  }

  /**
   * Objeto 9: Planta de interior Monstera en maceta cerámica
   */
  function buildIndoorPlant() {
    const group = new THREE.Group();
    group.name = 'planta_monstera';
    const px = 3.22;
    const pz = -2.75;
    group.position.set(px, 0, pz);

    // Plato cerámico base
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.04, 18), mats.ceramicWhite);
    saucer.position.set(0, 0.02, 0);
    enableShadows(saucer, true, true);
    group.add(saucer);

    // Maceta troncocónica de terracota
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.42, 20), mats.terracottaPot);
    pot.position.set(0, 0.23, 0);
    enableShadows(pot, true, true);
    group.add(pot);

    // Sustrato interior
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16), mats.walnut);
    soil.position.set(0, 0.43, 0);
    group.add(soil);

    // Tallos y hojas radiales a diferentes alturas
    const leafCount = 13;
    for (let i = 0; i < leafCount; i++) {
      const angle = (i * Math.PI * 2) / leafCount + (i % 2) * 0.2;
      const tier = i % 3;
      const stemH = 0.38 + tier * 0.18;
      const tilt = 0.28 + tier * 0.16;

      const branchGroup = new THREE.Group();
      branchGroup.position.set(0, 0.42, 0);
      branchGroup.rotation.y = angle;

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.016, stemH, 8),
        mats.leafGreen
      );
      stem.position.set(0, stemH / 2, stemH * 0.22);
      stem.rotation.x = tilt;
      enableShadows(stem, true, false);
      branchGroup.add(stem);

      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 10),
        i % 2 === 0 ? mats.leafGreen : mats.leafLight
      );
      leaf.scale.set(0.85, 0.08, 1.35);
      leaf.position.set(0, stemH * Math.cos(tilt * 0.7), stemH * Math.sin(tilt) + 0.08);
      leaf.rotation.x = tilt + 0.35;
      enableShadows(leaf, true, true);
      branchGroup.add(leaf);

      group.add(branchGroup);
    }

    addCollider('planta_maceta', 'Planta Monstera en Maceta', px - 0.32, px + 0.32, pz - 0.32, pz + 0.32);

    return registerFurniture(
      'planta_maceta',
      'Planta Monstera en Maceta de Terracota',
      'Maceta cerámica con plato base, sustrato y 13 tallos orgánicos con follaje verde.',
      group
    );
  }

  /**
   * Objeto 10: Cuadros enmarcados, Reloj de pared funcional y Puerta de entrada
   */
  function buildWallDecorAndDoor() {
    const group = new THREE.Group();
    group.name = 'cuadros_reloj_y_puerta';

    // Cuadro 1: Gran lienzo panorámico sobre el mueble de TV (Pared Norte z = -3.48)
    const art1Group = new THREE.Group();
    art1Group.position.set(-1.1, 2.08, -ROOM.halfD + 0.02);
    const frame1 = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.82, 0.04), mats.walnut);
    enableShadows(frame1, true, true);
    art1Group.add(frame1);
    const canvas1 = new THREE.Mesh(
      new THREE.PlaneGeometry(1.28, 0.72),
      new THREE.MeshStandardMaterial({ map: createArtworkTexture(1), roughness: 0.6 })
    );
    canvas1.position.z = 0.022;
    art1Group.add(canvas1);
    group.add(art1Group);

    // Cuadros 2 y 3: Díptico artístico en la Pared Oeste (x = -3.98)
    [0.25, 1.15].forEach((zPos, idx) => {
      const artG = new THREE.Group();
      artG.position.set(-ROOM.halfW + 0.02, 1.78, zPos);
      artG.rotation.y = Math.PI / 2;

      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.82, 0.035), mats.oak);
      enableShadows(frame, true, true);
      artG.add(frame);

      const canvas = new THREE.Mesh(
        new THREE.PlaneGeometry(0.58, 0.74),
        new THREE.MeshStandardMaterial({ map: createArtworkTexture(idx + 2), roughness: 0.6 })
      );
      canvas.position.z = 0.02;
      artG.add(canvas);
      group.add(artG);
    });

    // Reloj de pared 3D funcional en la Pared Oeste (x = -3.97, z = 2.25)
    const clockGroup = new THREE.Group();
    clockGroup.position.set(-ROOM.halfW + 0.025, 2.15, 2.25);
    clockGroup.rotation.y = Math.PI / 2;

    const clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.045, 28), mats.brass);
    clockRim.rotation.x = Math.PI / 2;
    enableShadows(clockRim, true, true);
    clockGroup.add(clockRim);

    const clockFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.215, 28),
      new THREE.MeshStandardMaterial({ map: clockData.texture, roughness: 0.35 })
    );
    clockFace.position.z = 0.024;
    clockGroup.add(clockFace);
    group.add(clockGroup);

    // Puerta de entrada moldurada en la Pared Sur (x = -1.9, z = +3.48)
    const doorGroup = new THREE.Group();
    doorGroup.position.set(-1.9, 0, ROOM.halfD - 0.02);

    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.06, 2.18, 0.07), mats.baseboard);
    doorFrame.position.set(0, 1.09, 0);
    doorGroup.add(doorFrame);

    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.92, 2.1, 0.045), mats.oak);
    doorLeaf.position.set(0, 1.05, -0.01);
    enableShadows(doorLeaf, true, true);
    doorGroup.add(doorLeaf);

    // Manilla de latón
    const handlePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 14), mats.brass);
    handlePlate.rotation.x = Math.PI / 2;
    handlePlate.position.set(0.36, 1.02, -0.04);
    doorGroup.add(handlePlate);

    const handleLever = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.025), mats.brass);
    handleLever.position.set(0.32, 1.02, -0.06);
    doorGroup.add(handleLever);

    group.add(doorGroup);

    return registerFurniture(
      'cuadros_reloj_puerta',
      'Tríptico de Cuadros, Reloj de Pared en Tiempo Real y Puerta de Entrada',
      'Tres lienzos generados con Canvas2D, reloj analógico con hora real y puerta arquitectónica con herrajes.',
      group
    );
  }

  // ============================================================================
  // 5. SISTEMA DE ILUMINACIÓN Y LAS 4 LÁMPARAS INTERACTIVAS
  // ============================================================================

  // Sonido sintetizado de interruptor mecánico (Web Audio API sin archivos externos)
  let audioCtx = null;
  function playSwitchClickSound(isTurningOn) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtx) audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isTurningOn ? 620 : 420, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(isTurningOn ? 980 : 240, audioCtx.currentTime + 0.045);

      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.055);
    } catch (_) {
      // Ignorar si el navegador bloquea audio sin gesto previo
    }
  }

  /**
   * Registra una lámpara interactiva que puede encenderse y apagarse con clic o toque
   */
  function registerInteractiveLamp(config) {
    const lampObj = {
      id: config.id,
      name: config.name,
      isOn: config.initialOn !== false,
      light: config.light,
      spotLight: config.spotLight || null,
      maxIntensity: config.maxIntensity,
      spotMaxIntensity: config.spotMaxIntensity || 0,
      shadeMat: config.shadeMat,
      bulbMat: config.bulbMat,
      emissiveColor: new THREE.Color(config.emissiveHex || 0xffb74d),
      group: config.group,
      hudButton: null,
      toggle: function () {
        this.setState(!this.isOn, true);
        return this.isOn;
      },
      setState: function (on, withSound = false) {
        this.isOn = Boolean(on);
        this.light.intensity = this.isOn ? this.maxIntensity : 0;
        if (this.spotLight) {
          this.spotLight.intensity = this.isOn ? this.spotMaxIntensity : 0;
        }
        if (this.shadeMat) {
          this.shadeMat.emissive = this.isOn ? this.emissiveColor : new THREE.Color(0x000000);
          this.shadeMat.emissiveIntensity = this.isOn ? 0.55 : 0.0;
        }
        if (this.bulbMat) {
          this.bulbMat.emissive = this.isOn ? new THREE.Color(0xfff1b5) : new THREE.Color(0x000000);
          this.bulbMat.emissiveIntensity = this.isOn ? 1.8 : 0.0;
        }
        if (this.hudButton) {
          this.hudButton.classList.toggle('active', this.isOn);
          this.hudButton.setAttribute('aria-pressed', String(this.isOn));
        }
        if (withSound) {
          playSwitchClickSound(this.isOn);
        }
        updateInteractionPrompt();
      }
    };

    // Etiquetar todas las mallas hijas del grupo con lampId para que el Raycaster las detecte al hacer clic/toque
    config.group.traverse((child) => {
      if (child.isMesh) {
        child.userData.lampId = lampObj.id;
        child.userData.lampRef = lampObj;
      }
    });

    lampObj.setState(lampObj.isOn, false);
    state.lamps.push(lampObj);
    return lampObj;
  }

  /**
   * Configura la iluminación natural que entra por la ventana
   */
  function setupNaturalLighting() {
    // 1. Luz hemisférica de cielo azulado / rebote cálido de suelo de madera
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x8d6e63, 0.52);
    hemiLight.position.set(0, ROOM.height, 0);
    scene.add(hemiLight);

    // 2. Sol directo que entra inclinado desde el exterior por el ventanal este (x = +4.0)
    const sunLight = new THREE.DirectionalLight(0xfff1d0, 1.35);
    sunLight.position.set(7.8, 4.4, -0.8);
    sunLight.target.position.set(-0.8, 0.0, 0.3);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1.5;
    sunLight.shadow.camera.far = 16;
    sunLight.shadow.camera.left = -4.5;
    sunLight.shadow.camera.right = 4.5;
    sunLight.shadow.camera.top = 4.0;
    sunLight.shadow.camera.bottom = -4.0;
    sunLight.shadow.bias = -0.0008;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // 3. Rebote difuso de luz celeste justo en el vano del ventanal
    const windowBounce = new THREE.PointLight(0xdff2ff, 0.58, 7.5, 1.6);
    windowBounce.position.set(ROOM.halfW - 0.35, 1.75, 0);
    scene.add(windowBounce);
  }

  /**
   * Objeto 11 (Lámpara Interactiva #1): Lámpara de pie de lectura junto al sofá
   */
  function buildFloorLamp() {
    const group = new THREE.Group();
    group.name = 'lampara_pie';
    const lx = -3.05;
    const lz = 0.65;
    group.position.set(lx, 0, lz);

    // Base circular pesada de latón y mármol
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 22), mats.brass);
    base.position.set(0, 0.02, 0);
    enableShadows(base, true, true);
    group.add(base);

    // Fuste vertical esbelto
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.58, 12), mats.brass);
    pole.position.set(0, 0.81, 0);
    enableShadows(pole, true, true);
    group.add(pole);

    // Brazo superior inclinado hacia la zona de lectura
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 10), mats.brass);
    arm.position.set(0.14, 1.58, -0.05);
    arm.rotation.z = -1.1;
    group.add(arm);

    // Materiales emisivos propios para pantalla y bombilla
    const shadeMat = new THREE.MeshStandardMaterial({
      map: lampShadeTex,
      color: 0xfff6e5,
      roughness: 0.65,
      side: THREE.DoubleSide
    });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2
    });

    // Pantalla troncocónica
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.28, 22, 1, true), shadeMat);
    shade.position.set(0.28, 1.48, -0.08);
    enableShadows(shade, true, false);
    group.add(shade);

    // Bombilla interior
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 14), bulbMat);
    bulb.position.set(0.28, 1.48, -0.08);
    group.add(bulb);

    // Luz puntual cálida + foco hacia abajo
    const pointLight = new THREE.PointLight(0xffb74d, 1.15, 6.5, 1.7);
    pointLight.position.set(0.28, 1.42, -0.08);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 512;
    pointLight.shadow.mapSize.height = 512;
    pointLight.shadow.bias = -0.002;
    group.add(pointLight);

    addCollider('lampara_pie', 'Lámpara de Pie de Lectura', lx - 0.25, lx + 0.32, lz - 0.25, lz + 0.25);

    registerFurniture(
      'lampara_pie',
      'Lámpara de Pie Articulada de Lectura (Interactiva)',
      'Lámpara de pie en latón cepillado con pantalla de pergamino. Se enciende y apaga con clic o toque.',
      group
    );

    return registerInteractiveLamp({
      id: 'lampara_pie',
      name: 'Lámpara de Pie',
      initialOn: true,
      light: pointLight,
      maxIntensity: 1.15,
      shadeMat,
      bulbMat,
      emissiveHex: 0xffb347,
      group
    });
  }

  /**
   * Objeto 12 (Lámpara Interactiva #2): Lámpara flexo articulada en el escritorio
   */
  function buildDeskLamp() {
    const group = new THREE.Group();
    group.name = 'lampara_escritorio';
    // Colocada sobre la esquina derecha del escritorio (altura y = 0.772)
    group.position.set(2.98, 0.772, 2.85);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.028, 18), mats.blackMetal);
    base.position.set(0, 0.014, 0);
    enableShadows(base, true, true);
    group.add(base);

    // Botón rojo/dorado en la base
    const switchBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 10), mats.brass);
    switchBtn.position.set(-0.05, 0.03, -0.04);
    group.add(switchBtn);

    // Primer tramo articulado
    const lowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.28, 10), mats.brass);
    lowerArm.position.set(0.04, 0.15, 0.03);
    lowerArm.rotation.z = -0.25;
    enableShadows(lowerArm, true, false);
    group.add(lowerArm);

    // Rótula de unión
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10), mats.blackMetal);
    joint.position.set(0.075, 0.28, 0.04);
    group.add(joint);

    // Segundo tramo inclinado hacia el teclado del portátil
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.26, 10), mats.brass);
    upperArm.position.set(-0.03, 0.36, -0.02);
    upperArm.rotation.z = 0.95;
    upperArm.rotation.y = -0.4;
    enableShadows(upperArm, true, false);
    group.add(upperArm);

    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0x264653,
      roughness: 0.35,
      metalness: 0.4,
      side: THREE.DoubleSide
    });
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

    // Campana cónica del flexo
    const coneShade = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.14, 18, 1, true), shadeMat);
    coneShade.position.set(-0.14, 0.39, -0.08);
    coneShade.rotation.z = 0.45;
    enableShadows(coneShade, true, false);
    group.add(coneShade);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 12), bulbMat);
    bulb.position.set(-0.14, 0.36, -0.08);
    group.add(bulb);

    const deskLight = new THREE.PointLight(0xffcc70, 0.95, 4.5, 1.8);
    deskLight.position.set(-0.16, 0.33, -0.09);
    group.add(deskLight);

    registerFurniture(
      'lampara_escritorio',
      'Flexo Articulado de Escritorio (Interactivo)',
      'Lámpara de estudio articulada con rótula y pantalla metálica. Interactiva mediante clic o toque.',
      group
    );

    return registerInteractiveLamp({
      id: 'lampara_escritorio',
      name: 'Flexo Escritorio',
      initialOn: true,
      light: deskLight,
      maxIntensity: 0.95,
      shadeMat,
      bulbMat,
      emissiveHex: 0xffaa33,
      group
    });
  }

  /**
   * Objeto 13: Mesa auxiliar trípode con Lámpara de Sobremesa (Lámpara Interactiva #3)
   */
  function buildSideTableAndLamp() {
    const group = new THREE.Group();
    group.name = 'mesa_auxiliar_y_lampara';
    const tx = 0.32;
    const tz = 0.55;
    group.position.set(tx, 0, tz);

    // Tablero circular de roble
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.035, 24), mats.oak);
    tableTop.position.set(0, 0.54, 0);
    enableShadows(tableTop, true, true);
    group.add(tableTop);

    // 3 patas trípode inclinadas
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.55, 10), mats.walnut);
      leg.position.set(Math.cos(ang) * 0.14, 0.27, Math.sin(ang) * 0.14);
      leg.rotation.z = -Math.cos(ang) * 0.12;
      leg.rotation.x = Math.sin(ang) * 0.12;
      enableShadows(leg, true, true);
      group.add(leg);
    }

    // Lámpara de sobremesa cerámica encima de la mesa auxiliar
    const lampGroup = new THREE.Group();
    lampGroup.position.set(0, 0.558, 0);

    const ceramicBody = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 16), mats.terracottaPot);
    ceramicBody.scale.set(1, 1.35, 1);
    ceramicBody.position.set(0, 0.13, 0);
    enableShadows(ceramicBody, true, true);
    lampGroup.add(ceramicBody);

    const brassNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.06, 12), mats.brass);
    brassNeck.position.set(0, 0.28, 0);
    lampGroup.add(brassNeck);

    const shadeMat = new THREE.MeshStandardMaterial({
      map: lampShadeTex,
      color: 0xfff5e4,
      roughness: 0.7,
      side: THREE.DoubleSide
    });
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.22, 20, 1, true), shadeMat);
    shade.position.set(0, 0.38, 0);
    enableShadows(shade, true, false);
    lampGroup.add(shade);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), bulbMat);
    bulb.position.set(0, 0.36, 0);
    lampGroup.add(bulb);

    const tableLight = new THREE.PointLight(0xffad42, 0.9, 5.2, 1.7);
    tableLight.position.set(0, 0.38, 0);
    lampGroup.add(tableLight);

    group.add(lampGroup);

    addCollider('mesa_auxiliar', 'Mesa Auxiliar y Lámpara de Sobremesa', tx - 0.3, tx + 0.3, tz - 0.3, tz + 0.3);

    registerFurniture(
      'mesa_auxiliar_lampara',
      'Mesa Auxiliar Trípode con Lámpara de Cerámica (Interactiva)',
      'Mesita redonda de tres patas en roble con lámpara de cerámica y pantalla textil interactiva.',
      group
    );

    return registerInteractiveLamp({
      id: 'lampara_sobremesa',
      name: 'Lámpara Sobremesa',
      initialOn: true,
      light: tableLight,
      maxIntensity: 0.9,
      shadeMat,
      bulbMat,
      emissiveHex: 0xffa733,
      group: lampGroup
    });
  }

  /**
   * Objeto 14 (Lámpara Interactiva #4): Lámpara colgante de techo de anillos concéntricos
   */
  function buildCeilingChandelier() {
    const group = new THREE.Group();
    group.name = 'lampara_techo';
    group.position.set(-0.35, ROOM.height, -0.25);

    // Florón de techo en latón y cables tensores
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 20), mats.brass);
    canopy.position.set(0, -0.02, 0);
    group.add(canopy);

    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3;
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.56, 6), mats.blackMetal);
      cord.position.set(Math.cos(ang) * 0.12, -0.28, Math.sin(ang) * 0.12);
      group.add(cord);
    }

    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xfff8eb,
      roughness: 0.35,
      side: THREE.DoubleSide
    });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff9db,
      roughness: 0.2
    });

    // Anillo exterior de latón y difusor interior luminoso
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.028, 14, 36), mats.brass);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.set(0, -0.54, 0);
    enableShadows(outerRing, true, false);
    group.add(outerRing);

    const innerDiffuser = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.024, 12, 36), shadeMat);
    innerDiffuser.rotation.x = Math.PI / 2;
    innerDiffuser.position.set(0, -0.54, 0);
    group.add(innerDiffuser);

    const centerSphere = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), bulbMat);
    centerSphere.position.set(0, -0.54, 0);
    group.add(centerSphere);

    const ceilingLight = new THREE.PointLight(0xffe0a3, 0.95, 11.0, 1.5);
    ceilingLight.position.set(0, -0.62, 0);
    group.add(ceilingLight);

    registerFurniture(
      'lampara_techo',
      'Lámpara Colgante de Techo de Anillos Concéntricos (Interactiva)',
      'Luminaria suspendida de diseño moderno en latón con difusor toroidal. Interactiva con clic o toque.',
      group
    );

    return registerInteractiveLamp({
      id: 'lampara_techo',
      name: 'Lámpara Techo',
      initialOn: false, // Empieza apagada para apreciar el contraste de la luz natural y lámparas cálidas, conmutable al instante
      light: ceilingLight,
      maxIntensity: 0.95,
      shadeMat,
      bulbMat,
      emissiveHex: 0xffdf9e,
      group
    });
  }

  /**
   * Partículas sutiles de polvo flotando en el haz de luz solar
   */
  let dustSystem = null;
  function buildSunlightDustMotes() {
    const count = 75;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    let seed = 313;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0.6 + rand() * 3.1;       // Cerca del ventanal este
      positions[i * 3 + 1] = 0.35 + rand() * 2.2;  // Altura
      positions[i * 3 + 2] = -1.6 + rand() * 3.2;  // Ancho del ventanal
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xfff3c4,
      size: 0.025,
      transparent: true,
      opacity: 0.55
    });
    dustSystem = new THREE.Points(geom, mat);
    scene.add(dustSystem);
  }

  const crosshairEl = document.getElementById('crosshair');
  const promptEl = document.getElementById('interaction-prompt');
  const promptTextEl = document.getElementById('prompt-text');
  const lampsPanelEl = document.getElementById('lamps-panel');

  // Construir toda la escena
  buildRoomArchitecture();
  setupNaturalLighting();
  buildWindowAndExterior();
  buildSofa();
  buildCoffeeTable();
  buildAreaRug();
  buildTVConsoleAndSet();
  buildBookcase();
  buildStudyDesk();
  buildStudyChair();
  buildIndoorPlant();
  buildWallDecorAndDoor();
  buildFloorLamp();
  buildDeskLamp();
  buildSideTableAndLamp();
  buildCeilingChandelier();
  buildSunlightDustMotes();

  // ============================================================================
  // 6. SISTEMA DE COLISIONES (PAREDES + MUEBLES CON DESLIZAMIENTO)
  // ============================================================================

  /**
   * Comprueba si un círculo de radio `r` centrado en `(px, pz)` colisiona con algún
   * límite de pared o caja AABB de mueble. Devuelve el objeto colisionado o `null`.
   */
  function checkPointCollision(px, pz, radius = PLAYER.radius) {
    // 1. Colisión con las 4 paredes de la estancia
    if (px - radius < -ROOM.halfW) return { type: 'wall', id: 'pared_oeste' };
    if (px + radius > ROOM.halfW) return { type: 'wall', id: 'pared_este' };
    if (pz - radius < -ROOM.halfD) return { type: 'wall', id: 'pared_norte' };
    if (pz + radius > ROOM.halfD) return { type: 'wall', id: 'pared_sur' };

    // 2. Colisión círculo contra cada AABB de los muebles
    for (let i = 0; i < state.colliders.length; i++) {
      const box = state.colliders[i];
      const closestX = Math.max(box.minX, Math.min(px, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(pz, box.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      if (dx * dx + dz * dz < radius * radius) {
        return { type: 'furniture', id: box.id, name: box.name };
      }
    }
    return null;
  }

  /**
   * Resuelve el movimiento desde `(startX, startZ)` hacia `(targetX, targetZ)`
   * subdividiendo en pasos pequeños y evaluando X y Z por separado para permitir
   * deslizarse suavemente a lo largo de paredes y muebles sin atravesarlos.
   */
  function resolveMovement(startX, startZ, targetX, targetZ) {
    const totalDX = targetX - startX;
    const totalDZ = targetZ - startZ;
    const dist = Math.hypot(totalDX, totalDZ);
    if (dist < 1e-6) return { x: startX, z: startZ, collided: false };

    const steps = Math.max(1, Math.ceil(dist / 0.08));
    const stepX = totalDX / steps;
    const stepZ = totalDZ / steps;

    let curX = startX;
    let curZ = startZ;
    let collided = false;

    for (let s = 0; s < steps; s++) {
      // Probar avance en X
      const nextX = curX + stepX;
      if (!checkPointCollision(nextX, curZ)) {
        curX = nextX;
      } else {
        collided = true;
      }

      // Probar avance en Z
      const nextZ = curZ + stepZ;
      if (!checkPointCollision(curX, nextZ)) {
        curZ = nextZ;
      } else {
        collided = true;
      }
    }

    return { x: curX, z: curZ, collided };
  }

  // ============================================================================
  // 7. RAYCASTING E INTERACCIÓN CON LÁMPARAS (CLIC, TOQUE, TECLA E Y HUD)
  // ============================================================================

  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.05;
  raycaster.far = 7.5; // Alcance cómodo desde cualquier punto cercano de la habitación

  // Crear botones indicadores en el HUD superior para cada lámpara
  if (lampsPanelEl) {
    state.lamps.forEach((lamp) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hud-btn' + (lamp.isOn ? ' active' : '');
      btn.setAttribute('aria-pressed', String(lamp.isOn));
      btn.innerHTML = `<span class="bulb-indicator"></span><span>${lamp.name}</span>`;
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        lamp.toggle();
      });
      lamp.hudButton = btn;
      lampsPanelEl.appendChild(btn);
    });
  }

  function getInteractiveMeshes() {
    const meshes = [];
    state.lamps.forEach((l) => {
      l.group.traverse((ch) => {
        if (ch.isMesh) meshes.push(ch);
      });
    });
    return meshes;
  }

  /**
   * Lanza un rayo desde coordenadas normalizadas de pantalla `ndcX, ndcY` (por defecto `(0,0)`, centro de la cámara)
   */
  function raycastLampAt(ndcX = 0, ndcY = 0) {
    camera.updateMatrixWorld();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hits = raycaster.intersectObjects(getInteractiveMeshes(), false);
    if (hits.length > 0 && hits[0].object && hits[0].object.userData.lampRef) {
      return hits[0].object.userData.lampRef;
    }
    return null;
  }

  function updateInteractionPrompt() {
    if (!crosshairEl || !promptEl || !promptTextEl) return;
    const lamp = state.hoveredLamp;
    if (lamp) {
      crosshairEl.classList.add('interactive');
      promptEl.classList.add('visible');
      const actionVerb = lamp.isOn ? 'Apagar' : 'Encender';
      promptTextEl.textContent = `${actionVerb} ${lamp.name}`;
    } else {
      crosshairEl.classList.remove('interactive');
      promptEl.classList.remove('visible');
    }
  }

  /**
   * Intenta conmutar una lámpara: primero en el punto de clic/toque `(clientX, clientY)`,
   * y si está en modo mira central (PointerLock), en el centro `(0, 0)`.
   */
  function tryInteractAtScreenPoint(clientX, clientY) {
    if (state.isPointerLocked) {
      const centerLamp = raycastLampAt(0, 0);
      if (centerLamp) {
        centerLamp.toggle();
        return centerLamp;
      }
    }

    if (typeof clientX === 'number' && typeof clientY === 'number') {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const ndcX = (clientX / w) * 2 - 1;
      const ndcY = -(clientY / h) * 2 + 1;
      const clickedLamp = raycastLampAt(ndcX, ndcY);
      if (clickedLamp) {
        clickedLamp.toggle();
        return clickedLamp;
      }
    }

    // Fallback a la lámpara bajo la mira central si hay una apuntada
    const fallbackLamp = raycastLampAt(0, 0);
    if (fallbackLamp) {
      fallbackLamp.toggle();
      return fallbackLamp;
    }
    return null;
  }

  // ============================================================================
  // 8. CONTROLES DE PRIMERA PERSONA (TECLADO, RATÓN Y TÁCTIL MÓVIL)
  // ============================================================================

  const welcomeBannerEl = document.getElementById('welcome-banner');
  const btnLockPointer = document.getElementById('btn-lock-pointer');
  const btnToggleTouch = document.getElementById('btn-toggle-touch');
  const touchControlsEl = document.getElementById('touch-controls');
  const joystickZoneEl = document.getElementById('joystick-zone');
  const joystickKnobEl = document.getElementById('joystick-knob');
  const touchActionBtnEl = document.getElementById('touch-action-btn');

  // Detectar si es dispositivo táctil automáticamente
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (isTouchDevice && touchControlsEl) {
    touchControlsEl.classList.add('enabled');
  }

  if (btnToggleTouch && touchControlsEl) {
    btnToggleTouch.addEventListener('click', (e) => {
      e.stopPropagation();
      touchControlsEl.classList.toggle('enabled');
      btnToggleTouch.classList.toggle('active', touchControlsEl.classList.contains('enabled'));
    });
  }

  // --- Teclado (WASD + Flechas + Tecla E para interactuar) ---
  function onKeyDown(e) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        state.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        state.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        state.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        state.keys.right = true;
        break;
      case 'KeyE':
        if (state.hoveredLamp) {
          state.hoveredLamp.toggle();
        } else {
          const hit = raycastLampAt(0, 0);
          if (hit) hit.toggle();
        }
        break;
    }
  }

  function onKeyUp(e) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        state.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        state.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        state.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        state.keys.right = false;
        break;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // --- Ratón (Pointer Lock + Arrastrar para mirar + Clic para encender/apagar lámparas) ---
  if (btnLockPointer && container) {
    btnLockPointer.addEventListener('click', (e) => {
      e.stopPropagation();
      if (container.requestPointerLock) {
        container.requestPointerLock();
      }
    });
  }

  document.addEventListener('pointerlockchange', () => {
    state.isPointerLocked = (document.pointerLockElement === container);
    if (welcomeBannerEl) {
      welcomeBannerEl.classList.toggle('hidden', state.isPointerLocked);
    }
  });

  if (container) {
    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      state.isDraggingMouse = true;
      state.mouseDragMoved = false;
      state.lastMouseX = e.clientX;
      state.lastMouseY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (state.isPointerLocked) {
        const mx = e.movementX || 0;
        const my = e.movementY || 0;
        state.yaw -= mx * PLAYER.lookSensitivityMouse;
        state.pitch = Math.max(
          -PLAYER.maxPitch,
          Math.min(PLAYER.maxPitch, state.pitch - my * PLAYER.lookSensitivityMouse)
        );
      } else if (state.isDraggingMouse) {
        const dx = e.clientX - state.lastMouseX;
        const dy = e.clientY - state.lastMouseY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          state.mouseDragMoved = true;
        }
        state.lastMouseX = e.clientX;
        state.lastMouseY = e.clientY;
        state.yaw -= dx * PLAYER.lookSensitivityMouse * 1.4;
        state.pitch = Math.max(
          -PLAYER.maxPitch,
          Math.min(PLAYER.maxPitch, state.pitch - dy * PLAYER.lookSensitivityMouse * 1.4)
        );
      } else {
        // Actualizar lámpara apuntada bajo el cursor del ratón cuando no está bloqueado
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        const ndcX = (e.clientX / w) * 2 - 1;
        const ndcY = -(e.clientY / h) * 2 + 1;
        const hovered = raycastLampAt(ndcX, ndcY);
        if (hovered !== state.hoveredLamp) {
          state.hoveredLamp = hovered;
          updateInteractionPrompt();
        }
        container.style.cursor = hovered ? 'pointer' : 'grab';
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      const wasDrag = state.mouseDragMoved;
      state.isDraggingMouse = false;
      if (!wasDrag && e.target === renderer.domElement) {
        tryInteractAtScreenPoint(e.clientX, e.clientY);
      }
    });
  }

  // --- Controles Táctiles en Móvil / Tablet (Joystick Virtual + Mirar + Tocar Lámparas) ---
  const JOYSTICK_MAX_RADIUS = 42;

  function updateJoystickVisual(dxPx, dyPx) {
    if (joystickKnobEl) {
      joystickKnobEl.style.transform = `translate(${dxPx.toFixed(1)}px, ${dyPx.toFixed(1)}px)`;
    }
  }

  if (joystickZoneEl) {
    joystickZoneEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.changedTouches[0];
      const rect = joystickZoneEl.getBoundingClientRect();
      state.joystick.active = true;
      state.joystick.touchId = touch.identifier;
      state.joystick.originX = rect.left + rect.width / 2;
      state.joystick.originY = rect.top + rect.height / 2;
      handleJoystickMove(touch.clientX, touch.clientY);
    }, { passive: false });

    joystickZoneEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      e.stopPropagation();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === state.joystick.touchId) {
          handleJoystickMove(t.clientX, t.clientY);
        }
      }
    }, { passive: false });

    const endJoystick = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === state.joystick.touchId) {
          state.joystick.active = false;
          state.joystick.touchId = null;
          state.joystick.dx = 0;
          state.joystick.dy = 0;
          updateJoystickVisual(0, 0);
        }
      }
    };
    joystickZoneEl.addEventListener('touchend', endJoystick);
    joystickZoneEl.addEventListener('touchcancel', endJoystick);
  }

  function handleJoystickMove(clientX, clientY) {
    let dx = clientX - state.joystick.originX;
    let dy = clientY - state.joystick.originY;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_MAX_RADIUS) {
      dx = (dx / dist) * JOYSTICK_MAX_RADIUS;
      dy = (dy / dist) * JOYSTICK_MAX_RADIUS;
    }
    state.joystick.dx = dx / JOYSTICK_MAX_RADIUS;
    state.joystick.dy = dy / JOYSTICK_MAX_RADIUS;
    updateJoystickVisual(dx, dy);
  }

  // Botón táctil rápido para encender/apagar la lámpara apuntada o más cercana
  if (touchActionBtnEl) {
    touchActionBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const aimed = raycastLampAt(0, 0);
      if (aimed) {
        aimed.toggle();
        return;
      }
      // Si no apunta directamente a una, conmuta la lámpara más cercana al jugador
      let closest = null;
      let minDist = Infinity;
      const pVec = new THREE.Vector3(state.x, state.y, state.z);
      state.lamps.forEach((lamp) => {
        const wPos = new THREE.Vector3();
        lamp.group.getWorldPosition(wPos);
        const d = pVec.distanceTo(wPos);
        if (d < minDist) {
          minDist = d;
          closest = lamp;
        }
      });
      if (closest) closest.toggle();
    });
  }

  // Zona táctil en el lienzo 3D para mirar alrededor y tocar lámparas directamente
  if (container) {
    container.addEventListener('touchstart', (e) => {
      if (touchControlsEl && !touchControlsEl.classList.contains('enabled')) {
        touchControlsEl.classList.add('enabled');
      }
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (!state.touchLook.active && t.identifier !== state.joystick.touchId) {
          state.touchLook.active = true;
          state.touchLook.touchId = t.identifier;
          state.touchLook.startX = t.clientX;
          state.touchLook.startY = t.clientY;
          state.touchLook.lastX = t.clientX;
          state.touchLook.lastY = t.clientY;
          state.touchLook.moved = false;
        }
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (state.touchLook.active && t.identifier === state.touchLook.touchId) {
          const dx = t.clientX - state.touchLook.lastX;
          const dy = t.clientY - state.touchLook.lastY;
          if (Math.hypot(t.clientX - state.touchLook.startX, t.clientY - state.touchLook.startY) > 8) {
            state.touchLook.moved = true;
          }
          state.touchLook.lastX = t.clientX;
          state.touchLook.lastY = t.clientY;
          state.yaw -= dx * PLAYER.lookSensitivityTouch;
          state.pitch = Math.max(
            -PLAYER.maxPitch,
            Math.min(PLAYER.maxPitch, state.pitch - dy * PLAYER.lookSensitivityTouch)
          );
        }
      }
    }, { passive: true });

    const endTouchLook = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (state.touchLook.active && t.identifier === state.touchLook.touchId) {
          if (!state.touchLook.moved) {
            // Fue un toque corto (tap): comprobar si tocó una lámpara
            tryInteractAtScreenPoint(t.clientX, t.clientY);
          }
          state.touchLook.active = false;
          state.touchLook.touchId = null;
        }
      }
    };
    container.addEventListener('touchend', endTouchLook);
    container.addEventListener('touchcancel', endTouchLook);
  }

  // ============================================================================
  // 9. BUCLE DE ACTUALIZACIÓN FÍSICA Y RENDERIZADO FLUIDO
  // ============================================================================

  const fpsCounterEl = document.getElementById('fps-counter');
  const posIndicatorEl = document.getElementById('pos-indicator');

  let lastFrameTime = performance.now();
  let frameCount = 0;
  let fpsTimer = 0;
  let clockTimer = 0;

  /**
   * Avanza la simulación un intervalo `dt` (en segundos).
   * Expuesto también para pruebas deterministas.
   */
  function stepSimulation(dt) {
    const clampedDt = Math.min(Math.max(dt, 0.001), 0.1);

    // Vector de entrada combinando teclado (WASD/Flechas) y joystick táctil
    let moveForward = 0;
    let moveRight = 0;

    if (state.keys.forward) moveForward += 1;
    if (state.keys.backward) moveForward -= 1;
    if (state.keys.right) moveRight += 1;
    if (state.keys.left) moveRight -= 1;

    if (state.joystick.active) {
      moveForward += -state.joystick.dy;
      moveRight += state.joystick.dx;
    }

    const inputLen = Math.hypot(moveForward, moveRight);
    if (inputLen > 1) {
      moveForward /= inputLen;
      moveRight /= inputLen;
    }

    if (inputLen > 0.01) {
      // Dirección horizontal según el ángulo yaw de la cámara
      const sinYaw = Math.sin(state.yaw);
      const cosYaw = Math.cos(state.yaw);

      // En Three.js la cámara mira hacia -Z cuando yaw = 0
      const forwardX = -sinYaw;
      const forwardZ = -cosYaw;
      const rightX = cosYaw;
      const rightZ = -sinYaw;

      const stepDist = PLAYER.moveSpeed * clampedDt;
      const targetX = state.x + (forwardX * moveForward + rightX * moveRight) * stepDist;
      const targetZ = state.z + (forwardZ * moveForward + rightZ * moveRight) * stepDist;

      const res = resolveMovement(state.x, state.z, targetX, targetZ);
      state.x = res.x;
      state.z = res.z;

      // Sutil balanceo natural al caminar (head-bobbing)
      state.walkTime += clampedDt * 8.5 * Math.min(1, inputLen);
      state.y = PLAYER.eyeHeight + Math.sin(state.walkTime) * 0.024;
    } else {
      state.y += (PLAYER.eyeHeight - state.y) * Math.min(1, clampedDt * 10);
    }

    // Actualizar posición y orientación de la cámara
    camera.position.set(state.x, state.y, state.z);
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;

    // Si el puntero está bloqueado o en móvil, comprobar si la mira central apunta a una lámpara
    if (state.isPointerLocked || isTouchDevice) {
      const centerLamp = raycastLampAt(0, 0);
      if (centerLamp !== state.hoveredLamp) {
        state.hoveredLamp = centerLamp;
        updateInteractionPrompt();
      }
    }

    // Animar motas de polvo en el haz de luz solar
    if (dustSystem) {
      dustSystem.rotation.y += clampedDt * 0.02;
    }
  }

  function animate(now) {
    requestAnimationFrame(animate);

    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    stepSimulation(dt);
    renderer.render(scene, camera);

    // Actualizar contador de FPS y coordenadas cada 0.4s
    frameCount++;
    fpsTimer += dt;
    clockTimer += dt;

    if (fpsTimer >= 0.4) {
      const fps = Math.round(frameCount / fpsTimer);
      if (fpsCounterEl) fpsCounterEl.textContent = `${Math.min(144, Math.max(1, fps))} FPS`;
      if (posIndicatorEl) {
        posIndicatorEl.textContent = `Pos: (${state.x.toFixed(1)}, ${state.z.toFixed(1)})`;
      }
      frameCount = 0;
      fpsTimer = 0;
    }

    // Actualizar agujas del reloj de pared cada segundo
    if (clockTimer >= 1.0) {
      clockData.update();
      clockTimer = 0;
    }
  }

  // Adaptación responsiva al redimensionar la ventana
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Posicionar cámara en el estado inicial y arrancar bucle
  stepSimulation(0.016);
  requestAnimationFrame(animate);

  // Exponer API pública para inspección y pruebas automatizadas
  window.Estancia3D = {
    ROOM,
    PLAYER,
    state,
    scene,
    camera,
    renderer,
    checkPointCollision,
    resolveMovement,
    raycastLampAt,
    tryInteractAtScreenPoint,
    stepSimulation,
    handleJoystickMove
  };
})();
