import * as THREE from 'three';
import { CONFIG } from './config.js';
import { TAU, clamp, pick, rand } from './utils.js';

const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * 金币场：单个 InstancedMesh 承载全部金币，逐帧写入实例矩阵。
 * 提供普通收集、磁铁吸附、宠物近距吸取三种接口。
 */
class CoinField {
  constructor(parent, capacity) {
    const geometry = new THREE.CylinderGeometry(0.34, 0.34, 0.085, 16);
    geometry.rotateX(Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffcf4a,
      emissive: 0x8a5b00,
      emissiveIntensity: 1.0,
      metalness: 0.85,
      roughness: 0.24,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    parent.add(this.mesh);

    this.capacity = capacity;
    this.cursor = 0;
    this.items = [];
    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._scale = new THREE.Vector3(1, 1, 1);
    this._euler = new THREE.Euler(0, 0, 0);

    for (let i = 0; i < capacity; i += 1) {
      this.items.push({ active: false, x: 0, y: 0, z: 0, phase: 0, spin: 0 });
      this.mesh.setMatrixAt(i, ZERO_MATRIX);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset() {
    for (let i = 0; i < this.capacity; i += 1) {
      this.items[i].active = false;
      this.mesh.setMatrixAt(i, ZERO_MATRIX);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.cursor = 0;
  }

  spawn(x, y, z = 0) {
    let index = -1;
    for (let i = 0; i < this.capacity; i += 1) {
      const probe = (this.cursor + i) % this.capacity;
      if (!this.items[probe].active) {
        index = probe;
        break;
      }
    }
    if (index === -1) {
      index = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
    }
    const item = this.items[index];
    item.active = true;
    item.x = x;
    item.y = y;
    item.z = z;
    item.phase = Math.random() * TAU;
    item.spin = rand(2.2, 3.6);
    this.writeMatrix(index);
  }

  writeMatrix(index) {
    const item = this.items[index];
    if (!item.active) {
      this.mesh.setMatrixAt(index, ZERO_MATRIX);
      return;
    }
    const bob = Math.sin(item.phase) * 0.09;
    this._position.set(item.x, item.y + bob, item.z);
    this._euler.set(0, item.phase, 0);
    this._quaternion.setFromEuler(this._euler);
    this._matrix.compose(this._position, this._quaternion, this._scale);
    this.mesh.setMatrixAt(index, this._matrix);
  }

  update(dt, dx, magnet, playerCenterY) {
    for (let i = 0; i < this.capacity; i += 1) {
      const item = this.items[i];
      if (!item.active) continue;
      item.x -= dx;
      item.phase += item.spin * dt;

      if (magnet && item.x > -8 && item.x < 12 && Math.abs(item.y - playerCenterY) < 6.5) {
        const pull = 1 - Math.exp(-5.5 * dt);
        item.x += (0 - item.x) * pull;
        item.y += (playerCenterY - item.y) * pull;
        item.z += (0 - item.z) * pull;
      }

      if (item.x < -30) {
        item.active = false;
        this.mesh.setMatrixAt(i, ZERO_MATRIX);
        continue;
      }
      this.writeMatrix(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  collect(playerCenterY, radiusX = 0.95, radiusY = 1.15) {
    const collected = [];
    for (let i = 0; i < this.capacity; i += 1) {
      const item = this.items[i];
      if (!item.active) continue;
      if (Math.abs(item.x) <= radiusX && Math.abs(item.y - playerCenterY) <= radiusY) {
        collected.push({ x: item.x, y: item.y, z: item.z });
        item.active = false;
        this.mesh.setMatrixAt(i, ZERO_MATRIX);
      }
    }
    if (collected.length > 0) this.mesh.instanceMatrix.needsUpdate = true;
    return collected;
  }

  collectNear(centerY, radiusX, radiusY) {
    const collected = [];
    for (let i = 0; i < this.capacity; i += 1) {
      const item = this.items[i];
      if (!item.active) continue;
      if (Math.abs(item.x) <= radiusX && Math.abs(item.y - centerY) <= radiusY) {
        collected.push({ x: item.x, y: item.y, z: item.z });
        item.active = false;
        this.mesh.setMatrixAt(i, ZERO_MATRIX);
      }
    }
    if (collected.length > 0) this.mesh.instanceMatrix.needsUpdate = true;
    return collected;
  }
}

/**
 * 无限关卡：
 * - 主模式按图案库程序化生成地板、坑洞、障碍、怪物、金币与道具；
 * - 奖励模式只生成连续地板与密集金币阵列，不生成致命障碍；
 * - 对象池 + 单实例金币，长时间奔跑也不会持续分配显存对象。
 */
export class World {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.mode = 'main';
    this.time = 0;
    this.floors = [];
    this.obstacles = [];
    this.pickups = [];
    this.decor = [];
    this.portal = null;

    this.nextX = CONFIG.world.safeZone;
    this.genDistance = 0;
    this.patternCount = 0;
    this.difficulty = 0;

    this.floorPool = [];
    this.obstaclePools = { spike: [], crate: [], bar: [], laser: [], slime: [], drone: [] };
    this.pickupPools = { magnet: [], shield: [], double: [] };
    this.portalPool = [];
    this.decorPool = [];

    this.floorGeometry = new THREE.BoxGeometry(1, 0.7, 9);
    this.stripeGeometry = new THREE.BoxGeometry(1, 0.035, 0.14);
    this.floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3448,
      roughness: 0.88,
      metalness: 0.12,
      emissive: 0x120b12,
      emissiveIntensity: 0.6,
    });
    this.edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xffb347,
      emissiveIntensity: 1.15,
      roughness: 0.3,
      metalness: 0.4,
    });
    this.floorTopMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a2a3c,
      roughness: 0.95,
      metalness: 0.05,
    });

    this.coins = new CoinField(this.root, CONFIG.coins.capacity);
  }

