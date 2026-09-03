import * as THREE from 'three';
import './style.css';

const ui = {
  app: document.querySelector('#app'),
  root: document.querySelector('#render-root'),
  hud: document.querySelector('#hud'),
  start: document.querySelector('#start-screen'),
  pause: document.querySelector('#pause-screen'),
  result: document.querySelector('#result-screen'),
  startButton: document.querySelector('#start-button'),
  resumeButton: document.querySelector('#resume-button'),
  restartPause: document.querySelector('#restart-from-pause'),
  restart: document.querySelector('#restart-button'),
  share: document.querySelector('#share-button'),
  score: document.querySelector('#score-value'),
  highScore: document.querySelector('#high-score'),
  combo: document.querySelector('#combo-value'),
  comboCaption: document.querySelector('#combo-caption'),
  distance: document.querySelector('#distance-value'),
  speed: document.querySelector('#speed-value'),
  mode: document.querySelector('#mode-name'),
  modeNote: document.querySelector('#mode-note'),
  event: document.querySelector('#event-text'),
  petMeter: document.querySelector('#pet-meter'),
  petStatus: document.querySelector('#pet-status'),
  skillMeter: document.querySelector('#skill-meter'),
  skillStatus: document.querySelector('#skill-status'),
  shield: document.querySelector('#chip-shield'),
  magnet: document.querySelector('#chip-magnet'),
  dash: document.querySelector('#chip-dash'),
  toast: document.querySelector('#toast'),
  resultTitle: document.querySelector('#result-title'),
  resultScore: document.querySelector('#result-score'),
  resultDistance: document.querySelector('#result-distance'),
  resultCoins: document.querySelector('#result-coins'),
  resultStyle: document.querySelector('#result-style'),
  resultNote: document.querySelector('#result-note'),
};

const PLAYER_X = -3.15;
const GROUND_Y = 0;
const GRAVITY = 29;
const MAX_PARTICLES = 370;
const UP = new THREE.Vector3(0, 1, 0);

const themes = {
  sky: {
    name: '暮空航道',
    note: 'SECTOR 01',
    message: '穿过星尘，寻找裂隙门',
    background: '#071322',
    fog: '#143451',
    ground: '#112943',
    rail: '#58d7ed',
    sky: '#2b6684',
    accent: '#ffc857',
    light: '#b7f5ff',
  },
  cavern: {
    name: '晶洞回廊',
    note: 'SECTOR 02',
    message: '晶柱会指向更安全的航线',
    background: '#140f2e',
    fog: '#33205a',
    ground: '#27194a',
    rail: '#df78ff',
    sky: '#632f80',
    accent: '#b7ff89',
    light: '#e9b7ff',
  },
  vault: {
    name: '超级星币金库',
    note: 'BONUS ×3',
    message: '限时拾取星币阵列 · 分数三倍',
    background: '#291807',
    fog: '#6d3e0b',
    ground: '#4a2607',
    rail: '#ffc857',
    sky: '#9b5114',
    accent: '#fff0a2',
    light: '#ffe4a0',
  },
  rift: {
    name: '穿越裂隙',
    note: 'HYPER DRIVE ×2',
    message: '高速穿越航道 · 触碰能量波纹',
    background: '#07142a',
    fog: '#0e486a',
    ground: '#071f36',
    rail: '#6bf3ff',
    sky: '#00a7c4',
    accent: '#ff77c6',
    light: '#a7ffff',
  },
};

const state = {
  status: 'ready',
  theme: 'sky',
  mode: 'normal',
  runTime: 0,
  distance: 0,
  score: 0,
  coins: 0,
  combo: 1,
  comboClock: 0,
  maxCombo: 1,
  baseSpeed: 8,
  currentSpeed: 8,
  skillCharge: 100,
  petEnergy: 100,
  shieldTimer: 0,
  magnetTimer: 0,
  dashTimer: 0,
  modeTimer: 0,
  invulnerable: 0,
  reviveAvailable: true,
  portalAt: 58,
  portalCycle: 0,
  nextSpawn: 12,
  shake: 0,
  flash: 0,
  lastEvent: '',
  highScore: 0,
  time: 0,
};

const input = {
  crouch: false,
};

let entities = [];
let particles = [];
let groundSegments = [];
let parallax = [];
let riftRings = [];
let promptTimer = 0;
let lastTime = performance.now();
let generationSeed = 0xdecafbad;

function random() {
  generationSeed = (generationSeed * 1664525 + 1013904223) >>> 0;
  return generationSeed / 4294967296;
}

function range(min, max) {
  return min + (max - min) * random();
}

function pick(values) {
  return values[Math.floor(random() * values.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatScore(value) {
  return String(Math.floor(value)).padStart(6, '0');
}

function formatTime(value) {
  return Math.max(0, value).toFixed(1) + 's';
}

function loadHighScore() {
  try {
    return Number(localStorage.getItem('nova-stride-high-score')) || 0;
  } catch {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    localStorage.setItem('nova-stride-high-score', String(value));
  } catch {
    // Local storage can be disabled in privacy-restricted previews.
  }
}

state.highScore = loadHighScore();

class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.enabled = true;
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        this.enabled = false;
        return;
      }
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume();
  }

  tone(frequency, duration, options = {}) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.12, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  noise(duration = 0.1, volume = 0.08) {
    if (!this.context || !this.master) return;
    const size = Math.max(1, Math.ceil(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, size, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 920;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  jump() {
    this.tone(240, 0.18, { type: 'triangle', volume: 0.1, endFrequency: 550 });
  }

  coin() {
    this.tone(850, 0.08, { type: 'sine', volume: 0.055, endFrequency: 1280 });
  }

  pickup() {
    this.tone(320, 0.18, { type: 'sawtooth', volume: 0.06, endFrequency: 880 });
    this.tone(640, 0.24, { type: 'sine', volume: 0.045, endFrequency: 1340 });
  }

  hit() {
    this.tone(160, 0.42, { type: 'sawtooth', volume: 0.12, endFrequency: 50 });
    this.noise(0.18, 0.12);
  }

  dash() {
    this.tone(180, 0.34, { type: 'square', volume: 0.07, endFrequency: 780 });
  }

  portal() {
    this.tone(180, 0.6, { type: 'sine', volume: 0.1, endFrequency: 1360 });
    this.tone(360, 0.5, { type: 'triangle', volume: 0.07, endFrequency: 980 });
  }
}

const audio = new AudioEngine();

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
ui.root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(themes.sky.background);
scene.fog = new THREE.FogExp2(themes.sky.fog, 0.019);

const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.1, 180);
const cameraHome = new THREE.Vector3(8.4, 6.2, 14.5);
const cameraLook = new THREE.Vector3(-0.7, 2.1, 0);
camera.position.copy(cameraHome);
camera.lookAt(cameraLook);

const ambient = new THREE.HemisphereLight('#b9edff', '#101225', 2.25);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(themes.sky.light, 3.1);
keyLight.position.set(-6, 11, 8);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -18;
keyLight.shadow.camera.right = 18;
keyLight.shadow.camera.top = 15;
keyLight.shadow.camera.bottom = -8;
scene.add(keyLight);
const rimLight = new THREE.PointLight('#6bf3ff', 16, 26, 2);
rimLight.position.set(-3, 4.5, 3);
scene.add(rimLight);
const warmLight = new THREE.PointLight('#ffc857', 10, 35, 2);
warmLight.position.set(12, 7, -8);
scene.add(warmLight);

const world = new THREE.Group();
const backgroundLayer = new THREE.Group();
const terrainLayer = new THREE.Group();
const entityLayer = new THREE.Group();
const fxLayer = new THREE.Group();
const specialLayer = new THREE.Group();
scene.add(backgroundLayer, terrainLayer, entityLayer, fxLayer, specialLayer, world);

function material(color, emissive = color, emissiveIntensity = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness: 0.48,
    metalness: 0.2,
    ...extra,
  });
}

