import * as THREE from 'three';
import { random } from './simulation.js';

const COLORS = { ink: 0x254e53, teal: 0x278c91, mint: 0x8ec9b2, cream: 0xfff8df, gold: 0xf2be55, orange: 0xe99854,
  stone: 0x8caf9d, grass: 0xb7d3ac, white: 0xfffef2, dark: 0x233d4f, purple: 0x9782c6 };
const PALETTES = {
  sky: { sky: 0xddeede, fog: 0xddeede, ground: 0xb6d2a8, rock: 0x87ac99, light: 0xfff2c7, far: 0xc0daca },
  cave: { sky: 0x253d50, fog: 0x253d50, ground: 0x70a9a3, rock: 0x365a6a, light: 0xbbdbeb, far: 0x3c6270 },
  super: { sky: 0xf7eacb, fog: 0xf7eacb, ground: 0xebd69e, rock: 0xc5bf94, light: 0xfff0c1, far: 0xf0d9ae },
  warp: { sky: 0x292640, fog: 0x292640, ground: 0x967ec0, rock: 0x444266, light: 0xd8c8ff, far: 0x4d456e },
};

export class GameRenderer {
  constructor(container) {
    this.container = container; this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = window.innerWidth > 760; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(PALETTES.sky.sky);
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-18, 18, 10, -10, .1, 150);
    this.scene.fog = new THREE.Fog(PALETTES.sky.fog, 35, 100);
    this.materials = new Map(); this.geometries = new Map(); this.segmentNodes = new Map(); this.entityNodes = new Map();
    this.ambient = new THREE.HemisphereLight(0xfff8df, 0x718d88, 2.8); this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xfff1c4, 3.2); this.sun.position.set(-12, 25, 12); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024); this.sun.shadow.camera.left = -25; this.sun.shadow.camera.right = 25;
    this.sun.shadow.camera.top = 15; this.sun.shadow.camera.bottom = -12; this.sun.shadow.normalBias = .04;
    this.scene.add(this.sun);
    this.track = new THREE.Group(); this.scene.add(this.track);
    this.bonusTrack = new THREE.Group(); this.scene.add(this.bonusTrack);
    this.backdrop = new THREE.Group(); this.scene.add(this.backdrop);
    this.clouds = []; this.mountains = []; this.rings = []; this.streaks = [];
    this.makeBackdrop(); this.makeBonusTrack(); this.makeRunner(); this.makePet(); this.makeParticles();
    this.coins = new THREE.InstancedMesh(this.geometry('coin'), this.material(COLORS.gold, { metalness: .4, roughness: .25 }), 700);
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.coins.frustumCulled = false;
    this.scene.add(this.coins); this.dummy = new THREE.Object3D();
    this.clock = 0; this.shake = 0; this.lastBiome = ''; this.anchor = -8; this.offset = 0; this.motionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize(); this.onResize = () => this.resize(); window.addEventListener('resize', this.onResize);
  }
  geometry(shape) {
    if (!this.geometries.has(shape)) {
      const geo = shape === 'sphere' ? new THREE.SphereGeometry(1, 16, 12)
        : shape === 'lowSphere' ? new THREE.IcosahedronGeometry(1, 1)
        : shape === 'cylinder' ? new THREE.CylinderGeometry(1, 1, 1, 12)
        : shape === 'cone' ? new THREE.ConeGeometry(1, 1, 5)
        : shape === 'island' ? new THREE.CylinderGeometry(1, .72, 1, 6)
        : shape === 'torus' ? new THREE.TorusGeometry(1, .08, 8, 40)
        : shape === 'coin' ? new THREE.CylinderGeometry(.25, .25, .095, 12)
        : new THREE.BoxGeometry(1, 1, 1);
      this.geometries.set(shape, geo);
    }
    return this.geometries.get(shape);
  }
  material(color, options = {}) {
    const key = `${color}:${JSON.stringify(options)}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .85, ...options }));
    return this.materials.get(key);
  }
  mesh(parent, shape, color, scale, position = [0, 0, 0], options = {}) {
    const mesh = new THREE.Mesh(this.geometry(shape), this.material(color, options));
    mesh.scale.set(...scale); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  box(parent, color, scale, position, options) { return this.mesh(parent, 'box', color, scale, position, options); }
  group(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.viewWidth = Math.max(32, aspect * 18.5);
    const viewHeight = this.viewWidth / aspect;
    this.camera.left = -this.viewWidth / 2; this.camera.right = this.viewWidth / 2;
    this.camera.top = viewHeight / 2; this.camera.bottom = -viewHeight / 2; this.camera.updateProjectionMatrix();
    this.anchor = -this.viewWidth * .27;
    this.camera.position.set(0, 8.5, 27); this.camera.lookAt(0, aspect < .8 ? 2.6 : 3.3, 0);
  }
  makeRunner() {
    this.runner = this.group(this.scene);
    this.body = this.group(this.runner);
    const torso = this.mesh(this.body, 'sphere', COLORS.teal, [.42, .47, .32], [0, .91, 0]); torso.rotation.z = -.1;
    this.box(this.body, COLORS.cream, [.33, .3, .13], [.16, 1.02, .27]);
    this.box(this.body, COLORS.gold, [.09, .2, .14], [.16, 1.02, .31]);
    this.mesh(this.body, 'sphere', COLORS.cream, [.43, .43, .39], [.02, 1.53, 0]);
    this.mesh(this.body, 'sphere', COLORS.teal, [.46, .33, .43], [-.04, 1.68, 0]);
    this.mesh(this.body, 'sphere', 0xc4eee2, [.18, .24, .33], [.36, 1.58, .04], { metalness: .25, roughness: .15 });
    this.mesh(this.body, 'sphere', COLORS.ink, [.035, .07, .04], [.452, 1.6, .23]);
    this.box(this.body, COLORS.cream, [.2, .06, .12], [.36, 1.42, .29]);
    const ear = this.mesh(this.body, 'cylinder', COLORS.gold, [.14, .12, .14], [-.02, 1.65, .43]); ear.rotation.x = Math.PI / 2;
    this.box(this.body, COLORS.ink, [.045, .32, .05], [-.2, 2.06, 0]);
    this.mesh(this.body, 'sphere', COLORS.orange, [.085, .085, .085], [-.2, 2.25, 0]);
    this.box(this.body, COLORS.orange, [.35, .43, .48], [-.4, .96, -.04]);
    this.box(this.body, COLORS.cream, [.09, .1, .45], [-.59, 1.08, -.04]);
    this.scarf = this.group(this.body, -.22, 1.31, .03);
    this.box(this.scarf, COLORS.orange, [.75, .14, .19], [-.38, 0, 0]);
    this.box(this.scarf, COLORS.gold, [.34, .12, .19], [-.88, -.07, 0]);
    this.legs = []; this.arms = [];
    for (const side of [-1, 1]) {
      const leg = this.group(this.body, 0, .64, side * .19);
      this.box(leg, COLORS.ink, [.2, .4, .18], [0, -.18, 0]);
      this.mesh(leg, 'sphere', COLORS.cream, [.25, .13, .19], [.1, -.45, .02]); this.legs.push(leg);
      const arm = this.group(this.body, 0, 1.15, side * .4);
      this.mesh(arm, 'sphere', COLORS.teal, [.13, .27, .14], [.03, -.18, 0]);
      this.mesh(arm, 'sphere', COLORS.cream, [.13, .13, .13], [.08, -.38, 0]); this.arms.push(arm);
    }
    this.shield = this.mesh(this.runner, 'sphere', 0x9fe5de, [.86, 1.28, .77], [0, 1.03, 0], { transparent: true, opacity: .18, roughness: .1, metalness: .3, depthWrite: false });
    this.shield.castShadow = false;
    this.shieldRing = this.mesh(this.runner, 'torus', 0xc0f4e6, [.98, 1.2, 1], [0, 1.03, .1], { transparent: true, opacity: .75, emissive: 0x42796b, depthWrite: false });
    this.mount = this.group(this.runner, 0, -.04, 0);
    this.mesh(this.mount, 'sphere', COLORS.cream, [1.22, .19, .65], [0, 0, 0]);
    this.mesh(this.mount, 'sphere', COLORS.teal, [.55, .26, .45], [.25, .04, 0]);
    for (const side of [-1, 1]) {
      const wing = this.box(this.mount, COLORS.gold, [.95, .1, 1.2], [-.16, 0, side * .75]); wing.rotation.y = side * -.25;
      this.mesh(this.mount, 'sphere', COLORS.orange, [.2, .1, .15], [-1.1, 0, side * .25]);
    }
    this.shadow = this.mesh(this.scene, 'sphere', 0x355d56, [.7, .016, .42], [0, .012, 0], { transparent: true, opacity: .18, depthWrite: false });
    this.shadow.castShadow = false;
  }
  makePet() {
    this.pet = this.group(this.scene);
    this.mesh(this.pet, 'sphere', COLORS.gold, [.34, .29, .28]);
    this.mesh(this.pet, 'sphere', COLORS.cream, [.23, .21, .22], [.12, -.03, .14]);
    for (const side of [-1, 1]) {
      const ear = this.mesh(this.pet, 'cone', COLORS.orange, [.16, .42, .15], [-.08, .35, side * .17]); ear.rotation.z = -.3;
    }
    this.mesh(this.pet, 'sphere', COLORS.ink, [.035, .06, .04], [.27, .05, .25]);
    this.petWings = [];
    for (const side of [-1, 1]) {
      const wing = this.mesh(this.pet, 'sphere', COLORS.cream, [.4, .055, .22], [-.16, 0, side * .35]); this.petWings.push(wing);
    }
    this.mesh(this.pet, 'torus', COLORS.gold, [.44, .44, .44], [0, .01, -.05], { emissive: 0x604818 });
  }
  makeBackdrop() {
    const rng = random(8031);
    this.sunDisc = this.mesh(this.backdrop, 'sphere', 0xfff5cd, [5.3, 5.3, .3], [15, 16, -50], { emissive: 0xa59c71, roughness: 1 });
    this.sunDisc.castShadow = false;
    for (let i = 0; i < 13; i++) {
      const cloud = this.group(this.backdrop, rng() * 100 - 50, rng() * 14 + 5, -14 - rng() * 30);
      cloud.userData.baseX = cloud.position.x; cloud.userData.factor = .05 + rng() * .08;
      for (let j = 0; j < 3; j++) {
        const m = this.mesh(cloud, 'sphere', 0xf8fae9, [1.9 + rng(), .7 + rng() * .6, 1], [j * 1.9, Math.sin(j) * .35, 0]); m.castShadow = false;
      }
      this.clouds.push(cloud);
    }
    for (let i = 0; i < 11; i++) {
      const mountain = this.mesh(this.backdrop, 'cone', 0xc0daca, [7 + rng() * 7, 12 + rng() * 9, 6], [i * 11 - 58, -1, -37 - rng() * 12]);
      mountain.userData.baseX = mountain.position.x; mountain.castShadow = false; this.mountains.push(mountain);
    }
    this.airship = this.group(this.backdrop, 10, 11, -26);
    this.mesh(this.airship, 'sphere', COLORS.cream, [3.5, 1.12, 1.12]);
    this.mesh(this.airship, 'sphere', COLORS.mint, [1.5, 1.13, 1.13], [-.4, 0, 0]);
    this.box(this.airship, COLORS.ink, [1.8, .4, .6], [0, -1.3, 0]);
    this.box(this.airship, COLORS.orange, [.6, 1.8, .08], [-3.1, 0, 0]);
    for (const x of [-.6, .6]) this.box(this.airship, COLORS.ink, [.045, .7, .045], [x, -.9, 0]);
    for (let i = 0; i < 25; i++) {
      const streak = this.box(this.backdrop, 0xa88dcc, [.8 + rng() * 3, .025, .025], [rng() * 90 - 45, rng() * 22 - 5, -rng() * 18]);
      streak.userData.baseX = streak.position.x; streak.castShadow = false; this.streaks.push(streak);
    }
  }
  makeBonusTrack() {
    this.bonusFloor = this.box(this.bonusTrack, PALETTES.super.ground, [180, .3, 6.3], [35, -.2, 0]);
    this.bonusFloor.material = this.bonusFloor.material.clone();
    this.bonusUnder = this.box(this.bonusTrack, PALETTES.super.rock, [180, 1, 5.8], [35, -.85, 0]);
    this.bonusUnder.material = this.bonusUnder.material.clone();
    this.bonusTiles = [];
    for (let i = 0; i < 22; i++) {
      const tile = this.group(this.bonusTrack, i * 6, 0, 0);
      this.box(tile, COLORS.cream, [2.2, .035, .12], [0, -.025, 2.35]);
      this.box(tile, COLORS.cream, [2.2, .035, .12], [0, -.025, -2.35]); this.bonusTiles.push(tile);
    }
    for (let i = 0; i < 11; i++) {
      const ring = this.mesh(this.bonusTrack, 'torus', 0xc1a2f0, [5, 5, 5], [i * 11, 3.4, 0], { emissive: 0x674393, emissiveIntensity: .6 });
      ring.rotation.y = Math.PI / 2; this.rings.push(ring);
    }
  }
  makeSegment(segment) {
    const node = this.group(this.track); node.userData.segment = segment;
    const palette = PALETTES[segment.biome];
    for (const p of segment.platforms) {
      const length = p.end - p.x; const middle = (p.x + p.end) / 2 - segment.start;
      this.box(node, palette.ground, [length, .26, 5.7], [middle, p.y - .13, 0]);
      this.mesh(node, 'island', palette.rock, [length * .49, 2.8, 3.1], [middle, p.y - 1.65, -.1]);
      this.box(node, COLORS.cream, [length - .2, .08, .13], [middle, p.y - .02, 2.45]);
      for (let x = p.x + 2; x < p.end - 1; x += 7) this.box(node, 0xe8e8c4, [1.25, .023, .11], [x - segment.start, p.y + .01, 1.6]);
    }
    const rng = random(segment.index * 131 + 36);
    for (let i = 0; i < 5; i++) {
      const x = 5 + i * 12;
      const y = segment.platforms.find(p => segment.start + x >= p.x && segment.start + x < p.end)?.y;
      if (y === undefined) continue;
      if (segment.biome === 'cave') {
        const crystal = this.mesh(node, 'cone', [0x8fc9c3, 0xa4b7dd, 0x78a8b6][i % 3], [.4 + rng() * .4, 1.1 + rng() * 2, .6], [x, y + .6, -2.5], { emissive: 0x23495a, emissiveIntensity: .45 }); crystal.rotation.z = rng() * .5 - .25;
        this.mesh(node, 'cone', palette.rock, [1.5, 3 + rng() * 3, 1.3], [x, 10, -2]).rotation.z = Math.PI;
      } else {
        this.box(node, 0x809580, [.15, 1.65, .15], [x, y + .75, -2.3]);
        this.mesh(node, 'lowSphere', i % 2 ? 0x83b99f : 0x9fc9a9, [1.15, 1.5, 1.1], [x, y + 2.1, -2.3]);
      }
    }
    const post = this.group(node, 4, 0, -2);
    this.box(post, COLORS.ink, [.14, 1.7, .14], [0, .8, 0]);
    this.box(post, COLORS.cream, [1.1, .45, .12], [.22, 1.65, 0]);
    this.box(post, COLORS.teal, [.28, .1, .13], [.36, 1.65, .02]);
    this.segmentNodes.set(segment.id, node); return node;
  }
  makeEntity(e) {
    const group = this.group(this.scene); group.userData.type = e.type;
    if (e.type === 'hurdle') {
      this.box(group, COLORS.orange, [e.width, e.height, 1.4], [0, e.height / 2, 0]);
      this.box(group, COLORS.cream, [e.width + .03, .18, 1.43], [0, e.height * .67, 0]);
      this.box(group, COLORS.cream, [.18, e.height + .02, 1.43], [0, e.height / 2, 0]);
      this.box(group, COLORS.ink, [.32, .24, .025], [.25, e.height * .34, .72]);
    } else if (e.type === 'arch') {
      for (const z of [-1.25, 1.25]) {
        this.box(group, COLORS.teal, [.34, 3.4, .34], [0, .6, z]);
        this.box(group, COLORS.cream, [.36, .35, .36], [0, -.4, z]);
      }
      this.box(group, COLORS.teal, [e.width, e.height, 2.45], [0, e.height / 2, 0]);
      this.box(group, COLORS.cream, [e.width + .03, .19, 2.5], [0, .11, 0]);
      for (let i = 0; i < 3; i++) this.box(group, COLORS.gold, [.33, .13, .05], [i * .58 - .58, .42, 1.26]).rotation.z = -.5;
    } else if (e.type === 'monster') {
      this.mesh(group, 'sphere', COLORS.purple, [.73, .49, .48], [0, .55, 0]);
      for (const x of [-.28, .26]) {
        this.mesh(group, 'sphere', COLORS.cream, [.19, .22, .09], [x, .62, .44]);
        this.mesh(group, 'sphere', COLORS.ink, [.055, .085, .04], [x - .035, .6, .53]);
        this.mesh(group, 'sphere', COLORS.ink, [.22, .13, .25], [x, .1, .1]);
      }
      this.mesh(group, 'cone', COLORS.gold, [.27, .28, .27], [0, 1.09, 0]);
    } else if (e.type === 'power') {
      const color = { shield: 0x80d3c6, magnet: 0xf0a56e, mount: 0x92badf, dash: 0xe7d276 }[e.power];
      this.mesh(group, 'lowSphere', color, [.53, .53, .53], [0, 0, 0], { metalness: .2, roughness: .25, emissive: color, emissiveIntensity: .12 });
      this.mesh(group, 'torus', COLORS.cream, [.7, .7, .7]);
      if (e.power === 'shield') this.mesh(group, 'sphere', COLORS.cream, [.24, .29, .12], [0, 0, .48]);
      else if (e.power === 'magnet') {
        const torus = this.mesh(group, 'torus', COLORS.cream, [.26, .29, .22], [0, 0, .5]); torus.rotation.z = Math.PI;
      } else if (e.power === 'mount') this.box(group, COLORS.cream, [.75, .1, .18], [0, 0, .5]).rotation.z = .2;
      else this.box(group, COLORS.cream, [.16, .58, .12], [0, 0, .5]).rotation.z = -.4;
    } else if (e.type === 'portal') {
      this.mesh(group, 'torus', COLORS.purple, [2.4, 2.4, 2.4], [0, 2.5, 0], { emissive: 0x74529e, emissiveIntensity: .8 }).rotation.y = .38;
      this.mesh(group, 'torus', COLORS.gold, [2.1, 2.1, 2.1], [0, 2.5, 0], { emissive: 0x735d2e });
      this.mesh(group, 'sphere', 0xcda5f4, [1.95, 2, .1], [0, 2.5, -.15], { transparent: true, opacity: .17, emissive: 0x66568a, depthWrite: false });
      this.box(group, COLORS.cream, [2.9, .4, 1.1], [0, .08, 0]);
    }
    this.entityNodes.set(e.id, group); return group;
  }
  makeParticles() {
    this.particles = Array.from({ length: 180 }, () => ({ life: 0, duration: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: .1 }));
    this.particleIndex = 0;
    this.particleMesh = new THREE.InstancedMesh(this.geometry('box'), this.material(COLORS.cream, { emissive: 0x4a401c }), this.particles.length);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.particleMesh.frustumCulled = false; this.scene.add(this.particleMesh);
  }
  burst(x, y, count = 12, color = COLORS.gold) {
    for (let i = 0; i < count; i++) {
      const index = this.particleIndex++ % this.particles.length;
      Object.assign(this.particles[index], { x, y, z: Math.random() * .5, vx: (Math.random() - .5) * 5, vy: 2 + Math.random() * 5,
        vz: (Math.random() - .5) * 2, life: .4 + Math.random() * .4, duration: .8, size: .05 + Math.random() * .1 });
      this.particleMesh.setColorAt(index, new THREE.Color(color));
    }
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }
  event(e, game) {
    const x = (e.x ?? game.player.x) - game.player.x + this.anchor;
    if (e.type === 'coin') this.burst(x, e.y, 3, COLORS.gold);
    if (e.type === 'jump') this.burst(this.anchor, game.player.y + .1, e.double ? 13 : 6, COLORS.cream);
    if (['stomp', 'break', 'hit', 'death'].includes(e.type)) {
      this.burst(x, (e.y ?? game.player.y) + .8, 22, e.type === 'stomp' ? COLORS.purple : COLORS.orange); this.shake = e.type === 'death' ? .36 : .2;
    }
    if (['mode', 'return', 'revive'].includes(e.type)) {
      for (const p of this.particles) p.life = 0;
      this.burst(this.anchor, 1.2, 40, COLORS.cream);
    }
  }
  palette(biome) {
    if (biome === this.lastBiome) return;
    this.lastBiome = biome; const p = PALETTES[biome];
    this.renderer.setClearColor(p.sky); this.scene.fog.color.setHex(p.fog); this.sun.color.setHex(p.light);
    this.ambient.intensity = ['cave', 'warp'].includes(biome) ? 2 : 2.8;
    for (const mountain of this.mountains) mountain.material.color.setHex(p.far);
    this.sunDisc.visible = !['cave', 'warp'].includes(biome);
    this.airship.visible = biome === 'sky' || biome === 'super';
    for (const cloud of this.clouds) cloud.visible = biome !== 'warp' && biome !== 'cave';
    for (const streak of this.streaks) streak.visible = biome === 'warp';
    this.bonusFloor.material.color.setHex(p.ground); this.bonusUnder.material.color.setHex(p.rock);
  }
  draw(game, dt) {
    const frozen = ['paused', 'dead', 'ended'].includes(game.phase);
    const animDt = frozen ? 0 : dt;
    this.clock += animDt; const t = this.clock;
    const p = game.player; const menu = game.phase === 'menu';
    const biome = menu ? 'sky' : game.biome;
    this.palette(biome);
    const menuLift = menu && innerWidth < 480 ? 10 : 0;
    this.camera.position.y = 8.5 + menuLift;
    this.camera.lookAt(0, (innerWidth / innerHeight < .8 ? 2.6 : 3.3) + menuLift, 0);
    const baseX = menu ? this.viewWidth * .21 : this.anchor;
    const scrollX = menu ? 8 + (t * 1.3) % 35 : p.x;
    this.offset = baseX - scrollX;
    this.track.visible = game.mode.id === 'normal' || menu;
    this.bonusTrack.visible = !this.track.visible;
    const liveSegments = new Set();
    if (this.track.visible) for (const s of game.world.segments) {
      if (s.end - scrollX < -this.viewWidth || s.start - scrollX > this.viewWidth + 12) continue;
      const node = this.segmentNodes.get(s.id) ?? this.makeSegment(s);
      node.position.x = s.start + this.offset; node.visible = true; liveSegments.add(s.id);
    }
    for (const [id, node] of this.segmentNodes) {
      if (!liveSegments.has(id)) { this.track.remove(node); this.segmentNodes.delete(id); }
    }
    if (this.bonusTrack.visible) {
      this.bonusFloor.position.x = 20; this.bonusUnder.position.x = 20;
      this.bonusTiles.forEach((tile, i) => { tile.position.x = ((i * 6 - p.x) % 132 + 132) % 132 - 34; });
      this.rings.forEach((ring, i) => {
        ring.visible = game.mode.id === 'warp'; ring.position.x = ((i * 11 - p.x) % 121 + 121) % 121 - 28;
        ring.rotation.x = t * .08 + i * .13;
      });
    }
    const liveEntities = new Set(); let coinCount = 0;
    const entities = menu ? game.world.entities : game.entities;
    for (const e of entities) {
      const x = e.x + this.offset;
      if (!e.active || x < -this.viewWidth / 2 - 5 || x > this.viewWidth / 2 + 7) continue;
      if (e.type === 'coin') {
        if (coinCount >= 700) break;
        this.dummy.position.set(x, e.y + Math.sin(t * 3.5 + e.x) * .055, .15);
        this.dummy.rotation.set(Math.PI / 2, 0, t * 2.3 + e.x * .21);
        this.dummy.scale.set(1, 1, 1); this.dummy.updateMatrix(); this.coins.setMatrixAt(coinCount++, this.dummy.matrix);
      } else {
        const node = this.entityNodes.get(e.id) ?? this.makeEntity(e); liveEntities.add(e.id);
        node.position.set(x, e.y, 0);
        if (e.type === 'power') { node.position.y += Math.sin(t * 3 + e.x) * .2; node.rotation.y = Math.sin(t) * .2; }
        if (e.type === 'monster') { node.scale.y = 1 + Math.sin(t * 6 + e.x) * .055; node.rotation.z = Math.sin(t * 4 + e.x) * .05; }
        if (e.type === 'portal') node.rotation.y = Math.sin(t * .7) * .2;
      }
    }
    for (const [id, node] of this.entityNodes) if (!liveEntities.has(id)) { this.scene.remove(node); this.entityNodes.delete(id); }
    this.coins.count = coinCount; this.coins.instanceMatrix.needsUpdate = true;
    const run = t * (menu ? 6 : game.speed * 1.1);
    const crouch = !menu && p.crouching;
    const flying = !menu && (p.effects.dash > 0 || game.mode.id === 'warp');
    const mount = !menu && p.effects.mount > 0;
    const grounded = menu || p.grounded;
    this.runner.position.set(baseX, menu ? .07 : p.y, .2);
    const runnerScale = menu ? (innerWidth < 480 ? 3.2 : 2.1) : 1;
    this.runner.scale.setScalar(runnerScale);
    this.body.position.y = (grounded ? Math.abs(Math.sin(run)) * .055 : 0) + (mount ? .3 : 0);
    this.body.scale.y = crouch ? .4 : 1;
    this.body.rotation.z = crouch ? -.35 : flying ? -.36 : grounded ? -.09 : .08;
    this.legs.forEach((leg, i) => { leg.rotation.z = crouch ? -1 : grounded && !mount ? Math.sin(run + i * Math.PI) * .7 : (i ? .45 : -.65); });
    this.arms.forEach((arm, i) => { arm.rotation.z = grounded ? Math.sin(run + i * Math.PI + Math.PI) * .65 : (i ? -1 : 1); });
    this.scarf.rotation.z = Math.sin(t * 9) * .13 + (flying ? -.15 : .1);
    this.mount.visible = mount; this.mount.rotation.z = Math.sin(t * 5) * .035;
    this.shield.visible = this.shieldRing.visible = !menu && (p.effects.shield > 0 || p.effects.invulnerable > 0);
    this.shieldRing.rotation.y = t * 1.6;
    this.runner.visible = p.effects.invulnerable <= 0 || Math.floor(t * 16) % 2 === 0 || menu;
    this.pet.position.set(baseX - (menu ? 2.6 : 1.7), (menu ? 1.6 : p.y + 1.8) + Math.sin(t * 3) * .18, 1);
    this.pet.scale.setScalar(menu ? 1.4 : 1); this.pet.rotation.z = Math.sin(t * 2) * .08;
    this.petWings.forEach((wing, i) => { wing.rotation.x = Math.sin(t * 15) * .5 * (i ? 1 : -1); });
    const ground = menu ? 0 : game.mode.id === 'normal' ? game.world.ground(p.x) : 0;
    this.shadow.visible = ground !== null && p.y - ground < 6;
    this.shadow.position.set(baseX, (ground ?? 0) + .025, .2);
    this.shadow.scale.x = Math.max(.3, .75 - (p.y - (ground ?? 0)) * .07) * runnerScale;
    const travel = menu ? t * 2 : game.distance;
    for (const cloud of this.clouds) cloud.position.x = ((cloud.userData.baseX - travel * cloud.userData.factor + 200) % 120 + 120) % 120 - 60;
    for (const m of this.mountains) m.position.x = ((m.userData.baseX - travel * .035 + 200) % 140 + 140) % 140 - 70;
    this.airship.position.x = 13 - Math.sin(travel * .002) * 12; this.airship.position.y = 10.5 + Math.sin(t * .5) * .3;
    for (const s of this.streaks) s.position.x = ((s.userData.baseX - travel * 1.3) % 90 + 90) % 90 - 45;
    if (flying && !frozen && Math.random() < .65) this.burst(baseX - .5, p.y + .7, 2, biome === 'warp' ? COLORS.purple : COLORS.gold);
    let particleCount = 0;
    for (const particle of this.particles) {
      if (particle.life <= 0) { this.dummy.scale.setScalar(0); }
      else {
        particle.life -= animDt; particle.vy -= animDt * 13;
        particle.x += (particle.vx - (menu ? 0 : game.speed * .65)) * animDt; particle.y += particle.vy * animDt; particle.z += particle.vz * animDt;
        this.dummy.position.set(particle.x, particle.y, particle.z); this.dummy.rotation.set(t * 3, t, t * 2);
        this.dummy.scale.setScalar(particle.size * Math.max(0, particle.life / particle.duration));
      }
      this.dummy.updateMatrix(); this.particleMesh.setMatrixAt(particleCount++, this.dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.shake = Math.max(0, this.shake - dt * .85);
    this.camera.position.x = this.motionReduced ? 0 : Math.sin(t * 90) * this.shake;
    this.renderer.render(this.scene, this.camera);
  }
  diagnostics() {
    const gl = this.renderer.getContext();
    return { webgl: !!gl, contextLost: gl.isContextLost(), calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries, canvasWidth: gl.drawingBufferWidth, canvasHeight: gl.drawingBufferHeight };
  }
}
