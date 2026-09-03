// 奖励关系统：超级奖励（云端金币平台 ×6 倍率）与穿越奖励（超光速霓虹隧道 ×2 速度）
// 两关都是真正独立搭建的 3D 场景，进入/退出由 game 层切换 world 索引与可见性
import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';

const R = Math.PI / 2;

function rand(a, b) {
  return a + Math.random() * (b - a);
}

export class BonusManager {
  constructor(scene) {
    this.scene = scene;
    this.mode = null; // 'super' | 'warp' | null
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.coins = [];
    this.exited = false;

    this.buildSuper();
    this.buildWarp();
    this.spawnCoins();
  }

  /* ---------- 超级奖励：云端金币平台 ---------- */
  buildSuper() {
    const g = new THREE.Group();
    g.name = 'super';

    const plat = new THREE.Mesh(
      new THREE.BoxGeometry(340, 1.4, 5.6),
      new THREE.MeshStandardMaterial({
        color: 0x66eaff,
        emissive: 0x1a95b8,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.92,
        roughness: 0.3,
      }),
    );
    plat.position.set(140, -0.7, 0);
    g.add(plat);

    // 平台两侧霓虹描边
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x9ff8ff });
    for (const s of [0, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(340, 0.1, 0.18), edgeMat);
      bar.position.set(140, 0.08, s === 0 ? 2.8 : -2.8);
      g.add(bar);
    }

    // 云端浮岛装饰
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xeaf8ff, emissive: 0x88b4ff, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 });
    const sphereGeo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Mesh(sphereGeo, cloudMat);
      const s = rand(1.6, 4.3);
      c.scale.set(s * 1.7, s * 0.6, s);
      c.position.set(i * 13 + rand(-3, 3), rand(-3.2, -1.6), rand(-9, 9));
      g.add(c);
    }

    // 出入口光环
    const gateGeo = new THREE.TorusGeometry(3.1, 0.34, 10, 40);
    const gateMat = new THREE.MeshStandardMaterial({ color: COLORS.superGate, emissive: 0x0a8898, emissiveIntensity: 2.4 });
    this.superExitGate = new THREE.Mesh(gateGeo, gateMat);
    this.superExitGate.rotation.y = R;
    this.superExitGate.position.set(155, 3, 0);
    g.add(this.superExitGate);

    const light = new THREE.PointLight(0x66eaff, 60, 90, 1.5);
    light.position.set(120, 10, 0);
    g.add(light);

    this.superGroup = g;
    this.group.add(g);
  }

  /* ---------- 穿越奖励：超光速霓虹隧道 ---------- */
  buildWarp() {
    const g = new THREE.Group();
    g.name = 'warp';

    const tunnelMat = new THREE.MeshBasicMaterial({
      color: 0x14081f,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.92,
    });
    const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 380, 28, 1, true), tunnelMat);
    tunnel.rotation.z = R;
    tunnel.position.set(180, 0, 0);
    g.add(tunnel);

    // 隧道内发光环（每 12m 一圈）
    const ringGeo = new THREE.TorusGeometry(7.9, 0.16, 6, 32);
    const ringMats = [new THREE.MeshBasicMaterial({ color: 0x46e0ff, transparent: true, opacity: 0.85 }), new THREE.MeshBasicMaterial({ color: 0xff5ecf, transparent: true, opacity: 0.85 })];
    for (let i = 0; i < 30; i++) {
      const ring = new THREE.Mesh(ringGeo, ringMats[i % 2]);
      ring.rotation.y = R;
      ring.position.set(i * 12.6 + 4, 0, 0);
      g.add(ring);
    }

    // 地面光带
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x0f2f52, transparent: true, opacity: 0.95 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(380, 0.3, 3.4), floorMat);
    floor.position.set(180, -0.16, 0);
    g.add(floor);
    const floorGlow = new THREE.Mesh(new THREE.BoxGeometry(380, 0.1, 0.5), new THREE.MeshBasicMaterial({ color: 0x46e0ff, transparent: true, opacity: 0.9 }));
    floorGlow.position.set(180, 0.02, 0);
    g.add(floorGlow);

    const light2 = new THREE.PointLight(0x46e0ff, 70, 80, 1.4);
    light2.position.set(90, 8, 0);
    g.add(light2);
    const light3 = new THREE.PointLight(0xff5ecf, 70, 80, 1.4);
    light3.position.set(220, 8, 0);
    g.add(light3);

    this.warpGroup = g;
    this.group.add(g);
  }

  /* ---------- 金币池 ---------- */
  spawnCoins() {
    const geoS = new THREE.CylinderGeometry(0.36, 0.36, 0.1, 16);
    const matS = new THREE.MeshStandardMaterial({ color: COLORS.coin, emissive: 0xbb7a00, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.3 });
    for (let i = 0; i < 110; i++) {
      const m = new THREE.Mesh(geoS, matS);
      m.rotation.x = R;
      m.visible = false;
      this.group.add(m);
      this.coins.push({ mesh: m, alive: false, x: 0, y: 0 });
    }
  }

  useCoin(x, y) {
    for (const c of this.coins) {
      if (!c.alive) {
        c.alive = true;
        c.x = x;
        c.y = y;
        c.mesh.visible = true;
        c.mesh.position.set(x, y, 0);
        return c;
      }
    }
    return null;
  }

  clearCoins() {
    for (const c of this.coins) {
      c.alive = false;
      c.mesh.visible = false;
    }
  }

  /* ---------- 进入 ---------- */
  enter(mode) {
    this.mode = mode;
    this.exited = false;
    this.timer = mode === 'super' ? CONFIG.superBonusTime : CONFIG.warpBonusTime;
    this.coinCountThisRun = 0;
    this.playerLocalX = -60;
    this.clearCoins();
    this.superGroup.visible = mode === 'super';
    this.warpGroup.visible = mode === 'warp';
    this.group.visible = true;

    if (mode === 'super') {
      // 金币阵：大弧线 + 蛇形线 + 高空直线（全部落在可达区间 -50..150）
      for (let i = 0; i < 24; i++) {
        const t = i / 23;
        this.useCoin(-50 + t * 200, 0.9 + Math.sin(t * Math.PI * 3.1) * 1.5 + (i % 7 === 0 ? 1.2 : 0));
      }
      for (let i = 0; i < 16; i++) {
        const t = i / 15;
        this.useCoin(-30 + t * 170, 1.0 + Math.abs(Math.sin(t * Math.PI * 5)) * 2.4);
      }
      for (let i = 0; i < 18; i++) {
        const t = i / 17;
        this.useCoin(t * 150 + 20, 2.1 + Math.sin(t * Math.PI * 2.4) * 0.8);
      }
    } else {
      // 隧道金币墙：三列竖排
      for (let i = 0; i < 30; i++) {
        const x = i * 8 + 20;
        const glow = i % 4 === 0;
        this.useCoin(x, 0.85);
        this.useCoin(x, 1.65);
        this.useCoin(x, 2.45);
        if (glow) this.useCoin(x + 4, 0.85 + Math.sin(i) * 0.9);
      }
    }
  }

  update(dt, player) {
    if (!this.mode) return { events: [], exit: false };
    const events = [];
    // 金币旋转 + 拾取判定
    for (const c of this.coins) {
      if (!c.alive) continue;
      c.mesh.rotation.z += dt * 6;
      const dx = this.playerLocalX - c.x;
      if (Math.abs(dx) < 0.8 && Math.abs(player.y + 0.8 - c.y) < 1.35) {
        c.alive = false;
        c.mesh.visible = false;
        this.coinCountThisRun++;
        events.push({ type: 'coin', x: c.x, y: c.y });
      }
    }

    // 计时与出口
    if (this.mode === 'super') {
      this.timer -= dt;
      if (this.timer <= 0 || this.playerLocalX > 150) {
        return { events, exit: true };
      }
    } else {
      this.timer -= dt;
      if (this.timer <= 0 || this.playerLocalX > 330) {
        return { events, exit: true };
      }
    }
    return { events, exit: false };
  }

  currentMode() {
    return this.mode;
  }

  groundAt() {
    return 0; // 奖励关恒有地面
  }

  spawnX() {
    return -60;
  }

  exit() {
    this.mode = null;
    this.group.visible = false;
    this.clearCoins();
  }

  setVisible(v) {
    this.group.visible = v;
  }
}
