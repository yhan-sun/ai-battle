// 关卡系统：无限程序化生成 + 实体对象池 + 碰撞查询
// 所有实体的 AABB 均为 (x,y 半宽/高以 world 坐标描述)，z 在主平面 ±0.45，保证 2.5D 碰撞正确
import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';

const GAP_MIN = 3.0;
const GAP_MAX = 5.2;

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function randInt(a, b) {
  return Math.floor(rand(a, b + 1));
}

export class LevelManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.reset();
  }

  reset() {
    this.platforms = []; // { x, len }
    this.active = []; // 全部实体 {kind,x,y,w,h,alive,mesh,...}
    this.nextX = 0;
    this.gateQueue = [];
    this.distancePassed = 0;

    // 地台池（按需增长）
    this.poolPlat = [];
    const platGeo = new THREE.BoxGeometry(1, 1, 1);
    this.platMat = new THREE.MeshStandardMaterial({ color: COLORS.street, roughness: 0.85 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: COLORS.streetEdge, emissive: 0x185a72, emissiveIntensity: 1.4 });
    this.platEdgeMat = edgeMat;
    for (let i = 0; i < 26; i++) this.buildPlatMesh(platGeo);

    // 实体池
    this.makePools();
  }

  buildPlatMesh(platGeo) {
    const m = new THREE.Mesh(platGeo, this.platMat);
    const edge = new THREE.Mesh(platGeo, this.platEdgeMat);
    edge.scale.set(1, 0.08, 1);
    edge.position.y = 0.49;
    m.add(edge);
    m.position.y = -0.5;
    m.visible = false;
    this.group.add(m);
    this.poolPlat.push({ mesh: m, len: 0, alive: false });
  }

  makePools() {
    const geoBat = new THREE.PlaneGeometry(1, 1);
    const pick = (kind, count, factory) => {
      const arr = [];
      for (let i = 0; i < count; i++) {
        arr.push(factory());
      }
      return arr;
    };

    // 箱体障碍
    const crateMat = new THREE.MeshStandardMaterial({ color: COLORS.crate, emissive: 0x2a1a66, emissiveIntensity: 0.6, roughness: 0.55 });
    const crateGeo = new THREE.BoxGeometry(1.18, 1.1, 1);
    const crate = () => {
      const g = new THREE.Mesh(crateGeo, crateMat);
      g.visible = false;
      this.group.add(g);
      return { kind: 'crate', mesh: g, w: 1.18, h: 1.1, alive: false, boss: false };
    };

    const stack = () => {
      const g = new THREE.Group();
      const a = new THREE.Mesh(crateGeo, crateMat);
      a.position.y = 0.55;
      const b = new THREE.Mesh(crateGeo, crateMat);
      b.position.y = 1.65;
      b.scale.setScalar(0.94);
      g.add(a, b);
      g.visible = false;
      this.group.add(g);
      return { kind: 'stack', mesh: g, w: 1.18, h: 2.2, alive: false };
    };

    // 高柱
    const pillar = () => {
      const g = new THREE.Mesh(new THREE.BoxGeometry(1, 2.35, 1.1), crateMat);
      g.visible = false;
      this.group.add(g);
      return { kind: 'pillar', mesh: g, w: 1.0, h: 2.35, alive: false };
    };

    // 下蹲梁门（横杆 y 0.95~1.5）
    const barMat = new THREE.MeshStandardMaterial({ color: COLORS.obstacleAlt, emissive: 0x4d1040, emissiveIntensity: 0.9 });
    const bar = () => {
      const g = new THREE.Group();
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.95, 0.6), crateMat);
      p1.position.y = 0.475;
      const p2 = p1.clone();
      p2.position.x = 2.6;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 0.5), barMat);
      beam.position.y = 1.225;
      beam.position.x = 1.3;
      g.add(p1, p2, beam);
      g.visible = false;
      this.group.add(g);
      return { kind: 'bar', mesh: g, w: 2.9, h: 1.8, alive: false, yb: 0.95, yt: 1.5 };
    };

    // 地刺
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xc9c9df, metalness: 0.9, roughness: 0.25 });
    const spike = () => {
      const g = new THREE.Group();
      const coneGeo = new THREE.ConeGeometry(0.22, 0.55, 6);
      for (let i = 0; i < 5; i++) {
        const c = new THREE.Mesh(coneGeo, spikeMat);
        c.position.set(i * 0.44, 0.27, 0);
        c.rotation.z = Math.PI;
        g.add(c);
      }
      g.visible = false;
      this.group.add(g);
      return { kind: 'spike', mesh: g, w: 2.3, h: 0.55, alive: false };
    };

    // 地面爬行怪（可踩）
    const walker = () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), new THREE.MeshStandardMaterial({ color: COLORS.monster, emissive: 0x0d5a3a, emissiveIntensity: 0.7 }));
      body.scale.set(1, 0.85, 0.95);
      body.position.y = 0.38;
      g.add(body);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x151536, emissive: 0x000000 });
      for (const s of [-0.18, 0.18]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
        eye.position.set(s, 0.5, 0.4);
        g.add(eye);
      }
      g.visible = false;
      this.group.add(g);
      return { kind: 'walker', mesh: g, w: 0.95, h: 0.8, alive: false, boss: true, vy: 0, vx: 0, walkSpeed: 2.2, anim: Math.random() * 10 };
    };

    // 飞行怪（下场蹲躲避，亦可跳过高飞）
    const bat = () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 9), new THREE.MeshStandardMaterial({ color: COLORS.bat, emissive: 0x3a1066, emissiveIntensity: 0.6 }));
      body.position.y = 0.35;
      g.add(body);
      const wingGeo = new THREE.ConeGeometry(0.16, 0.6, 6);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x9a55e8, emissive: 0x3a1066, emissiveIntensity: 0.6 });
      const w1 = new THREE.Mesh(wingGeo, wingMat);
      w1.rotation.z = Math.PI / 2;
      w1.position.set(0.35, 0.4, 0);
      const w2 = w1.clone();
      w2.position.x = -0.35;
      g.add(w1, w2);
      g.visible = false;
      this.group.add(g);
      return { kind: 'bat', mesh: g, w: 0.85, h: 0.58, alive: false, boss: true, yb: 0.97, yt: 1.55, anim: Math.random() * 10 };
    };

    // 金币
    const coinMat = new THREE.MeshStandardMaterial({ color: COLORS.coin, emissive: 0xbb7a00, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.3 });
    const coinGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.1, 16);
    const coin = () => {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.rotation.x = Math.PI / 2;
      m.visible = false;
      this.group.add(m);
      return { kind: 'coin', mesh: m, w: 0.7, h: 0.7, alive: false };
    };

    // 道具：磁铁/护盾/冲刺/坐骑
    const itemDefs = {
      magnet: { color: 0xff5e3a, emissive: 0xaa2200, size: 0.5 },
      shield: { color: 0x46e0ff, emissive: 0x0a7788, size: 0.5 },
      dash: { color: 0xffd23e, emissive: 0xaa8800, size: 0.5 },
      mount: { color: 0xff5ecf, emissive: 0x99306f, size: 0.5 },
    };
    const items = {};
    for (const [k, def] of Object.entries(itemDefs)) {
      items[k] = pick(k, 6, () => {
        const g = new THREE.Group();
        const aura = new THREE.Mesh(
          new THREE.TorusGeometry(0.55, 0.12, 8, 24),
          new THREE.MeshStandardMaterial({ color: def.color, emissive: def.emissive, emissiveIntensity: 1.6, transparent: true, opacity: 0.85 }),
        );
        aura.position.y = 0.85;
        const core = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.22, 0),
          new THREE.MeshStandardMaterial({ color: def.color, emissive: def.emissive, emissiveIntensity: 2 }),
        );
        core.position.y = 0.85;
        g.add(aura, core);
        g.visible = false;
        this.group.add(g);
        return { kind: 'item', item: k, mesh: g, w: 1.1, h: 1.7, alive: false };
      });
    }

    // 奖励门
    const gateDefs = {
      super: { color: COLORS.superGate, emissive: 0x0a8898 },
      warp: { color: 0xff8a3d, emissive: 0xaa4d00 },
    };
    const gates = {};
    for (const [k, def] of Object.entries(gateDefs)) {
      gates[k] = pick(k, 3, () => {
        const g = new THREE.Group();
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(2.0, 0.28, 10, 36),
          new THREE.MeshStandardMaterial({ color: def.color, emissive: def.emissive, emissiveIntensity: 2, transparent: true, opacity: 0.95 }),
        );
        ring.position.y = 1.9;
        ring.rotation.y = Math.PI / 2;
        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(3.4, 3.4),
          new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
        );
        panel.rotation.y = Math.PI / 2;
        panel.position.y = 1.9;
        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(0.42, 0.9, 4),
          new THREE.MeshStandardMaterial({ color: def.color, emissive: def.emissive, emissiveIntensity: 2.4 }),
        );
        arrow.rotation.z = -Math.PI / 2;
        arrow.position.y = 5.4;
        g.add(ring, panel, arrow);
        g.visible = false;
        this.group.add(g);
        return { kind: 'gate', gate: k, mesh: g, w: 0.9, h: 4.4, alive: false, anim: Math.random() * 10 };
      });
    }

    this.pools = { crate, stack, pillar, bar, spike, walker, bat, coin, items, gates };
    this.coinPool = pick('coin', 72, coin);
  }

  /* ---------- 生成 ---------- */
  requestGate(type) {
    this.gateQueue.push(type);
  }

  spawnPlatform(x, len) {
    for (const p of this.poolPlat) {
      if (!p.alive) {
        p.alive = true;
        p.len = len;
        p.mesh.visible = true;
        p.mesh.scale.set(len, 1, 6.6);
        p.mesh.position.set(x + len / 2, -0.5, 0);
        this.platforms.push({ x, len });
        return;
      }
    }
    // 池用尽则动态增长（保证奖关入口/长跑不吞平台）
    this.buildPlatMesh(new THREE.BoxGeometry(1, 1, 1));
    this.spawnPlatform(x, len);
  }

  spawnEntity(type, x, y = 0, extra = {}) {
    if (type === 'coin') {
      return this.spawnCoin(x, y);
    }
    const pool = type === 'item' ? this.pools.items[extra.item] : type === 'gate' ? this.pools.gates[extra.gate] : this.pools[type];
    if (!pool) return null;
    let e = null;
    if (Array.isArray(pool)) {
      for (const it of pool) {
        if (!it.alive) {
          e = it;
          break;
        }
      }
    } else {
      e = pool();
      this.pools[type] = pool;
    }
    if (!e) return null;
    e.alive = true;
    e.x = x;
    e.y = y;
    e.mesh.visible = true;
    const meshY = type === 'bat' ? 0.9 : y;
    e.mesh.position.set(x, meshY, 0);
    e.data = extra;
    this.active.push(e);
    return e;
  }

  spawnCoin(x, y) {
    for (const c of this.coinPool) {
      if (!c.alive) {
        c.alive = true;
        c.x = x;
        c.y = y;
        c.mesh.visible = true;
        c.mesh.position.set(x, y, 0);
        this.active.push(c);
        return c;
      }
    }
    return null;
  }

  deactivate(e) {
    e.alive = false;
    e.mesh.visible = false;
  }

  // 生成一个内容段，保证可通过
  chunk() {
    const len = rand(CONFIG.chunkMinLen, CONFIG.chunkMaxLen);
    const start = this.nextX;
    let cursor = 0;
    let segFirst = true;
    let place = true;

    // 内部 gap 在 0~1 个（避免过密）
    let gapsLeft = Math.random() < 0.42 ? 1 : 0;

    // 首段（平台）
    const firstLen = rand(9, 12);
    this.spawnPlatform(start + cursor, firstLen);
    cursor = firstLen;

    // 内容填充（障碍/金币/道具放在首段及后续）
    this.populateObstacles(start + 2, cursor + 2);

    while (cursor < len - 3) {
      if (gapsLeft > 0 && Math.random() < 0.45 && cursor > 6) {
        const glen = rand(GAP_MIN, Math.min(GAP_MAX, len - cursor - 4));
        if (glen >= GAP_MIN && cursor + glen <= len - 2) {
          cursor += glen;
          gapsLeft--;
          continue;
        }
      }
      const slen = Math.min(rand(8, 15), len - cursor);
      this.spawnPlatform(start + cursor, slen);
      if (!segFirst || place) this.populateObstacles(start + cursor + 1, slen - 2);
      segFirst = false;
      cursor += slen;
    }

    // chunk 尾强制补齐平台，避免与下一 chunk 边界突兀（最小 4m，不出小残片）
    const tail = len - cursor;
    if (tail > 0.5) {
      if (tail < 4) {
        // 过短的尾巴：合并进上一段，保持可站宽度
        const last = this.platforms[this.platforms.length - 1];
        if (last && last.x + last.len === start + cursor) {
          last.len += tail;
          for (const pp of this.poolPlat) {
            if (pp.alive && pp.mesh.position.x - pp.len / 2 === last.x) {
              pp.len = last.len;
              pp.mesh.scale.set(last.len, 1, 6.6);
              break;
            }
          }
        } else {
          this.spawnPlatform(start + cursor, Math.max(4, tail));
        }
      } else {
        this.spawnPlatform(start + cursor, tail);
      }
    }

    this.nextX = start + len;
  }

  populateObstacles(x0, width) {
    if (width < 4) return;
    let o = 2;
    const end = width;
    while (o < end - 3) {
      const roll = Math.random();
      let type = null;
      let need = 2;
      if (roll < 0.22) {
        type = 'crate';
        need = 1.3;
      } else if (roll < 0.36) {
        type = 'stack';
        need = 1.3;
      } else if (roll < 0.46) {
        type = 'pillar';
        need = 1.1;
      } else if (roll < 0.62) {
        type = 'bar';
        need = 3.1;
      } else if (roll < 0.74) {
        type = 'spike';
        need = 2.5;
      } else if (roll < 0.86) {
        type = 'walker';
        need = 1.2;
      } else {
        type = 'bat';
        need = 1.0;
      }
      if (o + need > end - 1.5) break;
      const px = x0 + o;
      if (type === 'walker' && Math.random() < 0.35) {
        this.spawnEntity('walker', px);
        this.spawnCoinArc(px + 0.5);
      } else if (type === 'bat') {
        this.spawnEntity('bat', px);
        this.spawnCoinArc(px, 1.4);
      } else {
        this.spawnEntity(type, px);
        if (Math.random() < 0.55) this.spawnCoinArc(px + 0.3);
      }
      o += need + rand(3.2, 6.2);
    }

    // 金币直线/列
    if (Math.random() < 0.5 && end > 6) {
      const cx = x0 + rand(2, end - 5);
      const n = randInt(4, 7);
      for (let i = 0; i < n; i++) this.spawnCoin(cx + i * 0.72, rand(0.75, 1.1));
    }

    // 道具
    if (Math.random() < 0.1 && end > 8) {
      const ix = x0 + rand(2.5, end - 3);
      this.spawnEntity('item', ix, 0, { item: 'magnet' });
    }
    if (Math.random() < 0.07 && end > 8) {
      const ix = x0 + rand(4, end - 2);
      this.spawnEntity('item', ix, 0, { item: 'shield' });
    }
    if (Math.random() < 0.08 && end > 10) {
      const ix = x0 + rand(4, end - 3);
      this.spawnEntity('item', ix, 0, { item: 'dash' });
    }
  }

  spawnCoinArc(x, yTop = 2.6) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = 0.8 + Math.sin(t * Math.PI) * yTop;
      this.spawnCoin(x - 0.5 + t * 1.9, y);
    }
  }

  // 奖励门放置在这里（保证在实体平台上）
  placeGate(type, x) {
    this.spawnEntity('gate', x, 0, { gate: type });
  }

  ensureAhead(playerX) {
    while (this.nextX < playerX + CONFIG.spawnAhead) {
      const gate = this.gateQueue.shift();
      this.chunk();
      if (gate) {
        const gx = this.nextX - rand(9, 13);
        this.ensurePlatformAt(gx, gate);
      }
    }
  }

  ensurePlatformAt(gx, gateType) {
    let has = false;
    for (const p of this.platforms) {
      if (gx >= p.x && gx <= p.x + p.len) {
        has = true;
        break;
      }
    }
    if (!has) {
      // 门脚下补一条悬空平台（保证落在可跳达的区域内）
      this.spawnPlatform(gx - 4, 12);
    }
    this.placeGate(gateType, gx);
  }

  /* ---------- 查询 ---------- */
  groundAt(x) {
    for (const p of this.platforms) {
      if (x >= p.x && x <= p.x + p.len) return 0;
    }
    return null;
  }

  topObstacleAt(x) {
    //
  }

  // 玩家 AABB 与实体求交；返回事件列表，由 game 层处理
  collide(playerAabb, playerState) {
    const events = [];
    const { minX, maxX, minY, maxY } = playerAabb;
    for (const e of this.active) {
      if (!e.alive) continue;
      const w = e.w / 2;
      const yb = e.kind === 'bat' ? e.yb : e.kind === 'bar' ? e.yb : e.y;
      const yt = e.kind === 'bat' ? e.yt : e.kind === 'bar' ? 1.5 : e.y + e.h;
      const overlapping =
        !(e.x + w < minX || e.x - w > maxX) &&
        !(yt < minY || yb > maxY);
      if (!overlapping) continue;

      if (e.kind === 'coin') {
        events.push({ type: 'coin', x: e.x, y: e.y });
        this.deactivate(e);
        continue;
      }
      if (e.kind === 'item') {
        events.push({ type: 'item', item: e.item, x: e.x, y: e.y + 0.85 });
        this.deactivate(e);
        continue;
      }
      if (e.kind === 'gate') {
        events.push({ type: 'gate', gate: e.gate, x: e.x });
        this.deactivate(e);
        continue;
      }

      const isBoss = e.boss;
      // 踩踏判定：下降中且脚底接近怪物顶部
      if (isBoss && playerState.vy < 0 && playerState.y <= yt + 0.4 && playerState.y >= yt - 0.6) {
        events.push({ type: 'stomp', x: e.x, y: yt });
        this.deactivate(e);
        continue;
      }
      events.push({ type: 'obstacle', x: e.x, y: e.y });
    }
    return events;
  }

  /* ---------- 回收与动画 ---------- */
  update(dt, playerX) {
    const behind = playerX + CONFIG.recycleBehind;
    for (const e of this.active) {
      if (!e.alive) continue;
      const kind = e.kind;
      if (kind === 'coin') {
        e.mesh.rotation.z += dt * 5;
      } else if (kind === 'item') {
        e.mesh.rotation.y += dt * 3;
        e.mesh.position.y = 0.1 + Math.sin(performance.now() * 0.004 + e.x) * 0.12;
      } else if (kind === 'gate') {
        e.mesh.rotation.z += dt * 1.2;
        e.mesh.children[0].scale.setScalar(1 + Math.sin(performance.now() * 0.006 + e.anim) * 0.06);
      } else if (kind === 'walker') {
        if (e.x > playerX - 4) e.x -= e.walkSpeed * dt;
        e.mesh.position.x = e.x;
        const anim = performance.now() * 0.008 + e.anim;
        e.mesh.children[0].scale.x = 1 + Math.sin(anim * 6) * 0.08;
      } else if (kind === 'bat') {
        e.mesh.position.y = 0.9 + Math.sin(performance.now() * 0.005 + e.anim) * 0.14;
        e.mesh.children[1].rotation.z += dt * 8;
        e.mesh.children[2].rotation.z -= dt * 8;
      }
    }

    // 回收远处实体
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      if (e.alive && e.x + 12 < behind) {
        this.deactivate(e);
        this.active.splice(i, 1);
      }
    }
    // 平台越界直接快速回收
    for (const pp of this.poolPlat) {
      if (pp.alive && (pp.mesh.position.x + pp.len / 2 < behind || pp.mesh.position.x - pp.len / 2 > playerX + 300)) {
        pp.alive = false;
        pp.mesh.visible = false;
      }
    }
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      const p = this.platforms[i];
      if (p.x + p.len < behind || p.x > playerX + 300) {
        this.platforms.splice(i, 1);
      }
    }
  }

  resetAll() {
    for (const e of [...this.active]) this.deactivate(e);
    this.active.length = 0;
    for (const p of this.poolPlat) {
      p.alive = false;
      p.mesh.visible = false;
    }
    this.platforms.length = 0;
    this.nextX = 0;
    this.gateQueue.length = 0;
  }

  setVisible(v) {
    this.group.visible = v;
    if (!v) {
      for (const e of this.active) e.mesh.visible = false;
    } else {
      for (const e of this.active) e.mesh.visible = true;
    }
  }
}