  // ------------------------------------------------------------------
  // 生命周期
  // ------------------------------------------------------------------

  reset(mode = 'main') {
    this.mode = mode;
    this.time = 0;
    this.patternCount = 0;
    this.difficulty = 0;
    this.nextX = CONFIG.world.safeZone;
    this.genDistance = 0;

    for (const entry of this.floors) {
      entry.group.visible = false;
      this.root.remove(entry.group);
      this.floorPool.push(entry.group);
    }
    this.floors.length = 0;

    for (const mesh of this.obstacles) {
      this.releaseObstacle(mesh, true);
    }
    this.obstacles.length = 0;

    for (const mesh of this.pickups) {
      this.releasePickup(mesh, true);
    }
    this.pickups.length = 0;

    for (const mesh of this.decor) {
      mesh.visible = false;
      this.root.remove(mesh);
      this.decorPool.push(mesh);
    }
    this.decor.length = 0;

    if (this.portal) {
      this.portal.visible = false;
      this.root.remove(this.portal);
      this.portalPool.push(this.portal);
      this.portal = null;
    }

    this.coins.reset();
  }

  startTrack(distance, mode = 'main') {
    this.mode = mode;
    this.nextX = CONFIG.world.safeZone;
    this.genDistance = distance + CONFIG.world.safeZone;

    // 出生安全区：连续地板，避免开局掉坑。
    this.addFloor(-30, CONFIG.world.safeZone + 30);

    if (mode === 'main') {
      this.coinLine(12, 5, 2.2, 1.1);
      this.coinLine(34, 4, 2.2, 1.9);
    } else {
      for (let x = 8; x < CONFIG.world.safeZone - 4; x += 12) {
        this.spawnRewardFormation(x, mode);
      }
    }
  }

  spawnPortal(x) {
    if (this.portal) return;
    let mesh;
    if (this.portalPool.length > 0) {
      mesh = this.portalPool.pop();
    } else {
      mesh = this.assets.makePortal();
    }
    mesh.visible = true;
    mesh.position.set(x, 1.9, 0);
    mesh.userData.dead = false;
    mesh.userData.phase = 0;
    this.root.add(mesh);
    this.portal = mesh;
  }

  removePortal() {
    if (!this.portal) return;
    this.portal.visible = false;
    this.root.remove(this.portal);
    this.portalPool.push(this.portal);
    this.portal = null;
  }

  getPortal() {
    return this.portal;
  }

