import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const randomSeed = (n) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const THEMES = [
  { name: 'NOVA CITY', bg: 0x07162e, fog: 0x0b2141, ground: 0x142c4b, edge: 0x58e7ff, accent: 0xffc654, deco: 0x8d7cff },
  { name: 'CRYSTAL VAULT', bg: 0x160f32, fog: 0x2b1a4c, ground: 0x2b2050, edge: 0xff82d7, accent: 0xffc654, deco: 0x7df7dd },
  { name: 'EMBER DUST', bg: 0x291329, fog: 0x482035, ground: 0x3c253e, edge: 0xff795f, accent: 0xffc654, deco: 0x8bb4ff },
  { name: 'ORBITAL TUNNEL', bg: 0x041d28, fog: 0x0a3b43, ground: 0x123d43, edge: 0x7bffc6, accent: 0xffd95d, deco: 0x58baff },
];

const BONUS_PALETTES = {
  SUPER_REWARD: { name: 'SUPER REWARD', bg: 0x110833, fog: 0x25115b, ground: 0x26155e, edge: 0xffd26a, accent: 0xff77d9, deco: 0x62eaff },
  TRAVEL: { name: 'HYPER TRAVEL', bg: 0x031e2e, fog: 0x07455b, ground: 0x0a354b, edge: 0x6af5ff, accent: 0x9bffcf, deco: 0xff9b6c },
};

const STORAGE_KEY = 'neon-sprint-record-v1';

const storedRecord = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
})();

const game = {
  state: 'MENU',
  mode: 'RUN',
  time: 0,
  worldCursor: -42,
  segmentIndex: 0,
  segments: [],
  activeEntities: [],
  bonusEntities: [],
  bonusDecor: [],
  bonusTimer: 0,
  bonusElapsed: 0,
  returnX: 0,
  scheduleIndex: 0,
  score: 0,
  coins: 0,
  distance: 0,
  combo: 1,
  comboTimer: 0,
  bestCombo: 1,
  highScore: Number(storedRecord.highScore) || 0,
  totalCoins: Number(storedRecord.totalCoins) || 0,
  seed: Math.random() * 100000,
  reviveAvailable: true,
  currentTheme: 0,
  mountEnabled: true,
  petEnabled: true,
  muted: Boolean(storedRecord.muted),
  shake: 0,
  shakeStrength: 0,
  dash: 0,
  dashCooldown: 0,
  magnet: 0,
  magnetCooldown: 0,
  shield: 0,
  flash: 0,
  messageTimer: 0,
  uiAccumulator: 0,
};

const input = { crouch: false };

const bonusSchedule = [
  { x: 104, type: 'SUPER_REWARD' },
  { x: 314, type: 'TRAVEL' },
  { x: 538, type: 'SUPER_REWARD' },
  { x: 782, type: 'TRAVEL' },
  { x: 1030, type: 'SUPER_REWARD' },
];

const canvas = $('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(THEMES[0].bg);
scene.fog = new THREE.Fog(THEMES[0].fog, 30, 150);

const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 220);
camera.position.set(4, 5.2, 22);
camera.lookAt(4, 3.5, 0);
camera.zoom = 1;
camera.updateProjectionMatrix();

const ambientLight = new THREE.HemisphereLight(0xafd7ff, 0x071024, 2.7);
scene.add(ambientLight);
const keyLight = new THREE.DirectionalLight(0xd6f7ff, 3.1);
keyLight.position.set(8, 18, 12);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0x4be8ff, 22, 42, 2);
rimLight.position.set(3, 5, 7);
scene.add(rimLight);

const normalRoot = new THREE.Group();
normalRoot.name = 'normal-root';
const worldRoot = new THREE.Group();
worldRoot.name = 'procedural-world';
const ambientRoot = new THREE.Group();
ambientRoot.name = 'ambient-foreground';
normalRoot.add(ambientRoot, worldRoot);
scene.add(normalRoot);

const bonusRoot = new THREE.Group();
bonusRoot.name = 'bonus-scenes';
const superRoot = new THREE.Group();
const travelRoot = new THREE.Group();
bonusRoot.add(superRoot, travelRoot);
bonusRoot.visible = false;
superRoot.visible = false;
travelRoot.visible = false;
scene.add(bonusRoot);

const particleRoot = new THREE.Group();
particleRoot.name = 'particle-pool';
scene.add(particleRoot);

const GEOMETRIES = {
  coin: new THREE.TorusGeometry(0.27, 0.105, 8, 18),
  smallRing: new THREE.TorusGeometry(0.42, 0.035, 6, 24),
  spark: new THREE.SphereGeometry(0.065, 5, 5),
  shadow: new THREE.CircleGeometry(0.7, 24),
  board: new THREE.BoxGeometry(1.75, 0.12, 0.62),
  orb: new THREE.SphereGeometry(0.34, 12, 8),
};

const MATERIALS = {
  coin: new THREE.MeshStandardMaterial({ color: 0xffc654, emissive: 0xb56b18, emissiveIntensity: 2.1, metalness: 0.68, roughness: 0.23 }),
  cyan: new THREE.MeshStandardMaterial({ color: 0x58e7ff, emissive: 0x0e789a, emissiveIntensity: 1.7, metalness: 0.35, roughness: 0.28 }),
  white: new THREE.MeshStandardMaterial({ color: 0xeaf9ff, emissive: 0x3b8ba8, emissiveIntensity: 0.45, metalness: 0.1, roughness: 0.42 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0b1730, emissive: 0x06102a, emissiveIntensity: 0.4, metalness: 0.45, roughness: 0.35 }),
  coral: new THREE.MeshStandardMaterial({ color: 0xff6a78, emissive: 0x8f1d42, emissiveIntensity: 1.5, metalness: 0.2, roughness: 0.35 }),
  mint: new THREE.MeshStandardMaterial({ color: 0x7bf6c4, emissive: 0x167c6a, emissiveIntensity: 1.6, metalness: 0.22, roughness: 0.3 }),
  violet: new THREE.MeshStandardMaterial({ color: 0x9f8cff, emissive: 0x4528aa, emissiveIntensity: 1.35, metalness: 0.28, roughness: 0.34 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x192d58, emissive: 0x0b1d4b, emissiveIntensity: 0.9, transparent: true, opacity: 0.78, metalness: 0.3, roughness: 0.18 }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x020716, transparent: true, opacity: 0.38, depthWrite: false }),
};

const targetPalette = { bg: new THREE.Color(THEMES[0].bg), fog: new THREE.Color(THEMES[0].fog), edge: new THREE.Color(THEMES[0].edge) };

