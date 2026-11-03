/* ==========================================================================
   SINTONÍA: TEJEDOR DE FASE — Motor 2D, Física Armónica y Lógica de Juego
   100% Vanilla JavaScript + HTML5 Canvas (Sin dependencias externas)
   ========================================================================== */

(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  const COLORS = {
    cyan: '#00f2fe',
    cyanSoft: 'rgba(0, 242, 254, 0.24)',
    magenta: '#ff2a85',
    magentaSoft: 'rgba(255, 42, 133, 0.24)',
    gold: '#ffd147',
    goldSoft: 'rgba(255, 209, 71, 0.28)',
    white: '#ffffff',
    danger: '#ff4757'
  };

  // ==========================================================================
  // UTILIDADES MATEMÁTICAS Y GEOMÉTRICAS
  // ==========================================================================

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function distSq(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function angleDiff(a, b) {
    let d = (b - a + Math.PI) % TAU - Math.PI;
    return d < -Math.PI ? d + TAU : d;
  }

  // Distancia mínima de un punto (px, py) a un segmento (x1, y1)-(x2, y2)
  function pointToSegmentInfo(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const l2 = vx * vx + vy * vy;
    if (l2 === 0) {
      return { distance: Math.hypot(px - x1, py - y1), cx: x1, cy: y1, t: 0 };
    }
    let t = ((px - x1) * vx + (py - y1) * vy) / l2;
    t = clamp(t, 0, 1);
    const cx = x1 + t * vx;
    const cy = y1 + t * vy;
    return { distance: Math.hypot(px - cx, py - cy), cx, cy, t };
  }

  // Intersección entre dos segmentos AB y CD
  function getSegmentIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
    const rX = bx - ax;
    const rY = by - ay;
    const sX = dx - cx;
    const sY = dy - cy;
    const denom = rX * sY - rY * sX;
    if (Math.abs(denom) < 1e-6) return null;

    const uX = cx - ax;
    const uY = cy - ay;
    const t = (uX * sY - uY * sX) / denom;
    const u = (uX * rY - uY * rX) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: ax + t * rX,
        y: ay + t * rY
      };
    }
    return null;
  }

  // Área con signo mediante fórmula de Gauss (Shoelace)
  function computePolygonArea(poly) {
    if (!poly || poly.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      sum += (p1.x * p2.y - p2.x * p1.y);
    }
    return Math.abs(sum) * 0.5;
  }

  // Comprueba si un punto está dentro del polígono o a menos de `margin` de su borde
  function isPointInOrNearPolygon(px, py, poly, margin = 16) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;

      if (margin > 0) {
        const seg = pointToSegmentInfo(px, py, xi, yi, xj, yj);
        if (seg.distance <= margin) return true;
      }

      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-7) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // ==========================================================================
  // CLASE PRINCIPAL DEL JUEGO
  // ==========================================================================

  class SyntoniaGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d', { alpha: false });

      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Estado general: 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
      this.state = 'MENU';
      this.difficultyMode = 'normal'; // 'normal' | 'intense'

      // Estadísticas y puntuación
      this.score = 0;
      this.displayScore = 0;
      this.highScore = this._loadHighScore();
      this.combo = 0;
      this.maxCombo = 0;
      this.multiplier = 1;
      this.comboTimer = 0;
      this.comboDuration = 4.6;

      this.level = 1;
      this.levelTimer = 0;
      this.levelDuration = 28; // Segundos por nivel de frecuencia
      this.elapsedTime = 0;

      // Contadores de partida para pantalla final
      this.stats = {
        harmonized: 0,
        loopsClosed: 0,
        whipSnaps: 0,
        triadsCompleted: 0
      };

      // Sobrecarga Áurea (0 a 100)
      this.overdriveMeter = 0;
      this.overdriveActive = false;
      this.overdriveTimer = 0;
      this.overdriveMaxDuration = 6.5;

      // Entidades principales: Ancla (Jugador) y Orbe (Satélite)
      this.player = {
        x: this.width * 0.5,
        y: this.height * 0.5,
        vx: 0,
        vy: 0,
        radius: 15,
        speed: 340,
        phase: 'cyan', // 'cyan' | 'magenta'
        integrity: 5,
        maxIntegrity: 5,
        invulnTimer: 0,
        aimAngle: 0
      };

      this.orb = {
        x: this.width * 0.5 + 135,
        y: this.height * 0.5,
        vx: 0,
        vy: 180,
        radius: 17,
        tetherLength: 138,
        whipTimer: 0,
        whipCooldown: 0,
        whipMaxCooldown: 0.95,
        tetherVibration: 0,
        orbitDir: 1
      };

      // Listas de entidades y efectos con límites para garantizar 60 FPS
      this.orbTrail = [];          // Puntos de estela para cerrar lazos
      this.loopFlashes = [];       // Polígonos cerrados animados
      this.enemies = [];           // Anomalías activas
      this.projectiles = [];       // Proyectiles enemigos
      this.triadNodes = [];        // Nodos de la Tríada de Sintonía
      this.triadTimer = 0;
      this.triadSpawnCooldown = 8;
      this.particles = [];         // Partículas visuales
      this.shockwaves = [];        // Ondas expansivas
      this.floatingTexts = [];     // Textos flotantes de puntos/eventos
      this.gridRipples = [];       // Perturbaciones en la malla de fondo

      // Controlador de generación de enemigos
      this.spawnTimer = 0;
      this.nextEnemyId = 1;
      this.bossActive = false;

      // Efectos de cámara
      this.screenShake = 0;
      this.damageFlash = 0;
      this.timeScale = 1.0;

      // Entrada de usuario (Teclado, Ratón y Táctil)
      this.keys = {};
      this.mouse = {
        x: this.width * 0.5,
        y: this.height * 0.5,
        active: false
      };
      this.touch = {
        enabled: false,
        forced: false,
        joyActive: false,
        joyId: null,
        baseX: 95,
        baseY: this.height - 95,
        knobX: 0,
        knobY: 0,
        dx: 0,
        dy: 0
      };

      // Medición de rendimiento (60 FPS)
      this.lastFrameTime = performance.now();
      this.fps = 60;
      this.fpsFrames = 0;
      this.fpsAccum = 0;
      this.bannerTimeout = null;

      this._cacheDOM();
      this._handleResize();
      this._bindEvents();
      this._detectTouchDevice();
      this._updateBestScoreUI();
      this._updateHUD();

      // Iniciar bucle principal a 60 FPS
      requestAnimationFrame((ts) => this._loop(ts));
    }

    // ========================================================================
    // INICIALIZACIÓN DOM Y EVENTOS
    // ========================================================================

    _cacheDOM() {
      this.dom = {
        hud: document.getElementById('hud'),
        integrityPips: document.getElementById('integrity-pips'),
        phaseBadge: document.getElementById('phase-indicator'),
        phaseText: document.getElementById('phase-text'),
        levelText: document.getElementById('level-text'),
        waveBar: document.getElementById('wave-bar-fill'),
        scoreText: document.getElementById('score-text'),
        bestText: document.getElementById('best-score-text'),
        comboBadge: document.getElementById('combo-badge'),
        comboTimerBar: document.getElementById('combo-timer-fill'),
        overdrivePanel: document.getElementById('overdrive-container'),
        overdriveBar: document.getElementById('overdrive-fill'),
        overdriveText: document.getElementById('overdrive-status'),
        fpsBadge: document.getElementById('fps-badge'),
        banner: document.getElementById('announcement-banner'),
        controlsHintBar: document.getElementById('controls-hint-bar'),

        // Pantallas
        startScreen: document.getElementById('start-screen'),
        pauseScreen: document.getElementById('pause-screen'),
        gameOverScreen: document.getElementById('gameover-screen'),
        startBestScore: document.getElementById('start-best-score'),

        // Botones de pantallas
        startBtn: document.getElementById('btn-start-game'),
        modeBtns: document.querySelectorAll('.mode-btn'),
        resumeBtn: document.getElementById('btn-resume'),
        restartPauseBtn: document.getElementById('btn-restart-pause'),
        menuPauseBtn: document.getElementById('btn-menu-pause'),
        replayBtn: document.getElementById('btn-play-again'),
        menuOverBtn: document.getElementById('btn-menu-over'),

        // Botones del HUD
        muteBtn: document.getElementById('btn-mute'),
        touchToggleBtn: document.getElementById('btn-touch-toggle'),
        pauseBtn: document.getElementById('btn-pause'),

        // Controles táctiles
        touchControls: document.getElementById('touch-controls'),
        joystickZone: document.getElementById('touch-joystick-zone'),
        joystickBase: document.getElementById('joystick-base'),
        joystickKnob: document.getElementById('joystick-knob'),
        touchWhipBtn: document.getElementById('touch-btn-whip'),
        touchPhaseBtn: document.getElementById('touch-btn-phase'),
        touchOverdriveBtn: document.getElementById('touch-btn-overdrive'),

        // Estadísticas de fin de partida
        finalScore: document.getElementById('final-score'),
        finalRecordBadge: document.getElementById('final-record-badge'),
        finalRank: document.getElementById('final-rank'),
        finalLevel: document.getElementById('final-level'),
        finalTime: document.getElementById('final-time'),
        finalHarmonized: document.getElementById('final-harmonized'),
        finalLoops: document.getElementById('final-loops'),
        finalMaxCombo: document.getElementById('final-max-combo'),
        finalTriads: document.getElementById('final-triads')
      };
    }

    _handleResize() {
      this.width = Math.max(320, window.innerWidth);
      this.height = Math.max(320, window.innerHeight);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // Mantener el ancla dentro de los nuevos límites
      this.player.x = clamp(this.player.x, 40, this.width - 40);
      this.player.y = clamp(this.player.y, 60, this.height - 40);
    }

    _detectTouchDevice() {
      const hasTouch = ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (window.innerWidth <= 820);
      if (hasTouch) {
        this._setTouchUI(true);
      }
    }

    _setTouchUI(visible) {
      this.touch.enabled = visible;
      if (!this.dom.touchControls) return;
      if (visible && this.state === 'PLAYING') {
        this.dom.touchControls.classList.remove('hidden');
        this.dom.controlsHintBar.classList.add('hidden');
      } else {
        this.dom.touchControls.classList.add('hidden');
        if (this.state === 'PLAYING' && !visible) {
          this.dom.controlsHintBar.classList.remove('hidden');
        }
      }
    }

    _bindEvents() {
      window.addEventListener('resize', () => this._handleResize());

      // Teclado
      window.addEventListener('keydown', (e) => {
        if (global.SyntoniaAudio) global.SyntoniaAudio.init();
        this.keys[e.code] = true;

        if (this.state === 'MENU') {
          if (e.code === 'Enter' || e.code === 'Space') {
            e.preventDefault();
            this.startGame();
          }
          return;
        }

        if (this.state === 'GAMEOVER') {
          if (e.code === 'Enter' || e.code === 'Space') {
            e.preventDefault();
            this.startGame();
          }
          return;
        }

        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          this.togglePause();
          return;
        }

        if (e.code === 'KeyM') {
          this._toggleAudio();
          return;
        }

        if (this.state !== 'PLAYING') return;

        // Latigazo de Tensión
        if (e.code === 'Space' || e.code === 'KeyJ') {
          e.preventDefault();
          this.triggerWhipSnap(false);
        }

        // Cambio de Polaridad (Fase Cian <-> Magenta)
        if (
          e.code === 'ShiftLeft' ||
          e.code === 'ShiftRight' ||
          e.code === 'KeyQ' ||
          e.code === 'KeyK'
        ) {
          e.preventDefault();
          this.switchPhase();
        }

        // Sobrecarga Áurea
        if (e.code === 'KeyE' || e.code === 'KeyR' || e.code === 'KeyL') {
          e.preventDefault();
          this.triggerOverdrive();
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
      });

      // Ratón sobre el lienzo
      this.canvas.addEventListener('mousemove', (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.active = true;
      });

      this.canvas.addEventListener('mousedown', (e) => {
        if (global.SyntoniaAudio) global.SyntoniaAudio.init();
        if (this.state !== 'PLAYING') return;
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.active = true;

        if (e.button === 0) {
          this.triggerWhipSnap(true);
        } else if (e.button === 2) {
          this.switchPhase();
        } else if (e.button === 1) {
          e.preventDefault();
          this.triggerOverdrive();
        }
      });

      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      // Botones de Modo en pantalla de inicio
      this.dom.modeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (global.SyntoniaAudio) global.SyntoniaAudio.playUIClick();
          this.dom.modeBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.difficultyMode = btn.dataset.mode || 'normal';
        });
      });

      // Botones principales de UI
      this.dom.startBtn.addEventListener('click', () => {
        if (global.SyntoniaAudio) global.SyntoniaAudio.playUIClick();
        this.startGame();
      });

      this.dom.resumeBtn.addEventListener('click', () => {
        if (global.SyntoniaAudio) global.SyntoniaAudio.playUIClick();
        this.togglePause();
      });

      this.dom.restartPauseBtn.addEventListener('click', () => {
        if (global.SyntoniaAudio) global.SyntoniaAudio.playUIClick();
        this.startGame();
      });

      this.dom.menuPauseBtn.addEventListener('click', () => {
        if (global.SyntoniaAudio) global.SyntoniaAudio.playUIClick();
        this.returnToMenu();
      });

      this.dom.replayBtn.addEventListener('click', () => {
        if (global.SyntoniaAudio) global.SyntoniaAudio.playUIClick();
        this.startGame();
      });

      this.dom.menuOverBtn.addEventListener('click', () => {
        if (global.SyntoniaAudio) global.SyntoniaAudio.playUIClick();
        this.returnToMenu();
      });

      this.dom.muteBtn.addEventListener('click', () => this._toggleAudio());
      this.dom.pauseBtn.addEventListener('click', () => this.togglePause());
      this.dom.touchToggleBtn.addEventListener('click', () => {
        this.touch.forced = !this.touch.enabled;
        this._setTouchUI(!this.touch.enabled);
      });

      // Controles Táctiles: Joystick Virtual Izquierdo
      this._bindTouchControls();
    }

    _bindTouchControls() {
      const zone = this.dom.joystickZone;
      const maxRadius = 52;

      const updateJoystick = (clientX, clientY) => {
        const dx = clientX - this.touch.baseX;
        const dy = clientY - this.touch.baseY;
        const distance = Math.hypot(dx, dy);
        const clamped = Math.min(distance, maxRadius);
        const angle = Math.atan2(dy, dx);

        this.touch.knobX = Math.cos(angle) * clamped;
        this.touch.knobY = Math.sin(angle) * clamped;
        this.touch.dx = distance > 4 ? (this.touch.knobX / maxRadius) : 0;
        this.touch.dy = distance > 4 ? (this.touch.knobY / maxRadius) : 0;

        this.dom.joystickKnob.style.transform =
          `translate(${this.touch.knobX.toFixed(1)}px, ${this.touch.knobY.toFixed(1)}px)`;
      };

      const resetJoystick = () => {
        this.touch.joyActive = false;
        this.touch.joyId = null;
        this.touch.dx = 0;
        this.touch.dy = 0;
        this.dom.joystickKnob.style.transform = 'translate(0px, 0px)';
      };

      zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (global.SyntoniaAudio) global.SyntoniaAudio.init();
        if (this.touch.joyActive) return;
        const t = e.changedTouches[0];
        this.touch.joyActive = true;
        this.touch.joyId = t.identifier;
        this.touch.baseX = clamp(t.clientX, 70, this.width * 0.45);
        this.touch.baseY = clamp(t.clientY, this.height * 0.35, this.height - 70);

        this.dom.joystickBase.style.left = `${this.touch.baseX}px`;
        this.dom.joystickBase.style.bottom = `${this.height - this.touch.baseY}px`;
        updateJoystick(t.clientX, t.clientY);
      }, { passive: false });

      zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!this.touch.joyActive) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.touch.joyId) {
            updateJoystick(t.clientX, t.clientY);
            break;
          }
        }
      }, { passive: false });

      const handleJoyEnd = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.touch.joyId) {
            resetJoystick();
            break;
          }
        }
      };

      zone.addEventListener('touchend', handleJoyEnd);
      zone.addEventListener('touchcancel', handleJoyEnd);

      // Soporte de arrastre con ratón en el joystick virtual (útil en portátiles táctiles/pruebas)
      let mouseJoyDown = false;
      zone.addEventListener('mousedown', (e) => {
        if (!this.touch.enabled) return;
        mouseJoyDown = true;
        this.touch.joyActive = true;
        this.touch.baseX = clamp(e.clientX, 70, this.width * 0.45);
        this.touch.baseY = clamp(e.clientY, this.height * 0.35, this.height - 70);
        this.dom.joystickBase.style.left = `${this.touch.baseX}px`;
        this.dom.joystickBase.style.bottom = `${this.height - this.touch.baseY}px`;
        updateJoystick(e.clientX, e.clientY);
      });
      window.addEventListener('mousemove', (e) => {
        if (mouseJoyDown) updateJoystick(e.clientX, e.clientY);
      });
      window.addEventListener('mouseup', () => {
        if (mouseJoyDown) {
          mouseJoyDown = false;
          resetJoystick();
        }
      });

      // Botones táctiles derechos
      const bindTouchAction = (btn, actionFn) => {
        btn.addEventListener('touchstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (global.SyntoniaAudio) global.SyntoniaAudio.init();
          btn.classList.add('pressed');
          actionFn();
        }, { passive: false });

        btn.addEventListener('touchend', () => btn.classList.remove('pressed'));
        btn.addEventListener('touchcancel', () => btn.classList.remove('pressed'));
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          actionFn();
        });
      };

      bindTouchAction(this.dom.touchWhipBtn, () => this.triggerWhipSnap(false));
      bindTouchAction(this.dom.touchPhaseBtn, () => this.switchPhase());
      bindTouchAction(this.dom.touchOverdriveBtn, () => this.triggerOverdrive());
    }

    _toggleAudio() {
      if (!global.SyntoniaAudio) return;
      const muted = global.SyntoniaAudio.toggleMute();
      this.dom.muteBtn.textContent = muted ? '🔇 Sonido' : '🔊 Sonido';
    }

    // ========================================================================
    // GESTIÓN DE ESTADO DEL JUEGO (INICIO, PAUSA, FIN, MENÚ)
    // ========================================================================

    startGame() {
      if (global.SyntoniaAudio) global.SyntoniaAudio.init();

      this.state = 'PLAYING';
      this.score = 0;
      this.displayScore = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.multiplier = 1;
      this.comboTimer = 0;

      this.level = 1;
      this.levelTimer = 0;
      this.elapsedTime = 0;

      this.stats = {
        harmonized: 0,
        loopsClosed: 0,
        whipSnaps: 0,
        triadsCompleted: 0
      };

      this.overdriveMeter = 0;
      this.overdriveActive = false;
      this.overdriveTimer = 0;

      // Reiniciar Ancla y Orbe en el centro de la cámara
      this.player.x = this.width * 0.5;
      this.player.y = this.height * 0.5;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.phase = 'cyan';
      this.player.integrity = 5;
      this.player.maxIntegrity = 5;
      this.player.invulnTimer = 1.0;

      this.orb.x = this.player.x + 135;
      this.orb.y = this.player.y;
      this.orb.vx = 0;
      this.orb.vy = 210;
      this.orb.whipTimer = 0;
      this.orb.whipCooldown = 0;
      this.orb.tetherVibration = 0;
      this.orb.orbitDir = 1;

      this.orbTrail = [];
      this.loopFlashes = [];
      this.enemies = [];
      this.projectiles = [];
      this.triadNodes = [];
      this.triadTimer = 0;
      this.triadSpawnCooldown = 7;
      this.particles = [];
      this.shockwaves = [];
      this.floatingTexts = [];
      this.gridRipples = [];
      this.bossActive = false;
      this.spawnTimer = 0.8;
      this.screenShake = 0;
      this.damageFlash = 0;
      this.timeScale = 1.0;

      // Actualizar pantallas
      this.dom.startScreen.classList.add('hidden');
      this.dom.pauseScreen.classList.add('hidden');
      this.dom.gameOverScreen.classList.add('hidden');
      this.dom.hud.classList.remove('hidden');

      this._setTouchUI(this.touch.enabled || ('ontouchstart' in window) || window.innerWidth <= 820);
      this._buildIntegrityPips();
      this._updateHUD();

      // Generar primeras anomalías para acción inmediata
      this._spawnWaveInitial();
      this.showAnnouncement('NIVEL DE FRECUENCIA 1 — ¡SINTONIZA Y CIERRA LAZOS!', 'cyan');
    }

    togglePause() {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
        this.dom.pauseScreen.classList.remove('hidden');
        this.dom.touchControls.classList.add('hidden');
      } else if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        this.dom.pauseScreen.classList.add('hidden');
        this._setTouchUI(this.touch.enabled);
        this.lastFrameTime = performance.now();
      }
    }

    returnToMenu() {
      this.state = 'MENU';
      this.dom.hud.classList.add('hidden');
      this.dom.pauseScreen.classList.add('hidden');
      this.dom.gameOverScreen.classList.add('hidden');
      this.dom.touchControls.classList.add('hidden');
      this.dom.controlsHintBar.classList.add('hidden');
      this.dom.startScreen.classList.remove('hidden');
      this._updateBestScoreUI();
    }

    triggerGameOver() {
      this.state = 'GAMEOVER';
      if (global.SyntoniaAudio) global.SyntoniaAudio.playGameOver();

      const isNewRecord = this.score > this.highScore;
      if (isNewRecord) {
        this.highScore = this.score;
        this._saveHighScore(this.highScore);
      }

      this.dom.hud.classList.add('hidden');
      this.dom.touchControls.classList.add('hidden');
      this.dom.controlsHintBar.classList.add('hidden');
      this.dom.gameOverScreen.classList.remove('hidden');

      // Poblar estadísticas finales
      this.dom.finalScore.textContent = Math.floor(this.score).toLocaleString('es-ES');
      if (isNewRecord && this.score > 0) {
        this.dom.finalRecordBadge.classList.remove('hidden');
      } else {
        this.dom.finalRecordBadge.classList.add('hidden');
      }

      this.dom.finalRank.textContent = this._calculateRankTitle(this.score);
      this.dom.finalLevel.textContent = `Nivel ${this.level}`;
      this.dom.finalTime.textContent = this._formatTime(this.elapsedTime);
      this.dom.finalHarmonized.textContent = String(this.stats.harmonized);
      this.dom.finalLoops.textContent = String(this.stats.loopsClosed);
      this.dom.finalMaxCombo.textContent = `×${Math.max(1, this.maxCombo)}`;
      this.dom.finalTriads.textContent = String(this.stats.triadsCompleted);

      this._updateBestScoreUI();
    }

    _calculateRankTitle(score) {
      if (score >= 35000) return '★ ARQUITECTO SUPREMO DE LA SINTONÍA ★';
      if (score >= 20000) return '◆ MAESTRO DEL LAZO CUÁNTICO ◆';
      if (score >= 10000) return '❖ TEJEDOR ARMÓNICO MAYOR ❖';
      if (score >= 4500) return '◈ RESONADOR CINÉTICO ◈';
      return '◇ INICIADO DE FASE ◇';
    }

    _formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // ========================================================================
    // ACCIONES DEL JUGADOR (CAMBIO DE FASE, LATIGAZO Y SOBRECARGA)
    // ========================================================================

    switchPhase() {
      if (this.state !== 'PLAYING') return;
      this.player.phase = this.player.phase === 'cyan' ? 'magenta' : 'cyan';
      this.orb.tetherVibration = Math.max(this.orb.tetherVibration, 0.55);

      if (global.SyntoniaAudio) {
        global.SyntoniaAudio.playPhaseSwitch(this.player.phase);
      }

      // Pequeño pulso visual alrededor del Ancla y el Orbe
      const col = this.getActiveColor();
      this._addShockwave(this.player.x, this.player.y, 44, col, 0.25);
      this._addShockwave(this.orb.x, this.orb.y, 38, col, 0.25);
      this._updateHUD();
    }

    triggerWhipSnap(towardMouse = false) {
      if (this.state !== 'PLAYING') return;
      if (this.orb.whipCooldown > 0) return;

      this.orb.whipCooldown = this.overdriveActive ? 0.55 : this.orb.whipMaxCooldown;
      this.orb.whipTimer = 0.38;
      this.orb.tetherVibration = 1.0;
      this.orb.orbitDir *= -1;
      this.stats.whipSnaps++;

      // Determinar ángulo de lanzamiento:
      // Si se hizo clic con ratón, lanza el Orbe hacia el cursor;
      // Si fue con Espacio o Botón Táctil, cruza el Orbe al lado opuesto del Ancla.
      let launchAngle;
      if (towardMouse && this.mouse.active) {
        launchAngle = Math.atan2(this.mouse.y - this.player.y, this.mouse.x - this.player.x);
      } else {
        const moveMag = Math.hypot(this.player.vx, this.player.vy);
        if (moveMag > 60) {
          launchAngle = Math.atan2(this.player.vy, this.player.vx);
        } else {
          // Cruzar al lado exactamente opuesto del Ancla como un latigazo
          launchAngle = Math.atan2(this.player.y - this.orb.y, this.player.x - this.orb.x);
        }
      }

      const whipSpeed = this.overdriveActive ? 1320 : 1160;
      this.orb.vx = Math.cos(launchAngle) * whipSpeed;
      this.orb.vy = Math.sin(launchAngle) * whipSpeed;

      if (global.SyntoniaAudio) global.SyntoniaAudio.playWhipSnap();

      this._addGridRipple(this.orb.x, this.orb.y, 90, 0.45);
      this._spawnParticles(this.orb.x, this.orb.y, 12, this.getActiveColor(), 220);
    }

    triggerOverdrive() {
      if (this.state !== 'PLAYING') return;
      if (this.overdriveActive || this.overdriveMeter < 100) return;

      this.overdriveMeter = 0;
      this.overdriveActive = true;
      this.overdriveTimer = this.overdriveMaxDuration;
      this.orb.whipCooldown = 0;
      this.orb.tetherVibration = 1.2;

      if (global.SyntoniaAudio) global.SyntoniaAudio.playOverdriveStart();

      this._addShockwave(this.player.x, this.player.y, 260, COLORS.gold, 0.55);
      this._addGridRipple(this.player.x, this.player.y, 180, 0.8);
      this._spawnFloatingText(this.player.x, this.player.y - 34, '¡FASE ÁUREA DUAL!', COLORS.gold, 1.1);
      this.showAnnouncement('★ SOBRECARGA ÁUREA: ARMONIZA AMBAS POLARIDADES ★', 'gold');
      this._updateHUD();
    }

    getActiveColor() {
      if (this.overdriveActive) return COLORS.gold;
      return this.player.phase === 'cyan' ? COLORS.cyan : COLORS.magenta;
    }

    doesPhaseMatch(targetPhase) {
      if (this.overdriveActive) return true;
      return this.player.phase === targetPhase;
    }

    // ========================================================================
    // BUCLE PRINCIPAL (60 FPS CON DELTA TIME ESTABLE)
    // ========================================================================

    _loop(timestamp) {
      const rawDt = (timestamp - this.lastFrameTime) / 1000;
      this.lastFrameTime = timestamp;

      // Limitar dt para evitar saltos bruscos al cambiar de pestaña
      const dt = Math.min(rawDt, 0.05);

      // Cálculo de FPS real
      this.fpsFrames++;
      this.fpsAccum += rawDt;
      if (this.fpsAccum >= 0.5) {
        this.fps = Math.min(60, Math.round(this.fpsFrames / this.fpsAccum));
        this.fpsFrames = 0;
        this.fpsAccum = 0;
        if (this.dom.fpsBadge) {
          this.dom.fpsBadge.textContent = `${this.fps} FPS`;
        }
      }

      if (this.state === 'PLAYING') {
        this.update(dt * this.timeScale);
      } else if (this.state === 'MENU') {
        this._updateMenuDemo(dt);
      }

      this.render();
      requestAnimationFrame((ts) => this._loop(ts));
    }

    // Simulación autónoma de fondo mientras se muestra el menú inicial
    _updateMenuDemo(dt) {
      this.elapsedTime += dt;
      const cx = this.width * 0.5;
      const cy = this.height * 0.5;
      this.player.x = cx + Math.cos(this.elapsedTime * 0.7) * 90;
      this.player.y = cy + Math.sin(this.elapsedTime * 1.1) * 60;
      this.orb.x = this.player.x + Math.cos(this.elapsedTime * 2.6) * 135;
      this.orb.y = this.player.y + Math.sin(this.elapsedTime * 2.6) * 135;

      this.orbTrail.push({ x: this.orb.x, y: this.orb.y, age: 0, maxAge: 1.4 });
      for (let i = this.orbTrail.length - 1; i >= 0; i--) {
        this.orbTrail[i].age += dt;
        if (this.orbTrail[i].age >= this.orbTrail[i].maxAge) {
          this.orbTrail.splice(i, 1);
        }
      }
    }

    // ========================================================================
    // ACTUALIZACIÓN DE FÍSICA Y LÓGICA DE PARTIDA
    // ========================================================================

    update(dt) {
      this.elapsedTime += dt;

      // Suavizado del marcador numérico
      if (this.displayScore < this.score) {
        this.displayScore = Math.min(
          this.score,
          this.displayScore + Math.max(15, (this.score - this.displayScore) * 12 * dt)
        );
      }

      // Recuperación de cámara lenta y sacudida
      this.timeScale = lerp(this.timeScale, 1.0, dt * 8);
      this.screenShake = Math.max(0, this.screenShake - dt * 28);
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);

      if (this.player.invulnTimer > 0) {
        this.player.invulnTimer = Math.max(0, this.player.invulnTimer - dt);
      }

      // Temporizador de Combo
      if (this.combo > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.combo = 0;
          this.multiplier = 1;
          this.comboTimer = 0;
        }
      }

      // Temporizador de Sobrecarga Áurea
      if (this.overdriveActive) {
        this.overdriveTimer -= dt;
        if (this.overdriveTimer <= 0) {
          this.overdriveActive = false;
          this.overdriveTimer = 0;
          this._updateHUD();
        }
      }

      // Escalado progresivo de Nivel de Frecuencia
      this.levelTimer += dt;
      if (this.levelTimer >= this.levelDuration) {
        this.levelTimer -= this.levelDuration;
        this.level++;
        if (global.SyntoniaAudio) global.SyntoniaAudio.playLevelUp();
        this._addShockwave(this.player.x, this.player.y, 320, COLORS.cyan, 0.5);
        this.showAnnouncement(
          `⚡ NIVEL DE FRECUENCIA ${this.level} — ¡DENSIDAD INCREMENTADA!`,
          this.level % 3 === 0 ? 'magenta' : 'cyan'
        );

        // Cada 3 niveles aparece un Arconte de Discordia (Jefe)
        if (this.level % 3 === 0 && !this.bossActive) {
          this._spawnBossArchon();
        }
      }

      // 1. Actualizar movimiento del Ancla (Jugador)
      this._updatePlayerPhysics(dt);

      // 2. Actualizar física elástica/pendular del Orbe y Estela
      this._updateOrbAndTrail(dt);

      // 3. Actualizar Tríadas de Sintonía
      this._updateTriads(dt);

      // 4. Generar y actualizar Anomalías (Enemigos)
      this._updateEnemies(dt);

      // 5. Actualizar Proyectiles
      this._updateProjectiles(dt);

      // 6. Actualizar Efectos Visuales (Partículas, Ondas, Textos, Malla)
      this._updateEffects(dt);

      // 7. Refrescar HUD
      this._updateHUD();
    }

    _updatePlayerPhysics(dt) {
      let ix = 0;
      let iy = 0;

      if (this.keys['KeyW'] || this.keys['ArrowUp']) iy -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) iy += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) ix -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) ix += 1;

      // Combinar con Joystick Táctil si está activo
      if (this.touch.joyActive) {
        ix += this.touch.dx;
        iy += this.touch.dy;
      }

      const mag = Math.hypot(ix, iy);
      if (mag > 1) {
        ix /= mag;
        iy /= mag;
      }

      const maxSpeed = this.player.speed * (this.overdriveActive ? 1.2 : 1.0);
      const targetVx = ix * maxSpeed;
      const targetVy = iy * maxSpeed;

      const accel = 14;
      this.player.vx = lerp(this.player.vx, targetVx, clamp(accel * dt, 0, 1));
      this.player.vy = lerp(this.player.vy, targetVy, clamp(accel * dt, 0, 1));

      this.player.x += this.player.vx * dt;
      this.player.y += this.player.vy * dt;

      // Límites de la cámara armónica
      const padX = 32;
      const padTop = 76;
      const padBottom = 36;
      if (this.player.x < padX) { this.player.x = padX; this.player.vx *= -0.4; }
      if (this.player.x > this.width - padX) { this.player.x = this.width - padX; this.player.vx *= -0.4; }
      if (this.player.y < padTop) { this.player.y = padTop; this.player.vy *= -0.4; }
      if (this.player.y > this.height - padBottom) { this.player.y = this.height - padBottom; this.player.vy *= -0.4; }
    }

    _updateOrbAndTrail(dt) {
      if (this.orb.whipCooldown > 0) {
        this.orb.whipCooldown = Math.max(0, this.orb.whipCooldown - dt);
      }
      if (this.orb.whipTimer > 0) {
        this.orb.whipTimer = Math.max(0, this.orb.whipTimer - dt);
      }
      this.orb.tetherVibration = Math.max(0, this.orb.tetherVibration - dt * 1.8);

      const targetLen = this.overdriveActive ? 172 : this.orb.tetherLength;
      const dx = this.orb.x - this.player.x;
      const dy = this.orb.y - this.player.y;
      const currentDist = Math.hypot(dx, dy) || 0.001;
      const nx = dx / currentDist;
      const ny = dy / currentDist;

      // Fuerza elástica de la Cuerda de Fase (Ley de Hooke amortiguada)
      const stretch = currentDist - targetLen;
      const springK = this.orb.whipTimer > 0 ? 11.5 : 16.0;
      this.orb.vx -= nx * stretch * springK * dt;
      this.orb.vy -= ny * stretch * springK * dt;

      // Impulso orbital tangencial suave para que el Orbe siempre orbite con elegancia
      const tx = -ny * this.orb.orbitDir;
      const ty = nx * this.orb.orbitDir;
      const orbitalForce = this.orb.whipTimer > 0 ? 90 : 210;
      this.orb.vx += tx * orbitalForce * dt;
      this.orb.vy += ty * orbitalForce * dt;

      // Amortiguación aerodinámica
      const damping = this.orb.whipTimer > 0 ? 0.988 : 0.962;
      this.orb.vx *= Math.pow(damping, dt * 60);
      this.orb.vy *= Math.pow(damping, dt * 60);

      // Límite máximo de estiramiento de la cuerda
      const maxStretch = targetLen * 1.65;
      if (currentDist > maxStretch) {
        this.orb.x = this.player.x + nx * maxStretch;
        this.orb.y = this.player.y + ny * maxStretch;
      }

      const prevOrbX = this.orb.x;
      const prevOrbY = this.orb.y;

      this.orb.x += this.orb.vx * dt;
      this.orb.y += this.orb.vy * dt;

      // Rebote suave del Orbe contra los bordes de la pantalla
      const margin = 20;
      if (this.orb.x < margin) { this.orb.x = margin; this.orb.vx = Math.abs(this.orb.vx) * 0.85; }
      if (this.orb.x > this.width - margin) { this.orb.x = this.width - margin; this.orb.vx = -Math.abs(this.orb.vx) * 0.85; }
      if (this.orb.y < margin + 48) { this.orb.y = margin + 48; this.orb.vy = Math.abs(this.orb.vy) * 0.85; }
      if (this.orb.y > this.height - margin) { this.orb.y = this.height - margin; this.orb.vy = -Math.abs(this.orb.vy) * 0.85; }

      // Registrar segmento en la Estela del Orbe y comprobar cierre de Lazo Armónico
      const movedDist = Math.hypot(this.orb.x - prevOrbX, this.orb.y - prevOrbY);
      if (movedDist >= 7) {
        this._recordOrbTrailPoint(this.orb.x, this.orb.y);
      }

      // Envejecer puntos de la estela
      for (let i = this.orbTrail.length - 1; i >= 0; i--) {
        this.orbTrail[i].age += dt;
        if (this.orbTrail[i].age >= this.orbTrail[i].maxAge) {
          this.orbTrail.splice(i, 1);
        }
      }

      for (let i = this.loopFlashes.length - 1; i >= 0; i--) {
        this.loopFlashes[i].age += dt;
        if (this.loopFlashes[i].age >= this.loopFlashes[i].maxAge) {
          this.loopFlashes.splice(i, 1);
        }
      }
    }

    // Registra un nuevo punto en la estela y detecta auto-intersección para cerrar un Lazo Armónico
    _recordOrbTrailPoint(nx, ny) {
      const maxAge = this.overdriveActive ? 2.65 : 1.95;
      const n = this.orbTrail.length;

      if (n >= 6) {
        const lastPt = this.orbTrail[n - 1];
        // Buscar si el nuevo segmento (lastPt -> (nx, ny)) corta algún segmento anterior de la estela
        for (let i = 0; i < n - 4; i++) {
          const a = this.orbTrail[i];
          const b = this.orbTrail[i + 1];
          const hit = getSegmentIntersection(a.x, a.y, b.x, b.y, lastPt.x, lastPt.y, nx, ny);
          if (hit) {
            const loopPoly = [{ x: hit.x, y: hit.y }];
            for (let k = i + 1; k < n; k++) {
              loopPoly.push({ x: this.orbTrail[k].x, y: this.orbTrail[k].y });
            }
            const area = computePolygonArea(loopPoly);
            if (area >= 2200) {
              this._triggerHarmonicLoopCollapse(loopPoly);
              // Consumir la parte de la estela usada para evitar dobles disparos
              this.orbTrail = [{ x: nx, y: ny, age: 0, maxAge }];
              return;
            }
          }
        }
      }

      this.orbTrail.push({ x: nx, y: ny, age: 0, maxAge });
      if (this.orbTrail.length > 95) {
        this.orbTrail.shift();
      }
    }

    // Ejecuta el Colapso Armónico dentro de un polígono cerrado por la estela del Orbe
    _triggerHarmonicLoopCollapse(poly) {
      this.stats.loopsClosed++;
      const col = this.getActiveColor();

      // Calcular centroide del lazo
      let cx = 0, cy = 0;
      for (let i = 0; i < poly.length; i++) {
        cx += poly[i].x;
        cy += poly[i].y;
      }
      cx /= poly.length;
      cy /= poly.length;

      this.loopFlashes.push({
        poly,
        cx,
        cy,
        color: col,
        age: 0,
        maxAge: 0.65
      });

      this._addGridRipple(cx, cy, 160, 0.7);
      this._addShockwave(cx, cy, 140, col, 0.45);

      let capturedEnemies = 0;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (isPointInOrNearPolygon(e.x, e.y, poly, e.radius + 14)) {
          capturedEnemies++;
          this._harmonizeEnemy(i, 'loop');
        }
      }

      // Purificar también proyectiles dentro del lazo
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        if (isPointInOrNearPolygon(p.x, p.y, poly, p.radius + 10)) {
          this._spawnParticles(p.x, p.y, 5, COLORS.gold, 120);
          this.projectiles.splice(i, 1);
          this.score += 35 * this.multiplier;
        }
      }

      // Activar Nodos de Tríada que queden dentro del lazo
      for (let i = 0; i < this.triadNodes.length; i++) {
        const node = this.triadNodes[i];
        if (!node.activated && isPointInOrNearPolygon(node.x, node.y, poly, node.radius + 12)) {
          this._activateTriadNode(node);
        }
      }

      if (global.SyntoniaAudio) {
        global.SyntoniaAudio.playLoopCollapse(capturedEnemies);
      }

      if (capturedEnemies > 0) {
        const loopBonus = capturedEnemies * 250 * this.multiplier;
        this.score += loopBonus;
        this._addOverdrive(10 + capturedEnemies * 7);

        if (capturedEnemies >= 3 && this.player.integrity < this.player.maxIntegrity) {
          this.player.integrity++;
          this._buildIntegrityPips();
          this._spawnFloatingText(
            cx,
            cy - 24,
            `¡CONSTELACIÓN ×${capturedEnemies}! +1 ESCUDO`,
            COLORS.gold,
            1.25
          );
        } else {
          this._spawnFloatingText(
            cx,
            cy,
            `¡LAZO ARMÓNICO ×${capturedEnemies}! +${loopBonus}`,
            col,
            1.1
          );
        }
      } else {
        // Incluso un lazo vacío da un pequeño pulso resonante
        this.score += 50 * this.multiplier;
        this._addOverdrive(4);
        this._spawnFloatingText(cx, cy, 'LAZO DE FASE +50', col, 0.85);
      }
    }

    // ========================================================================
    // TRÍADAS DE SINTONÍA (OBJETIVOS DINÁMICOS DE ARENA)
    // ========================================================================

    _updateTriads(dt) {
      if (this.triadNodes.length === 0) {
        this.triadSpawnCooldown -= dt;
        if (this.triadSpawnCooldown <= 0) {
          this._spawnTriadFormation();
        }
        return;
      }

      this.triadTimer -= dt;
      if (this.triadTimer <= 0) {
        this.triadNodes = [];
        this.triadSpawnCooldown = 14;
        return;
      }

      // Comprobar si el Orbe o la Cuerda de Fase tocan algún nodo de la Tríada
      for (let i = 0; i < this.triadNodes.length; i++) {
        const node = this.triadNodes[i];
        if (node.activated) continue;

        const dOrb = dist(this.orb.x, this.orb.y, node.x, node.y);
        const seg = pointToSegmentInfo(
          node.x,
          node.y,
          this.player.x,
          this.player.y,
          this.orb.x,
          this.orb.y
        );

        if (dOrb <= this.orb.radius + node.radius || seg.distance <= node.radius + 6) {
          this._activateTriadNode(node);
        }
      }
    }

    _spawnTriadFormation() {
      const cx = this.width * 0.5;
      const cy = this.height * 0.52;
      const spread = Math.min(this.width, this.height) * 0.27;
      const baseAngle = Math.random() * TAU;

      this.triadNodes = [];
      for (let i = 0; i < 3; i++) {
        const ang = baseAngle + (i * TAU) / 3;
        this.triadNodes.push({
          x: clamp(cx + Math.cos(ang) * spread, 70, this.width - 70),
          y: clamp(cy + Math.sin(ang) * spread, 105, this.height - 70),
          radius: 20,
          activated: false,
          pulse: i * 2
        });
      }
      this.triadTimer = 14.5;
      this.showAnnouncement('△ TRÍADA DE SINTONÍA ACTIVA — CONECTA LOS 3 NODOS △', 'gold');
    }

    _activateTriadNode(node) {
      if (node.activated) return;
      node.activated = true;

      const activeCount = this.triadNodes.filter((n) => n.activated).length;
      if (global.SyntoniaAudio) global.SyntoniaAudio.playTriadNode(activeCount);

      this._addShockwave(node.x, node.y, 70, COLORS.gold, 0.35);
      this._spawnParticles(node.x, node.y, 14, COLORS.gold, 180);

      if (activeCount >= 3) {
        // ¡Tríada completada!
        this.stats.triadsCompleted++;
        const pts = 1000 * this.multiplier;
        this.score += pts;
        this._addOverdrive(35);

        if (this.player.integrity < this.player.maxIntegrity) {
          this.player.integrity++;
          this._buildIntegrityPips();
        }

        // Limpiar proyectiles enemigos en pantalla
        for (let i = 0; i < this.projectiles.length; i++) {
          this._spawnParticles(this.projectiles[i].x, this.projectiles[i].y, 6, COLORS.gold, 140);
        }
        this.projectiles = [];

        const cx = (this.triadNodes[0].x + this.triadNodes[1].x + this.triadNodes[2].x) / 3;
        const cy = (this.triadNodes[0].y + this.triadNodes[1].y + this.triadNodes[2].y) / 3;
        this._addShockwave(cx, cy, 340, COLORS.gold, 0.65);
        this._addGridRipple(cx, cy, 220, 0.9);
        this._spawnFloatingText(cx, cy, `¡TRÍADA ARMÓNICA! +${pts}`, COLORS.gold, 1.25);

        this.triadNodes = [];
        this.triadSpawnCooldown = 16;
      } else {
        this._spawnFloatingText(node.x, node.y - 18, `NODO ${activeCount}/3`, COLORS.gold, 0.85);
      }
    }

    // ========================================================================
    // SISTEMA DE ANOMALÍAS (ENEMIGOS) Y DIFICULTAD PROGRESIVA
    // ========================================================================

    _spawnWaveInitial() {
      this._spawnEnemy('drifter', 'cyan');
      this._spawnEnemy('drifter', 'magenta');
      if (this.difficultyMode === 'intense') {
        this._spawnEnemy('alternator', 'cyan');
      }
    }

    _updateEnemies(dt) {
      // Intervalo de aparición que disminuye progresivamente con el nivel
      const modeFactor = this.difficultyMode === 'intense' ? 0.74 : 1.0;
      const spawnInterval = Math.max(0.62, (2.25 - this.level * 0.18) * modeFactor);

      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.enemies.length < 28) {
        this.spawnTimer = spawnInterval;
        this._spawnProceduralWaveUnit();
      }

      // Actualizar cada anomalía y comprobar colisiones con Orbe, Cuerda y Ancla
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (!e) continue;

        e.age += dt;
        e.rot += e.rotSpeed * dt;
        if (e.deflectCooldown > 0) e.deflectCooldown -= dt;

        // Comportamiento según arquetipo
        const toPlayerAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        const distToPlayer = Math.hypot(this.player.x - e.x, this.player.y - e.y);

        if (e.type === 'alternator') {
          e.flipTimer -= dt;
          if (e.flipTimer <= 0) {
            e.phase = e.phase === 'cyan' ? 'magenta' : 'cyan';
            e.flipTimer = e.flipInterval;
            this._addShockwave(e.x, e.y, e.radius * 2.1, e.phase === 'cyan' ? COLORS.cyan : COLORS.magenta, 0.22);
          }
        }

        if (e.type === 'caster') {
          // Mantiene distancia media y orbita disparando proyectiles de fase
          const preferredDist = 250;
          const radialPull = clamp((distToPlayer - preferredDist) / 140, -0.8, 1.0);
          const orbitAngle = toPlayerAngle + Math.PI * 0.38 * e.orbitSign;
          const targetAngle = lerp(orbitAngle, toPlayerAngle, Math.max(0, radialPull));

          e.vx = lerp(e.vx, Math.cos(targetAngle) * e.speed, dt * 3.5);
          e.vy = lerp(e.vy, Math.sin(targetAngle) * e.speed, dt * 3.5);

          e.fireTimer -= dt;
          if (e.fireTimer <= 0) {
            e.fireTimer = Math.max(1.9, 3.3 - this.level * 0.12);
            this._fireEnemyProjectile(e, toPlayerAngle);
          }
        } else if (e.type === 'shielded') {
          // Prisma Blindado gira su escudo frontal hacia el Ancla
          e.facing = e.facing + angleDiff(e.facing, toPlayerAngle) * Math.min(1, dt * 3.2);
          e.vx = lerp(e.vx, Math.cos(toPlayerAngle) * e.speed, dt * 3.0);
          e.vy = lerp(e.vy, Math.sin(toPlayerAngle) * e.speed, dt * 3.0);
        } else if (e.type === 'archon') {
          // Jefe Arconte de Discordia
          const preferredDist = 210;
          const pull = clamp((distToPlayer - preferredDist) / 150, -0.6, 1.0);
          const moveAng = toPlayerAngle + Math.PI * 0.35;
          e.vx = lerp(e.vx, (Math.cos(moveAng) * 0.7 + Math.cos(toPlayerAngle) * pull) * e.speed, dt * 2.5);
          e.vy = lerp(e.vy, (Math.sin(moveAng) * 0.7 + Math.sin(toPlayerAngle) * pull) * e.speed, dt * 2.5);

          e.fireTimer -= dt;
          if (e.fireTimer <= 0) {
            e.fireTimer = 2.2;
            for (let k = -1; k <= 1; k++) {
              this._fireEnemyProjectile(e, toPlayerAngle + k * 0.28);
            }
          }
        } else {
          // Deriva y Enjambre Fulsar
          const weave = Math.sin(e.age * 3.2 + e.id) * 0.32;
          e.vx = lerp(e.vx, Math.cos(toPlayerAngle + weave) * e.speed, dt * 3.8);
          e.vy = lerp(e.vy, Math.sin(toPlayerAngle + weave) * e.speed, dt * 3.8);
        }

        e.x += e.vx * dt;
        e.y += e.vy * dt;

        // 1) Comprobar colisión con el ORBE o la CUERDA DE FASE
        const dOrb = dist(e.x, e.y, this.orb.x, this.orb.y);
        const hitByOrb = dOrb <= e.radius + this.orb.radius + 4;

        const segInfo = pointToSegmentInfo(
          e.x,
          e.y,
          this.player.x,
          this.player.y,
          this.orb.x,
          this.orb.y
        );
        const tetherThickness = this.orb.whipTimer > 0 ? 14 : 8;
        const hitByTether = segInfo.distance <= e.radius + tetherThickness && segInfo.t > 0.14;

        if (hitByOrb || hitByTether) {
          const isWhipActive = this.orb.whipTimer > 0;
          const phaseMatches = this.doesPhaseMatch(e.phase);

          // Comprobar si es un Prisma Blindado bloqueando de frente sin Latigazo ni Sobrecarga
          let blockedByShield = false;
          if (e.type === 'shielded' && !isWhipActive && !this.overdriveActive) {
            const impactX = hitByOrb ? this.orb.x : segInfo.cx;
            const impactY = hitByOrb ? this.orb.y : segInfo.cy;
            const attackAngle = Math.atan2(impactY - e.y, impactX - e.x);
            if (Math.abs(angleDiff(e.facing, attackAngle)) < 1.15) {
              blockedByShield = true;
            }
          }

          if (phaseMatches && !blockedByShield) {
            this._harmonizeEnemy(i, isWhipActive ? 'whip' : 'tether');
            continue;
          } else if (e.deflectCooldown <= 0) {
            // Polaridad opuesta o escudo frontal: chispa de repulsión física
            e.deflectCooldown = 0.24;
            this.orb.tetherVibration = Math.max(this.orb.tetherVibration, 0.7);
            const pushX = e.x - (hitByOrb ? this.orb.x : segInfo.cx);
            const pushY = e.y - (hitByOrb ? this.orb.y : segInfo.cy);
            const pushLen = Math.hypot(pushX, pushY) || 1;
            e.vx = (pushX / pushLen) * 290;
            e.vy = (pushY / pushLen) * 290;

            if (global.SyntoniaAudio) global.SyntoniaAudio.playDeflect();
            this._spawnParticles(
              hitByOrb ? this.orb.x : segInfo.cx,
              hitByOrb ? this.orb.y : segInfo.cy,
              7,
              '#ffffff',
              150
            );
            if (blockedByShield) {
              this._spawnFloatingText(e.x, e.y - 20, '¡USA LATIGAZO O LAZO!', '#ffffff', 0.75);
            }
          }
        }

        // 2) Comprobar colisión con el ANCLA (Jugador vulnerable)
        if (distToPlayer <= e.radius + this.player.radius - 2) {
          this._damagePlayer(e.x, e.y);
          // Empujar o destruir la anomalía tras impactar al Ancla
          if (e.type !== 'archon') {
            this.enemies.splice(i, 1);
          } else {
            const angleAway = Math.atan2(e.y - this.player.y, e.x - this.player.x);
            e.vx = Math.cos(angleAway) * 320;
            e.vy = Math.sin(angleAway) * 320;
          }
        }
      }
    }

    _spawnProceduralWaveUnit() {
      const phase = Math.random() < 0.5 ? 'cyan' : 'magenta';
      const r = Math.random();

      if (this.level === 1) {
        if (r < 0.25) {
          this._spawnSwarmCluster(phase, 4);
        } else {
          this._spawnEnemy('drifter', phase);
        }
      } else if (this.level === 2) {
        if (r < 0.30) {
          this._spawnEnemy('alternator', phase);
        } else if (r < 0.52) {
          this._spawnSwarmCluster(phase, 4);
        } else {
          this._spawnEnemy('drifter', phase);
        }
      } else if (this.level === 3) {
        if (r < 0.26) {
          this._spawnEnemy('caster', phase);
        } else if (r < 0.52) {
          this._spawnEnemy('alternator', phase);
        } else if (r < 0.74) {
          this._spawnSwarmCluster(phase, 5);
        } else {
          this._spawnEnemy('drifter', phase);
        }
      } else {
        // Nivel 4 en adelante: todos los arquetipos incluidos Prismas Blindados
        if (r < 0.22) {
          this._spawnEnemy('shielded', phase);
        } else if (r < 0.44) {
          this._spawnEnemy('caster', phase);
        } else if (r < 0.68) {
          this._spawnEnemy('alternator', phase);
        } else if (r < 0.85) {
          this._spawnSwarmCluster(phase, 5);
        } else {
          this._spawnEnemy('drifter', phase);
        }
      }
    }

    _getPerimeterSpawnPoint(margin = 36) {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) return { x: Math.random() * this.width, y: -margin };
      if (side === 1) return { x: this.width + margin, y: Math.random() * this.height };
      if (side === 2) return { x: Math.random() * this.width, y: this.height + margin };
      return { x: -margin, y: Math.random() * this.height };
    }

    _spawnEnemy(type, phase, customX = null, customY = null) {
      const pos = (customX !== null && customY !== null)
        ? { x: customX, y: customY }
        : this._getPerimeterSpawnPoint(34);

      const speedScale = (1 + (this.level - 1) * 0.08) * (this.difficultyMode === 'intense' ? 1.15 : 1.0);
      let radius = 17;
      let baseSpeed = 95;
      let hp = 1;

      if (type === 'swarm') {
        radius = 11;
        baseSpeed = 135;
      } else if (type === 'alternator') {
        radius = 19;
        baseSpeed = 88;
      } else if (type === 'caster') {
        radius = 20;
        baseSpeed = 82;
      } else if (type === 'shielded') {
        radius = 22;
        baseSpeed = 76;
      } else if (type === 'archon') {
        radius = 36;
        baseSpeed = 68;
        hp = 3;
      }

      const enemy = {
        id: this.nextEnemyId++,
        type,
        phase,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        radius,
        speed: baseSpeed * speedScale,
        hp,
        maxHp: hp,
        age: 0,
        rot: Math.random() * TAU,
        rotSpeed: (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random() * 1.4),
        flipTimer: 3.4,
        flipInterval: Math.max(2.2, 3.6 - this.level * 0.12),
        fireTimer: 1.8 + Math.random() * 1.2,
        orbitSign: Math.random() < 0.5 ? 1 : -1,
        facing: Math.atan2(this.player.y - pos.y, this.player.x - pos.x),
        deflectCooldown: 0
      };

      this.enemies.push(enemy);
      return enemy;
    }

    _spawnSwarmCluster(phase, count = 4) {
      const origin = this._getPerimeterSpawnPoint(40);
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * TAU;
        this._spawnEnemy(
          'swarm',
          phase,
          origin.x + Math.cos(ang) * 26,
          origin.y + Math.sin(ang) * 26
        );
      }
    }

    _spawnBossArchon() {
      this.bossActive = true;
      const phase = Math.random() < 0.5 ? 'cyan' : 'magenta';
      this._spawnEnemy('archon', phase);
      this.showAnnouncement('⚠ ARCONTE DE DISCORDIA DETECTADO — ¡ROMPE SUS 3 SELLOS! ⚠', 'magenta');
    }

    // Armoniza (destruye o daña) una anomalía en el índice `index`
    _harmonizeEnemy(index, method = 'tether') {
      const e = this.enemies[index];
      if (!e) return;

      // Si es el Jefe Arconte y aún tiene sellos (>1 HP), pierde un sello y cambia de polaridad
      if (e.type === 'archon' && e.hp > 1 && method !== 'loop') {
        e.hp--;
        e.phase = e.phase === 'cyan' ? 'magenta' : 'cyan';
        e.deflectCooldown = 0.45;
        this.orb.tetherVibration = 1.0;
        this.screenShake = Math.max(this.screenShake, 7);

        const col = e.phase === 'cyan' ? COLORS.cyan : COLORS.magenta;
        this._addShockwave(e.x, e.y, 110, col, 0.38);
        this._spawnParticles(e.x, e.y, 20, col, 240);
        this._spawnFloatingText(e.x, e.y - 30, `¡SELLO ROTO! (${e.hp} RESTANTES)`, COLORS.gold, 1.0);
        if (global.SyntoniaAudio) global.SyntoniaAudio.playHarmonize(this.combo + 2, e.phase);
        return;
      }

      this.enemies.splice(index, 1);
      this.stats.harmonized++;

      // Incrementar Combo y Multiplicador
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.comboTimer = this.comboDuration;
      this.multiplier = Math.min(12, 1 + Math.floor(this.combo / 3));

      let basePts = 100;
      if (e.type === 'swarm') basePts = 65;
      else if (e.type === 'alternator') basePts = 140;
      else if (e.type === 'caster') basePts = 180;
      else if (e.type === 'shielded') basePts = 220;
      else if (e.type === 'archon') {
        basePts = 1500;
        this.bossActive = false;
      }

      if (method === 'whip') {
        basePts = Math.round(basePts * 1.4);
        // Reducir enfriamiento del Latigazo al encadenar bajas
        this.orb.whipCooldown = Math.max(0, this.orb.whipCooldown - 0.35);
      }

      const gained = basePts * this.multiplier;
      this.score += gained;
      this._addOverdrive(e.type === 'archon' ? 45 : 7);

      const col = e.phase === 'cyan' ? COLORS.cyan : COLORS.magenta;
      this.orb.tetherVibration = Math.min(1.2, this.orb.tetherVibration + 0.35);
      this.screenShake = Math.max(this.screenShake, e.type === 'archon' ? 12 : 3.5);

      this._addShockwave(e.x, e.y, e.radius * 2.6, col, 0.3);
      this._addGridRipple(e.x, e.y, 85, 0.4);
      this._spawnParticles(e.x, e.y, e.type === 'archon' ? 36 : 14, col, 210);

      if (method !== 'loop') {
        this._spawnFloatingText(e.x, e.y - 12, `+${gained}`, col, 0.85);
      }

      if (global.SyntoniaAudio && method !== 'loop') {
        global.SyntoniaAudio.playHarmonize(this.combo, e.phase);
      }
    }

    // ========================================================================
    // PROYECTILES Y SISTEMA DE DAÑO AL ANCLA
    // ========================================================================

    _fireEnemyProjectile(enemy, angle) {
      const speed = 205 + this.level * 12;
      this.projectiles.push({
        x: enemy.x + Math.cos(angle) * (enemy.radius + 6),
        y: enemy.y + Math.sin(angle) * (enemy.radius + 6),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 7,
        phase: enemy.phase,
        age: 0
      });
    }

    _updateProjectiles(dt) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Fuera de pantalla
        if (
          p.x < -30 || p.x > this.width + 30 ||
          p.y < -30 || p.y > this.height + 30 ||
          p.age > 8
        ) {
          this.projectiles.splice(i, 1);
          continue;
        }

        // El Orbe o un Latigazo de la misma polaridad pueden cortar y disipar proyectiles
        const dOrb = dist(p.x, p.y, this.orb.x, this.orb.y);
        const seg = pointToSegmentInfo(p.x, p.y, this.player.x, this.player.y, this.orb.x, this.orb.y);
        const canSliceProj = this.doesPhaseMatch(p.phase) && (dOrb <= this.orb.radius + p.radius + 4 || (this.orb.whipTimer > 0 && seg.distance <= 16));

        if (canSliceProj) {
          const pts = 40 * this.multiplier;
          this.score += pts;
          this._addOverdrive(3);
          this._spawnParticles(p.x, p.y, 6, p.phase === 'cyan' ? COLORS.cyan : COLORS.magenta, 130);
          this.projectiles.splice(i, 1);
          continue;
        }

        // Impacto contra el Ancla
        if (dist(p.x, p.y, this.player.x, this.player.y) <= this.player.radius + p.radius) {
          this.projectiles.splice(i, 1);
          this._damagePlayer(p.x, p.y);
        }
      }
    }

    _damagePlayer(sourceX, sourceY) {
      if (this.player.invulnTimer > 0 || this.state !== 'PLAYING') return;

      this.player.integrity = Math.max(0, this.player.integrity - 1);
      this.player.invulnTimer = 1.45;
      this.combo = 0;
      this.multiplier = 1;
      this.comboTimer = 0;
      this.screenShake = 14;
      this.damageFlash = 0.75;

      if (global.SyntoniaAudio) global.SyntoniaAudio.playDamage();

      // Onda de choque defensiva que aparta enemigos cercanos para evitar muertes injustas
      this._addShockwave(this.player.x, this.player.y, 180, COLORS.danger, 0.45);
      this._addGridRipple(this.player.x, this.player.y, 170, 0.75);
      this._spawnParticles(this.player.x, this.player.y, 24, COLORS.danger, 260);
      this._spawnFloatingText(this.player.x, this.player.y - 26, '¡IMPACTO EN EL ANCLA!', COLORS.danger, 1.1);

      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        const d = dist(this.player.x, this.player.y, e.x, e.y);
        if (d < 190 && d > 0.01) {
          const ang = Math.atan2(e.y - this.player.y, e.x - this.player.x);
          e.vx = Math.cos(ang) * 340;
          e.vy = Math.sin(ang) * 340;
        }
      }

      this._buildIntegrityPips();
      this._updateHUD();

      if (this.player.integrity <= 0) {
        this.triggerGameOver();
      }
    }

    _addOverdrive(amount) {
      if (this.overdriveActive) return;
      const wasReady = this.overdriveMeter >= 100;
      this.overdriveMeter = clamp(this.overdriveMeter + amount, 0, 100);
      if (!wasReady && this.overdriveMeter >= 100) {
        this.showAnnouncement('★ SOBRECARGA ÁUREA LISTA — PULSA [E] / [R] O EL BOTÓN ÁUREO ★', 'gold');
      }
    }

    // ========================================================================
    // EFECTOS VISUALES Y ACTUALIZACIÓN DEL HUD
    // ========================================================================

    _spawnParticles(x, y, count, color, maxSpeed = 180) {
      // Límite estricto de partículas para mantener 60 FPS en cualquier portátil
      const available = Math.max(0, 180 - this.particles.length);
      const n = Math.min(count, available);
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * TAU;
        const spd = (0.25 + Math.random() * 0.75) * maxSpeed;
        this.particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 2 + Math.random() * 3.2,
          color,
          age: 0,
          maxAge: 0.32 + Math.random() * 0.32
        });
      }
    }

    _addShockwave(x, y, maxRadius, color, duration = 0.35) {
      if (this.shockwaves.length > 20) this.shockwaves.shift();
      this.shockwaves.push({ x, y, maxRadius, color, age: 0, maxAge: duration });
    }

    _addGridRipple(x, y, radius, duration = 0.55) {
      if (this.gridRipples.length > 10) this.gridRipples.shift();
      this.gridRipples.push({ x, y, radius, age: 0, maxAge: duration });
    }

    _spawnFloatingText(x, y, text, color, scale = 1.0) {
      if (this.floatingTexts.length > 18) this.floatingTexts.shift();
      this.floatingTexts.push({
        x,
        y,
        text,
        color,
        scale,
        age: 0,
        maxAge: 0.95
      });
    }

    _updateEffects(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.age += dt;
        if (p.age >= p.maxAge) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
      }

      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        this.shockwaves[i].age += dt;
        if (this.shockwaves[i].age >= this.shockwaves[i].maxAge) {
          this.shockwaves.splice(i, 1);
        }
      }

      for (let i = this.gridRipples.length - 1; i >= 0; i--) {
        this.gridRipples[i].age += dt;
        if (this.gridRipples[i].age >= this.gridRipples[i].maxAge) {
          this.gridRipples.splice(i, 1);
        }
      }

      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.age += dt;
        ft.y -= 28 * dt;
        if (ft.age >= ft.maxAge) {
          this.floatingTexts.splice(i, 1);
        }
      }
    }

    showAnnouncement(message, style = 'cyan') {
      if (!this.dom.banner) return;
      this.dom.banner.textContent = message;
      this.dom.banner.className = `visible ${style}`;
      if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
      this.bannerTimeout = setTimeout(() => {
        if (this.dom.banner) this.dom.banner.classList.remove('visible');
      }, 3100);
    }

    _buildIntegrityPips() {
      if (!this.dom.integrityPips) return;
      this.dom.integrityPips.innerHTML = '';
      const isLow = this.player.integrity <= 2;
      for (let i = 0; i < this.player.maxIntegrity; i++) {
        const pip = document.createElement('span');
        pip.className = 'integrity-pip' +
          (i < this.player.integrity ? ' active' : '') +
          (isLow ? ' low' : '');
        this.dom.integrityPips.appendChild(pip);
      }
    }

    _updateHUD() {
      if (!this.dom.scoreText) return;
      this.dom.scoreText.textContent = Math.floor(this.displayScore).toLocaleString('es-ES');
      this.dom.bestText.textContent = `RÉCORD: ${Math.floor(Math.max(this.score, this.highScore)).toLocaleString('es-ES')}`;
      this.dom.comboBadge.textContent = `×${this.multiplier}`;

      const comboPct = this.combo > 0 ? clamp((this.comboTimer / this.comboDuration) * 100, 0, 100) : 0;
      this.dom.comboTimerBar.style.width = `${comboPct.toFixed(1)}%`;

      this.dom.levelText.textContent = `FRECUENCIA NV. ${this.level}`;
      const wavePct = clamp((this.levelTimer / this.levelDuration) * 100, 0, 100);
      this.dom.waveBar.style.width = `${wavePct.toFixed(1)}%`;

      // Estado de Polaridad
      if (this.overdriveActive) {
        this.dom.phaseBadge.className = 'phase-indicator gold';
        this.dom.phaseText.textContent = 'FASE ÁUREA ★';
      } else if (this.player.phase === 'cyan') {
        this.dom.phaseBadge.className = 'phase-indicator cyan';
        this.dom.phaseText.textContent = 'FASE CIAN (+)';
      } else {
        this.dom.phaseBadge.className = 'phase-indicator magenta';
        this.dom.phaseText.textContent = 'FASE MAGENTA (-)';
      }

      // Botón táctil de fase
      if (this.dom.touchPhaseBtn) {
        this.dom.touchPhaseBtn.classList.toggle('cyan-mode', this.player.phase === 'cyan');
      }

      // Barra de Sobrecarga Áurea
      const odPct = this.overdriveActive
        ? (this.overdriveTimer / this.overdriveMaxDuration) * 100
        : this.overdriveMeter;
      this.dom.overdriveBar.style.width = `${clamp(odPct, 0, 100).toFixed(1)}%`;

      const ready = !this.overdriveActive && this.overdriveMeter >= 100;
      this.dom.overdrivePanel.classList.toggle('overdrive-ready', ready);
      if (this.dom.touchOverdriveBtn) {
        this.dom.touchOverdriveBtn.classList.toggle('ready', ready);
      }

      if (this.overdriveActive) {
        this.dom.overdriveText.textContent = '¡ACTIVA!';
      } else if (ready) {
        this.dom.overdriveText.textContent = '¡LISTA [E]!';
      } else {
        this.dom.overdriveText.textContent = `${Math.floor(this.overdriveMeter)}%`;
      }
    }

    _loadHighScore() {
      try {
        const val = localStorage.getItem('syntonia_highscore_v1');
        return val ? parseInt(val, 10) || 0 : 0;
      } catch (e) {
        return 0;
      }
    }

    _saveHighScore(score) {
      try {
        localStorage.setItem('syntonia_highscore_v1', String(Math.floor(score)));
      } catch (e) {}
    }

    _updateBestScoreUI() {
      if (this.dom.startBestScore) {
        this.dom.startBestScore.textContent =
          `Mejor Puntuación Registrada: ${Math.floor(this.highScore).toLocaleString('es-ES')} pts`;
      }
    }

    // ========================================================================
    // RENDERIZADO EN CANVAS 2D (60 FPS, GEOMETRÍA SAGRADA Y NEÓN)
    // ========================================================================

    render() {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      // Fondo profundo
      ctx.fillStyle = '#060914';
      ctx.fillRect(0, 0, w, h);

      ctx.save();

      // Sacudida de pantalla si existe
      if (this.screenShake > 0.2) {
        const sx = (Math.random() - 0.5) * this.screenShake;
        const sy = (Math.random() - 0.5) * this.screenShake;
        ctx.translate(sx, sy);
      }

      // 1. Malla geométrica reactiva de fondo
      this._renderReactiveGrid(ctx, w, h);

      // 2. Destellos de Lazos Armónicos cerrados
      this._renderLoopFlashes(ctx);

      // 3. Nodos de Tríada de Sintonía
      this._renderTriads(ctx);

      // 4. Estela luminosa del Orbe
      this._renderOrbTrail(ctx);

      // 5. Cuerda de Fase (con ondas estacionarias de vibración)
      this._renderPhaseTether(ctx);

      // 6. Anomalías (Enemigos) y Proyectiles
      this._renderProjectiles(ctx);
      this._renderEnemies(ctx);

      // 7. Ancla (Jugador) y Orbe Armónico
      this._renderAnchorAndOrb(ctx);

      // 8. Partículas, Ondas de Choque y Textos Flotantes
      this._renderEffects(ctx);

      ctx.restore();

      // Flash rojo de daño en los bordes si acaban de golpear al Ancla
      if (this.damageFlash > 0.01) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 50, 75, ${(this.damageFlash * 0.28).toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }

    _renderReactiveGrid(ctx, w, h) {
      const spacing = 64;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(70, 115, 210, 0.11)';

      const displacePoint = (gx, gy) => {
        let ox = gx;
        let oy = gy;

        // Deformación suave alrededor del Orbe
        const dxO = gx - this.orb.x;
        const dyO = gy - this.orb.y;
        const dOSq = dxO * dxO + dyO * dyO;
        if (dOSq < 19600 && dOSq > 1) {
          const dO = Math.sqrt(dOSq);
          const f = (1 - dO / 140) * 11;
          ox += (dxO / dO) * f;
          oy += (dyO / dO) * f;
        }

        // Ondas en la malla
        for (let i = 0; i < this.gridRipples.length; i++) {
          const r = this.gridRipples[i];
          const dx = gx - r.x;
          const dy = gy - r.y;
          const dSq = dx * dx + dy * dy;
          const maxR = r.radius;
          if (dSq < maxR * maxR && dSq > 1) {
            const d = Math.sqrt(dSq);
            const prog = r.age / r.maxAge;
            const wave = Math.sin((d / maxR - prog) * Math.PI * 3) * (1 - prog) * 14;
            ox += (dx / d) * wave;
            oy += (dy / d) * wave;
          }
        }
        return { x: ox, y: oy };
      };

      ctx.beginPath();
      for (let x = 0; x <= w + spacing; x += spacing) {
        for (let y = 0; y <= h + spacing; y += spacing) {
          const p = displacePoint(x, y);
          if (y === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
      }
      for (let y = 0; y <= h + spacing; y += spacing) {
        for (let x = 0; x <= w + spacing; x += spacing) {
          const p = displacePoint(x, y);
          if (x === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }

    _renderLoopFlashes(ctx) {
      for (let i = 0; i < this.loopFlashes.length; i++) {
        const lf = this.loopFlashes[i];
        const alpha = 1 - lf.age / lf.maxAge;
        if (lf.poly.length < 3) continue;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(lf.poly[0].x, lf.poly[0].y);
        for (let k = 1; k < lf.poly.length; k++) {
          ctx.lineTo(lf.poly[k].x, lf.poly[k].y);
        }
        ctx.closePath();

        ctx.fillStyle = lf.color === COLORS.cyan
          ? `rgba(0, 242, 254, ${(alpha * 0.28).toFixed(3)})`
          : lf.color === COLORS.magenta
            ? `rgba(255, 42, 133, ${(alpha * 0.28).toFixed(3)})`
            : `rgba(255, 209, 71, ${(alpha * 0.32).toFixed(3)})`;
        ctx.fill();

        ctx.lineWidth = 3 * alpha + 1;
        ctx.strokeStyle = lf.color;
        ctx.stroke();
        ctx.restore();
      }
    }

    _renderTriads(ctx) {
      if (this.triadNodes.length === 0) return;

      ctx.save();
      // Líneas de constelación entre los 3 nodos
      ctx.beginPath();
      for (let i = 0; i < this.triadNodes.length; i++) {
        const n1 = this.triadNodes[i];
        const n2 = this.triadNodes[(i + 1) % this.triadNodes.length];
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
      }
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 209, 71, 0.35)';
      ctx.stroke();
      ctx.setLineDash([]);

      // Dibujar cada nodo triangular
      for (let i = 0; i < this.triadNodes.length; i++) {
        const node = this.triadNodes[i];
        const col = node.activated ? COLORS.gold : 'rgba(255, 209, 71, 0.65)';

        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.rotate(this.elapsedTime * (node.activated ? 2.2 : 0.8) + node.pulse);

        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const ang = (k * TAU) / 3 - Math.PI / 2;
          const r = node.radius;
          if (k === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
          else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx.closePath();

        if (node.activated) {
          ctx.fillStyle = 'rgba(255, 209, 71, 0.32)';
          ctx.fill();
        }
        ctx.lineWidth = node.activated ? 3 : 2;
        ctx.strokeStyle = col;
        ctx.stroke();

        ctx.restore();
      }
      ctx.restore();
    }

    _renderOrbTrail(ctx) {
      if (this.orbTrail.length < 2) return;
      const col = this.getActiveColor();

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < this.orbTrail.length; i++) {
        const p0 = this.orbTrail[i - 1];
        const p1 = this.orbTrail[i];
        const life = 1 - p1.age / p1.maxAge;
        if (life <= 0) continue;

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineWidth = Math.max(1.5, 7 * life);
        ctx.strokeStyle = col;
        ctx.globalAlpha = life * 0.65;
        ctx.stroke();
      }
      ctx.restore();
    }

    _renderPhaseTether(ctx) {
      const ax = this.player.x;
      const ay = this.player.y;
      const bx = this.orb.x;
      const by = this.orb.y;

      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const col = this.getActiveColor();
      const vibAmp = (this.orb.tetherVibration * 14) + (this.orb.whipTimer > 0 ? 8 : 1.5);
      const segments = 16;

      ctx.save();

      // Halo exterior de la cuerda
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const env = Math.sin(t * Math.PI);
        const wave = Math.sin(t * Math.PI * 4 + this.elapsedTime * 38) * vibAmp * env;
        ctx.lineTo(ax + dx * t + nx * wave, ay + dy * t + ny * wave);
      }
      ctx.lineTo(bx, by);

      ctx.strokeStyle = col;
      ctx.globalAlpha = this.orb.whipTimer > 0 ? 0.45 : 0.26;
      ctx.lineWidth = this.orb.whipTimer > 0 ? 14 : 9;
      ctx.stroke();

      // Filamento central brillante
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = this.orb.whipTimer > 0 ? 4.5 : 2.6;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.restore();
    }

    _renderAnchorAndOrb(ctx) {
      const col = this.getActiveColor();

      // 1) Dibujar el ANCLA (Nave del Jugador)
      ctx.save();
      ctx.translate(this.player.x, this.player.y);

      // Parpadeo si está en periodo de invulnerabilidad post-impacto
      if (this.player.invulnTimer > 0 && Math.floor(this.player.invulnTimer * 16) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }

      // Anillo exterior de integridad
      ctx.beginPath();
      ctx.arc(0, 0, this.player.radius + 7, 0, TAU);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha *= 0.55;
      ctx.stroke();

      ctx.globalAlpha = 1.0;
      ctx.rotate(this.elapsedTime * 1.4);

      // Octágono sagrado del Ancla
      ctx.beginPath();
      const sides = 6;
      for (let i = 0; i < sides; i++) {
        const ang = (i * TAU) / sides;
        const r = this.player.radius;
        if (i === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
        else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fillStyle = '#0b132b';
      ctx.fill();
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = col;
      ctx.stroke();

      // Núcleo blanco del Ancla
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // 2) Dibujar el ORBE ARMÓNICO (Satélite Cortante)
      ctx.save();
      ctx.translate(this.orb.x, this.orb.y);

      const orbRadius = this.orb.radius + (this.orb.whipTimer > 0 ? 4 : 0);

      // Halo luminoso del Orbe
      ctx.beginPath();
      ctx.arc(0, 0, orbRadius + 8, 0, TAU);
      ctx.fillStyle = this.overdriveActive
        ? COLORS.goldSoft
        : (this.player.phase === 'cyan' ? COLORS.cyanSoft : COLORS.magentaSoft);
      ctx.fill();

      // Anillo giratorio interior del Orbe
      ctx.rotate(-this.elapsedTime * 3.5);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ang = (i * TAU) / 4;
        const r = orbRadius;
        if (i === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
        else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Esfera central del Orbe
      ctx.beginPath();
      ctx.arc(0, 0, orbRadius * 0.65, 0, TAU);
      ctx.fillStyle = col;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, orbRadius * 0.32, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    }

    _renderEnemies(ctx) {
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        const col = e.phase === 'cyan' ? COLORS.cyan : COLORS.magenta;
        const matches = this.doesPhaseMatch(e.phase);

        ctx.save();
        ctx.translate(e.x, e.y);

        // Indicador sutil cuando la anomalía coincide con tu polaridad activa (vulnerable al corte)
        if (matches) {
          ctx.beginPath();
          ctx.arc(0, 0, e.radius + 5, 0, TAU);
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.32;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }

        // Si es un Oscilador a punto de cambiar de fase, dibujar anillo de aviso
        if (e.type === 'alternator' && e.flipTimer < 1.0) {
          const nextCol = e.phase === 'cyan' ? COLORS.magenta : COLORS.cyan;
          ctx.beginPath();
          ctx.arc(0, 0, e.radius + 4 + e.flipTimer * 10, 0, TAU);
          ctx.strokeStyle = nextCol;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Si es un Prisma Blindado, dibujar el arco reflector frontal
        if (e.type === 'shielded') {
          ctx.beginPath();
          ctx.arc(0, 0, e.radius + 7, e.facing - 1.1, e.facing + 1.1);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4;
          ctx.stroke();
        }

        ctx.rotate(e.rot);

        // Geometría según el tipo de anomalía
        ctx.beginPath();
        const sides = e.type === 'swarm' ? 3
          : e.type === 'drifter' ? 4
            : e.type === 'shielded' ? 5
              : e.type === 'alternator' ? 6
                : 8;

        for (let k = 0; k < sides; k++) {
          const ang = (k * TAU) / sides;
          const r = e.radius;
          if (k === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
          else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx.closePath();

        ctx.fillStyle = e.phase === 'cyan' ? 'rgba(0, 45, 65, 0.85)' : 'rgba(65, 10, 40, 0.85)';
        ctx.fill();
        ctx.lineWidth = e.type === 'archon' ? 3.5 : 2.3;
        ctx.strokeStyle = col;
        ctx.stroke();

        // Anillos internos para el Jefe Arconte según sus sellos (HP)
        if (e.type === 'archon') {
          for (let h = 1; h <= e.hp; h++) {
            ctx.beginPath();
            ctx.arc(0, 0, h * 8, 0, TAU);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.8;
            ctx.stroke();
          }
        } else {
          // Punto central
          ctx.beginPath();
          ctx.arc(0, 0, 3.5, 0, TAU);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }

        ctx.restore();
      }
    }

    _renderProjectiles(ctx) {
      for (let i = 0; i < this.projectiles.length; i++) {
        const p = this.projectiles[i];
        const col = p.phase === 'cyan' ? COLORS.cyan : COLORS.magenta;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, TAU);
        ctx.fillStyle = col;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.45, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      }
    }

    _renderEffects(ctx) {
      // Ondas de choque
      for (let i = 0; i < this.shockwaves.length; i++) {
        const sw = this.shockwaves[i];
        const prog = sw.age / sw.maxAge;
        const r = sw.maxRadius * prog;
        const alpha = 1 - prog;

        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, r, 0, TAU);
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = alpha * 0.75;
        ctx.lineWidth = Math.max(1, 3.5 * alpha);
        ctx.stroke();
        ctx.restore();
      }

      // Partículas
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const alpha = 1 - p.age / p.maxAge;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      }
      ctx.globalAlpha = 1.0;

      // Textos flotantes
      ctx.save();
      ctx.textAlign = 'center';
      for (let i = 0; i < this.floatingTexts.length; i++) {
        const ft = this.floatingTexts[i];
        const alpha = 1 - ft.age / ft.maxAge;
        const fontSize = Math.round(13 * ft.scale);
        ctx.font = `800 ${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = alpha;
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.restore();
    }

    // ========================================================================
    // SUITE DE AUTOCOMPROBACIÓN AUTOMATIZADA (SELF-TEST)
    // ========================================================================

    runSelfTest() {
      const results = [];
      const assert = (name, cond) => {
        results.push({ test: name, passed: Boolean(cond) });
      };

      // 1. Iniciar partida y comprobar estado inicial
      this.startGame();
      assert('Inicio de partida cambia estado a PLAYING', this.state === 'PLAYING');
      assert('Integridad inicial es 5/5', this.player.integrity === 5);

      // 2. Comprobar cambio de polaridad
      const initialPhase = this.player.phase;
      this.switchPhase();
      assert('Cambio de polaridad alterna Cian <-> Magenta', this.player.phase !== initialPhase);
      this.switchPhase();

      // 3. Comprobar Latigazo de Tensión
      this.orb.whipCooldown = 0;
      this.triggerWhipSnap(false);
      assert('Latigazo de tensión activa whipTimer y registra estadística', this.orb.whipTimer > 0 && this.stats.whipSnaps === 1);

      // 4. Comprobar armonización por contacto con el Orbe de igual polaridad
      const scoreBefore = this.score;
      const testEnemy = this._spawnEnemy('drifter', this.player.phase, this.orb.x, this.orb.y);
      this.update(0.016);
      assert('Anomalía de igual polaridad es armonizada por el Orbe y suma puntos', this.score > scoreBefore && !this.enemies.includes(testEnemy));

      // 5. Comprobar cierre de Lazo Armónico geométrico
      const loopsBefore = this.stats.loopsClosed;
      const loopTarget = this._spawnEnemy('shielded', 'magenta', this.player.x + 60, this.player.y + 60);
      const squareLoop = [
        { x: this.player.x, y: this.player.y },
        { x: this.player.x + 140, y: this.player.y },
        { x: this.player.x + 140, y: this.player.y + 140 },
        { x: this.player.x, y: this.player.y + 140 }
      ];
      this._triggerHarmonicLoopCollapse(squareLoop);
      assert('Cierre de Lazo Armónico purifica anomalías encerradas (incluso blindadas)', this.stats.loopsClosed === loopsBefore + 1 && !this.enemies.includes(loopTarget));

      // 6. Comprobar Sobrecarga Áurea
      this.overdriveMeter = 100;
      this.triggerOverdrive();
      assert('Sobrecarga Áurea se activa al 100% y armoniza ambas fases', this.overdriveActive && this.doesPhaseMatch('cyan') && this.doesPhaseMatch('magenta'));

      // 7. Comprobar Fin de Partida y Reinicio
      this.triggerGameOver();
      assert('Fin de partida cambia estado a GAMEOVER y muestra modal', this.state === 'GAMEOVER' && !this.dom.gameOverScreen.classList.contains('hidden'));

      this.returnToMenu();
      assert('Regreso al menú principal deja el juego listo para el usuario', this.state === 'MENU');

      return {
        allPassed: results.every((r) => r.passed),
        results
      };
    }
  }

  // Inicializar al cargar el DOM
  window.addEventListener('DOMContentLoaded', () => {
    global.SyntoniaGame = new SyntoniaGame();
  });
})(window);
