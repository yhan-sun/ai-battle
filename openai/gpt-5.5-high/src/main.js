import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const ui = {
  start: $('startScreen'), pause: $('pauseScreen'), revive: $('reviveScreen'), result: $('resultScreen'),
  score: $('scoreText'), dist: $('distanceText'), coins: $('coinText'), speed: $('speedText'), mode: $('modeBadge'),
  power: $('powerBadge'), shield: $('shieldBadge'), toast: $('toast'), finalScore: $('finalScore'),
  finalDistance: $('finalDistance'), finalBest: $('finalBest')
};
const lanes = [-2.2, 0, 2.2];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class AudioFx {
  constructor() { this.ctx = null; this.muted = false; }
  beep(freq = 440, dur = 0.08, type = 'sine', gain = 0.045) {
    if (this.muted) return;
    this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, this.ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(amp).connect(this.ctx.destination); osc.start(); osc.stop(this.ctx.currentTime + dur);
  }
}

class Game {
  constructor() {
    this.canvas = $('gameCanvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 130);
    this.camera.position.set(0, 5.8, 9.2);
    this.camera.lookAt(0, 1.4, -12);
    this.clock = new THREE.Clock();
    this.fx = new AudioFx();
    this.keys = new Set();
    this.entities = [];
    this.particles = [];
    this.floor = [];
    this.nextZ = -16;
    this.best = Number(localStorage.getItem('star-run-best') || 0);
    this.seedScene(); this.bind(); this.resize(); this.reset(); this.loop();
  }
  mat(color, emissive = 0x000000, roughness = 0.55) { return new THREE.MeshStandardMaterial({ color, emissive, roughness, metalness: 0.08 }); }
  box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
  seedScene() {
    this.scene.fog = new THREE.Fog(0x09111e, 20, 96);
    this.scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x18202e, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(5, 9, 4); this.scene.add(sun);
    this.materials = {
      hero: this.mat(0x19e2b0), dark: this.mat(0x101724), gold: this.mat(0xffd35c, 0x2b1800),
      road: this.mat(0x1b2639), road2: this.mat(0x243550), danger: this.mat(0xff496a, 0x2b0010),
      mob: this.mat(0x8b75ff, 0x18004a), shield: this.mat(0x57d6ff, 0x082642), portal: this.mat(0x7bffcf, 0x115c44)
    };
    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 360; i++) pts.push(rnd(-35, 35), rnd(6, 30), rnd(-90, 14));
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xd7f4ff, size: 0.06 }));
    this.scene.add(stars); this.stars = stars;

    this.player = new THREE.Group();
    const body = this.box(0.72, 1.15, 0.45, this.materials.hero); body.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 18), this.materials.hero); head.position.y = 1.78;
    const mount = this.box(1.15, 0.35, 0.75, this.mat(0x183df0, 0x05092b)); mount.position.y = 0.45;
    const pet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), this.mat(0xff83ca, 0x3a0824)); pet.position.set(-0.95, 1.55, 0.45);
    this.player.add(mount, body, head, pet); this.pet = pet; this.scene.add(this.player);
  }
  bind() {
    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => { this.keys.add(e.code); this.onKey(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    $('startButton').onclick = () => this.start(); $('resumeButton').onclick = () => this.pause(false);
    $('restartButton').onclick = () => this.start(); $('reviveButton').onclick = () => this.revive(); $('finishButton').onclick = () => this.finish();
    $('muteButton').onclick = () => { this.fx.muted = !this.fx.muted; $('muteButton').textContent = `音效：${this.fx.muted ? '关' : '开'}`; };
    document.querySelectorAll('.mobile-controls button').forEach((b) => b.onclick = () => this.action(b.dataset.action));
    this.canvas.addEventListener('pointerdown', (e) => { if (e.clientX < innerWidth * 0.34) this.lane(-1); else if (e.clientX > innerWidth * 0.66) this.lane(1); });
  }
  resize() { this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
  reset() {
    for (const e of this.entities) this.scene.remove(e.mesh); for (const f of this.floor) this.scene.remove(f); for (const p of this.particles) this.scene.remove(p.mesh);
    Object.assign(this, { running: false, dead: false, paused: false, score: 0, distance: 0, coins: 0, combo: 0, energy: 35, reviveUsed: false, mode: 'normal', modeTimer: 0, speed: 11, targetLane: 1, y: 0, vy: 0, jumps: 0, slide: 0, shield: 0, magnet: 0, dash: 0, spawnMark: 0, shake: 0, entities: [], particles: [], floor: [], nextZ: -16 });
    this.player.position.set(0, 0, 0); this.makeFloor(); this.updateHud();
  }
  start() { this.reset(); this.running = true; this.show(); this.toast('冲！'); this.fx.beep(520, 0.09, 'triangle'); }
  show(screen = null) { [ui.start, ui.pause, ui.revive, ui.result].forEach(s => s.classList.remove('screen--active')); if (screen) screen.classList.add('screen--active'); }
  onKey(code) {
    if (code === 'KeyP' || code === 'Escape') return this.pause(!this.paused);
    if (code === 'KeyR') return this.enterMode('super'); if (code === 'KeyT') return this.enterMode('crossing');
    if (!this.running || this.paused) return;
    if (['Space','KeyW','ArrowUp'].includes(code)) this.action('jump');
    if (['KeyS','ArrowDown'].includes(code)) this.action('slide');
    if (['KeyA','ArrowLeft'].includes(code)) this.lane(-1); if (['KeyD','ArrowRight'].includes(code)) this.lane(1);
    if (code === 'KeyE') this.action('skill');
  }
  action(name) {
    if (name === 'jump' && this.jumps < 2) { this.vy = this.jumps ? 9.5 : 11.4; this.jumps++; this.slide = 0; this.fx.beep(this.jumps > 1 ? 760 : 560); this.burst(this.player.position, 0x57d6ff, 8); }
    if (name === 'slide' && this.y <= 0.05) { this.slide = 0.68; this.fx.beep(220, 0.05, 'sawtooth'); }
    if (name === 'skill' && this.energy >= 100) { this.energy = 0; this.dash = 3.2; this.magnet = 5.2; this.shield = Math.max(this.shield, 3.2); this.toast('技能爆发：冲刺 + 磁铁 + 护盾'); this.fx.beep(980, 0.13, 'square'); }
  }
  lane(delta) { this.targetLane = clamp(this.targetLane + delta, 0, 2); }
  pause(v) { if (!this.running || this.dead) return; this.paused = v; this.show(v ? ui.pause : null); }
  makeFloor() { while (this.nextZ > -130) { this.addTile(this.nextZ); this.nextZ -= 6; } }
  addTile(z) {
    const g = this.box(7.4, 0.22, 5.7, this.mode === 'super' ? this.materials.gold : this.mode === 'crossing' ? this.materials.road2 : this.materials.road);
    g.position.set(0, -0.16, z); this.scene.add(g); this.floor.push(g);
    for (const x of lanes) { const line = this.box(0.045, 0.03, 5.3, this.mat(0x5e789e)); line.position.set(x, 0.02, z); this.scene.add(line); this.floor.push(line); }
  }
  spawn() {
    const z = -72, lane = Math.floor(Math.random() * 3), x = lanes[lane], r = Math.random();
    if (this.mode === 'super') return this.coinArc(z, lane, 1.7, 9, true);
    if (this.mode === 'crossing') { this.coinLine(z, lane, 7, true); if (Math.random() < 0.45) this.addEntity('bar', x, z - 3); return; }
    if (r < 0.26) this.coinLine(z, lane, 6, false);
    else if (r < 0.43) this.addEntity('block', x, z);
    else if (r < 0.58) this.addEntity('bar', x, z);
    else if (r < 0.72) this.addEntity('monster', x, z);
    else if (r < 0.82) this.addEntity(pick(['magnet','shield']), x, z);
    else if (r < 0.91) this.addEntity('superPortal', x, z);
    else this.addEntity('crossPortal', x, z);
  }
  coinLine(z, lane, n, rich) { for (let i = 0; i < n; i++) this.addEntity('coin', lanes[lane], z - i * 1.15, rich ? 1.45 : 1.15); }
  coinArc(z, lane, h, n) { for (let i = 0; i < n; i++) this.addEntity('coin', lanes[(lane + i) % 3], z - i * 0.9, h + Math.sin(i / n * Math.PI) * 1.1); }
  addEntity(type, x, z, y = 0.7) {
    let mesh, radius = 0.58;
    if (type === 'coin') { mesh = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.07, 10, 20), this.materials.gold); mesh.rotation.x = Math.PI / 2; radius = 0.42; }
    else if (type === 'monster') { mesh = new THREE.Group(); const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), this.materials.mob); m.scale.y = 0.75; mesh.add(m); y = 0.48; radius = 0.66; }
    else if (type === 'bar') { mesh = this.box(1.35, 0.28, 0.34, this.materials.danger); y = 1.52; radius = 0.72; }
    else if (type === 'block') { mesh = this.box(1.0, 1.05, 0.58, this.materials.danger); y = 0.52; radius = 0.7; }
    else if (type === 'magnet') { mesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 12, 22, Math.PI * 1.4), this.mat(0xff5570, 0x2b0010)); y = 1; }
    else if (type === 'shield') { mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), this.materials.shield); y = 1; }
    else { mesh = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 16, 42), this.materials.portal); mesh.rotation.y = Math.PI / 2; y = 1.15; radius = 0.95; }
    mesh.position.set(x, y, z); this.scene.add(mesh); this.entities.push({ type, mesh, radius, hit: false });
  }
  enterMode(mode) {
    this.mode = mode; this.modeTimer = mode === 'super' ? 16 : 12; this.scene.fog.color.set(mode === 'super' ? 0x332308 : 0x06172a);
    this.toast(mode === 'super' ? '超级奖励！金币倍率开启' : '穿越奖励！高速星门启动');
    this.fx.beep(mode === 'super' ? 1180 : 860, 0.18, 'triangle', 0.07); this.clearThreats();
  }
  clearThreats() { this.entities = this.entities.filter((e) => { if (['block','bar','monster'].includes(e.type)) { this.scene.remove(e.mesh); return false; } return true; }); }
  endMode() { this.mode = 'normal'; this.modeTimer = 0; this.scene.fog.color.set(0x09111e); this.toast('回到主赛道'); }
  update(dt) {
    if (!this.running || this.paused || this.dead) return;
    this.speed += dt * 0.22; const runSpeed = this.speed * (this.dash > 0 ? 1.58 : this.mode === 'crossing' ? 1.42 : 1);
    this.distance += runSpeed * dt; this.score += runSpeed * dt * (this.mode === 'super' ? 6 : this.mode === 'crossing' ? 4 : 2);
    this.spawnMark += runSpeed * dt; while (this.spawnMark > 7.2) { this.spawnMark -= 7.2; this.spawn(); }
    this.modeTimer -= dt; if (this.mode !== 'normal' && this.modeTimer <= 0) this.endMode();
    this.shield = Math.max(0, this.shield - dt); this.magnet = Math.max(0, this.magnet - dt); this.dash = Math.max(0, this.dash - dt); this.slide = Math.max(0, this.slide - dt);
    this.vy -= 27 * dt; this.y = Math.max(0, this.y + this.vy * dt); if (this.y === 0 && this.vy <= 0) { this.vy = 0; this.jumps = 0; }
    const targetX = lanes[this.targetLane]; this.player.position.x += (targetX - this.player.position.x) * Math.min(1, dt * 12); this.player.position.y = this.y;
    this.player.scale.y += ((this.slide > 0 ? 0.58 : 1) - this.player.scale.y) * Math.min(1, dt * 14);
    this.player.rotation.z = (targetX - this.player.position.x) * -0.14; this.player.rotation.x = Math.sin(performance.now() * 0.012) * 0.035;
    this.pet.position.y = 1.55 + Math.sin(performance.now() * 0.006) * 0.16;
    for (const f of this.floor) f.position.z += runSpeed * dt;
    this.floor = this.floor.filter((f) => { if (f.position.z > 12) { this.scene.remove(f); return false; } return true; }); while (this.nextZ + this.distance * 0 > -130) { this.addTile(this.nextZ); this.nextZ -= 6; break; }
    if (this.floor.length < 54) { const last = Math.min(...this.floor.map(f => f.position.z)); this.nextZ = last - 6; this.addTile(this.nextZ); }
    this.updateEntities(dt, runSpeed); this.updateParticles(dt); this.updateCamera(dt); this.updateHud();
  }
  updateEntities(dt, runSpeed) {
    const p = new THREE.Vector3(this.player.position.x, this.y + (this.slide > 0 ? 0.62 : 1.05), 0);
    for (const e of this.entities) {
      e.mesh.position.z += runSpeed * dt; e.mesh.rotation.y += dt * (e.type === 'coin' ? 7 : 2);
      if (this.magnet > 0 && e.type === 'coin') { const d = e.mesh.position.distanceTo(p); if (d < 6.5) e.mesh.position.lerp(p, dt * 4.8); }
      if (!e.hit && e.mesh.position.z > -0.65 && e.mesh.position.z < 1.0 && Math.abs(e.mesh.position.x - p.x) < e.radius + 0.2 && Math.abs(e.mesh.position.y - p.y) < e.radius + 0.75) this.hit(e);
    }
    this.entities = this.entities.filter((e) => { if (e.hit || e.mesh.position.z > 12) { this.scene.remove(e.mesh); return false; } return true; });
  }
  hit(e) {
    e.hit = true; const type = e.type;
    if (type === 'coin') { this.coins++; this.combo++; this.energy = clamp(this.energy + 1.6, 0, 100); this.score += (this.mode === 'super' ? 120 : 70) + this.combo * 3; this.fx.beep(900 + this.combo * 5, 0.035); this.burst(e.mesh.position, 0xffd35c, 8); return; }
    if (type === 'magnet') { this.magnet = 7; this.energy = clamp(this.energy + 10, 0, 100); this.toast('磁铁吸附'); this.fx.beep(760); return; }
    if (type === 'shield') { this.shield = 8; this.toast('护盾展开'); this.fx.beep(640); return; }
    if (type === 'superPortal') return this.enterMode('super'); if (type === 'crossPortal') return this.enterMode('crossing');
    if (type === 'monster' && this.vy < 0 && this.y > 0.3) { this.vy = 9; this.score += 650; this.energy = clamp(this.energy + 18, 0, 100); this.toast('踩踏怪物 +650'); this.burst(e.mesh.position, 0x8b75ff, 16); return; }
    if (this.dash > 0 || this.shield > 0) { this.score += 180; this.shield = Math.max(0, this.shield - 1.2); this.shake = 0.25; this.burst(e.mesh.position, 0xff5570, 18); this.fx.beep(160, 0.05, 'sawtooth'); return; }
    this.crash();
  }
  crash() { this.dead = true; this.running = false; this.combo = 0; this.shake = 0.6; this.fx.beep(110, 0.25, 'sawtooth'); this.energy >= 55 && !this.reviveUsed ? this.show(ui.revive) : this.finish(); }
  revive() { this.dead = false; this.running = true; this.reviveUsed = true; this.energy = 0; this.shield = 2.5; this.dash = 1.2; this.clearThreats(); this.show(); this.toast('复活成功'); }
  finish() { this.dead = false; this.running = false; this.best = Math.max(this.best, Math.floor(this.score)); localStorage.setItem('star-run-best', String(this.best)); ui.finalScore.textContent = Math.floor(this.score); ui.finalDistance.textContent = `${Math.floor(this.distance)}m`; ui.finalBest.textContent = this.best; this.show(ui.result); }
  burst(pos, color, n) { for (let i = 0; i < n; i++) { const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), this.mat(color, color)); mesh.position.copy(pos); this.scene.add(mesh); this.particles.push({ mesh, life: rnd(0.35, 0.8), v: new THREE.Vector3(rnd(-2,2), rnd(1,5), rnd(-1,3)) }); } }
  updateParticles(dt) { this.particles = this.particles.filter((p) => { p.life -= dt; p.v.y -= 7 * dt; p.mesh.position.addScaledVector(p.v, dt); p.mesh.scale.multiplyScalar(0.985); if (p.life <= 0) { this.scene.remove(p.mesh); return false; } return true; }); }
  updateCamera(dt) { this.shake = Math.max(0, this.shake - dt); const s = this.shake ? rnd(-this.shake, this.shake) : 0; this.camera.position.x += (this.player.position.x * 0.28 + s - this.camera.position.x) * dt * 3; this.camera.position.y += (5.8 + this.y * 0.22 + Math.abs(s) - this.camera.position.y) * dt * 3; this.stars.position.z = (this.distance * 0.16) % 20; }
  updateHud() {
    ui.score.textContent = Math.floor(this.score); ui.dist.textContent = `${Math.floor(this.distance)}m`; ui.coins.textContent = this.coins; ui.speed.textContent = `${(this.speed / 10).toFixed(1)}x`;
    ui.mode.textContent = this.mode === 'super' ? `超级奖励 ${Math.ceil(this.modeTimer)}s` : this.mode === 'crossing' ? `穿越奖励 ${Math.ceil(this.modeTimer)}s` : '主赛道';
    ui.mode.className = this.mode === 'super' ? 'mode-super' : this.mode === 'crossing' ? 'mode-crossing' : '';
    ui.power.textContent = this.energy >= 100 ? '技能就绪' : `能量 ${Math.floor(this.energy)}%`; ui.power.className = this.energy >= 100 ? 'ready' : '';
    ui.shield.textContent = this.shield > 0 ? `护盾 ${this.shield.toFixed(1)}s` : this.magnet > 0 ? `磁铁 ${this.magnet.toFixed(1)}s` : '护盾 0s'; ui.shield.className = this.shield > 0 || this.magnet > 0 ? 'active' : '';
  }
  toast(text) { ui.toast.textContent = text; ui.toast.classList.add('show'); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1300); }
  loop() { const dt = Math.min(0.033, this.clock.getDelta()); this.update(dt); this.renderer.render(this.scene, this.camera); requestAnimationFrame(() => this.loop()); }
}

new Game();