function box(width, height, depth, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function matColor(material, color, intensity = null) {
  material.color.setHex(color);
  if (material.emissive) material.emissive.setHex(color);
  if (intensity !== null && material.emissiveIntensity !== undefined) material.emissiveIntensity = intensity;
  return material;
}

function clearGroup(group) {
  while (group.children.length) group.remove(group.children[group.children.length - 1]);
}

function createCanvasLabel(text, color = '#8ef3ff', background = 'rgba(5, 16, 37, .82)') {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const context = labelCanvas.getContext('2d');
  context.clearRect(0, 0, 512, 128);
  context.fillStyle = background;
  context.roundRect(8, 18, 496, 86, 18);
  context.fill();
  context.strokeStyle = color;
  context.globalAlpha = 0.55;
  context.lineWidth = 2;
  context.stroke();
  context.globalAlpha = 1;
  context.fillStyle = color;
  context.font = '700 30px Space Grotesk, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(4.8, 1.2, 1);
  return sprite;
}

function makePlayer() {
  const root = new THREE.Group();
  root.name = 'runner';

  const shadow = new THREE.Mesh(GEOMETRIES.shadow, MATERIALS.shadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.035, 0.75);
  shadow.scale.set(1.1, 0.58, 1);
  root.add(shadow);

  const board = new THREE.Group();
  board.name = 'hoverboard';
  const boardBody = new THREE.Mesh(GEOMETRIES.board, MATERIALS.cyan);
  boardBody.rotation.z = -0.06;
  board.add(boardBody);
  board.add(box(0.26, 0.045, 0.7, MATERIALS.dark, -0.51, -0.08, 0));
  board.add(box(0.22, 0.045, 0.62, MATERIALS.dark, 0.58, -0.08, 0));
  const boardRail = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 5, 12, Math.PI), MATERIALS.coin);
  boardRail.rotation.z = Math.PI / 2;
  boardRail.position.y = -0.1;
  board.add(boardRail);
  root.add(board);

  const avatar = new THREE.Group();
  avatar.name = 'avatar';
  const body = box(0.92, 1.28, 0.75, MATERIALS.cyan, 0, 1.27, 0);
  body.rotation.z = -0.04;
  avatar.add(body);
  avatar.add(box(0.64, 0.18, 0.82, MATERIALS.white, 0, 0.74, 0.01));
  const chest = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.035, 6, 18), MATERIALS.coin);
  chest.rotation.x = Math.PI / 2;
  chest.position.set(0, 1.3, 0.4);
  chest.scale.set(1.15, 0.82, 1);
  avatar.add(chest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.56, 14, 10), MATERIALS.white);
  head.position.set(0, 2.28, 0);
  head.scale.set(1, 0.96, 0.86);
  avatar.add(head);
  const visor = box(0.68, 0.3, 0.11, MATERIALS.dark, 0, 2.3, -0.48);
  visor.rotation.x = -0.05;
  avatar.add(visor);
  const visorGlow = box(0.44, 0.045, 0.02, MATERIALS.cyan, 0, 2.33, -0.55);
  avatar.add(visorGlow);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.57, 1.63, 0);
  leftArm.add(box(0.25, 0.85, 0.28, MATERIALS.white, 0, -0.35, 0));
  leftArm.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), MATERIALS.cyan));
  avatar.add(leftArm);
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.57;
  avatar.add(rightArm);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.27, 0.75, 0);
  leftLeg.add(box(0.3, 0.75, 0.34, MATERIALS.dark, 0, -0.35, 0));
  leftLeg.add(box(0.42, 0.18, 0.52, MATERIALS.cyan, 0.07, -0.77, -0.05));
  avatar.add(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.27;
  avatar.add(rightLeg);

  const shoulderRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.025, 4, 24), MATERIALS.cyan);
  shoulderRing.rotation.x = Math.PI / 2;
  shoulderRing.position.y = 1.72;
  shoulderRing.scale.set(1, 0.44, 1);
  shoulderRing.material = shoulderRing.material.clone();
  shoulderRing.material.transparent = true;
  shoulderRing.material.opacity = 0.55;
  avatar.add(shoulderRing);
  root.add(avatar);

  const pet = new THREE.Group();
  pet.name = 'pet';
  const petOrb = new THREE.Mesh(GEOMETRIES.orb, MATERIALS.coin);
  petOrb.scale.set(1, 0.9, 1);
  pet.add(petOrb);
  const petRing = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.045, 6, 18), MATERIALS.coral);
  petRing.rotation.x = Math.PI / 2;
  pet.add(petRing);
  const petEyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), MATERIALS.dark);
  petEyeLeft.position.set(-0.11, 0.04, -0.3);
  pet.add(petEyeLeft);
  const petEyeRight = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), MATERIALS.dark);
  petEyeRight.position.set(0.11, 0.04, -0.3);
  pet.add(petEyeRight);
  pet.position.set(-1.15, 2.65, 0.3);
  root.add(pet);

  const shieldAura = new THREE.Group();
  const shieldShell = new THREE.Mesh(new THREE.SphereGeometry(1.55, 16, 12), new THREE.MeshBasicMaterial({ color: 0x7bf6c4, transparent: true, opacity: 0.12, wireframe: true }));
  shieldAura.add(shieldShell);
  const shieldRing = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.035, 6, 30), MATERIALS.mint);
  shieldRing.rotation.x = Math.PI / 2;
  shieldAura.add(shieldRing);
  shieldAura.position.y = 1.25;
  shieldAura.visible = false;
  root.add(shieldAura);

  const magnetAura = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.025, 5, 36), MATERIALS.coin);
  magnetAura.rotation.x = Math.PI / 2;
  magnetAura.position.y = 1.35;
  magnetAura.visible = false;
  root.add(magnetAura);

  return { root, shadow, board, avatar, leftArm, rightArm, leftLeg, rightLeg, pet, shieldAura, magnetAura, visorGlow };
}

const playerVisual = makePlayer();
const player = {
  group: playerVisual.root,
  yVelocity: 0,
  previousY: 0,
  grounded: true,
  jumpCount: 0,
  coyote: 0,
  runCycle: 0,
  x: 0,
};

function createBackdrop() {
  const stars = [];
  for (let i = 0; i < 160; i += 1) {
    stars.push((randomSeed(i * 2.13) - 0.5) * 360, 8 + randomSeed(i * 8.7) * 34, -26 - randomSeed(i * 3.7) * 15);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  const starfield = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0x9cdbff, size: 0.11, transparent: true, opacity: 0.75, sizeAttenuation: true }));
  starfield.name = 'starfield';
  scene.add(starfield);

  const farCity = new THREE.Group();
  for (let i = -36; i < 44; i += 1) {
    const height = 2.2 + randomSeed(i * 4.3) * 8.5;
    const width = 1.4 + randomSeed(i * 5.7) * 2.3;
    const building = box(width, height, 1.4, new THREE.MeshStandardMaterial({ color: 0x0b1833, emissive: 0x0a1f3c, emissiveIntensity: 0.8, roughness: 1 }), i * 5.4, height / 2 - 2.2, -17);
    farCity.add(building);
    if (i % 2 === 0) {
      const beacon = box(0.06, 0.42, 0.04, MATERIALS.cyan, i * 5.4 + width * 0.23, height - 1.95, -16.15);
      beacon.material = beacon.material.clone();
      beacon.material.emissiveIntensity = 1.6 + randomSeed(i) * 1.6;
      farCity.add(beacon);
    }
  }
  scene.add(farCity);

  const midCrystals = new THREE.Group();
  for (let i = -24; i < 36; i += 1) {
    if (i % 3 === 0) {
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.38 + randomSeed(i) * .3, 2.3 + randomSeed(i * 2) * 2.7, 5), MATERIALS.violet);
      crystal.position.set(i * 7.2, 0.3 + randomSeed(i * 9) * 2.2, -10);
      crystal.rotation.z = (randomSeed(i * 1.7) - .5) * .35;
      crystal.material = crystal.material.clone();
      crystal.material.opacity = .25 + randomSeed(i * 2.3) * .25;
      crystal.material.transparent = true;
      midCrystals.add(crystal);
    }
  }
  scene.add(midCrystals);
  return { starfield, farCity, midCrystals };
}

const backdrop = createBackdrop();

const particleGeometry = GEOMETRIES.spark;
const particleMaterials = [
  new THREE.MeshBasicMaterial({ color: 0x58e7ff, transparent: true }),
  new THREE.MeshBasicMaterial({ color: 0xffc654, transparent: true }),
  new THREE.MeshBasicMaterial({ color: 0xff6a78, transparent: true }),
  new THREE.MeshBasicMaterial({ color: 0x7bf6c4, transparent: true }),
  new THREE.MeshBasicMaterial({ color: 0xff82d7, transparent: true }),
];
const particlePool = Array.from({ length: 320 }, (_, index) => {
  const mesh = new THREE.Mesh(particleGeometry, particleMaterials[index % particleMaterials.length]);
  mesh.visible = false;
  particleRoot.add(mesh);
  return { mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 0, gravity: 0, spin: 0 };
});

function emitParticles(position, colorIndex = 0, amount = 8, force = 3, gravity = -5) {
  let created = 0;
  for (const particle of particlePool) {
    if (particle.life > 0) continue;
    particle.mesh.visible = true;
    particle.mesh.material = particleMaterials[colorIndex % particleMaterials.length];
    particle.mesh.position.copy(position);
    const angle = Math.random() * TAU;
    const lift = Math.random() * 1.4 + .2;
    particle.velocity.set(Math.cos(angle) * force * (0.45 + Math.random()), lift * force * .55, Math.sin(angle) * force * .22);
    particle.life = particle.maxLife = .34 + Math.random() * .52;
    particle.gravity = gravity;
    particle.mesh.scale.setScalar(.55 + Math.random() * .8);
    created += 1;
    if (created >= amount) break;
  }
}

function updateParticles(dt) {
  for (const particle of particlePool) {
    if (particle.life <= 0) continue;
    particle.life -= dt;
    if (particle.life <= 0) {
      particle.mesh.visible = false;
      continue;
    }
    particle.velocity.y += particle.gravity * dt;
    particle.mesh.position.addScaledVector(particle.velocity, dt);
    const fade = clamp(particle.life / particle.maxLife, 0, 1);
    particle.mesh.material.opacity = fade;
    particle.mesh.rotation.x += dt * 5;
    particle.mesh.rotation.y += dt * 7;
  }
}

let audioContext = null;
function ensureAudio() {
  if (game.muted) return;
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
}

function tone(frequency, duration = .08, type = 'sine', volume = .035, slide = 0) {
  if (game.muted) return;
  ensureAudio();
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency + slide), audioContext.currentTime + duration);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + .008);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + .02);
}

