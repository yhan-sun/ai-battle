// Run against this project's dev server and an existing isolated Chrome on port 9226.
// Only CDP input, DOM/state reads, and network diagnostics. No screenshot APIs or packages.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:9226';
const url = 'http://127.0.0.1:5176/';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const browser = await (await fetch(`${base}/json/version`)).json();
const tab = await (await fetch(`${base}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let nextId = 1;
const pending = new Map(); const errors = []; const requests = []; const results = [];
socket.addEventListener('message', message => {
  const data = JSON.parse(message.data);
  if (data.id) {
    const p = pending.get(data.id); if (!p) return;
    clearTimeout(p.timeout); pending.delete(data.id);
    if (data.error) p.reject(new Error(JSON.stringify(data.error))); else p.resolve(data.result);
  } else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text);
  else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') errors.push(data.params.args.map(a => a.description ?? a.value).join(' '));
  else if (data.method === 'Network.responseReceived') requests.push({ url: data.params.response.url, status: data.params.response.status });
});
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++; const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression, max = 5000) {
  const deadline = Date.now() + max;
  while (Date.now() < deadline) { if (await evaluate(expression)) return; await sleep(70); }
  throw new Error(`Condition timed out: ${expression}`);
}
async function click(id) {
  const point = await evaluate(`(() => { const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
const codes = { Space: [' ', 32], ArrowDown: ['ArrowDown', 40], KeyX: ['x', 88], KeyP: ['p', 80] };
async function key(code, down = true) {
  const [keyValue, number] = codes[code];
  await call('Input.dispatchKeyEvent', { type: down ? 'rawKeyDown' : 'keyUp', code, key: keyValue, windowsVirtualKeyCode: number });
}
async function press(code) { await key(code); await key(code, false); }
async function touch(id, down = true) {
  const point = await evaluate(`(() => { const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await call('Input.dispatchTouchEvent', { type: down ? 'touchStart' : 'touchEnd', touchPoints: down ? [{ ...point, id: 1, radiusX: 2, radiusY: 2 }] : [] });
}
async function state() { return evaluate('window.__AEROMAIL__.snapshot()'); }
function pass(name, evidence = {}) { results.push({ name, evidence, status: 'PASS' }); console.log(`PASS ${name} ${JSON.stringify(evidence)}`); }
async function clean(x = 4) {
  await evaluate(`(() => { const g=window.__AEROMAIL__.game; g.world.ensure(${x}); g.world.segments.forEach(s=>s.entities=[]); g.recover(${x}); for(const k in g.player.effects) g.player.effects[k]=0; g.bonusCharge=0; })()`);
}
async function place(type, y = 0, extra = {}) {
  await evaluate(`(() => { const g=window.__AEROMAIL__.game; g.world.segments[0].entities.push({id:'browser-fixture',active:true,type:${JSON.stringify(type)},x:g.player.x+1.5,y:${y},width:1.3,height:1.1,...${JSON.stringify(extra)}}); })()`);
}
try {
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Network.setCacheDisabled', { cacheDisabled: true });
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url });
  await until('!!window.__AEROMAIL__ && !!document.querySelector("canvas")'); await sleep(400);
  const graphics = await evaluate('window.__AEROMAIL__.renderer()');
  assert.equal(graphics.webgl, true); assert.equal(graphics.contextLost, false); assert.ok(graphics.triangles > 0);
  assert.equal(await evaluate('document.getElementById("menu").hidden'), false);
  pass('desktop start page and live WebGL rendering', { browser: browser.Browser, ...graphics });

  await click('start'); await until('window.__AEROMAIL__.snapshot().phase === "running"'); await clean();
  const start = await state(); await sleep(250); const advanced = await state(); assert.ok(advanced.distance > start.distance);
  pass('actual start-button input and automatic running', { distance: advanced.distance, phase: advanced.phase });
  await press('Space'); await until('window.__AEROMAIL__.snapshot().player.jumps === 1 && window.__AEROMAIL__.snapshot().player.y > .4'); const jump = await state(); assert.equal(jump.player.jumps, 1); assert.ok(jump.player.y > .4);
  await press('Space'); await until(`window.__AEROMAIL__.snapshot().player.jumps === 2 && window.__AEROMAIL__.snapshot().player.y > ${jump.player.y + .2}`); const double = await state(); assert.equal(double.player.jumps, 2); assert.ok(double.player.y > jump.player.y);
  await press('Space'); assert.equal((await state()).player.jumps, 2);
  pass('actual jump / double jump / third jump blocked', { firstY: jump.player.y, doubleY: double.player.y });
  await until('window.__AEROMAIL__.snapshot().player.grounded');
  await key('ArrowDown'); await sleep(90); assert.equal((await state()).player.crouching, true);
  await key('ArrowDown', false); await sleep(80); assert.equal((await state()).player.crouching, false);
  pass('actual held crouch and key-release recovery');
  await press('KeyX'); await sleep(100); const dash = await state(); assert.ok(dash.player.effects.dash > 2); assert.equal(dash.speed, 25); assert.ok(dash.player.charge < 10);
  pass('actual skill key activates powered flight', { speed: dash.speed, charge: dash.player.charge });
  await press('KeyP'); await until('window.__AEROMAIL__.snapshot().phase === "paused"');
  const paused = await state(); await sleep(350); assert.deepEqual(await state(), paused);
  assert.equal(await evaluate('document.getElementById("pause-screen").hidden'), false);
  await click('resume'); await until('window.__AEROMAIL__.snapshot().phase === "running"');
  pass('pause freezes simulation and resume button works');

  await clean(); await place('hurdle'); await until('window.__AEROMAIL__.snapshot().phase === "dead"');
  await until('!document.getElementById("death-screen").hidden');
  assert.match(await evaluate('document.getElementById("death-reason").textContent'), /货箱/);
  await click('revive'); await until('window.__AEROMAIL__.snapshot().phase === "running"'); const revived = await state();
  assert.equal(revived.usedRevive, true); assert.ok(revived.player.effects.shield > 0);
  pass('actual collision, death screen and revive-button input', { usedRevive: revived.usedRevive, shield: revived.player.effects.shield });
  await clean(); await place('hurdle'); await until('window.__AEROMAIL__.snapshot().phase === "ended"');
  await until('!document.getElementById("result-screen").hidden');
  const saved = await evaluate('window.__AEROMAIL__.save()'); assert.ok(saved.bestScore > 0); assert.ok(saved.runs >= 1);
  pass('second death settles and writes a local record', { bestScore: saved.bestScore, runs: saved.runs });
  await click('restart'); await until('window.__AEROMAIL__.snapshot().phase === "running"'); assert.equal((await state()).usedRevive, false);
  pass('restart button resets revival entitlement');

  await clean(); await place('portal'); await until('window.__AEROMAIL__.snapshot().mode === "warp"');
  await sleep(150); const warp = await state(); assert.equal(warp.speed, 30); assert.equal(warp.biome, 'warp'); assert.ok(warp.entities >= 300);
  assert.equal(await evaluate('document.body.dataset.mode'), 'warp');
  assert.match(await evaluate('document.getElementById("bonus-title").textContent'), /穿越/);
  pass('portal collision switches to a separate warp scene', { speed: warp.speed, entities: warp.entities, remaining: warp.remaining });
  await click('pause'); const warpPause = await state(); await sleep(250); assert.equal((await state()).remaining, warpPause.remaining);
  await click('resume'); await until('window.__AEROMAIL__.snapshot().mode === "normal"', 15000);
  const returned = await state(); assert.ok(returned.player.x < 30); assert.ok(returned.coins > 25); assert.ok(returned.player.effects.invulnerable > 0);
  pass('warp timer pauses and returns to the saved normal route after real elapsed play', { x: returned.player.x, coins: returned.coins });

  await clean(); await evaluate('window.__AEROMAIL__.game.bonusCharge = 27; window.__AEROMAIL__.game.modeCooldown = 0');
  await place('coin', 1); await until('window.__AEROMAIL__.snapshot().mode === "super"'); await sleep(120);
  assert.equal(await evaluate('document.getElementById("multiplier").textContent'), '×3');
  assert.equal(await evaluate('document.body.dataset.mode'), 'super');
  pass('coin-meter collision activates the separate super scene and ×3 HUD');
  await until('window.__AEROMAIL__.snapshot().mode === "normal"', 19000); const superReturn = await state();
  assert.ok(superReturn.player.x < 30); assert.ok(superReturn.player.effects.invulnerable > 0);
  pass('super reward expires after real elapsed play and safely returns', { x: superReturn.player.x, coins: superReturn.coins, rewards: superReturn.rewards });

  await clean(324); await sleep(150); assert.equal(await evaluate('document.body.dataset.mode'), 'cave');
  assert.match(await evaluate('document.getElementById("biome").textContent'), /地心/);
  pass('underground terrain and HUD biome transition', await evaluate('window.__AEROMAIL__.renderer()'));
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); await sleep(180);
  const mobileLayout = await evaluate(`(() => { const ids=['jump','duck','skill','pause']; return {width:innerWidth,scroll:document.documentElement.scrollWidth,controls:ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,visible:r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};})}; })()`);
  assert.equal(mobileLayout.width, mobileLayout.scroll); assert.ok(mobileLayout.controls.every(c => c.visible));
  await clean(324); await touch('jump'); await touch('jump', false); await sleep(90); assert.equal((await state()).player.jumps, 1);
  await touch('jump'); await touch('jump', false); await sleep(70); assert.equal((await state()).player.jumps, 2);
  await touch('duck'); await sleep(70); assert.equal((await state()).player.crouching, true);
  await touch('duck', false); await sleep(70); assert.equal((await state()).player.crouching, false);
  pass('390×844 emulated mobile layout and actual touch jump / double / crouch', mobileLayout);
  await call('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true }); await sleep(150);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  pass('844×390 landscape layout has no horizontal overflow');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await call('Emulation.setTouchEmulationEnabled', { enabled: false });
  const soundBefore = await evaluate('window.__AEROMAIL__.audio()');
  if (soundBefore.enabled) await click('sound');
  const sound = await evaluate('window.__AEROMAIL__.audio()'); assert.equal(sound.enabled, false); assert.equal(sound.state, 'running');
  pass('WebAudio unlocks and sound button changes its setting', sound);
  await call('Page.reload'); await until('!!window.__AEROMAIL__ && window.__AEROMAIL__.snapshot().phase === "menu"');
  assert.equal((await evaluate('window.__AEROMAIL__.save()')).bestScore, saved.bestScore);
  assert.equal((await evaluate('window.__AEROMAIL__.audio()')).enabled, false);
  pass('page reload restores best score and sound preference');

  const failures = requests.filter(r => r.status >= 400);
  assert.deepEqual(failures, []); assert.deepEqual(errors, []);
  assert.ok(requests.some(r => new URL(r.url).pathname === '/src/main.js' && r.status === 200));
  pass('no browser exceptions, console errors or failed HTTP responses', { responses: requests.length, errors: errors.length });
  await mkdir('checks', { recursive: true });
  await writeFile('checks/browser-results.json', JSON.stringify({ timestamp: new Date().toISOString(), browser: browser.Browser, results, errors, requests }, null, 2));
  console.log(`Browser checks: ${results.length} passed; no screenshots generated.`);
} catch (error) {
  console.error(error.stack);
  console.error('Page state:', await state().catch(() => null));
  console.error('Browser errors:', JSON.stringify(errors));
  process.exitCode = 1;
} finally { await call('Page.close').catch(() => {}); socket.close(); }
