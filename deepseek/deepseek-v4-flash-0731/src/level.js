import * as THREE from 'three';
import { CONFIG } from './config.js';

export const EntityType = {
  OBSTACLE: 'obstacle',
  MONSTER: 'monster',
  COIN: 'coin',
  POWERUP: 'powerup',
  SPRING: 'spring',
  GATE: 'gate',
};

const LANE_Z = [-CONFIG.laneWidth, 0, CONFIG.laneWidth];

export class Level {
  constructor(scene) {
    this.scene = scene;
    this.entities = [];
    this.nextSpawnX = 0;
    this._templates = [];
    this._buildTemplates();
    this._mats = {};
  }

  _mat(color, opts = {}) {
    const key = `${color}-${opts.roughness ?? ''}-${opts.metalness ?? ''}-${opts.emissive ?? ''}`;
    if (!this._mats[key]) {
      this._mats[key] = new THREE.MeshStandardMaterial({
        color,
        roughness: opts.roughness ?? 0.55,
        metalness: opts.metalness ?? 0.2,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 1,
      });
    }
    return this._mats[key];
  }

  _buildTemplates() {
    this._templates = [
      { type: 'barrier', lanes: 'low' },
      { type: 'barrier', lanes: 'low' },
      { type: 'double', lanes: 'low' },
      { type: 'wall', lanes: 'tall' },
      { type: 'overhang', lanes: 'low' },
      { type: 'monster', lanes: 'low' },
      { type: 'monster', lanes: 'double' },
      { type: 'coins', lanes: 'low' },
      { type: 'coins', lanes: 'high' },
      { type: 'spring', lanes: 'low' },
      { type: 'powerup', lanes: 'low' },
      { type: 'gate', lanes: 'low' },
    ];
  }

  reset() {
    for (const e of this.entities) {
      this.scene.remove(e.group);
    }
    this.entities = [];
    this.nextSpawnX = 0;
  }

  getSpeed(speed) {
    return speed;
  }