function sfx(name) {
  switch (name) {
    case 'jump': tone(460, .11, 'triangle', .045, 170); break;
    case 'double': tone(690, .13, 'triangle', .05, 250); break;
    case 'coin': tone(920, .065, 'sine', .034, 240); break;
    case 'power': tone(250, .16, 'sawtooth', .035, 430); break;
    case 'dash': tone(180, .3, 'sawtooth', .035, 720); break;
    case 'hit': tone(120, .28, 'square', .055, -55); break;
    case 'stomp': tone(210, .12, 'square', .04, -70); break;
    case 'bonus': tone(340, .16, 'triangle', .05, 360); setTimeout(() => tone(680, .18, 'triangle', .045, 380), 75); break;
    case 'finish': tone(480, .18, 'triangle', .05, 260); setTimeout(() => tone(720, .25, 'triangle', .04, 300), 110); break;
    default: break;
  }
}

function addGround(seg, x, length, theme, topY = 0, z = 0, depth = 4) {
  const groundMaterial = new THREE.MeshStandardMaterial({ color: theme.ground, emissive: theme.ground, emissiveIntensity: .27, roughness: .74, metalness: .22 });
  const ground = box(length, .5, depth, groundMaterial, x + length / 2, topY - .25, z);
  seg.group.add(ground);
  const lipMaterial = new THREE.MeshStandardMaterial({ color: theme.edge, emissive: theme.edge, emissiveIntensity: 2.3, metalness: .3, roughness: .25 });
  const lip = box(length, .075, .14, lipMaterial, x + length / 2, topY + .035, -1.88);
  seg.group.add(lip);
  seg.platforms.push({ min: x, max: x + length, topY });
  for (let line = 0; line < 3; line += 1) {
    const rail = box(length, .018, .035, lipMaterial, x + length / 2, topY + .04 + line * .09, 1.1 + line * .42);
    rail.material = rail.material.clone();
    rail.material.opacity = .18 - line * .035;
    rail.material.transparent = true;
    seg.group.add(rail);
  }
}

function addSegmentDeco(seg, theme, index) {
  const decoMaterial = new THREE.MeshStandardMaterial({ color: theme.deco, emissive: theme.deco, emissiveIntensity: 1.35, metalness: .2, roughness: .3 });
  for (let i = 0; i < 3; i += 1) {
    const x = seg.start + 2 + i * 5.7;
    const pole = new THREE.Group();
    pole.add(box(.08, 3.2 + randomSeed(index * 5 + i) * 2.1, .08, decoMaterial, 0, 1.4, -1.9));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.12, 6, 6), decoMaterial);
    cap.position.set(0, 3.1 + randomSeed(index * 8 + i) * 2.1, -1.9);
    pole.add(cap);
    seg.group.add(pole);
  }
  if (seg.themeIndex === 3) {
    const tunnelRoof = box(18, .22, 4.2, new THREE.MeshStandardMaterial({ color: 0x071c2b, emissive: 0x0d4851, emissiveIntensity: .8, roughness: .9 }), seg.start + 9, 7.15, 0);
    seg.group.add(tunnelRoof);
    for (let i = 0; i < 3; i += 1) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(3.75, .055, 6, 22, Math.PI), decoMaterial);
      rib.rotation.z = Math.PI;
      rib.position.set(seg.start + 3 + i * 6, 3.55, -1.2);
      rib.scale.x = .88;
      seg.group.add(rib);
    }
  } else if (seg.themeIndex === 2) {
    for (let i = 0; i < 3; i += 1) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(.35 + i * .12, 1.8 + i * .4, 5), decoMaterial);
      shard.position.set(seg.start + 4 + i * 5.8, .85 + i * .15, -1.3);
      shard.rotation.z = (i - 1) * .22;
      seg.group.add(shard);
    }
  }
  if (index % 4 === 1) {
    const label = createCanvasLabel(THEMES[index % THEMES.length].name, `#${new THREE.Color(theme.edge).getHexString()}`);
    label.position.set(seg.start + 9, 5.25, -2.35);
    label.scale.multiplyScalar(.72);
    seg.group.add(label);
  }
  if (index % 5 === 3) {
    const arch = new THREE.Group();
    arch.add(new THREE.Mesh(new THREE.TorusGeometry(2.3, .035, 6, 28, Math.PI), decoMaterial));
    arch.children[0].rotation.z = Math.PI;
    arch.position.set(seg.start + 9, .05, -1.5);
    seg.group.add(arch);
  }
}

function createCoinMesh(material = MATERIALS.coin) {
  const coin = new THREE.Mesh(GEOMETRIES.coin, material);
  coin.rotation.x = Math.PI / 2;
  coin.castShadow = false;
  return coin;
}

function spawnWorldEntity(seg, data) {
  const entity = { ...data, segment: seg, active: true, baseY: data.y ?? 0, phase: (data.x || 0) * .17 };
  if (entity.mesh) {
    entity.mesh.position.set(entity.x, entity.y ?? 0, entity.z ?? 0);
    worldRoot.add(entity.mesh);
    seg.entities.push(entity);
  }
  game.activeEntities.push(entity);
  return entity;
}

function addCoin(seg, x, y = 1.4, scale = 1) {
  const mesh = createCoinMesh();
  mesh.scale.setScalar(scale);
  return spawnWorldEntity(seg, { kind: 'coin', mesh, x, y, z: .1, radius: .7 });
}

function addCoinLine(seg, x, count, step = 1.45, y = 1.4, scale = 1) {
  for (let i = 0; i < count; i += 1) addCoin(seg, x + i * step, y, scale);
}

function addCoinArc(seg, x, count = 7, step = 1.25, height = 1.1) {
  for (let i = 0; i < count; i += 1) {
    const ratio = i / Math.max(1, count - 1);
    addCoin(seg, x + i * step, 1.15 + Math.sin(ratio * Math.PI) * height);
  }
}

function createCrate(theme, tall = false) {
  const group = new THREE.Group();
  const height = tall ? 1.46 : 1.08;
  const main = box(.95, height, 1.08, new THREE.MeshStandardMaterial({ color: 0x26375a, emissive: 0x101a3e, emissiveIntensity: .75, roughness: .46, metalness: .42 }), 0, height / 2, 0);
  group.add(main);
  const stripe = box(.11, height + .04, 1.12, new THREE.MeshStandardMaterial({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 1.45, roughness: .3 }), -.26, height / 2, -.02);
  group.add(stripe);
  group.add(box(.11, height + .04, 1.12, stripe.material, .26, height / 2, -.02));
  group.add(box(.98, .07, 1.14, stripe.material, 0, .14, -.03));
  group.add(box(.98, .07, 1.14, stripe.material, 0, height - .14, -.03));
  return group;
}

function createSpike(theme) {
  const group = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.62, 1.45, 4), MATERIALS.coral);
  cone.position.y = .72;
  cone.rotation.y = Math.PI / 4;
  group.add(cone);
  const base = box(1.25, .16, 1.15, new THREE.MeshStandardMaterial({ color: 0x321d46, emissive: 0x24112e, emissiveIntensity: .8 }), 0, .08, 0);
  group.add(base);
  const light = box(.78, .055, .04, new THREE.MeshStandardMaterial({ color: theme.edge, emissive: theme.edge, emissiveIntensity: 2.4 }), 0, .16, -.59);
  group.add(light);
  return group;
}

function createEnemy(theme, variant = 0) {
  const group = new THREE.Group();
  const bodyMat = variant ? MATERIALS.violet : MATERIALS.coral;
  const body = new THREE.Mesh(new THREE.SphereGeometry(.62, 10, 7), bodyMat);
  body.scale.set(1.12, .76, .86);
  body.position.y = .73;
  group.add(body);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.115, 6, 5), MATERIALS.coin);
  eye.position.set(-.22, .88, -.5);
  group.add(eye);
  const secondEye = eye.clone();
  secondEye.position.set(.22, .88, -.5);
  group.add(secondEye);
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x17294b, emissive: 0x0b183b, emissiveIntensity: .8, roughness: .4, metalness: .4 });
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.07, .11, .75, 6), legMaterial);
    leg.position.set(side * .47, .32, .05);
    leg.rotation.z = side * .55;
    group.add(leg);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .55, 5), MATERIALS.white);
  antenna.position.set(0, 1.35, 0);
  group.add(antenna);
  const antennaLight = new THREE.Mesh(new THREE.SphereGeometry(.08, 5, 5), MATERIALS.coin);
  antennaLight.position.set(0, 1.65, 0);
  group.add(antennaLight);
  return group;
}

function createOverheadGate(theme) {
  const group = new THREE.Group();
  const gateMaterial = new THREE.MeshStandardMaterial({ color: 0x14294a, emissive: 0x0d2452, emissiveIntensity: .8, metalness: .5, roughness: .28 });
  group.add(box(.2, 2.7, .32, gateMaterial, -.78, 1.35, 0));
  group.add(box(.2, 2.7, .32, gateMaterial, .78, 1.35, 0));
  const barMaterial = new THREE.MeshStandardMaterial({ color: theme.edge, emissive: theme.edge, emissiveIntensity: 2.4, metalness: .2, roughness: .2 });
  group.add(box(1.8, .52, .5, barMaterial, 0, 2.08, 0));
  group.add(box(1.2, .04, .52, MATERIALS.coral, 0, 1.83, -.02));
  const warning = new THREE.Mesh(new THREE.TorusGeometry(.24, .035, 5, 18), MATERIALS.coin);
  warning.rotation.x = Math.PI / 2;
  warning.position.set(0, 2.09, -.28);
  group.add(warning);
  return group;
}

