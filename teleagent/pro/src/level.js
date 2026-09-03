// 程序化关卡生成：地形、障碍、金币、奖励关与穿越场景
// 全部使用 Three.js 几何体，无外部模型
import * as THREE from 'three';

const RNG = (seed) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return s / 4294967296;
  };
};

export class Level {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.terrain = [];
    this.obstacles = [];
    this.coins = [];
    this.nextId = 0;
    this.seed = 1;
  }

  reset() {
    this.scene.remove(this.group);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.terrain = [];
    this.obstacles = [];
    this.coins = [];
    this.nextId = 0;
  }

  // 单块跑道瓷砖（供动态延伸复用）
  buildTile(x) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const matA = new THREE.MeshStandardMaterial({ color: 0x1c2b4a, roughness: 0.9, metalness: 0.1 });
    const matB = new THREE.MeshStandardMaterial({ color: 0x23365c, roughness: 0.9, metalness: 0.1 });
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.3, 1),
      new THREE.MeshStandardMaterial({ color: 0x4ee3c0, emissive: 0x0a3a30, emissiveIntensity: 0.6 })
    );
    const tile = new THREE.Mesh(geo, x % 2 === 0 ? matA : matB);
    tile.position.set(x, -0.5, 0);
    this.group.add(tile);
    this.terrain.push(tile);
    for (const side of [-1, 1]) {
      const e = edge.clone();
      e.position.set(x, 0.05, side * 5.2);
      this.group.add(e);
    }
    geo.dispose();
    matA.dispose();
    matB.dispose();
    edge.geometry.dispose();
    return tile;
  }

  // 主赛道地面条带（双色拼接，形成速度感）
  buildRunway(length) {
    for (let x = 0; x < length; x++) this.buildTile(x);
    // 视差背景
    this.buildBackground();
  }

  // 城市天际线视差背景（远中近三层）
  buildBackground() {
    const far = new THREE.Group();
    const mid = new THREE.Group();
    const near = new THREE.Group();
    const colors = [0x16233f, 0x1b2c52, 0x243a6b];
    const depth = [90, 48, 26];
    const groups = [far, mid, near];
    for (let gi = 0; gi < 3; gi++) {
      for (let x = -60; x < 60; x += 3 + Math.floor(Math.random() * 4)) {
        const h = 4 + Math.random() * (gi === 0 ? 22 : gi === 1 ? 14 : 7);
        const w = 1.6 + Math.random() * 2;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, w),
          new THREE.MeshStandardMaterial({ color: colors[gi], emissive: colors[gi], emissiveIntensity: 0.25, roughness: 0.9 })
        );
        box.position.set(x, h / 2 - 0.5, -depth[gi]);
        groups[gi].add(box);
        // 窗户光点
        if (Math.random() < 0.5) {
          const light = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.12, 0.14, 0.1),
            new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xffe9a3 : 0x7ad4ff })
          );
          light.position.set(x + (Math.random() - 0.5) * w, h * (0.3 + Math.random() * 0.5), -depth[gi] - w / 2);
          groups[gi].add(light);
        }
      }
      this.group.add(groups[gi]);
    }
    // 星/粒子点缀
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 300 }, () => new THREE.Vector3(
          (Math.random() - 0.5) * 200, Math.random() * 60, -120 - Math.random() * 40
        ))
      ),
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.7 })
    );
    this.group.add(stars);
  }

  // 程序化障碍物工厂
  makeObstacle(type) {
    let mesh;
    switch (type) {
      case 'box': {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 2.4, 1.4),
          new THREE.MeshStandardMaterial({ color: 0x8a4dff, roughness: 0.5, metalness: 0.3 })
        );
        mesh.position.y = 1.2;
        break;
      }
      case 'barrier': {
        // 低空闸门（需下蹲）
        mesh = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xffcf4d, emissive: 0x5a3d00, emissiveIntensity: 0.5 });
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 4), mat);
        top.position.y = 2.1;
        const postL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), mat);
        postL.position.set(-2.2, 1.5, 0);
        const postR = postL.clone();
        postR.position.x = 2.2;
        mesh.add(top, postL, postR);
        mesh.userData.duckRequired = true;
        break;
      }
      case 'spike': {
        mesh = new THREE.Mesh(
          new THREE.ConeGeometry(0.9, 1.6, 4),
          new THREE.MeshStandardMaterial({ color: 0xff5d73, emissive: 0x33060c, emissiveIntensity: 0.4 })
        );
        mesh.position.y = 0.8;
        break;
      }
      case 'car': {
        // 地面车体（需跳跃）
        mesh = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 1.1, 2.8),
          new THREE.MeshStandardMaterial({ color: 0x2f8cff, roughness: 0.3, metalness: 0.5 })
        );
        body.position.y = 0.95;
        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 0.7, 1.6),
          new THREE.MeshStandardMaterial({ color: 0xbfd8ff, roughness: 0.2, metalness: 0.4 })
        );
        cabin.position.set(0, 1.85, -0.2);
        const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111722 });
        for (const [wx, wz] of [[-0.9, 1], [0.9, 1], [-0.9, -1], [0.9, -1]]) {
          const w = new THREE.Mesh(wheelGeo, wheelMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(wx, 0.45, wz);
          mesh.add(w);
        }
        mesh.add(body, cabin);
        break;
      }
      case 'enemy': {
        // 可踩踏怪物（带表情化核心）
        mesh = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xff8a3c, roughness: 0.6 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), mat);
        body.position.y = 0.7;
        body.scale.y = 0.85;
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshStandardMaterial({ color: 0x1a1420 }));
        eyeL.position.set(-0.26, 0.95, 0.6);
        const eyeR = eyeL.clone();
        eyeR.position.x = 0.26;
        const footGeo = new THREE.BoxGeometry(0.5, 0.5, 0.7);
        const footMat = new THREE.MeshStandardMaterial({ color: 0xd86a24 });
        const fL = new THREE.Mesh(footGeo, footMat);
        fL.position.set(-0.35, 0.25, 0);
        const fR = fL.clone();
        fR.position.x = 0.35;
        mesh.add(body, eyeL, eyeR, fL, fR);
        mesh.userData.enemy = true;
        break;
      }
      default:
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ color: 0x888888 })
        );
    }
    return mesh;
  }

  // 在给定 x 位置放置一段障碍/金币组合，保证可通过
  placePattern(x, rng, difficulty) {
    const roll = rng();
    if (roll < 0.35) {
      // 金币弧线（鼓励跳跃）
      for (let i = 0; i < 5; i++) {
        this.spawnCoin(x + i * 1.6, 2.2 + Math.sin(i / 4 * Math.PI) * 1.2, 0);
      }
    } else if (roll < 0.55) {
      // 单障碍
      const type = difficulty > 0.5 ? ['barrier', 'spike'][Math.floor(rng() * 2)] : 'box';
      this.spawnObstacle(x, type);
    } else if (roll < 0.75) {
      // 双障碍 + 中间金币
      this.spawnObstacle(x, 'box');
      this.spawnObstacle(x + 7, 'car');
      this.spawnCoin(x + 3.5, 3.2, 0);
    } else {
      // 怪物可踩踏 + 上方金币
      this.spawnObstacle(x, 'enemy');
      this.spawnCoin(x, 3.4, 0);
      this.spawnCoin(x + 1.6, 3.4, 0);
    }
    // 偶尔生成道具（护盾/磁铁/双倍/无人机）
    if (rng() < 0.2) {
      this.spawnPowerup(x + 5, ['shield', 'magnet', 'double', 'drone'][Math.floor(rng() * 4)]);
    }
  }

  spawnPowerup(x, type) {
    const colors = { shield: 0x7ad4ff, magnet: 0xff5d73, double: 0xffcf4d, drone: 0x4ee3c0 };
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35, 0),
      new THREE.MeshStandardMaterial({
        color: colors[type] || 0xffffff,
        emissive: colors[type] || 0xffffff,
        emissiveIntensity: 0.7,
        metalness: 0.3,
        roughness: 0.2,
      })
    );
    // 底座光环
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.05, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = Math.PI / 2;
    g.add(core, ring);
    g.position.set(x, 2.2, 0);
    g.userData = { type: 'powerup', powerType: type, id: this.nextId++ };
    this.group.add(g);
    this.obstacles.push(g); // 复用障碍列表做遍历（不碰撞）
  }

  spawnCoin(x, y, z) {
    const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 14);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffcf4d,
      emissive: 0x6b4d00,
      emissiveIntensity: 0.7,
      metalness: 0.6,
      roughness: 0.2,
    });
    const coin = new THREE.Mesh(geo, mat);
    coin.position.set(x, y, z);
    coin.rotation.z = Math.PI / 2;
    coin.userData = { type: 'coin', id: this.nextId++ };
    this.group.add(coin);
    this.coins.push(coin);
  }

  spawnObstacle(x, type) {
    const o = this.makeObstacle(type);
    o.position.x = x;
    o.userData = { type, id: this.nextId++, ...o.userData };
    // 记录碰撞盒基准（自动计算包围盒）
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    o.userData.bounds = {
      half: { x: size.x / 2, y: size.y / 2, z: size.z / 2 },
      centerY: center.y - o.position.y,
    };
    this.group.add(o);
    this.obstacles.push(o);
  }

  // 动态移除超出视距的物体（对象回收，降低 drawcall）
  cull(cameraZ, keepX) {
    const cutoff = cameraZ - 12;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      if (this.obstacles[i].position.x < cutoff) {
        this.group.remove(this.obstacles[i]);
        this.obstacles.splice(i, 1);
      }
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      if (this.coins[i].position.x < cutoff) {
        this.group.remove(this.coins[i]);
        this.coins.splice(i, 1);
      }
    }
    for (let i = this.terrain.length - 1; i >= 0; i--) {
      if (this.terrain[i].position.x < cutoff - 2) {
        this.group.remove(this.terrain[i]);
        this.terrain.splice(i, 1);
      }
    }
  }
}