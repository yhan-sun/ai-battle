import * as THREE from './vendor/three.module.min.js';
import { BonusMode, GameState, RunnerModel, SeededRandom, createBonusPattern, createSegmentPlan } from './core.js';

const PLAYER_X = -5.4;
const STORAGE_KEY = 'lumen-tide-best-v1';
const smokeMode = new URLSearchParams(location.search).has('smoke');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (selector) => document.querySelector(selector);
const ui = {
  canvas: $('#game-canvas'), hud: $('#hud'), distance: $('#distance'), score: $('#score'), coins: $('#coins'),
  combo: $('#combo-label'), comboFill: $('#combo-fill'), skillFill: $('#skill-fill'), skillText: $('#skill-text'),
  buffs: $('#buffs'), mode: $('#mode-pill'), start: $('#start-screen'), pause: $('#pause-screen'),
  revive: $('#revive-screen'), result: $('#result-screen'), best: $('#best-score'), reviveTime: $('#revive-countdown'),
  resultScore: $('#result-score'), resultDistance: $('#result-distance'), resultCoins: $('#result-coins'),
  resultCombo: $('#result-combo'), record: $('#new-record'), announcement: $('#announcement'), toast: $('#toast'),
  flash: $('#flash'), mobile: $('#mobile-controls'), smoke: $('#smoke-result'),
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const fmt = (v) => Math.floor(v).toLocaleString('zh-CN');
const THEMES = {
  tide: { name: '潮面航道', sky: 0x071923, fog: 0x0b2630, floor: 0x123f43, edge: 0x43e9cb, accent: 0x68ffe0, secondary: 0x35b7d2 },
  vault: { name: '深海遗迹', sky: 0x050819, fog: 0x090e2a, floor: 0x171c3f, edge: 0x7a79ff, accent: 0xa889ff, secondary: 0x4078e8 },
  cloud: { name: '云穹群岛', sky: 0x152a43, fog: 0x27495e, floor: 0x315866, edge: 0x8ffff1, accent: 0xeaffd5, secondary: 0x68d4ff },
  super: { name: '超级奖励 · 光珊瑚庭', sky: 0x1a092c, fog: 0x32144b, floor: 0x4b2058, edge: 0xffc45b, accent: 0xffef9f, secondary: 0xff74d4 },
  traverse: { name: '穿越奖励 · 相位洋流', sky: 0x020513, fog: 0x07133a, floor: 0x061e3a, edge: 0x55f6ff, accent: 0xffffff, secondary: 0x7d6dff },
};

function mat(color, emissive = 0x000000, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: extra.glow ?? .35, roughness: extra.rough ?? .5, metalness: extra.metal ?? .25, transparent: extra.opacity < 1, opacity: extra.opacity ?? 1, side: extra.side ?? THREE.FrontSide });
}
function glow(color, opacity = 1) { return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, blending: THREE.AdditiveBlending }); }
function mesh(parent, geometry, material, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, material); m.position.set(...p); m.rotation.set(...r); m.scale.set(...s); parent.add(m); return m;
}
function clear(group) { while (group.children.length) group.remove(group.children[0]); }

class Synth {
  constructor() { this.ctx = null; this.master = null; this.clock = 0; this.beat = 0; }
  async unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    this.ctx = new Ctx(); this.master = this.ctx.createGain(); this.master.gain.value = .18; this.master.connect(this.ctx.destination);
  }
  tone(freq, duration = .12, type = 'sine', volume = .08, slide = 1) {
    if (!this.ctx) return; const now = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, now); o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), now + duration);
    g.gain.setValueAtTime(.0001, now); g.gain.exponentialRampToValueAtTime(volume, now + .01); g.gain.exponentialRampToValueAtTime(.0001, now + duration);
    o.connect(g).connect(this.master); o.start(now); o.stop(now + duration + .02);
  }
  noise(duration = .14, volume = .08) {
    if (!this.ctx) return; const count = Math.floor(this.ctx.sampleRate * duration), b = this.ctx.createBuffer(1, count, this.ctx.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < count; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    source.buffer = b; filter.type = 'highpass'; filter.frequency.value = 350; g.gain.setValueAtTime(volume, this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, this.ctx.currentTime + duration);
    source.connect(filter).connect(g).connect(this.master); source.start();
  }
  event(name) {
    if (name === 'jump') this.tone(330, .14, 'triangle', .1, 1.7);
    else if (name === 'doubleJump') { this.tone(540, .16, 'sine', .1, 1.6); this.tone(820, .1, 'triangle', .05, 1.15); }
    else if (name === 'coin') this.tone(900 + Math.random() * 120, .055, 'sine', .045, 1.15);
    else if (name === 'skill') { this.tone(120, .65, 'sawtooth', .12, 5); this.tone(760, .55, 'sine', .07, .7); }
    else if (name === 'down') this.tone(260, .8, 'sawtooth', .1, .18);
    else if (name === 'revive') { this.tone(180, .7, 'triangle', .1, 4); this.tone(720, .6, 'sine', .06, 1.8); }
    else if (name === 'stomp' || name === 'smash') { this.noise(.12, .09); this.tone(150, .18, 'square', .07, .55); }
    else if (name === 'blocked') this.tone(1050, .3, 'sine', .08, .45);
    else if (name.startsWith('enter')) { this.tone(110, .8, 'sawtooth', .09, 7); this.tone(660, .75, 'sine', .07, 1.5); }
    else if (name.startsWith('power:')) this.tone(440, .32, 'triangle', .08, 2.2);
  }
  update(dt, mode, active) {
    if (!this.ctx || !active) return; this.clock -= dt; if (this.clock > 0) return;
    const fast = mode === BonusMode.TRAVERSE, bonus = mode === BonusMode.SUPER;
    this.clock = fast ? .16 : bonus ? .24 : .31; const scale = fast ? [0, 7, 12, 19, 12, 7] : bonus ? [0, 4, 7, 11, 14, 11] : [0, 3, 7, 10, 7, 3, 12, 7];
    const root = fast ? 130 : bonus ? 165 : 110, f = root * 2 ** (scale[this.beat % scale.length] / 12);
    if (this.beat % 2 === 0 || fast) this.tone(f, fast ? .1 : .19, 'triangle', .02, .99);
    if (this.beat % 4 === 0) this.tone(root / 2, .24, 'sine', .03, .72); this.beat += 1;
  }
}