function createPowerup(type) {
  const group = new THREE.Group();
  const colors = { shield: MATERIALS.mint, magnet: MATERIALS.coin, energy: MATERIALS.violet };
  const material = colors[type] || MATERIALS.mint;
  const core = type === 'shield'
    ? new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 1), material)
    : type === 'magnet'
      ? new THREE.Mesh(new THREE.TorusGeometry(.33, .11, 8, 16, Math.PI * 1.55), material)
      : new THREE.Mesh(new THREE.OctahedronGeometry(.4, 1), material);
  core.rotation.z = .25;
  group.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.58, .025, 5, 24), material);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  return group;
}

function addObstacle(seg, kind, x, options = {}) {
  const theme = THEMES[seg.themeIndex];
  let mesh;
  let width = options.width || 1.05;
  let height = options.height || 1;
  let minY = 0;
  let stompable = false;
  if (kind === 'enemy') {
    mesh = createEnemy(theme, options.variant);
    width = 1.25;
    height = 1.75;
    stompable = true;
  } else if (kind === 'gate') {
    mesh = createOverheadGate(theme);
    width = 1.7;
    height = .62;
    minY = 1.78;
  } else if (kind === 'spike') {
    mesh = createSpike(theme);
    width = 1.25;
    height = 1.45;
  } else {
    const tall = options.tall || false;
    mesh = createCrate(theme, tall);
    width = 1.1;
    height = tall ? 1.5 : 1.1;
  }
  mesh.position.set(x, 0, options.z || 0);
  worldRoot.add(mesh);
  const entity = { kind: 'obstacle', obstacleType: kind, mesh, x, y: minY, width, height, stompable, segment: seg, active: true, phase: x * .22 };
  seg.entities.push(entity);
  game.activeEntities.push(entity);
  return entity;
}

function addPowerup(seg, x, type, y = 1.5) {
  const mesh = createPowerup(type);
  return spawnWorldEntity(seg, { kind: 'power', power: type, mesh, x, y, z: -.2, radius: .76 });
}

function addBonusGate(seg, x, type) {
  const group = new THREE.Group();
  const color = type === 'SUPER_REWARD' ? 0xff82d7 : 0x68f3ff;
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.4, metalness: .35, roughness: .2 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, .1, 8, 36), material);
  ring.rotation.y = Math.PI / 2;
  group.add(ring);
  group.add(new THREE.Mesh(new THREE.TorusGeometry(1.55, .035, 6, 28), material));
  const label = createCanvasLabel(type === 'SUPER_REWARD' ? 'SUPER REWARD' : 'HYPER TRAVEL', `#${new THREE.Color(color).getHexString()}`);
  label.position.set(0, 2.8, 0);
  label.scale.multiplyScalar(.6);
  group.add(label);
  group.position.set(x, 2.05, -0.6);
  worldRoot.add(group);
  const entity = { kind: 'bonus-gate', bonusType: type, mesh: group, x, y: 0, width: 3.3, height: 4.2, segment: seg, active: true, phase: x * .2 };
  seg.entities.push(entity);
  game.activeEntities.push(entity);
}

function generateSegment(index) {
  const start = game.worldCursor;
  const length = 18;
  const themeIndex = Math.floor(Math.max(0, index) / 4) % THEMES.length;
  const theme = THEMES[themeIndex];
  const seg = { index, start, end: start + length, group: new THREE.Group(), entities: [], platforms: [], themeIndex, removed: false };
  seg.group.name = `segment-${index}`;
  worldRoot.add(seg.group);

  const patterns = ['coins', 'crate', 'enemy', 'slide', 'mixed', 'gap', 'stairs', 'coins'];
  // Give the runner a readable runway before the first real decision point.
  const pattern = index < 4 ? 'coins' : patterns[Math.floor(randomSeed(index * 7.31 + game.seed) * patterns.length)];
  if (pattern === 'gap') {
    addGround(seg, start, 5.8, theme);
    addGround(seg, start + 10.4, length - 10.4, theme);
    for (let i = 0; i < 5; i += 1) addCoin(seg, start + 5.2 + i * 1.05, 1.75 + Math.sin(i / 4 * Math.PI) * .8, .92);
    const warningMat = new THREE.MeshStandardMaterial({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 1.8 });
    for (let i = 0; i < 4; i += 1) seg.group.add(box(.18, .08, 2.6, warningMat, start + 6.1 + i * 1, -.02, 0));
  } else {
    addGround(seg, start, length, theme);
  }

  addSegmentDeco(seg, theme, index);
  if (pattern === 'coins') {
    addCoinLine(seg, start + 3.1, 7, 1.48, 1.35 + (index % 2) * .25);
    if (index % 4 === 0) addPowerup(seg, start + 12.4, index % 8 === 0 ? 'shield' : 'magnet', 1.6);
  }
  if (pattern === 'crate') {
    addObstacle(seg, 'crate', start + 8.1, { tall: index % 2 === 0 });
    addCoinArc(seg, start + 5.3, 7, 1.1, 1.5);
    if (index % 3 === 0) addPowerup(seg, start + 13.7, 'shield', 1.5);
  }
  if (pattern === 'enemy') {
    addCoinLine(seg, start + 2.4, 4, 1.3, 1.55);
    addObstacle(seg, 'enemy', start + 8.2, { variant: index % 2 });
    addCoinArc(seg, start + 9.8, 6, 1.08, 1.2);
  }
  if (pattern === 'slide') {
    addObstacle(seg, 'gate', start + 8.7);
    addCoinLine(seg, start + 5.1, 6, 1.17, 1.08, .9);
    if (index % 2) addPowerup(seg, start + 13.2, 'magnet', 1.45);
  }
  if (pattern === 'mixed') {
    addObstacle(seg, 'spike', start + 5.4);
    addObstacle(seg, 'enemy', start + 11.6, { variant: 1 });
    addCoinLine(seg, start + 2.2, 3, 1.25, 1.35);
    addCoinArc(seg, start + 7.2, 6, 1.08, 1.7);
  }
  if (pattern === 'stairs') {
    for (let i = 0; i < 3; i += 1) {
      const step = box(2.6, .33 + i * .24, 3.4, new THREE.MeshStandardMaterial({ color: theme.ground, emissive: theme.ground, emissiveIntensity: .4, roughness: .7 }), start + 4.5 + i * 3.1, .17 + i * .12, .25);
      seg.group.add(step);
      const edge = box(2.2, .065, .1, new THREE.MeshStandardMaterial({ color: theme.edge, emissive: theme.edge, emissiveIntensity: 2 }), start + 4.5 + i * 3.1, .35 + i * .24, -1.56);
      seg.group.add(edge);
    }
    addCoinLine(seg, start + 3, 7, 1.28, 2.05);
    addObstacle(seg, 'spike', start + 14.2);
  }

  for (const scheduled of bonusSchedule) {
    if (scheduled.x >= start && scheduled.x < start + length) addBonusGate(seg, scheduled.x, scheduled.type);
  }

  game.segments.push(seg);
  game.worldCursor += length;
  game.segmentIndex += 1;
  return seg;
}

function resetWorld() {
  clearGroup(worldRoot);
  game.segments.length = 0;
  game.activeEntities.length = 0;
  game.worldCursor = -42;
  game.segmentIndex = 0;
  while (game.worldCursor < 190) generateSegment(game.segmentIndex);
  worldRoot.add(player.group);
  player.group.position.set(0, 0, 0);
  player.x = 0;
}

function removeOldSegments() {
  while (game.segments.length && player.group.position.x - game.segments[0].end > 70) {
    const segment = game.segments.shift();
    segment.removed = true;
    worldRoot.remove(segment.group);
    for (const entity of segment.entities) {
      entity.active = false;
      if (entity.mesh) worldRoot.remove(entity.mesh);
    }
  }
  if (game.activeEntities.length > 500) game.activeEntities = game.activeEntities.filter((entity) => entity.active && !entity.segment.removed);
}

