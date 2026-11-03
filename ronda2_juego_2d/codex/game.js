'use strict';

// HEBRA. Todo el arte se dibuja aquí; no hay imágenes, fuentes ni sonidos descargados.
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rand = (a, b) => a + Math.random() * (b - a);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

class Synth {
  constructor() { this.enabled = false; this.context = null; }
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch { this.enabled = false; }
  }
  tone(frequency, duration = .16, type = 'sine', volume = .035, delay = 0) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const c = this.context, start = c.currentTime + delay;
    const oscillator = c.createOscillator(), gain = c.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(c.destination);
    oscillator.start(start); oscillator.stop(start + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  collect(n) { this.tone(330 * Math.pow(1.12246, n), .2); }
  bank() { [392, 494, 587, 784].forEach((f, i) => this.tone(f, .32, 'sine', .035, i * .065)); }
  hit() { this.tone(100, .3, 'triangle', .055); this.tone(74, .25, 'sine', .045, .05); }
  pulse() { this.tone(196, .35, 'sine', .04); this.tone(392, .5, 'sine', .025, .06); }
}
const synth = new Synth();

class GardenGame {
  constructor() {
    this.canvas = $('game'); this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.state = 'menu'; this.keys = new Set(); this.pointer = null;
    this.w = 1000; this.h = 680; this.cx = 500; this.cy = 350;
    this.player = { x: 620, y: 350, angle: 0 };
    this.motes = []; this.ashes = []; this.particles = []; this.rings = []; this.labels = [];
    this.stars = Array.from({length:90}, () => ({x:Math.random(), y:Math.random(), r:rand(.5,1.5), phase:rand(0,TAU)}));
    this.elapsed = 0; this.timeLeft = 90; this.delivered = 0; this.cargo = 0;
    this.score = 0; this.lives = 3; this.phase = 1; this.cooldown = 0;
    this.shield = 0; this.invulnerable = 0; this.flash = 0; this.toastLeft = 0;
    this.visualTime = 0; this.lastTime = 0; this.uiClock = 0; this.best = 0;
    try { this.best = Number(localStorage.getItem('hebra-best-v1')) || 0; } catch { /* También funciona con almacenamiento bloqueado. */ }
    this.bindControls(); this.resize();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const oldW = this.w, oldH = this.h, oldCx = this.cx, oldCy = this.cy;
    this.w = bounds.width < 620 ? 520 : 1000;
    this.h = this.w * bounds.height / Math.max(1, bounds.width);
    this.cx = this.w / 2; this.cy = this.h * .52;
    this.unit = Math.min(this.w, this.h) / 680;
    this.coreRadius = 46 * this.unit + 6;
    // Conservar posiciones relativas al cambiar tamaño u orientación.
    for (const entity of [this.player, ...this.motes, ...this.ashes, ...this.particles, ...this.rings, ...this.labels]) {
      entity.x = this.cx + (entity.x - oldCx) * this.w / oldW;
      entity.y = this.cy + (entity.y - oldCy) * this.h / oldH;
    }
    this.pointer = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(bounds.width * dpr);
    this.canvas.height = Math.round(bounds.height * dpr);
    this.scale = this.canvas.width / this.w;
  }

