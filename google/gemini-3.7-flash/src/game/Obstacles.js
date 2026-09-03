import * as THREE from 'three';

export const ObstacleType = {
  SPIKE_BARRIER: 'SPIKE_BARRIER',
  HIGH_LASER: 'HIGH_LASER',
  STOMP_MONSTER: 'STOMP_MONSTER',
  MOVING_BARRIER: 'MOVING_BARRIER',
  SPRING_PAD: 'SPRING_PAD'
};

export class ObstacleManager {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.obstacles = [];

    // Shared Geometries & Materials for high performance
    this.spikeGeo = new THREE.ConeGeometry(0.35, 0.9, 5);
    this.spikeMat = new THREE.MeshStandardMaterial({
      color: 0xEF4444,
      emissive: 0xB91C1C,
      emissiveIntensity: 0.5,
      roughness: 0.3
    });

    this.laserFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    this.laserBeamMat = new THREE.MeshBasicMaterial({
      color: 0xEC4899,
      transparent: true,
      opacity: 0.85
    });

    this.monsterMat = new THREE.MeshStandardMaterial({
      color: 0x8B5CF6,
      emissive: 0x6D28D9,
      emissiveIntensity: 0.4,
      roughness: 0.2
    });

    this.springMat = new THREE.MeshStandardMaterial({
      color: 0xF59E0B,
      emissive: 0xD97706,
      emissiveIntensity: 0.6
    });
  }

  spawn(type, x, y, z = 0, options = {}) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    
    let box = new THREE.Box3();
    let customData = { ...options, type, initialY: y, animTimer: Math.random() * 5 };

    if (type === ObstacleType.SPIKE_BARRIER) {
      const count = options.count || 2;
      for (let i = 0; i < count; i++) {
        const spike = new THREE.Mesh(this.spikeGeo, this.spikeMat);
        spike.position.set((i - (count - 1) / 2) * 0.5, 0.45, 0);
        group.add(spike);
      }
      box.set(
        new THREE.Vector3(x - (count * 0.5) / 2, y, z - 0.5),
        new THREE.Vector3(x + (count * 0.5) / 2, y + 0.9, z + 0.5)
      );
    } 
    else if (type === ObstacleType.HIGH_LASER) {
      // High barrier with laser beam at y: 1.0 -> 2.2, open space below (y: 0 -> 0.95) for SLIDING
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8);
      const poleLeft = new THREE.Mesh(poleGeo, this.laserFrameMat);
      poleLeft.position.set(0, 1.25, 0.9);
      const poleRight = new THREE.Mesh(poleGeo, this.laserFrameMat);
      poleRight.position.set(0, 1.25, -0.9);
      group.add(poleLeft);
      group.add(poleRight);

      const beamGeo = new THREE.BoxGeometry(0.3, 0.85, 1.8);
      const beam = new THREE.Mesh(beamGeo, this.laserBeamMat);
      beam.position.set(0, 1.5, 0);
      group.add(beam);

      // Hitbox only covers high area
      box.set(
        new THREE.Vector3(x - 0.25, y + 0.95, z - 0.9),
        new THREE.Vector3(x + 0.25, y + 2.2, z + 0.9)
      );
    }
    else if (type === ObstacleType.STOMP_MONSTER) {
      // Cute bouncy mecha alien
      const bodyGeo = new THREE.SphereGeometry(0.5, 12, 10);
      const body = new THREE.Mesh(bodyGeo, this.monsterMat);
      body.position.y = 0.5;
      group.add(body);

      // Horns / Spikes on sides
      const hornGeo = new THREE.ConeGeometry(0.12, 0.35, 4);
      hornGeo.rotateZ(Math.PI / 3);
      const hornL = new THREE.Mesh(hornGeo, this.spikeMat);
      hornL.position.set(0, 0.8, 0.35);
      const hornR = new THREE.Mesh(hornGeo, this.spikeMat);
      hornR.position.set(0, 0.8, -0.35);
      group.add(hornL);
      group.add(hornR);

      // Glowing Eye
      const eyeGeo = new THREE.SphereGeometry(0.16, 8, 8);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(-0.35, 0.55, 0);
      group.add(eye);

      box.set(
        new THREE.Vector3(x - 0.5, y, z - 0.5),
        new THREE.Vector3(x + 0.5, y + 1.0, z + 0.5)
      );
    }
    else if (type === ObstacleType.SPRING_PAD) {
      // Launch pad
      const baseGeo = new THREE.BoxGeometry(0.9, 0.2, 0.9);
      const base = new THREE.Mesh(baseGeo, this.laserFrameMat);
      base.position.y = 0.1;
      group.add(base);

      const padGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.15, 12);
      const pad = new THREE.Mesh(padGeo, this.springMat);
      pad.position.y = 0.25;
      group.add(pad);

      box.set(
        new THREE.Vector3(x - 0.45, y, z - 0.45),
        new THREE.Vector3(x + 0.45, y + 0.4, z + 0.45)
      );
    }

    this.scene.add(group);
    const obs = { group, box, type, customData, active: true, x, y, z };
    this.obstacles.push(obs);
    return obs;
  }

  update(dt, playerX) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (!obs.active) {
        this.scene.remove(obs.group);
        this.obstacles.splice(i, 1);
        continue;
      }

      // Recycle if far behind
      if (obs.group.position.x < playerX - 25) {
        this.scene.remove(obs.group);
        this.obstacles.splice(i, 1);
        continue;
      }

      obs.customData.animTimer += dt;
      const t = obs.customData.animTimer;

      if (obs.type === ObstacleType.STOMP_MONSTER) {
        // Monster vertical hop bounce
        const hop = Math.abs(Math.sin(t * 5)) * 0.7;
        obs.group.position.y = obs.customData.initialY + hop;
        obs.box.min.y = obs.customData.initialY + hop;
        obs.box.max.y = obs.customData.initialY + hop + 1.0;
      }
      else if (obs.type === ObstacleType.HIGH_LASER) {
        // Laser pulse glow
        obs.group.children[2].material.opacity = 0.6 + Math.sin(t * 10) * 0.3;
      }
    }
  }

  clearAll() {
    for (const obs of this.obstacles) {
      this.scene.remove(obs.group);
    }
    this.obstacles = [];
  }

  destroyObstacle(obs, asBonus = false) {
    obs.active = false;
    this.scene.remove(obs.group);
    this.particles.spawnExplosion(obs.group.position.x, obs.group.position.y + 0.5, obs.group.position.z, {
      r: asBonus ? 1.0 : 0.9,
      g: asBonus ? 0.8 : 0.3,
      b: asBonus ? 0.2 : 0.2
    });
  }
}