function updateWorld(dt) {
  while (game.worldCursor < player.group.position.x + 190) generateSegment(game.segmentIndex);
  removeOldSegments();
  for (const entity of game.activeEntities) {
    if (!entity.active || entity.segment.removed || !entity.mesh) continue;
    if (entity.kind === 'coin') {
      entity.mesh.rotation.y += dt * 5.6;
      entity.mesh.rotation.z += dt * 1.3;
      entity.mesh.position.y = entity.baseY + Math.sin(game.time * 4.2 + entity.phase) * .06;
    } else if (entity.kind === 'power') {
      entity.mesh.rotation.y += dt * 1.8;
      entity.mesh.rotation.x += dt * .9;
      entity.mesh.position.y = entity.baseY + Math.sin(game.time * 3.4 + entity.phase) * .12;
    } else if (entity.kind === 'enemy') {
      entity.mesh.position.y = Math.sin(game.time * 3 + entity.phase) * .05;
    } else if (entity.kind === 'bonus-gate') {
      entity.mesh.rotation.y += dt * 1.2;
      entity.mesh.position.y = 2.05 + Math.sin(game.time * 2.8 + entity.phase) * .09;
    }
  }
}

function groundAt(x) {
  let ground = -Infinity;
  for (const segment of game.segments) {
    if (x < segment.start - .1 || x > segment.end + .1) continue;
    for (const platform of segment.platforms) {
      if (x >= platform.min - .05 && x <= platform.max + .05) ground = Math.max(ground, platform.topY);
    }
  }
  return ground;
}

function currentSpeed() {
  const ramp = Math.min(game.distance / 420, .42);
  const mount = game.mountEnabled ? .1 : 0;
  const dash = game.dash > 0 ? .88 : 0;
  return (9.8 + ramp * 6.2) * (1 + mount + dash);
}

function currentMultiplier() {
  if (game.mode === 'SUPER_REWARD') return 3;
  if (game.mode === 'TRAVEL') return 2;
  return 1;
}

function playerHeight() {
  return input.crouch ? 1.45 : 2.62;
}

function updateVertical(dt, groundY) {
  player.previousY = player.group.position.y;
  if (groundY > -Infinity && player.group.position.y <= groundY + .04 && player.yVelocity <= 0) {
    player.group.position.y = groundY;
    if (!player.grounded && player.yVelocity < -4) emitParticles(new THREE.Vector3(player.group.position.x, groundY + .08, 0), 0, 5, 1.7, -2);
    player.yVelocity = 0;
    player.grounded = true;
    player.coyote = .1;
    player.jumpCount = 0;
  } else {
    player.grounded = false;
    player.coyote = Math.max(0, player.coyote - dt);
    player.yVelocity -= 29 * dt;
    player.group.position.y += player.yVelocity * dt;
  }
}

function jump() {
  if (game.state !== 'RUNNING') return;
  ensureAudio();
  if (player.grounded || player.coyote > 0) {
    player.yVelocity = 11.2;
    player.grounded = false;
    player.jumpCount = 1;
    sfx('jump');
    emitParticles(new THREE.Vector3(player.group.position.x, player.group.position.y + .08, 0), 0, 8, 2.5, -8);
  } else if (player.jumpCount < 2) {
    player.yVelocity = 10.2;
    player.jumpCount = 2;
    sfx('double');
    emitParticles(new THREE.Vector3(player.group.position.x, player.group.position.y + .7, 0), 3, 10, 2.1, -6);
  }
}

function playerWorldPosition(y = player.group.position.y + 1.25) {
  return new THREE.Vector3(player.group.position.x, y, player.group.position.z);
}

function collectCoin(entity) {
  if (!entity.active) return;
  entity.active = false;
  entity.mesh.visible = false;
  game.coins += 1;
  game.totalCoins += 1;
  const value = Math.round(48 * currentMultiplier() * (game.petEnabled ? 1.25 : 1));
  game.score += value;
  game.combo = clamp(game.combo + .25, 1, 8);
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  game.comboTimer = 2.2;
  sfx('coin');
  emitParticles(new THREE.Vector3(entity.x, entity.mesh.position.y, .1), 1, game.mode === 'SUPER_REWARD' ? 7 : 4, 1.7, -3);
}

function collectPower(entity) {
  if (!entity.active) return;
  entity.active = false;
  entity.mesh.visible = false;
  if (entity.power === 'shield') {
    game.shield = Math.max(game.shield, 11);
    showToast('护盾上线', 'good', '⬡');
  } else if (entity.power === 'magnet') {
    game.magnet = Math.max(game.magnet, 8);
    showToast('磁力牵引', 'good', '⌁');
  } else {
    game.dash = Math.max(game.dash, 4.5);
    showToast('能量爆发', 'good', '➤');
  }
  sfx('power');
  game.score += 180 * currentMultiplier();
  emitParticles(new THREE.Vector3(entity.x, entity.mesh.position.y, 0), 3, 14, 3.3, -4);
}

function handleCollision(entity) {
  if (!entity.active) return;
  const playerX = player.group.position.x;
  const playerMinX = playerX - .43;
  const playerMaxX = playerX + .43;
  const playerMinY = player.group.position.y + .03;
  const playerMaxY = player.group.position.y + playerHeight();
  const minX = entity.x - entity.width / 2;
  const maxX = entity.x + entity.width / 2;
  const minY = entity.y;
  const maxY = entity.y + entity.height;
  const overlaps = playerMaxX > minX && playerMinX < maxX && playerMaxY > minY && playerMinY < maxY;
  if (!overlaps) return;

  if (entity.stompable && player.yVelocity < -1 && player.previousY > maxY - .24 && player.group.position.y <= maxY + .34) {
    entity.active = false;
    entity.mesh.visible = false;
    player.yVelocity = 10.1;
    game.score += 220 * currentMultiplier();
    game.combo = clamp(game.combo + .5, 1, 8);
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    game.comboTimer = 2.4;
    sfx('stomp');
    emitParticles(new THREE.Vector3(entity.x, maxY, .05), 2, 14, 3.2, -7);
    showToast('踩踏 +220', 'good', '◆');
    return;
  }
  if (entity.kind === 'obstacle') crash(entity);
}

function crash(entity = null) {
  if (game.dash > 0) {
    if (entity) { entity.active = false; entity.mesh.visible = false; }
    game.score += 160;
    sfx('dash');
    emitParticles(playerWorldPosition(), 0, 14, 3.8, -4);
    showToast('冲刺穿透', 'good', '➤');
    return;
  }
  if (game.shield > 0) {
    game.shield = 0;
    if (entity) { entity.active = false; entity.mesh.visible = false; }
    sfx('hit');
    cameraShake(.32, .65);
    flashScreen();
    emitParticles(playerWorldPosition(), 3, 18, 3.6, -5);
    showToast('护盾抵挡冲击', 'good', '⬡');
    return;
  }
  finishDeath();
}

function checkWorldCollisions() {
  const px = player.group.position.x;
  for (const entity of game.activeEntities) {
    if (!entity.active || entity.segment.removed || Math.abs(entity.x - px) > 7) continue;
    if (entity.kind === 'coin') {
      const dx = entity.x - px;
      const dy = entity.mesh.position.y - (player.group.position.y + 1.25);
      const attractionRange = game.magnet > 0 ? 6.2 : game.petEnabled ? 2.6 : 0;
      if (attractionRange > 0 && Math.abs(dx) < attractionRange && Math.abs(dy) < 4.3) {
        const pull = clamp((attractionRange - Math.abs(dx)) / attractionRange, 0, 1);
        entity.x = lerp(entity.x, px, pull * .12);
        entity.mesh.position.x = entity.x;
      }
      if (Math.abs(entity.x - px) < .72 && Math.abs(dy) < 1.55) collectCoin(entity);
    } else if (entity.kind === 'power') {
      if (Math.abs(entity.x - px) < .8 && Math.abs(entity.mesh.position.y - (player.group.position.y + 1.15)) < 1.35) collectPower(entity);
    } else if (entity.kind === 'obstacle') {
      handleCollision(entity);
    }
  }
}

function tryBonusTrigger() {
  const next = bonusSchedule[game.scheduleIndex];
  if (!next || player.group.position.x < next.x) return;
  game.scheduleIndex += 1;
  enterBonus(next.type);
}

function updateRun(dt) {
  const speed = currentSpeed();
  player.x += speed * dt;
  player.group.position.x = player.x;
  game.distance += speed * dt * 2.04;
  game.score += speed * dt * 7.2;
  updateVertical(dt, groundAt(player.x));
  updateWorld(dt);
  checkWorldCollisions();
  tryBonusTrigger();
  if (player.group.position.y < -4.5) finishDeath();
}

function makeBonusCoin(x, y, root, valueScale = 1) {
  const mesh = createCoinMesh();
  mesh.scale.setScalar(valueScale);
  mesh.position.set(x, y, .2);
  root.add(mesh);
  const entity = { kind: 'coin', mesh, x, baseY: y, y, active: true, phase: x * .5 };
  game.bonusEntities.push(entity);
  return entity;
}