  update(spawnX, speed, dt, player) {
    const x = player.position.x;
    while (this.nextSpawnX < x + CONFIG.spawnAhead) {
      this._spawnSegment(this.nextSpawnX);
      this.nextSpawnX += CONFIG.segmentLength;
    }
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.group.position.x < x - CONFIG.despawnBehind) {
        this.scene.remove(e.group);
        this.entities.splice(i, 1);
      }
    }
  }

  _randLane(pattern) {
    if (pattern === 'double') {
      const a = Math.floor(Math.random() * 3);
      const b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
      return [a, b];
    }
    return [Math.floor(Math.random() * 3)];
  }

  _freeLanes(taken) {
    const free = [0, 1, 2].filter((l) => !taken.includes(l));
    return free[Math.floor(Math.random() * free.length)];
  }

  _spawnSegment(baseX) {
    const template = this._templates[Math.floor(Math.random() * this._templates.length)];
    const offsetX = baseX + (Math.random() - 0.5) * CONFIG.segmentLength * 0.5;
    const takenLanes = [];

    switch (template.type) {
      case 'barrier': {
        const lanes = this._randLane(template.lanes);
        lanes.forEach((lane) => {
          this._spawnBarrier(offsetX + Math.random() * 4, lane);
          takenLanes.push(lane);
        });
        break;
      }
      case 'wall': {
        const lanes = this._randLane('double');
        lanes.forEach((lane) => {
          this._spawnWall(offsetX + Math.random() * 3, lane);
          takenLanes.push(lane);
        });
        break;
      }
      case 'overhang': {
        const lane = Math.floor(Math.random() * 3);
        this._spawnOverhang(offsetX, lane);
        takenLanes.push(lane);
        break;
      }
      case 'monster': {
        if (template.lanes === 'double') {
          const lanes = this._randLane('double');
          lanes.forEach((lane) => {
            this._spawnMonster(offsetX + Math.random() * 5, lane);
            takenLanes.push(lane);
          });
        } else {
          const lane = Math.floor(Math.random() * 3);
          this._spawnMonster(offsetX, lane);
          takenLanes.push(lane);
        }
        break;
      }
      case 'coins': {
        this._spawnCoinRow(offsetX, template.lanes);
        break;
      }
      case 'spring': {
        const lane = Math.floor(Math.random() * 3);
        this._spawnSpring(offsetX, lane);
        break;
      }
      case 'powerup': {
        const lane = Math.floor(Math.random() * 3);
        this._spawnPowerup(offsetX, lane);
        break;
      }
      case 'gate': {
        const lane = Math.floor(Math.random() * 3);
        this._spawnGate(offsetX, lane);
        break;
      }
    }

    if (takenLanes.length < 2) {
      const free = this._freeLanes(takenLanes);
      if (Math.random() < 0.5) this._spawnCoinRow(offsetX + 6, 'single', free);
    }

    if (Math.random() < 0.18) {
      const lane = this._freeLanes(takenLanes);
      if (lane !== undefined) this._spawnCoinRow(offsetX + 10, 'arc', lane);
    }
  }

  _spawnBarrier(x, lane) {
    const group = new THREE.Group();
    const mat = this._mat(0x37a8e0, { roughness: 0.4, metalness: 0.4 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), mat);
    post.position.y = 0.45;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), mat);
    top.position.y = 0.95;
    group.add(post, top);
    group.position.set(x, 0, LANE_Z[lane]);
    this.scene.add(group);
    this.entities.push({ type: EntityType.OBSTACLE, group, x, lane, size: new THREE.Vector3(1.1, 1.0, 1.0), kind: 'barrier', deadly: false });
  }

  _spawnWall(x, lane) {
    const group = new THREE.Group();
    const mat = this._mat(0x8a5bb0, { roughness: 0.45, metalness: 0.35 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.0, 0.8), mat);
    body.position.y = 1.5;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 1.0), this._mat(0x5a3a80));
    cap.position.y = 3.1;
    group.add(body, cap);
    group.position.set(x, 0, LANE_Z[lane]);
    this.scene.add(group);
    this.entities.push({ type: EntityType.OBSTACLE, group, x, lane, size: new THREE.Vector3(1.5, 3.0, 1.0), kind: 'wall', deadly: false });
  }

  _spawnOverhang(x, lane) {
    const group = new THREE.Group();
    const mat = this._mat(0x1a5a8a, { roughness: 0.5 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.8), mat);
    bar.position.y = 1.9;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.9, 0.4), mat);
    pillar.position.set(-0.7, 0.95, 0);
    const pillar2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.9, 0.4), mat);
    pillar2.position.set(0.7, 0.95, 0);
    group.add(bar, pillar, pillar2);
    group.position.set(x, 0, LANE_Z[lane]);
    this.scene.add(group);
    this.entities.push({ type: EntityType.OBSTACLE, group, x, lane, size: new THREE.Vector3(1.7, 0.8, 0.9), kind: 'overhang', deadly: false });
  }

  _spawnMonster(x, lane) {
    const group = new THREE.Group();
    const mat = this._mat(0xff6b6b, { roughness: 0.6, emissive: 0xcc2a2a, emissiveIntensity: 0.4 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mat);
    body.position.y = 0.85;
    body.scale.y = 0.85;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x102030 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), eyeMat);
      eye.position.set(side * 0.28, 1.1, 0.48);
      group.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), pupilMat);
      pupil.position.set(side * 0.28, 1.1, 0.58);
      group.add(pupil);
    }
    const footMat = this._mat(0xaa3a3a);
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.5), footMat);
      foot.position.set(side * 0.3, 0.18, 0.05);
      group.add(foot);
    }
    group.position.set(x, 0, LANE_Z[lane]);
    this.scene.add(group);
    this.entities.push({
      type: EntityType.MONSTER, group, x, lane,
      size: new THREE.Vector3(1.1, 1.3, 1.1),
      hp: 1, bobPhase: Math.random() * Math.PI * 2,
      dead: false,
    });
  }

  _spawnCoinRow(x, pattern, forcedLane) {
    const lanes = forcedLane !== undefined ? [forcedLane] : [0, 1, 2];
    const spacing = pattern === 'arc' ? 2.2 : 2.6;
    lanes.forEach((lane, li) => {
      const startX = x + li * 0.4;
      for (let i = 0; i < 5; i++) {
        const y = pattern === 'arc'
          ? 1.1 + Math.sin((i / 4) * Math.PI) * 2.4
          : (pattern === 'high' ? 2.1 : 1.0);
        this._spawnCoin(startX + i * spacing, lane, y);
      }
    });
  }

  _spawnCoin(x, lane, y = 1.0) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0xffa030, emissiveIntensity: 0.55, metalness: 0.7, roughness: 0.3 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 14), mat);
    coin.rotation.x = Math.PI / 2;
    coin.position.y = y;
    group.add(coin);
    group.position.set(x, 0, LANE_Z[lane]);
    this.scene.add(group);
    this.entities.push({ type: EntityType.COIN, group, x, lane, taken: false, spin: 0 });
  }

  _spawnSpring(x, lane) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.4, 12), this._mat(0x5a5a7a));
    base.position.y = 0.2;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12), this._mat(0xffc857, { emissive: 0xffa030, emissiveIntensity: 0.6 }));
    top.position.y = 0.5;
    group.add(base, top);
    group.position.set(x, 0, LANE_Z[lane]);
    this.scene.add(group);
    this.entities.push({ type: EntityType.SPRING, group, x, lane, size: new THREE.Vector3(1.0, 0.7, 1.0), used: false, anim: 0 });
  }

  _spawnPowerup(x, lane) {
    const kind = Math.random() < 0.5 ? 'magnet' : 'shield';
    const group = new THREE.Group();
    const color = kind === 'magnet' ? 0x37e6ff : 0x5fffd0;
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat);
    box.position.y = 1.4;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.4;
    group.add(box, halo);
    group.position.set(x, 0, LANE_Z[lane]);
    this.scene.add(group);
    this.entities.push({ type: EntityType.POWERUP, group, x, lane, kind, taken: false, spin: 0 });
  }

  _spawnGate(x, lane) {
    const group = new THREE.Group();
    const mat = this._mat(0x37e6ff, { emissive: 0x1aa7ff, emissiveIntensity: 0.7 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.22, 8, 22), mat);
    ring.position.y = 2.0;
    const glow = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.32, 8, 22), new THREE.MeshBasicMaterial({ color: 0x37e6ff, transparent: true, opacity: 0.25 }));
    glow.position.y = 2.0;
    group.add(ring, glow);
    group.position.set(x, 0, LANE_Z[lane]);
    this.scene.add(group);
    this.entities.push({ type: EntityType.GATE, group, x, lane, passed: false, spin: 0 });
  }

  // ---------- 奖励关卡金币阵列 ----------
  spawnBonusCoins() {
    this.reset();
    for (let lane = 0; lane < 3; lane++) {
      for (let i = 0; i < 34; i++) {
        this._spawnCoin(30 + i * 3.4, lane, 1.0 + Math.sin(i * 0.9 + lane) * 0.5);
      }
    }
    this.nextSpawnX = 30 + 34 * 3.4;
  }

  spawnWarpTrack() {
    this.reset();
    for (let lane = 0; lane < 3; lane++) {
      for (let i = 0; i < 40; i++) {
        if (i % 3 === 0) continue;
        this._spawnCoin(26 + i * 3.0, lane, 1.2);
      }
      if (lane === 1) {
        for (let i = 0; i < 30; i++) {
          this._spawnGate(20 + i * 8, 1);
        }
      }
    }
    this.nextSpawnX = 26 + 40 * 3.0;
  }

  updateEntities(dt) {
    for (const e of this.entities) {
      if (e.type === EntityType.COIN) {
        e.spin += dt * 5;
        e.group.children[0].rotation.z = e.spin;
        e.group.position.y = Math.sin(e.spin * 0.7 + e.x) * 0.12;
      } else if (e.type === EntityType.MONSTER && !e.dead) {
        e.bobPhase += dt * 6;
        e.group.position.y = Math.abs(Math.sin(e.bobPhase)) * 0.12;
        e.group.rotation.y += dt * 1.5;
      } else if (e.type === EntityType.POWERUP) {
        e.spin += dt * 3;
        e.group.rotation.y = e.spin;
        e.group.position.y = Math.sin(e.spin * 2) * 0.15;
      } else if (e.type === EntityType.SPRING) {
        if (e.anim > 0) {
          e.anim -= dt;
          e.group.children[1].position.y = 0.5 + Math.sin(e.anim * 30) * 0.1;
        }
      } else if (e.type === EntityType.GATE) {
        e.spin += dt * 2.4;
        e.group.children[0].rotation.z = e.spin;
        e.group.children[1].rotation.z = e.spin;
      }
    }
  }
}