class ParticlePool {
  constructor(scene, count = 420) {
    this.count = count; this.cursor = 0; this.p = Array.from({ length: count }, () => ({ life: 0 }));
    this.pos = new Float32Array(count * 3); this.col = new Float32Array(count * 3);
    this.geometry = new THREE.BufferGeometry(); this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); this.geometry.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(this.geometry, new THREE.PointsMaterial({ size: reduced ? .12 : .18, vertexColors: true, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false; scene.add(this.points); for (let i = 0; i < count; i += 1) this.pos[i * 3 + 1] = -999;
  }
  emit(x, y, z, color, options = {}) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.count; const p = this.p[i], angle = Math.random() * Math.PI * 2, speed = options.speed ?? (1 + Math.random() * 4);
    p.life = options.life ?? .55; p.max = p.life; p.x = x + (Math.random() - .5) * (options.spread ?? .2); p.y = y + (Math.random() - .5) * (options.spread ?? .2); p.z = z + (Math.random() - .5) * (options.depth ?? .5);
    p.vx = options.vx ?? Math.cos(angle) * speed; p.vy = options.vy ?? Math.sin(angle) * speed; p.vz = options.vz ?? (Math.random() - .5) * speed; p.drag = options.drag ?? 2.5; p.gravity = options.gravity ?? -2;
    const c = new THREE.Color(color); this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
  }
  burst(x, y, z, color, n = 20, options = {}) { for (let i = 0; i < (reduced ? Math.ceil(n * .55) : n); i += 1) this.emit(x, y, z, color, options); }
  update(dt) {
    for (let i = 0; i < this.count; i += 1) { const p = this.p[i], o = i * 3; if (p.life <= 0) { this.pos[o + 1] = -999; continue; }
      p.life -= dt; const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy = p.vy * d + p.gravity * dt; p.vz *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z; }
    this.geometry.attributes.position.needsUpdate = true; this.geometry.attributes.color.needsUpdate = true;
  }
}

class Avatar {
  constructor(scene) {
    this.root = new THREE.Group(); this.root.position.set(PLAYER_X, 1.18, 0); scene.add(this.root); this.time = 0;
    const dark = mat(0x07151d, 0x07151d, { rough: .28, metal: .65 }), pearl = mat(0xdffff8, 0x2e9489, { glow: .22 }), mint = mat(0x55ffd4, 0x20d7b0, { glow: 1 }), cyan = glow(0x74eaff, .95), gold = mat(0xffd166, 0xbd6e16, { glow: .7, metal: .55 });
    this.runner = new THREE.Group(); this.root.add(this.runner); this.body = new THREE.Group(); this.runner.add(this.body);
    mesh(this.body, new THREE.CapsuleGeometry(.38, .72, 5, 10), dark, [0, .12, 0]); mesh(this.body, new THREE.CapsuleGeometry(.28, .5, 4, 8), pearl, [.03, .13, .28], [.08, 0, 0]);
    mesh(this.body, new THREE.OctahedronGeometry(.18), mint, [.28, .17, .45], [0, 0, Math.PI / 4]);
    this.head = new THREE.Group(); this.head.position.set(.02, .96, 0); this.body.add(this.head); mesh(this.head, new THREE.SphereGeometry(.4, 16, 12), dark); mesh(this.head, new THREE.SphereGeometry(.31, 16, 10), pearl, [.08, .01, .1], [0, 0, 0], [1, .92, .85]); mesh(this.head, new THREE.SphereGeometry(.27, 16, 9), cyan, [.18, .05, .3], [0, 0, 0], [1, .55, .28]);
    mesh(this.head, new THREE.ConeGeometry(.12, .32, 5), mint, [-.18, .37, -.14], [.18, 0, -.35]); mesh(this.head, new THREE.ConeGeometry(.12, .32, 5), mint, [-.18, .37, .14], [-.18, 0, -.35]);
    this.armL = this.limb(this.body, dark, pearl, [-.42, .42, 0], false); this.armR = this.limb(this.body, dark, pearl, [.42, .42, 0], false); this.legL = this.limb(this.body, dark, gold, [-.22, -.55, 0], true); this.legR = this.limb(this.body, dark, gold, [.22, -.55, 0], true);
    this.scarf = []; const scarfRoot = new THREE.Group(); scarfRoot.position.set(-.25, .7, 0); this.body.add(scarfRoot); for (let i = 0; i < 6; i += 1) this.scarf.push(mesh(scarfRoot, new THREE.BoxGeometry(.42, .1, .12), mint, [-.32 - i * .32, 0, 0], [0, 0, 0], [1 - i * .08, 1, 1]));
    this.mount = new THREE.Group(); this.mount.position.y = -.7; this.mount.visible = false; this.root.add(this.mount); const shape = new THREE.Shape(); shape.moveTo(1.25, 0); shape.bezierCurveTo(.55, .62, -.7, .58, -1.25, .04); shape.bezierCurveTo(-.45, -.28, .6, -.25, 1.25, 0); mesh(this.mount, new THREE.ShapeGeometry(shape), mint, [0, 0, 0]); this.wingL = mesh(this.mount, new THREE.CircleGeometry(.72, 3, 0, Math.PI), cyan, [-.12, 0, -.2], [Math.PI / 2, .3, -.2], [1.55, 1, 1]); this.wingR = this.wingL.clone(); this.wingR.position.z = .2; this.wingR.rotation.x = -Math.PI / 2; this.mount.add(this.wingR); mesh(this.mount, new THREE.SphereGeometry(.17, 10, 8), dark, [.75, .12, 0]);
    this.pet = new THREE.Group(); this.pet.position.set(-1.35, 1, .45); this.root.add(this.pet); mesh(this.pet, new THREE.IcosahedronGeometry(.26, 1), dark); mesh(this.pet, new THREE.OctahedronGeometry(.19), mint); this.petRing = mesh(this.pet, new THREE.TorusGeometry(.38, .035, 6, 20), cyan, [0, 0, 0], [Math.PI / 2, 0, 0]); mesh(this.pet, new THREE.ConeGeometry(.1, .3, 5), gold, [-.34, 0, 0], [0, 0, Math.PI / 2]);
    this.shield = mesh(this.root, new THREE.SphereGeometry(1.32, 20, 14), new THREE.MeshBasicMaterial({ color: 0x79ffe1, wireframe: true, transparent: true, opacity: .2, blending: THREE.AdditiveBlending }), [0, .1, 0], [0, 0, 0], [1, 1.1, .8]); this.shield.visible = false;
    this.shadow = mesh(scene, new THREE.CircleGeometry(.8, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false }), [PLAYER_X, .015, 0], [-Math.PI / 2, 0, 0], [1.4, .65, 1]);
  }
  limb(parent, a, b, p, leg) { const pivot = new THREE.Group(); pivot.position.set(...p); parent.add(pivot); const l = leg ? .58 : .5; mesh(pivot, new THREE.CapsuleGeometry(leg ? .11 : .09, l, 3, 7), a, [0, -l * .55, 0]); mesh(pivot, leg ? new THREE.BoxGeometry(.27, .18, .48) : new THREE.SphereGeometry(.12, 8, 6), b, [leg ? .1 : 0, -l - .16, leg ? .12 : 0]); return pivot; }
  update(dt, model) {
    this.time += dt; this.root.position.y = model.y; const stride = model.grounded ? Math.sin(this.time * (8 + model.speed * .55)) : .2, crouch = model.crouching, riding = model.mountTime > 0;
    this.mount.visible = riding; this.runner.position.y = damp(this.runner.position.y, riding ? .78 : 0, 10, dt); this.body.scale.y = damp(this.body.scale.y, crouch ? .58 : 1, 14, dt); this.body.position.y = damp(this.body.position.y, crouch ? -.48 : Math.abs(stride) * .055, 16, dt); this.body.rotation.z = damp(this.body.rotation.z, model.grounded ? -.06 + stride * .035 : clamp(-model.velocityY * .025, -.25, .3), 8, dt);
    this.legL.rotation.z = stride * .9; this.legR.rotation.z = -stride * .9; this.armL.rotation.z = -stride * .72 - .1; this.armR.rotation.z = stride * .72 + .1; this.head.rotation.z = Math.sin(this.time * 2.1) * .035;
    this.scarf.forEach((s, i) => { s.rotation.z = Math.sin(this.time * 8 - i * .75) * (.08 + i * .025); s.position.y = Math.sin(this.time * 7 - i * .7) * .06; });
    if (riding) { this.mount.position.y = -.72 + Math.sin(this.time * 4.2) * .08; this.mount.rotation.z = Math.sin(this.time * 2.7) * .05; this.wingL.rotation.x = Math.PI / 2 + Math.sin(this.time * 7.5) * .28; this.wingR.rotation.x = -Math.PI / 2 - Math.sin(this.time * 7.5) * .28; }
    this.pet.position.y = damp(this.pet.position.y, 1 + Math.sin(this.time * 3.4) * .22, 5, dt); this.pet.rotation.y += dt * 1.7; this.petRing.rotation.z += dt * 2.6;
    this.shield.visible = model.shieldTime > 0 || model.invulnerable > 0; this.shield.rotation.y += dt; this.shield.rotation.z -= dt * .6; this.shield.material.opacity = .14 + Math.sin(this.time * 8) * .05;
    const air = Math.max(0, model.y - model.groundY); this.shadow.position.y = model.groundY - 1.165; this.shadow.scale.setScalar(clamp(1.25 - air * .1, .42, 1.25)); this.shadow.material.opacity = clamp(.34 - air * .035, .05, .34);
  }
}