function buildBonusTrack(type) {
  const root = type === 'SUPER_REWARD' ? superRoot : travelRoot;
  clearGroup(root);
  game.bonusEntities.length = 0;
  game.bonusDecor.length = 0;
  const palette = BONUS_PALETTES[type];
  const floorMaterial = new THREE.MeshStandardMaterial({ color: palette.ground, emissive: palette.ground, emissiveIntensity: .55, roughness: .5, metalness: .35 });
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: palette.edge, emissive: palette.edge, emissiveIntensity: 2.6, roughness: .19, metalness: .28 });
  const secondaryMaterial = new THREE.MeshStandardMaterial({ color: palette.deco, emissive: palette.deco, emissiveIntensity: 1.8, roughness: .25 });

  if (type === 'SUPER_REWARD') {
    for (let i = -4; i < 50; i += 1) {
      const x = i * 6.7;
      root.add(box(6.8, .42, 5.4, floorMaterial, x, -.22, 0));
      root.add(box(6.8, .08, .14, edgeMaterial, x, .04, -2.55));
      const stripe = box(6.8, .04, .045, secondaryMaterial, x, .15, .9);
      root.add(stripe);
      if (i % 2 === 0) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.15, .045, 7, 32), edgeMaterial);
        ring.rotation.y = Math.PI / 2;
        ring.position.set(x + 2.9, 3.7 + Math.sin(i) * .5, -1.4);
        root.add(ring);
        game.bonusDecor.push(ring);
      }
    }
    for (let i = 0; i < 44; i += 1) {
      const x = -7 + i * 2.35;
      const wave = Math.sin(i * .6) * .55;
      makeBonusCoin(x, 1.35 + wave, root, 1.08);
      if (i % 4 === 1) makeBonusCoin(x + .2, 2.35 + Math.cos(i) * .3, root, .8);
      if (i % 7 === 4) makeBonusCoin(x + .2, 3.3, root, .7);
    }
    for (let i = 0; i < 7; i += 1) {
      const comet = new THREE.Mesh(new THREE.SphereGeometry(.11, 6, 6), secondaryMaterial);
      comet.position.set(-4 + i * 13, 5.8 - (i % 3) * .7, -5.2);
      root.add(comet);
      game.bonusDecor.push(comet);
    }
    const label = createCanvasLabel('×3  COIN MULTIPLIER', '#ffd26a', 'rgba(31, 11, 61, .82)');
    label.position.set(5, 6.2, -2.3);
    root.add(label);
  } else {
    for (let i = -5; i < 42; i += 1) {
      const x = i * 8.5;
      root.add(box(8.5, .34, 5.2, floorMaterial, x, -.18, 0));
      root.add(box(8.5, .08, .16, edgeMaterial, x, .04, -2.48));
      for (let rail = 0; rail < 3; rail += 1) root.add(box(8.5, .035, .045, secondaryMaterial, x, .12 + rail * .12, .72 + rail * .45));
      const portal = new THREE.Mesh(new THREE.TorusGeometry(2.2 + (i % 2) * .4, .06, 6, 28), edgeMaterial);
      portal.rotation.y = Math.PI / 2;
      portal.position.set(x + 2.8, 3.25, -1.6);
      root.add(portal);
      game.bonusDecor.push(portal);
    }
    for (let i = 0; i < 38; i += 1) {
      const x = -7 + i * 2.65;
      const y = i % 5 === 0 ? 2.75 : 1.4 + Math.sin(i * .8) * .35;
      makeBonusCoin(x, y, root, i % 5 === 0 ? .82 : .98);
    }
    for (let i = 0; i < 90; i += 1) {
      const streak = box(.08 + randomSeed(i) * .16, .025, .025, secondaryMaterial, -35 + i * 3.4, 2.1 + randomSeed(i * 3) * 6.5, -4.2 - randomSeed(i * 2) * 7);
      root.add(streak);
      game.bonusDecor.push(streak);
    }
    const label = createCanvasLabel('HYPER SPEED  ×2', '#6af5ff', 'rgba(3, 25, 42, .84)');
    label.position.set(6, 6.2, -2.3);
    root.add(label);
  }
}

function enterBonus(type) {
  game.mode = type;
  game.bonusTimer = type === 'SUPER_REWARD' ? 12 : 9;
  game.bonusElapsed = 0;
  game.returnX = player.group.position.x;
  buildBonusTrack(type);
  normalRoot.visible = false;
  bonusRoot.visible = true;
  superRoot.visible = type === 'SUPER_REWARD';
  travelRoot.visible = type === 'TRAVEL';
  player.group.removeFromParent();
  (type === 'SUPER_REWARD' ? superRoot : travelRoot).add(player.group);
  player.group.position.set(-7, 0, 0);
  player.x = -7;
  player.yVelocity = 0;
  player.grounded = true;
  player.jumpCount = 0;
  applyPalette(BONUS_PALETTES[type]);
  game.shake = .55;
  game.shakeStrength = .2;
  sfx('bonus');
  flashScreen('cyan');
  const title = type === 'SUPER_REWARD' ? '超级奖励' : '穿越奖励';
  const subtitle = type === 'SUPER_REWARD' ? '金币倍率 ×3 · 限时 12 秒' : '高速穿越 · 得分倍率 ×2';
  showModeBanner(title, subtitle);
  showToast(type === 'SUPER_REWARD' ? '独立奖励场景已接入' : '特殊高速场景已接入', 'good', '◈');
}

function exitBonus() {
  const completed = game.mode;
  const exitX = game.returnX + 1.7;
  player.group.removeFromParent();
  worldRoot.add(player.group);
  normalRoot.visible = true;
  bonusRoot.visible = false;
  superRoot.visible = false;
  travelRoot.visible = false;
  game.mode = 'RUN';
  game.bonusTimer = 0;
  player.x = exitX;
  let ground = groundAt(exitX);
  let safeX = exitX;
  while (ground === -Infinity && safeX < exitX + 12) {
    safeX += .8;
    ground = groundAt(safeX);
  }
  player.x = safeX;
  player.group.position.set(player.x, Math.max(0, ground === -Infinity ? 0 : ground), 0);
  player.yVelocity = 0;
  player.grounded = true;
  game.dash = 0;
  // Reward scenes hand the player back a brief safety window so the first
  // obstacle after the gate is readable instead of feeling like a trap.
  game.shield = Math.max(game.shield, 2.8);
  applyPalette(THEMES[game.currentTheme]);
  sfx('finish');
  showToast(completed === 'SUPER_REWARD' ? '超级奖励结束 · 返回主赛道' : '穿越完成 · 速度保持', 'good', '↗');
  showModeBanner('返回主赛道', '奖励已结算 · 继续保持节奏', 1500);
}

function checkBonusCollisions() {
  for (const entity of game.bonusEntities) {
    if (!entity.active) continue;
    entity.mesh.rotation.y += .14;
    entity.mesh.rotation.z += .035;
    entity.mesh.position.y = entity.baseY + Math.sin(game.time * 4.8 + entity.phase) * .08;
    const dx = entity.x - player.group.position.x;
    const dy = entity.mesh.position.y - (player.group.position.y + 1.2);
    const range = game.magnet > 0 ? 6.5 : 1.1;
    if (Math.abs(dx) < range && Math.abs(dy) < 3.8 && game.magnet > 0) {
      entity.x = lerp(entity.x, player.group.position.x, .13);
      entity.mesh.position.x = entity.x;
    }
    if (Math.abs(entity.x - player.group.position.x) < .74 && Math.abs(dy) < 1.55) collectCoin(entity);
  }
}

function updateBonus(dt) {
  const speed = game.mode === 'SUPER_REWARD' ? 14.4 : 22.5;
  game.bonusElapsed += dt;
  game.bonusTimer -= dt;
  player.x += speed * dt;
  player.group.position.x = player.x;
  game.distance += speed * dt * 2.04;
  game.score += speed * dt * 10 * currentMultiplier();
  updateVertical(dt, 0);
  checkBonusCollisions();
  for (const decor of game.bonusDecor) {
    decor.rotation.z += dt * (game.mode === 'TRAVEL' ? 2.7 : .7);
    if (game.mode === 'TRAVEL') decor.position.x -= dt * 3.5;
  }
  if (game.bonusTimer <= 0 || player.x > 99) exitBonus();
}

