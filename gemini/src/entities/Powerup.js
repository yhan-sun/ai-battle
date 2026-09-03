import * as THREE from 'three';

export const POWERUP_TYPES = {
  MAGNET: 'magnet',
  SHIELD: 'shield',
  SPRINT: 'sprint',
  GIANT: 'giant',
  MULTIPLIER: 'multiplier'
};

export class Powerup {
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
    // Outer floating glowing crystal sphere
    const colors = {
      [POWERUP_TYPES.MAGNET]: 0x3399ff,
      [POWERUP_TYPES.SHIELD]: 0x00ffcc,
      [POWERUP_TYPES.SPRINT]: 0xffcc00,
      [POWERUP_TYPES.GIANT]: 0xff3366,
      [POWERUP_TYPES.MULTIPLIER]: 0xaa00ff
    };
    const col = colors[this.type] || 0xffffff;

    // Glowing outer bubble
    const bubbleGeo = new THREE.SphereGeometry(0.55, 16, 16);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.65
    });
    this.bubbleMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
    this.mesh.add(this.bubbleMesh);

    // Inner icon / geometry
    const coreGeo = new THREE.OctahedronGeometry(0.3);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.mesh.add(this.coreMesh);

    // Orbiting ring
    const ringGeo = new THREE.TorusGeometry(0.7, 0.04, 6, 20);
    const ringMat = new THREE.MeshBasicMaterial({ color: col });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.rotation.x = Math.PI / 3;
    this.mesh.add(this.ringMesh);
  }

  update(dt) {
    if (this.isCollected) return;
    this.animTime += dt * 3;

    this.mesh.rotation.y += dt * 2.5;
    if (this.ringMesh) this.ringMesh.rotation.z += dt * 4;
    if (this.coreMesh) this.coreMesh.rotation.x += dt * 3;

    // Floating bobbing
    this.position.y = this.baseY + Math.sin(this.animTime) * 0.15;
    this.mesh.position.y = this.position.y;
    this.updateHitbox();
  }

  updateHitbox() {
    this.hitbox.min.set(this.position.x - 0.6, this.position.y - 0.6, this.position.z - 0.5);
    this.hitbox.max.set(this.position.x + 0.6, this.position.y + 0.6, this.position.z + 0.5);
  }
}
