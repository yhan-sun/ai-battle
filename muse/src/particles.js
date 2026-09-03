import * as THREE from 'three';

// 对象池粒子系统: dust / coin spark / trail / explosion,全部 Points,零GC
export class ParticleSystem {
  constructor(scene, max = 900) {
    this.scene = scene;
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.head = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({
      size: 0.22, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    for (let i = 0; i < max; i++) { this.pos[i * 3 + 1] = -999; this.life[i] = 0; }
    this._c = new THREE.Color();
  }
  spawn(x, y, z, vx, vy, vz, life, color, grav = 0) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav;
    this._c.set(color);
    this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
  }
  burst(x, y, z, n, opt = {}) {
    const { spread = 4, up = 4, life = 0.6, color = 0xffe45e, grav = -9 } = opt;
    for (let k = 0; k < n; k++) {
      this.spawn(
        x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * spread, Math.random() * up, (Math.random() - 0.5) * spread,
        life * (0.6 + Math.random() * 0.7), color, grav
      );
    }
  }
  dust(x, y, z, n = 3) { this.burst(x, y, z, n, { spread: 2, up: 1.5, life: 0.45, color: 0xcfd8ff, grav: -2 }); }
  coinSpark(x, y, z) { this.burst(x, y, z, 8, { spread: 3, up: 4, life: 0.5, color: 0xffd94d, grav: -6 }); }
  update(dt) {
    const p = this.pos, v = this.vel;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { p[i * 3 + 1] = -999; continue; }
      v[i * 3 + 1] += this.grav[i] * dt;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (p[i * 3 + 1] < 0.02 && v[i * 3 + 1] < 0) { p[i * 3 + 1] = 0.02; v[i * 3 + 1] *= -0.4; }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
  clear() { for (let i = 0; i < this.max; i++) { this.life[i] = 0; this.pos[i * 3 + 1] = -999; } }
}