function updateAvatar(dt) {
  const grounded = player.grounded;
  const running = game.state === 'RUNNING';
  const speed = game.mode === 'TRAVEL' ? 18 : currentSpeed();
  const cycleSpeed = grounded ? speed * .63 : 2.2;
  player.runCycle += dt * cycleSpeed;
  const stride = grounded ? Math.sin(player.runCycle) * .56 : .08;
  playerVisual.leftLeg.rotation.z = damp(playerVisual.leftLeg.rotation.z, stride, 18, dt);
  playerVisual.rightLeg.rotation.z = damp(playerVisual.rightLeg.rotation.z, -stride, 18, dt);
  playerVisual.leftArm.rotation.z = damp(playerVisual.leftArm.rotation.z, -stride * .63, 17, dt);
  playerVisual.rightArm.rotation.z = damp(playerVisual.rightArm.rotation.z, stride * .63, 17, dt);
  const targetScale = input.crouch ? .62 : 1;
  playerVisual.avatar.scale.y = damp(playerVisual.avatar.scale.y, targetScale, 17, dt);
  playerVisual.avatar.scale.x = damp(playerVisual.avatar.scale.x, input.crouch ? 1.08 : 1, 17, dt);
  playerVisual.avatar.rotation.z = damp(playerVisual.avatar.rotation.z, game.dash > 0 ? -.12 : 0, 12, dt);
  playerVisual.board.visible = game.mountEnabled;
  playerVisual.pet.visible = game.petEnabled;
  playerVisual.pet.position.y = 2.65 + Math.sin(game.time * 3.5) * .16;
  playerVisual.pet.position.x = -1.15 + Math.cos(game.time * 2.3) * .08;
  playerVisual.pet.rotation.y += dt * 1.8;
  playerVisual.board.position.y = .13 + Math.sin(game.time * 8) * .035;
  playerVisual.board.rotation.z = Math.sin(game.time * 4.2) * .035;
  playerVisual.shadow.scale.x = damp(playerVisual.shadow.scale.x, grounded ? (input.crouch ? 1.0 : 1.1) : .7, 10, dt);
  playerVisual.shadow.scale.y = damp(playerVisual.shadow.scale.y, grounded ? .58 : .35, 10, dt);
  playerVisual.shieldAura.visible = game.shield > 0;
  playerVisual.magnetAura.visible = game.magnet > 0;
  if (game.shield > 0) {
    playerVisual.shieldAura.rotation.y += dt * 1.2;
    playerVisual.shieldAura.rotation.z -= dt * .7;
  }
  if (game.magnet > 0) playerVisual.magnetAura.rotation.z += dt * 2;
  playerVisual.visorGlow.material.emissiveIntensity = game.dash > 0 ? 4.5 : 1.6;
  if (game.dash > 0 && running) {
    if (Math.floor(game.time * 20) % 2 === 0) emitParticles(playerWorldPosition(.9), 0, 1, 1.2, 0);
  }
}

function updatePowers(dt) {
  if (game.dash > 0) game.dash = Math.max(0, game.dash - dt);
  if (game.magnet > 0) game.magnet = Math.max(0, game.magnet - dt);
  if (game.shield > 0) game.shield = Math.max(0, game.shield - dt);
  if (game.dashCooldown > 0) game.dashCooldown = Math.max(0, game.dashCooldown - dt);
  if (game.magnetCooldown > 0) game.magnetCooldown = Math.max(0, game.magnetCooldown - dt);
  game.comboTimer -= dt;
  if (game.comboTimer <= 0) {
    game.comboTimer = 0;
    game.combo = damp(game.combo, 1, 2.5, dt);
  }
}

function activatePower(type) {
  if (game.state !== 'RUNNING') return;
  ensureAudio();
  if (type === 'dash' && game.dashCooldown <= 0) {
    game.dash = 4.2;
    game.dashCooldown = 11;
    sfx('dash');
    showToast('冲刺已启动', 'good', '➤');
    cameraShake(.22, .28);
  } else if (type === 'magnet' && game.magnetCooldown <= 0) {
    game.magnet = 6.5;
    game.magnetCooldown = 13;
    sfx('power');
    showToast('磁铁吸附中', 'good', '⌁');
  } else if (type === 'shield' && game.shield <= 0) {
    game.shield = 7;
    showToast('护盾展开', 'good', '⬡');
    sfx('power');
  }
}

function cameraShake(amount, strength) {
  game.shake = Math.max(game.shake, amount);
  game.shakeStrength = Math.max(game.shakeStrength, strength);
}

function flashScreen(color = 'red') {
  const flash = $('flash-layer');
  flash.style.background = color === 'cyan' ? 'rgba(88, 231, 255, .25)' : 'rgba(255, 93, 100, .32)';
  flash.classList.remove('flash');
  void flash.offsetWidth;
  flash.classList.add('flash');
}

function finishDeath() {
  if (game.state !== 'RUNNING') return;
  game.state = 'DEAD';
  input.crouch = false;
  sfx('hit');
  cameraShake(.75, .95);
  flashScreen();
  emitParticles(playerWorldPosition(), 2, 30, 4.4, -10);
  playerVisual.avatar.rotation.z = .4;
  player.yVelocity = 8;
  if (game.reviveAvailable) {
    $('revive-score').textContent = formatNumber(Math.floor(game.score));
    $('revive-best').textContent = formatNumber(Math.max(game.highScore, Math.floor(game.score)));
    showModal('revive-modal');
  } else {
    openResult();
  }
}

function revive() {
  if (game.state !== 'DEAD' || !game.reviveAvailable) return;
  game.reviveAvailable = false;
  hideModal('revive-modal');
  game.state = 'RUNNING';
  playerVisual.avatar.rotation.z = 0;
  player.yVelocity = 0;
  player.grounded = true;
  player.group.position.y = Math.max(0, groundAt(player.group.position.x));
  player.x += 4.5;
  player.group.position.x = player.x;
  game.shield = 4.5;
  game.dash = 0;
  emitParticles(playerWorldPosition(), 3, 24, 3.8, -5);
  showToast('复活成功 · 护盾 4.5 秒', 'good', '✦');
  sfx('bonus');
}

function openResult() {
  game.state = 'DEAD';
  hideModal('revive-modal');
  const score = Math.floor(game.score);
  const isRecord = score > game.highScore;
  if (isRecord) game.highScore = score;
  saveRecord();
  $('result-score').textContent = formatNumber(score);
  $('result-distance').textContent = `${Math.floor(game.distance)}m`;
  $('result-coins').textContent = formatNumber(game.coins);
  $('result-combo').textContent = `×${Math.max(1, Math.floor(game.bestCombo))}`;
  $('new-record').classList.toggle('visible', isRecord);
  $('result-title').textContent = isRecord ? '新纪录，漂亮。' : '跑得漂亮。';
  $('result-subtitle').textContent = isRecord ? '你的光轨已经写进本地记录。' : '下一次，把你的纪录再推远一点。';
  showModal('result-modal');
}

function startGame() {
  ensureAudio();
  hideAllModals();
  game.state = 'RUNNING';
  game.mode = 'RUN';
  game.time = 0;
  game.scheduleIndex = 0;
  game.score = 0;
  game.coins = 0;
  game.distance = 0;
  game.combo = 1;
  game.bestCombo = 1;
  game.reviveAvailable = true;
  game.dash = 0;
  game.dashCooldown = 0;
  game.magnet = 0;
  game.magnetCooldown = 0;
  game.shield = 0;
  game.shake = 0;
  game.currentTheme = 0;
  game.seed = Math.random() * 100000;
  $('terrain-value').textContent = THEMES[0].name;
  clearGroup(superRoot);
  clearGroup(travelRoot);
  bonusRoot.visible = false;
  normalRoot.visible = true;
  resetWorld();
  player.yVelocity = 0;
  player.grounded = true;
  player.jumpCount = 0;
  playerVisual.avatar.rotation.z = 0;
  applyPalette(THEMES[0]);
  $('game-hud').classList.add('visible');
  $('start-screen').classList.remove('visible');
  setTimeout(() => showToast('轨道已连接 · 出发', 'good', '✦'), 220);
  sfx('bonus');
}

function restartGame() {
  hideModal('result-modal');
  startGame();
}

function setMenu() {
  hideAllModals();
  game.state = 'MENU';
  game.mode = 'RUN';
  bonusRoot.visible = false;
  normalRoot.visible = true;
  $('game-hud').classList.remove('visible');
  $('start-screen').classList.add('visible');
  $('start-best-score').textContent = formatNumber(game.highScore);
  saveRecord();
}

function togglePause(force = null) {
  if (force === true && game.state !== 'RUNNING') return;
  if (force === false && game.state !== 'PAUSED') return;
  if (force === null && !['RUNNING', 'PAUSED'].includes(game.state)) return;
  const shouldPause = force === null ? game.state === 'RUNNING' : force;
  if (shouldPause) {
    game.state = 'PAUSED';
    showModal('pause-modal');
  } else {
    game.state = 'RUNNING';
    hideModal('pause-modal');
    ensureAudio();
  }
}

function showModal(id) { $(id).classList.add('visible'); }
function hideModal(id) { $(id).classList.remove('visible'); }
function hideAllModals() { for (const id of ['pause-modal', 'revive-modal', 'result-modal']) hideModal(id); }

let bannerTimer = null;
function showModeBanner(title, subtitle, duration = 2100) {
  $('mode-banner-title').textContent = title;
  $('mode-banner-subtitle').textContent = subtitle;
  const banner = $('mode-banner');
  banner.classList.remove('show');
  void banner.offsetWidth;
  banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => banner.classList.remove('show'), duration);
}