  bindControls() {
    window.addEventListener('resize', () => this.resize());
    const movementKeys = ['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'];
    window.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const active = this.state === 'playing' || this.state === 'paused';
      // Conservar el comportamiento normal de Espacio/Enter en botones y enlaces.
      if (['BUTTON','A'].includes(document.activeElement?.tagName) && (key === ' ' || key === 'enter')) return;
      if (active && [...movementKeys, ' ', 'escape', 'p'].includes(key)) e.preventDefault();
      if (movementKeys.includes(key) && this.state === 'playing') this.keys.add(key);
      if (e.repeat) return;
      if (key === ' ' && this.state === 'playing') this.pulse();
      if ((key === 'p' || key === 'escape') && active) this.togglePause();
      if (key === 'enter' && (this.state === 'menu' || this.state === 'ended')) this.start();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.clearInput(); if (this.state === 'playing') this.togglePause(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.clearInput(); if (this.state === 'playing') this.togglePause(); }
    });
    const aim = e => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer = {x:(e.clientX-r.left) / r.width * this.w, y:(e.clientY-r.top) / r.height * this.h, id:e.pointerId};
    };
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('pointerdown', e => {
      if (this.state !== 'playing' || (e.pointerType === 'mouse' && e.button !== 0) || this.pointer) return;
      e.preventDefault(); this.canvas.focus({preventScroll:true}); synth.unlock(); aim(e);
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', e => { if (this.pointer?.id === e.pointerId) aim(e); });
    const release = e => { if (this.pointer?.id === e.pointerId) this.pointer = null; };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('lostpointercapture', release);
    $('start').addEventListener('click', () => this.start());
    $('pause').addEventListener('click', () => this.togglePause());
    $('pulse').addEventListener('click', () => { this.pulse(); this.canvas.focus({preventScroll:true}); });
    $('modal-action').addEventListener('click', () => this.state === 'paused' ? this.togglePause() : this.start());
    $('back-home').addEventListener('click', () => this.home());
    $('sound').addEventListener('click', () => {
      synth.enabled = !synth.enabled; synth.unlock();
      $('sound').setAttribute('aria-pressed', String(synth.enabled));
      $('sound').setAttribute('aria-label', synth.enabled ? 'Desactivar sonido' : 'Activar sonido');
      $('sound-label').textContent = synth.enabled ? 'Sonido activado' : 'Sonido apagado';
      if (synth.enabled) synth.tone(523, .2);
      $('sound').blur();
    });
  }

  clearInput() { this.keys.clear(); this.pointer = null; }
  start() {
    this.state = 'playing'; this.elapsed = 0; this.timeLeft = 90;
    this.delivered = 0; this.cargo = 0; this.score = 0; this.lives = 3;
    this.phase = 1; this.cooldown = 0; this.shield = 0; this.invulnerable = 1.5;
    this.flash = 0; this.moteClock = .3; this.ashClock = 3.2;
    this.motes = []; this.ashes = []; this.particles = []; this.rings = []; this.labels = [];
    this.clearInput(); this.hideToast();
    $('start-screen').classList.add('hidden'); $('intro-heading').classList.add('hidden'); $('intro-corner').classList.add('hidden');
    $('hud').classList.remove('hidden'); $('play-bottom').classList.remove('hidden');
    $('modal').classList.add('hidden'); $('game').setAttribute('aria-hidden','false');
    document.querySelector('.arena').classList.add('playing');
    this.resize(); this.player = { x:this.cx + 114 * this.unit, y:this.cy, angle:0 };
    for (let i = 0; i < 22; i++) this.spawnMote(true);
    synth.unlock(); this.updateUI();
    this.showToast('Tiende la hebra sobre el rocío. Vuelve al centro para sembrar.', 4);
    this.canvas.focus({preventScroll:true});
  }

  home() {
    this.state = 'menu'; this.clearInput(); this.hideToast();
    ['start-screen','intro-heading','intro-corner'].forEach(id => $(id).classList.remove('hidden'));
    ['hud','play-bottom','modal'].forEach(id => $(id).classList.add('hidden'));
    document.querySelector('.arena').classList.remove('playing'); this.resize(); $('start').focus({preventScroll:true});
  }

  togglePause() {
    if (!['playing','paused'].includes(this.state)) return;
    this.clearInput();
    if (this.state === 'playing') {
      this.state = 'paused'; $('modal').classList.remove('hidden');
      $('modal-kicker').textContent = 'UN RESPIRO EN EL VACÍO'; $('modal-title').textContent = 'El jardín espera.';
      $('modal-copy').textContent = 'Tu hebra está a salvo. Continúa cuando quieras; el tiempo también descansa.';
      $('results').classList.add('hidden'); $('back-home').classList.add('hidden');
      $('modal-action').innerHTML = 'Seguir tejiendo <span aria-hidden="true">↗</span>';
      this.canvas.setAttribute('aria-hidden','true'); $('modal-action').focus({preventScroll:true});
    } else {
      this.state = 'playing'; $('modal').classList.add('hidden'); this.lastTime = performance.now();
      this.canvas.setAttribute('aria-hidden','false'); this.canvas.focus({preventScroll:true}); synth.unlock();
    }
  }

  finish(won, reason) {
    if (this.state !== 'playing') return;
    this.state = 'ended'; this.clearInput(); this.hideToast();
    if (won) this.score += Math.ceil(this.timeLeft) * 20 + this.lives * 200;
    this.best = Math.max(this.best, this.score);
    try { localStorage.setItem('hebra-best-v1', String(this.best)); } catch { /* Récord en memoria si no hay almacenamiento. */ }
    this.updateUI(); $('modal').classList.remove('hidden');
    $('modal-kicker').textContent = won ? '36 GOTAS · 6 FLORES · UN JARDÍN' : 'CADA HILO ENSEÑA ALGO';
    $('modal-title').textContent = won ? 'El vacío ha florecido.' : reason === 'time' ? 'Se durmió la marea.' : 'Hasta el último hilo.';
    $('modal-copy').textContent = won ? 'Le diste un lugar a la luz. Tu jardín ya forma parte de este pequeño universo.' : `Sembraste ${this.delivered} de 36 gotas. ${reason === 'time' ? 'La próxima vez, vuelve a la raíz más a menudo.' : 'El pulso protege toda la hebra. Úsalo cuando la ceniza se acerque.'}`;
    $('results').classList.remove('hidden'); $('back-home').classList.remove('hidden');
    $('final-score').textContent = this.score.toLocaleString('es'); $('best-score').textContent = this.best.toLocaleString('es');
    $('modal-action').innerHTML = 'Volver a sembrar <span aria-hidden="true">↗</span>';
    this.canvas.setAttribute('aria-hidden','true'); $('modal-action').focus({preventScroll:true});
    if (won) { synth.bank(); this.burst(this.cx, this.cy, '#b9ebc9', 50); }
    else synth.tone(147, .6, 'sine', .045);
  }

  showToast(message, duration = 2.6) { $('toast').textContent = message; $('toast').classList.add('visible'); this.toastLeft = duration; }
  hideToast() { $('toast').classList.remove('visible'); this.toastLeft = 0; }

  spawnMote(initial = false) {
    if (this.motes.length >= 42) return;
    const a = rand(0,TAU), r = initial ? rand(.35,.86) : rand(.75,1);
    this.motes.push({ x:this.cx + Math.cos(a) * this.w * .43 * r, y:this.cy + Math.sin(a) * this.h * .33 * r,
      life:rand(15,22), phase:rand(0,TAU), speed:rand(8,15) * this.unit });
  }
  spawnAsh() {
    if (this.ashes.length >= 25) return;
    const a = rand(0,TAU);
    const x = this.cx + Math.cos(a) * this.w * .48;
    const y = this.cy + Math.sin(a) * this.h * .37;
    const heading = Math.atan2(this.cy-y, this.cx-x) + rand(-.32,.32);
    const speed = (32 + this.phase * 9) * this.unit;
    this.ashes.push({x,y,vx:Math.cos(heading)*speed,vy:Math.sin(heading)*speed, angle:rand(0,TAU), life:18, age:0});
  }

  pulse() {
    if (this.state !== 'playing' || this.cooldown > 0) return;
    this.shield = 1.15; this.cooldown = 4.5;
    this.rings.push({x:this.player.x,y:this.player.y,r:10,life:.65,maxLife:.65,color:'#b9ebc9'});
    synth.unlock(); synth.pulse(); this.updateUI();
  }
  burst(x,y,color,count=12) {
    const available = Math.min(count, 220-this.particles.length);
    for(let i=0;i<available;i++) {
      const a=rand(0,TAU), speed=rand(20,100)*this.unit;
      const life=rand(.35,.9);
      this.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life,maxLife:life,color,size:rand(1,3)*this.unit});
    }
  }

  bank() {
    if (!this.cargo) return;
    const n = this.cargo, oldFlowers = Math.floor(this.delivered/6);
    this.delivered = Math.min(36, this.delivered + n);
    const points = n*100 + (n === 6 ? 150 : 0);
    this.score += points; this.cargo = 0;
    this.labels.push({x:this.cx,y:this.cy-58*this.unit,text:`+${points}`,life:1.3});
    this.burst(this.cx,this.cy,'#dce9aa',26); synth.bank();
    this.rings.push({x:this.cx,y:this.cy,r:35*this.unit,life:.9,maxLife:.9,color:'#d9e7ac'});
    if (this.delivered >= 36) this.finish(true);
    else if (Math.floor(this.delivered/6) > oldFlowers) this.showToast(`Una flor despierta · ${Math.floor(this.delivered/6)} de 6`);
    else this.showToast(`${n} ${n === 1 ? 'gota sembrada' : 'gotas sembradas'}${n === 6 ? ' · cosecha completa +150' : ''}`,1.7);
  }

  update(dt) {
    if (this.state !== 'playing') return;
    this.elapsed += dt; this.timeLeft = Math.max(0,90-this.elapsed);
    this.cooldown = Math.max(0,this.cooldown-dt); this.shield = Math.max(0,this.shield-dt);
    this.invulnerable = Math.max(0,this.invulnerable-dt); this.flash = Math.max(0,this.flash-dt);
    if (this.toastLeft > 0) { this.toastLeft -= dt; if (this.toastLeft <= 0) this.hideToast(); }
    const phase = Math.min(5, 1+Math.floor(this.elapsed/18));
    if (phase !== this.phase) { this.phase = phase; this.showToast(`Marea 0${phase} · el vacío se agita`); }
    if (this.timeLeft <= 0) { this.finish(false,'time'); return; }

    let dx = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft'));
    let dy = Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup'));
    let distance = Math.hypot(dx,dy), travel = 285*this.unit*dt;
    if (!distance && this.pointer) {
      dx = this.pointer.x-this.player.x; dy = this.pointer.y-this.player.y;
      distance = Math.hypot(dx,dy); travel = Math.min(travel,distance);
    }
    if (distance > .1) {
      this.player.x += dx/distance*travel; this.player.y += dy/distance*travel;
      this.player.angle = Math.atan2(dy,dx);
    }
    this.player.x = clamp(this.player.x,22*this.unit,this.w-22*this.unit);
    this.player.y = clamp(this.player.y,100*this.unit,this.h-106*this.unit);

    this.moteClock -= dt; this.ashClock -= dt;
    if (this.moteClock <= 0) { this.spawnMote(); this.moteClock = .45; }
    if (this.ashClock <= 0) { this.spawnAsh(); this.ashClock = Math.max(.55, 1.8-this.phase*.23); }
    const p = this.player, reach = Math.hypot(p.x-this.cx,p.y-this.cy);
    for (let i=this.motes.length-1;i>=0;i--) {
      const m=this.motes[i], x=this.cx-m.x, y=this.cy-m.y, d=Math.hypot(x,y);
      if (d>0) { m.x+=(x/d*.75-y/d*.45)*m.speed*dt; m.y+=(y/d*.75+x/d*.45)*m.speed*dt; }
      m.life-=dt;
      if (d > this.coreRadius+12*this.unit && reach > this.coreRadius && this.cargo < 6 && distanceToSegment(m.x,m.y,this.cx,this.cy,p.x,p.y) < 13*this.unit) {
        this.cargo++; this.burst(m.x,m.y,'#dce9aa',8); synth.collect(this.cargo);
        this.motes.splice(i,1);
        if (this.cargo === 6) this.showToast('La hebra está llena. Vuelve al centro.',2.5);
      } else if (m.life<=0 || d<this.coreRadius+10*this.unit) this.motes.splice(i,1);
    }
    // El círculo de la raíz es un refugio: la ceniza no entra en él.
    for(let i=this.ashes.length-1;i>=0;i--) {
      const a=this.ashes[i]; a.x+=a.vx*dt; a.y+=a.vy*dt; a.angle+=dt; a.age+=dt; a.life-=dt;
      if (a.life<=0 || Math.hypot(a.x-this.cx,a.y-this.cy)<this.coreRadius+20*this.unit) { this.ashes.splice(i,1); continue; }
      const near = distanceToSegment(a.x,a.y,this.cx,this.cy,p.x,p.y);
      if (this.shield>0 && near<36*this.unit && a.age>.3) {
        this.burst(a.x,a.y,'#b9ebc9',12); this.ashes.splice(i,1); continue;
      }
      if (near<17*this.unit && reach>this.coreRadius && this.invulnerable<=0 && a.age>.75) {
        this.lives--; this.cargo=Math.max(0,this.cargo-2); this.invulnerable=1.8; this.flash=.35;
        this.burst(a.x,a.y,'#ed8f7d',20); this.ashes.splice(i,1); synth.hit();
        if (this.lives<=0) { this.finish(false,'lives'); return; }
        this.showToast('La ceniza rozó tu hilo · −1 vida, hasta −2 gotas',2.7);
      }
    }
    if (reach < this.coreRadius) this.bank();
    this.updateEffects(dt);
    this.uiClock+=dt; if(this.uiClock>.08) { this.uiClock=0; this.updateUI(); }
  }

  updateEffects(dt) {
    for(let i=this.particles.length-1;i>=0;i--) {
      const p=this.particles[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=Math.exp(-2*dt); p.vy*=Math.exp(-2*dt); p.life-=dt;
      if(p.life<=0)this.particles.splice(i,1);
    }
    for(let i=this.rings.length-1;i>=0;i--) { const r=this.rings[i];r.r+=170*this.unit*dt;r.life-=dt;if(r.life<=0)this.rings.splice(i,1); }
    for(let i=this.labels.length-1;i>=0;i--) {const l=this.labels[i];l.y-=20*this.unit*dt;l.life-=dt;if(l.life<=0)this.labels.splice(i,1);}
  }

  updateUI() {
    $('delivered').textContent=this.delivered; $('score').textContent=String(this.score).padStart(4,'0');
    const sec=Math.ceil(this.timeLeft); $('time').textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
    document.querySelector('.time-stat').classList.toggle('urgent',sec<=15);
    $('hearts').textContent='✦ '.repeat(this.lives)+'· '.repeat(3-this.lives);
    $('hearts').setAttribute('aria-label',`${this.lives} vidas`);
    $('phase').textContent=`MAREA 0${this.phase}`;
    [...$('garden-progress').children].forEach((el,i)=>el.classList.toggle('lit',this.delivered>=(i+1)*6));
    [...$('cargo-slots').children].forEach((el,i)=>el.classList.toggle('lit',this.cargo>i));
    $('cargo-slots').setAttribute('aria-label',`${this.cargo} de 6 gotas`);
    $('cargo-hint').textContent=this.cargo===6?'¡Vuelve a la raíz!':this.cargo?'Vuelve al centro para sembrar':'Recoge con toda la hebra';
    $('pulse').disabled=this.cooldown>0; $('pulse-label').textContent=this.cooldown>0?`${this.cooldown.toFixed(1)} s`:'Pulso';
  }

  // La simulación usa segundos y subpasos acotados para mantener estable la colisión.
  frame(time) {
    const dt=this.lastTime ? Math.min((time-this.lastTime)/1000,.05) : 0;
    this.lastTime=time;
    if(this.state!=='paused') this.visualTime+=reducedMotion?0:dt;
    if(this.state==='playing') {
      // Subpasos limitados, sin acumular tiempo de una pestaña inactiva.
      const steps=Math.max(1,Math.ceil(dt/(1/120)));
      for(let i=0;i<steps;i++) this.update(dt/steps);
    }
    this.draw(); requestAnimationFrame(this.frame);
  }

  circle(x,y,r,fill,stroke=null,width=1) {
    const c=this.ctx;c.beginPath();c.arc(x,y,Math.max(0,r),0,TAU);
    if(fill){c.fillStyle=fill;c.fill();} if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
  }
  line(x1,y1,x2,y2,color,width=1) {
    const c=this.ctx;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();
  }
  text(text,x,y,size,color,align='center',font='Arial') {
    const c=this.ctx;c.font=`${size}px ${font}`;c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y);
  }

  draw() {
    const c=this.ctx, t=this.visualTime, u=this.unit;
    c.setTransform(this.scale,0,0,this.scale,0,0); c.globalAlpha=1;
    c.fillStyle='#192123';c.fillRect(0,0,this.w,this.h);
    const menu=this.state==='menu';
    const gx=menu?(this.w<700?this.w*.56:this.w*.735):this.cx;
    const gy=menu?(this.w<700?this.h*.765:this.h*.51):this.cy;
    const gu=menu?(this.w<700?u*.91:u*1.12):u;
    const glow=c.createRadialGradient(gx,gy,10,gx,gy,this.w*.48);
    glow.addColorStop(0,'#35443555');glow.addColorStop(.48,'#25362e30');glow.addColorStop(1,'#19212300');
    c.fillStyle=glow;c.fillRect(0,0,this.w,this.h);
    // Cartografía orbital, puntos y pequeñas cruces: arte procedural, sin texturas.
    for(let i=0;i<4;i++) {
      const r=(96+i*68)*gu;
      c.save();c.translate(gx,gy);c.rotate(-.25);c.scale(1,.93);
      c.setLineDash(i%2?[2,9]:[]);this.circle(0,0,r,null,i===0?'#74826b35':'#7c8a7020',.8);c.restore();
    }
    for(const s of this.stars) {
      const x=s.x*this.w,y=s.y*this.h;
      c.globalAlpha=.25+.22*Math.sin(t*.4+s.phase);
      this.circle(x,y,s.r*u,'#c8d4b3');
    }c.globalAlpha=1;
    for(let i=0;i<7;i++) {
      const x=(.12+i*.137)%1*this.w, y=(.17+i*.237)%1*this.h;
      this.line(x-3*u,y,x+3*u,y,'#8a9a7b33');this.line(x,y-3*u,x,y+3*u,'#8a9a7b33');
    }
    if(menu) this.drawAttract(gx,gy,gu,t);
    else this.drawPlay(t,u);
    // Un fino marco de coordenadas en las esquinas del campo.
    c.strokeStyle='#9baa7833';c.lineWidth=1;
    for(const [x,y,sx,sy] of [[14,14,1,1],[this.w-14,14,-1,1],[14,this.h-14,1,-1],[this.w-14,this.h-14,-1,-1]]) {
      c.beginPath();c.moveTo(x+9*sx,y);c.lineTo(x,y);c.lineTo(x,y+9*sy);c.stroke();
    }
    if(this.flash>0) {c.fillStyle=`rgba(237,143,125,${this.flash*.2})`;c.fillRect(0,0,this.w,this.h);}
  }

  drawAttract(x,y,u,t) {
    const c=this.ctx;
    const a=-.72+Math.sin(t*.24)*.48;
    const px=x+Math.cos(a)*170*u,py=y+Math.sin(a)*170*u;
    this.drawThread(x,y,px,py,4,1,u,t);
    for(let i=0;i<12;i++) {
      const angle=i*2.399+t*.018, r=(96+(i%4)*30)*u;
      const mx=x+Math.cos(angle)*r,my=y+Math.sin(angle)*r*.85;
      this.drawMote(mx,my,u,t+i);
    }
    this.drawGarden(x,y,u,24,t,true);this.drawNeedle(px,py,a+.6,u,t);
    if(this.w>700) {
      const lx=x-91*u,ly=y+145*u;
      this.line(x-16*u,y+72*u,lx,ly-18*u,'#9caf7d66',1);
      this.circle(lx,ly-18*u,2*u,'#c6d8ad');
      this.text('TU PEQUEÑO JARDÍN',lx-4*u,ly,9*u,'#c2cdb2','right');
      this.text('Todo vuelve al centro.',lx-4*u,ly+17*u,9*u,'#84977e','right');
      this.text('ROCÍO',x+150*u,y+151*u,8*u,'#aeba8b');
      this.line(x+150*u,y+138*u,x+137*u,y+113*u,'#8e9d7355');
    }
  }

  drawPlay(t,u) {
    const c=this.ctx,p=this.player;
    this.circle(this.cx,this.cy,this.coreRadius,null,'#a9cb9b33',1);
    c.setLineDash([2*u,5*u]);this.circle(this.cx,this.cy,this.coreRadius+15*u,null,'#a9cb9b22',1);c.setLineDash([]);
    for(const m of this.motes) {
      c.globalAlpha=clamp(m.life,0,1);this.drawMote(m.x,m.y,u,t+m.phase);
    }c.globalAlpha=1;
    this.drawThread(this.cx,this.cy,p.x,p.y,this.cargo,this.shield,u,t);
    this.drawGarden(this.cx,this.cy,u,this.delivered,t,false);
    for(const a of this.ashes) {
      c.globalAlpha=Math.min(1,a.age*1.7);
      this.line(a.x-a.vx*.33,a.y-a.vy*.33,a.x,a.y,'#ed8f7d35',2*u);
      this.line(a.x-a.vx*.13,a.y-a.vy*.13,a.x,a.y,'#ed8f7d70',2*u);
      c.save();c.translate(a.x,a.y);c.rotate(a.angle);
      c.beginPath();c.moveTo(0,-11*u);c.lineTo(9*u,6*u);c.lineTo(-7*u,8*u);c.closePath();
      c.fillStyle='#d7786650';c.fill();c.strokeStyle='#ed9680';c.lineWidth=1.4*u;c.stroke();
      this.line(-3*u,0,3*u,0,'#f6b39b',u);c.restore();
    }c.globalAlpha=1;
    if(this.invulnerable<=0 || Math.sin(t*24)>.1) this.drawNeedle(p.x,p.y,p.angle,u,t);
    if(this.shield>0) {
      c.setLineDash([4*u,4*u]);this.circle(p.x,p.y,27*u+Math.sin(t*12)*2*u,null,'#c6f3cb88',u);c.setLineDash([]);
    }
    if(this.cargo>0) {
      const a=Math.atan2(this.cy-p.y,this.cx-p.x),d=Math.hypot(p.x-this.cx,p.y-this.cy);
      if(d>this.coreRadius+55*u) {
        c.save();c.translate(p.x+Math.cos(a)*26*u,p.y+Math.sin(a)*26*u);c.rotate(a);
        this.line(-3*u,-3*u,2*u,0,'#c2d9a788',u);this.line(2*u,0,-3*u,3*u,'#c2d9a788',u);c.restore();
      }
    }
    for(const r of this.rings) {c.globalAlpha=r.life/r.maxLife;this.circle(r.x,r.y,r.r,null,r.color,1.5*u);}c.globalAlpha=1;
    for(const part of this.particles) {c.globalAlpha=part.life/part.maxLife;this.circle(part.x,part.y,part.size,part.color);}c.globalAlpha=1;
    for(const label of this.labels) {c.globalAlpha=Math.min(1,label.life*2);this.text(label.text,label.x,label.y,17*u,'#e2edb7');}c.globalAlpha=1;
    const label=this.cargo>0?'VUELVE A LA RAÍZ':'LA RAÍZ';
    this.text(label,this.cx,this.cy+83*u,8*u,this.cargo>0?'#c5d9af':'#819478');
  }

  drawThread(x,y,px,py,cargo,shield,u,t) {
    const c=this.ctx,dx=px-x,dy=py-y,length=Math.hypot(dx,dy);
    if(length<1)return;
    const nx=-dy/length,ny=dx/length;
    const protectedThread=shield>0;
    this.line(x,y,px,py,protectedThread?'#c0f2c827':'#c8dca911',protectedThread?16*u:7*u);
    // Vibración visual leve; las colisiones siguen el segmento central.
    c.beginPath();c.moveTo(x,y);
    for(let i=1;i<=22;i++) {
      const f=i/22,wave=Math.sin(f*Math.PI)*Math.sin(t*3-f*8)*2*u;
      c.lineTo(x+dx*f+nx*wave,y+dy*f+ny*wave);
    }
    c.strokeStyle=protectedThread?'#d2f3c9':cargo===6?'#eee8ad':'#b7c9a0';c.lineWidth=protectedThread?2.2*u:1.25*u;c.stroke();
    for(let i=0;i<cargo;i++) {
      const f=.25+(i/7)*.6;
      this.circle(x+dx*f,y+dy*f,3.4*u,'#e0e9ac');
      this.circle(x+dx*f,y+dy*f,7*u,'#d9e5a611');
    }
    if(protectedThread) for(let i=0;i<3;i++) {
      const f=(t*.9+i/3)%1;
      this.circle(x+dx*f,y+dy*f,7*u,null,'#d0f3c866',u);
    }
  }
  drawMote(x,y,u,t) {
    const c=this.ctx,r=(5+Math.sin(t*2)*.7)*u;
    this.circle(x,y,12*u,'#d7e5ac09');this.circle(x,y,8*u,'#d7e5ac13');
    c.save();c.translate(x,y);c.rotate(Math.PI/4);
    c.fillStyle='#dce8aa';c.fillRect(-r*.6,-r*.6,r*1.2,r*1.2);c.restore();
    this.circle(x-1*u,y-1*u,1.4*u,'#f8f6d3');
  }
  drawNeedle(x,y,a,u,t) {
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(a);
    this.circle(0,0,19*u,'#b9ebc90c');
    c.beginPath();c.moveTo(15*u,0);c.lineTo(-8*u,-7*u);c.lineTo(-4*u,0);c.lineTo(-8*u,7*u);c.closePath();
    c.fillStyle='#d3edce';c.fill();c.strokeStyle='#f2f3d8';c.lineWidth=u;c.stroke();
    this.circle(-1*u,0,2*u,'#314f3e');c.restore();
  }
  drawGarden(x,y,u,delivered,t,attract) {
    const c=this.ctx,flowers=Math.floor(delivered/6),progress=(delivered%6)/6;
    this.circle(x,y,72*u,'#b9ebc904');this.circle(x,y,53*u,'#acc48d0a');
    // Seis tallos alrededor del corazón: cada seis gotas se abre una flor.
    for(let i=0;i<6;i++) {
      const a=-Math.PI/2+i*TAU/6,bloom=i<flowers;
      const len=(bloom?47:33)*u;
      const sway=reducedMotion?0:Math.sin(t*.8+i)*2*u;
      const ex=x+Math.cos(a)*len+Math.cos(a+Math.PI/2)*sway,ey=y+Math.sin(a)*len;
      const cx=x+Math.cos(a-.3)*len*.65,cy=y+Math.sin(a-.3)*len*.65;
      c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(cx,cy,ex,ey);
      c.strokeStyle=bloom?'#a9c992':'#5d77524d';c.lineWidth=1.25*u;c.stroke();
      if(bloom) {
        c.save();c.translate(ex,ey);c.rotate(a+t*.012);
        for(let j=0;j<5;j++) {
          c.rotate(TAU/5);c.beginPath();c.ellipse(0,-8*u,4.4*u,9*u,0,0,TAU);
          c.fillStyle=j%2?'#b3d29dbb':'#c7dbabbf';c.fill();c.strokeStyle='#e0e6b466';c.lineWidth=.5*u;c.stroke();
        }
        this.circle(0,0,3.7*u,'#f1df9b');c.restore();
        // Una hoja fina sobre el tallo.
        c.save();c.translate(cx,cy);c.rotate(a-.4);c.beginPath();c.ellipse(0,-5*u,3*u,8*u,.7,0,TAU);c.fillStyle='#8ea67e99';c.fill();c.restore();
      } else {
        this.circle(ex,ey,3*u,null,'#71856466',u);
      }
    }
    const r=17*u+Math.sin(t*1.4)*1.3*u;
    this.circle(x,y,r+11*u,'#c6e6b00a');this.circle(x,y,r+5*u,null,'#a6c59455',u);
    this.circle(x,y,r,'#384d37','#b9d29b88',u);
    c.save();c.translate(x,y);c.rotate(t*.055);
    for(let i=0;i<6;i++) {
      c.rotate(TAU/6);c.beginPath();c.ellipse(0,-5*u,3*u,7*u,.2,0,TAU);c.fillStyle='#c7dbab';c.fill();
    }this.circle(0,0,3*u,'#eee7b0');c.restore();
    if(!attract && progress>0) {
      c.beginPath();c.arc(x,y,26*u,-Math.PI/2,-Math.PI/2+TAU*progress);
      c.strokeStyle='#dde8ad';c.lineWidth=2*u;c.stroke();
    }
  }
}

const hebra = new GardenGame();