class World {
  constructor(scene) {
    this.scene = scene; this.bg = new THREE.Group(); this.track = new THREE.Group(); scene.add(this.bg, this.track); this.segments = []; this.pools = new Map(); this.parallax = []; this.seed = Date.now() >>> 0; this.mode = BonusMode.NONE; this.themeKey = 'tide'; this.theme = THEMES.tide; this.nextX = -16; this.index = 0;
    this.floorMat = mat(this.theme.floor, this.theme.edge, { glow: .2, metal: .45 }); this.edgeMat = glow(this.theme.edge, .85); this.switch(BonusMode.NONE, 0);
  }
  normalTheme(distance) { return ['tide', 'vault', 'cloud'][Math.floor(distance / 520) % 3]; }
  switch(mode, distance) { this.mode = mode; this.themeKey = mode === BonusMode.SUPER ? 'super' : mode === BonusMode.TRAVERSE ? 'traverse' : this.normalTheme(distance); this.theme = THEMES[this.themeKey]; this.scene.background = new THREE.Color(this.theme.sky); this.scene.fog = new THREE.FogExp2(this.theme.fog, this.themeKey === 'traverse' ? .029 : this.themeKey === 'vault' ? .032 : .022); this.floorMat.color.setHex(this.theme.floor); this.floorMat.emissive.setHex(this.theme.edge); this.edgeMat.color.setHex(this.theme.edge); this.buildBackground(); this.clearSegments(); this.nextX = -16; this.index = 0; this.fill(); }
  buildBackground() {
    clear(this.bg); this.parallax = []; const t = this.theme, rnd = new SeededRandom(this.seed ^ this.themeKey.length * 2654435761), count = reduced ? 160 : 300, pos = new Float32Array(count * 3), col = new Float32Array(count * 3), a = new THREE.Color(t.accent), b = new THREE.Color(t.secondary);
    for (let i = 0; i < count; i += 1) { pos[i * 3] = rnd.range(-38, 55); pos[i * 3 + 1] = rnd.range(1, 20); pos[i * 3 + 2] = rnd.range(-18, -4); const c = i % 3 ? b : a; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: this.themeKey === 'traverse' ? .18 : .11, vertexColors: true, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending })); stars.userData.factor = .02; this.bg.add(stars); this.parallax.push(stars);
    const sun = mesh(this.bg, new THREE.CircleGeometry(this.themeKey === 'super' ? 5.2 : 4.1, 48), glow(t.accent, .16), [18, 11, -16]); sun.userData.factor = .012; this.parallax.push(sun); const halo = mesh(this.bg, new THREE.TorusGeometry(this.themeKey === 'super' ? 6.4 : 5.2, .06, 6, 64), glow(t.accent, .3), [18, 11, -15.8]); halo.userData.factor = .018; halo.userData.spin = .08; this.parallax.push(halo);
    const n = reduced ? 12 : 22;
    for (let i = 0; i < n; i += 1) {
      const root = new THREE.Group(); const key = this.themeKey;
      if (key === 'tide') { mesh(root, new THREE.ConeGeometry(rnd.range(1.8, 4.4), rnd.range(4, 10), 5), mat(i % 2 ? 0x123845 : 0x155866, 0x0c5a5a, { glow: .1 }), [0, 1.5, 0]); if (i % 3 === 0) mesh(root, new THREE.SphereGeometry(.35, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), glow(t.secondary, .22), [0, rnd.range(4, 8), 0]); }
      else if (key === 'vault') { mesh(root, new THREE.CylinderGeometry(.45, .8, rnd.range(6, 12), 6), mat(0x111633, 0x24265e, { glow: .1 }), [0, 4, 0]); mesh(root, new THREE.OctahedronGeometry(rnd.range(.35, .9)), glow(i % 2 ? t.accent : t.secondary, .25), [0, rnd.range(2, 9), 1]); }
      else if (key === 'cloud') { for (let p = 0; p < 5; p += 1) mesh(root, new THREE.SphereGeometry(rnd.range(.6, 1.4), 9, 6), new THREE.MeshLambertMaterial({ color: 0xdffbf5, transparent: true, opacity: .18 }), [p * .6, rnd.range(-.2, .4), rnd.range(-.3, .3)]); if (i % 3 === 0) mesh(root, new THREE.CylinderGeometry(1.7, .4, 2.5, 6), mat(0x315866, 0x3ec9a9, { glow: .12 }), [0, -2, 0]); }
      else if (key === 'super') { for (let p = 0; p < 8; p += 1) mesh(root, new THREE.SphereGeometry(.55, 8, 5), glow(p % 2 ? t.accent : t.secondary, .2), [Math.cos(p * Math.PI / 4) * .85, Math.sin(p * Math.PI / 4) * .85, 0], [0, 0, p * Math.PI / 4], [1.6, .4, .4]); root.userData.spin = rnd.range(-.2, .2); }
      else { mesh(root, new THREE.TorusGeometry(rnd.range(2.5, 5.8), rnd.range(.025, .08), 5, 32), glow(i % 3 ? t.secondary : t.accent, .3), [0, 0, 0], [0, Math.PI / 2, rnd.range(-.3, .3)]); for (let s = 0; s < 3; s += 1) mesh(root, new THREE.BoxGeometry(rnd.range(3, 9), .025, .025), glow(t.accent, .45), [rnd.range(-2, 2), rnd.range(-3, 3), rnd.range(-2, 2)]); root.userData.spin = rnd.range(-.5, .5); }
      root.position.set(rnd.range(-30, 58), rnd.range(this.themeKey === 'vault' ? -2 : 1, 13), rnd.range(-16, -7)); root.userData.factor = this.themeKey === 'traverse' ? rnd.range(.18, .7) : rnd.range(.035, .1); root.userData.wrap = 88; this.bg.add(root); this.parallax.push(root);
    }
  }
  makeEntity(type) {
    const root = new THREE.Group(), dark = mat(0x08141d, 0x03080d, { metal: .7 }), mint = mat(0x4fffd0, 0x22bfa5, { glow: .9 }), cyan = glow(0x67eaff, .9), coral = mat(0xff527b, 0xc72461, { glow: .7 }), gold = mat(0xffd166, 0xff9d2e, { glow: 1.2, metal: .7 });
    if (type === 'coin') { mesh(root, new THREE.TorusGeometry(.31, .095, 7, 16), gold, [0, 0, 0], [0, Math.PI / 2, 0]); mesh(root, new THREE.OctahedronGeometry(.17), glow(0xffed9b, .8)); }
    else if (type === 'hurdle') { mesh(root, new THREE.BoxGeometry(1.15, .6, 1.55), dark, [0, .3, 0]); for (let i = -2; i <= 2; i += 1) mesh(root, new THREE.ConeGeometry(.16, .85, 4), coral, [i * .24, .98, 0], [0, 0, Math.PI / 4]); mesh(root, new THREE.BoxGeometry(1.25, .08, 1.68), cyan, [0, .65, 0]); }
    else if (type === 'monster') { mesh(root, new THREE.DodecahedronGeometry(.63), mat(0x765dff, 0x4930e0, { glow: .75 }), [0, .66, 0], [0, 0, 0], [1.1, .85, .9]); mesh(root, new THREE.ConeGeometry(.2, .55, 5), coral, [-.34, 1.2, 0], [0, 0, -.35]); mesh(root, new THREE.ConeGeometry(.2, .55, 5), coral, [.34, 1.2, 0], [0, 0, .35]); mesh(root, new THREE.SphereGeometry(.12, 8, 6), glow(0xffffff), [.23, .78, .5]); }
    else if (type === 'gate') { mesh(root, new THREE.BoxGeometry(2.75, .68, 1.7), dark); mesh(root, new THREE.BoxGeometry(2.88, .09, 1.82), cyan, [0, -.28, 0]); for (let i = -2; i <= 2; i += 1) mesh(root, new THREE.ConeGeometry(.12, .48, 4), coral, [i * .52, -.55, 0], [0, 0, Math.PI]); }
    else { mesh(root, new THREE.IcosahedronGeometry(.48, 1), new THREE.MeshBasicMaterial({ color: 0x78ffe3, wireframe: true, transparent: true, opacity: .65, blending: THREE.AdditiveBlending })); if (type === 'shield') { mesh(root, new THREE.SphereGeometry(.27, 12, 9), cyan); mesh(root, new THREE.TorusGeometry(.36, .04, 6, 18), glow(0xffffff), [0, 0, 0], [Math.PI / 2, 0, 0]); } else if (type === 'magnet') mesh(root, new THREE.TorusGeometry(.28, .1, 7, 18, Math.PI * 1.45), coral, [0, .02, 0], [0, 0, -.7]); else if (type === 'dash') mesh(root, new THREE.OctahedronGeometry(.3), gold, [0, 0, 0], [0, 0, Math.PI / 4], [.65, 1.6, .5]); else { mesh(root, new THREE.SphereGeometry(.26, 12, 8), mint, [0, 0, 0], [0, 0, 0], [1.6, .45, 1]); mesh(root, new THREE.ConeGeometry(.08, .42, 5), gold, [-.33, 0, 0], [0, 0, Math.PI / 2]); } }
    return root;
  }
  acquire(type) { const pool = this.pools.get(type) ?? []; this.pools.set(type, pool); const m = pool.pop() ?? this.makeEntity(type); m.visible = true; m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); return m; }
  release(item) { item.mesh.removeFromParent(); item.mesh.visible = false; const pool = this.pools.get(item.type) ?? []; pool.push(item.mesh); this.pools.set(item.type, pool); }
  clearSegments() { for (const s of this.segments) { s.items.forEach((i) => this.release(i)); s.geometries.forEach((g) => g.dispose()); s.root.removeFromParent(); } this.segments = []; clear(this.track); }
  floor(s, start, end, top, depth = 6.8, thin = false) { const g = new THREE.BoxGeometry(end - start, thin ? .34 : .72, depth); s.geometries.push(g); const box = mesh(s.root, g, this.floorMat, [(start + end) / 2, top - (thin ? .17 : .36), 0]); box.receiveShadow = true; const e = new THREE.BoxGeometry(end - start, .055, depth + .08); s.geometries.push(e); mesh(s.root, e, this.edgeMat, [(start + end) / 2, top + .02, 0]); s.surfaces.push({ start, end, top, platform: top > .01 }); }
  spawn(start, index) {
    const root = new THREE.Group(); root.position.x = start; const length = this.mode === BonusMode.NONE ? 20 : 24, s = { root, length, items: [], surfaces: [], geometries: [], kind: this.mode };
    if (this.mode === BonusMode.NONE) { const plan = createSegmentPlan(this.seed, index, this.themeKey); s.kind = plan.pattern; plan.floor.forEach((f) => this.floor(s, f.start, f.end, f.y)); plan.platforms.forEach((p) => this.floor(s, p.start, p.end, p.y, 4.6, true)); [...plan.hazards, ...plan.pickups].forEach((source) => this.addItem(s, source)); const rail = new THREE.CylinderGeometry(.035, .035, 20, 5); s.geometries.push(rail); mesh(root, rail, this.edgeMat, [10, -.12, -3.45], [0, 0, Math.PI / 2]); }
    else { this.floor(s, 0, length, 0, this.mode === BonusMode.SUPER ? 7.6 : 3.1, true); createBonusPattern(this.mode, index).forEach((source) => this.addItem(s, source)); if (this.mode === BonusMode.SUPER) { const arch = new THREE.TorusGeometry(3.1, .09, 8, 36, Math.PI); s.geometries.push(arch); mesh(root, arch, this.edgeMat, [6, .2, -1.2], [0, 0, 0], [1, 1.6, 1]); mesh(root, arch, this.edgeMat, [17, .2, -1.2], [0, 0, 0], [1, 1.6, 1]); } else { const ring = new THREE.TorusGeometry(3.7, .075, 6, 42); s.geometries.push(ring); for (let i = 0; i < 3; i += 1) mesh(root, ring, this.edgeMat, [4 + i * 8, 3.4, 0], [0, Math.PI / 2, i * .22]); } }
    this.track.add(root); this.segments.push(s); return s;
  }
  addItem(s, source) { const type = source.type, m = this.acquire(type), item = { type, mesh: m, x: source.x, y: source.y, baseY: source.y, width: source.width ?? (type === 'coin' ? .65 : .9), height: source.height ?? (type === 'coin' ? .65 : .95), active: true, phase: Math.random() * Math.PI * 2 }; m.position.set(item.x, type === 'hurdle' || type === 'monster' ? 0 : item.y, 0); s.root.add(m); s.items.push(item); }
  fill() { while (this.nextX < 95) { const s = this.spawn(this.nextX, this.index++); this.nextX += s.length; } }
  ground(model) { let best = null, feet = model.y - 1.18; for (const s of this.segments) { const x = PLAYER_X - s.root.position.x; if (x < 0 || x > s.length) continue; for (const p of s.surfaces) if (x >= p.start && x <= p.end && (!p.platform || feet >= p.top - .35 || (model.velocityY <= 0 && feet >= p.top - .75))) best = best === null ? p.top : Math.max(best, p.top); } return best === null ? -20 : best + 1.18; }
  deactivate(item) { item.active = false; item.mesh.visible = false; }
  collect(item, model, events) { this.deactivate(item); if (item.type === 'coin') { model.collectCoin(); events.push({ type: 'coin', color: 0xffd166 }); } else { model.grantPower(item.type, { shield: 9, magnet: 10, dash: 5, mount: 12 }[item.type] ?? 7); model.reward(`collect:${item.type}`, 650); events.push({ type: `power:${item.type}`, color: item.type === 'shield' ? 0x66eaff : item.type === 'magnet' ? 0xff668d : item.type === 'dash' ? 0xffd166 : 0x63ffd5 }); } }
  collisions(model) {
    const events = [], bottom = model.y - 1.18, top = bottom + model.hitboxHeight, center = (bottom + top) / 2;
    for (const s of this.segments) for (const item of s.items) { if (!item.active) continue; let wx = s.root.position.x + item.x, dx = wx - PLAYER_X;
      if (item.type === 'coin' && model.magnetTime > 0 && dx > -4 && dx < 10) { item.x += (PLAYER_X - wx) * .08; item.y += (model.y + .25 - item.y) * .1; item.mesh.position.set(item.x, item.y, 0); wx = s.root.position.x + item.x; dx = wx - PLAYER_X; }
      if (Math.abs(dx) > (item.width + 1) * .65) continue;
      if (item.type === 'coin' || ['shield', 'magnet', 'dash', 'mount'].includes(item.type)) { if (Math.abs(item.y - center) < (item.type === 'coin' ? .85 : 1.05) + model.hitboxHeight * .35) this.collect(item, model, events); continue; }
      const low = item.type === 'gate' ? item.y - item.height / 2 : 0, high = item.type === 'gate' ? item.y + item.height / 2 : item.height; if (top < low || bottom > high) continue;
      if (item.type === 'monster' && model.velocityY < -.5 && bottom > high - .5) { this.deactivate(item); model.velocityY = 9.2; model.grounded = false; model.reward('stomp', 750); events.push({ type: 'stomp', color: 0xa889ff }); continue; }
      const hit = model.receiveHit(item.type); if (hit.result !== 'down') this.deactivate(item); events.push({ type: hit.result === 'smashed' ? 'smash' : hit.result, color: hit.result === 'down' ? 0xff446f : 0x63ffd5 }); if (hit.result === 'down') return events;
    } return events;
  }
  pet(model) { let candidate = null, distance = Infinity; for (const s of this.segments) for (const item of s.items) if (item.active && item.type === 'coin') { const dx = s.root.position.x + item.x - PLAYER_X, d = Math.abs(dx) + Math.abs(item.y - model.y) * .35; if (dx >= -1.5 && dx <= 8.5 && d < distance) { candidate = item; distance = d; } } if (!candidate) return null; this.collect(candidate, model, []); return { type: 'pet', color: 0x63ffd5 }; }
  update(dt, speed, model, elapsed) {
    const move = speed * dt; this.nextX -= move; for (const s of this.segments) { s.root.position.x -= move; for (const item of s.items) if (item.active) { item.phase += dt * (item.type === 'coin' ? 4.5 : 2.2); if (item.type === 'coin') { item.mesh.rotation.y += dt * 6; item.mesh.rotation.z = Math.sin(item.phase) * .22; item.mesh.position.y = item.y + Math.sin(item.phase) * .09; } else if (item.type === 'monster') item.mesh.position.y = Math.abs(Math.sin(item.phase * 1.7)) * .12; else if (['shield', 'magnet', 'dash', 'mount'].includes(item.type)) { item.mesh.rotation.y += dt * 1.8; item.mesh.rotation.z += dt * .8; item.mesh.position.y = item.baseY + Math.sin(item.phase) * .18; } } }
    for (const s of this.segments.filter((x) => x.root.position.x + x.length < -18)) { s.items.forEach((i) => this.release(i)); s.geometries.forEach((g) => g.dispose()); s.root.removeFromParent(); this.segments.splice(this.segments.indexOf(s), 1); } this.fill();
    for (const o of this.parallax) { o.position.x -= speed * dt * (o.userData.factor ?? .05); if (o.position.x < -35) o.position.x += o.userData.wrap ?? 88; if (o.userData.spin) o.rotation.z += o.userData.spin * dt; }
    return this.collisions(model);
  }
}

