/* Optional QA tool. npm install playwright; npx playwright install chromium.
   PLAYWRIGHT_MODULE may point to a separate installation. No test package is needed to open index.html. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],external=[],results={};const root=path.resolve(__dirname,'..');
const page=await browser.newPage({viewport:{width:1100,height:740}});
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://localhost:8000'))external.push(r.url());});
await page.goto('http://localhost:8000');await page.waitForFunction(()=>window.estancia);
await page.waitForTimeout(500);assert.equal(await page.locator('#error').isVisible(),false);
await page.screenshot({path:path.join(__dirname,'desktop.png')});
results.scene=await page.evaluate(()=>estancia.stats);assert.ok(results.scene.drawCalls<60);assert.ok(results.scene.objects.length>=8);
// Check the physical volume of every furniture collider and all four walls.
results.collisionQueries=await page.evaluate(()=>{const e=estancia;return {centers:e.stats.colliders.every(c=>e.blocked((c.minX+c.maxX)/2,(c.minZ+c.maxZ)/2)),walls:[[-4.9,0],[4.9,0],[0,-3.9],[0,3.9]].every(([x,z])=>e.blocked(x,z)),startFree:!e.blocked(...[e.position[0],e.position[2]])};});
assert.ok(Object.values(results.collisionQueries).every(Boolean));
await page.locator('#close-guide').click();let lamp=await page.evaluate(()=>estancia.projectLamp());
await page.mouse.click(lamp.x,lamp.y);assert.equal(await page.evaluate(()=>estancia.lampOn),false);
await page.mouse.click(lamp.x,lamp.y);assert.equal(await page.evaluate(()=>estancia.lampOn),true);results.objectClick=true;
await page.locator('#light').click();assert.equal(await page.evaluate(()=>estancia.lampOn),false);await page.locator('#light').click();
await page.setViewportSize({width:640,height:480});
const start=await page.evaluate(()=>estancia.position);
await page.keyboard.down('w');await page.waitForTimeout(1400);await page.keyboard.up('w');
const moved=await page.evaluate(()=>estancia.position);assert.ok(Math.hypot(moved[0]-start[0],moved[2]-start[2])>.2);results.keyboard=true;
// Mouse drag changes the orientation (measured by the projected lamp position).
const before=await page.evaluate(()=>estancia.projectLamp());await page.mouse.move(320,250);await page.mouse.down();await page.mouse.move(440,280,{steps:6});await page.mouse.up();const after=await page.evaluate(()=>estancia.projectLamp());assert.ok(Math.abs(before.x-after.x)>20);results.mouseLook=true;
await page.locator('#reset').click();assert.deepEqual(await page.evaluate(()=>estancia.position),start);
// Walk backwards until the wall prevents further movement, then continue pushing.
await page.keyboard.down('s');await page.waitForTimeout(4500);const wall1=await page.evaluate(()=>estancia.position);await page.waitForTimeout(800);await page.keyboard.up('s');const wall2=await page.evaluate(()=>estancia.position);assert.ok(wall2[0]<=4.76&&wall2[2]<=3.76);assert.ok(Math.hypot(wall2[0]-wall1[0],wall2[2]-wall1[2])<.05);results.wallMovement=true;
await page.locator('#reset').click();await page.keyboard.down('w');await page.waitForTimeout(8000);await page.keyboard.up('w');const stopped=await page.evaluate(()=>({p:estancia.position,blocked:estancia.blocked(estancia.position[0],estancia.position[2])}));assert.equal(stopped.blocked,false);assert.ok(stopped.p[2]>-2.1);results.furnitureMovement=stopped;
await page.locator('#reset').click();await page.setViewportSize({width:1440,height:960});await page.screenshot({path:path.join(__dirname,'exploring.png')});
// Load directly from disk with the context offline: scripts and generated textures still work.
const offline=await browser.newContext({offline:true,viewport:{width:800,height:600}});const disk=await offline.newPage();disk.on('pageerror',e=>errors.push(e.message));await disk.goto('file://'+path.join(root,'index.html'));await disk.waitForFunction(()=>window.estancia);assert.equal(await disk.evaluate(()=>estancia.lampOn),true);results.offlineFile=true;await offline.close();
// Mobile viewport with genuine touch events: tap the 3D lamp and operate the joystick.
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const touch=await mobile.newPage();touch.on('pageerror',e=>errors.push(e.message));await touch.goto('http://localhost:8000');await touch.waitForFunction(()=>window.estancia);await touch.locator('#close-guide').tap();
const mobileLamp=await touch.evaluate(()=>estancia.projectLamp());await touch.touchscreen.tap(mobileLamp.x,mobileLamp.y);assert.equal(await touch.evaluate(()=>estancia.lampOn),false);results.touchLamp=true;
await touch.screenshot({path:path.join(__dirname,'mobile.png')});const cdp=await mobile.newCDPSession(touch);const joy=await touch.locator('#joystick').boundingBox();const tx=joy.x+joy.width/2,ty=joy.y+joy.height/2;const pos0=await touch.evaluate(()=>estancia.position);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx,y:ty-30,id:1}]});await touch.waitForTimeout(1100);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const pos1=await touch.evaluate(()=>estancia.position);assert.ok(Math.hypot(pos1[0]-pos0[0],pos1[2]-pos0[2])>.15);results.joystick=true;
const look0=await touch.evaluate(()=>estancia.projectLamp());await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:220,y:480,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:285,y:500,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const look1=await touch.evaluate(()=>estancia.projectLamp());assert.ok(Math.abs(look1.x-look0.x)>10);results.touchLook=true;
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.errors=errors;results.externalRequests=external;
fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