function showToast(message, kind = '', icon = '✦') {
  const toast = document.createElement('div');
  toast.className = `toast ${kind}`;
  toast.innerHTML = `<b>${icon}</b><span>${message}</span>`;
  $('toast-stack').appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function formatNumber(value) { return Math.max(0, Math.floor(value)).toLocaleString('en-US').padStart(6, '0'); }

function saveRecord() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ highScore: game.highScore, totalCoins: game.totalCoins, muted: game.muted }));
  } catch {
    // Local storage is optional; the run still works without it.
  }
}

function applyPalette(palette) {
  targetPalette.bg.setHex(palette.bg);
  targetPalette.fog.setHex(palette.fog);
  targetPalette.edge.setHex(palette.edge);
}

function updatePalette(dt) {
  scene.background.lerp(targetPalette.bg, 1 - Math.exp(-2.5 * dt));
  scene.fog.color.lerp(targetPalette.fog, 1 - Math.exp(-2.5 * dt));
  rimLight.color.lerp(targetPalette.edge, 1 - Math.exp(-2.8 * dt));
  backdrop.starfield.rotation.y += dt * .006;
  backdrop.starfield.position.x = camera.position.x * .08;
  backdrop.farCity.position.x = camera.position.x * .16;
  backdrop.midCrystals.position.x = camera.position.x * .28;
}

function updateTheme() {
  if (game.mode !== 'RUN') return;
  const themeIndex = Math.floor(Math.max(0, player.group.position.x) / 72) % THEMES.length;
  if (themeIndex === game.currentTheme) return;
  game.currentTheme = themeIndex;
  applyPalette(THEMES[themeIndex]);
  $('terrain-value').textContent = THEMES[themeIndex].name;
}

function updateCamera(dt) {
  const targetX = player.group.position.x + (game.mode === 'TRAVEL' ? 3.3 : 2.3);
  const targetY = clamp(5.25 + player.group.position.y * .13, 4.7, 6.2);
  const cameraFactor = game.mode === 'TRAVEL' ? 5.2 : 4.2;
  camera.position.x = damp(camera.position.x, targetX, cameraFactor, dt);
  camera.position.y = damp(camera.position.y, targetY, 3.2, dt);
  const targetZoom = game.mode === 'TRAVEL' ? .86 : game.mode === 'SUPER_REWARD' ? .94 : 1;
  camera.zoom = damp(camera.zoom, targetZoom, 3.5, dt);
  camera.updateProjectionMatrix();
  let shakeX = 0;
  let shakeY = 0;
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt);
    const amount = game.shakeStrength * game.shake * game.shake;
    shakeX = (Math.random() - .5) * amount;
    shakeY = (Math.random() - .5) * amount;
  }
  camera.lookAt(camera.position.x + shakeX, 3.5 + shakeY, 0);
}

function updateHUD(dt) {
  game.uiAccumulator += dt;
  if (game.uiAccumulator < .045) return;
  game.uiAccumulator = 0;
  $('score-value').textContent = formatNumber(game.score);
  $('distance-value').textContent = Math.floor(game.distance).toLocaleString('en-US');
  $('coin-value').textContent = game.coins.toLocaleString('en-US');
  $('speed-value').textContent = (game.mode === 'SUPER_REWARD' ? 1.45 : game.mode === 'TRAVEL' ? 2.25 : currentSpeed() / 9.8).toFixed(1);
  $('combo-value').textContent = `×${Math.max(1, Math.floor(game.combo))}`;
  $('combo-bar-fill').style.width = `${clamp((game.combo - 1) / 7 * 100 + 16, 16, 100)}%`;
  $('dash-cooldown').textContent = game.dash > 0 ? `${game.dash.toFixed(1)}s` : game.dashCooldown > 0 ? `${game.dashCooldown.toFixed(1)}s` : '就绪';
  $('magnet-cooldown').textContent = game.magnet > 0 ? `${game.magnet.toFixed(1)}s` : game.magnetCooldown > 0 ? `${game.magnetCooldown.toFixed(1)}s` : '就绪';
  $('shield-cooldown').textContent = game.shield > 0 ? `${game.shield.toFixed(1)}s` : '拾取';
  $('dash-button').disabled = game.dashCooldown > 0 || game.state !== 'RUNNING';
  $('magnet-button').disabled = game.magnetCooldown > 0 || game.state !== 'RUNNING';
  $('shield-button').disabled = game.shield > 0 || game.state !== 'RUNNING';
  const modeStatus = $('mode-status');
  modeStatus.classList.toggle('active', game.mode !== 'RUN');
  $('mode-label').textContent = game.mode === 'SUPER_REWARD' ? '超级奖励' : game.mode === 'TRAVEL' ? '穿越奖励' : '主赛道';
  $('mode-timer').textContent = game.mode === 'RUN' ? '' : `${Math.ceil(game.bonusTimer)}s`;
  if (game.mode === 'SUPER_REWARD') $('event-tip-text').textContent = '奖励场景 · 金币倍率 ×3';
  else if (game.mode === 'TRAVEL') $('event-tip-text').textContent = '高速穿越 · 得分倍率 ×2';
  else if (game.shield > 0) $('event-tip-text').textContent = '护盾在线 · 可以大胆一点';
  else if (game.magnet > 0) $('event-tip-text').textContent = '磁力牵引 · 星币不会漏';
  else $('event-tip-text').textContent = '前方轨道已接入 · 保持节奏';
}

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const viewHeight = 9;
  camera.top = viewHeight;
  camera.bottom = -4;
  camera.left = -viewHeight * aspect * .5;
  camera.right = viewHeight * aspect * .5;
  camera.updateProjectionMatrix();
}

function bindControls() {
  $('start-button').addEventListener('click', startGame);
  $('restart-button').addEventListener('click', restartGame);
  $('result-menu-button').addEventListener('click', setMenu);
  $('give-up-button').addEventListener('click', openResult);
  $('revive-button').addEventListener('click', revive);
  $('pause-button').addEventListener('click', () => togglePause());
  $('resume-button').addEventListener('click', () => togglePause(false));
  $('pause-menu-button').addEventListener('click', setMenu);
  $('sound-button').addEventListener('click', () => {
    game.muted = !game.muted;
    $('sound-button').textContent = game.muted ? '◌' : '◖';
    saveRecord();
    if (!game.muted) { ensureAudio(); tone(680, .08, 'sine', .03, 100); }
  });
  $('dash-button').addEventListener('click', () => activatePower('dash'));
  $('magnet-button').addEventListener('click', () => activatePower('magnet'));
  $('shield-button').addEventListener('click', () => activatePower('shield'));
  document.querySelectorAll('.loadout-card').forEach((card) => card.addEventListener('click', () => {
    const type = card.dataset.loadout;
    if (type === 'mount') game.mountEnabled = !game.mountEnabled;
    if (type === 'pet') game.petEnabled = !game.petEnabled;
    card.classList.toggle('selected', type === 'mount' ? game.mountEnabled : game.petEnabled);
  }));

  $('touch-jump').addEventListener('pointerdown', (event) => { event.preventDefault(); jump(); });
  const slideButton = $('touch-slide');
  const startSlide = (event) => { event.preventDefault(); input.crouch = true; };
  const stopSlide = (event) => { event.preventDefault(); input.crouch = false; };
  slideButton.addEventListener('pointerdown', startSlide);
  slideButton.addEventListener('pointerup', stopSlide);
  slideButton.addEventListener('pointercancel', stopSlide);
  slideButton.addEventListener('pointerleave', stopSlide);

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(event.code)) event.preventDefault();
    if ((event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') && !event.repeat) jump();
    if (event.code === 'ArrowDown' || event.code === 'KeyS') input.crouch = true;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') activatePower('dash');
    if (event.code === 'KeyE' && !event.repeat) activatePower('magnet');
    if (event.code === 'KeyQ' && !event.repeat) activatePower('shield');
    if (event.code === 'KeyP' || event.code === 'Escape') togglePause();
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'ArrowDown' || event.code === 'KeyS') input.crouch = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'RUNNING') togglePause(true);
  });
  window.addEventListener('resize', resize);
}

applyPalette(THEMES[0]);
resetWorld();
bindControls();
$('sound-button').textContent = game.muted ? '◌' : '◖';
$('start-best-score').textContent = formatNumber(game.highScore);

let lastTime = performance.now();
function frame(now) {
  const rawDt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  const dt = game.state === 'PAUSED' || game.state === 'DEAD' ? 0 : rawDt;
  game.time += rawDt;

  if (game.state === 'RUNNING') {
    updatePowers(dt);
    if (game.mode === 'RUN') updateRun(dt);
    else updateBonus(dt);
    updateAvatar(dt);
    updateTheme();
    updateHUD(dt);
  } else if (game.state === 'MENU') {
    updateAvatar(rawDt);
    updateHUD(0);
  }
  updateParticles(game.state === 'DEAD' ? rawDt * .35 : rawDt);
  updatePalette(rawDt);
  updateCamera(rawDt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
