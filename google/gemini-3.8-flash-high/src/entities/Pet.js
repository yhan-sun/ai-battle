import * as THREE from 'three';

export const PET_TYPES = {
  NONE: 'none',
  BUBBLE: 'bubble',    // Bubble Sprite: drops shield/magnet bubbles
  DRAKE: 'drake',      // Flame Drake: fires fireballs clearing obstacles
  UFO: 'ufo'           // UFO Drone: passive magnetic pull & +25% fever boost
};

export class Pet {
  constructor(type = PET_TYPES.DRAKE) {
    this.type = type;
    this.mesh = new THREE.Group();
    this.animTime = 0;
    this.actionTimer = 0;
    this.projectiles = []; // for active pet attacks like fireballs
    this.buildModel();
  }

  buildModel() {
    while (this.mesh.children.length > 0) {
      this.mesh.remove(this.mesh.children[0]);
    }

    if (this.type === PET_TYPES.NONE) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    if (this.type === PET_TYPES.BUBBLE) {
      this.buildBubbleSprite();
    } else if (this.type === PET_TYPES.DRAKE) {
      this.buildFlameDrake();
    } else if (this.type === PET_TYPES.UFO) {
      this.buildUfoDrone();
    }
  }

  setType(newType) {
    this.type = newType;
    this.buildModel();
    this.actionTimer = 0;
  }

  buildBubbleSprite() {
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0x33ccff,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.8
    });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Main orb
    const bodyGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const body = new THREE.Mesh(bodyGeo, bubbleMat);
    this.mesh.add(body);

    // Cute eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, whiteMat);
    eyeL.position.set(0.25, 0.08, 0.15);
    const eyeR = new THREE.Mesh(eyeGeo, whiteMat);
    eyeR.position.set(0.25, 0.08, -0.15);
    this.mesh.add(eyeL, eyeR);

    // Orbiting halo ring
    const ringGeo = new THREE.TorusGeometry(0.55, 0.04, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x66ffff, wireframe: true });
    this.halo = new THREE.Mesh(ringGeo, ringMat);
    this.halo.rotation.x = Math.PI / 3;
    this.mesh.add(this.halo);
  }

  buildFlameDrake() {
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff3322, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Body
    const bodyGeo = new THREE.SphereGeometry(0.32, 12, 12);
    const body = new THREE.Mesh(bodyGeo, redMat);
    this.mesh.add(body);

    // Snout
    const snoutGeo = new THREE.ConeGeometry(0.18, 0.28, 8);
    snoutGeo.rotateZ(-Math.PI / 2);
    const snout = new THREE.Mesh(snoutGeo, goldMat);
    snout.position.set(0.3, 0, 0);
    this.mesh.add(snout);

    // Horns
    const hornGeo = new THREE.ConeGeometry(0.06, 0.2, 4);
    hornGeo.rotateZ(-0.3);
    const hornL = new THREE.Mesh(hornGeo, goldMat);
    hornL.position.set(0, 0.25, 0.12);
    const hornR = new THREE.Mesh(hornGeo, goldMat);
    hornR.position.set(0, 0.25, -0.12);
    this.mesh.add(hornL, hornR);

    // Wings
    const wingGeo = new THREE.BoxGeometry(0.35, 0.03, 0.4);
    const wingL = new THREE.Mesh(wingGeo, goldMat);
    wingL.position.set(-0.05, 0.15, 0.3);
    const wingR = new THREE.Mesh(wingGeo, goldMat);
    wingR.position.set(-0.05, 0.15, -0.3);
    this.mesh.add(wingL, wingR);
    this.wings = [wingL, wingR];
  }

  buildUfoDrone() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.8, roughness: 0.2 });
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });

    // Saucer body
    const saucerGeo = new THREE.CylinderGeometry(0.48, 0.35, 0.12, 16);
    const saucer = new THREE.Mesh(saucerGeo, metalMat);
    this.mesh.add(saucer);

    // Glass dome
    const domeGeo = new THREE.SphereGeometry(0.24, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.06;
    this.mesh.add(dome);

    // Bottom tractor light beam
    const beamGeo = new THREE.ConeGeometry(0.35, 0.8, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = -0.45;
    this.mesh.add(beam);
    this.beam = beam;
  }

  update(dt, playerPos, playerSpeed, onSpawnProjectile, onSpawnBonus) {
    if (this.type === PET_TYPES.NONE) return;
    this.animTime += dt * 4;

    // Follow player smoothly above and behind
    const targetX = playerPos.x - 1.2;
    const targetY = playerPos.y + 2.2 + Math.sin(this.animTime * 2) * 0.25;
    const targetZ = playerPos.z + 0.4;

    this.mesh.position.x += (targetX - this.mesh.position.x) * (dt * 6);
    this.mesh.position.y += (targetY - this.mesh.position.y) * (dt * 6);
    this.mesh.position.z += (targetZ - this.mesh.position.z) * (dt * 6);

    // Animations per type
    if (this.type === PET_TYPES.BUBBLE && this.halo) {
      this.halo.rotation.z += dt * 3;
      this.actionTimer += dt;
      // Spawn bubble gift every 20s
      if (this.actionTimer >= 20) {
        this.actionTimer = 0;
        if (onSpawnBonus) {
          onSpawnBonus(Math.random() > 0.5 ? 'shield' : 'magnet');
        }
      }
    } else if (this.type === PET_TYPES.DRAKE) {
      if (this.wings) {
        this.wings[0].rotation.x = Math.sin(this.animTime * 4) * 0.5;
        this.wings[1].rotation.x = -Math.sin(this.animTime * 4) * 0.5;
      }
      this.actionTimer += dt;
      // Fire fireball every 8s
      if (this.actionTimer >= 8) {
        this.actionTimer = 0;
        if (onSpawnProjectile) {
          onSpawnProjectile(this.mesh.position.clone());
        }
      }
    } else if (this.type === PET_TYPES.UFO) {
      this.mesh.rotation.y += dt * 4;
      if (this.beam) {
        this.beam.scale.set(
          1.0 + Math.sin(this.animTime * 5) * 0.15,
          1.0,
          1.0 + Math.sin(this.animTime * 5) * 0.15
        );
      }
    }
  }

  getFeverBonusMultiplier() {
    return this.type === PET_TYPES.UFO ? 1.25 : 1.0;
  }

  hasPassiveMagnet() {
    return this.type === PET_TYPES.UFO;
  }
}
