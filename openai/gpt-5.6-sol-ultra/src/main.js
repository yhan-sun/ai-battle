import * as THREE from 'three';
import { createAudio } from './audio.js';
import './style.css';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const TAU = Math.PI * 2;

const MODE = Object.freeze({
  NORMAL: 'normal',
  SUPER: 'super',
  RIFT: 'rift',
  BONUS: 'bonus',
});

const PHASE = Object.freeze({
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DOWNED: 'downed',
  RESULTS: 'results',
});

const MODE_INFO = {
  [MODE.NORMAL]: { label: '远征', color: '#65f4ff', duration: 0 },
  [MODE.SUPER]: { label: '超级奖励', color: '#ffd45f', duration: 10 },
  [MODE.RIFT]: { label: '穿越奖励', color: '#c879ff', duration: 9 },
  [MODE.BONUS]: { label: '云巅奖励关', color: '#ff77c8', duration: 12 },
};

const BIOMES = [
  { key: 'sky', label: '云港晨曦', bg: 0x07162f, fog: 0x12305d, ground: 0x147b92, edge: 0x73f7ff },
  { key: 'city', label: '地下霓渊', bg: 0x120d33, fog: 0x27155b, ground: 0x3a2b7d, edge: 0xff74d8 },
  { key: 'cave', label: '晶脉深层', bg: 0x080e1d, fog: 0x101c39, ground: 0x24364d, edge: 0x79ffb7 },
];

const PLAYER_X = -5.4;
const CHUNK_LENGTH = 24;
const STORAGE_KEY = 'starrail-sprint-save-v1';

function safeStorageRead() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function safeStorageWrite(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable in privacy modes; the run remains playable.
  }
}

function roundedBox(width, height, depth, radius, material) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: radius * 0.35,
    bevelThickness: radius * 0.35,
  });
  geometry.center();
  return new THREE.Mesh(geometry, material);
}

