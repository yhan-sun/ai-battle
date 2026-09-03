import * as THREE from 'three';

export const COIN_TYPES = {
  COPPER: 'copper',     // 10 pts
  SILVER: 'silver',     // 50 pts
  GOLD: 'gold',         // 100 pts
  STAR_GEM: 'star_gem', // 500 pts
  RAINBOW: 'rainbow'    // 2000 pts
};

export class Coin {
  constructor(type, x, y) {
    this.type = type;
    this.position = new THREE.Vector3(x, y, 0);
    this.baseY = y;
    this.mesh = new THREE.Group();
    this.isCollected = false;
    this.animTime = Math.random() * 5;
    this.hitbox = new THREE.Box3();

    this.buildModel();
    this.mesh.position.copy(this.position);
    this.updateHitbox();
  }

  buildModel() {
    switch (this.type) {
      case COIN_TYPES.COPPER:
        this.buildCylinderCoin(0xcd7f32, 0.28, 0.08);
        this.value = 10;
        this.feverEnergy = 0.8;
        break;
      case COIN_TYPES.SILVER:
        this.buildCylinderCoin(0xdadada, 0.3, 0.08);
        this.value = 50;
        this.feverEnergy = 1.5;
        break;
      case COIN_TYPES.GOLD:
        this.buildCylinderCoin(0xffd700, 0.34, 0.09, true);
        this.value = 100;
        this.feverEnergy = 2.5;
        break;
      case COIN_TYPES.STAR_GEM:
        this.buildStarGem(0x33ddff);
        this.value = 500;
        this.feverEnergy = 5.0;
        break;
      case COIN_TYPES.RAINBOW:
        this.buildRainbowDiamond();
        this.value = 2000;
        this.feverEnergy = 10.0;
        break;
    }
  }

  buildCylinderCoin(color, radius, thickness, hasStar = false) {
    const coinGeo = new THREE.CylinderGeometry(radius, radius, thickness, 16);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.8,
      roughness: 0.2
    });
    const coinMesh = new THREE.Mesh(coinGeo, coinMat);
    this.mesh.add(coinMesh);

    if (hasStar) {
      const starGeo = new THREE.TetrahedronGeometry(radius * 0.45);
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.z = thickness * 0.6;
      this.mesh.add(star);
    }
  }

  buildStarGem(color) {
    const starGeo = new THREE.OctahedronGeometry(0.35);
    const starMat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.9,
      roughness: 0.1,
      wireframe: false
    });
    this.starMesh = new THREE.Mesh(starGeo, starMat);
    this.mesh.add(this.starMesh);

    // Inner glow
    const glowGeo = new THREE.OctahedronGeometry(0.2);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh.add(new THREE.Mesh(glowGeo, glowMat));
  }

  buildRainbowDiamond() {
    const diaGeo = new THREE.ConeGeometry(0.4, 0.7, 6);
    diaGeo.rotateX(Math.PI);
    const diaMat = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      roughness: 0.1,
      metalness: 0.9
    });
    this.mesh.add(new THREE.Mesh(diaGeo, diaMat));
  }

  update(dt, playerPos, isMagnetActive) {
    if (this.isCollected) return;
    this.animTime += dt * 4;

    // Spin coin
    this.mesh.rotation.y += dt * 3.5;

    if (isMagnetActive) {
      // Pull towards player
      const dist = this.position.distanceTo(playerPos);
      if (dist < 9.0) {
        const pullDir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
        const pullSpeed = 22.0 + (9.0 - dist) * 2.0;
        this.position.addScaledVector(pullDir, pullSpeed * dt);
        this.mesh.position.copy(this.position);
        this.updateHitbox();
        return;
      }
    }

    // Natural hover bobbing
    this.position.y = this.baseY + Math.sin(this.animTime * 1.5) * 0.1;
    this.mesh.position.y = this.position.y;
    this.updateHitbox();
  }

  updateHitbox() {
    this.hitbox.min.set(this.position.x - 0.4, this.position.y - 0.4, this.position.z - 0.4);
    this.hitbox.max.set(this.position.x + 0.4, this.position.y + 0.4, this.position.z + 0.4);
  }
}
