// 粒子池（零 GC 复用）与镜头震动/火花等 VFX
import * as THREE from 'three';

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.count = 0;
    // 预分配 120 个粒子
    const geo = new THREE.SphereGeometry(0.08, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ transparent: true });
    for (let i = 0; i < 120; i++) {
      const m = new THREE.Mesh(geo, mat.clone());
      m.visible = false;
      m.userData = { life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, shrink: 1 };
      this.group.add(m);
      this.pool.push(m);
    }
    geo.dispose();
  }

  getFree() {
    for (const p of this.pool) if (!p.visible) return p;
    return null;
  }

  burst({ x, y, z, count = 10, color = 0xffcf4d, speed = 5, up = 3, life = 0.5 }) {
    for (let i = 0; i < count; i++) {
      const p = this.getFree();
      if (!p) return;
      p.visible = true;
      p.position.set(x, y, z);
      const ang = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      p.userData.vx = Math.cos(ang) * sp;
      p.userData.vy = Math.random() * up;
      p.userData.vz = Math.sin(ang) * sp;
      p.userData.maxLife = life * (0.6 + Math.random() * 0.6);
      p.userData.life = 0;
      p.material.color.setHex(color);
      p.material.opacity = 0.9;
      p.scale.set(1, 1, 1);
      p.userData.shrink = 1;
    }
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.visible) continue;
      const u = p.userData;
      u.life += dt;
      const t = u.life / u.maxLife;
      if (t >= 1) {
        p.visible = false;
        continue;
      }
      p.position.x += u.vx * dt;
      p.position.y += u.vy * dt;
      p.position.z += u.vz * dt;
      u.vy -= 9 * dt;
      p.material.opacity = 0.9 * (1 - t);
      const s = 1 - t * 0.7;
      p.scale.set(s, s, s);
    }
  }
}