function makeTextSprite(text, color = '#ffffff', size = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = `900 ${size}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 14;
  context.strokeStyle = 'rgba(4,8,24,.78)';
  context.strokeText(text, 256, 80);
  context.fillStyle = color;
  context.fillText(text, 256, 80);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(5.4, 1.7, 1);
  return sprite;
}

class StarRailSprint {
  constructor() {
    this.canvas = document.querySelector('#game-canvas');
    this.container = document.querySelector('#app') || document.body;
    this.audio = createAudio();
    this.save = { highScore: 0, bestDistance: 0, totalCoins: 0, muted: false, ...safeStorageRead() };
    this.audio.setMuted(Boolean(this.save.muted));

    this.phase = PHASE.MENU;
    this.mode = MODE.NORMAL;
    this.modeTimer = 0;
    this.runTime = 0;
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.speed = 13;
    this.lastTime = performance.now();
    this.fixedRemainder = 0;
    this.tour = false;
    this.tourFlags = { super: false, rift: false, bonus: false };
    this.input = { down: false };
    this.pointerStart = null;
    this.entities = [];
    this.entityPools = new Map();
    this.chunks = [];
    this.particles = [];
    this.floatTexts = [];
    this.nextChunkX = -12;
    this.generatorIndex = 0;
    this.shake = 0;
    this.flash = 0;
    this.transitionLock = 0;
    this.bannerTimer = 0;
    this.currentBiome = -1;
    this.lastHud = 0;
    this.portalSchedule = { rift: 150, bonus: 390 };
    this.portalQueued = { rift: false, bonus: false };
    this.modeHistory = new Set();

    this.cacheDom();
    this.initThree();
    this.createSharedAssets();
    this.createEnvironment();
    this.createPlayer();
    this.bindControls();
    this.clearWorld();
    this.applyModeVisuals(MODE.NORMAL, true);
    this.ensureChunks(true);
    this.dom['loading-overlay']?.setAttribute('hidden', '');
    this.setOverlay('start-screen');
    this.showMenuStats();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.phase === PHASE.PLAYING) this.pause();
    });
    requestAnimationFrame((time) => this.loop(time));
  }

  cacheDom() {
    const ids = [
      'loading-overlay',
      'start-screen', 'pause-screen', 'revive-screen', 'result-screen', 'hud', 'mobile-controls',
      'score-value', 'distance-value', 'speed-value', 'coin-value', 'multiplier-value',
      'mode-label', 'mode-timer', 'biome-label', 'super-fill', 'dash-fill', 'skill-fill',
      'super-text', 'dash-text', 'skill-text', 'shield-status', 'mount-status', 'pet-status',
      'start-btn', 'tour-btn', 'pause-btn', 'resume-btn', 'restart-btn', 'home-btn',
      'revive-btn', 'giveup-btn', 'mute-btn', 'jump-btn', 'duck-btn', 'skill-btn', 'dash-btn',
      'final-score', 'final-distance', 'final-coins', 'final-best', 'revive-countdown',
      'toast', 'mode-banner', 'mode-banner-title', 'mode-banner-subtitle', 'screen-flash',
      'menu-best', 'menu-distance', 'combo-value', 'revive-note', 'mission-value',
      'mission-toast', 'mission-text', 'audio-icon', 'health-fill', 'energy-fill',
      'pause-score', 'pause-distance', 'final-combo', 'best-score', 'new-best-badge',
      'restart-from-pause-button', 'how-to-button', 'controls-card',
      'health-value', 'energy-value', 'zone-progress', 'skill-copy', 'revive-ring',
      'reward-crystals', 'reward-starlight',
      'action-status',
      'super-button',
    ];
    this.dom = {};
    for (const id of ids) this.dom[id] = document.getElementById(id);
    const aliases = {
      'start-screen': 'start-overlay',
      'pause-screen': 'pause-overlay',
      'revive-screen': 'revive-overlay',
      'result-screen': 'result-overlay',
      'pause-btn': 'pause-button',
      'resume-btn': 'resume-button',
      'restart-btn': 'restart-button',
      'home-btn': 'back-to-title-button',
      'revive-btn': 'revive-button',
      'giveup-btn': 'give-up-button',
      'mute-btn': 'audio-button',
      'jump-btn': 'jump-button',
      'duck-btn': 'slide-button',
      'skill-btn': 'skill-button',
      'dash-btn': 'dash-button',
      'final-coins': 'final-crystals',
      'final-best': 'best-score',
      'mode-banner': 'reward-banner',
      'mode-banner-title': 'reward-name',
      'mode-banner-subtitle': 'reward-value',
      'biome-label': 'zone-name',
      'multiplier-value': 'combo-multiplier',
      'toast': 'mission-toast',
    };
    for (const [name, source] of Object.entries(aliases)) this.dom[name] = document.getElementById(source);
  }

  initThree() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas || undefined, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (!this.canvas) this.container.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BIOMES[0].bg);
    this.scene.fog = new THREE.FogExp2(BIOMES[0].fog, 0.022);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 180);
    this.camera.position.set(0, 5.4, 17);
    this.camera.lookAt(0, 2.3, 0);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.entityLayer = new THREE.Group();
    this.world.add(this.entityLayer);
    this.chunkLayer = new THREE.Group();
    this.world.add(this.chunkLayer);
    this.fxLayer = new THREE.Group();
    this.scene.add(this.fxLayer);

    const hemi = new THREE.HemisphereLight(0xa8e9ff, 0x201438, 2.3);
    this.scene.add(hemi);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
    this.keyLight.position.set(-4, 11, 9);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = -13;
    this.keyLight.shadow.camera.right = 13;
    this.keyLight.shadow.camera.top = 12;
    this.keyLight.shadow.camera.bottom = -4;
    this.scene.add(this.keyLight);
    this.rimLight = new THREE.PointLight(0x61f5ff, 18, 24, 2);
    this.rimLight.position.set(-5, 5, 5);
    this.scene.add(this.rimLight);
  }

  createSharedAssets() {
    const mat = (color, emissive = color, intensity = 0.15, opts = {}) => new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: intensity,
      roughness: opts.roughness ?? 0.45,
      metalness: opts.metalness ?? 0.15,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
    });
    this.materials = {
      cyan: mat(0x5ff5ff, 0x22d9ff, 0.85, { metalness: 0.45, roughness: 0.2 }),
      cyanSoft: mat(0x1b7896, 0x2de7ff, 0.4),
      navy: mat(0x101c45, 0x071532, 0.25),
      white: mat(0xf5fbff, 0xaadfff, 0.25),
      pink: mat(0xff67c7, 0xff2796, 0.65, { metalness: 0.25 }),
      purple: mat(0x9b64ff, 0x7637ff, 0.75, { metalness: 0.3 }),
      gold: mat(0xffd04f, 0xff9800, 1.1, { metalness: 0.55, roughness: 0.22 }),
      orange: mat(0xff754d, 0xff3b15, 0.6),
      green: mat(0x62ffad, 0x19df79, 0.75),
      red: mat(0xff435f, 0xff1738, 0.8),
      dark: mat(0x12152b, 0x060814, 0.1, { metalness: 0.2 }),
      glass: mat(0x80eaff, 0x1bcfff, 0.5, { transparent: true, opacity: 0.3, metalness: 0.1, roughness: 0.1, side: THREE.DoubleSide }),
    };
    this.geometries = {
      box: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.SphereGeometry(0.5, 16, 12),
      lowSphere: new THREE.IcosahedronGeometry(0.5, 1),
      coin: new THREE.TorusGeometry(0.34, 0.115, 8, 16),
      ring: new THREE.TorusGeometry(4.8, 0.055, 6, 36),
      cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
      cone: new THREE.ConeGeometry(0.5, 1, 7),
      plane: new THREE.PlaneGeometry(1, 1),
    };
    this.geometries.signPanel = roundedBox(1.8, 0.9, 0.12, 0.12, this.materials.pink).geometry;
  }

  createEnvironment() {
    this.environment = new THREE.Group();
    this.scene.add(this.environment);

    this.starField = this.makeStarField();
    this.environment.add(this.starField);

    this.farLayer = new THREE.Group();
    this.midLayer = new THREE.Group();
    this.nearLayer = new THREE.Group();
    this.environment.add(this.farLayer, this.midLayer, this.nearLayer);

    for (let i = 0; i < 18; i += 1) {
      const cloud = this.makeCloud(0.65 + Math.random() * 1.15);
      cloud.position.set(-35 + i * 5.4 + Math.random() * 2, 5 + Math.random() * 7, -10 - Math.random() * 10);
      cloud.userData.speed = 0.08 + Math.random() * 0.1;
      this.farLayer.add(cloud);
    }

    for (let i = 0; i < 22; i += 1) {
      const mountain = new THREE.Mesh(this.geometries.cone, i % 3 === 0 ? this.materials.purple : this.materials.navy);
      mountain.scale.set(4 + Math.random() * 5, 8 + Math.random() * 9, 2.5);
      mountain.position.set(-48 + i * 5, -0.2, -18 - Math.random() * 7);
      mountain.rotation.y = Math.PI / 7;
      mountain.userData.speed = 0.14;
      this.farLayer.add(mountain);
    }

    for (let i = 0; i < 24; i += 1) {
      const building = new THREE.Group();
      const height = 2.5 + Math.random() * 6;
      const body = new THREE.Mesh(this.geometries.box, this.materials.dark);
      body.scale.set(1.4 + Math.random() * 1.8, height, 1.5);
      body.position.y = height / 2 - 0.4;
      const cap = new THREE.Mesh(this.geometries.box, i % 2 ? this.materials.cyanSoft : this.materials.purple);
      cap.scale.set(body.scale.x * 1.05, 0.08, 1.56);
      cap.position.y = height - 0.4;
      building.add(body, cap);
      building.position.set(-42 + i * 4.1, 0, -10 - Math.random() * 5);
      building.userData.speed = 0.25;
      this.midLayer.add(building);
    }

    this.tunnel = new THREE.Group();
    this.tunnel.visible = false;
    this.environment.add(this.tunnel);
    for (let i = 0; i < 17; i += 1) {
      const ring = new THREE.Mesh(this.geometries.ring, i % 2 ? this.materials.purple : this.materials.cyan);
      ring.position.set(-7 + i * 3.7, 3.2, -2.5);
      ring.rotation.y = Math.PI / 2;
      ring.userData.slot = i;
      this.tunnel.add(ring);
    }
    for (let i = 0; i < 30; i += 1) {
      const streak = new THREE.Mesh(this.geometries.box, i % 3 ? this.materials.cyan : this.materials.pink);
      streak.scale.set(3 + Math.random() * 6, 0.025, 0.025);
      streak.position.set(-15 + Math.random() * 34, -1 + Math.random() * 8, -3 + Math.random() * 7);
      streak.userData.seed = Math.random() * 10;
      this.tunnel.add(streak);
    }

    this.superSun = new THREE.Group();
    const sunCore = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshBasicMaterial({ color: 0xffd95e, transparent: true, opacity: 0.8 }));
    sunCore.position.set(10, 7.5, -22);
    const sunHalo = new THREE.Mesh(new THREE.RingGeometry(3.4, 5.6, 48), new THREE.MeshBasicMaterial({ color: 0xff8bcb, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    sunHalo.position.copy(sunCore.position);
    this.superSun.add(sunCore, sunHalo);
    this.superSun.visible = false;
    this.environment.add(this.superSun);

    this.bonusDecor = new THREE.Group();
    this.bonusDecor.visible = false;
    for (let i = 0; i < 12; i += 1) {
      const orb = new THREE.Mesh(this.geometries.lowSphere, i % 2 ? this.materials.pink : this.materials.gold);
      orb.scale.setScalar(0.35 + Math.random() * 0.45);
      orb.position.set(-14 + i * 3, 3 + Math.sin(i * 1.7) * 2.2, -6 - Math.random() * 3);
      this.bonusDecor.add(orb);
    }
    this.environment.add(this.bonusDecor);

    this.caveDecor = new THREE.Group();
    this.caveDecor.visible = false;
    for (let i = 0; i < 15; i += 1) {
      const tooth = new THREE.Mesh(this.geometries.cone, i % 3 === 0 ? this.materials.green : this.materials.purple);
      tooth.scale.set(0.45 + (i % 3) * 0.2, 1.8 + (i % 4) * 0.7, 0.55);
      tooth.rotation.z = Math.PI;
      tooth.position.set(-22 + i * 3.5, 9.2 + Math.sin(i) * 0.7, -7 - (i % 4));
      tooth.userData.speed = 0.32;
      this.caveDecor.add(tooth);
    }
    this.environment.add(this.caveDecor);
  }

  makeStarField() {
    const count = 500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color(0x70edff), new THREE.Color(0xffb5ea), new THREE.Color(0xffe8a0)];
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = -40 + Math.random() * 80;
      positions[i * 3 + 1] = -4 + Math.random() * 25;
      positions[i * 3 + 2] = -8 - Math.random() * 70;
      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.095, vertexColors: true, transparent: true, opacity: 0.86, depthWrite: false }));
  }

  makeCloud(scale = 1) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0xc7ecff, emissive: 0x637bba, emissiveIntensity: 0.18, transparent: true, opacity: 0.28, roughness: 1 });
    const parts = [[0, 0, 1.2], [0.8, 0.05, 0.85], [-0.75, -0.05, 0.9], [0.1, 0.38, 0.85]];
    for (const [x, y, s] of parts) {
      const p = new THREE.Mesh(this.geometries.sphere, material);
      p.position.set(x, y, 0);
      p.scale.set(s * 1.7, s, s);
      group.add(p);
    }
    group.scale.setScalar(scale);
    return group;
  }

  createPlayer() {
    this.player = {
      root: new THREE.Group(),
      visual: new THREE.Group(),
      y: 0,
      previousY: 0,
      vy: 0,
      grounded: true,
      jumps: 0,
      ducking: false,
      duckBlend: 0,
      coyote: 0,
      runCycle: 0,
      invincible: 0,
      shield: 0,
      magnet: 0,
      mount: 0,
      skill: 0,
      skillCooldown: 0,
      dash: 0,
      dashGauge: 35,
      superGauge: 0,
    };
    const root = this.player.root;
    root.position.set(PLAYER_X, 0, 0);
    root.add(this.player.visual);
    this.scene.add(root);

    const v = this.player.visual;
    const torso = roundedBox(0.78, 0.9, 0.45, 0.16, this.materials.cyan);
    torso.position.set(0, 1.48, 0);
    torso.rotation.z = -0.06;
    v.add(torso);

    const chest = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    chest.position.set(0.34, 1.5, 0.24);
    chest.rotation.y = 0.08;
    v.add(chest);

    const head = new THREE.Mesh(this.geometries.sphere, this.materials.white);
    head.scale.set(0.55, 0.58, 0.5);
    head.position.set(0.02, 2.18, 0);
    head.castShadow = true;
    v.add(head);

    const visor = roundedBox(0.56, 0.22, 0.08, 0.08, this.materials.purple);
    visor.position.set(0.28, 2.22, 0.2);
    visor.rotation.y = -0.06;
    v.add(visor);

    const scarf = new THREE.Group();
    for (let i = 0; i < 4; i += 1) {
      const segment = new THREE.Mesh(this.geometries.box, this.materials.pink);
      segment.scale.set(0.42, 0.12, 0.1);
      segment.position.set(-0.45 - i * 0.34, 1.86 - i * 0.08, -0.06);
      segment.userData.index = i;
      scarf.add(segment);
    }
    v.add(scarf);

    this.player.limbs = {};
    const limb = (name, x, y, material, length = 0.72) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const mesh = new THREE.Mesh(this.geometries.cylinder, material);
      mesh.scale.set(0.15, length, 0.15);
      mesh.position.y = -length / 2;
      mesh.castShadow = true;
      pivot.add(mesh);
      v.add(pivot);
      this.player.limbs[name] = pivot;
      return pivot;
    };
    limb('armFront', 0.37, 1.72, this.materials.white, 0.62).position.z = 0.28;
    limb('armBack', -0.33, 1.72, this.materials.cyanSoft, 0.62).position.z = -0.22;
    limb('legFront', 0.25, 1.05, this.materials.white, 0.88).position.z = 0.2;
    limb('legBack', -0.22, 1.05, this.materials.navy, 0.88).position.z = -0.18;

    this.player.mountMesh = this.makeMount();
    this.player.mountMesh.visible = false;
    root.add(this.player.mountMesh);

    this.player.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.45, 24, 16), this.materials.glass);
    this.player.shieldMesh.position.y = 1.25;
    this.player.shieldMesh.scale.set(1.05, 1, 0.72);
    this.player.shieldMesh.visible = false;
    root.add(this.player.shieldMesh);

    this.pet = this.makePet();
    this.scene.add(this.pet);

    this.player.parts = { torso, head, visor, scarf };
  }

  makeMount() {
    const group = new THREE.Group();
    const board = roundedBox(1.55, 0.18, 0.55, 0.09, this.materials.purple);
    board.position.y = 0.05;
    board.rotation.z = -0.04;
    const nose = new THREE.Mesh(this.geometries.cone, this.materials.cyan);
    nose.scale.set(0.28, 0.55, 0.3);
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(0.95, 0.08, 0);
    const thruster = new THREE.Mesh(this.geometries.cone, this.materials.pink);
    thruster.scale.set(0.2, 0.8, 0.2);
    thruster.rotation.z = Math.PI / 2;
    thruster.position.set(-1.05, 0.06, 0);
    group.add(board, nose, thruster);
    return group;
  }

  makePet() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.geometries.sphere, this.materials.pink);
    body.scale.set(0.48, 0.42, 0.42);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), new THREE.MeshBasicMaterial({ color: 0x29133e }));
    face.position.set(0.36, 0.02, 0.15);
    face.rotation.y = 0.65;
    const earA = new THREE.Mesh(this.geometries.cone, this.materials.gold);
    earA.scale.set(0.18, 0.35, 0.18);
    earA.position.set(-0.15, 0.42, 0.08);
    earA.rotation.z = -0.2;
    const earB = earA.clone();
    earB.position.z = -0.2;
    group.add(body, face, earA, earB);
    group.position.set(PLAYER_X - 1.8, 2.4, -0.4);
    return group;
  }

  bindControls() {
    const activate = (fn) => (event) => {
      event.preventDefault();
      this.audio.unlock();
      fn.call(this, event);
    };
    const on = (id, event, fn) => this.dom[id]?.addEventListener(event, activate(fn));
    on('start-btn', 'click', () => this.start(false));
    on('tour-btn', 'click', () => this.start(true));
    on('pause-btn', 'click', this.togglePause);
    on('resume-btn', 'click', this.resume);
    on('restart-btn', 'click', () => this.start(this.tour));
    on('home-btn', 'click', this.goHome);
    on('revive-btn', 'click', this.revive);
    on('giveup-btn', 'click', this.finishRun);
    on('mute-btn', 'click', this.toggleMute);
    on('jump-btn', 'pointerdown', this.jump);
    on('duck-btn', 'pointerdown', () => { this.input.down = true; this.duck(); });
    on('duck-btn', 'pointerup', () => { this.input.down = false; this.player.ducking = false; });
    on('duck-btn', 'pointercancel', () => { this.input.down = false; this.player.ducking = false; });
    on('skill-btn', 'pointerdown', this.useSkill);
    on('dash-btn', 'pointerdown', this.useDash);
    on('super-button', 'pointerdown', this.useSuper);
    on('restart-from-pause-button', 'click', () => this.start(this.tour));
    on('how-to-button', 'click', () => {
      const open = this.dom['controls-card']?.classList.toggle('is-open');
      this.dom['how-to-button']?.setAttribute('aria-expanded', String(Boolean(open)));
    });

    window.addEventListener('keydown', (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(event.code)) event.preventDefault();
      if (event.repeat && !['ArrowDown', 'KeyS'].includes(event.code)) return;
      this.audio.unlock();
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
        if (this.phase === PHASE.MENU) this.start(false);
        else if (this.phase === PHASE.PLAYING) this.jump();
        else if (this.phase === PHASE.PAUSED) this.resume();
      }
      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        this.input.down = true;
        this.duck();
      }
      if (event.code === 'KeyE' || event.code === 'KeyK') this.useSkill();
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyJ') this.useDash();
      if (event.code === 'KeyF') this.useSuper();
      if (event.code === 'Escape' || event.code === 'KeyP') this.togglePause();
      if (event.code === 'KeyM') this.toggleMute();
      if (event.code === 'KeyR' && this.phase === PHASE.DOWNED) this.revive();
    });
    window.addEventListener('keyup', (event) => {
      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        this.input.down = false;
        this.player.ducking = false;
      }
    });

    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      this.pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
    });
    this.renderer.domElement.addEventListener('pointerup', (event) => {
      if (!this.pointerStart || this.phase !== PHASE.PLAYING) return;
      const dx = event.clientX - this.pointerStart.x;
      const dy = event.clientY - this.pointerStart.y;
      this.pointerStart = null;
      if (Math.abs(dy) > Math.abs(dx) && dy > 36) this.duck(true);
      else if (Math.abs(dy) > 30 && dy < 0) this.jump();
      else if (dx > 60) this.useDash();
      else if (Math.abs(dx) < 20 && Math.abs(dy) < 20) this.jump();
    });
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = width / height < 0.78 ? 55 : 46;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  showMenuStats() {
    if (this.dom['menu-best']) this.dom['menu-best'].textContent = Math.floor(this.save.highScore).toLocaleString('zh-CN');
    if (this.dom['menu-distance']) this.dom['menu-distance'].textContent = `${Math.floor(this.save.bestDistance)} m`;
    if (this.dom['mute-btn']) {
      if (this.dom['audio-icon']) this.dom['audio-icon'].textContent = this.audio.isMuted() ? '×' : '♪';
      this.dom['mute-btn'].setAttribute('aria-pressed', String(this.audio.isMuted()));
    }
  }

  setOverlay(active) {
    for (const id of ['start-screen', 'pause-screen', 'revive-screen', 'result-screen']) {
      const visible = id === active;
      if (this.dom[id]) this.dom[id].hidden = !visible;
      this.dom[id]?.classList.toggle('is-visible', visible);
    }
    const hudVisible = active !== 'start-screen' && this.phase !== PHASE.MENU;
    if (this.dom.hud) this.dom.hud.hidden = !hudVisible;
    if (this.dom['mobile-controls']) this.dom['mobile-controls'].hidden = this.phase !== PHASE.PLAYING;
    document.body.dataset.phase = this.phase;
  }

  start(tour = false) {
    this.audio.unlock();
    this.audio.sfx('click');
    this.tour = tour;
    this.phase = PHASE.PLAYING;
    this.mode = MODE.NORMAL;
    this.modeTimer = 0;
    this.runTime = 0;
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.speed = 13;
    this.reviveUsed = false;
    this.reviveTimer = 0;
    this.modeHistory.clear();
    this.tourFlags = { super: false, rift: false, bonus: false };
    this.portalSchedule = { rift: 150, bonus: 390 };
    this.portalQueued = { rift: false, bonus: false };
    this.generatorIndex = 0;
    this.transitionLock = 0;
    this.currentBiome = -1;
    Object.assign(this.player, {
      y: 0, previousY: 0, vy: 0, grounded: true, jumps: 0, ducking: false, duckBlend: 0,
      coyote: 0, invincible: 1.5, shield: 0, magnet: 0, mount: 8, skill: 0,
      skillCooldown: 0, dash: 0, dashGauge: 35, superGauge: tour ? 72 : 8,
    });
    this.player.root.position.y = 0;
    this.player.visual.visible = true;
    this.pet.visible = true;
    this.shake = 0;
    if (this.dom['action-status']) this.dom['action-status'].textContent = '自动奔跑中';
    this.clearWorld();
    this.applyModeVisuals(MODE.NORMAL, true);
    this.ensureChunks(true);
    this.spawnBurst(PLAYER_X, 1.1, 0x65f4ff, 18, 5);
    this.setOverlay(null);
    this.toast(tour ? '奖励巡游：三种奖励路线将依次开启' : '远征开始 · 跃过前方障碍');
    this.updateHud(true);
  }

  goHome() {
    this.audio.sfx('click');
    this.phase = PHASE.MENU;
    this.mode = MODE.NORMAL;
    this.player.visual.visible = true;
    this.player.root.position.y = 0;
    this.player.y = 0;
    this.player.shield = 0;
    this.player.mount = 0;
    this.player.shieldMesh.visible = false;
    this.player.mountMesh.visible = false;
    this.clearWorld();
    this.applyModeVisuals(MODE.NORMAL, true);
    this.ensureChunks(true);
    this.setOverlay('start-screen');
    this.showMenuStats();
  }

  pause() {
    if (this.phase !== PHASE.PLAYING) return;
    this.phase = PHASE.PAUSED;
    this.audio.sfx('click');
    if (this.dom['pause-score']) this.dom['pause-score'].textContent = Math.floor(this.score).toLocaleString('zh-CN');
    if (this.dom['pause-distance']) this.dom['pause-distance'].textContent = String(Math.floor(this.distance));
    this.setOverlay('pause-screen');
  }

  resume() {
    if (this.phase !== PHASE.PAUSED) return;
    this.phase = PHASE.PLAYING;
    this.lastTime = performance.now();
    this.audio.sfx('click');
    this.setOverlay(null);
  }

  togglePause() {
    if (this.phase === PHASE.PLAYING) this.pause();
    else if (this.phase === PHASE.PAUSED) this.resume();
  }

  toggleMute() {
    const muted = this.audio.toggleMuted();
    this.save.muted = muted;
    safeStorageWrite(this.save);
    this.showMenuStats();
    this.toast(muted ? '音效已关闭' : '音效已开启');
  }

  jump() {
    if (this.phase !== PHASE.PLAYING || this.transitionLock > 0.35) return;
    const p = this.player;
    if (p.grounded || p.coyote > 0 || p.jumps < 2) {
      const double = !p.grounded && p.coyote <= 0;
      p.vy = double ? 13.2 : 14.4;
      p.grounded = false;
      p.coyote = 0;
      p.jumps = double ? 2 : 1;
      p.ducking = false;
      this.input.down = false;
      this.audio.sfx(double ? 'double' : 'jump');
      if (this.dom['action-status']) this.dom['action-status'].textContent = double ? '二段跳' : '跳跃';
      this.spawnBurst(PLAYER_X - 0.2, p.y + 0.25, double ? 0xff67c7 : 0x65f4ff, double ? 14 : 8, 3.5);
      if (double) {
        this.floatText('二段跃', PLAYER_X, p.y + 2.6, '#ff87dc');
        this.score += 120 * this.getMultiplier();
      }
    }
  }

  duck(forcePulse = false) {
    if (this.phase !== PHASE.PLAYING) return;
    if (!this.player.grounded) {
      this.player.vy = Math.min(this.player.vy, -15);
      this.audio.sfx('click');
      return;
    }
    this.player.ducking = true;
    if (this.dom['action-status']) this.dom['action-status'].textContent = '下蹲滑行';
    if (forcePulse) setTimeout(() => { this.player.ducking = false; }, 520);
  }

  useSkill() {
    if (this.phase !== PHASE.PLAYING) return;
    const p = this.player;
    if (p.skillCooldown > 0 || p.skill > 0) {
      this.toast(`星环技能冷却 ${Math.ceil(p.skillCooldown)}s`);
      this.audio.sfx('click');
      return;
    }
    p.skill = 3.2;
    p.skillCooldown = 13;
    p.magnet = Math.max(p.magnet, 4);
    p.invincible = Math.max(p.invincible, 3.2);
    this.audio.sfx('skill');
    if (this.dom['action-status']) this.dom['action-status'].textContent = '星环技能释放';
    this.shake = 0.25;
    this.flashScreen('#7ef7ff', 0.5);
    this.floatText('星环净空！', PLAYER_X + 1, p.y + 3.1, '#8ef9ff');
    for (const entity of [...this.entities]) {
      if (!entity.active || entity.mesh.position.x < PLAYER_X - 2 || entity.mesh.position.x > PLAYER_X + 14) continue;
      if (entity.kind === 'obstacle' || entity.kind === 'barrier' || entity.kind === 'monster') {
        this.destroyHazard(entity, 350);
      }
    }
  }

  useDash() {
    if (this.phase !== PHASE.PLAYING || this.player.dash > 0) return;
    if (this.player.dashGauge < 100) {
      this.toast(`冲刺能量 ${Math.floor(this.player.dashGauge)}%`);
      this.audio.sfx('click');
      return;
    }
    this.player.dashGauge = 0;
    this.player.dash = 2.6;
    this.player.invincible = Math.max(this.player.invincible, 2.8);
    this.audio.sfx('dash');
    if (this.dom['action-status']) this.dom['action-status'].textContent = '流星冲刺';
    this.shake = 0.35;
    this.flashScreen('#ff67d2', 0.55);
    this.floatText('流星冲刺', PLAYER_X + 1, this.player.y + 2.9, '#ff80db');
  }

  useSuper() {
    if (this.phase !== PHASE.PLAYING || this.mode !== MODE.NORMAL) return;
    if (this.player.superGauge < 100) {
      this.toast(`超级奖励充能 ${Math.floor(this.player.superGauge)}%`);
      this.audio.sfx('click');
      return;
    }
    this.enterMode(MODE.SUPER);
  }

  getMultiplier() {
    let mult = 1 + Math.min(4, Math.floor(this.combo / 10));
    if (this.mode === MODE.SUPER) mult += 4;
    else if (this.mode === MODE.RIFT) mult += 2;
    else if (this.mode === MODE.BONUS) mult += 3;
    if (this.player.mount > 0) mult += 1;
    return mult;
  }

  enterMode(mode) {
    if (this.phase !== PHASE.PLAYING || mode === MODE.NORMAL) return;
    this.mode = mode;
    if (this.tour) {
      if (mode === MODE.SUPER) this.tourFlags.super = true;
      if (mode === MODE.RIFT) this.tourFlags.rift = true;
      if (mode === MODE.BONUS) this.tourFlags.bonus = true;
    }
    this.modeTimer = MODE_INFO[mode].duration;
    this.modeHistory.add(mode);
    this.transitionLock = 0.85;
    this.player.invincible = Math.max(this.player.invincible, this.modeTimer + 0.6);
    if (mode === MODE.SUPER) this.player.superGauge = 0;
    this.clearWorld(true);
    this.applyModeVisuals(mode);
    this.ensureChunks(true);
    this.showModeBanner(mode);
    this.audio.sfx(mode === MODE.SUPER ? 'reward' : 'portal');
    this.flashScreen(MODE_INFO[mode].color, 0.8);
    this.shake = 0.55;
  }

  exitMode() {
    if (this.mode === MODE.NORMAL) return;
    const previous = this.mode;
    this.mode = MODE.NORMAL;
    this.modeTimer = 0;
    this.transitionLock = 0.8;
    this.player.invincible = Math.max(this.player.invincible, 1.2);
    this.clearWorld();
    this.applyModeVisuals(MODE.NORMAL);
    this.ensureChunks(true);
    this.audio.sfx('portal');
    this.showModeBanner(MODE.NORMAL, `${MODE_INFO[previous].label}结束 · 返回远征`);
    this.flashScreen('#67eeff', 0.55);
  }

  applyModeVisuals(mode, immediate = false) {
    this.tunnel.visible = mode === MODE.RIFT;
    this.superSun.visible = mode === MODE.SUPER;
    this.bonusDecor.visible = mode === MODE.BONUS;
    this.caveDecor.visible = mode === MODE.NORMAL && this.currentBiome > 0;
    this.farLayer.visible = mode !== MODE.RIFT;
    this.midLayer.visible = mode !== MODE.RIFT;
    document.body.dataset.mode = mode;
    if (mode === MODE.SUPER) {
      this.targetColors = { bg: 0x401b59, fog: 0x7a3659, rim: 0xffc65a };
    } else if (mode === MODE.RIFT) {
      this.targetColors = { bg: 0x030316, fog: 0x080527, rim: 0xae6dff };
    } else if (mode === MODE.BONUS) {
      this.targetColors = { bg: 0x28104b, fog: 0x663373, rim: 0xff70c7 };
    } else {
      const biome = BIOMES[Math.max(0, this.currentBiome) % BIOMES.length];
      this.targetColors = { bg: biome.bg, fog: biome.fog, rim: biome.edge };
    }
    if (immediate) {
      this.scene.background.setHex(this.targetColors.bg);
      this.scene.fog.color.setHex(this.targetColors.fog);
      this.rimLight.color.setHex(this.targetColors.rim);
    }
    this.targetBgColor = new THREE.Color(this.targetColors.bg);
    this.targetFogColor = new THREE.Color(this.targetColors.fog);
    this.targetRimColor = new THREE.Color(this.targetColors.rim);
  }

  showModeBanner(mode, override) {
    if (!this.dom['mode-banner']) return;
    const info = MODE_INFO[mode];
    if (this.dom['mode-banner-title']) this.dom['mode-banner-title'].textContent = override || info.label;
    if (this.dom['mode-banner-subtitle']) {
      this.dom['mode-banner-subtitle'].textContent = mode === MODE.SUPER
        ? '金币阵列 · 七倍表现 · 10 秒限时'
        : mode === MODE.RIFT
          ? '高速时空通道 · 三倍表现 · 全程无敌'
          : mode === MODE.BONUS
            ? '云巅独立关卡 · 四倍表现 · 礼盒雨'
            : '地形恢复 · 无限远征继续';
    }
    this.dom['mode-banner'].hidden = false;
    this.dom['mode-banner'].classList.add('is-visible');
    this.bannerTimer = 2.2;
  }

  clearWorld(reschedulePortals = false) {
    const interruptedPortals = reschedulePortals
      ? [...new Set(this.entities.filter((entity) => entity.active && entity.kind === 'portal' && !entity.entered).map((entity) => entity.portal))]
      : [];
    for (const chunk of this.chunks) this.chunkLayer.remove(chunk.group);
    this.chunks.length = 0;
    for (const entity of [...this.entities]) this.releaseEntity(entity);
    this.entities.length = 0;
    this.nextChunkX = -12;
    for (const portal of interruptedPortals) {
      this.portalQueued[portal] = false;
      this.portalSchedule[portal] = this.distance + 55;
    }
  }

  ensureChunks(initial = false) {
    const target = initial ? 86 : 70;
    while (this.nextChunkX < target) {
      this.generateChunk(this.nextChunkX, this.generatorIndex++);
      this.nextChunkX += CHUNK_LENGTH;
    }
  }

  generateChunk(startX, index) {
    const group = new THREE.Group();
    group.position.x = startX;
    this.chunkLayer.add(group);
    const chunk = { group, length: CHUNK_LENGTH, surfaces: [], index };
    this.chunks.push(chunk);

    if (this.mode !== MODE.NORMAL) {
      this.generateRewardChunk(chunk, index);
      return;
    }

    const biomeIndex = Math.floor(this.distance / 260) % BIOMES.length;
    if (biomeIndex !== this.currentBiome) {
      this.currentBiome = biomeIndex;
      this.applyModeVisuals(MODE.NORMAL);
      if (this.phase === PHASE.PLAYING && this.distance > 4) this.toast(`区域切换 · ${BIOMES[biomeIndex].label}`);
    }
    const safeStart = index < 2;
    const roll = safeStart ? 0 : (Math.sin(index * 12.9898 + this.distance * 0.07) * 43758.5453) % 1;
    const r = Math.abs(roll);
    if (safeStart || r < 0.26) this.patternFlat(chunk, index);
    else if (r < 0.48) this.patternGap(chunk, index);
    else if (r < 0.69) this.patternSteps(chunk, index);
    else if (r < 0.84) this.patternCanopy(chunk, index);
    else this.patternMonsters(chunk, index);
    this.addChunkDecor(chunk, index, biomeIndex);
  }

  groundMaterials() {
    if (this.mode === MODE.SUPER) return [this.materials.gold, this.materials.pink];
    if (this.mode === MODE.RIFT) return [this.materials.dark, this.materials.purple];
    if (this.mode === MODE.BONUS) return [this.materials.pink, this.materials.gold];
    const index = Math.max(0, this.currentBiome) % BIOMES.length;
    if (index === 1) return [this.materials.purple, this.materials.pink];
    if (index === 2) return [this.materials.navy, this.materials.green];
    return [this.materials.cyanSoft, this.materials.cyan];
  }

  addSurface(chunk, center, width, top = 0, style = 'ground') {
    const [baseMaterial, edgeMaterial] = this.groundMaterials();
    const mesh = new THREE.Group();
    const base = new THREE.Mesh(this.geometries.box, baseMaterial);
    base.scale.set(width, style === 'cloud' ? 0.45 : 1.15, style === 'cloud' ? 3.6 : 5.2);
    base.position.y = top - base.scale.y / 2;
    base.receiveShadow = true;
    const edge = new THREE.Mesh(this.geometries.box, edgeMaterial);
    edge.scale.set(width * 0.98, 0.08, style === 'cloud' ? 3.7 : 5.3);
    edge.position.y = top + 0.02;
    mesh.add(base, edge);
    if (style === 'cloud') {
      for (let i = 0; i < Math.ceil(width / 2); i += 1) {
        const puff = new THREE.Mesh(this.geometries.sphere, this.materials.white);
        puff.scale.set(1.1, 0.34, 1.2);
        puff.position.set(-width / 2 + 1 + i * 2, top - 0.18, (i % 2 ? 1 : -1) * 0.7);
        mesh.add(puff);
      }
    }
    mesh.position.x = center;
    chunk.group.add(mesh);
    chunk.surfaces.push({ localX: center, width, top, style });
  }

  addChunkDecor(chunk, index, biomeIndex) {
    if (index % 2 !== 0) return;
    if (biomeIndex === 0) {
      const crystal = new THREE.Mesh(this.geometries.cone, this.materials.cyan);
      crystal.scale.set(0.35, 1.5, 0.35);
      crystal.position.set(3 + (index % 4) * 3, 0.7, -3.7);
      chunk.group.add(crystal);
    } else if (biomeIndex === 1) {
      const sign = new THREE.Group();
      const pole = new THREE.Mesh(this.geometries.box, this.materials.dark);
      pole.scale.set(0.12, 2.8, 0.12);
      pole.position.y = 1.3;
      const panel = new THREE.Mesh(this.geometries.signPanel, this.materials.pink);
      panel.position.y = 2.4;
      sign.add(pole, panel);
      sign.position.set(5, 0, -3.4);
      chunk.group.add(sign);
    } else {
      for (let i = 0; i < 3; i += 1) {
        const crystal = new THREE.Mesh(this.geometries.cone, i % 2 ? this.materials.green : this.materials.purple);
        crystal.scale.set(0.4 + i * 0.15, 1.2 + i * 0.5, 0.45);
        crystal.position.set(4 + i * 1.1, 0.4, -3.5);
        chunk.group.add(crystal);
      }
    }
  }

  patternFlat(chunk, index) {
    this.addSurface(chunk, 12, 24, 0);
    if (index < 2) {
      this.spawnCoinLine(chunk.group.position.x + 8, 0.9, 8, 1.25);
      if (index === 1) this.spawnEntity('power', chunk.group.position.x + 18, 1.1, { power: 'shield' });
      return;
    }
    const variant = index % 4;
    if (variant === 0) {
      this.spawnEntity('obstacle', chunk.group.position.x + 12, 0, {});
      this.spawnCoinArc(chunk.group.position.x + 7, 0.9, 10, 1.05, 2.7);
    } else if (variant === 1) {
      this.spawnEntity('barrier', chunk.group.position.x + 13, 0, {});
      this.spawnCoinLine(chunk.group.position.x + 4, 1.05, 6, 1.1);
      this.spawnCoinLine(chunk.group.position.x + 16.5, 0.75, 5, 1.05);
    } else if (variant === 2) {
      this.spawnCoinWave(chunk.group.position.x + 3, 1.1, 14, 1.25, 1.25);
      if (index % 8 === 2) this.spawnEntity('power', chunk.group.position.x + 19, 1.05, { power: 'magnet' });
    } else {
      this.spawnEntity('monster', chunk.group.position.x + 11.5, 0, {});
      this.spawnCoinArc(chunk.group.position.x + 7, 1, 9, 1.1, 2.2);
    }
  }

  patternGap(chunk, index) {
    const gap = 3.1 + (index % 3) * 0.35;
    this.addSurface(chunk, 4.6, 9.2, 0);
    this.addSurface(chunk, 9.2 + gap + (14.8 - gap) / 2, 14.8 - gap, 0);
    this.spawnCoinArc(chunk.group.position.x + 6.4, 0.95, 9, 0.95, 3.15);
    if (index % 2 === 0) this.spawnEntity('monster', chunk.group.position.x + 17.8, 0, {});
    else this.spawnCoinLine(chunk.group.position.x + 15.5, 1, 5, 1.05);
  }

  patternSteps(chunk, index) {
    this.addSurface(chunk, 3.2, 6.4, 0);
    this.addSurface(chunk, 8.2, 3.6, 0.72);
    this.addSurface(chunk, 12.1, 4.2, 1.42);
    this.addSurface(chunk, 17.8, 7.2, 0);
    this.spawnCoinLine(chunk.group.position.x + 5.8, 1.2, 4, 1.05, 0.55);
    this.spawnCoinLine(chunk.group.position.x + 10.2, 2.45, 4, 0.95);
    this.spawnCoinArc(chunk.group.position.x + 15, 1, 7, 0.9, 2.3);
  }

  patternCanopy(chunk, index) {
    this.addSurface(chunk, 12, 24, 0);
    this.addSurface(chunk, 11.5, 7.5, 2.7, 'cloud');
    this.spawnCoinArc(chunk.group.position.x + 5.4, 0.9, 10, 1.05, 3.6);
    this.spawnCoinLine(chunk.group.position.x + 9, 3.65, 6, 1.05);
    if (index % 2 === 0) this.spawnEntity('barrier', chunk.group.position.x + 20, 0, {});
  }

  patternMonsters(chunk, index) {
    this.addSurface(chunk, 12, 24, 0);
    this.spawnEntity('monster', chunk.group.position.x + 8, 0, {});
    this.spawnEntity('monster', chunk.group.position.x + 15.5, 0, { color: 'purple' });
    this.spawnCoinArc(chunk.group.position.x + 4.8, 1, 8, 1, 2.25);
    this.spawnCoinArc(chunk.group.position.x + 12.3, 1, 8, 1, 2.25);
    if (index % 5 === 0) this.spawnEntity('power', chunk.group.position.x + 21, 1, { power: 'mount' });
  }

  generateRewardChunk(chunk, index) {
    if (this.mode === MODE.SUPER) {
      this.addSurface(chunk, 12, 24, 0, 'cloud');
      for (let row = 0; row < 3; row += 1) {
        this.spawnCoinWave(chunk.group.position.x + 2 + row * 0.35, 1 + row * 1.05, 14, 1.35, 0.55);
      }
      if (index % 2 === 0) this.spawnEntity('gift', chunk.group.position.x + 20, 1.1, {});
    } else if (this.mode === MODE.RIFT) {
      this.addSurface(chunk, 12, 24, -0.15);
      this.spawnCoinWave(chunk.group.position.x + 2, 1.1, 16, 1.25, 2.2);
      this.spawnCoinWave(chunk.group.position.x + 2.6, 3.3, 16, 1.25, 2.1);
      if (index % 2 === 0) this.spawnEntity('riftOrb', chunk.group.position.x + 20, 2.25, {});
    } else {
      const gap = index % 2 ? 3 : 2.4;
      this.addSurface(chunk, 4.8, 9.6, 0, 'cloud');
      this.addSurface(chunk, 9.6 + gap + (14.4 - gap) / 2, 14.4 - gap, 0, 'cloud');
      this.addSurface(chunk, 12.5, 6.5, 3.1, 'cloud');
      this.spawnCoinArc(chunk.group.position.x + 5.5, 1, 11, 1.05, 3.7);
      this.spawnCoinLine(chunk.group.position.x + 9.4, 4.05, 7, 1.05);
      this.spawnEntity('gift', chunk.group.position.x + 19.5, 1.1, {});
    }
  }

  spawnCoinLine(startX, y, count, gap = 1.1, yStep = 0) {
    for (let i = 0; i < count; i += 1) this.spawnEntity('coin', startX + i * gap, y + i * yStep, {});
  }

  spawnCoinArc(startX, y, count, gap = 1.1, height = 2.5) {
    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0 : i / (count - 1);
      this.spawnEntity('coin', startX + i * gap, y + Math.sin(t * Math.PI) * height, {});
    }
  }

  spawnCoinWave(startX, y, count, gap = 1.1, amplitude = 1.2) {
    for (let i = 0; i < count; i += 1) {
      this.spawnEntity('coin', startX + i * gap, y + Math.sin(i * 0.72) * amplitude, {});
    }
  }

  createEntityMesh(kind, data) {
    const group = new THREE.Group();
    if (kind === 'coin') {
      const coin = new THREE.Mesh(this.geometries.coin, this.materials.gold);
      coin.position.y = 0.44;
      coin.rotation.y = Math.PI / 2;
      const core = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshBasicMaterial({ color: 0xfff3a5, side: THREE.DoubleSide }));
      core.position.set(0, 0.44, 0);
      group.add(coin, core);
    } else if (kind === 'obstacle') {
      const block = roundedBox(1.05, 1.35, 1.1, 0.15, this.materials.orange);
      block.position.y = 0.675;
      block.rotation.z = 0.05;
      const stripeA = new THREE.Mesh(this.geometries.box, this.materials.gold);
      stripeA.scale.set(1.12, 0.13, 1.15);
      stripeA.position.y = 0.55;
      const stripeB = stripeA.clone();
      stripeB.position.y = 0.93;
      group.add(block, stripeA, stripeB);
    } else if (kind === 'barrier') {
      const left = new THREE.Mesh(this.geometries.box, this.materials.dark);
      left.scale.set(0.18, 2.15, 0.5);
      left.position.set(-0.85, 1.05, 0);
      const right = left.clone();
      right.position.x = 0.85;
      const beam = roundedBox(2, 0.6, 0.72, 0.1, this.materials.red);
      beam.position.y = 1.48;
      const stripe = new THREE.Mesh(this.geometries.box, this.materials.gold);
      stripe.scale.set(1.8, 0.09, 0.78);
      stripe.position.y = 1.48;
      group.add(left, right, beam, stripe);
    } else if (kind === 'monster') {
      const body = new THREE.Mesh(this.geometries.lowSphere, data.color === 'purple' ? this.materials.purple : this.materials.green);
      body.scale.set(0.9, 0.78, 0.72);
      body.position.y = 0.73;
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eye1 = new THREE.Mesh(this.geometries.sphere, eyeMat);
      eye1.scale.setScalar(0.16);
      eye1.position.set(0.48, 0.86, 0.26);
      const eye2 = eye1.clone();
      eye2.position.z = -0.24;
      const horn = new THREE.Mesh(this.geometries.cone, this.materials.gold);
      horn.scale.set(0.22, 0.6, 0.22);
      horn.position.set(0.02, 1.42, 0);
      group.add(body, eye1, eye2, horn);
    } else if (kind === 'power') {
      const colorMat = data.power === 'shield' ? this.materials.cyan : data.power === 'magnet' ? this.materials.pink : this.materials.purple;
      const outer = new THREE.Mesh(new THREE.OctahedronGeometry(0.57, 0), colorMat);
      outer.position.y = 0.65;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 6, 24), this.materials.white);
      ring.position.y = 0.65;
      ring.rotation.x = Math.PI / 2;
      group.add(outer, ring);
    } else if (kind === 'portal') {
      const mat = data.portal === MODE.RIFT ? this.materials.purple : this.materials.pink;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.22, 10, 32), mat);
      ring.position.y = 2.15;
      const inner = new THREE.Mesh(new THREE.CircleGeometry(1.78, 32), new THREE.MeshBasicMaterial({ color: data.portal === MODE.RIFT ? 0x7a39ff : 0xff62bb, transparent: true, opacity: 0.2, side: THREE.DoubleSide }));
      inner.position.y = 2.15;
      const label = makeTextSprite(data.portal === MODE.RIFT ? '穿越' : '奖励关', '#ffffff', 74);
      label.position.y = 4.7;
      group.add(ring, inner, label);
    } else if (kind === 'gift') {
      const box = roundedBox(0.9, 0.82, 0.85, 0.12, this.materials.pink);
      box.position.y = 0.55;
      const ribbonV = new THREE.Mesh(this.geometries.box, this.materials.gold);
      ribbonV.scale.set(0.17, 0.9, 0.92);
      ribbonV.position.y = 0.55;
      const ribbonH = new THREE.Mesh(this.geometries.box, this.materials.gold);
      ribbonH.scale.set(0.96, 0.15, 0.92);
      ribbonH.position.y = 0.58;
      group.add(box, ribbonV, ribbonH);
    } else if (kind === 'riftOrb') {
      const outer = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), this.materials.purple);
      outer.position.y = 0.62;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.055, 6, 20), this.materials.cyan);
      ring.position.y = 0.62;
      ring.rotation.x = Math.PI / 2;
      group.add(outer, ring);
    }
    group.visible = false;
    this.entityLayer.add(group);
    return group;
  }

  entityDimensions(kind) {
    if (kind === 'coin') return { w: 0.72, h: 0.88 };
    if (kind === 'obstacle') return { w: 0.96, h: 1.27 };
    if (kind === 'barrier') return { w: 1.75, h: 0.62, bottomOffset: 1.18 };
    if (kind === 'monster') return { w: 1.3, h: 1.35 };
    if (kind === 'portal') return { w: 1.5, h: 4.25 };
    return { w: 1.05, h: 1.2 };
  }

  spawnEntity(kind, x, y, data = {}) {
    const key = kind === 'power' ? `${kind}-${data.power}` : kind === 'portal' ? `${kind}-${data.portal}` : kind;
    if (!this.entityPools.has(key)) this.entityPools.set(key, []);
    const pool = this.entityPools.get(key);
    let entity = pool.find((item) => !item.active);
    if (!entity) {
      const mesh = this.createEntityMesh(kind, data);
      entity = { mesh, kind, key, active: false };
      pool.push(entity);
    }
    Object.assign(entity, this.entityDimensions(kind), data, {
      kind, key, active: true, baseY: y, age: 0, collected: false, entered: false,
    });
    entity.mesh.position.set(x, y, kind === 'portal' ? -0.15 : 0);
    entity.mesh.rotation.set(0, 0, 0);
    entity.mesh.scale.setScalar(1);
    entity.mesh.visible = true;
    this.entities.push(entity);
    return entity;
  }

  releaseEntity(entity) {
    entity.active = false;
    entity.mesh.visible = false;
    const at = this.entities.indexOf(entity);
    if (at >= 0) this.entities.splice(at, 1);
  }

  destroyHazard(entity, points = 250) {
    if (!entity.active) return;
    this.score += points * this.getMultiplier();
    this.combo += 2;
    this.maxCombo = Math.max(this.maxCombo || 0, this.combo);
    this.comboTimer = 2.5;
    this.spawnBurst(entity.mesh.position.x, entity.baseY + entity.h * 0.6, entity.kind === 'monster' ? 0x67ffad : 0xff755d, 16, 6);
    this.floatText(`+${points * this.getMultiplier()}`, entity.mesh.position.x, entity.baseY + 2, '#fff08b');
    this.releaseEntity(entity);
  }

  updateWorld(dt) {
    const p = this.player;
    const baseSpeed = 13 + Math.min(12, this.distance / 190);
    let targetSpeed = baseSpeed;
    if (p.dash > 0) targetSpeed += 11;
    if (p.mount > 0) targetSpeed += 1.7;
    if (this.mode === MODE.RIFT) targetSpeed = 34 + Math.min(7, this.distance / 350);
    else if (this.mode === MODE.SUPER) targetSpeed += 4;
    else if (this.mode === MODE.BONUS) targetSpeed += 2;
    this.speed = lerp(this.speed, targetSpeed, 1 - Math.exp(-dt * 2.8));
    const scroll = this.speed * dt;
    this.distance += this.speed * dt * 0.78;
    this.score += this.speed * dt * 9.5 * this.getMultiplier();

    for (const chunk of this.chunks) chunk.group.position.x -= scroll;
    for (let i = this.chunks.length - 1; i >= 0; i -= 1) {
      const chunk = this.chunks[i];
      if (chunk.group.position.x + chunk.length < -22) {
        this.chunkLayer.remove(chunk.group);
        this.chunks.splice(i, 1);
      }
    }
    this.nextChunkX -= scroll;
    this.ensureChunks();

    for (let i = this.entities.length - 1; i >= 0; i -= 1) {
      const entity = this.entities[i];
      if (!entity.active) continue;
      entity.age += dt;
      entity.mesh.position.x -= scroll;
      this.animateEntity(entity, dt);
      if (entity.mesh.position.x < -18) {
        if (entity.kind === 'portal') {
          this.portalQueued[entity.portal] = false;
          this.portalSchedule[entity.portal] = this.distance + 55;
        }
        this.releaseEntity(entity);
      }
    }
  }

  animateEntity(entity, dt) {
    const mesh = entity.mesh;
    if (entity.kind === 'coin') {
      mesh.rotation.y += dt * 4.8;
      mesh.position.y = entity.baseY + Math.sin(entity.age * 5 + mesh.position.x) * 0.08;
    } else if (entity.kind === 'monster') {
      mesh.position.y = entity.baseY + Math.abs(Math.sin(entity.age * 4.5)) * 0.12;
      mesh.rotation.z = Math.sin(entity.age * 4.5) * 0.08;
    } else if (entity.kind === 'power' || entity.kind === 'gift' || entity.kind === 'riftOrb') {
      mesh.rotation.y += dt * 1.8;
      mesh.position.y = entity.baseY + Math.sin(entity.age * 3.4) * 0.15;
    } else if (entity.kind === 'portal') {
      mesh.children[0].rotation.z += dt * 1.6;
      if (mesh.children[1]) mesh.children[1].rotation.z -= dt * 0.4;
      const pulse = 1 + Math.sin(entity.age * 4) * 0.035;
      mesh.scale.setScalar(pulse);
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    p.previousY = p.y;
    p.invincible = Math.max(0, p.invincible - dt);
    p.shield = Math.max(0, p.shield - dt);
    p.magnet = Math.max(0, p.magnet - dt);
    p.mount = Math.max(0, p.mount - dt);
    p.skill = Math.max(0, p.skill - dt);
    p.skillCooldown = Math.max(0, p.skillCooldown - dt);
    p.dash = Math.max(0, p.dash - dt);
    p.coyote = Math.max(0, p.coyote - dt);
    this.transitionLock = Math.max(0, this.transitionLock - dt);
    const shouldDuck = (this.input.down || p.ducking) && p.grounded;
    p.duckBlend = lerp(p.duckBlend, shouldDuck ? 1 : 0, 1 - Math.exp(-dt * 15));

    if (!p.grounded) {
      p.vy -= (this.mode === MODE.RIFT ? 31 : 38) * dt;
      p.y += p.vy * dt;
    }

    let landed = false;
    let supportTop = -Infinity;
    for (const chunk of this.chunks) {
      for (const surface of chunk.surfaces) {
        const center = chunk.group.position.x + surface.localX;
        if (PLAYER_X < center - surface.width / 2 - 0.2 || PLAYER_X > center + surface.width / 2 + 0.2) continue;
        if (surface.top > supportTop && p.y >= surface.top - 0.14) supportTop = surface.top;
        if (p.vy <= 0 && p.previousY >= surface.top - 0.05 && p.y <= surface.top + 0.13) {
          p.y = surface.top;
          p.vy = 0;
          p.grounded = true;
          p.jumps = 0;
          p.coyote = 0.08;
          landed = true;
        }
      }
    }

    if (p.grounded && !landed) {
      if (supportTop > -Infinity && Math.abs(p.y - supportTop) < 0.24) {
        p.y = supportTop;
        p.vy = 0;
      } else {
        p.grounded = false;
        p.coyote = 0.11;
      }
    }

    if (p.y < -7 && this.mode !== MODE.RIFT) {
      this.takeHit('坠入云海');
      return;
    }
    if (this.mode === MODE.RIFT && p.y < 0) {
      p.y = 0;
      p.vy = 8;
    }

    p.root.position.y = p.y;
    p.root.position.x = PLAYER_X + (p.dash > 0 ? 0.38 : 0);
    p.runCycle += dt * (8 + this.speed * 0.36);
    this.animatePlayer(dt, shouldDuck);
  }

  animatePlayer(dt, ducking) {
    const p = this.player;
    const cycle = p.runCycle;
    const air = p.grounded ? 0 : 1;
    const stride = Math.sin(cycle) * (1 - air) * (1 - p.duckBlend);
    p.limbs.legFront.rotation.z = stride * 0.95 - air * 0.25;
    p.limbs.legBack.rotation.z = -stride * 0.95 + air * 0.55;
    p.limbs.armFront.rotation.z = -stride * 0.72 - 0.18;
    p.limbs.armBack.rotation.z = stride * 0.72 + 0.18;
    p.parts.torso.rotation.z = lerp(p.parts.torso.rotation.z, ducking ? -0.95 : p.dash > 0 ? -0.38 : -0.08, 1 - Math.exp(-dt * 10));
    p.parts.torso.position.y = lerp(p.parts.torso.position.y, ducking ? 0.98 : 1.48, 1 - Math.exp(-dt * 11));
    p.parts.head.position.y = lerp(p.parts.head.position.y, ducking ? 1.42 : 2.18, 1 - Math.exp(-dt * 11));
    p.parts.head.rotation.z = Math.sin(cycle * 0.5) * 0.035;
    p.visual.position.y = (p.grounded ? Math.abs(Math.sin(cycle)) * 0.05 : 0) + (p.mount > 0 ? 0.3 : 0);
    p.visual.scale.y = lerp(p.visual.scale.y, p.grounded ? 1 : 0.94, 1 - Math.exp(-dt * 8));
    for (const segment of p.parts.scarf.children) {
      const index = segment.userData.index;
      segment.rotation.z = Math.sin(cycle * 0.72 - index * 0.8) * 0.18 + 0.08;
      segment.position.y = 1.86 - index * 0.08 + Math.sin(cycle * 0.68 - index) * 0.05;
    }
    p.mountMesh.visible = p.mount > 0;
    p.mountMesh.position.y = 0.08 + Math.sin(cycle * 0.4) * 0.06;
    p.mountMesh.rotation.z = Math.sin(cycle * 0.28) * 0.035;
    p.shieldMesh.visible = p.shield > 0;
    p.shieldMesh.rotation.y += dt * 0.7;
    const blink = p.invincible > 0 && p.shield <= 0 && Math.floor(p.invincible * 12) % 2 === 0;
    p.visual.visible = !blink;

    const petTargetX = PLAYER_X - 1.65 - (p.dash > 0 ? 0.7 : 0);
    const petTargetY = p.y + 2.15 + Math.sin(this.runTime * 4) * 0.22;
    this.pet.position.x = lerp(this.pet.position.x, petTargetX, 1 - Math.exp(-dt * 6));
    this.pet.position.y = lerp(this.pet.position.y, petTargetY, 1 - Math.exp(-dt * 5));
    this.pet.rotation.z = Math.sin(this.runTime * 4) * 0.12;
  }

  playerRect() {
    const duck = this.player.duckBlend > 0.48;
    return {
      left: PLAYER_X - 0.4,
      right: PLAYER_X + 0.47,
      bottom: this.player.y + 0.08,
      top: this.player.y + (duck ? 1.18 : 2.38),
    };
  }

  overlaps(entity, rect, margin = 0) {
    const left = entity.mesh.position.x - entity.w / 2 + margin;
    const right = entity.mesh.position.x + entity.w / 2 - margin;
    const bottom = entity.baseY + (entity.bottomOffset || 0) + margin;
    const top = bottom + entity.h - margin;
    return rect.right > left && rect.left < right && rect.top > bottom && rect.bottom < top;
  }

  updateCollisions(dt) {
    const rect = this.playerRect();
    for (const entity of [...this.entities]) {
      if (!entity.active || entity.mesh.position.x < PLAYER_X - 2.3 || entity.mesh.position.x > PLAYER_X + 5.8) continue;
      if (entity.kind === 'coin') {
        const dx = entity.mesh.position.x - PLAYER_X;
        const dy = entity.mesh.position.y + 0.44 - (this.player.y + 1.2);
        const radius = this.player.magnet > 0 || this.player.skill > 0 ? 5.2 : 1.5;
        if (dx * dx + dy * dy < radius * radius) {
          if (radius > 2 && Math.abs(dx) > 0.7) {
            entity.mesh.position.x = lerp(entity.mesh.position.x, PLAYER_X, 1 - Math.exp(-dt * 12));
            entity.baseY = lerp(entity.baseY, this.player.y + 0.8, 1 - Math.exp(-dt * 12));
          }
          if (Math.abs(entity.mesh.position.x - PLAYER_X) < 0.75 && Math.abs(entity.mesh.position.y + 0.44 - (this.player.y + 1.2)) < 1.25) this.collectCoin(entity);
        }
        continue;
      }
      if (!this.overlaps(entity, rect, entity.kind === 'portal' ? 0 : 0.04)) continue;
      if (entity.kind === 'monster') {
        const monsterTop = entity.baseY + entity.h;
        if (this.player.vy < -1.5 && this.player.previousY + 0.1 >= monsterTop - 0.32) {
          this.player.y = monsterTop;
          this.player.vy = 11.6;
          this.player.grounded = false;
          this.player.jumps = 1;
          this.audio.sfx('stomp');
          this.destroyHazard(entity, 420);
          this.player.superGauge = Math.min(100, this.player.superGauge + 14);
          this.shake = 0.2;
        } else if (this.player.invincible > 0 || this.player.dash > 0 || this.player.skill > 0 || this.mode !== MODE.NORMAL) {
          this.destroyHazard(entity, 260);
        } else this.takeHit('撞上巡逻怪物');
      } else if (entity.kind === 'obstacle' || entity.kind === 'barrier') {
        if (this.player.invincible > 0 || this.player.dash > 0 || this.player.skill > 0 || this.mode !== MODE.NORMAL) this.destroyHazard(entity, 220);
        else this.takeHit(entity.kind === 'barrier' ? '没有及时下蹲' : '撞上能量路障');
      } else if (entity.kind === 'power') {
        this.collectPower(entity);
      } else if (entity.kind === 'portal') {
        const target = entity.portal;
        entity.entered = true;
        this.releaseEntity(entity);
        this.enterMode(target);
      } else if (entity.kind === 'gift') {
        this.audio.sfx('reward');
        this.coins += 12;
        this.score += 1600 * this.getMultiplier();
        this.player.dashGauge = Math.min(100, this.player.dashGauge + 24);
        this.spawnBurst(entity.mesh.position.x, entity.baseY + 0.6, 0xffd45f, 24, 8);
        this.floatText('惊喜礼盒 +12', entity.mesh.position.x, entity.baseY + 2.2, '#ffe386');
        this.releaseEntity(entity);
      } else if (entity.kind === 'riftOrb') {
        this.audio.sfx('coin');
        this.coins += 5;
        this.score += 900 * this.getMultiplier();
        this.spawnBurst(entity.mesh.position.x, entity.baseY + 0.6, 0xad75ff, 18, 7);
        this.releaseEntity(entity);
      }
    }
  }

  collectCoin(entity) {
    if (!entity.active) return;
    this.coins += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo || 0, this.combo);
    this.comboTimer = 2.35;
    const value = 100 * this.getMultiplier();
    this.score += value;
    if (this.mode === MODE.NORMAL) this.player.superGauge = Math.min(100, this.player.superGauge + 4.1);
    this.player.dashGauge = Math.min(100, this.player.dashGauge + 3.2);
    if (this.coins % 18 === 0 && this.player.shield <= 0) {
      this.player.shield = 5;
      this.audio.sfx('shield');
      this.floatText('宠物守护', PLAYER_X - 0.5, this.player.y + 3, '#ff96de');
    } else this.audio.sfx('coin');
    this.spawnBurst(entity.mesh.position.x, entity.baseY + 0.45, 0xffd45f, 5, 2.7);
    this.releaseEntity(entity);
  }

  collectPower(entity) {
    const power = entity.power;
    if (power === 'shield') {
      this.player.shield = 10;
      this.floatText('护盾 10s', entity.mesh.position.x, entity.baseY + 2, '#7cfcff');
      this.audio.sfx('shield');
    } else if (power === 'magnet') {
      this.player.magnet = 10;
      this.floatText('磁铁 10s', entity.mesh.position.x, entity.baseY + 2, '#ff83d3');
      this.audio.sfx('skill');
    } else {
      this.player.mount = 15;
      this.player.invincible = Math.max(this.player.invincible, 1);
      this.floatText('星焰坐骑 15s', entity.mesh.position.x, entity.baseY + 2, '#b888ff');
      this.audio.sfx('dash');
    }
    this.score += 500 * this.getMultiplier();
    this.spawnBurst(entity.mesh.position.x, entity.baseY + 0.7, power === 'shield' ? 0x63efff : power === 'magnet' ? 0xff62c3 : 0xa66fff, 20, 6);
    this.releaseEntity(entity);
  }

  takeHit(reason) {
    if (this.phase !== PHASE.PLAYING) return;
    if (this.tour && (this.mode !== MODE.NORMAL || this.modeHistory.size < 3)) {
      if (reason === '坠入云海') {
        this.player.y = 1.8;
        this.player.vy = 3;
        this.player.grounded = false;
      }
      this.player.invincible = Math.max(this.player.invincible, 1.4);
      this.clearNearbyHazards(4.5);
      this.spawnBurst(PLAYER_X, this.player.y + 1, 0x74efff, 12, 4);
      this.toast('巡游导航已自动校正航线');
      return;
    }
    if (this.player.shield > 0) {
      this.player.shield = 0;
      this.player.invincible = 1.4;
      if (reason === '坠入云海') {
        this.player.y = 1.8;
        this.player.vy = 3;
        this.player.grounded = false;
      }
      this.audio.sfx('shield');
      this.shake = 0.65;
      this.flashScreen('#74efff', 0.6);
      this.toast('护盾抵消了伤害');
      this.clearNearbyHazards(4.5);
      return;
    }
    this.audio.sfx('hit');
    this.shake = 1;
    this.flashScreen('#ff365e', 0.85);
    this.downReason = reason;
    if (!this.reviveUsed) {
      this.phase = PHASE.DOWNED;
      this.reviveTimer = 30;
      this.player.visual.visible = true;
      if (this.dom['revive-note']) this.dom['revive-note'].textContent = `${reason} · 本局仍可复活一次`;
      this.setOverlay('revive-screen');
    } else this.finishRun();
  }

  clearNearbyHazards(range = 7) {
    for (const entity of [...this.entities]) {
      if (['obstacle', 'barrier', 'monster'].includes(entity.kind) && Math.abs(entity.mesh.position.x - PLAYER_X) < range) {
        this.destroyHazard(entity, 80);
      }
    }
  }

  revive() {
    if (this.phase !== PHASE.DOWNED || this.reviveUsed) return;
    this.reviveUsed = true;
    this.phase = PHASE.PLAYING;
    this.player.y = 1.5;
    this.player.vy = 0;
    this.player.grounded = false;
    this.player.jumps = 0;
    this.player.invincible = 4;
    this.player.shield = 4;
    this.clearWorld(true);
    this.generatorIndex = 0;
    this.ensureChunks(true);
    this.audio.sfx('revive');
    this.spawnBurst(PLAYER_X, 1.5, 0xffd45f, 34, 9);
    this.flashScreen('#fff1a3', 0.85);
    this.setOverlay(null);
    this.toast('星光复苏 · 4 秒守护');
  }

  finishRun() {
    if (![PHASE.PLAYING, PHASE.DOWNED].includes(this.phase)) return;
    this.phase = PHASE.RESULTS;
    this.audio.sfx('gameover');
    const finalScore = Math.floor(this.score);
    const finalDistance = Math.floor(this.distance);
    const isNewBest = finalScore > (this.save.highScore || 0);
    this.save.highScore = Math.max(this.save.highScore || 0, finalScore);
    this.save.bestDistance = Math.max(this.save.bestDistance || 0, finalDistance);
    this.save.totalCoins = (this.save.totalCoins || 0) + this.coins;
    safeStorageWrite(this.save);
    if (this.dom['final-score']) this.dom['final-score'].textContent = finalScore.toLocaleString('zh-CN');
    if (this.dom['final-distance']) this.dom['final-distance'].textContent = String(finalDistance);
    if (this.dom['final-coins']) this.dom['final-coins'].textContent = String(this.coins);
    if (this.dom['final-best']) this.dom['final-best'].textContent = Math.floor(this.save.highScore).toLocaleString('zh-CN');
    if (this.dom['final-combo']) this.dom['final-combo'].textContent = String(this.maxCombo || 0);
    if (this.dom['new-best-badge']) this.dom['new-best-badge'].hidden = !isNewBest;
    if (this.dom['reward-crystals']) this.dom['reward-crystals'].textContent = String(this.coins);
    if (this.dom['reward-starlight']) this.dom['reward-starlight'].textContent = String(this.modeHistory.size);
    if (this.dom['mode-banner']) this.dom['mode-banner'].hidden = true;
    this.setOverlay('result-screen');
    this.showMenuStats();
  }

  schedulePortals() {
    if (this.mode !== MODE.NORMAL || this.phase !== PHASE.PLAYING) return;
    if (!this.portalQueued.rift && this.distance >= this.portalSchedule.rift - 24) {
      this.portalQueued.rift = true;
      this.spawnEntity('portal', 58, 0, { portal: MODE.RIFT });
      this.toast('时空门正在接近 · 穿越奖励');
    }
    if (!this.portalQueued.bonus && this.distance >= this.portalSchedule.bonus - 24) {
      this.portalQueued.bonus = true;
      this.spawnEntity('portal', 58, 0, { portal: MODE.BONUS });
      this.toast('云巅入口正在接近 · 奖励关卡');
    }
    if (this.distance > this.portalSchedule.rift + 80) {
      this.portalSchedule.rift += 520;
      this.portalQueued.rift = false;
    }
    if (this.distance > this.portalSchedule.bonus + 80) {
      this.portalSchedule.bonus += 520;
      this.portalQueued.bonus = false;
    }
  }

  updateTour() {
    if (!this.tour || this.mode !== MODE.NORMAL || this.transitionLock > 0) return;
    if (!this.modeHistory.has(MODE.SUPER) && this.runTime > 4.2) {
      this.player.superGauge = 100;
      this.enterMode(MODE.SUPER);
    } else if (!this.modeHistory.has(MODE.RIFT) && this.modeHistory.has(MODE.SUPER) && this.runTime > 15.2) {
      this.enterMode(MODE.RIFT);
    } else if (!this.modeHistory.has(MODE.BONUS) && this.modeHistory.has(MODE.RIFT) && this.runTime > 25.5) {
      this.enterMode(MODE.BONUS);
    }
  }

  updateModes(dt) {
    if (this.mode !== MODE.NORMAL) {
      this.modeTimer -= dt;
      if (this.modeTimer <= 0) this.exitMode();
    } else if (this.player.superGauge >= 100 && (!this.tour || this.modeHistory.has(MODE.BONUS))) {
      this.superReadyTime = (this.superReadyTime || 0) + dt;
      if (this.superReadyTime > 5.5) this.enterMode(MODE.SUPER);
    } else this.superReadyTime = 0;
    this.schedulePortals();
    this.updateTour();
  }

  updateEnvironment(dt) {
    const speed = this.phase === PHASE.PLAYING ? this.speed : 4;
    for (const layer of [this.farLayer, this.midLayer]) {
      for (const item of layer.children) {
        item.position.x -= speed * dt * (item.userData.speed || 0.1);
        if (item.position.x < -52) item.position.x += 96;
      }
    }
    this.starField.rotation.y += dt * 0.004;
    if (this.tunnel.visible) {
      for (let i = 0; i < 17; i += 1) {
        const ring = this.tunnel.children[i];
        ring.position.x -= speed * dt * 1.45;
        if (ring.position.x < -16) ring.position.x += 62.9;
        ring.rotation.x += dt * 0.18;
      }
      for (let i = 17; i < this.tunnel.children.length; i += 1) {
        const streak = this.tunnel.children[i];
        streak.position.x -= speed * dt * 2.2;
        if (streak.position.x < -18) streak.position.x += 46;
      }
      this.tunnel.rotation.x = Math.sin(this.runTime * 0.7) * 0.03;
    }
    if (this.superSun.visible) {
      this.superSun.rotation.z += dt * 0.035;
      this.superSun.children[1].scale.setScalar(1 + Math.sin(this.runTime * 2) * 0.08);
    }
    if (this.bonusDecor.visible) {
      for (let i = 0; i < this.bonusDecor.children.length; i += 1) {
        const orb = this.bonusDecor.children[i];
        orb.position.x -= speed * dt * 0.35;
        if (orb.position.x < -18) orb.position.x += 37;
        orb.position.y += Math.sin(this.runTime * 2 + i) * dt * 0.14;
        orb.rotation.y += dt;
      }
    }
    if (this.caveDecor.visible) {
      for (const tooth of this.caveDecor.children) {
        tooth.position.x -= speed * dt * (tooth.userData.speed || 0.25);
        if (tooth.position.x < -24) tooth.position.x += 52.5;
      }
    }
    if (this.targetColors) {
      this.scene.background.lerp(this.targetBgColor, 1 - Math.exp(-dt * 2));
      this.scene.fog.color.lerp(this.targetFogColor, 1 - Math.exp(-dt * 2));
      this.rimLight.color.lerp(this.targetRimColor, 1 - Math.exp(-dt * 3));
    }
  }

  spawnBurst(x, y, color, count = 10, speed = 4) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    for (let i = 0; i < count; i += 1) {
      let particle = this.particles.find((item) => !item.active);
      if (!particle) {
        const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), material.clone());
        mesh.visible = false;
        this.fxLayer.add(mesh);
        particle = { mesh, active: false };
        this.particles.push(particle);
      }
      particle.active = true;
      particle.life = 0.45 + Math.random() * 0.55;
      particle.maxLife = particle.life;
      particle.mesh.visible = true;
      particle.mesh.material.color.setHex(color);
      particle.mesh.material.opacity = 1;
      particle.mesh.position.set(x, y, (Math.random() - 0.5) * 1.5);
      const angle = Math.random() * TAU;
      particle.vx = Math.cos(angle) * speed * (0.25 + Math.random());
      particle.vy = Math.sin(angle) * speed * (0.25 + Math.random()) + 1;
      particle.vz = (Math.random() - 0.5) * speed;
    }
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        particle.mesh.visible = false;
        continue;
      }
      particle.vy -= 8 * dt;
      particle.mesh.position.x += particle.vx * dt;
      particle.mesh.position.y += particle.vy * dt;
      particle.mesh.position.z += particle.vz * dt;
      particle.mesh.rotation.x += dt * 7;
      particle.mesh.material.opacity = particle.life / particle.maxLife;
      particle.mesh.scale.setScalar(0.55 + particle.life / particle.maxLife);
    }
    for (let i = this.floatTexts.length - 1; i >= 0; i -= 1) {
      const item = this.floatTexts[i];
      item.life -= dt;
      item.sprite.position.y += dt * 1.15;
      item.sprite.material.opacity = clamp(item.life * 1.5, 0, 1);
      if (item.life <= 0) {
        this.fxLayer.remove(item.sprite);
        item.sprite.material.map.dispose();
        item.sprite.material.dispose();
        this.floatTexts.splice(i, 1);
      }
    }
  }

  floatText(text, x, y, color) {
    const sprite = makeTextSprite(text, color, 62);
    sprite.scale.set(3.4, 1.05, 1);
    sprite.position.set(x, y, 2);
    this.fxLayer.add(sprite);
    this.floatTexts.push({ sprite, life: 1.15 });
  }

  flashScreen(color, strength = 0.5) {
    this.flash = Math.max(this.flash, strength);
    if (this.dom['screen-flash']) this.dom['screen-flash'].style.background = color;
  }

  toast(message) {
    if (!this.dom.toast) return;
    if (this.dom['mission-text']) this.dom['mission-text'].textContent = message;
    else this.dom.toast.textContent = message;
    this.dom.toast.hidden = false;
    this.dom.toast.classList.remove('is-visible');
    void this.dom.toast.offsetWidth;
    this.dom.toast.classList.add('is-visible');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.dom.toast?.classList.remove('is-visible');
      if (this.dom.toast) this.dom.toast.hidden = true;
    }, 2200);
  }

  updateHud(force = false) {
    if (!force && this.runTime - this.lastHud < 0.07) return;
    this.lastHud = this.runTime;
    const set = (id, value) => { if (this.dom[id]) this.dom[id].textContent = value; };
    set('score-value', Math.floor(this.score || 0).toLocaleString('zh-CN'));
    set('distance-value', String(Math.floor(this.distance || 0)));
    set('speed-value', `${(this.speed || 0).toFixed(1)}`);
    set('coin-value', String(this.coins || 0));
    set('multiplier-value', `×${this.getMultiplier()}`);
    set('combo-value', this.combo > 1 ? String(this.combo) : '0');
    set('mode-label', MODE_INFO[this.mode].label);
    set('mode-timer', this.modeTimer > 0 ? `${this.modeTimer.toFixed(1)}s` : '∞');
    set('biome-label', this.mode === MODE.NORMAL ? BIOMES[Math.max(0, this.currentBiome) % BIOMES.length].label : '独立奖励场景');
    const gauge = (id, value) => { if (this.dom[id]) this.dom[id].style.width = `${clamp(value, 0, 100)}%`; };
    gauge('super-fill', this.player.superGauge);
    gauge('dash-fill', this.player.dashGauge);
    gauge('skill-fill', this.player.skill > 0 ? 100 : (1 - this.player.skillCooldown / 13) * 100);
    gauge('health-fill', this.player.shield > 0 ? 100 : this.player.invincible > 0 ? 55 : 12);
    gauge('energy-fill', this.player.dashGauge);
    set('super-text', this.player.superGauge >= 100 ? 'F 开启' : `${Math.floor(this.player.superGauge)}%`);
    set('dash-text', this.player.dashGauge >= 100 ? 'SHIFT' : `${Math.floor(this.player.dashGauge)}%`);
    set('skill-text', this.player.skill > 0 ? '释放中' : this.player.skillCooldown > 0 ? `${Math.ceil(this.player.skillCooldown)}s` : 'E 就绪');
    set('shield-status', this.player.shield > 0 ? `护盾 ${Math.ceil(this.player.shield)}s` : '护盾待拾取');
    set('mount-status', this.player.mount > 0 ? `星焰板 ${Math.ceil(this.player.mount)}s` : '坐骑待召唤');
    set('pet-status', this.coins > 0 && this.coins % 18 > 13 ? `团子守护 ${18 - (this.coins % 18)}枚` : '团子自动拾取');
    set('mission-value', this.modeHistory.size >= 3 ? '奖励巡礼完成' : `已探索 ${this.modeHistory.size}/3 奖励路线`);
    set('super-button', this.player.superGauge >= 100 ? 'F' : `${Math.floor(this.player.superGauge)}%`);
    set('health-value', this.player.shield > 0 ? Math.ceil(this.player.shield) : 0);
    set('energy-value', Math.floor(this.player.dashGauge));
    set('skill-copy', this.player.skillCooldown > 0 ? `${Math.ceil(this.player.skillCooldown)}S` : 'READY');
    gauge('zone-progress', this.mode === MODE.NORMAL ? (this.distance % 260) / 2.6 : (this.modeTimer / MODE_INFO[this.mode].duration) * 100);
    if (this.dom['revive-ring']) this.dom['revive-ring'].style.strokeDashoffset = String(276.5 * (1 - clamp(this.reviveTimer / 30, 0, 1)));
    if (this.dom['mode-label']) this.dom['mode-label'].style.setProperty('--mode-color', MODE_INFO[this.mode].color);
    if (this.dom['revive-countdown']) this.dom['revive-countdown'].textContent = String(Math.max(0, Math.ceil(this.reviveTimer)));
    this.dom['skill-btn']?.classList.toggle('is-ready', this.player.skillCooldown <= 0);
    this.dom['dash-btn']?.classList.toggle('is-ready', this.player.dashGauge >= 100);
  }

  updateCamera(dt) {
    this.shake = Math.max(0, this.shake - dt * 2.8);
    const shakeX = (Math.random() - 0.5) * this.shake * 0.42;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.34;
    const targetY = 5.2 + clamp(this.player.y * 0.18, 0, 1.2);
    this.camera.position.x = lerp(this.camera.position.x, this.mode === MODE.RIFT ? 0.8 : 0, 1 - Math.exp(-dt * 3)) + shakeX;
    this.camera.position.y = lerp(this.camera.position.y, targetY, 1 - Math.exp(-dt * 4)) + shakeY;
    this.camera.position.z = lerp(this.camera.position.z, this.player.dash > 0 || this.mode === MODE.RIFT ? 18.8 : 17, 1 - Math.exp(-dt * 3));
    this.camera.lookAt(0, 2.25 + clamp(this.player.y * 0.1, 0, 0.7), 0);
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.4);
      if (this.dom['screen-flash']) this.dom['screen-flash'].style.opacity = String(this.flash);
    } else if (this.dom['screen-flash']) this.dom['screen-flash'].style.opacity = '0';
  }

  fixedUpdate(dt) {
    if (this.phase !== PHASE.PLAYING) return;
    this.runTime += dt;
    this.updateModes(dt);
    this.updateWorld(dt);
    this.updatePlayer(dt);
    if (this.phase === PHASE.PLAYING) this.updateCollisions(dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0 && this.dom['mode-banner']) {
        this.dom['mode-banner'].classList.remove('is-visible');
        this.dom['mode-banner'].hidden = true;
      }
    }
    const audioMode = this.mode === MODE.RIFT ? 'rush' : this.mode === MODE.SUPER || this.mode === MODE.BONUS ? 'reward' : 'play';
    this.audio.update(dt, clamp(this.speed / 34, 0.25, 1), audioMode);
  }

  loop(time) {
    const rawDt = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (this.phase === PHASE.PLAYING) {
      this.fixedRemainder += rawDt;
      const step = 1 / 120;
      let guard = 0;
      while (this.fixedRemainder >= step && guard < 8) {
        this.fixedUpdate(step);
        this.fixedRemainder -= step;
        guard += 1;
      }
    } else if (this.phase === PHASE.DOWNED) {
      this.reviveTimer -= rawDt;
      this.updateHud(true);
      if (this.reviveTimer <= 0) this.finishRun();
    }
    this.updateEnvironment(rawDt);
    this.updateParticles(rawDt);
    this.updateCamera(rawDt);
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((next) => this.loop(next));
  }
}

new StarRailSprint();
