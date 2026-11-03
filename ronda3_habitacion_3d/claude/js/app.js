/* Estancia 3D: salón recorrible en primera persona. */
(function () {
  'use strict';
  const F = window.MUEBLES;
  const V3 = THREE.Vector3;

  /* ---------------- dimensiones de la habitación ---------------- */
  const RX = 3.5, RZ = 2.75, ALTO = 2.7, GROSOR = 0.2;
  const VENT = { x0: -0.9, x1: 0.9, y0: 0.9, y1: 2.2 }; // hueco de la ventana (pared norte, z = -RZ)
  const OJOS = 1.62, RADIO = 0.26;

  const esTactil = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  document.body.classList.toggle('tactil', esTactil);

  /* ---------------- renderer ---------------- */
  const lienzo = document.getElementById('escena');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    document.getElementById('cargando').innerHTML = 'Este navegador no puede mostrar gráficos 3D.<br>Activa WebGL / la aceleración por hardware y recarga la página.';
    document.getElementById('cargando').style.textAlign = 'center';
    return;
  }
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // la escena es estática: las sombras se recalculan sólo cuando cambia algo
  renderer.shadowMap.needsUpdate = true;

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x9cc6ec);
  const camara = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 60);
  camara.rotation.order = 'YXZ';

  /* ---------------- entorno para reflejos (generado, sin HDR descargado) ---------------- */
  (function () {
    const pm = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    const caja = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({ color: 0x9a8a78, side: THREE.BackSide }));
    caja.position.y = 2; env.add(caja);
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ color: 0x5a4030 }));
    suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.99; env.add(suelo);
    const ventana = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6.5, 7) }));
    ventana.position.set(0, 2, -4.9); env.add(ventana);
    const techo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.2, 1.8) }));
    techo.rotation.x = Math.PI / 2; techo.position.y = 4.9; env.add(techo);
    escena.environment = pm.fromScene(env, 0.04).texture;
    pm.dispose();
  })();

  /* ---------------- texturas y materiales ---------------- */
  const tx = (c, o) => TX.aTextura(c, o);
  const texSuelo = tx(TX.tarima(), { repeat: [1, 1], aniso: 8 });
  const texSueloBump = tx(texSuelo.image, { srgb: false, repeat: [1, 1], aniso: 8 });
  const texPared = tx(TX.yeso('#e8ddcc', 3), { repeat: [1, 1] });
  const texParedAcento = tx(TX.yeso('#9fae9b', 4), { repeat: [1, 1] });
  const texTecho = tx(TX.yeso('#f3efe8', 5), { repeat: [1, 1] });
  const texNogal = tx(TX.madera('#6a4329', 9), { repeat: [1, 1] });
  const texRoble = tx(TX.madera('#b9895a', 10), { repeat: [1, 1] });
  const texExterior = { dia: tx(TX.exterior('dia')), tarde: tx(TX.exterior('tarde')), noche: tx(TX.exterior('noche')) };
  const texLomo = tx(TX.lomo());
  const texHoja = tx(TX.hoja());

  function std(p) { return new THREE.MeshStandardMaterial(p); }
  function tela(color, sem, rep) { return std({ map: tx(TX.tela(color, sem), { repeat: [rep || 2, rep || 2] }), roughness: 0.95 }); }

  const M = {
    suelo: std({ map: texSuelo, bumpMap: texSueloBump, bumpScale: 1.2, roughness: 0.42, metalness: 0 }),
    pared: std({ map: texPared, roughness: 0.92 }),
    paredAcento: std({ map: texParedAcento, roughness: 0.92 }),
    techo: std({ map: texTecho, roughness: 0.95 }),
    nogal: std({ map: texNogal, roughness: 0.5 }),
    nogalOscuro: std({ color: 0x3a2618, roughness: 0.6 }),
    roble: std({ map: texRoble, roughness: 0.48 }),
    pinturaBlanca: std({ color: 0xf1ede6, roughness: 0.55 }),
    laton: std({ color: 0xc9a46a, metalness: 1, roughness: 0.32 }),
    metalNegro: std({ color: 0x1d1d1f, metalness: 0.6, roughness: 0.45 }),
    plasticoNegro: std({ color: 0x0c0c0d, roughness: 0.35 }),
    telaSofa: tela('#5b7c70', 1, 3),
    telaSillon: tela('#c28a33', 2, 2),
    cojinTerracota: tela('#b55a3a', 3, 1),
    cojinCrema: tela('#e6dcc6', 4, 1),
    manta: tela('#d9c7a6', 6, 2),
    telaGris: tela('#55595e', 7, 1),
    ceramica: std({ color: 0xf2efe9, roughness: 0.25 }),
    ceramicaAzul: std({ color: 0x2f5b7a, roughness: 0.2 }),
    ceramicaTerracota: std({ color: 0xc0623d, roughness: 0.6 }),
    ceramicaVerde: std({ color: 0x7c9a83, roughness: 0.3 }),
    terracota: std({ color: 0xb4633f, roughness: 0.85 }),
    tierra: std({ color: 0x3a2a1e, roughness: 1 }),
    tallo: std({ color: 0x4f6b35, roughness: 0.8 }),
    hoja: std({ map: texHoja, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55 }),
    suculenta: std({ color: 0x7fa38a, roughness: 0.6 }),
    marmol: std({ color: 0xece8e1, roughness: 0.2 }),
    lino: std({ map: tx(TX.tela('#efe6d3', 8), { repeat: [3, 6] }), side: THREE.DoubleSide, roughness: 1 }),
    pantallaLino: std({ map: tx(TX.tela('#f3e9d6', 9), { repeat: [3, 1] }), side: THREE.DoubleSide, roughness: 1, emissive: 0xffb466, emissiveIntensity: 0 }),
    bombilla: std({ color: 0xfff4e0, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.2 }),
    campanaTecho: std({ color: 0x2d4a43, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }),
    radiador: std({ color: 0xf0eee9, metalness: 0.2, roughness: 0.4 }),
    foto: std({ map: tx(TX.foto()), roughness: 0.4 }),
    revista1: std({ color: 0xd9b56a, roughness: 0.5 }),
    revista2: std({ color: 0x3f6f8a, roughness: 0.5 }),
    libroA: std({ color: 0x7a2e2a, roughness: 0.7 }),
    libroB: std({ color: 0x24476b, roughness: 0.7 }),
    libroC: std({ color: 0xc2a15a, roughness: 0.7 }),
    naranja: std({ color: 0xe8822a, roughness: 0.6 }),
    manzana: std({ color: 0x9fbf3a, roughness: 0.5 }),
    libros: std({ map: texLomo, vertexColors: true, roughness: 0.75 }),
    pantallaApagada: std({ color: 0x060607, roughness: 0.28, metalness: 0.1 }),
    pantallaEncendida: new THREE.MeshBasicMaterial({ map: tx(TX.tv()), color: 0xdddddd }),
    esferaReloj: std({ map: tx(TX.reloj()), roughness: 0.5 }),
    cuadro1: std({ map: tx(TX.cuadroPaisaje()), roughness: 0.8 }),
    cuadro2: std({ map: tx(TX.cuadroGeometrico()), roughness: 0.8 }),
    vidrio: new THREE.MeshStandardMaterial({ color: 0xcfe3ec, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false }),
    ramaSeca: std({ color: 0x8a6b4a, roughness: 0.9 }),
    espiga: std({ color: 0xe0cfa8, roughness: 1 }),
    alfombra: std({ map: tx(TX.alfombra(), { aniso: 8 }), roughness: 1 }),
    rodapie: std({ color: 0xf1ede6, roughness: 0.5 })
  };

  /* ---------------- construcción de la habitación ---------------- */
  const colisiones = [];      // rectángulos XZ {x0,x1,z0,z1}
  const interactivos = [];    // controladores que se pueden encender/apagar
  const noRaycast = () => {};

  function colisionar(obj, margen = 0.02) {
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj);
    colisiones.push({ x0: b.min.x - margen, x1: b.max.x + margen, z0: b.min.z - margen, z1: b.max.z + margen, nombre: obj.name || '' });
  }
  function colisionRect(x0, x1, z0, z1, nombre) { colisiones.push({ x0, x1, z0, z1, nombre }); }

  function pared(x0, x1, y0, y1, z0, z1, mat) {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    F.uvMundo(geo, 1 / 2.2);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    escena.add(m);
    return m;
  }

  // suelo
  {
    const geo = new THREE.PlaneGeometry(RX * 2, RZ * 2);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv, p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.0, p.getZ(i) / 2.0);
    const suelo = new THREE.Mesh(geo, M.suelo);
    suelo.receiveShadow = true; suelo.name = 'suelo';
    escena.add(suelo);
    // techo
    const gt = new THREE.PlaneGeometry(RX * 2, RZ * 2); gt.rotateX(Math.PI / 2);
    const ut = gt.attributes.uv, pt = gt.attributes.position;
    for (let i = 0; i < pt.count; i++) ut.setXY(i, pt.getX(i) / 2.2, pt.getZ(i) / 2.2);
    const techo = new THREE.Mesh(gt, M.techo);
    techo.position.y = ALTO; techo.receiveShadow = true; techo.castShadow = true;
    escena.add(techo);
  }
  // paredes (norte con hueco de ventana)
  const zN = -RZ, zS = RZ, G = GROSOR;
  pared(-RX - G, VENT.x0, 0, ALTO, zN - G, zN, M.pared);
  pared(VENT.x1, RX + G, 0, ALTO, zN - G, zN, M.pared);
  pared(VENT.x0, VENT.x1, 0, VENT.y0, zN - G, zN, M.pared);
  pared(VENT.x0, VENT.x1, VENT.y1, ALTO, zN - G, zN, M.pared);
  pared(-RX - G, RX + G, 0, ALTO, zS, zS + G, M.pared);           // sur
  pared(-RX - G, -RX, 0, ALTO, zN, zS, M.paredAcento);            // oeste (color acento)
  pared(RX, RX + G, 0, ALTO, zN, zS, M.pared);                    // este
  colisionRect(-RX - 1, RX + 1, zN - 1, zN, 'pared N');
  colisionRect(-RX - 1, RX + 1, zS, zS + 1, 'pared S');
  colisionRect(-RX - 1, -RX, zN - 1, zS + 1, 'pared O');
  colisionRect(RX, RX + 1, zN - 1, zS + 1, 'pared E');

  // rodapiés y moldura de techo
  {
    const h = 0.09, e = 0.015;
    const tramos = [
      [-RX, RX, zN + e / 2, 'x'], [-RX, -3.1, zS - e / 2, 'x'], [-2.1, RX, zS - e / 2, 'x'],
      [zN, zS, -RX + e / 2, 'z'], [zN, zS, RX - e / 2, 'z']
    ];
    for (const [a, b, c, eje] of tramos) {
      const m = eje === 'x' ? F.caja(b - a, h, e, M.rodapie, (a + b) / 2, h / 2, c) : F.caja(e, h, b - a, M.rodapie, c, h / 2, (a + b) / 2);
      escena.add(m);
      const t = eje === 'x' ? F.caja(b - a, 0.05, 0.04, M.rodapie, (a + b) / 2, ALTO - 0.025, c + (c > 0 ? -0.0125 : 0.0125)) : F.caja(0.04, 0.05, b - a, M.rodapie, c + (c > 0 ? -0.0125 : 0.0125), ALTO - 0.025, (a + b) / 2);
      t.castShadow = false; escena.add(t);
    }
  }

  // ventana: marco, parteluz, vidrio y alféizar
  {
    const zc = zN - G / 2, fw = 0.06, fd = 0.09;
    const w = VENT.x1 - VENT.x0, h = VENT.y1 - VENT.y0, cy = (VENT.y0 + VENT.y1) / 2;
    const marco = [
      F.caja(w, fw, fd, M.pinturaBlanca, 0, VENT.y1 - fw / 2, zc),
      F.caja(w, fw, fd, M.pinturaBlanca, 0, VENT.y0 + fw / 2, zc),
      F.caja(fw, h, fd, M.pinturaBlanca, VENT.x0 + fw / 2, cy, zc),
      F.caja(fw, h, fd, M.pinturaBlanca, VENT.x1 - fw / 2, cy, zc),
      F.caja(0.05, h, fd * 0.8, M.pinturaBlanca, 0, cy, zc),
      F.caja(w, 0.04, fd * 0.8, M.pinturaBlanca, 0, VENT.y1 - 0.42, zc)
    ];
    marco.forEach(m => escena.add(m));
    const vidrio = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.vidrio);
    vidrio.position.set(0, cy, zc); vidrio.raycast = noRaycast; vidrio.renderOrder = 2;
    escena.add(vidrio);
    escena.add(F.caja(w + 0.24, 0.035, 0.3, M.pinturaBlanca, 0, VENT.y0 - 0.0175, zN - G + 0.15 + 0.03));
    // planta pequeña en el alféizar
    const maceta = F.torno([[0, 0], [0.05, 0], [0.065, 0.1], [0, 0.1]], M.ceramicaTerracota, 0.55, VENT.y0, zN + 0.03);
    escena.add(maceta);
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.12 + (i % 3) * 0.04, 5), M.suculenta);
      s.position.set(0.55 + Math.cos(i * 2.3) * 0.025, VENT.y0 + 0.15 + (i % 3) * 0.02, zN + 0.03 + Math.sin(i * 2.3) * 0.025);
      s.rotation.set(Math.sin(i) * 0.3, 0, Math.cos(i * 1.7) * 0.3);
      F.sombra(s); escena.add(s);
    }
    // radiador bajo la ventana
    const rad = F.radiador(M, 1.2); rad.position.set(0, 0, zN + 0.07); escena.add(rad);
    // barra y cortinas
    const barra = F.cil(0.012, 0.012, 3.0, M.laton, 0, 2.45, zN + 0.12, 10); barra.rotation.z = Math.PI / 2; escena.add(barra);
    for (const sx of [-1, 1]) {
      escena.add(F.cil(0.02, 0.02, 0.02, M.laton, sx * 1.5, 2.45, zN + 0.12, 10));
      const c = F.cortina(M, 0.6, 2.38);
      c.position.set(sx * 1.2, 2.43 - 2.38 / 2, zN + 0.12); escena.add(c);
    }
  }

  // vista exterior (fondo pintado)
  const exterior = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshBasicMaterial({ map: texExterior.dia, fog: false, toneMapped: false }));
  exterior.position.set(0, 1.1, -11); exterior.raycast = noRaycast;
  escena.add(exterior);

  /* ---------------- muebles ---------------- */
  // Alfombra
  const alfombra = new THREE.Mesh(F.geoCajaRedondeada(1.8, 0.012, 2.6, 0.005, 1), M.alfombra);
  alfombra.position.set(0.55, 0.006, 0); alfombra.receiveShadow = true; alfombra.rotation.y = 0;
  escena.add(alfombra);

  // Sofá mirando al este (+x)
  const sofa = F.sofa(M); sofa.name = 'sofá';
  sofa.position.set(-0.85, 0, 0); sofa.rotation.y = Math.PI / 2;
  escena.add(sofa); colisionar(sofa);

  // Mesa de centro
  const mesa = F.mesaCentro(M); mesa.name = 'mesa de centro';
  mesa.position.set(0.75, 0.012, 0); mesa.rotation.y = Math.PI / 2;
  escena.add(mesa); colisionar(mesa);

  // Estantería en la pared oeste
  const estanteria = F.estanteria(M); estanteria.name = 'estantería';
  estanteria.position.set(-RX + 0.17 + 0.005, 0, -0.95); estanteria.rotation.y = Math.PI / 2;
  escena.add(estanteria); colisionar(estanteria);

  // Mueble de TV en la pared este
  const mtv = F.muebleTV(M); mtv.grupo.name = 'mueble TV';
  mtv.grupo.position.set(RX - 0.21 - 0.005, 0, 0.1); mtv.grupo.rotation.y = -Math.PI / 2;
  escena.add(mtv.grupo); colisionar(mtv.grupo);
  mtv.tv.idx = 4; interactivos.push({ ctrl: mtv.tv, obj: mtv.pantalla.parent });

  // Sillón junto a la ventana mirando hacia la mesa
  const sillon = F.sillon(M); sillon.name = 'sillón';
  sillon.position.set(2.05, 0, -1.65); sillon.rotation.y = -0.75;
  escena.add(sillon); colisionar(sillon, 0);

  // Lámpara de pie junto al sofá
  const lPie = F.lamparaPie(M); lPie.grupo.name = 'lámpara de pie';
  lPie.grupo.position.set(-1.0, 0, -1.5);
  escena.add(lPie.grupo); colisionRect(-1.0 - 0.2, -1.0 + 0.2, -1.5 - 0.2, -1.5 + 0.2, 'lámpara de pie');
  // (sin sombras propias: su pantalla es de tela y así se ahorra un mapa de sombras cúbico)
  interactivos.push({ ctrl: lPie.ctrl, obj: lPie.grupo });

  // Mesa auxiliar + lámpara de mesa al otro lado del sofá
  const mAux = F.mesaAuxiliar(M); mAux.name = 'mesa auxiliar';
  mAux.position.set(-0.95, 0, 1.45); escena.add(mAux); colisionar(mAux);
  const lMesa = F.lamparaMesa(M); lMesa.grupo.name = 'lámpara de mesa';
  lMesa.grupo.position.set(-0.98, 0.58, 1.45); escena.add(lMesa.grupo);
  interactivos.push({ ctrl: lMesa.ctrl, obj: lMesa.grupo });

  // Lámpara de techo sobre la mesa
  const lTecho = F.lamparaTecho(M, 0.62); lTecho.grupo.name = 'lámpara de techo';
  lTecho.grupo.position.set(0.75, ALTO, 0); escena.add(lTecho.grupo);
  lTecho.luz.castShadow = true; lTecho.luz.shadow.mapSize.set(512, 512); lTecho.luz.shadow.bias = -0.003; lTecho.luz.shadow.camera.near = 0.05; lTecho.luz.shadow.camera.far = 10; /* el bias va normalizado por far */ lTecho.luz.shadow.radius = 3;
  interactivos.push({ ctrl: lTecho.ctrl, obj: lTecho.grupo });

  // Interruptor junto a la puerta (controla la lámpara de techo)
  const inter = F.interruptor(M);
  inter.grupo.position.set(-1.9, 1.1, zS - 0.006); inter.grupo.rotation.y = Math.PI; escena.add(inter.grupo);
  interactivos.push({ ctrl: lTecho.ctrl, obj: inter.grupo, etiqueta: 'Interruptor (lámpara de techo)' });

  // Planta grande en la esquina noreste
  const planta = F.planta(M); planta.name = 'planta';
  planta.position.set(RX - 0.4, 0, zN + 0.4); escena.add(planta);
  colisionRect(RX - 0.4 - 0.26, RX, zN, zN + 0.4 + 0.26, 'planta');

  // Aparador en la pared sur
  const aparador = F.aparador(M); aparador.name = 'aparador';
  aparador.position.set(1.3, 0, zS - 0.21 - 0.005); aparador.rotation.y = Math.PI;
  escena.add(aparador); colisionar(aparador);

  // Puerta (cerrada) en la pared sur
  const puerta = F.puerta(M); puerta.position.set(-2.6, 0, zS - 0.02); puerta.rotation.y = Math.PI; escena.add(puerta);

  // Cuadros y reloj
  const c1 = F.cuadro(M, M.cuadro1, 1.15, 0.8); c1.position.set(-RX + 0.02, 1.55, 1.25); c1.rotation.y = Math.PI / 2; escena.add(c1);
  const c2 = F.cuadro(M, M.cuadro2, 0.6, 0.8, M.roble); c2.position.set(1.3, 1.62, zS - 0.02); c2.rotation.y = Math.PI; escena.add(c2);
  const reloj = F.reloj(M); reloj.grupo.position.set(RX - 0.02, 2.0, 0.1); reloj.grupo.rotation.y = -Math.PI / 2; escena.add(reloj.grupo);

  // Marcar objetos interactivos
  interactivos.forEach((it, i) => it.obj.traverse(o => { o.userData.interactivo = it; }));

  /* ---------------- iluminación ---------------- */
  const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x9a8068, 0.5);
  escena.add(hemi);

  const sol = new THREE.DirectionalLight(0xfff0d8, 3.5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  const sc = sol.shadow.camera;
  sc.left = -5; sc.right = 5; sc.top = 5; sc.bottom = -5; sc.near = 0.5; sc.far = 30;
  sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.02;
  sol.target.position.set(0, 0, 0.3);
  escena.add(sol, sol.target);

  // Luz de cielo que entra por la ventana (relleno suave, sin sombras)
  const cielo = new THREE.SpotLight(0xdbe9ff, 14, 0, 1.1, 1, 1.6);
  cielo.position.set(0, 2.0, zN - 0.6);
  cielo.target.position.set(0, 0.4, 1.5);
  escena.add(cielo, cielo.target);

  // Rebote: la mancha de sol del suelo ilumina de forma difusa el techo y las paredes (GI barata)
  const rebote = new THREE.PointLight(0xffe2bd, 0, 0, 1.4);
  escena.add(rebote);

  /* Haz de luz volumétrico (falso) y polvo en suspensión */
  const hazMat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0xfff1d6) }, opacidad: { value: 0.06 } },
    vertexShader: 'attribute float t; varying float vT; void main(){ vT=t; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 color; uniform float opacidad; varying float vT; void main(){ float a=opacidad*pow(1.0-vT,1.4); gl_FragColor=vec4(color*a,1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  const haz = new THREE.Mesh(new THREE.BufferGeometry(), hazMat);
  haz.raycast = noRaycast; haz.renderOrder = 3; haz.frustumCulled = false;
  escena.add(haz);

  const N_POLVO = 350;
  const polvoGeo = new THREE.BufferGeometry();
  const polvoUVS = new Float32Array(N_POLVO * 3);
  { const r = TX.rng(99); for (let i = 0; i < N_POLVO * 3; i++) polvoUVS[i] = r(); }
  polvoGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_POLVO * 3), 3));
  polvoGeo.setAttribute('semilla', new THREE.BufferAttribute(polvoUVS, 3));
  const polvoMat = new THREE.ShaderMaterial({
    uniforms: { tiempo: { value: 0 }, opacidad: { value: 0.5 }, escalaPx: { value: 1 } },
    vertexShader: `attribute vec3 semilla; uniform float tiempo; uniform float escalaPx; varying float vA;
      void main(){ vec3 p = position + vec3(sin(tiempo*0.21+semilla.x*40.0), sin(tiempo*0.13+semilla.y*30.0), cos(tiempo*0.17+semilla.z*50.0))*0.06;
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
        gl_PointSize = escalaPx*(1.0+semilla.z*1.5)*4.0/(-mv.z); vA = 0.4+0.6*fract(semilla.x*7.0+tiempo*0.05); }`,
    fragmentShader: `uniform float opacidad; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d)*opacidad*vA; gl_FragColor=vec4(vec3(1.0,0.93,0.8)*a,1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const polvo = new THREE.Points(polvoGeo, polvoMat);
  polvo.raycast = noRaycast; polvo.frustumCulled = false;
  escena.add(polvo);

  function actualizarHaz(dirSol) {
    // dirSol: dirección en la que viaja la luz (de fuera hacia dentro)
    const esquinas = [[VENT.x0, VENT.y0], [VENT.x1, VENT.y0], [VENT.x1, VENT.y1], [VENT.x0, VENT.y1]];
    const z = zN;
    const pos = [], t = [];
    const proyectar = (x, y) => {
      let k = y / -dirSol.y;                         // hasta el suelo
      const kz = (zS - z) / dirSol.z;                 // o hasta la pared sur
      k = Math.min(k, kz);
      return [x + dirSol.x * k, y + dirSol.y * k, z + dirSol.z * k];
    };
    const A = esquinas.map(([x, y]) => [x, y, z]);
    const B = esquinas.map(([x, y]) => proyectar(x, y));
    const quad = (a, b, c, d, ta, tb, tc, td) => {
      pos.push(...a, ...b, ...c, ...a, ...c, ...d); t.push(ta, tb, tc, ta, tc, td);
    };
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(A[i], A[j], B[j], B[i], 0, 0, 1, 1);
    }
    const g = haz.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('t', new THREE.Float32BufferAttribute(t, 1));
    g.computeBoundingSphere();
    // polvo dentro del prisma
    const pp = polvoGeo.attributes.position;
    for (let i = 0; i < N_POLVO; i++) {
      const u = polvoUVS[i * 3], v = polvoUVS[i * 3 + 1], s = polvoUVS[i * 3 + 2] * 0.85;
      const x = VENT.x0 + (VENT.x1 - VENT.x0) * u, y = VENT.y0 + (VENT.y1 - VENT.y0) * v;
      const e = proyectar(x, y);
      pp.setXYZ(i, x + (e[0] - x) * s, y + (e[1] - y) * s, z + (e[2] - z) * s);
    }
    pp.needsUpdate = true;
    // la luz de rebote se coloca sobre el centro de la mancha de sol
    let cx = 0, cz = 0; for (const b of B) { cx += b[0] / 4; cz += b[2] / 4; }
    rebote.position.set(cx, -0.25, Math.min(cz, zS - 0.5)); // bajo el suelo: ilumina techo y paredes, no el suelo
  }

  /* ---------------- momentos del día ---------------- */
  const MODOS = {
    dia:   { nombre: 'Día', icono: '☀️', dir: [2.4, 5.6, -6.5], solColor: 0xfff0d8, solI: 14, hemiCielo: 0xdfeaff, hemiSuelo: 0xcdb89c, hemiI: 0.6, cieloColor: 0xdbe9ff, cieloI: 11, reboteI: 7, env: 0.32, haz: 0.05, polvo: 0.55, fondo: 0x9cc6ec, exp: 1.0 },
    tarde: { nombre: 'Atardecer', icono: '🌇', dir: [5.2, 2.3, -6.5], solColor: 0xffa060, solI: 8, hemiCielo: 0xffc4a0, hemiSuelo: 0xb08060, hemiI: 0.4, cieloColor: 0xffb990, cieloI: 7, reboteI: 4, env: 0.2, haz: 0.08, polvo: 0.7, fondo: 0xd98a6a, exp: 1.05 },
    noche: { nombre: 'Noche', icono: '🌙', dir: [-3, 5, -6.5], solColor: 0x8aa4ff, solI: 1.2, hemiCielo: 0x26345a, hemiSuelo: 0x1a1612, hemiI: 0.12, cieloColor: 0x6f86c9, cieloI: 1.4, reboteI: 0, env: 0.05, haz: 0.012, polvo: 0.0, fondo: 0x0b1530, exp: 1.1 }
  };
  const ORDEN_MODOS = ['dia', 'tarde', 'noche'];
  const todosMateriales = new Set();
  escena.traverse(o => { if (o.material) [].concat(o.material).forEach(m => todosMateriales.add(m)); });
  [M.pantallaApagada, M.pantallaEncendida].forEach(m => todosMateriales.add(m));

  let modoActual = 'dia';
  function ponerModo(nombre) {
    const m = MODOS[nombre]; modoActual = nombre;
    const d = new V3(...m.dir);
    sol.position.copy(sol.target.position).add(d.clone().normalize().multiplyScalar(12));
    sol.color.setHex(m.solColor); sol.intensity = m.solI;
    hemi.color.setHex(m.hemiCielo); hemi.groundColor.setHex(m.hemiSuelo); hemi.intensity = m.hemiI;
    cielo.color.setHex(m.cieloColor); cielo.intensity = m.cieloI;
    rebote.color.setHex(m.solColor); rebote.intensity = m.reboteI;
    escena.background.setHex(m.fondo);
    exterior.material.map = texExterior[nombre]; exterior.material.needsUpdate = true;
    renderer.toneMappingExposure = m.exp;
    todosMateriales.forEach(mat => { if ('envMapIntensity' in mat) mat.envMapIntensity = m.env; });
    hazMat.uniforms.opacidad.value = m.haz;
    hazMat.uniforms.color.value.setHex(nombre === 'tarde' ? 0xffb070 : nombre === 'noche' ? 0x8aa4ff : 0xfff1d6);
    polvoMat.uniforms.opacidad.value = m.polvo;
    actualizarHaz(d.clone().normalize().negate());
    renderer.shadowMap.needsUpdate = true;
    const b = document.getElementById('btnModo');
    if (b) b.textContent = m.icono + ' ' + m.nombre;
  }

  /* ---------------- estado de las lámparas (avisos) ---------------- */
  const avisoEl = document.getElementById('aviso');
  let avisoT = 0;
  function aviso(txt) { avisoEl.textContent = txt; avisoEl.classList.add('visible'); avisoT = 2.2; }
  [lPie.ctrl, lMesa.ctrl, lTecho.ctrl, mtv.tv].forEach(c => { c.onCambio = on => aviso(`${c.nombre}: ${on ? 'encendida' : 'apagada'}`.replace('Televisor: encendida', 'Televisor: encendido').replace('Televisor: apagada', 'Televisor: apagado')); });

  ponerModo('dia');
  lPie.ctrl.set(true); lMesa.ctrl.set(false); lTecho.ctrl.set(false); mtv.tv.set(false);
  avisoEl.classList.remove('visible'); avisoT = 0;

  /* ---------------- jugador y colisiones ---------------- */
  const jugador = { x: -2.35, z: 1.95, yaw: -0.72, pitch: -0.05, vx: 0, vz: 0, paso: 0 };

  function choca(x, z) {
    for (const b of colisiones) {
      const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < RADIO * RADIO) return b;
    }
    return null;
  }

  function mover(dx, dz) {
    const pasos = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
    const sx = dx / pasos, sz = dz / pasos;
    for (let i = 0; i < pasos; i++) {
      if (!choca(jugador.x + sx, jugador.z)) jugador.x += sx; else jugador.vx *= 0.5;
      if (!choca(jugador.x, jugador.z + sz)) jugador.z += sz; else jugador.vz *= 0.5;
    }
  }

  /* ---------------- entrada: teclado, ratón, táctil ---------------- */
  const teclas = new Set();
  const joy = { activo: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const mirada = { id: null, lx: 0, ly: 0, sx: 0, sy: 0, t0: 0 };
  let activo = false, bloqueado = false, modoArrastre = false;
  const overlay = document.getElementById('inicio');

  function empezar() {
    activo = true; overlay.classList.add('oculto');
    if (!esTactil && !modoArrastre && lienzo.requestPointerLock) {
      try {
        const p = lienzo.requestPointerLock();
        if (p && p.catch) p.catch(() => { modoArrastre = true; });
      } catch (e) { modoArrastre = true; }
    }
  }
  document.getElementById('btnEntrar').addEventListener('click', e => { e.stopPropagation(); empezar(); });
  overlay.addEventListener('click', () => empezar());

  document.addEventListener('pointerlockchange', () => {
    const ahora = document.pointerLockElement === lienzo;
    if (bloqueado && !ahora) { activo = false; overlay.classList.remove('oculto'); document.getElementById('tituloInicio').textContent = 'En pausa'; }
    bloqueado = ahora;
  });
  document.addEventListener('pointerlockerror', () => { modoArrastre = true; });

  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    teclas.add(e.code);
    if (e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'Enter') { if (!activo && e.code === 'Enter') empezar(); else interactuar(0, 0, 4.5); }
    if (e.code === 'KeyT') cambiarModo();
    if (e.code === 'Digit1') lPie.ctrl.alternar();
    if (e.code === 'Digit2') lMesa.ctrl.alternar();
    if (e.code === 'Digit3') lTecho.ctrl.alternar();
    if (e.code === 'Digit4') mtv.tv.alternar();
    if (e.code === 'KeyF') document.getElementById('fps').classList.toggle('visible');
  });
  window.addEventListener('keyup', e => teclas.delete(e.code));
  window.addEventListener('blur', () => teclas.clear());

  const SENS = 0.0022;
  function girar(dx, dy, s) {
    jugador.yaw -= dx * s; jugador.pitch -= dy * s;
    jugador.pitch = Math.max(-1.4, Math.min(1.4, jugador.pitch));
  }

  let raton = null;
  lienzo.addEventListener('mousedown', e => {
    if (!activo) return;
    if (bloqueado) { if (e.button === 0) interactuar(0, 0, 4.5); return; }
    raton = { x: e.clientX, y: e.clientY, mov: 0 };
  });
  window.addEventListener('mousemove', e => {
    if (bloqueado) {
      // Chrome a veces envía un salto enorme justo al bloquear el puntero: se descarta
      if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      girar(e.movementX, e.movementY, SENS); return;
    }
    if (raton && (e.buttons & 1)) {
      const dx = e.clientX - raton.x, dy = e.clientY - raton.y;
      raton.mov += Math.abs(dx) + Math.abs(dy); raton.x = e.clientX; raton.y = e.clientY;
      girar(dx, dy, 0.004);
    }
  });
  window.addEventListener('mouseup', e => {
    if (raton && raton.mov < 6 && activo && !bloqueado) {
      const nx = (e.clientX / window.innerWidth) * 2 - 1, ny = -(e.clientY / window.innerHeight) * 2 + 1;
      interactuar(nx, ny, 6);
    }
    raton = null;
  });

  // táctil: mitad izquierda = joystick, resto = mirar; toque corto = interactuar
  const joyBase = document.getElementById('joy'), joyPomo = document.getElementById('joyPomo');
  const JOY_R = 55;
  lienzo.addEventListener('touchstart', e => {
    e.preventDefault();
    if (!activo) empezar();
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * 0.42 && joy.id === null) {
        joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = 0; joy.y = 0; joy.activo = true;
        joyBase.style.left = t.clientX + 'px'; joyBase.style.top = t.clientY + 'px';
        joyBase.classList.add('visible'); joyPomo.style.transform = 'translate(-50%,-50%)';
      } else if (mirada.id === null) {
        mirada.id = t.identifier; mirada.lx = mirada.sx = t.clientX; mirada.ly = mirada.sy = t.clientY; mirada.t0 = performance.now();
      }
    }
  }, { passive: false });
  lienzo.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy;
        const l = Math.hypot(dx, dy);
        if (l > JOY_R) { dx *= JOY_R / l; dy *= JOY_R / l; }
        joy.x = dx / JOY_R; joy.y = dy / JOY_R;
        joyPomo.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      } else if (t.identifier === mirada.id) {
        girar(t.clientX - mirada.lx, t.clientY - mirada.ly, 0.0055);
        mirada.lx = t.clientX; mirada.ly = t.clientY;
      }
    }
  }, { passive: false });
  function finToque(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { joy.id = null; joy.activo = false; joy.x = joy.y = 0; joyBase.classList.remove('visible'); }
      else if (t.identifier === mirada.id) {
        const mov = Math.hypot(t.clientX - mirada.sx, t.clientY - mirada.sy);
        if (e.type === 'touchend' && mov < 12 && performance.now() - mirada.t0 < 350) {
          interactuar((t.clientX / window.innerWidth) * 2 - 1, -(t.clientY / window.innerHeight) * 2 + 1, 7);
        }
        mirada.id = null;
      }
    }
  }
  lienzo.addEventListener('touchend', finToque, { passive: false });
  lienzo.addEventListener('touchcancel', finToque, { passive: false });

  // botones del HUD
  function cambiarModo() { ponerModo(ORDEN_MODOS[(ORDEN_MODOS.indexOf(modoActual) + 1) % 3]); aviso('Momento del día: ' + MODOS[modoActual].nombre); }
  document.getElementById('btnModo').addEventListener('click', e => { e.stopPropagation(); cambiarModo(); });
  document.getElementById('btnAyuda').addEventListener('click', e => { e.stopPropagation(); document.getElementById('ayuda').classList.toggle('oculta'); });
  ['btnModo', 'btnAyuda'].forEach(id => document.getElementById(id).addEventListener('mousedown', e => e.stopPropagation()));

  /* ---------------- interacción (raycast) ---------------- */
  const ray = new THREE.Raycaster();
  const v2 = new THREE.Vector2();
  function objetivo(nx, ny, lejos) {
    v2.set(nx, ny);
    ray.setFromCamera(v2, camara);
    ray.far = lejos;
    const hits = ray.intersectObjects(escena.children, true);
    for (const h of hits) {
      if (!h.object.visible) continue;
      return h.object.userData.interactivo || null; // el primer objeto opaco decide
    }
    return null;
  }
  function interactuar(nx, ny, lejos) {
    const it = objetivo(nx, ny, lejos);
    if (it) { it.ctrl.alternar(); return true; }
    return false;
  }

  /* ---------------- bucle principal ---------------- */
  const etiqueta = document.getElementById('etiqueta'), mira = document.getElementById('mira'), fpsEl = document.getElementById('fps');
  let ultimo = performance.now(), acumHover = 0, frames = 0, tFps = 0, fpsMedio = 60, tiempo = 0, totalFrames = 0, tiempoActivo = 0, ayudaOcultada = false;
  const DIR = new V3();

  function bucle(ahora) {
    const dtReal = Math.max(0, (ahora - ultimo) / 1000);
    const dt = Math.min(0.05, dtReal); ultimo = ahora; tiempo += dt;

    // movimiento
    let adelante = 0, lado = 0;
    if (activo) {
      if (teclas.has('KeyW') || teclas.has('ArrowUp')) adelante += 1;
      if (teclas.has('KeyS') || teclas.has('ArrowDown')) adelante -= 1;
      if (teclas.has('KeyD') || teclas.has('ArrowRight')) lado += 1;
      if (teclas.has('KeyA') || teclas.has('ArrowLeft')) lado -= 1;
      if (joy.activo) { adelante -= joy.y; lado += joy.x; }
    }
    const l = Math.hypot(adelante, lado);
    if (l > 1) { adelante /= l; lado /= l; }
    const vel = (teclas.has('ShiftLeft') || teclas.has('ShiftRight')) ? 3.4 : 2.0;
    const sy = Math.sin(jugador.yaw), cy = Math.cos(jugador.yaw);
    const tx = (-sy * adelante + cy * lado) * vel, tz = (-cy * adelante - sy * lado) * vel;
    const k = 1 - Math.exp(-12 * dt);
    jugador.vx += (tx - jugador.vx) * k; jugador.vz += (tz - jugador.vz) * k;
    mover(jugador.vx * dt, jugador.vz * dt);
    const rapidez = Math.hypot(jugador.vx, jugador.vz);
    jugador.paso += rapidez * dt * 5.5;
    const bob = Math.sin(jugador.paso) * 0.025 * Math.min(1, rapidez / 2);

    camara.position.set(jugador.x, OJOS + bob, jugador.z);
    camara.rotation.set(jugador.pitch, jugador.yaw, 0);

    // animaciones
    reloj.actualizar();
    polvoMat.uniforms.tiempo.value = tiempo;
    polvoMat.uniforms.escalaPx.value = renderer.getPixelRatio() * window.innerHeight / 720;

    // objeto bajo la mira (sólo en escritorio, 10 veces por segundo)
    acumHover += dt;
    if (acumHover > 0.1) {
      acumHover = 0;
      const it = (!esTactil && activo) ? objetivo(0, 0, 4.5) : null;
      if (it) {
        etiqueta.textContent = `${it.etiqueta || it.ctrl.nombre} — clic o E para ${it.ctrl.encendida ? 'apagar' : 'encender'}`;
        etiqueta.classList.add('visible'); mira.classList.add('activa');
      } else { etiqueta.classList.remove('visible'); mira.classList.remove('activa'); }
    }
    if (activo) { tiempoActivo += dt; if (tiempoActivo > 12 && !ayudaOcultada) { ayudaOcultada = true; document.getElementById('ayuda').classList.add('oculta'); } }
    if (avisoT > 0) { avisoT -= dt; if (avisoT <= 0) avisoEl.classList.remove('visible'); }

    renderer.render(escena, camara);
    if (++totalFrames === 1) { const c = document.getElementById('cargando'); if (c) c.remove(); }

    // FPS y calidad adaptativa
    frames++; tFps += dtReal; // tiempo real, no recortado
    if (tFps >= 1) {
      fpsMedio = frames / tFps; frames = 0; tFps = 0;
      fpsEl.textContent = `${fpsMedio.toFixed(0)} fps · ${renderer.getPixelRatio().toFixed(2)}x`;
      if (tiempo > 2.5 && fpsMedio < 40 && pixelRatio > 0.75) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); renderer.setSize(window.innerWidth, window.innerHeight); }
    }
    requestAnimationFrame(bucle);
  }

  // En pantallas verticales (móvil) se abre el FOV vertical para no perder campo de visión horizontal
  function ajustarCamara() {
    const asp = window.innerWidth / window.innerHeight;
    camara.aspect = asp;
    camara.fov = Math.min(95, Math.max(70, 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(32)) / asp) * 180 / Math.PI));
    camara.updateProjectionMatrix();
  }
  ajustarCamara();
  window.addEventListener('resize', () => {
    ajustarCamara();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Ganchos para pruebas automáticas
  window.__estancia = {
    jugador, colisiones, choca, mover, ponerModo, renderer, escena, camara,
    lamparas: { pie: lPie.ctrl, mesa: lMesa.ctrl, techo: lTecho.ctrl, tv: mtv.tv },
    objetivo, interactuar, empezar, get fps() { return fpsMedio; }, get modo() { return modoActual; },
    get activo() { return activo; }, get frames() { return totalFrames; }
  };

  // Compilar todos los shaders antes del primer fotograma (evita tirones al empezar)
  camara.position.set(jugador.x, OJOS, jugador.z); camara.rotation.set(jugador.pitch, jugador.yaw, 0);
  renderer.compile(escena, camara);
  ultimo = performance.now();
  requestAnimationFrame(bucle);
})();
