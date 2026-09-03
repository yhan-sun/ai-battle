import * as THREE from 'three';

export const OBSTACLE_TYPES = {
  GROUND_SPIKE: 'ground_spike',
  HANGING_SAW: 'hanging_saw',       // Requires slide to dodge!
  BOUNCING_MONSTER: 'bouncing_monster', // Stompable from above!
  SPRINGBOARD: 'springboard',       // Launches player into high coin arc
  PORTAL_GATE: 'portal_gate'        // Enters Dimension Rift Mode
};

export class Obstacle {
  constructor(type, x, y, options = {}) {
    this.type = type;
    this.position = new THREE.Vector3(x, y, 0);
    this.options = options;
    this.mesh = new THREE.Group();
    this.isDead = false;
    this.animTime = Math.random() * 10;
    this.hitbox = new THREE.Box3();

    this.buildModel();
    this.mesh.position.copy(this.position);
    this.updateHitbox();
  }

  buildModel() {
    switch (this.type) {
      case OBSTACLE_TYPES.GROUND_SPIKE:
        this.buildGroundSpikes();
        break;
      case OBSTACLE_TYPES.HANGING_SAW:
        this.buildHangingSaw();
        break;
      case OBSTACLE_TYPES.BOUNCING_MONSTER:
        this.buildMonster();
        break;
      case OBSTACLE_TYPES.SPRINGBOARD:
        this.buildSpringboard();
        break;
      case OBSTACLE_TYPES.PORTAL_GATE:
        this.buildPortalGate();
        break;
    }
  }

