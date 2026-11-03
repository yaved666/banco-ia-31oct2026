// Piloto de prueba: solo apunta la aguja y activa el mismo pulso del jugador.
// No modifica vidas, gotas, puntuación, enemigos ni tiempo durante las partidas.
(function () {
  const originalRandom = Math.random;
  const runs = [];
  try {
    for (const seed of [13, 71, 239, 503, 1021]) {
      let value = seed;
      Math.random = () => { value = (Math.imul(1664525, value) + 1013904223) >>> 0; return value / 4294967296; };
      hebra.start();
      let target = null;
      for (let frame = 0; frame < 90 * 60 + 1 && hebra.state === 'playing'; frame++) {
        const p = hebra.player;
        if (hebra.cargo >= 5 || (hebra.cargo > 0 && Math.hypot(p.x-hebra.cx,p.y-hebra.cy) < hebra.coreRadius + 20*hebra.unit)) {
          target = null; hebra.pointer = {x:hebra.cx,y:hebra.cy};
        } else {
          if (!target || !hebra.motes.includes(target) || frame % 24 === 0) {
            target = [...hebra.motes].sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
          }
          if (target) {
            const d = Math.hypot(target.x-hebra.cx,target.y-hebra.cy);
            hebra.pointer = {x:target.x+(target.x-hebra.cx)/d*20*hebra.unit,y:target.y+(target.y-hebra.cy)/d*20*hebra.unit};
          } else hebra.pointer = {x:hebra.cx,y:hebra.cy};
        }
        if (hebra.cooldown === 0 && hebra.ashes.some(a => a.age>.3 && distanceToSegment(a.x,a.y,hebra.cx,hebra.cy,p.x,p.y)<55*hebra.unit)) hebra.pulse();
        hebra.update(1/60);
      }
      runs.push({seed,won:hebra.delivered===36,seconds:Number(hebra.elapsed.toFixed(2)),delivered:hebra.delivered,lives:hebra.lives,score:hebra.score});
    }
  } finally { Math.random = originalRandom; }
  return runs;
})()