class Game {
  constructor() {
    this.model = new RunnerModel(); this.synth = new Synth(); this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, .1, 220); this.camera.position.set(0, 5.4, 13.5); this.look = new THREE.Vector3(-1.1, 2.6, 0);
    this.renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: !reduced, powerPreference: 'high-performance' }); this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, reduced ? 1.15 : 1.8)); this.renderer.setSize(innerWidth, innerHeight, false); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12; this.renderer.shadowMap.enabled = !reduced;
    this.hemi = new THREE.HemisphereLight(0xa9fff0, 0x07111c, 1.35); this.key = new THREE.DirectionalLight(0xffffff, 2.7); this.key.position.set(-4, 12, 9); this.key.castShadow = !reduced; this.rim = new THREE.PointLight(0x63ffd5, 30, 28, 2); this.rim.position.set(-4, 5, 5); this.scene.add(this.hemi, this.key, this.rim);
    this.particles = new ParticlePool(this.scene); this.world = new World(this.scene); this.avatar = new Avatar(this.scene); this.last = performance.now(); this.elapsed = 0; this.lastState = null; this.shake = 0; this.announceTimer = 0; this.toastTimer = 0; this.petTimer = 1.5; this.section = 0; this.finalized = false; this.best = this.loadBest(); this.bind(); this.sync(true); this.resize(); requestAnimationFrame((t) => this.loop(t));
  }
  loadBest() { try { return Math.max(0, Number(localStorage.getItem(STORAGE_KEY)) || 0); } catch { return 0; } }
  saveBest(v) { this.best = Math.max(this.best, Math.floor(v)); try { localStorage.setItem(STORAGE_KEY, String(this.best)); } catch {} ui.best.textContent = fmt(this.best); return this.best; }
  bind() {
    ui.best.textContent = fmt(this.best); $('#start-button').onclick = () => this.start(); $('#pause-button').onclick = () => this.pause(); $('#resume-button').onclick = () => this.resume(); $('#quit-button').onclick = () => this.end(); $('#revive-button').onclick = () => this.revive(); $('#give-up-button').onclick = () => this.end(); $('#restart-button').onclick = () => this.start();
    addEventListener('keydown', (e) => { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); if (!e.repeat && ['Space', 'ArrowUp', 'KeyW'].includes(e.code)) this.jump(); else if (!e.repeat && ['ArrowDown', 'KeyS'].includes(e.code)) this.model.setCrouch(true); else if (!e.repeat && ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyE'].includes(e.code)) this.skill(); else if (!e.repeat && ['KeyP', 'Escape'].includes(e.code)) this.model.state === GameState.PAUSED ? this.resume() : this.pause(); else if (!e.repeat && e.code === 'KeyR') this.revive(); else if (!e.repeat && e.code === 'Enter' && [GameState.READY, GameState.GAME_OVER].includes(this.model.state)) this.start(); });
    addEventListener('keyup', (e) => { if (['ArrowDown', 'KeyS'].includes(e.code)) this.model.setCrouch(false); }); addEventListener('resize', () => this.resize()); document.addEventListener('visibilitychange', () => { if (document.hidden && this.model.isPlayable() && !smokeMode) this.pause(); });
    ui.mobile.querySelectorAll('button').forEach((b) => { const action = b.dataset.action; b.onpointerdown = (e) => { e.preventDefault(); if (action === 'jump') this.jump(); else if (action === 'skill') this.skill(); else this.model.setCrouch(true); }; if (action === 'crouch') b.onpointerup = b.onpointercancel = b.onpointerleave = () => this.model.setCrouch(false); });
  }
  async start() { await this.synth.unlock(); this.model.start(); this.world.seed = Date.now() >>> 0; this.world.switch(BonusMode.NONE, 0); this.section = 0; this.finalized = false; this.petTimer = 1.2; this.announce('CURRENT ONLINE', '潮汐开始流动', '收集光币，维持连击，穿过不断重编的航道', 2.4); this.sync(true); }
  jump() { this.synth.unlock(); if ([GameState.READY, GameState.GAME_OVER].includes(this.model.state)) return void this.start(); if (this.model.jump()) { const event = this.model.jumpsUsed === 2 ? 'doubleJump' : 'jump'; this.synth.event(event); this.particles.burst(PLAYER_X, this.model.y - .8, 0, event === 'doubleJump' ? 0x6de8ff : 0x63ffd5, event === 'doubleJump' ? 22 : 12, { speed: 3.2, gravity: -4, life: .45 }); } }
  skill() { this.synth.unlock(); if (!this.model.activateSkill()) { if (this.model.isPlayable() && this.model.skillCooldown > 0) this.toast(`共鸣充能中 · ${this.model.skillCooldown.toFixed(1)}s`); return; } this.synth.event('skill'); this.shake = .45; this.particles.burst(PLAYER_X, this.model.y, 0, 0x63ffd5, 56, { speed: 8, gravity: -1, life: .9, spread: .8 }); this.announce('RESONANCE BURST', '折光共鸣', '冲刺、磁吸、护盾与折光鳐同步启动', 1.8); }
  pause() { if (this.model.pause()) this.sync(true); }
  resume() { if (this.model.resume()) { this.last = performance.now(); this.sync(true); } }
  revive() { if (!this.model.revive()) return; this.world.switch(BonusMode.NONE, this.model.distance); this.synth.event('revive'); this.flash(); this.particles.burst(PLAYER_X, this.model.y, 0, 0x9ffff0, 70, { speed: 9, life: 1.1, spread: 1 }); this.announce('TIDE RECALL', '回潮复活', '3 秒护盾生效 · 航道已重置到安全段', 2.1); this.sync(true); }
  end() { if (this.model.state !== GameState.GAME_OVER) this.model.giveUp(); this.finalize(); this.sync(true); }
  finalize() { if (this.finalized) return; this.finalized = true; const score = Math.floor(this.model.score), record = score > this.best; this.saveBest(score); ui.resultScore.textContent = fmt(score); ui.resultDistance.textContent = `${fmt(this.model.distance)} m`; ui.resultCoins.textContent = fmt(this.model.coins); ui.resultCombo.textContent = `×${Math.floor(this.model.maxCombo)}`; ui.record.classList.toggle('hidden', !record); }
  bonus(mode) { const duration = mode === BonusMode.SUPER ? 12 : 9.5; if (!this.model.enterBonus(mode, duration)) return; this.world.switch(mode, this.model.distance); this.model.y = 1.18; this.model.velocityY = 0; this.model.grounded = true; if (mode === BonusMode.SUPER) this.model.grantPower('magnet', duration + .5); else { this.model.grantPower('mount', duration + 1); this.model.grantPower('dash', duration + .5); } this.flash(); this.shake = .6; this.announce(mode === BonusMode.SUPER ? 'SUPER REWARD · ×3' : 'TRAVERSE REWARD · HYPERFLOW', mode === BonusMode.SUPER ? '光珊瑚庭' : '相位洋流', mode === BonusMode.SUPER ? '独立庭院、连续金币阵列、12 秒三倍倍率' : '独立高速隧道、相位环与 9.5 秒双倍倍率', 2.8); this.events(this.model.drainEvents()); }
  returnFromBonus(kind) { this.world.switch(BonusMode.NONE, this.model.distance); this.model.y = 1.18; this.model.velocityY = 0; this.model.grounded = true; this.model.invulnerable = 1.5; this.flash(); this.announce('ROUTE RESTORED', '返回主航道', kind === 'super' ? '超级奖励结算完成 · 主航道已重新生成' : '穿越奖励结束 · 时空速度恢复', 2.1); }
  events(events) { for (const e of events) { if (['jump', 'doubleJump', 'coin', 'skill'].includes(e)) continue; if (e === 'superReady' && this.model.mode === BonusMode.NONE) this.bonus(BonusMode.SUPER); else if (e === 'traverseReady' && this.model.mode === BonusMode.NONE) this.bonus(BonusMode.TRAVERSE); else if (e === 'exitSuper') this.returnFromBonus('super'); else if (e === 'exitTraverse') this.returnFromBonus('traverse'); else this.synth.event(e); } }
  visuals(events) { for (const e of events) { this.particles.burst(PLAYER_X, this.model.y, 0, e.color, e.type === 'coin' ? 8 : e.type === 'down' ? 60 : 30, { speed: e.type === 'coin' ? 2.4 : 6, gravity: -4, life: e.type === 'coin' ? .3 : .75, spread: e.type === 'down' ? .9 : .3 }); if (e.type === 'coin') this.synth.event('coin'); else if (e.type === 'pet') { this.synth.tone(1180, .08, 'sine', .04, .75); this.toast('光核伙伴代收 +1'); } else if (e.type.startsWith('power:')) { this.synth.event(e.type); this.toast(`${{ shield: '潮膜护盾', magnet: '引潮磁场', dash: '浪尖冲刺', mount: '折光鳐坐骑' }[e.type.split(':')[1]]} 已激活`); } else { this.synth.event(e.type); this.shake = Math.max(this.shake, e.type === 'down' ? 1 : .45); } } }
  announce(k, title, p, time = 2) { ui.announcement.querySelector('small').textContent = k; ui.announcement.querySelector('strong').textContent = title; ui.announcement.querySelector('p').textContent = p; ui.announcement.classList.add('show'); this.announceTimer = time; }
  toast(text) { ui.toast.textContent = text; ui.toast.classList.add('show'); this.toastTimer = 1.4; }
  flash() { ui.flash.classList.add('active'); requestAnimationFrame(() => requestAnimationFrame(() => ui.flash.classList.remove('active'))); }
  sync(force = false) { if (!force && this.lastState === this.model.state) return; this.lastState = this.model.state; [ui.start, ui.pause, ui.revive, ui.result].forEach((x) => x.classList.remove('active')); const play = this.model.isPlayable(); ui.hud.classList.toggle('hidden', !play && this.model.state !== GameState.REVIVE); ui.mobile.classList.toggle('hidden', !play); if (this.model.state === GameState.READY) ui.start.classList.add('active'); else if (this.model.state === GameState.PAUSED) ui.pause.classList.add('active'); else if (this.model.state === GameState.REVIVE) ui.revive.classList.add('active'); else if (this.model.state === GameState.GAME_OVER) { this.finalize(); ui.result.classList.add('active'); } }
  hud() { const m = this.model; ui.distance.textContent = `${fmt(m.distance)} m`; ui.score.textContent = fmt(m.score); ui.coins.textContent = fmt(m.coins); ui.combo.textContent = `COMBO ×${Math.max(1, Math.floor(m.combo))} · 倍率 ${m.scoreMultiplier}`; ui.comboFill.style.width = `${clamp((m.combo % 12) / 12 * 100, 2, 100)}%`; ui.skillFill.style.width = `${clamp((m.skillCooldown <= 0 ? 1 : 1 - m.skillCooldown / 14) * 100, 0, 100)}%`; ui.skillText.textContent = m.skillCooldown <= 0 ? 'READY · SHIFT' : `${m.skillCooldown.toFixed(1)}s`; ui.mode.textContent = m.mode === BonusMode.SUPER ? `超级奖励 ×3 · ${m.bonusTime.toFixed(1)}s` : m.mode === BonusMode.TRAVERSE ? `穿越奖励 ×2 · ${m.bonusTime.toFixed(1)}s` : this.world.theme.name; const buffs = []; if (m.shieldTime > 0) buffs.push(['盾', m.shieldTime]); if (m.magnetTime > 0) buffs.push(['磁', m.magnetTime]); if (m.dashTime > 0) buffs.push(['冲', m.dashTime]); if (m.mountTime > 0) buffs.push(['鳐', m.mountTime]); ui.buffs.innerHTML = buffs.slice(0, 3).map(([n, t]) => `<span class="buff-chip">${n}<b>${Math.ceil(t)}</b></span>`).join(''); if (m.state === GameState.REVIVE) { ui.reviveTime.textContent = Math.ceil(m.reviveCountdown); $('#revive-button').classList.toggle('hidden', !m.reviveAvailable); } }
  update(dt) {
    this.elapsed += dt; if (this.model.isPlayable()) { const ev = this.model.update(dt, { groundY: this.world.ground(this.model) }); this.events(ev); if (this.model.isPlayable()) { this.visuals(this.world.update(dt, this.model.speed, this.model, this.elapsed)); if (this.model.y < -4.7) { const hit = this.model.receiveHit('abyss'); this.visuals([{ type: hit.result === 'down' ? 'down' : hit.result, color: 0xff668d }]); } this.petTimer -= dt; if (this.petTimer <= 0) { this.petTimer = 2.6; const pet = this.world.pet(this.model); if (pet) this.visuals([pet]); } const section = Math.floor(this.model.distance / 520); if (this.model.mode === BonusMode.NONE && section !== this.section) { this.section = section; this.world.switch(BonusMode.NONE, this.model.distance); this.model.invulnerable = 1.25; this.flash(); this.announce('BIOME SHIFT', this.world.theme.name, '新的程序化地形已接入航道', 2); } if (this.model.dashTime > 0) this.particles.emit(PLAYER_X - .7, this.model.y, 0, this.world.theme.edge, { vx: -10, vy: (Math.random() - .5) * 1.4, life: .38, gravity: 0 }); } }
    else if (this.model.state === GameState.REVIVE) { this.events(this.model.update(dt)); if (this.model.state === GameState.GAME_OVER) this.finalize(); }
    this.avatar.update(this.model.state === GameState.PAUSED ? Math.min(dt, .01) : dt, this.model); this.particles.update(dt); this.synth.update(dt, this.model.mode, this.model.isPlayable()); this.cameraUpdate(dt); if (this.announceTimer > 0 && (this.announceTimer -= dt) <= 0) ui.announcement.classList.remove('show'); if (this.toastTimer > 0 && (this.toastTimer -= dt) <= 0) ui.toast.classList.remove('show'); this.sync(); this.hud();
  }
  cameraUpdate(dt) { const tr = this.model.mode === BonusMode.TRAVERSE, su = this.model.mode === BonusMode.SUPER, target = tr ? new THREE.Vector3(-10.5, 5.7, 11.2) : su ? new THREE.Vector3(.5, 6.1, 14.5) : new THREE.Vector3(0, 5.35, 13.5), look = tr ? new THREE.Vector3(6.5, 3.2, 0) : new THREE.Vector3(-1.1, 2.6, 0); this.camera.position.lerp(target, 1 - Math.exp(-2.8 * dt)); this.look.lerp(look, 1 - Math.exp(-3.4 * dt)); this.shake = Math.max(0, this.shake - dt * 2.4); if (this.shake > 0 && !reduced) { const n = this.shake * this.shake * .2; this.camera.position.x += (Math.random() - .5) * n; this.camera.position.y += (Math.random() - .5) * n; } this.camera.lookAt(this.look); this.camera.fov = damp(this.camera.fov, tr ? 58 : this.model.dashTime > 0 ? 50 : 44, 5, dt); this.camera.updateProjectionMatrix(); const t = this.world.theme; this.hemi.color.lerp(new THREE.Color(t.accent), 1 - Math.exp(-2 * dt)); this.rim.color.lerp(new THREE.Color(t.edge), 1 - Math.exp(-3 * dt)); this.rim.intensity = this.model.dashTime > 0 ? 55 : 30; }
  loop(now) { const dt = clamp((now - this.last) / 1000, 0, .05); this.last = now; this.update(dt); this.renderer.render(this.scene, this.camera); requestAnimationFrame((t) => this.loop(t)); }
  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, reduced ? 1.15 : 1.8)); this.renderer.setSize(innerWidth, innerHeight, false); }
}

