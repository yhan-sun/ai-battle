import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.maxParticles = 600;
    
    // Geometry with positions and colors
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);
    
    // Particle state arrays
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        r: 1, g: 1, b: 1,
        size: 0.2,
        life: 0,
        maxLife: 1,
        gravity: -10,
        drag: 0.96
      });
      this.sizes[i] = 0;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Custom shader material for glowing round particles
    this.material = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.05, dist);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  spawn(x, y, z, count, options = {}) {
    let spawned = 0;
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x + (Math.random() - 0.5) * (options.spreadX || 0.2);
        p.y = y + (Math.random() - 0.5) * (options.spreadY || 0.2);
        p.z = z + (Math.random() - 0.5) * (options.spreadZ || 0.2);
        
        const speed = options.speed || 4;
        const angle = options.angle !== undefined ? options.angle + (Math.random() - 0.5) * (options.angleSpread || 1) : Math.random() * Math.PI * 2;
        p.vx = (options.vx !== undefined ? options.vx : Math.cos(angle) * speed) + (Math.random() - 0.5) * (options.randV || 1);
        p.vy = (options.vy !== undefined ? options.vy : Math.sin(angle) * speed) + (Math.random() - 0.5) * (options.randV || 1);
        p.vz = (options.vz !== undefined ? options.vz : (Math.random() - 0.5) * 2);

        p.r = options.r !== undefined ? options.r : 1;
        p.g = options.g !== undefined ? options.g : 0.8;
        p.b = options.b !== undefined ? options.b : 0.2;
        
        p.size = options.size || 0.25;
        p.life = 0;
        p.maxLife = options.maxLife || (0.4 + Math.random() * 0.4);
        p.gravity = options.gravity !== undefined ? options.gravity : -8;
        p.drag = options.drag !== undefined ? options.drag : 0.95;

        spawned++;
      }
    }
  }

  // Helper presets
  spawnRunDust(x, y, z) {
    this.spawn(x - 0.4, y + 0.1, z, 2, {
      vx: -2 - Math.random() * 2,
      vy: 1 + Math.random() * 2,
      vz: (Math.random() - 0.5) * 1.5,
      r: 0.6, g: 0.7, b: 0.9,
      size: 0.2,
      maxLife: 0.35,
      gravity: -2
    });
  }

  spawnSlideSparks(x, y, z) {
    this.spawn(x - 0.2, y + 0.05, z, 5, {
      vx: -7 - Math.random() * 6,
      vy: 2 + Math.random() * 5,
      vz: (Math.random() - 0.5) * 3,
      r: 1.0, g: 0.6, b: 0.1,
      size: 0.22,
      maxLife: 0.3,
      gravity: -12
    });
  }

  spawnJumpShockwave(x, y, z, isDouble = false) {
    const count = isDouble ? 30 : 16;
    const r = isDouble ? 0.3 : 0.4;
    const g = isDouble ? 0.8 : 0.7;
    const b = isDouble ? 1.0 : 0.9;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.spawn(x, y + 0.2, z, 1, {
        vx: Math.cos(angle) * (isDouble ? 8 : 5),
        vy: (Math.random() - 0.2) * 3,
        vz: Math.sin(angle) * (isDouble ? 8 : 5),
        r, g, b,
        size: 0.3,
        maxLife: 0.4,
        gravity: -2
      });
    }
  }

  spawnCoinSparkle(x, y, z, colorType = 'gold') {
    let r = 1, g = 0.85, b = 0.1;
    if (colorType === 'blue') { r = 0.2; g = 0.7; b = 1.0; }
    if (colorType === 'pink') { r = 1.0; g = 0.2; b = 0.8; }
    this.spawn(x, y, z, 12, {
      speed: 4.5,
      r, g, b,
      size: 0.35,
      maxLife: 0.5,
      gravity: -4
    });
  }

  spawnExplosion(x, y, z, color = { r: 1, g: 0.4, b: 0.1 }) {
    this.spawn(x, y, z, 35, {
      speed: 9,
      r: color.r, g: color.g, b: color.b,
      size: 0.45,
      maxLife: 0.6,
      gravity: -14
    });
  }

  spawnSpeedStreaks(x, y, z, count = 4, isWarp = false) {
    this.spawn(x + 15 + Math.random() * 10, y + (Math.random() - 0.5) * 8, z + (Math.random() - 0.5) * 6, count, {
      vx: isWarp ? -35 - Math.random() * 20 : -25 - Math.random() * 15,
      vy: 0,
      vz: 0,
      r: isWarp ? 0.0 : 0.8,
      g: isWarp ? 0.9 : 0.9,
      b: 1.0,
      size: isWarp ? 0.4 : 0.25,
      maxLife: 0.5,
      gravity: 0
    });
  }

  update(dt) {
    let activeCount = 0;
    const pos = this.positions;
    const col = this.colors;
    const sz = this.sizes;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          sz[i] = 0;
          continue;
        }

        // Physics
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy += p.gravity * dt;
        p.vx *= p.drag;
        p.vz *= p.drag;

        const lifeRatio = p.life / p.maxLife;
        const currentSize = p.size * (1 - lifeRatio);

        // Write buffer attributes
        const i3 = i * 3;
        pos[i3] = p.x;
        pos[i3 + 1] = p.y;
        pos[i3 + 2] = p.z;

        col[i3] = p.r;
        col[i3 + 1] = p.g;
        col[i3 + 2] = p.b;

        sz[i] = currentSize;
        activeCount++;
      } else {
        sz[i] = 0;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }
}
