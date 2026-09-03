import * as THREE from 'three';

export const ItemType = {
  COIN: 'COIN',
  GEM_BLUE: 'GEM_BLUE',
  GEM_PINK: 'GEM_PINK',
  BUFF_MAGNET: 'BUFF_MAGNET',
  BUFF_SHIELD: 'BUFF_SHIELD',
  BUFF_SPRINT: 'BUFF_SPRINT',
  WARP_RING: 'WARP_RING'
};

export class CollectibleManager {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.items = [];

    // Shared Geometries & Materials
    this.coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14);
    this.coinGeo.rotateX(Math.PI / 2);
    this.coinMat = new THREE.MeshStandardMaterial({
      color: 0xFBBF24,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0xD97706,
      emissiveIntensity: 0.6
    });

    this.gemGeo = new THREE.OctahedronGeometry(0.32, 0);
    this.gemBlueMat = new THREE.MeshStandardMaterial({
      color: 0x38BDF8,
      metalness: 0.6,
      roughness: 0.1,
      emissive: 0x0284C7,
      emissiveIntensity: 0.8
    });
    this.gemPinkMat = new THREE.MeshStandardMaterial({
      color: 0xF43F5E,
      metalness: 0.6,
      roughness: 0.1,
      emissive: 0xE11D48,
      emissiveIntensity: 0.8
    });

    // Buff Icons
    this.magnetMat = new THREE.MeshStandardMaterial({
      color: 0xEF4444,
      emissive: 0xDC2626,
      emissiveIntensity: 0.7
    });
    this.shieldMat = new THREE.MeshStandardMaterial({
      color: 0x06B6D4,
      emissive: 0x0891B2,
      emissiveIntensity: 0.7
    });
    this.sprintMat = new THREE.MeshStandardMaterial({
      color: 0x10B981,
      emissive: 0x059669,
      emissiveIntensity: 0.7
    });

    // Warp Ring Geo
    this.warpRingGeo = new THREE.TorusGeometry(1.6, 0.12, 10, 24);
    this.warpRingMat = new THREE.MeshBasicMaterial({ color: 0x00F0FF });
  }

  spawn(type, x, y, z = 0) {
    let mesh;
    let radius = 0.5;

    if (type === ItemType.COIN) {
      mesh = new THREE.Mesh(this.coinGeo, this.coinMat);
      radius = 0.45;
    } 
    else if (type === ItemType.GEM_BLUE) {
      mesh = new THREE.Mesh(this.gemGeo, this.gemBlueMat);
      radius = 0.5;
    } 
    else if (type === ItemType.GEM_PINK) {
      mesh = new THREE.Mesh(this.gemGeo, this.gemPinkMat);
      mesh.scale.set(1.2, 1.2, 1.2);
      radius = 0.6;
    } 
    else if (type === ItemType.BUFF_MAGNET) {
      // Horseshoe Magnet
      const torusGeo = new THREE.TorusGeometry(0.35, 0.1, 8, 12, Math.PI);
      mesh = new THREE.Mesh(torusGeo, this.magnetMat);
      radius = 0.6;
    } 
    else if (type === ItemType.BUFF_SHIELD) {
      const sphereGeo = new THREE.IcosahedronGeometry(0.4, 1);
      mesh = new THREE.Mesh(sphereGeo, this.shieldMat);
      radius = 0.6;
    } 
    else if (type === ItemType.BUFF_SPRINT) {
      const coneGeo = new THREE.ConeGeometry(0.3, 0.7, 6);
      coneGeo.rotateZ(-Math.PI / 2);
      mesh = new THREE.Mesh(coneGeo, this.sprintMat);
      radius = 0.6;
    } 
    else if (type === ItemType.WARP_RING) {
      mesh = new THREE.Mesh(this.warpRingGeo, this.warpRingMat);
      mesh.rotation.y = Math.PI / 2;
      radius = 1.8;
    }

    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    const item = {
      mesh,
      type,
      x, y, z,
      radius,
      active: true,
      rotSpeed: 2.0 + Math.random() * 2.0,
      floatOffset: Math.random() * Math.PI * 2
    };

    this.items.push(item);
    return item;
  }

  update(dt, playerX, playerY, playerZ, magnetActive) {
    const magnetRadiusSq = 14 * 14;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (!item.active) {
        this.scene.remove(item.mesh);
        this.items.splice(i, 1);
        continue;
      }

      // Despawn if far behind
      if (item.mesh.position.x < playerX - 25) {
        this.scene.remove(item.mesh);
        this.items.splice(i, 1);
        continue;
      }

      // Idle Rotation & Hover Bobbing
      item.mesh.rotation.y += dt * item.rotSpeed;
      if (item.type !== ItemType.WARP_RING) {
        item.mesh.position.y = item.y + Math.sin(Date.now() * 0.005 + item.floatOffset) * 0.12;
      }

      // Magnet Attraction
      if (magnetActive && (item.type === ItemType.COIN || item.type === ItemType.GEM_BLUE || item.type === ItemType.GEM_PINK)) {
        const dx = playerX - item.mesh.position.x;
        const dy = (playerY + 1.0) - item.mesh.position.y;
        const dz = playerZ - item.mesh.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < magnetRadiusSq) {
          const speed = 24 * dt;
          item.mesh.position.x += dx * speed;
          item.mesh.position.y += dy * speed;
          item.mesh.position.z += dz * speed;
          item.x = item.mesh.position.x;
          item.y = item.mesh.position.y;
        }
      }
    }
  }

  clearAll() {
    for (const item of this.items) {
      this.scene.remove(item.mesh);
    }
    this.items = [];
  }

  collectItem(item) {
    item.active = false;
    this.scene.remove(item.mesh);

    let col = 'gold';
    if (item.type === ItemType.GEM_BLUE) col = 'blue';
    if (item.type === ItemType.GEM_PINK) col = 'pink';
    this.particles.spawnCoinSparkle(item.mesh.position.x, item.mesh.position.y, item.mesh.position.z, col);
  }
}