  hasFloorAt(x) {
    const margin = 0.26;
    for (const floor of this.floors) {
      if (x - margin >= floor.x && x + margin <= floor.x + floor.width) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------
  // 对象池
  // ------------------------------------------------------------------

  addFloor(x, width) {
    let group = this.floorPool.pop();
    if (!group) {
      group = new THREE.Group();
      const base = new THREE.Mesh(this.floorGeometry, this.floorMaterial);
      base.position.y = -0.35;
      group.add(base);
      const top = new THREE.Mesh(this.floorGeometry, this.floorTopMaterial);
      top.position.y = -0.02;
      top.scale.set(1, 0.06 / 0.7, 0.92);
      group.add(top);
      const stripe = new THREE.Mesh(this.stripeGeometry, this.edgeMaterial);
      stripe.position.set(0, 0.012, 0);
      group.add(stripe);
      for (const z of [-4.18, 4.18]) {
        const edge = new THREE.Mesh(this.stripeGeometry, this.edgeMaterial);
        edge.position.set(0, 0.012, z);
        edge.scale.z = 1.4;
        group.add(edge);
      }
      group.userData.parts = group.children.slice();
    }
    const [base, top, ...stripes] = group.userData.parts;
    base.scale.x = width;
    top.scale.x = width;
    stripes.forEach((stripe) => {
      stripe.scale.x = width;
    });
    group.position.set(x + width / 2, 0, 0);
    group.visible = true;
    this.root.add(group);
    this.floors.push({ group, x, width });
  }

  addObstacle(type, x) {
    const pool = this.obstaclePools[type] || this.obstaclePools.spike;
    let mesh = pool.pop();
    if (!mesh) {
      mesh = this.assets.makeObstacle(type);
      mesh.userData.baseY = mesh.position.y;
    }
    mesh.position.set(x, mesh.userData.baseY, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    mesh.visible = true;
    mesh.userData.dead = false;
    mesh.userData.phase = Math.random() * TAU;
    this.root.add(mesh);
    this.obstacles.push(mesh);
    return mesh;
  }

  destroyObstacle(mesh) {
    if (!mesh || mesh.userData.dead) return;
    mesh.userData.dead = true;
    mesh.visible = false;
  }

  releaseObstacle(mesh, hard = false) {
    this.root.remove(mesh);
    mesh.visible = false;
    mesh.userData.dead = false;
    if (!hard) {
      const pool = this.obstaclePools[mesh.userData.type];
      if (pool) pool.push(mesh);
    }
  }

  addPickup(type, x, y) {
    const pool = this.pickupPools[type] || this.pickupPools.magnet;
    let mesh = pool.pop();
    if (!mesh) mesh = this.assets.makePickup(type);
    mesh.position.set(x, y, 0);
    mesh.scale.set(1, 1, 1);
    mesh.visible = true;
    mesh.userData.dead = false;
    mesh.userData.baseY = y;
    mesh.userData.phase = Math.random() * TAU;
    this.root.add(mesh);
    this.pickups.push(mesh);
    return mesh;
  }

  collectPickup(mesh) {
    if (!mesh || mesh.userData.dead) return;
    mesh.userData.dead = true;
    mesh.visible = false;
  }

  releasePickup(mesh, hard = false) {
    this.root.remove(mesh);
    mesh.visible = false;
    mesh.userData.dead = false;
    if (!hard) {
      const pool = this.pickupPools[mesh.userData.type];
      if (pool) pool.push(mesh);
    }
  }

  addDecor(x) {
    let group = this.decorPool.pop();
    if (!group) group = this.assets.makeCrystal();
    group.position.set(x, rand(0.2, 2.4), rand(-14, -8));
    group.scale.setScalar(rand(0.6, 1.5));
    group.rotation.set(0, rand(0, TAU), rand(-0.3, 0.3));
    group.visible = true;
    this.root.add(group);
    this.decor.push(group);
  }

  // ------------------------------------------------------------------
  // 金币生成
  // ------------------------------------------------------------------

  addCoin(x, y, z = 0) {
    this.coins.spawn(x, y, z);
  }

  coinLine(x, count, spacing, y) {
    for (let i = 0; i < count; i += 1) {
      this.addCoin(x + i * spacing, y);
    }
  }

  coinArc(x, count, span, baseY, peakY) {
    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0 : i / (count - 1);
      const y = baseY + (peakY - baseY) * 4 * t * (1 - t);
      this.addCoin(x + t * span, y);
    }
  }

  coinZigzag(x, count, spacing, lowY, highY) {
    for (let i = 0; i < count; i += 1) {
      this.addCoin(x + i * spacing, i % 2 === 0 ? lowY : highY);
    }
  }

  coinRing(cx, cy, radius, count = 10) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU;
      this.addCoin(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
  }

  spawnRewardFormation(x, mode) {
    const roll = Math.random();
    if (mode === 'travel') {
      if (roll < 0.35) {
        this.coinLine(x, 8, 1.05, 1.2);
        this.coinArc(x, 8, 8, 2.2, 3.9);
      } else if (roll < 0.65) {
        this.coinZigzag(x, 10, 0.9, 1.0, 2.8);
        this.coinLine(x + 1, 6, 1.2, 3.5);
      } else if (roll < 0.85) {
        this.coinRing(x + 4, 2.6, 1.5, 12);
      } else {
        this.coinLine(x, 6, 1.0, 0.85);
        this.coinLine(x + 2, 6, 1.0, 2.0);
        this.coinLine(x + 4, 6, 1.0, 3.15);
      }
    } else if (roll < 0.3) {
      this.coinAreRewardLine(x);
    } else if (roll < 0.58) {
      this.coinArc(x, 9, 10, 1.1, 3.3);
      this.coinLine(x + 1, 5, 1.4, 3.2);
    } else if (roll < 0.8) {
      this.coinLine(x, 8, 1.15, 1.3);
      this.coinZigzag(x + 2, 6, 1.0, 2.2, 3.0);
    } else {
      this.coinRing(x + 4, 2.5, 1.6, 12);
    }
  }

  coinAreRewardLine(x) {
    this.coinLine(x, 6, 1.0, 0.9);
    this.coinLine(x + 1.5, 6, 1.0, 1.8);
    this.coinLine(x + 3, 6, 1.0, 2.7);
  }

  // ------------------------------------------------------------------
  // 关卡图案
  // ------------------------------------------------------------------

  spawnMainPattern() {
    const start = this.nextX;
    const diff = this.difficulty;
    const count = this.patternCount;
    this.patternCount += 1;

    let type;
    if (count < 2) {
      type = count === 0 ? 'safe' : 'coins';
    } else if (count % 9 === 0) {
      type = 'pickup';
    } else {
      const roll = Math.random();
      if (roll < 0.14) type = 'safe';
      else if (roll < 0.3) type = 'coins';
      else if (roll < 0.47) type = 'jump';
      else if (roll < 0.63) type = 'crouch';
      else if (roll < 0.77) type = 'pit';
      else if (roll < 0.9) type = 'monster';
      else type = diff > 0.15 ? 'combo' : 'jump';
    }

    let length = 20;
    if (type === 'safe') {
      length = rand(14, 20);
      this.addFloor(start, length);
      if (Math.random() < 0.7) this.coinLine(start + 4, 5, 2.0, 1.15);
    } else if (type === 'coins') {
      length = rand(18, 24);
      this.addFloor(start, length);
      if (Math.random() < 0.5) {
        this.coinArc(start + 2, 9, length - 4, 1.1, 3.0);
      } else {
        this.coinZigzag(start + 3, 9, 1.7, 1.0, 2.3);
        this.coinLine(start + 4, 5, 2.4, 2.9);
      }
    } else if (type === 'jump') {
      length = 27;
      this.addFloor(start, length);
      const hazardX = start + 12;
      this.addObstacle(Math.random() < 0.55 ? 'spike' : 'crate', hazardX);
      this.coinArc(hazardX - 5, 8, 9, 1.0, 2.9);
      if (Math.random() < 0.35) this.addObstacle('spike', hazardX + 4.5);
    } else if (type === 'crouch') {
      length = 27;
      this.addFloor(start, length);
      this.addObstacle(Math.random() < 0.5 ? 'bar' : 'laser', start + 13);
      this.coinLine(start + 8, 7, 1.15, 0.62);
      this.coinLine(start + 8, 3, 1.15, 2.7);
    } else if (type === 'pit') {
      const first = 11;
      const gap = clamp(3.4 + diff * 1.5 + rand(0, 0.8), 3.2, 5.8);
      const second = 13;
      this.addFloor(start, first);
      this.addFloor(start + first + gap, second);
      this.coinArc(start + first - 2, 7, gap + 4, 1.15, 2.8);
      length = first + gap + second;
    } else if (type === 'monster') {
      length = 28;
      this.addFloor(start, length);
      const monsterX = start + 12;
      this.addObstacle('slime', monsterX);
      this.coinArc(monsterX - 4, 6, 7, 1.4, 2.9);
      if (diff > 0.65 && Math.random() < 0.5) {
        this.addObstacle('slime', start + 24);
      }
    } else if (type === 'pickup') {
      length = 23;
      this.addFloor(start, length);
      const pickupType = pick(['magnet', 'shield', 'double']);
      this.addPickup(pickupType, start + 11, 1.35);
      this.coinLine(start + 5, 5, 1.4, 1.1);
    } else {
      // combo：两组低矮障碍，一次跳跃可以同时越过
      length = 32;
      this.addFloor(start, length);
      this.addObstacle('spike', start + 11);
      this.addObstacle('crate', start + 16);
      this.coinArc(start + 6, 9, 11, 1.2, 3.1);
    }

    if (Math.random() < 0.4) this.addDecor(start + rand(2, length - 2));

    this.nextX = start + length;
    this.genDistance += length;
  }

  spawnRewardPattern(mode) {
    const start = this.nextX;
    const length = rand(11, 16);
    this.addFloor(start, length);

    this.spawnRewardFormation(start + 1, mode);
    if (Math.random() < 0.45) {
      this.coinLine(start + 2, 5, 1.1, mode === 'travel' ? 4.2 : 3.6);
    }

    this.nextX = start + length;
    this.genDistance += length;
  }

  // ------------------------------------------------------------------
  // 更新
  // ------------------------------------------------------------------

  update(dt, options) {
    const { speed, mode = 'main', magnet = false, playerY = 1 } = options;
    this.time += dt;
    this.mode = mode;
    const dx = speed * dt;
    this.difficulty = clamp((this.genDistance - 130) / 1900, 0, 1);

    // 地板
    for (let i = this.floors.length - 1; i >= 0; i -= 1) {
      const floor = this.floors[i];
      floor.x -= dx;
      floor.group.position.x = floor.x + floor.width / 2;
      if (floor.x + floor.width < CONFIG.world.despawnX) {
        floor.group.visible = false;
        this.root.remove(floor.group);
        this.floorPool.push(floor.group);
        this.floors.splice(i, 1);
      }
    }

    // 障碍
    for (let i = this.obstacles.length - 1; i >= 0; i -= 1) {
      const mesh = this.obstacles[i];
      const ud = mesh.userData;
      if (ud.dead) {
        this.releaseObstacle(mesh);
        this.obstacles.splice(i, 1);
        continue;
      }
      mesh.position.x -= dx;
      if (mesh.position.x < CONFIG.world.despawnX) {
        this.releaseObstacle(mesh);
        this.obstacles.splice(i, 1);
        continue;
      }
      if (ud.type === 'slime') {
        const squash = 1 + Math.sin(this.time * 6 + ud.phase) * 0.1;
        mesh.scale.set(1 / squash, squash, 1);
      } else if (ud.type === 'drone') {
        mesh.position.y = ud.baseY + Math.sin(this.time * 2 + ud.phase) * 0.16;
        mesh.rotation.y += dt * 1.6;
      }
    }

    // 拾取物
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const mesh = this.pickups[i];
      const ud = mesh.userData;
      if (ud.dead) {
        this.releasePickup(mesh);
        this.pickups.splice(i, 1);
        continue;
      }
      mesh.position.x -= dx;
      mesh.rotation.y += dt * 2.2;
      mesh.position.y = ud.baseY + Math.sin(this.time * 2.6 + ud.phase) * 0.16;
      if (mesh.position.x < CONFIG.world.despawnX) {
        this.releasePickup(mesh);
        this.pickups.splice(i, 1);
      }
    }

    // 装饰
    for (let i = this.decor.length - 1; i >= 0; i -= 1) {
      const mesh = this.decor[i];
      mesh.position.x -= dx;
      mesh.rotation.y += dt * 0.5;
      if (mesh.position.x < CONFIG.world.despawnX) {
        mesh.visible = false;
        this.root.remove(mesh);
        this.decorPool.push(mesh);
        this.decor.splice(i, 1);
      }
    }

    // 传送门
    if (this.portal) {
      this.portal.userData.phase += dt;
      this.portal.position.x -= dx;
      this.portal.rotation.z += dt * 1.1;
      this.portal.children.forEach((child, index) => {
        if (index === 0 || index === 1) child.rotation.z -= dt * (0.6 + index * 0.4);
      });
      this.portal.position.y = 1.9 + Math.sin(this.portal.userData.phase * 1.8) * 0.12;
      if (this.portal.position.x < CONFIG.world.despawnX) this.removePortal();
    }

    this.coins.update(dt, dx, magnet, playerY);

    // 生成
    this.nextX -= dx;
    let guard = 0;
    while (this.nextX < CONFIG.world.spawnAhead && guard < CONFIG.world.maxChunksPerFrame) {
      if (mode === 'main') this.spawnMainPattern();
      else this.spawnRewardPattern(mode);
      guard += 1;
    }
  }

  updateTheme(colors, dt) {
    const blend = 1 - Math.exp(-2.4 * dt);
    this.floorMaterial.color.lerp(colors.ground, blend);
    this.floorMaterial.emissive.copy(colors.ground).multiplyScalar(0.18);
    this.floorTopMaterial.color.copy(colors.groundSide).lerp(colors.ground, 0.5);
    this.edgeMaterial.color.lerp(colors.edge, blend);
    this.edgeMaterial.emissive.copy(colors.edge).multiplyScalar(0.9);
  }

  collectCoins(centerY) {
    return this.coins.collect(centerY);
  }

  collectNear(centerY, radiusX, radiusY) {
    return this.coins.collectNear(centerY, radiusX, radiusY);
  }
}