  buildGroundSpikes() {
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0x556677,
      metalness: 0.8,
      roughness: 0.3
    });
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });

    const count = this.options.count || 3;
    const spacing = 0.55;
    const startX = -((count - 1) * spacing) / 2;

    for (let i = 0; i < count; i++) {
      const coneGeo = new THREE.ConeGeometry(0.24, 0.8, 5);
      const spike = new THREE.Mesh(coneGeo, spikeMat);
      spike.position.set(startX + i * spacing, 0.4, 0);

      const tipGeo = new THREE.ConeGeometry(0.1, 0.25, 5);
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(startX + i * spacing, 0.7, 0);

      this.mesh.add(spike, tip);
    }
    this.hitWidth = count * spacing;
    this.hitHeight = 0.8;
  }

  buildHangingSaw() {
    // Overhead saw that leaves a 0.85 clearance below
    // Player MUST slide!
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.7 });
    const sawMat = new THREE.MeshStandardMaterial({ color: 0xff4422, metalness: 0.9, roughness: 0.2 });

    // Hanging support bar
    const barGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6);
    const bar = new THREE.Mesh(barGeo, frameMat);
    bar.position.set(0, 2.2, 0);
    this.mesh.add(bar);

    // Sawblade
    const sawGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.12, 12);
    sawGeo.rotateZ(Math.PI / 2);
    this.sawMesh = new THREE.Mesh(sawGeo, sawMat);
    this.sawMesh.position.set(0, 1.45, 0); // Bottom is at 1.45 - 0.65 = 0.8
    this.mesh.add(this.sawMesh);

    // Warning light
    const lightGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(0, 2.2, 0.15);
    this.mesh.add(light);
    this.warningLight = light;
  }

  buildMonster() {
    // Cute bouncy spiky slime (stompable!)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9933ff, roughness: 0.3 });
    const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });

    this.monsterBody = new THREE.Group();

    // Round body
    const bodyGeo = new THREE.SphereGeometry(0.48, 12, 12);
    bodyGeo.scale(1.1, 0.9, 1.0);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.45;
    this.monsterBody.add(body);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeWhite);
    eyeL.position.set(0.32, 0.55, 0.2);
    const eyeR = new THREE.Mesh(eyeGeo, eyeWhite);
    eyeR.position.set(0.32, 0.55, -0.2);

    const pupilGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.position.set(0.4, 0.55, 0.2);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    pupilR.position.set(0.4, 0.55, -0.2);

    this.monsterBody.add(eyeL, eyeR, pupilL, pupilR);

    // Cute little horns
    const hornGeo = new THREE.ConeGeometry(0.08, 0.25, 4);
    const hornL = new THREE.Mesh(hornGeo, hornMat);
    hornL.position.set(0, 0.88, 0.22);
    hornL.rotation.z = -0.2;
    const hornR = new THREE.Mesh(hornGeo, hornMat);
    hornR.position.set(0, 0.88, -0.22);
    hornR.rotation.z = -0.2;
    this.monsterBody.add(hornL, hornR);

    this.mesh.add(this.monsterBody);
  }

  buildSpringboard() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x555566, metalness: 0.8 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0xff8800, roughness: 0.3 });
    const springMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    // Base plate
    const baseGeo = new THREE.BoxGeometry(0.9, 0.1, 0.6);
    const base = new THREE.Mesh(baseGeo, metalMat);
    base.position.y = 0.05;
    this.mesh.add(base);

    // Spring coils
    const springGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
    this.springMesh = new THREE.Mesh(springGeo, springMat);
    this.springMesh.position.y = 0.22;
    this.mesh.add(this.springMesh);

    // Top pad
    const padGeo = new THREE.BoxGeometry(0.95, 0.08, 0.65);
    this.padMesh = new THREE.Mesh(padGeo, padMat);
    this.padMesh.position.y = 0.4;
    this.mesh.add(this.padMesh);
  }

  buildPortalGate() {
    // Swirling Dimension Rift Portal
    const ringGeo = new THREE.TorusGeometry(1.2, 0.15, 12, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true
    });
    this.portalRing1 = new THREE.Mesh(ringGeo, ringMat);
    this.portalRing1.position.y = 1.4;
    this.mesh.add(this.portalRing1);

    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      wireframe: true
    });
    this.portalRing2 = new THREE.Mesh(ringGeo, ring2Mat);
    this.portalRing2.position.y = 1.4;
    this.mesh.add(this.portalRing2);

    // Inner glowing vortex disk
    const discGeo = new THREE.CircleGeometry(1.1, 24);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x9900ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    this.vortexDisc = new THREE.Mesh(discGeo, discMat);
    this.vortexDisc.rotation.y = Math.PI / 2;
    this.vortexDisc.position.y = 1.4;
    this.mesh.add(this.vortexDisc);
  }

  update(dt) {
    this.animTime += dt * 4;

    if (this.type === OBSTACLE_TYPES.HANGING_SAW && this.sawMesh) {
      this.sawMesh.rotation.x += dt * 12;
      if (this.warningLight) {
        this.warningLight.scale.setScalar(1 + Math.sin(this.animTime * 3) * 0.3);
      }
    } else if (this.type === OBSTACLE_TYPES.BOUNCING_MONSTER && this.monsterBody) {
      // Patrolling bobbing
      const hop = Math.abs(Math.sin(this.animTime * 1.5)) * 0.35;
      this.monsterBody.position.y = hop;
      const squash = 1.0 - (hop * 0.25);
      this.monsterBody.scale.set(1.1 / squash, squash, 1.0);
    } else if (this.type === OBSTACLE_TYPES.PORTAL_GATE) {
      if (this.portalRing1) this.portalRing1.rotation.z += dt * 4;
      if (this.portalRing2) this.portalRing2.rotation.z -= dt * 3;
      if (this.vortexDisc) {
        const pulse = 1.0 + Math.sin(this.animTime * 2) * 0.1;
        this.vortexDisc.scale.set(pulse, pulse, pulse);
      }
    }

    this.updateHitbox();
  }

  updateHitbox() {
    const p = this.position;
    switch (this.type) {
      case OBSTACLE_TYPES.GROUND_SPIKE:
        const hw = (this.hitWidth || 1.6) * 0.45;
        this.hitbox.min.set(p.x - hw, p.y, p.z - 0.4);
        this.hitbox.max.set(p.x + hw, p.y + 0.8, p.z + 0.4);
        break;
      case OBSTACLE_TYPES.HANGING_SAW:
        // Hitbox is the upper section (above 0.85m), allowing sliding under!
        this.hitbox.min.set(p.x - 0.6, p.y + 0.85, p.z - 0.4);
        this.hitbox.max.set(p.x + 0.6, p.y + 2.5, p.z + 0.4);
        break;
      case OBSTACLE_TYPES.BOUNCING_MONSTER:
        const hopY = this.monsterBody ? this.monsterBody.position.y : 0;
        this.hitbox.min.set(p.x - 0.5, p.y + hopY, p.z - 0.4);
        this.hitbox.max.set(p.x + 0.5, p.y + hopY + 0.95, p.z + 0.4);
        break;
      case OBSTACLE_TYPES.SPRINGBOARD:
        this.hitbox.min.set(p.x - 0.5, p.y, p.z - 0.4);
        this.hitbox.max.set(p.x + 0.5, p.y + 0.5, p.z + 0.4);
        break;
      case OBSTACLE_TYPES.PORTAL_GATE:
        this.hitbox.min.set(p.x - 0.6, p.y + 0.2, p.z - 0.8);
        this.hitbox.max.set(p.x + 0.6, p.y + 2.6, p.z + 0.8);
        break;
    }
  }
}
