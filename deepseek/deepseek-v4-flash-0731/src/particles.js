import * as THREE from 'three';

const MAX_PARTICLES = 400;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this.geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.pool.push({ mesh, life: 0, maxLife: 1, vel: new THREE.Vector3(), grow: 1 });
    }
  }

  _get() {
    return this.pool.pop() || { mesh: this.pool[0]?.mesh, life: 0, maxLife: 1, vel: new THREE.Vector3(), grow: 1 };
  }

  spawn(pos, opts = {}) {
    const p = this._get();
    if (!p) return;
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.scale.setScalar(opts.scale ?? 1);
    p.life = 0;
    p.maxLife = opts.life ?? 0.6;
    p.vel.set(
      opts.vx ?? (Math.random() - 0.5) * 6,
      opts.vy ?? Math.random() * 7 + 2,
      opts.vz ?? (Math.random() - 0.5) * 6
    );
    p.grow = opts.grow ?? -1;
    p.mesh.material.color.set(opts.color ?? '#ffd94a');
    p.mesh.material.opacity = 1;
    this.active.push(p);
  }

  burst(pos, count, opts = {}) {
    for (let i = 0; i < count; i++) this.spawn(pos, opts);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.mesh.visible = false;
        this.pool.push(p);
        this.active.splice(i, 1);
        continue;
      }
      const t = p.life / p.maxLife;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 16 * dt;
      const s = p.grow >= 0 ? (1 + p.grow * t) : (1 - t) * 1.4;
      p.mesh.scale.setScalar(Math.max(0.01, s));
      p.mesh.material.opacity = 1 - t;
    }
  }
}