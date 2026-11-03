import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const CHROME = process.env.CHROME || process.env.HOME + '/.cache/ms-playwright/chromium-1140/chrome-linux/chrome';
const PAGE = new URL('../index.html', import.meta.url).href;
const OUT = process.argv[2] || '.';
const proc = spawn(CHROME, ['--headless=new', '--no-sandbox', '--remote-debugging-port=9333', '--window-size=1280,800',
  '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + OUT + '/prof', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const errors = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const l = await (await fetch('http://127.0.0.1:9333/json/list')).json(); const p = l.find(t => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('no chrome');
}
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(OUT + '/' + name + '.png', Buffer.from(r.data, 'base64')); };
const key = async (key, code, kc, type = 'both') => {
  const base = { key, code, windowsVirtualKeyCode: kc, text: key === ' ' ? ' ' : (key === 'Enter' ? '\r' : undefined) };
  if (type !== 'up') await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
  if (type !== 'down') await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
};
const check = (c, msg) => { console.log((c ? 'OK   ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
try {
  ws = new WebSocket(await connect());
  await new Promise(r => ws.onopen = r);
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); }
    else if (d.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(d.params.exceptionDetails).slice(0, 400));
    else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(JSON.stringify(d.params.args).slice(0, 300));
    else if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push(d.params.entry.text); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.navigate', { url: PAGE }); await sleep(1500);
  check(await ev('window.__farol.mode') === 'menu', 'arranca en el menú');
  check(await ev('!document.getElementById("menu").hidden'), 'menú visible');
  await shot('01-menu');
  // FPS en el menú (demo)
  const fps = async () => ev(`new Promise(r=>{let n=0,t0=performance.now(),mx=0,lt=t0;function f(t){n++;mx=Math.max(mx,t-lt);lt=t;if(t-t0<3000)requestAnimationFrame(f);else r({fps:n/((t-t0)/1000),maxFrame:mx})}requestAnimationFrame(f)})`);
  console.log('FPS menú', JSON.stringify(await fps()));
  await key('Enter', 'Enter', 13);
  await sleep(300);
  check(await ev('window.__farol.mode') === 'play', 'Enter inicia la partida');
  check(await ev('document.getElementById("menu").hidden'), 'menú oculto en partida');
  const a0 = await ev('window.__farol.state.beamA');
  await key('ArrowRight', 'ArrowRight', 39, 'down'); await sleep(600); await key('ArrowRight', 'ArrowRight', 39, 'up');
  const a1 = await ev('window.__farol.state.beamA');
  check(Math.abs(a1 - a0) > 1, `flecha derecha gira el haz (${a0.toFixed(2)} -> ${a1.toFixed(2)})`);
  // ratón apunta
  const v = await ev('window.__farol.view');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: v.CX - 200, y: v.CY });
  await sleep(500);
  const a2 = await ev('window.__farol.state.beamA');
  check(Math.abs(Math.abs(a2) - Math.PI) < 0.05 || Math.abs(a2 - Math.PI) < 0.05, `ratón apunta a la izquierda (beamA=${a2.toFixed(2)})`);
  // pausa
  await key('p', 'KeyP', 80); await sleep(200);
  const tp = await ev('window.__farol.state.t'); await sleep(500);
  check(await ev('window.__farol.mode') === 'paused' && await ev('window.__farol.state.t') === tp, 'P pausa y congela el tiempo');
  await shot('02-pausa');
  await key('p', 'KeyP', 80); await sleep(200);
  check(await ev('window.__farol.mode') === 'play', 'P reanuda');
  // destello
  await sleep(300);
  const fuelBefore = await ev('window.__farol.state.fuel');
  await key(' ', 'Space', 32); await sleep(50);
  const fl = await ev('({cd:window.__farol.state.flashCd, fuel:window.__farol.state.fuel})');
  check(fl.cd > 3 && fl.fuel < fuelBefore - 15, 'Espacio lanza destello y gasta combustible');
  console.log('FPS partida', JSON.stringify(await fps()));
  await shot('03-partida');
  // bot que apunta a la sombra más cercana (pero evita luciérnagas cercanas), con tiempo x3
  await ev(`window.__bot = setInterval(()=>{const s=__farol.state,v=__farol.view; if(__farol.mode!=='play')return; let b=null; for(const e of s.enemies) if(e.age>0.3&&(!b||e.d<b.d)) b=e; if(!b)return;
    const x=v.CX+Math.cos(b.a)*b.d*v.K, y=v.CY+Math.sin(b.a)*b.d*v.K; document.getElementById('lienzo').dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y,pointerType:'mouse',bubbles:true}));},30); __farol.timeScale=3; 1`);
  let maxEnemies = 0, maxFlies = 0, sample = [];
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    const st = await ev('({m:__farol.mode,t:__farol.state.t,sc:__farol.state.score,l:__farol.state.lives,f:__farol.state.fuel,n:__farol.state.enemies.length,fl:__farol.state.flies.length,h:__farol.state.hour,k:__farol.state.kills,c:__farol.state.caught,mult:__farol.state.maxMult,p:__farol.state.parts.length})');
    maxEnemies = Math.max(maxEnemies, st.n); maxFlies = Math.max(maxFlies, st.fl);
    if (i % 5 === 0) console.log(JSON.stringify(st));
    sample.push(st);
    if (i === 20) await shot('04-partida-avanzada');
    if (st.m === 'over') break;
  }
  const lastS = sample[sample.length - 1];
  console.log('final bot', JSON.stringify(lastS), 'maxEnemies', maxEnemies);
  check(lastS.k > 20, 'el bot disuelve sombras y puntúa');
  check(lastS.h >= 2, 'la hora (dificultad) avanza');
  await ev('clearInterval(window.__bot); __farol.timeScale=1; 1');
  // dejar que pierda
  for (let i = 0; i < 90 && await ev('__farol.mode') !== 'over'; i++) await sleep(1000);
  check(await ev('__farol.mode') === 'over', 'sin defender, la partida termina');
  await sleep(1900);
  check(await ev('!document.getElementById("fin").hidden'), 'pantalla de fin visible');
  console.log('fin:', await ev('document.getElementById("fin").innerText.replace(/\\n+/g," | ")'));
  await shot('05-fin');
  await key('Enter', 'Enter', 13); await sleep(300);
  check(await ev('__farol.mode') === 'play' && await ev('__farol.state.score') < 50 && await ev('__farol.state.lives') === 3, 'Enter reinicia una partida nueva');
  check(await ev('localStorage.getItem("farol.record")') > 0, 'récord guardado');
  // móvil táctil
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await sleep(500);
  const vm = await ev('__farol.view');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vm.CX, y: vm.CY + 150, id: 1 }] });
  await sleep(400);
  const am = await ev('__farol.state.beamA');
  check(Math.abs(am - Math.PI / 2) < 0.05, `toque abajo apunta abajo (beamA=${am.toFixed(2)})`);
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: vm.CX + 150, y: vm.CY, id: 1 }] });
  await sleep(400);
  const am2 = await ev('__farol.state.beamA');
  check(Math.abs(angle(am2)) < 0.05, `arrastrar a la derecha apunta a la derecha (beamA=${am2.toFixed(2)})`);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check(await ev('getComputedStyle(document.getElementById("btnDestello")).display') === 'flex', 'botón de destello visible en táctil');
  await sleep(4200);
  const r = await ev('JSON.stringify(document.getElementById("btnDestello").getBoundingClientRect())');
  const br = JSON.parse(r);
  const cdB = await ev('__farol.state.flashCd');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: br.x + br.width / 2, y: br.y + br.height / 2, id: 2 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(100);
  check(cdB <= 0 && await ev('__farol.state.flashCd') > 3, 'botón táctil lanza destello');
  await sleep(600);
  await shot('06-movil');
  console.log('FPS móvil', JSON.stringify(await fps()));
  console.log('ERRORES:', errors.length ? errors : 'ninguno');
  check(errors.length === 0, 'sin errores de consola');
  function angle(a) { let d = a % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; return d; }
} catch (e) { console.error('EXC', e); process.exitCode = 1; }
finally { proc.kill(); process.exit(); }
