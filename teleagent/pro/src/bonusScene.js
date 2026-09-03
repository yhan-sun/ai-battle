// 超级奖励 & 穿越奖励：独立的 3D 场景与环境，非简单换背景
import * as THREE from 'three';

export class BonusScene {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.coins = [];
    this.nextId = 0;
    this.kind = null;
    this.warpParticles = [];
    this.pulseT = 0;
  }

  show(kind) {
    this.kind = kind;
    this.group.visible = true;
    if (kind === 'warp') this.buildWarp();
  }

  hide() {
    this.group.visible = false;
    this.clearDynamic();
  }

  clearDynamic() {
    // 只清金币与粒子，保留结构
    for (const c of this.coins) this.group.remove(c);
    this.coins = [];
    for (const p of this.warpedParticles || []) this.group.remove(p);
    this.warpedParticles = [];
  }

  // 超级奖励场景：独立浮空平台 + 金币阵列
  buildSuper(totalCoins) {
    this.group.visible = true;
    this.kind = 'super';
    const g = this.group;
    // 浮空跑道
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x7aa5ff, emissive: 0x1a3a6a, emissiveIntensity: 0.8, roughness: 0.5 })
    );
    deck.position.set(0, 3, 0);
    g.add(deck);
    // 两侧光柱
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 14, 8),
        new THREE.MeshBasicMaterial({ color: 0x9a7aff, transparent: true, opacity: 0.5 })
      );
      pillar.position.set(side * 3.4, 7, 0);
      g.add(pillar);
    }
    // 上方光环
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.12, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9a3 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 9, 0);
    g.add(halo);
    // 金币阵列（多排）
    for (let i = 0; i < totalCoins; i++) {
      const x = i * 2.2 - totalCoins * 1.1;
      const y = 3.4 + Math.sin(i * 0.8) * 0.5;
      this.spawnCoin(x, y, 0);
    }
    g.visible = true;
  }

  // 穿越奖励：真正切换到高速太空隧道场景
  buildWarp() {
    const g = this.group;
    // 背景星云圆环（动态旋转）
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6, 0.35, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0x7ad4ff, transparent: true, opacity: 0.8 })
    );
    ring.position.z = -10;
    g.add(ring);
    this.warpRing = ring;
    // 高速光速粒子（轴向拉长，模拟超光速运动）
    const n = 220;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, transparent: true, opacity: 0.9 })
    );
    g.add(pts);
    this.warpPts = pts;
    // 浮空金币直线阵列
    for (let i = 0; i < 16; i++) {
      this.spawnCoin(i * 3 - 8, 3.4, 0);
    }
    g.visible = true;
  }

  spawnCoin(x, y, z) {
    const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 14);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffcf4d,
      emissive: 0x6b4d00,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.2,
    });
    const coin = new THREE.Mesh(geo, mat);
    coin.position.set(x, y, z);
    coin.userData = { type: 'bonusCoin', id: this.nextId++, x: x, y: y, z: z };
    this.group.add(coin);
    this.coins.push(coin);
  }

  update(dt, time) {
    if (!this.group.visible) return;
    // 动画
    for (const c of this.coins) {
      c.rotation.y += dt * 4;
      c.position.y = (c.userData.y || 3.4) + Math.sin(time * 3 + c.position.x) * 0.18;
    }
    if (this.warpRing) {
      this.warpRing.rotation.z += dt * 2;
      this.warpRing.rotation.x = Math.PI / 2 + Math.sin(time * 0.5) * 0.3;
    }
    if (this.warpPts) {
      // 粒子朝相机快速移动，产生超光速感
      const pos = this.warpPts.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.array[i * 3 + 2] += dt * 60;
        if (pos.array[i * 3 + 2] > 30) pos.array[i * 3 + 2] = -30;
      }
      pos.needsUpdate = true;
    }
  }
}