let game;
try { game = new Game(); window.__LUMEN_TIDE__ = game; } catch (error) { console.error(error); document.body.innerHTML = `<main style="min-height:100%;display:grid;place-items:center;background:#041017;color:#dffff8;font-family:system-ui"><div><h1>LUMEN TIDE</h1><p>WebGL 初始化失败，请启用硬件加速后刷新。</p><pre>${String(error?.message ?? error)}</pre></div></main>`; }

async function smoke() {
  const checks = [], check = (name, value) => { checks.push({ name, pass: Boolean(value) }); if (!value) throw new Error(name); };
  try {
    check('initialized', game?.renderer && game?.world && game?.avatar); await game.start(); check('start', game.model.state === GameState.RUNNING); check('jump', game.model.jump()); check('double jump', game.model.jump()); check('jump limit', !game.model.jump()); game.model.y = game.model.groundY; game.model.grounded = true; game.model.jumpsUsed = 0; game.model.setCrouch(true); check('crouch', game.model.hitboxHeight < 1.2); game.model.setCrouch(false); check('skill', game.model.activateSkill()); check('pause', game.model.pause()); check('resume', game.model.resume()); game.model.skillTime = game.model.dashTime = game.model.shieldTime = game.model.magnetTime = game.model.mountTime = 0;
    check('super entry', game.model.enterBonus(BonusMode.SUPER, 3)); game.world.switch(BonusMode.SUPER, game.model.distance); check('super scene', game.world.themeKey === 'super' && game.world.segments.some((s) => s.kind === BonusMode.SUPER)); game.model.exitBonus(); game.world.switch(BonusMode.NONE, game.model.distance); check('super return', game.model.state === GameState.RUNNING);
    check('traverse entry', game.model.enterBonus(BonusMode.TRAVERSE, 3)); game.world.switch(BonusMode.TRAVERSE, game.model.distance); check('traverse scene', game.world.themeKey === 'traverse' && game.world.segments.some((s) => s.kind === BonusMode.TRAVERSE)); game.model.exitBonus(); game.world.switch(BonusMode.NONE, game.model.distance); game.model.invulnerable = game.model.shieldTime = game.model.mountTime = 0; check('death', game.model.receiveHit('smoke').result === 'down'); check('revive', game.model.revive()); game.saveBest(424242); check('storage', game.loadBest() >= 424242); await new Promise((r) => setTimeout(r, 350)); check('rendered frame', game.renderer.info.render.frame > 0);
    document.documentElement.dataset.smoke = 'pass'; ui.smoke.hidden = false; ui.smoke.textContent = JSON.stringify({ pass: true, checks }, null, 2);
  } catch (error) { document.documentElement.dataset.smoke = 'fail'; ui.smoke.hidden = false; ui.smoke.textContent = JSON.stringify({ pass: false, checks, error: String(error) }, null, 2); console.error(error); }
}
if (smokeMode && game) setTimeout(smoke, 120);
