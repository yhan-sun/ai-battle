import * as THREE from 'three';

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.floatingTexts = [];
    
    // Create shared geometries and materials for fast instantiation
    this.sparkGeo = new THREE.SphereGeometry(0.08, 6, 6);
    this.starGeo = new THREE.TetrahedronGeometry(0.12);
    this.dustGeo = new THREE.DodecahedronGeometry(0.1);
    this.ringGeo = new THREE.RingGeometry(0.1, 0.25, 16);
    this.ringGeo.rotateX(-Math.PI / 2);

    // Speed lines group
    this.initSpeedLines();

    // Camera shake state
    this.shakeIntensity = 0;
    this.shakeDecay = 5.0;
    this.shakeOffset = new THREE.Vector3();
  }

  initSpeedLines() {
    this.speedLinesGroup = new THREE.Group();
    this.scene.add(this.speedLinesGroup);
    this.speedLines = [];

    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });

    const lineGeo = new THREE.CylinderGeometry(0.02, 0.02, 3, 4);
    lineGeo.rotateZ(Math.PI / 2);

    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(lineGeo, lineMat.clone());
      mesh.position.set(
        (Math.random() - 0.5) * 20,
        Math.random() * 8 + 0.5,
        (Math.random() - 0.5) * 6
      );
      this.speedLinesGroup.add(mesh);
      this.speedLines.push({
        mesh,
        baseX: mesh.position.x,
        speed: 30 + Math.random() * 20
      });
    }
  }

  setSpeedLineOpacity(opacity) {
    this.speedLines.forEach(l => {
      l.mesh.material.opacity = opacity;
    });
  }

  addShake(intensity) {
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 0.8);
  }

  spawnFootstepDust(pos) {
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xdddddd,
        transparent: true,
        opacity: 0.6
      });
      const mesh = new THREE.Mesh(this.dustGeo, mat);
      mesh.position.copy(pos);
      mesh.position.x -= 0.3;
      mesh.position.y += 0.05 + Math.random() * 0.1;
      mesh.position.z += (Math.random() - 0.5) * 0.2;
      
      const scale = 0.5 + Math.random() * 0.5;
      mesh.scale.set(scale, scale, scale);
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vel: new THREE.Vector3(-1.5 - Math.random() * 2, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 0.6),
        gravity: 0.5,
        life: 0.35,
        maxLife: 0.35,
        grow: 1.5
      });
    }
  }

  spawnLandingImpact(pos) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(this.ringGeo, mat);
    ring.position.set(pos.x, pos.y + 0.03, pos.z);
    this.scene.add(ring);

    this.particles.push({
      mesh: ring,
      scaleSpeed: 6.0,
      life: 0.25,
      maxLife: 0.25,
      isRing: true
    });
  }

  spawnCoinSparkles(pos, color = 0xffd700, count = 8) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(this.starGeo, mat);
      mesh.position.copy(pos);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 2.5 + Math.random() * 3.5;
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed + 1.5, (Math.random() - 0.5) * 1.5),
        rotVel: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        gravity: 6.0,
        life: 0.5,
        maxLife: 0.5
      });
    }
  }

  spawnStompBurst(pos) {
    // Colorful explosion rings + stars
    this.spawnLandingImpact(pos);
    this.spawnCoinSparkles(pos, 0xff4488, 12);
    this.spawnCoinSparkles(pos, 0xffff00, 8);
    this.addShake(0.25);
  }

  spawnObstacleExplosion(pos) {
    for (let i = 0; i < 15; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xff3300 : 0xff9900,
        transparent: true,
        opacity: 1.0
      });
      const mesh = new THREE.Mesh(this.dustGeo, mat);
      mesh.position.copy(pos);
      const scale = 0.8 + Math.random() * 0.8;
      mesh.scale.set(scale, scale, scale);
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const spd = 4 + Math.random() * 6;
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * spd, Math.random() * 6 + 2, Math.sin(angle) * spd),
        rotVel: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0),
        gravity: 12.0,
        life: 0.6,
        maxLife: 0.6
      });
    }
    this.addShake(0.35);
  }

  spawnTrailParticle(pos, color = 0x00ffff) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(this.sparkGeo, mat);
    mesh.position.copy(pos);
    mesh.position.x += (Math.random() - 0.5) * 0.2;
    mesh.position.y += (Math.random() - 0.5) * 0.2;
    this.scene.add(mesh);

    this.particles.push({
      mesh,
      vel: new THREE.Vector3(-3 - Math.random() * 2, (Math.random() - 0.5) * 0.5, 0),
      gravity: 0,
      life: 0.3,
      maxLife: 0.3
    });
  }

  // Floating text HUD in HTML container
  showFloatingScore(text, color = '#ffe600', screenPos = { x: 0.5, y: 0.5 }) {
    const container = document.getElementById('floating-text-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'floating-score-item';
    el.innerText = text;
    el.style.color = color;
    el.style.left = `${screenPos.x * 100}%`;
    el.style.top = `${screenPos.y * 100}%`;
    container.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1000);
  }

  update(dt, playerX) {
    // Update camera shake
    if (this.shakeIntensity > 0.001) {
      this.shakeOffset.set(
        (Math.random() - 0.5) * this.shakeIntensity,
        (Math.random() - 0.5) * this.shakeIntensity,
        (Math.random() - 0.5) * this.shakeIntensity * 0.5
      );
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt);
    } else {
      this.shakeOffset.set(0, 0, 0);
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      const progress = 1.0 - (p.life / p.maxLife);

      if (p.isRing) {
        p.mesh.scale.addScalar(p.scaleSpeed * dt);
        p.mesh.material.opacity = Math.max(0, 1.0 - progress);
      } else {
        if (p.vel) {
          p.mesh.position.addScaledVector(p.vel, dt);
          p.vel.y -= (p.gravity || 0) * dt;
        }
        if (p.rotVel) {
          p.mesh.rotation.x += p.rotVel.x * dt;
          p.mesh.rotation.y += p.rotVel.y * dt;
          p.mesh.rotation.z += p.rotVel.z * dt;
        }
        if (p.grow) {
          p.mesh.scale.addScalar(p.grow * dt);
        }
        p.mesh.material.opacity = Math.max(0, 1.0 - progress);
      }

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose?.();
        p.mesh.material.dispose?.();
        this.particles.splice(i, 1);
      }
    }

    // Update speed lines position relative to player
    if (this.speedLinesGroup) {
      this.speedLinesGroup.position.x = playerX + 6;
      this.speedLines.forEach(l => {
        l.mesh.position.x -= l.speed * dt;
        if (l.mesh.position.x < -15) {
          l.mesh.position.x = 15 + Math.random() * 5;
          l.mesh.position.y = Math.random() * 7 + 0.5;
        }
      });
    }
  }

  clearAll() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];
  }
}
