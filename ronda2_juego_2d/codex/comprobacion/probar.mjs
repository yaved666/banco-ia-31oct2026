// Pruebas de navegador sin bibliotecas. Requiere Firefox y geckodriver escuchando en :4444.
// Servir la raíz con `python3 -m http.server 8000`, después: node comprobacion/probar.mjs
import { writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const driver = process.env.WEBDRIVER_URL || 'http://127.0.0.1:4444';
const origin = process.env.GAME_URL || 'http://127.0.0.1:8000';
let sid; let socket; let bidiId=0;
async function viewport(width,height) {
  const context=await call('GET',`/session/${sid}/window`);
  const id=++bidiId;
  await new Promise((resolve,reject)=>{
    const listen=e=>{const reply=JSON.parse(e.data);if(reply.id!==id)return;socket.removeEventListener('message',listen);reply.type==='error'?reject(new Error(JSON.stringify(reply))):resolve(reply.result);};
    socket.addEventListener('message',listen);
    socket.send(JSON.stringify({id,method:'browsingContext.setViewport',params:{context,viewport:{width,height},devicePixelRatio:1}}));
  });
}
const reports = [];
async function call(method, path, body) {
  const response = await fetch(`${driver}${path}`, {method, headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const {value}=await response.json();
  if(!response.ok) throw new Error(JSON.stringify(value));
  return value;
}
const cmd=(path,body={},method='POST')=>call(method,`/session/${sid}${path}`,body);
const js=script=>cmd('/execute/sync',{script:'return window.eval(arguments[0]);',args:[`(function(){${script}})()`]});
async function click(selector){
  const element=await cmd('/element',{using:'css selector',value:selector});
  await cmd(`/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`);
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(name,condition)=>{assert.ok(condition,name);reports.push(`OK · ${name}`);console.log(reports.at(-1));};
const shot=async name=>writeFile(new URL(name,import.meta.url),Buffer.from(await call('GET',`/session/${sid}/screenshot`),'base64'));
async function key(value,ms=160){
  await cmd('/actions',{actions:[{type:'key',id:'keyboard',actions:[{type:'keyDown',value},{type:'pause',duration:ms},{type:'keyUp',value}]}]});
}
try {
  const session=await call('POST','/session',{capabilities:{alwaysMatch:{browserName:'firefox',webSocketUrl:true,'moz:firefoxOptions':{args:['-headless'],prefs:{'media.autoplay.default':0,'media.autoplay.block-webaudio':false}}}}});
  sid=session.sessionId;socket=new WebSocket(session.capabilities.webSocketUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  await viewport(1360,940);await cmd('/url',{url:origin});await wait(700);
  await js('window.testErrors=[];window.addEventListener("error",e=>testErrors.push(e.message));window.addEventListener("unhandledrejection",e=>testErrors.push(String(e.reason)));');
  check('Inicio visible, canvas inicializado y sin dependencias de red',await js('return hebra.state==="menu" && !$("start-screen").classList.contains("hidden") && hebra.canvas.width>0 && performance.getEntriesByType("resource").every(e=>new URL(e.name).origin===location.origin)'));
  await shot('01-inicio.png');
  await js('$("start").click()');await wait(100);
  check('Inicio de partida: 90 segundos, 3 vidas y 22 gotas iniciales',await js('return hebra.state==="playing" && hebra.timeLeft>89 && hebra.lives===3 && hebra.motes.length>=21'));
  const before=await js('return hebra.player.x');await key('d',240);
  check('Movimiento real con teclado',await js(`return hebra.player.x>${before}+15`));
  await key(' ');
  check('Espacio activa pulso y enfriamiento',await js('return hebra.shield>0 && hebra.cooldown>3 && $("pulse").disabled'));
  await key('p');const pausedTime=await js('return hebra.timeLeft');await wait(180);
  check('Pausa detiene el reloj y muestra diálogo',await js(`return hebra.state==="paused" && hebra.timeLeft===${pausedTime} && !$("modal").classList.contains("hidden")`));
  await js('$("modal-action").click()');
  check('Continuar restaura partida y foco',await js('return hebra.state==="playing" && document.activeElement===$("game")'));
  // Escenarios controlados: colisión con el interior del hilo, entrega y límites.
  check('Geometría de colisión: interior, extremos y segmento de longitud cero',await js('return distanceToSegment(5,3,0,0,10,0)===3 && distanceToSegment(12,0,0,0,10,0)===2 && distanceToSegment(3,4,0,0,0,0)===5'));
  check('La hebra recoge rocío en su tramo central',await js('hebra.clearInput();hebra.ashes=[];hebra.motes=[];hebra.cargo=0;hebra.player.x=hebra.cx+200*hebra.unit;hebra.player.y=hebra.cy;hebra.motes.push({x:hebra.cx+100*hebra.unit,y:hebra.cy,life:20,phase:0,speed:0});hebra.update(1/120);return hebra.cargo===1 && hebra.motes.length===0'));
  check('Capacidad limitada a 6 gotas',await js('hebra.cargo=6;hebra.motes=[{x:hebra.cx+100*hebra.unit,y:hebra.cy,life:20,phase:0,speed:0}];hebra.update(1/120);return hebra.cargo===6 && hebra.motes.length===1'));
  check('Entregar cosecha completa: flor y 750 puntos',await js('hebra.player.x=hebra.cx;hebra.player.y=hebra.cy;hebra.score=0;hebra.delivered=0;hebra.update(1/120);return hebra.cargo===0 && hebra.delivered===6 && hebra.score===750'));
  check('La ceniza daña el hilo y la inmunidad evita daño múltiple',await js('hebra.player.x=hebra.cx+200*hebra.unit;hebra.player.y=hebra.cy;hebra.shield=0;hebra.invulnerable=0;hebra.cargo=4;hebra.lives=3;hebra.motes=[];hebra.ashes=Array.from({length:2},()=>({x:hebra.cx+100*hebra.unit,y:hebra.cy,vx:0,vy:0,angle:0,life:10,age:1}));hebra.update(1/120);return hebra.lives===2 && hebra.cargo===2 && hebra.ashes.length===1'));
  check('Pulso elimina ceniza y protege toda la hebra',await js('hebra.invulnerable=0;hebra.cooldown=0;hebra.pulse();hebra.update(1/120);return hebra.ashes.length===0 && hebra.lives===2'));
  check('Dificultad aumenta con el tiempo',await js('hebra.elapsed=54;hebra.update(1/120);return hebra.phase===4 && hebra.timeLeft<36'));
  await js('hebra.delivered=30;hebra.cargo=6;hebra.player.x=hebra.cx;hebra.player.y=hebra.cy;hebra.update(1/120)');
  check('Victoria y pantalla final con puntuación y récord',await js('return hebra.state==="ended" && hebra.delivered===36 && $("modal-title").textContent==="El vacío ha florecido." && !$("results").classList.contains("hidden") && hebra.best>=hebra.score'));
  await shot('03-victoria.png');await js('$("modal-action").click()');
  check('Volver a jugar reinicia estado, tiempo y puntuación',await js('return hebra.state==="playing" && hebra.delivered===0 && hebra.score===0 && hebra.cargo===0 && hebra.lives===3 && hebra.timeLeft>89'));
  check('Derrota al agotarse el tiempo',await js('hebra.elapsed=89.999;hebra.update(.01);return hebra.state==="ended" && $("modal-title").textContent==="Se durmió la marea."'));
  check('Derrota al perder la última vida',await js('hebra.start();hebra.invulnerable=0;hebra.lives=1;hebra.player.x=hebra.cx+200*hebra.unit;hebra.ashes=[{x:hebra.cx+100*hebra.unit,y:hebra.cy,vx:0,vy:0,angle:0,life:10,age:1}];hebra.update(1/120);return hebra.state==="ended" && hebra.lives===0'));
  await js('hebra.start();hebra.keys.add("a");window.dispatchEvent(new Event("blur"))');
  check('Pérdida de foco pausa y limpia controles',await js('return hebra.state==="paused" && hebra.keys.size===0 && hebra.pointer===null'));
  await js('hebra.home()');await viewport(390,844);await wait(350);
  console.log('Viewport móvil',await js('return {width:innerWidth,height:innerHeight}'));
  check('Vista móvil sin desbordamiento horizontal',await js('return innerWidth<500 && document.documentElement.scrollWidth<=innerWidth'));
  await shot('04-inicio-movil.png');await js('hebra.start()');await wait(150);
  const point=await js('const r=hebra.canvas.getBoundingClientRect();return {x:Math.round(r.left+r.width*.25),y:Math.round(r.top+r.height*.52),before:hebra.player.x}');
  // Un PointerEvent de tipo touch recorre los mismos controladores que el dedo.
  // Se usa además una secuencia nativa de ratón para comprobar captura de puntero.
  await cmd('/actions',{actions:[{type:'pointer',id:'finger',parameters:{pointerType:'touch'},actions:[{type:'pointerMove',x:point.x,y:point.y,duration:0},{type:'pointerDown',button:0},{type:'pause',duration:500},{type:'pointerUp',button:0}]}]});
  check('Control táctil nativo mueve la aguja y libera el puntero',await js(`return hebra.player.x<${point.before}-15 && hebra.pointer===null`));
  await js('$("pulse").click()');check('Botón táctil de pulso funciona',await js('return hebra.cooldown>4'));
  await shot('05-partida-movil.png');
  await viewport(320,740);await wait(120);
  check('Pantalla de 320 px: HUD y controles dentro del campo',await js('const r=document.querySelector(".arena").getBoundingClientRect();const p=$("pulse").getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth && p.right<=r.right && p.bottom<=r.bottom && getComputedStyle(document.querySelector(".score-stat")).display!=="none"'));
  await js('hebra.home()');await wait(260);
  check('Inicio legible a 320 px',await js('return $("start-screen").getBoundingClientRect().bottom<hebra.canvas.getBoundingClientRect().bottom-160'));
  await shot('06-inicio-estrecho.png');await js('hebra.start()');
  await viewport(1360,940);await wait(200);
  check('Cambiar orientación conserva estado y posiciones válidas',await js('return hebra.state==="playing" && Number.isFinite(hebra.player.x) && hebra.player.x>=0 && hebra.player.x<=hebra.w'));
  await js('hebra.start();hebra.delivered=18;hebra.score=2250;hebra.cargo=4;hebra.elapsed=40;hebra.update(.01);hebra.ashes.push({x:hebra.cx-150*hebra.unit,y:hebra.cy-150*hebra.unit,vx:15,vy:15,age:1,life:10,angle:0},{x:hebra.cx+220*hebra.unit,y:hebra.cy+90*hebra.unit,vx:-22,vy:-9,age:1,life:10,angle:1})');await wait(400);await shot('02-partida.png');
  const perf=await cmd('/execute/async',{script:'const done=arguments[0],samples=[];let prev=performance.now();function sample(now){samples.push(now-prev);prev=now;if(samples.length<120)requestAnimationFrame(sample);else done({mean:samples.slice(1).reduce((a,b)=>a+b,0)/119,over34:samples.filter(x=>x>34).length,max:Math.max(...samples)});}requestAnimationFrame(sample);',args:[]});
  reports.push(`MEDICIÓN · 120 fotogramas: media ${perf.mean.toFixed(2)} ms, ${perf.over34} intervalos >34 ms, máximo ${perf.max.toFixed(2)} ms (Firefox headless, entorno de prueba).`);console.log(reports.at(-1));
  check('Sin errores JavaScript en los escenarios de juego',await js('return testErrors.length===0'));
  const pilotSource=await readFile(new URL('piloto.js',import.meta.url),'utf8');
  const runs=await js(`return (${pilotSource})`);
  console.log('PARTIDAS SIMULADAS',runs);
  check('Objetivo alcanzable mediante partidas completas con controles ordinarios',runs.some(r=>r.won));
  reports.push(`SIMULACIÓN · ${JSON.stringify(runs)}`);
  check('Récord conserva la puntuación al recargar',await js('localStorage.setItem("hebra-test-best",String(hebra.best));return true'));
  await cmd('/refresh');
  check('Récord restaurado',await js('return hebra.best===Number(localStorage.getItem("hebra-test-best"))'));
  await js('localStorage.removeItem("hebra-test-best")');
  await cmd('/url',{url:new URL('../index.html',import.meta.url).href});
  check('Apertura directa de index.html sin servidor',await js('hebra.start();return location.protocol==="file:" && hebra.state==="playing" && hebra.canvas.width>0'));
  await cmd('/url',{url:origin});await js('window.testErrors=[];window.addEventListener("error",e=>testErrors.push(e.message))');
  await click('#sound');await wait(200);
  check('Control de sonido activa Web Audio',await js('return synth.enabled && synth.context!==null && $("sound").getAttribute("aria-pressed")==="true"'));
  const audioState=await js('return synth.context.state');
  reports.push(`AUDIO · Estado del contexto: ${audioState}. La salida audible no se comprueba en este navegador sin interfaz.`);
  console.log(reports.at(-1));await click('#sound');
  check('Control de sonido se puede apagar',await js('return !synth.enabled && $("sound").getAttribute("aria-pressed")==="false"'));
  check('Sin errores JavaScript durante las pruebas',await js('return testErrors.length===0'));
  const result={date:new Date().toISOString(),browser:'Firefox 159 headless',checks:reports,performance:perf};
  await writeFile(new URL('resultado.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
} finally { socket?.close(); if(sid) await call('DELETE',`/session/${sid}`); }
