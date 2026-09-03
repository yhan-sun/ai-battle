// 零 GC 对象池粒子系统：统一 sprite，收币/踩怪/冲刺/受伤共用
import * as THREE from 'three';

const POOL_SIZE = 96;

export class ParticleEngine {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.SpriteMaterial({
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.scale.set(0.28, 0.28, 1);
      scene.add(sprite);
      this.pool.push({
        sprite,
        alive: false,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        drag: 0.92,
        grav: 0,
        grow: 0,
      });
    }
    this.cursor = 0;
  }

  spawn(x, y, z, { color = 0xffd76a, count = 6, speed = 6, life = 0.55, size = 0.28, grav = -6, up = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % POOL_SIZE;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.65);
      p.alive = true;
      p.sprite.visible = true;
      p.sprite.position.set(x, y, z);
      p.sprite.material.color.setHex(color);
      const s = size * (0.7 + Math.random() * 0.6);
      p.sprite.scale.set(s, s, 1);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.abs(Math.sin(a)) * sp * 0.7 + up;
      p.vz = Math.sin(a) * sp * 0.5;
      p.life = life * (0.7 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.grav = grav;
      p.grow = 0.55;
    }
  }

  update(dt) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        p.sprite.visible = false;
        continue;
      }
      p.vy += p.grav * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.vz *= Math.pow(p.drag, dt * 60);
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      const k = p.life / p.maxLife;
      const s = p.sprite.scale.x * (1 + p.grow * dt * 4 * (1 - k));
      p.sprite.scale.set(Math.max(0.02, s), Math.max(0.02, s), 1);
      p.sprite.material.opacity = Math.min(1, k * 1.6);
      if (p.sprite.position.y < 0.05 && p.grav < 0) p.sprite.position.y = 0.05;
    }
  }

  reset() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool[i].alive = false;
      this.pool[i].sprite.visible = false;
    }
  }
}