const materials = {
  ground: material(themes.sky.ground, '#07111f', 0.15),
  rail: material(themes.sky.rail, themes.sky.rail, 1.4),
  rock: material('#193653', '#061324', 0.18),
  rider: material('#dcefff', '#6cf1ff', 0.5),
  suit: material('#2753a6', '#0d214f', 0.25),
  visor: material('#f7d6ff', '#ff77c6', 1.35),
  luma: material('#6bf3ff', '#6bf3ff', 1.1),
  lumaDark: material('#163e69', '#0a2442', 0.3),
  orange: material('#ff6b35', '#ff451f', 1.25),
  gold: material('#ffc857', '#ffc857', 1.7),
  pink: material('#ff77c6', '#ff77c6', 1.4),
  mint: material('#9effb2', '#9effb2', 1.25),
  danger: material('#ff496c', '#ff1739', 1.2),
  enemy: material('#7a4bce', '#3b1878', 0.7),
  enemyEye: material('#fff7d6', '#ffc857', 1.8),
  transparentCyan: new THREE.MeshBasicMaterial({
    color: '#6bf3ff',
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
  transparentPink: new THREE.MeshBasicMaterial({
    color: '#ff77c6',
    transparent: true,
    opacity: 0.21,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
};

const geometries = {
  cube: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  lowSphere: new THREE.SphereGeometry(1, 10, 8),
  cone: new THREE.ConeGeometry(1, 1, 8),
  octa: new THREE.OctahedronGeometry(1, 0),
  tetra: new THREE.TetrahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.08, 8, 32),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
};

function mesh(geometry, mat, scale, position) {
  const result = new THREE.Mesh(geometry, mat);
  if (scale) result.scale.set(scale[0], scale[1], scale[2]);
  if (position) result.position.set(position[0], position[1], position[2]);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function addGlow(parent, color, scale, position) {
  const glow = new THREE.Mesh(
    geometries.sphere,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.scale.set(scale, scale, scale);
  glow.position.set(position[0], position[1], position[2]);
  parent.add(glow);
  return glow;
}

function createPlayer() {
  const root = new THREE.Group();
  root.position.set(PLAYER_X, GROUND_Y, 0);
  root.rotation.y = -0.04;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.32, 32),
    new THREE.MeshBasicMaterial({ color: '#020711', transparent: true, opacity: 0.45, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.026, 0);
  root.add(shadow);

  const mount = new THREE.Group();
  mount.position.y = 0.47;
  const lumaBody = mesh(geometries.lowSphere, materials.lumaDark, [1.25, 0.42, 0.74], [0, 0, 0]);
  lumaBody.rotation.z = -0.07;
  const lumaShell = mesh(geometries.lowSphere, materials.luma, [0.88, 0.26, 0.57], [0.08, 0.11, 0]);
  const lumaEye = mesh(geometries.sphere, materials.gold, [0.095, 0.095, 0.095], [0.78, 0.12, 0.38]);
  const lumaFinL = mesh(geometries.cone, materials.luma, [0.3, 0.56, 0.15], [-0.65, 0.02, 0.64]);
  const lumaFinR = lumaFinL.clone();
  lumaFinR.position.z = -0.64;
  const lumaTail = new THREE.Group();
  lumaTail.position.set(-1.12, 0.02, 0);
  const tailCore = mesh(geometries.cone, materials.luma, [0.31, 0.7, 0.31], [0, 0, 0]);
  tailCore.rotation.z = -Math.PI / 2;
  lumaTail.add(tailCore);
  mount.add(lumaBody, lumaShell, lumaEye, lumaFinL, lumaFinR, lumaTail);
  const mountGlow = addGlow(mount, '#6bf3ff', 1.05, [0, 0, 0]);
  mountGlow.scale.y = 0.4;
  root.add(mount);

  const rider = new THREE.Group();
  rider.position.set(-0.06, 0.92, 0);
  const torso = mesh(geometries.cube, materials.suit, [0.42, 0.58, 0.32], [0, 0.39, 0]);
  torso.rotation.z = -0.08;
  const belt = mesh(geometries.cube, materials.orange, [0.46, 0.07, 0.35], [0.02, 0.06, 0]);
  const head = mesh(geometries.sphere, materials.rider, [0.31, 0.34, 0.29], [0.09, 0.99, 0]);
  const visor = mesh(geometries.cube, materials.visor, [0.26, 0.09, 0.3], [0.17, 0.99, 0]);
  visor.rotation.z = -0.06;
  const crest = mesh(geometries.cone, materials.orange, [0.18, 0.37, 0.18], [-0.05, 1.33, 0]);
  crest.rotation.z = -0.25;

  const armL = new THREE.Group();
  armL.position.set(-0.38, 0.64, 0);
  const armLPart = mesh(geometries.cylinder, materials.rider, [0.1, 0.36, 0.1], [0, -0.26, 0]);
  armLPart.rotation.z = -0.32;
  armL.add(armLPart);
  const armR = new THREE.Group();
  armR.position.set(0.38, 0.64, 0);
  const armRPart = mesh(geometries.cylinder, materials.rider, [0.1, 0.36, 0.1], [0, -0.26, 0]);
  armRPart.rotation.z = 0.32;
  armR.add(armRPart);

  const legL = new THREE.Group();
  legL.position.set(-0.18, 0.1, 0.18);
  const legLPart = mesh(geometries.cylinder, materials.suit, [0.12, 0.43, 0.12], [0, -0.31, 0]);
  legLPart.rotation.z = -0.27;
  legL.add(legLPart);
  const legR = new THREE.Group();
  legR.position.set(0.17, 0.1, -0.18);
  const legRPart = mesh(geometries.cylinder, materials.suit, [0.12, 0.43, 0.12], [0, -0.31, 0]);
  legRPart.rotation.z = 0.27;
  legR.add(legRPart);

  rider.add(torso, belt, head, visor, crest, armL, armR, legL, legR);
  root.add(rider);

  const companion = new THREE.Group();
  companion.position.set(-1.25, 1.62, -0.6);
  const companionCore = mesh(geometries.octa, materials.pink, [0.22, 0.22, 0.22], [0, 0, 0]);
  const companionRing = mesh(geometries.torus, materials.gold, [0.39, 0.39, 0.39], [0, 0, 0]);
  companionRing.rotation.x = Math.PI / 2;
  const companionGlow = addGlow(companion, '#ff77c6', 0.5, [0, 0, 0]);
  companion.add(companionCore, companionRing, companionGlow);
  root.add(companion);

  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(1.55, 24, 16),
    new THREE.MeshBasicMaterial({
      color: '#7cf5ff',
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  shield.position.y = 1.1;
  shield.visible = false;
  root.add(shield);

  const aura = addGlow(root, '#ffad5e', 1.25, [-0.18, 1, 0]);
  aura.visible = false;

  world.add(root);
  return {
    root,
    mount,
    lumaTail,
    rider,
    armL,
    armR,
    legL,
    legR,
    companion,
    companionRing,
    shield,
    aura,
    shadow,
    y: 0,
    vy: 0,
    jumps: 0,
    crouching: false,
    bob: 0,
  };
}

const player = createPlayer();

function createBackground() {
  const starGeometry = new THREE.BufferGeometry();
  const points = [];
  const colors = [];
  for (let i = 0; i < 460; i += 1) {
    points.push(range(-70, 120), range(2, 34), range(-35, -8));
    const tint = random();
    colors.push(0.5 + tint * 0.5, 0.72 + tint * 0.28, 1);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      size: 0.11,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
  );
  backgroundLayer.add(stars);

  const moon = new THREE.Group();
  moon.position.set(27, 16, -16);
  const moonSphere = mesh(geometries.sphere, materials.gold, [3.8, 3.8, 3.8], [0, 0, 0]);
  moonSphere.castShadow = false;
  const moonGlow = addGlow(moon, '#ffc857', 5.8, [0, 0, 0]);
  moon.add(moonSphere, moonGlow);
  backgroundLayer.add(moon);

  for (let i = 0; i < 20; i += 1) {
    const cluster = new THREE.Group();
    cluster.position.set(range(-25, 115), range(1.8, 8), range(-21, -11));
    const count = 2 + Math.floor(random() * 3);
    for (let n = 0; n < count; n += 1) {
      const shape = mesh(
        geometries.cone,
        materials.rock,
        [range(0.5, 1.4), range(1.2, 4.8), range(0.5, 1.4)],
        [range(-1.5, 1.5), 0, range(-0.6, 0.6)],
      );
      shape.position.y = shape.scale.y * 0.5;
      cluster.add(shape);
    }
    backgroundLayer.add(cluster);
    parallax.push({ object: cluster, speed: range(0.09, 0.18), resetX: range(80, 118), y: cluster.position.y });
  }

  for (let i = 0; i < 12; i += 1) {
    const shard = new THREE.Group();
    shard.position.set(range(-30, 110), range(5, 17), range(-14, -8));
    const crystal = mesh(
      geometries.octa,
      i % 2 ? materials.luma : materials.pink,
      [range(0.22, 0.65), range(0.4, 1.5), range(0.22, 0.65)],
      [0, 0, 0],
    );
    shard.add(crystal, addGlow(shard, i % 2 ? '#6bf3ff' : '#ff77c6', 0.8, [0, 0, 0]));
    backgroundLayer.add(shard);
    parallax.push({ object: shard, speed: range(0.14, 0.28), resetX: range(90, 125), y: shard.position.y, spin: range(-0.4, 0.4) });
  }

  return { stars, moon, moonSphere, moonGlow };
}

const background = createBackground();

function createGround() {
  const segmentWidth = 9;
  for (let i = 0; i < 19; i += 1) {
    const group = new THREE.Group();
    const base = mesh(geometries.cube, materials.ground, [segmentWidth, 0.32, 3.7], [0, -0.17, 0]);
    const top = mesh(geometries.cube, materials.ground, [segmentWidth - 0.08, 0.08, 3.18], [0, 0.03, 0]);
    const railA = mesh(geometries.cube, materials.rail, [segmentWidth, 0.04, 0.045], [0, 0.12, -2.7]);
    const railB = railA.clone();
    railB.position.z = 2.7;
    group.add(base, top, railA, railB);

    const stones = new THREE.Group();
    for (let s = 0; s < 4; s += 1) {
      const stone = mesh(
        geometries.octa,
        materials.rock,
        [range(0.12, 0.3), range(0.1, 0.25), range(0.12, 0.3)],
        [range(-3.8, 3.8), 0.18, pick([-2.3, 2.3])],
      );
      stones.add(stone);
    }
    group.add(stones);
    group.position.x = -27 + i * segmentWidth;
    terrainLayer.add(group);
    groundSegments.push({ group, stones, width: segmentWidth });
  }
}

createGround();

function createSpecialArchitecture() {
  const vault = new THREE.Group();
  vault.visible = false;
  for (let i = 0; i < 11; i += 1) {
    const column = new THREE.Group();
    column.position.set(-15 + i * 11, 3.4, pick([-4.3, 4.3]));
    const pillar = mesh(geometries.cylinder, materials.gold, [0.42, 3.3, 0.42], [0, 0, 0]);
    const cap = mesh(geometries.octa, materials.orange, [0.75, 0.75, 0.75], [0, 3.18, 0]);
    column.add(pillar, cap, addGlow(column, '#ffc857', 1.2, [0, 3.15, 0]));
    vault.add(column);
  }
  specialLayer.add(vault);

  const rift = new THREE.Group();
  rift.visible = false;
  for (let i = 0; i < 13; i += 1) {
    const ringGroup = new THREE.Group();
    ringGroup.position.set(-5 + i * 10, 3.2, 0);
    const ring = mesh(geometries.torus, materials.luma, [2.8, 2.8, 2.8], [0, 0, 0]);
    ring.rotation.y = Math.PI / 2;
    const inner = mesh(geometries.torus, materials.pink, [1.9, 1.9, 1.9], [0, 0, 0]);
    inner.rotation.y = Math.PI / 2;
    ringGroup.add(ring, inner);
    rift.add(ringGroup);
    riftRings.push(ringGroup);
  }
  specialLayer.add(rift);
  return { vault, rift };
}

const specials = createSpecialArchitecture();

function makeParticle(position, color, velocity, scale = 0.08, life = 0.6) {
  if (particles.length >= MAX_PARTICLES) {
    const old = particles.shift();
    fxLayer.remove(old.mesh);
  }
  const particleMesh = new THREE.Mesh(
    geometries.tetra,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  particleMesh.position.copy(position);
  particleMesh.scale.setScalar(scale);
  particleMesh.rotation.set(range(0, Math.PI), range(0, Math.PI), range(0, Math.PI));
  fxLayer.add(particleMesh);
  particles.push({
    mesh: particleMesh,
    velocity,
    life,
    maxLife: life,
    spin: range(-8, 8),
  });
}

function burst(position, color, amount = 12, force = 2.5, scale = 0.09) {
  for (let i = 0; i < amount; i += 1) {
    const vector = new THREE.Vector3(range(-1, 1), range(-0.2, 1.2), range(-0.75, 0.75));
    vector.normalize().multiplyScalar(range(force * 0.4, force));
    makeParticle(position, color, vector, scale * range(0.65, 1.4), range(0.34, 0.9));
  }
}

function trail(position, color) {
  makeParticle(
    position,
    color,
    new THREE.Vector3(range(-2.6, -0.6), range(-0.15, 0.25), range(-0.3, 0.3)),
    range(0.06, 0.14),
    range(0.22, 0.44),
  );
}

function updateParticles(dt) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life -= dt;
    if (particle.life <= 0) {
      fxLayer.remove(particle.mesh);
      particles.splice(index, 1);
      continue;
    }
    particle.velocity.y -= 5 * dt;
    particle.mesh.position.addScaledVector(particle.velocity, dt);
    particle.mesh.rotation.x += particle.spin * dt;
    particle.mesh.rotation.y += particle.spin * 0.7 * dt;
    particle.mesh.material.opacity = particle.life / particle.maxLife;
  }
}

function createCoin(x, y, z = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const body = mesh(geometries.cylinder, materials.gold, [0.28, 0.08, 0.28], [0, 0, 0]);
  body.rotation.x = Math.PI / 2;
  const inset = mesh(geometries.torus, materials.orange, [0.18, 0.18, 0.18], [0, 0, 0.09]);
  inset.rotation.x = Math.PI / 2;
  group.add(body, inset, addGlow(group, '#ffc857', 0.38, [0, 0, 0]));
  entityLayer.add(group);
  entities.push({
    kind: 'coin',
    group,
    radius: 0.62,
    age: range(0, 6),
    bob: range(0, Math.PI * 2),
  });
}

function createSpike(x) {
  const group = new THREE.Group();
  group.position.set(x, 0.02, 0);
  const plate = mesh(geometries.cube, materials.danger, [1.24, 0.14, 1.25], [0, 0, 0]);
  group.add(plate);
  for (let i = 0; i < 4; i += 1) {
    const spike = mesh(geometries.cone, materials.orange, [0.28, 0.9, 0.28], [-0.48 + i * 0.32, 0.49, 0]);
    group.add(spike);
  }
  const glow = addGlow(group, '#ff496c', 1.1, [0, 0.3, 0]);
  group.add(glow);
  entityLayer.add(group);
  entities.push({
    kind: 'obstacle',
    group,
    halfX: 0.67,
    halfZ: 0.85,
    minY: 0,
    maxY: 1.2,
    color: '#ff496c',
    age: 0,
  });
}

function createArch(x) {
  const group = new THREE.Group();
  group.position.set(x, 0, 0);
  const left = mesh(geometries.cylinder, materials.enemy, [0.13, 1.45, 0.13], [-0.86, 1.45, 0]);
  const right = mesh(geometries.cylinder, materials.enemy, [0.13, 1.45, 0.13], [0.86, 1.45, 0]);
  const top = mesh(geometries.cube, materials.enemy, [1.84, 0.38, 0.7], [0, 2.62, 0]);
  const scanner = mesh(geometries.cube, materials.pink, [1.58, 0.07, 0.56], [0, 2.36, 0]);
  group.add(left, right, top, scanner, addGlow(group, '#ff77c6', 0.9, [0, 2.42, 0]));
  entityLayer.add(group);
  entities.push({
    kind: 'arch',
    group,
    halfX: 0.98,
    halfZ: 0.8,
    minY: 1.48,
    maxY: 2.95,
    color: '#ff77c6',
    age: 0,
  });
}

function createEnemy(x) {
  const group = new THREE.Group();
  group.position.set(x, 0, 0);
  const body = mesh(geometries.lowSphere, materials.enemy, [0.73, 0.68, 0.6], [0, 0.67, 0]);
  const spike = mesh(geometries.cone, materials.pink, [0.34, 0.62, 0.34], [0, 1.3, 0]);
  const eyeL = mesh(geometries.sphere, materials.enemyEye, [0.12, 0.12, 0.09], [0.28, 0.78, 0.48]);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.28;
  group.add(body, spike, eyeL, eyeR, addGlow(group, '#9b75ff', 0.82, [0, 0.7, 0]));
  entityLayer.add(group);
  entities.push({
    kind: 'enemy',
    group,
    halfX: 0.68,
    halfZ: 0.76,
    minY: 0.05,
    maxY: 1.5,
    stompTop: 1.34,
    color: '#b592ff',
    age: range(0, Math.PI * 2),
  });
}

function createPickup(x, type, y = 1.16) {
  const group = new THREE.Group();
  group.position.set(x, y, 0);
  const config = {
    shield: { color: '#ff77c6', material: materials.pink, symbol: '◇' },
    magnet: { color: '#ffc857', material: materials.gold, symbol: '⌁' },
    dash: { color: '#ff6b35', material: materials.orange, symbol: '➜' },
  }[type];
  const shell = mesh(geometries.octa, config.material, [0.42, 0.42, 0.42], [0, 0, 0]);
  const ring = mesh(geometries.torus, config.material, [0.56, 0.56, 0.56], [0, 0, 0]);
  ring.rotation.x = Math.PI / 2;
  group.add(shell, ring, addGlow(group, config.color, 0.75, [0, 0, 0]));
  entityLayer.add(group);
  entities.push({
    kind: 'pickup',
    type,
    group,
    radius: 0.9,
    age: range(0, Math.PI * 2),
    color: config.color,
  });
}

function createPortal(x, type) {
  const group = new THREE.Group();
  group.position.set(x, 2.05, 0);
  const color = type === 'super' ? '#ffc857' : '#6bf3ff';
  const primary = type === 'super' ? materials.gold : materials.luma;
  const secondary = type === 'super' ? materials.orange : materials.pink;
  const ringA = mesh(geometries.torus, primary, [1.46, 1.46, 1.46], [0, 0, 0]);
  const ringB = mesh(geometries.torus, secondary, [1.12, 1.12, 1.12], [0, 0, 0]);
  const core = new THREE.Mesh(
    geometries.sphere,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  core.scale.set(0.86, 1.25, 0.28);
  ringA.rotation.y = Math.PI / 2;
  ringB.rotation.y = Math.PI / 2;
  group.add(core, ringA, ringB, addGlow(group, color, 2, [0, 0, 0]));
  entityLayer.add(group);
  entities.push({
    kind: 'portal',
    type,
    group,
    halfX: 0.82,
    halfZ: 1.16,
    minY: 0,
    maxY: 4.3,
    age: 0,
    color,
  });
}

function createRiftOrb(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const core = mesh(geometries.octa, materials.pink, [0.32, 0.32, 0.32], [0, 0, 0]);
  const orbit = mesh(geometries.torus, materials.luma, [0.47, 0.47, 0.47], [0, 0, 0]);
  orbit.rotation.y = Math.PI / 2;
  group.add(core, orbit, addGlow(group, '#6bf3ff', 0.66, [0, 0, 0]));
  entityLayer.add(group);
  entities.push({
    kind: 'riftOrb',
    group,
    radius: 0.75,
    age: range(0, Math.PI * 2),
    color: '#6bf3ff',
  });
}

function removeEntity(index, particleColor = null) {
  const entity = entities[index];
  if (!entity) return;
  if (particleColor) burst(entity.group.position, particleColor, 9, 2.6, 0.07);
  entityLayer.remove(entity.group);
  entities.splice(index, 1);
}

function clearEntities() {
  for (const entity of entities) entityLayer.remove(entity.group);
  entities = [];
}

function spawnCoinLine(startX, count, options = {}) {
  const spacing = options.spacing || 1.1;
  const baseY = options.baseY || 1.15;
  const arc = options.arc || 0;
  const z = options.z || 0;
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const y = baseY + Math.sin(t * Math.PI) * arc;
    createCoin(startX + i * spacing, y, z + Math.sin(i * 1.9) * 0.14);
  }
}

function generateNormal() {
  const horizon = 105;
  while (state.nextSpawn < horizon) {
    const projectedDistance = state.distance + state.nextSpawn - PLAYER_X;
    if (projectedDistance >= state.portalAt) {
      const portalType = state.portalCycle % 2 === 0 ? 'rift' : 'super';
      createPortal(state.nextSpawn + 2.8, portalType);
      spawnCoinLine(state.nextSpawn, 3, { baseY: 1.14, spacing: 0.84 });
      state.nextSpawn += 11;
      state.portalAt += range(95, 130);
      state.portalCycle += 1;
      continue;
    }

    if (state.distance < 24 && state.nextSpawn < 61) {
      spawnCoinLine(state.nextSpawn, 8, {
        baseY: 1.05 + (state.nextSpawn % 2) * 0.18,
        arc: 0.35,
        spacing: 0.86,
      });
      if (state.nextSpawn > 27 && state.nextSpawn < 42) createPickup(state.nextSpawn + 3.3, 'dash', 1.18);
      state.nextSpawn += 9.6;
      continue;
    }

    const roll = random();
    if (roll < 0.21) {
      createSpike(state.nextSpawn + 2.4);
      spawnCoinLine(state.nextSpawn, 5, { baseY: 1.17, arc: 1.75, spacing: 0.86 });
      state.nextSpawn += range(9.4, 11.6);
    } else if (roll < 0.38) {
      createArch(state.nextSpawn + 2.2);
      spawnCoinLine(state.nextSpawn - 0.1, 5, { baseY: 0.75, spacing: 0.88 });
      state.nextSpawn += range(9.4, 11.4);
    } else if (roll < 0.53) {
      createEnemy(state.nextSpawn + 2.2);
      spawnCoinLine(state.nextSpawn, 5, { baseY: 1.1, arc: 2.2, spacing: 0.94 });
      state.nextSpawn += range(9.8, 12);
    } else if (roll < 0.69) {
      const powerType = pick(['shield', 'magnet', 'dash']);
      createPickup(state.nextSpawn + 3, powerType, 1.2);
      spawnCoinLine(state.nextSpawn - 0.1, 7, { baseY: 1.15, arc: 0.4, spacing: 0.88 });
      state.nextSpawn += range(10.5, 13);
    } else {
      spawnCoinLine(state.nextSpawn, 8 + Math.floor(random() * 4), {
        baseY: range(0.9, 1.42),
        arc: range(0.15, 1.2),
        spacing: 0.82,
      });
      state.nextSpawn += range(9.5, 12.2);
    }
  }
}

function generateVault() {
  const horizon = 110;
  while (state.nextSpawn < horizon) {
    const pattern = Math.floor(random() * 3);
    if (pattern === 0) {
      for (let row = 0; row < 3; row += 1) {
        spawnCoinLine(state.nextSpawn, 8, { baseY: 0.82 + row * 0.62, spacing: 0.78, z: (row - 1) * 0.35 });
      }
    } else if (pattern === 1) {
      spawnCoinLine(state.nextSpawn, 12, { baseY: 1.02, arc: 3.2, spacing: 0.69 });
    } else {
      for (let i = 0; i < 11; i += 1) {
        createCoin(state.nextSpawn + i * 0.74, 1.1 + (i % 2) * 1.2, 0);
      }
    }
    state.nextSpawn += range(10, 13);
  }
}

function generateRift() {
  const horizon = 112;
  while (state.nextSpawn < horizon) {
    const roll = random();
    if (roll < 0.74) {
      for (let i = 0; i < 8; i += 1) {
        createRiftOrb(state.nextSpawn + i * 0.95, 0.9 + Math.sin(i * 0.9) * 1.15, Math.sin(i * 1.2) * 0.35);
      }
    } else {
      createPickup(state.nextSpawn + 3, pick(['dash', 'magnet']), 1.4);
      for (let i = 0; i < 6; i += 1) createRiftOrb(state.nextSpawn + i * 0.98, 1.08, 0);
    }
    state.nextSpawn += range(9.8, 12.3);
  }
}

function generateLevel() {
  if (state.mode === 'super') generateVault();
  else if (state.mode === 'rift') generateRift();
  else generateNormal();
}

function addScore(amount, styling = true) {
  const multiplier = state.mode === 'super' ? 3 : state.mode === 'rift' ? 2 : 1;
  const flow = styling ? state.combo : 1;
  state.score += Math.floor(amount * multiplier * flow);
}

function collectCoin(index, rift = false) {
  const entity = entities[index];
  if (!entity) return;
  state.coins += rift ? 2 : 1;
  state.combo = clamp(state.combo + (rift ? 0.075 : 0.04), 1, 9.9);
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboClock = 3.5;
  state.petEnergy = clamp(state.petEnergy + (rift ? 2.5 : 1.25), 0, 100);
  state.skillCharge = clamp(state.skillCharge + (rift ? 4.8 : 2.2), 0, 100);
  addScore(rift ? 46 : 20);
  audio.coin();
  burst(entity.group.position, rift ? '#6bf3ff' : '#ffc857', rift ? 8 : 5, 1.6, 0.055);
  removeEntity(index);
}

function activatePickup(index) {
  const entity = entities[index];
  if (!entity) return;
  if (entity.type === 'shield') {
    state.shieldTimer = Math.max(state.shieldTimer, 9);
    announce('棱镜护盾已展开');
  }
  if (entity.type === 'magnet') {
    state.magnetTimer = Math.max(state.magnetTimer, 10);
    announce('星币磁场已展开');
  }
  if (entity.type === 'dash') {
    state.petEnergy = clamp(state.petEnergy + 46, 0, 100);
    state.dashTimer = Math.max(state.dashTimer, 1.6);
    announce('推进晶体 · Luma 加速');
  }
  addScore(130);
  state.combo = clamp(state.combo + 0.45, 1, 9.9);
  audio.pickup();
  burst(entity.group.position, entity.color, 20, 4.2, 0.09);
  state.shake = Math.max(state.shake, 0.12);
  removeEntity(index);
}

function stompEnemy(index) {
  const entity = entities[index];
  if (!entity) return;
  player.vy = 10.2;
  player.jumps = 1;
  state.combo = clamp(state.combo + 0.75, 1, 9.9);
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboClock = 4.2;
  state.skillCharge = clamp(state.skillCharge + 14, 0, 100);
  state.petEnergy = clamp(state.petEnergy + 8, 0, 100);
  addScore(220);
  audio.tone(280, 0.16, { type: 'square', volume: 0.08, endFrequency: 740 });
  burst(entity.group.position, '#b592ff', 20, 4.7, 0.1);
  announce('完美践踏 · FLOW 上升');
  state.shake = 0.18;
  removeEntity(index);
}

function smashObstacle(index) {
  const entity = entities[index];
  if (!entity) return;
  addScore(95);
  state.combo = clamp(state.combo + 0.2, 1, 9.9);
  burst(entity.group.position, entity.color || '#ff6b35', 18, 4.2, 0.09);
  audio.noise(0.1, 0.05);
  removeEntity(index);
}

function playerHeight() {
  return player.crouching ? 1.35 : 2.28;
}

function overlapEntity(entity) {
  const dx = Math.abs(entity.group.position.x - PLAYER_X);
  const dz = Math.abs(entity.group.position.z);
  return dx < entity.halfX + 0.47 && dz < entity.halfZ + 0.56;
}

function hitPlayer() {
  if (state.invulnerable > 0 || state.status !== 'running') return;
  if (state.shieldTimer > 0) {
    state.shieldTimer = 0;
    state.invulnerable = 1.1;
    player.shield.visible = false;
    audio.pickup();
    announce('护盾碎裂 · 继续航行');
    burst(player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), '#ff77c6', 27, 5.2, 0.09);
    state.shake = 0.42;
    return;
  }
  knockOut();
}

function knockOut() {
  if (state.status !== 'running') return;
  audio.hit();
  state.status = 'revive';
  player.root.visible = false;
  state.shake = 0.85;
  state.flash = 0.8;
  burst(new THREE.Vector3(PLAYER_X, player.y + 1.2, 0), '#ff496c', 38, 6.5, 0.12);
  showResult(true);
}

function finishRun() {
  state.status = 'ended';
  player.root.visible = true;
  showResult(false);
}

function showResult(canRevive) {
  const finalScore = Math.floor(state.score);
  if (finalScore > state.highScore) {
    state.highScore = finalScore;
    saveHighScore(finalScore);
  }
  ui.resultTitle.textContent = canRevive ? '航线崩解' : '星轨落幕';
  ui.resultScore.textContent = formatScore(finalScore);
  ui.resultDistance.textContent = Math.floor(state.distance) + 'm';
  ui.resultCoins.textContent = String(state.coins);
  ui.resultStyle.textContent = 'x' + state.maxCombo.toFixed(1);
  ui.resultNote.textContent = canRevive
    ? 'Luma 还保留一次回响。按下按钮，带着护盾返回航线。'
    : '这段航线已存入星图。下一次，把天空跑得更远。';
  ui.restart.querySelector('span').textContent = canRevive ? '免费复活' : '再次点燃';
  ui.restart.querySelector('b').textContent = canRevive ? 'SPACE' : 'SPACE';
  ui.share.textContent = canRevive ? '结束本局' : '复制本局成绩';
  ui.result.classList.add('visible');
}

function reviveRun() {
  if (state.status !== 'revive' || !state.reviveAvailable) return;
  state.reviveAvailable = false;
  state.status = 'running';
  state.invulnerable = 2.4;
  state.shieldTimer = 2.4;
  state.dashTimer = 0.6;
  player.root.visible = true;
  player.y = 0;
  player.vy = 0;
  player.jumps = 0;
  clearEntities();
  state.nextSpawn = 13;
  generateLevel();
  ui.result.classList.remove('visible');
  announce('回响复活 · 棱镜护盾 2 秒');
  audio.portal();
  burst(new THREE.Vector3(PLAYER_X, 1.2, 0), '#6bf3ff', 32, 6, 0.11);
}

function useDash() {
  if (state.status !== 'running') return;
  if (state.petEnergy < 24) {
    announce('Luma 同步不足 · 多收集星币');
    return;
  }
  state.petEnergy -= 24;
  state.dashTimer = Math.max(state.dashTimer, 1.05);
  state.combo = clamp(state.combo + 0.18, 1, 9.9);
  state.comboClock = 3;
  state.shake = Math.max(state.shake, 0.1);
  audio.dash();
  announce('Luma 冲刺');
}

function useSkill() {
  if (state.status !== 'running') return;
  if (state.skillCharge < 50) {
    announce('星核技需要 50% 能量');
    return;
  }
  state.skillCharge -= 50;
  state.dashTimer = Math.max(state.dashTimer, 2.6);
  state.magnetTimer = Math.max(state.magnetTimer, 3.6);
  state.invulnerable = Math.max(state.invulnerable, 1.2);
  state.combo = clamp(state.combo + 1.2, 1, 9.9);
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboClock = 5;
  state.shake = 0.38;
  audio.portal();
  announce('星核技 · 日冕疾驰');
  burst(new THREE.Vector3(PLAYER_X, 1.2, 0), '#ffb85a', 42, 6, 0.11);
  for (let index = entities.length - 1; index >= 0; index -= 1) {
    const entity = entities[index];
    if (
      entity.group.position.x > PLAYER_X - 2
      && entity.group.position.x < PLAYER_X + 26
      && (entity.kind === 'obstacle' || entity.kind === 'arch' || entity.kind === 'enemy')
    ) {
      smashObstacle(index);
    }
  }
}

function jump() {
  if (state.status !== 'running') return;
  if (player.jumps >= 2) return;
  player.crouching = false;
  input.crouch = false;
  player.vy = player.jumps === 0 ? 11.7 : 10.6;
  player.jumps += 1;
  state.comboClock = Math.max(state.comboClock, 2.5);
  if (player.jumps === 2) {
    addScore(44);
    burst(new THREE.Vector3(PLAYER_X, player.y + 0.5, 0), '#6bf3ff', 13, 2.8, 0.07);
    announce('二段跃迁');
  }
  audio.jump();
}

function enterMode(mode) {
  if (state.mode !== 'normal') return;
  state.mode = mode;
  state.modeTimer = mode === 'super' ? 13 : 9.5;
  state.nextSpawn = 13;
  clearEntities();
  setTheme(mode === 'super' ? 'vault' : 'rift');
  specials.vault.visible = mode === 'super';
  specials.rift.visible = mode === 'rift';
  if (mode === 'rift') {
    state.dashTimer = Math.max(state.dashTimer, 1.3);
    state.magnetTimer = Math.max(state.magnetTimer, 2.4);
  }
  state.shake = 0.28;
  audio.portal();
  announce(mode === 'super' ? '超级奖励：星币金库开启' : '穿越奖励：进入高速裂隙');
  burst(new THREE.Vector3(PLAYER_X, 1.6, 0), mode === 'super' ? '#ffc857' : '#6bf3ff', 36, 6.2, 0.11);
  generateLevel();
}

function leaveMode() {
  const previous = state.mode;
  state.mode = 'normal';
  state.modeTimer = 0;
  state.nextSpawn = 13;
  clearEntities();
  specials.vault.visible = false;
  specials.rift.visible = false;
  setTheme(Math.floor(state.distance / 360) % 2 === 0 ? 'sky' : 'cavern');
  generateLevel();
  audio.pickup();
  announce(previous === 'super' ? '金库闭合 · 回到普通航线' : '裂隙出口 · 速度恢复');
}

function setTheme(themeName) {
  state.theme = themeName;
  const theme = themes[themeName];
  scene.background.set(theme.background);
  scene.fog.color.set(theme.fog);
  materials.ground.color.set(theme.ground);
  materials.ground.emissive.set(theme.background);
  materials.rail.color.set(theme.rail);
  materials.rail.emissive.set(theme.rail);
  materials.rock.color.set(themeName === 'cavern' ? '#342052' : themeName === 'vault' ? '#59310e' : '#193653');
  keyLight.color.set(theme.light);
  rimLight.color.set(theme.rail);
  warmLight.color.set(theme.accent);
  background.moonSphere.material.color.set(theme.accent);
  background.moonSphere.material.emissive.set(theme.accent);
  background.moonGlow.material.color.set(theme.accent);
  ui.mode.textContent = theme.name;
  ui.modeNote.textContent = theme.note;
  ui.event.textContent = theme.message;
}

function announce(text) {
  state.lastEvent = text;
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  promptTimer = 1.7;
}

function resetTerrain() {
  for (let i = 0; i < groundSegments.length; i += 1) {
    const segment = groundSegments[i];
    segment.group.position.x = -27 + i * segment.width;
    segment.group.rotation.z = 0;
  }
  for (let i = 0; i < riftRings.length; i += 1) {
    riftRings[i].position.x = -5 + i * 10;
    riftRings[i].rotation.set(0, 0, 0);
  }
}

function startRun() {
  audio.unlock();
  generationSeed = ((Math.random() * 0xffffffff) >>> 0) || 0xdecafbad;
  clearEntities();
  for (const particle of particles) fxLayer.remove(particle.mesh);
  particles = [];
  state.status = 'running';
  state.mode = 'normal';
  state.runTime = 0;
  state.distance = 0;
  state.score = 0;
  state.coins = 0;
  state.combo = 1;
  state.comboClock = 0;
  state.maxCombo = 1;
  state.baseSpeed = 8;
  state.currentSpeed = 8;
  state.skillCharge = 100;
  state.petEnergy = 100;
  state.shieldTimer = 0;
  state.magnetTimer = 0;
  state.dashTimer = 0;
  state.modeTimer = 0;
  state.invulnerable = 0;
  state.reviveAvailable = true;
  state.portalAt = range(56, 64);
  state.portalCycle = 0;
  state.nextSpawn = 12;
  state.shake = 0;
  state.flash = 0;
  player.root.visible = true;
  player.y = 0;
  player.vy = 0;
  player.jumps = 0;
  player.crouching = false;
  input.crouch = false;
  resetTerrain();
  specials.vault.visible = false;
  specials.rift.visible = false;
  setTheme('sky');
  generateLevel();
  ui.start.classList.remove('visible');
  ui.pause.classList.remove('visible');
  ui.result.classList.remove('visible');
  ui.hud.classList.add('awake');
  announce('航线已点燃 · 找到第一扇裂隙门');
}

function togglePause(forceResume = false) {
  if (state.status === 'running' && !forceResume) {
    state.status = 'paused';
    ui.pause.classList.add('visible');
    return;
  }
  if (state.status === 'paused') {
    state.status = 'running';
    ui.pause.classList.remove('visible');
    audio.unlock();
  }
}

function updateGround(dt, speed) {
  const totalWidth = groundSegments.length * groundSegments[0].width;
  for (const segment of groundSegments) {
    segment.group.position.x -= speed * dt;
    if (segment.group.position.x < -34) {
      segment.group.position.x += totalWidth;
      segment.group.rotation.z = range(-0.012, 0.012);
      for (const stone of segment.stones.children) {
        stone.position.x = range(-3.8, 3.8);
        stone.position.z = pick([-2.3, 2.3]);
        stone.rotation.set(range(0, 1), range(0, 1), range(0, 1));
      }
    }
  }
}

function updateBackground(dt, speed) {
  background.stars.rotation.y += dt * 0.003;
  background.moon.rotation.z = Math.sin(state.time * 0.12) * 0.06;
  for (const item of parallax) {
    item.object.position.x -= speed * item.speed * dt;
    if (item.spin) item.object.rotation.z += item.spin * dt;
    if (item.object.position.x < -42) {
      item.object.position.x = item.resetX + range(0, 22);
      item.object.position.y = item.y + range(-1.5, 1.5);
    }
  }
}

function updateSpecialArchitecture(dt, speed) {
  if (specials.vault.visible) {
    specials.vault.rotation.y = Math.sin(state.time * 0.18) * 0.045;
  }
  if (specials.rift.visible) {
    for (const ring of riftRings) {
      ring.position.x -= speed * dt * 1.15;
      ring.rotation.x += dt * 0.85;
      ring.rotation.z += dt * 0.4;
      if (ring.position.x < -13) ring.position.x += riftRings.length * 10;
    }
  }
}

function updatePlayer(dt) {
  player.crouching = input.crouch && player.y < 0.05 && state.dashTimer <= 0;
  if (player.y > 0 || player.vy !== 0) {
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      if (player.vy < -10) {
        burst(new THREE.Vector3(PLAYER_X, 0.26, 0), '#6bf3ff', 7, 1.5, 0.05);
        audio.tone(95, 0.06, { type: 'triangle', volume: 0.028, endFrequency: 62 });
      }
      player.y = 0;
      player.vy = 0;
      player.jumps = 0;
    }
  }

  const pace = state.currentSpeed * 0.85;
  player.bob += dt * pace;
  const runWave = Math.sin(player.bob * 1.65);
  const airborne = player.y > 0.04;
  player.root.position.set(PLAYER_X, player.y + (airborne ? 0 : Math.abs(runWave) * 0.026), 0);
  player.mount.position.y = 0.47 + Math.sin(state.time * 10 + player.bob) * 0.045;
  player.rider.scale.y = THREE.MathUtils.lerp(player.rider.scale.y, player.crouching ? 0.64 : 1, dt * 12);
  player.rider.position.y = THREE.MathUtils.lerp(player.rider.position.y, player.crouching ? 0.73 : 0.92, dt * 12);
  player.rider.rotation.z = THREE.MathUtils.lerp(player.rider.rotation.z, player.crouching ? -0.43 : -0.05 + runWave * 0.055, dt * 10);
  player.armL.rotation.z = -0.2 + runWave * (airborne ? 0.16 : 0.56);
  player.armR.rotation.z = 0.2 - runWave * (airborne ? 0.16 : 0.56);
  player.legL.rotation.z = -runWave * (airborne ? 0.2 : 0.62);
  player.legR.rotation.z = runWave * (airborne ? 0.2 : 0.62);
  player.lumaTail.rotation.y = Math.sin(state.time * 10) * 0.45;
  player.companion.position.y = 1.62 + Math.sin(state.time * 4.3) * 0.18;
  player.companion.position.x = -1.25 + Math.cos(state.time * 3.2) * 0.12;
  player.companionRing.rotation.z += dt * 3.1;
  player.shadow.scale.setScalar(1.12 - Math.min(player.y * 0.15, 0.55));
  player.shadow.material.opacity = 0.42 - Math.min(player.y * 0.06, 0.25);
  player.shield.visible = state.shieldTimer > 0;
  if (player.shield.visible) {
    player.shield.rotation.y += dt * 1.7;
    player.shield.scale.setScalar(1 + Math.sin(state.time * 8) * 0.04);
  }
  player.aura.visible = state.dashTimer > 0;
  if (player.aura.visible) {
    player.aura.scale.setScalar(1.16 + Math.sin(state.time * 20) * 0.16);
    trail(new THREE.Vector3(PLAYER_X - 0.9, player.y + 0.75, 0), state.mode === 'rift' ? '#6bf3ff' : '#ff9b59');
  }
}

function updateEntities(dt, speed) {
  const magnetTarget = new THREE.Vector3(PLAYER_X, player.y + 1.1, 0);
  for (let index = entities.length - 1; index >= 0; index -= 1) {
    const entity = entities[index];
    entity.age += dt;
    entity.group.position.x -= speed * dt;

    if (entity.kind === 'coin') {
      entity.group.rotation.y += dt * 8;
      entity.group.position.y += Math.sin(entity.age * 4 + entity.bob) * dt * 0.1;
      if (state.magnetTimer > 0 && entity.group.position.distanceTo(magnetTarget) < 7.2) {
        entity.group.position.lerp(magnetTarget, dt * 8.4);
      }
      if (entity.group.position.distanceTo(magnetTarget) < entity.radius) {
        collectCoin(index);
        continue;
      }
    } else if (entity.kind === 'riftOrb') {
      entity.group.rotation.y += dt * 4.5;
      entity.group.rotation.z += dt * 2.1;
      entity.group.position.y += Math.sin(entity.age * 5) * dt * 0.3;
      if (entity.group.position.distanceTo(magnetTarget) < entity.radius) {
        collectCoin(index, true);
        continue;
      }
    } else if (entity.kind === 'pickup') {
      entity.group.rotation.y += dt * 3.4;
      entity.group.position.y += Math.sin(entity.age * 3.6) * dt * 0.25;
      if (entity.group.position.distanceTo(magnetTarget) < entity.radius) {
        activatePickup(index);
        continue;
      }
    } else if (entity.kind === 'portal') {
      entity.group.rotation.y += dt * 1.15;
      entity.group.rotation.z += dt * 0.42;
      if (overlapEntity(entity)) {
        entityLayer.remove(entity.group);
        entities.splice(index, 1);
        enterMode(entity.type);
        continue;
      }
    } else if (entity.kind === 'enemy') {
      entity.group.position.y = Math.abs(Math.sin(entity.age * 3.2)) * 0.1;
    } else if (entity.kind === 'arch') {
      entity.group.children[3].material.emissiveIntensity = 0.8 + Math.sin(entity.age * 7) * 0.55;
    }

    if (entity.kind === 'obstacle' || entity.kind === 'arch' || entity.kind === 'enemy') {
      if (overlapEntity(entity)) {
        const playerBottom = player.y;
        const playerTop = player.y + playerHeight();
        if (entity.kind === 'enemy' && player.vy < -0.2 && playerBottom > entity.stompTop - 0.18) {
          stompEnemy(index);
          continue;
        }
        if (playerTop > entity.minY && playerBottom < entity.maxY) {
          if (state.dashTimer > 0 || state.invulnerable > 0.2) smashObstacle(index);
          else hitPlayer();
          continue;
        }
      }
    }

    if (entity.group.position.x < -14) removeEntity(index);
  }
}

function updateTimers(dt) {
  state.invulnerable = Math.max(0, state.invulnerable - dt);
  state.shieldTimer = Math.max(0, state.shieldTimer - dt);
  state.magnetTimer = Math.max(0, state.magnetTimer - dt);
  state.dashTimer = Math.max(0, state.dashTimer - dt);
  state.skillCharge = clamp(state.skillCharge + dt * 1.2, 0, 100);
  state.petEnergy = clamp(state.petEnergy + dt * 1.8 + (state.mode === 'super' ? 0.4 : 0), 0, 100);
  if (state.comboClock > 0) {
    state.comboClock -= dt;
  } else {
    state.combo = Math.max(1, state.combo - dt * 0.32);
  }
  if (state.mode !== 'normal') {
    state.modeTimer -= dt;
    if (state.modeTimer <= 0) leaveMode();
  } else {
    const desiredTheme = Math.floor(state.distance / 360) % 2 === 0 ? 'sky' : 'cavern';
    if (desiredTheme !== state.theme) {
      setTheme(desiredTheme);
      announce(desiredTheme === 'cavern' ? '航道沉入晶洞 · 地貌切换' : '重返暮空 · 航线稳定');
    }
  }
  if (promptTimer > 0) {
    promptTimer -= dt;
    if (promptTimer <= 0) ui.toast.classList.remove('show');
  }
}

function updateUI() {
  ui.score.textContent = formatScore(state.score);
  ui.highScore.textContent = formatScore(Math.max(state.highScore, state.score));
  ui.combo.textContent = 'x' + state.combo.toFixed(1);
  ui.comboCaption.textContent = state.combo > 4 ? '光速流动' : state.combo > 2 ? '节奏上扬' : '保持奔跑';
  ui.distance.textContent = Math.floor(state.distance) + 'm';
  ui.speed.textContent = state.currentSpeed.toFixed(1) + ' AU/S';
  ui.petMeter.style.width = state.petEnergy + '%';
  ui.petStatus.textContent = state.dashTimer > 0 ? 'LUMA BOOST' : state.petEnergy >= 24 ? 'LUMA READY' : '收集星币';
  ui.skillMeter.style.width = state.skillCharge + '%';
  ui.skillStatus.textContent = state.skillCharge >= 50 ? 'X 释放' : Math.floor(state.skillCharge) + '% 聚能';
  updateChip(ui.shield, state.shieldTimer, '护盾');
  updateChip(ui.magnet, state.magnetTimer, '磁场');
  updateChip(ui.dash, state.dashTimer, '冲刺');
  if (state.mode === 'super' || state.mode === 'rift') {
    ui.event.textContent = (state.mode === 'super' ? '星币金库 · ' : '穿越裂隙 · ') + formatTime(state.modeTimer);
  }
}

function updateChip(chip, timer, label) {
  const value = chip.querySelector('b');
  if (timer > 0) {
    chip.classList.add('active');
    value.textContent = timer.toFixed(1) + 's';
  } else {
    chip.classList.remove('active');
    value.textContent = '--';
  }
  chip.title = label;
}

function updateCamera(dt) {
  const targetX = cameraHome.x + (state.dashTimer > 0 ? 0.68 : 0);
  const targetY = cameraHome.y + (state.mode === 'rift' ? 0.36 : 0);
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, dt * 3.2);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, dt * 3.2);
  if (state.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * state.shake;
    camera.position.y += (Math.random() - 0.5) * state.shake;
    camera.position.z += (Math.random() - 0.5) * state.shake * 0.45;
    state.shake = Math.max(0, state.shake - dt * 1.8);
  }
  camera.lookAt(cameraLook.x, cameraLook.y + (state.mode === 'rift' ? 0.25 : 0), 0);
}

function updateRun(dt) {
  state.runTime += dt;
  const progression = Math.min(10, state.distance / 115);
  state.baseSpeed = 8 + progression;
  const modeFactor = state.mode === 'rift' ? 1.68 : state.mode === 'super' ? 1.1 : 1;
  const dashFactor = state.dashTimer > 0 ? 1.75 : 1;
  state.currentSpeed = state.baseSpeed * modeFactor * dashFactor;
  state.distance += state.currentSpeed * dt * 0.83;
  addScore(dt * 3.6, false);
  updateTimers(dt);
  updatePlayer(dt);
  updateGround(dt, state.currentSpeed);
  updateBackground(dt, state.currentSpeed);
  updateSpecialArchitecture(dt, state.currentSpeed);
  updateEntities(dt, state.currentSpeed);
  generateLevel();
  updateUI();
}

function animate(now) {
  const dt = Math.min(0.034, (now - lastTime) / 1000);
  lastTime = now;
  state.time += dt;
  if (state.status === 'running') updateRun(dt);
  updateParticles(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function actionFromTouch(action) {
  audio.unlock();
  if (action === 'jump') jump();
  if (action === 'crouch') {
    input.crouch = true;
    window.setTimeout(() => {
      input.crouch = false;
    }, 420);
  }
  if (action === 'dash') useDash();
  if (action === 'skill') useSkill();
}

function keyIsControl(code) {
  return ['Space', 'ArrowUp', 'ArrowDown', 'KeyS', 'ShiftLeft', 'ShiftRight', 'KeyX', 'KeyP', 'Escape'].includes(code);
}

window.addEventListener('keydown', (event) => {
  if (keyIsControl(event.code)) event.preventDefault();
  if (event.repeat && event.code !== 'ArrowDown' && event.code !== 'KeyS') return;
  audio.unlock();

  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (state.status === 'running' || state.status === 'paused') togglePause();
    return;
  }
  if (event.code === 'Space' || event.code === 'ArrowUp') {
    if (state.status === 'ready' || state.status === 'ended') startRun();
    else if (state.status === 'revive') reviveRun();
    else jump();
    return;
  }
  if (event.code === 'ArrowDown' || event.code === 'KeyS') {
    input.crouch = true;
    return;
  }
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
    useDash();
    return;
  }
  if (event.code === 'KeyX') useSkill();
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowDown' || event.code === 'KeyS') input.crouch = false;
});

window.addEventListener('blur', () => {
  if (state.status === 'running') togglePause();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.status === 'running') togglePause();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
});

ui.startButton.addEventListener('click', startRun);
ui.resumeButton.addEventListener('click', () => togglePause(true));
ui.restartPause.addEventListener('click', startRun);
ui.restart.addEventListener('click', () => {
  if (state.status === 'revive') reviveRun();
  else startRun();
});
ui.share.addEventListener('click', async () => {
  if (state.status === 'revive') {
    finishRun();
    return;
  }
  const text = 'Nova Stride：我跑了 ' + Math.floor(state.distance) + 'm，表现分 ' + Math.floor(state.score) + '，FLOW x' + state.maxCombo.toFixed(1);
  try {
    await navigator.clipboard.writeText(text);
    announce('成绩已复制到剪贴板');
  } catch {
    announce('成绩：' + text);
  }
});

for (const button of document.querySelectorAll('.touch-controls button')) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    actionFromTouch(button.dataset.action);
  });
}

setTheme('sky');
updateUI();
requestAnimationFrame(animate);
