/* Estancia. All meshes and textures are generated locally; no asset loaders. */
'use strict';
(() => {
const $ = id => document.getElementById(id);
let renderer;
try { renderer = new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'}); }
catch (error) { $('error').hidden=false; console.error(error); return; }
renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate=false;
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12;
const scene=new THREE.Scene();scene.background=new THREE.Color('#c5d2cf');
const camera=new THREE.PerspectiveCamera(innerWidth<600?82:62,innerWidth/innerHeight,.06,65);camera.rotation.order='YXZ';
const colliders=[], lampMeshes=[], objects=[];
const V=THREE.Vector3;
let seed=35; function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function texture(type,base){const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,512,512);
 if(type==='wood'){for(let i=0;i<2600;i++){const y=random()*512;g.strokeStyle=`rgba(${random()>.5?'56,30,12':'244,223,174'},${random()*.055})`;g.lineWidth=.5+random()*2;g.beginPath();g.moveTo(0,y);g.bezierCurveTo(140,y+random()*7,350,y-random()*9,512,y+random()*6);g.stroke();}}
 else{for(let i=0;i<25000;i++){g.fillStyle=`rgba(${random()>.5?'255,250,230':'40,40,25'},${random()*.025})`;g.fillRect(random()*512,random()*512,type==='fabric'?1:2,type==='fabric'?4:2);}if(type==='fabric'){g.globalAlpha=.06;g.strokeStyle='#fff';for(let i=0;i<512;i+=3){g.beginPath();g.moveTo(i,0);g.lineTo(i,512);g.stroke();}}}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;}
function mat(color,roughness=.8,map){return new THREE.MeshStandardMaterial({color,roughness,map:map||null});}
const oak=mat('#ffffff',.72,texture('wood','#a17b50')),walnut=mat('#ffffff',.7,texture('wood','#785237'));
const plaster=mat('#ffffff',.95,texture('noise','#e6e1d4')), cream=mat('#f6f0de'),sage=mat('#ffffff',.92,texture('fabric','#7c8771'));
const linen=mat('#ffffff',.96,texture('fabric','#d5cbb3')), terra=mat('#b1694c'),dark=mat('#393c31'),brass=mat('#a48b59',.36);brass.metalness=.65;
const leaf=mat('#4b6540'), bookMats=['#b2ad89','#b9b6a2','#795447','#ddd2b6','#7c8a7f'].map(c=>mat(c));
const boxGeo=new THREE.BoxGeometry(1,1,1);
function mesh(geo,material,x,y,z,parent=scene){const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(w,h,d,m,x,y,z,p=scene){const o=mesh(boxGeo,m,x,y,z,p);o.scale.set(w,h,d);return o;}
function round(w,h,d,m,x,y,z,p=scene,r=.09){r=Math.min(r,w/3,h/3,d/3);const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const geo=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:r,bevelThickness:r,curveSegments:5});geo.translate(0,0,-d/2+r);return mesh(geo,m,x,y,z,p);}
function cyl(rt,rb,h,m,x,y,z,p=scene,n=24){return mesh(new THREE.CylinderGeometry(rt,rb,h,n),m,x,y,z,p);}
function sphere(rx,ry,rz,m,x,y,z,p=scene){const o=mesh(new THREE.SphereGeometry(1,16,12),m,x,y,z,p);o.scale.set(rx,ry,rz);return o;}
function collider(name,x,z,w,d){colliders.push({name,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});objects.push(name);}
function group(x,y,z,rot=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;scene.add(g);return g;}
// Architecture, actual opening in the west wall.
box(10.4,.16,8.4,oak,0,-.10,0);
for(let row=0;row<16;row++){for(let col=0;col<5;col++){let x=-5+col*2+(row%2)*.65;const w=Math.min(2,5-x);if(w>0)box(w-.012,.015,.49,oak,x+w/2,.001,-3.75+row*.5);}}
box(10.4,3.4,.18,plaster,0,1.7,-4.09);box(10.4,3.4,.18,plaster,0,1.7,4.09);box(.18,3.4,8.4,plaster,5.09,1.7,0);
box(.18,3.4,1.8,plaster,-5.09,1.7,-3.2);box(.18,3.4,3.2,plaster,-5.09,1.7,2.4);box(.18,.78,3.4,plaster,-5.09,.39,-.6);box(.18,.48,3.4,plaster,-5.09,3.16,-.6);
box(10,.12,.05,cream,0,.08,-3.96);box(10,.12,.05,cream,0,.08,3.96);box(.05,.12,8,cream,4.96,.08,0);box(.05,.12,8,cream,-4.96,.08,0);
box(10.4,.1,8.4,plaster,0,3.45,0);
// Window and landscape, all procedural.
const skyMat=new THREE.MeshBasicMaterial({color:'#c5d6d5'});box(.05,5,9,skyMat,-7,2,-.5).castShadow=false;
for(let i=0;i<8;i++){sphere(.08,.5+random()*.5,.9,mat(i%2?'#9ba68a':'#aab29a'),-6.8,.6,-4+i,scene);}
for(const z of [-2.3,1.1])box(.20,2.2,.08,cream,-4.98,1.89,z);
for(const y of [.8,2.96])box(.20,.09,3.5,cream,-4.98,y,-.6);
box(.15,2.12,.055,cream,-4.96,1.88,-.6);box(.15,.055,3.35,cream,-4.96,1.94,-.6);box(.40,.09,3.65,oak,-4.88,.76,-.6);
const glass=mat('#e7efec',.2);glass.transparent=true;glass.opacity=.08;box(.015,2.05,3.28,glass,-5.04,1.88,-.6).castShadow=false;
// Ceiling curtain track, softly pleated fabric at either edge of the window.
for(const z0 of [-2.47,1.23])for(let i=0;i<8;i++){const o=cyl(.065,.075,2.9,linen,-4.72,1.52,z0+i*.055);o.scale.x=.55;}
// Sofa, independently modelled cushions, arms and feet.
const sofa=group(-.6,0,-2.88);
for(const x of [-1.46,1.46])for(const z of [-.38,.38])cyl(.045,.035,.20,walnut,x,.14,z,sofa);
round(3.45,.34,1.13,sage,0,.40,0,sofa);round(3.25,.70,.24,sage,0,.95,-.46,sofa);
for(const x of [-1.6,1.6])round(.26,.63,1.16,sage,x,.70,0,sofa);
for(let i=0;i<3;i++){round(.96,.20,.86,sage,-1+i,.66,.08,sofa);const b=round(.97,.5,.20,sage,-1+i,1.04,-.28,sofa);b.rotation.x=-.12;}
for(const [x,c,a] of [[-1.12,linen,-.15],[1.07,terra,.18]]){const p=round(.48,.49,.18,c,x,1.02,-.03,sofa,.075);p.rotation.z=a;p.rotation.x=-.15;}
// A folded throw cascading over the arm.
round(.43,.06,.9,linen,-1.48,.99,.1,sofa,.02);round(.05,.5,.55,linen,-1.76,.75,.22,sofa,.02);
collider('Sofá',-.6,-2.88,3.78,1.3);
// Hand-woven rug with geometric edging.
const rugTex=texture('fabric','#d4c6a8');const rugMat=mat('#ffffff',1,rugTex);
round(4.5,.025,3.15,rugMat,-.45,.025,-.05,scene,.012);
for(const z of [-1.45,1.35]){box(4.27,.005,.025,terra,-.45,.044,z);box(4.27,.005,.012,dark,-.45,.044,z+.055);}
for(let i=0;i<55;i++)for(const z of [-1.68,1.58])box(.018,.008,.1,linen,-2.62+i*.08,.024,z);
// Coffee table: rounded walnut slab and two wide pedestal legs.
const table=group(-.35,0,-.05);round(2.1,.13,1.04,walnut,0,.52,0,table,.065);
for(const x of [-.67,.67])round(.16,.43,.7,walnut,x,.26,0,table,.035);
collider('Mesa de centro',-.35,-.05,2.18,1.12);
function book(x,y,z,w,d,h,m,p=scene){box(w,h,d,m,x,y,z,p);box(w*.91,h*.64,d+.006,mat('#dbd3ba'),x,y,z,p);box(w,h*.12,d+.01,m,x,y+h*.41,z,p);}
book(-.77,.622,-.12,.51,.36,.07,bookMats[0]);book(-.74,.683,-.13,.43,.32,.05,bookMats[3]);
const ceramic=mat('#e9debd',.5);cyl(.115,.085,.14,ceramic,.12,.66,.08);cyl(.095,.095,.006,mat('#493224'),.12,.734,.08);const handle=mesh(new THREE.TorusGeometry(.06,.017,8,20),ceramic,.24,.665,.08);handle.rotation.y=Math.PI/2;
cyl(.17,.17,.015,ceramic,.12,.59,.08);
// Lounge chair with a wooden frame.
const chair=group(-3.25,0,.45,-.32);
for(const x of [-.46,.46])for(const z of [-.4,.38]){const leg=box(.075,.52,.075,oak,x,.28,z,chair);leg.rotation.z=x*.14;}
round(.94,.19,.86,linen,0,.55,.02,chair);const cb=round(.95,.68,.20,linen,0,.96,-.37,chair);cb.rotation.x=-.15;
for(const x of [-.55,.55]){round(.105,.08,1.02,oak,x,.8,0,chair,.025);box(.06,.36,.06,oak,x,.61,.35,chair);}
collider('Butaca',-3.25,.45,1.52,1.48);
// Side table and terracotta vase.
cyl(.40,.40,.07,oak,-2.94,.57,-1.37);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;box(.055,.54,.055,oak,-2.94+Math.cos(a)*.28,.27,-1.37+Math.sin(a)*.28);}
cyl(.10,.14,.27,terra,-2.94,.735,-1.37);cyl(.065,.1,.08,terra,-2.94,.91,-1.37);collider('Mesa auxiliar',-2.94,-1.37,.82,.82);
// Reading light, physically present diffuser, emissive bulb and switchable warm point light.
const lamp=group(1.73,0,-2.65);cyl(.29,.32,.055,dark,0,.045,0,lamp);cyl(.023,.023,1.92,brass,0,1,0,lamp);
const shadeMaterial=mat('#efe2bd',.93);shadeMaterial.side=THREE.DoubleSide;shadeMaterial.emissive=new THREE.Color('#e7b75e');shadeMaterial.emissiveIntensity=.28;
const shade=mesh(new THREE.CylinderGeometry(.31,.48,.53,40,1,true),shadeMaterial,0,1.94,0,lamp);const bulb=mat('#fff1c8');bulb.emissive=new THREE.Color('#ffda8f');bulb.emissiveIntensity=1.5;sphere(.12,.12,.12,bulb,0,1.85,0,lamp);
const lampLight=new THREE.PointLight('#ffd095',22,7,2);lampLight.position.set(1.73,1.75,-2.65);scene.add(lampLight);
lamp.traverse(o=>{if(o.isMesh)lampMeshes.push(o);});collider('Lámpara',1.73,-2.65,.72,.72);
// Low sideboard on the east wall, fluted cabinet fronts.
const cabinet=group(4.48,0,-.65,Math.PI/2);
box(2.5,.68,.67,oak,0,.56,0,cabinet);box(2.62,.07,.77,walnut,0,.94,0,cabinet);
for(const x of [-1.05,1.05])for(const z of [-.22,.22])cyl(.035,.025,.25,walnut,x,.14,z,cabinet);
for(let i=0;i<35;i++)box(.027,.57,.035,walnut,-1.19+i*.07,.57,.35,cabinet);
for(const x of [-.60,.60])cyl(.025,.025,.07,brass,x,.62,.4,cabinet).rotation.x=Math.PI/2;
collider('Aparador',4.48,-.65,.82,2.66);
// Turntable and two speakers on the cabinet.
round(.72,.09,.48,dark,-.37,1.015,0,cabinet,.02);cyl(.19,.19,.018,mat('#20261f'),-.37,1.07,0,cabinet);cyl(.058,.058,.02,terra,-.37,1.083,0,cabinet);box(.28,.025,.025,brass,-.16,1.10,.04,cabinet).rotation.y=.5;
for(const x of [-1,1]){box(.25,.34,.25,walnut,x,1.15,0,cabinet);const sp=cyl(.075,.075,.015,dark,x,1.13,.133,cabinet);sp.rotation.x=Math.PI/2;}
// Bookcase and curated books, against the back wall.
const shelf=group(3.48,0,-3.63);for(const x of [-.62,.62])box(.065,2.35,.45,oak,x,1.20,0,shelf);
for(const y of [.16,.72,1.28,1.84,2.40])box(1.31,.055,.47,oak,0,y,0,shelf);
for(let j=0;j<3;j++)for(let i=0;i<6;i++){const h=.26+random()*.17;box(.07+random()*.03,h,.26,bookMats[(i+j)%5],-.45+i*.115,.75+j*.56+h/2,0,shelf);}
cyl(.12,.16,.29,ceramic,.32,.33,0,shelf);collider('Estantería',3.48,-3.63,1.39,.58);
// Plant pot and individually built stems/leaves.
function plant(x,z,scale=1){const g=group(x,0,z);g.scale.setScalar(scale);cyl(.28,.22,.46,terra,0,.24,0,g);cyl(.245,.245,.012,mat('#534532'),0,.47,0,g);for(let i=0;i<10;i++){const a=i*2.399,h=.65+random()*.85,r=.16+random()*.33;const stem=cyl(.012,.016,h-.4,leaf,Math.cos(a)*r*.45,(h+.4)/2,Math.sin(a)*r*.45,g,7);stem.rotation.z=Math.sin(a)*.28;const l=sphere(.13,.37,.045,leaf,Math.cos(a)*r,h,Math.sin(a)*r,g);l.rotation.set(.45*Math.cos(a),a,.4*Math.sin(a));}return g;}
plant(-4.12,-3.14,1.1);collider('Planta',-4.12,-3.14,.85,.85);plant(4.2,2.7,.85);collider('Planta junto a la puerta',4.2,2.7,.70,.70);
// Original geometric artwork painted into canvas textures.
function artwork(){const c=document.createElement('canvas');c.width=512;c.height=640;const g=c.getContext('2d');g.fillStyle='#e8ddc1';g.fillRect(0,0,512,640);g.fillStyle='#a45f43';g.beginPath();g.arc(268,226,128,Math.PI,0);g.lineTo(396,542);g.lineTo(140,542);g.fill();g.fillStyle='#63715a';g.fillRect(56,332,173,258);g.fillStyle='#d0b786';g.beginPath();g.arc(390,448,100,0,Math.PI*2);g.fill();g.strokeStyle='#ede4cb';g.lineWidth=3;for(let i=0;i<8;i++){g.beginPath();g.arc(268,226,40+i*10,Math.PI,0);g.stroke();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:t});}
box(1.52,1.79,.06,walnut,-.60,2.28,-3.92);box(1.41,1.68,.035,cream,-.60,2.28,-3.875);mesh(new THREE.PlaneGeometry(1.29,1.56),artwork(),-.6,2.28,-3.85);
// Entry door with panels and brass handle, on the south wall.
box(1.34,2.63,.07,oak,2.7,1.32,3.94);for(const x of [2.01,3.39])box(.065,2.7,.12,cream,x,1.35,3.90);box(1.45,.075,.12,cream,2.7,2.72,3.90);
for(const y of [.72,1.85])box(1.06,.9,.025,walnut,2.7,y,3.89);box(.16,.04,.07,brass,2.21,1.12,3.83);
// Daylight travels through the real window opening; static shadows render only once.
scene.add(new THREE.HemisphereLight('#e2e9ef','#b9a383',1.5));scene.add(new THREE.AmbientLight('#e9d8b3',.3));
const sun=new THREE.DirectionalLight('#ffe5b8',3.2);sun.position.set(-8,4.3,-3.4);sun.target.position.set(.8,0,.2);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:7,bottom:-7,near:.5,far:25});sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;
const windowFill=new THREE.PointLight('#e2efff',12,12,2);windowFill.position.set(-4.5,2,-.6);scene.add(windowFill);
// Batch static geometry by material. Keeps the room at a few dozen draw calls.
scene.updateMatrixWorld(true);
const batches=new Map();
scene.traverse(o=>{if(!o.isMesh||lampMeshes.includes(o)||o.material.transparent)return;const key=o.material.id+':'+o.castShadow; if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);});
for(const meshes of batches.values()){
 if(meshes.length<2)continue;
 const geos=meshes.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);return g;});
 const merged=new THREE.BufferGeometry();
 for(const name of ['position','normal','uv']){const size=geos[0].attributes[name].itemSize;const data=new Float32Array(geos.reduce((n,g)=>n+g.attributes[name].array.length,0));let offset=0;for(const g of geos){data.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}merged.setAttribute(name,new THREE.BufferAttribute(data,size));}
 const combined=new THREE.Mesh(merged,meshes[0].material);combined.castShadow=meshes[0].castShadow;combined.receiveShadow=true;scene.add(combined);
 for(const o of meshes)o.removeFromParent();for(const g of geos)g.dispose();
}
renderer.shadowMap.needsUpdate=true;
// Navigation. Player is a horizontal circle; conservative furniture footprints prevent clipping.
const radius=.24,eye=1.64, keys=new Set();let yaw=0,pitch=0,active=false,lampOn=true,targeted=false;let dragging=null,joystick={x:0,y:0},joyId=null,toastTimer;
function reset(){camera.position.set(3.55,eye,3.0);const target=new V(innerWidth<600?.45:-.65,1.12,-1.2);camera.lookAt(target);yaw=camera.rotation.y;pitch=camera.rotation.x;keys.clear();joystick.x=joystick.y=0;updateMap();}
function blocked(x,z){if(x<-5+radius||x>5-radius||z<-4+radius||z>4-radius)return true;return colliders.some(c=>{const nx=Math.max(c.minX,Math.min(x,c.maxX)),nz=Math.max(c.minZ,Math.min(z,c.maxZ));return (x-nx)**2+(z-nz)**2<radius**2;});}
function move(dx,dz){const steps=Math.ceil(Math.hypot(dx,dz)/.07)||1;for(let i=0;i<steps;i++){const x=camera.position.x+dx/steps;if(!blocked(x,camera.position.z))camera.position.x=x;const z=camera.position.z+dz/steps;if(!blocked(camera.position.x,z))camera.position.z=z;}}
function look(dx,dy){yaw-=dx*.0025;pitch=Math.max(-1.22,Math.min(1.22,pitch-dy*.0025));camera.rotation.set(pitch,yaw,0);}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
function start(lock=false){active=true;document.body.classList.add('exploring');$('guide').classList.add('hidden');if(lock&&!matchMedia('(pointer:coarse)').matches){try{const request=$('world').requestPointerLock?.();if(request?.catch)request.catch(()=>toast('Arrastra para mirar · WASD para caminar'));}catch{toast('Arrastra para mirar · WASD para caminar');}}}
function toggleLamp(){lampOn=!lampOn;lampLight.intensity=lampOn?22:0;shadeMaterial.emissiveIntensity=lampOn?.28:0;bulb.emissiveIntensity=lampOn?1.5:0;$('light').setAttribute('aria-pressed',String(lampOn));toast(lampOn?'Lámpara encendida · luz cálida':'Lámpara apagada · solo luz de tarde');}
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
function hitLamp(x=innerWidth/2,y=innerHeight/2){pointer.set(x/innerWidth*2-1,-y/innerHeight*2+1);ray.setFromCamera(pointer,camera);const candidate=ray.intersectObjects(lampMeshes,false);if(!candidate.length||candidate[0].distance>7)return false;const hits=ray.intersectObjects(scene.children,true);return !!(hits.length&&lampMeshes.includes(hits[0].object));}
$('enter').addEventListener('click',()=>{start(true);toast('WASD o flechas para caminar · Esc libera el ratón');});
$('light').addEventListener('click',toggleLamp);$('reset').addEventListener('click',()=>{reset();toast('De vuelta al punto de entrada');});
$('help').addEventListener('click',()=>{$('guide').classList.toggle('hidden');$('guide').classList.toggle('mobile-open');});$('close-guide').addEventListener('click',()=>{$('guide').classList.add('hidden');$('guide').classList.remove('mobile-open');});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Pantalla completa no disponible en este navegador');}catch{toast('Pantalla completa no disponible');}});
window.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(e.code)){e.preventDefault();keys.add(e.code);if(!active)start();}if(e.code==='KeyE'&&!e.repeat&&hitLamp())toggleLamp();if(e.code==='Escape'){keys.clear();$('guide').classList.add('hidden');}});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();joystick.x=joystick.y=0;joyId=null;$('stick').style.transform='';dragging=null;});document.addEventListener('visibilitychange',()=>{if(document.hidden)keys.clear();});
const canvas=$('world');canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(document.pointerLockElement===canvas){if(hitLamp())toggleLamp();return;}dragging={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==dragging.id)return;const dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;if(Math.hypot(e.clientX-dragging.sx,e.clientY-dragging.sy)>5){dragging.moved=true;if(!active)start();}if(dragging.moved)look(dx,dy);dragging.x=e.clientX;dragging.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(!dragging||e.pointerId!==dragging.id)return;if(!dragging.moved&&hitLamp(e.clientX,e.clientY))toggleLamp();dragging=null;});canvas.addEventListener('pointercancel',()=>dragging=null);
window.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas)look(e.movementX,e.movementY);});document.addEventListener('pointerlockerror',()=>toast('Arrastra para mirar · WASD para caminar'));
const joy=$('joystick');function joystickMove(e){const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy),scale=Math.min(1,32/Math.max(l,.001));joystick.x=dx*scale/32;joystick.y=dy*scale/32;$('stick').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
joy.addEventListener('pointerdown',e=>{if(joyId!==null)return;joyId=e.pointerId;joy.setPointerCapture(joyId);start();joystickMove(e);});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joystickMove(e);});function endJoystick(e){if(e.pointerId===joyId){joyId=null;joystick.x=joystick.y=0;$('stick').style.transform='';}}joy.addEventListener('pointerup',endJoystick);joy.addEventListener('pointercancel',endJoystick);
$('touch-action').addEventListener('click',()=>{if(hitLamp())toggleLamp();else toast('Mira hacia la lámpara o tócala directamente');});
function updateMap(){const x=9+(camera.position.x+5)/10*132,y=9+(camera.position.z+4)/8*102;$('map-player').setAttribute('cx',x);$('map-player').setAttribute('cy',y);$('map-heading').setAttribute('transform',`translate(${x},${y}) rotate(${-yaw*180/Math.PI})`);}
reset();let previous=performance.now(),frames=0,elapsed=0,fps=0,lastTarget=0;
function frame(now){requestAnimationFrame(frame);const rawDt=(now-previous)/1000;const dt=Math.min(rawDt,.045);previous=now;if(document.hidden)return;let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y;let side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x;const len=Math.hypot(forward,side);if(len>1){forward/=len;side/=len;}if(active){const speed=2.25*dt;move((-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed,(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed);}updateMap();if(now-lastTarget>100){lastTarget=now;targeted=active&&hitLamp();$('target-label').style.display=targeted?'block':'none';$('target-label').innerHTML=(lampOn?'Apagar lámpara':'Encender lámpara')+' <kbd>E</kbd>';}
 renderer.render(scene,camera);frames++;elapsed+=rawDt;if(elapsed>1){fps=frames/elapsed;frames=0;elapsed=0;}}
requestAnimationFrame(frame);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<600?82:62;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('error').hidden=false;});
// Read-only scene diagnostics plus pure collision query, for repeatable verification.
window.estancia={get position(){return camera.position.toArray();},get lampOn(){return lampOn;},get stats(){return {fps:Math.round(fps),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,objects:objects.slice(),colliders:colliders.map(c=>({...c}))};},blocked,projectLamp(){const p=new V(1.73,1.94,-2.65).project(camera);return {x:(p.x+1)/2*innerWidth,y:(1-p.y)/2*innerHeight};}};
})();
