import * as THREE from 'three';

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(96.0, aSize * (330.0 / max(1.0, -mvPosition.z)));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;

  void main() {
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord);
    if (dist > 0.5) discard;
    float alpha = smoothstep(0.5, 0.06, dist);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

/**
 * 单 draw call 的 GPU 粒子池。
 * 位置、颜色、尺寸全部通过 BufferAttribute 上传，适合金币火花、
 * 冲刺尾迹、撞击爆裂、奖励彩纸等大量短命粒子。
 */
export class Particles {
  constructor(scene, capacity = 700) {
    this.capacity = capacity;
    this.cursor = 0;

    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);

    this.velocity = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.alive = new Uint8Array(capacity);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 400);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);

    this._color = new THREE.Color();
    this._dirty = false;
  }

  /**
   * 生成一簇粒子。
   * @param {{x:number,y:number,z:number}} origin
   * @param {object} options
   */
  burst(origin, options = {}) {
    const {
      count = 12,
      colors = [0xffd257, 0xfff3b0],
      speed = 6,
      spread = 1.2,
      size = 0.32,
      sizeVariance = 0.5,
      life = 0.7,
      lifeVariance = 0.5,
      gravity = 12,
      drag = 1.8,
      direction = null,
      upward = 0.4,
    } = options;

    for (let i = 0; i < count; i += 1) {
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const i3 = index * 3;

      this.positions[i3] = origin.x + (Math.random() - 0.5) * spread;
      this.positions[i3 + 1] = origin.y + (Math.random() - 0.5) * spread;
      this.positions[i3 + 2] = origin.z + (Math.random() - 0.5) * spread;

      let vx;
      let vy;
      let vz;
      if (direction) {
        const jitter = 0.7;
        vx = direction.x * speed + (Math.random() - 0.5) * speed * jitter;
        vy = direction.y * speed + (Math.random() - 0.5) * speed * jitter;
        vz = direction.z * speed + (Math.random() - 0.5) * speed * jitter;
      } else {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const magnitude = speed * (0.35 + Math.random() * 0.65);
        vx = Math.sin(phi) * Math.cos(theta) * magnitude;
        vy = Math.abs(Math.cos(phi)) * magnitude + upward * speed;
        vz = Math.sin(phi) * Math.sin(theta) * magnitude * 0.6;
      }
      this.velocity[i3] = vx;
      this.velocity[i3 + 1] = vy;
      this.velocity[i3 + 2] = vz;

      this._color.setHex(colors[Math.floor(Math.random() * colors.length)]);
      this.colors[i3] = this._color.r;
      this.colors[i3 + 1] = this._color.g;
      this.colors[i3 + 2] = this._color.b;

      const particleLife = life * (1 - lifeVariance / 2 + Math.random() * lifeVariance);
      this.life[index] = particleLife;
      this.maxLife[index] = particleLife;
      this.gravity[index] = gravity;
      this.drag[index] = drag;
      this.baseSize[index] = size * (1 - sizeVariance / 2 + Math.random() * sizeVariance);
      this.sizes[index] = this.baseSize[index];
      this.alive[index] = 1;
      this._dirty = true;
    }
  }

  /** 单个粒子，用于冲刺尾迹等连续发射。 */
  emit(position, options = {}) {
    this.burst(position, {
      count: 1,
      speed: 0.6,
      spread: 0.16,
      size: 0.22,
      life: 0.4,
      gravity: 0,
      drag: 2.2,
      ...options,
    });
  }

  reset() {
    this.positions.fill(0);
    this.sizes.fill(0);
    this.alive.fill(0);
    this.life.fill(0);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
  }

  update(dt) {
    let changed = this._dirty;
    for (let index = 0; index < this.capacity; index += 1) {
      if (!this.alive[index]) continue;
      const i3 = index * 3;
      this.life[index] -= dt;
      if (this.life[index] <= 0) {
        this.alive[index] = 0;
        this.sizes[index] = 0;
        changed = true;
        continue;
      }

      const dragFactor = Math.max(0, 1 - this.drag[index] * dt);
      this.velocity[i3] *= dragFactor;
      this.velocity[i3 + 1] = this.velocity[i3 + 1] * dragFactor - this.gravity[index] * dt;
      this.velocity[i3 + 2] *= dragFactor;

      this.positions[i3] += this.velocity[i3] * dt;
      this.positions[i3 + 1] += this.velocity[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocity[i3 + 2] * dt;

      const ratio = this.life[index] / this.maxLife[index];
      this.sizes[index] = this.baseSize[index] * (0.25 + ratio * 0.75);
      changed = true;
    }

    if (changed) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.aColor.needsUpdate = true;
      this.geometry.attributes.aSize.needsUpdate = true;
      this._dirty = false;
    }
  }
}
