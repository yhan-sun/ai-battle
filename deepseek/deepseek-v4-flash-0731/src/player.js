import * as THREE from 'three';
import { CONFIG } from './config.js';

const LANE_Z = [-CONFIG.laneWidth, 0, CONFIG.laneWidth];

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.position = new THREE.Vector3(-CONFIG.runwayOffsetX, CONFIG.groundY + CONFIG.playerHeight / 2, 0);
    this.laneIndex = 1;
    this.targetLaneIndex = 1;
    this.velY = 0;
    this.grounded = true;
    this.jumpCount = 0;
    this.sliding = false;
    this.slideTimer = 0;
    this.diving = false;
    this.coyoteTimer = 0;
    this.graceTimer = 0;
    this.invincibleTimer = 0;
    this.sprinting = false;
    this.sprintTimer = 0;
    this.magnetTimer = 0;
    this.shieldTimer = 0;
    this.mounted = false;
    this.pet = null;
    this.petLevel = 0;
    this.animTime = 0;
    this.runPhase = 0;
    this.blinkTimer = 0;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    scene.add(this.group);
    this._buildCharacter();
    this._buildPet();
    this._buildMount();
  }

  _buildCharacter() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2ec4ff, roughness: 0.4, metalness: 0.2 });
    const suitMat = new THREE.MeshStandardMaterial({ color: 0x0b2b4a, roughness: 0.5 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd9b3, roughness: 0.6 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0xff8a3d, roughness: 0.5 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x102030, roughness: 0.1, metalness: 0.8 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.75, 4, 12), bodyMat);
    torso.position.y = 1.45;
    this.group.add(torso);
    this.torso = torso;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), skinMat);
    head.position.y = 2.28;
    this.group.add(head);
    this.head = head;

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), suitMat);
    hair.position.set(0, 2.4, 0);
    hair.scale.set(1, 0.9, 1);
    this.group.add(hair);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.5), visorMat);
    visor.position.set(0, 2.28, 0.34);
    this.group.add(visor);

    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.5, 1.7, 0);
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), bodyMat);
      seg.position.y = -0.3;
      arm.add(seg);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), skinMat);
      hand.position.y = -0.68;
      arm.add(hand);
      this.group.add(arm);
      this.arms.push(arm);
    }

    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.22, 1.0, 0);
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 8), suitMat);
      seg.position.y = -0.28;
      leg.add(seg);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.4), bootMat);
      boot.position.set(0, -0.6, 0.1);
      leg.add(boot);
      this.group.add(leg);
      this.legs.push(leg);
    }

    this._buildShield();
  }

  _buildShield() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x5fffd0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false
    });
    this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), mat);
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);
  }

  _buildPet() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: 0.35, emissive: 0xffa030, emissiveIntensity: 0.35 });
    const pet = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat);
    pet.add(body);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 6), wingMat);
      wing.rotation.z = side * 0.9;
      wing.rotation.x = -Math.PI / 2;
      wing.position.set(side * 0.32, 0.12, 0);
      pet.add(wing);
      this[`wing${side}`] = wing;
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0x102030 }));
    eye.position.set(0, 0.08, 0.26);
    pet.add(eye);
    pet.position.set(1.4, 2.6, 0);
    this.scene.add(pet);
    this.pet = pet;
    this.petBaseY = 2.6;
    this._petGlow = new THREE.PointLight(0xffc857, 0.6, 6);
    this._petGlow.position.copy(pet.position);
    this.scene.add(this._petGlow);
  }

  _buildMount() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2a44, roughness: 0.4, metalness: 0.5 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x37e6ff, transparent: true, opacity: 0.8 });
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.5, 6, 14), bodyMat);
    hull.rotation.z = Math.PI / 2;
    group.add(hull);
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.16, 8, 20), glowMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = side * 1.15;
      ring.position.y = -0.05;
      group.add(ring);
    }
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 6), glowMat);
    fin.rotation.x = Math.PI / 2;
    fin.position.y = 0.55;
    group.add(fin);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.5), bodyMat);
    seat.position.y = 0.4;
    group.add(seat);
    group.visible = false;
    group.position.y = 0.15;
    this.scene.add(group);
    this.mount = group;
    this._mountGlow = new THREE.PointLight(0x37e6ff, 1.2, 8);
    this._mountGlow.position.copy(group.position);
    this._mountGlow.visible = false;
    this.scene.add(this._mountGlow);
  }

  get laneZ() {
    return LANE_Z[this.targetLaneIndex];
  }

  get height() {
    return this.sliding ? CONFIG.playerHeight * CONFIG.slideHeightFactor : CONFIG.playerHeight;
  }

  mountOn() {
    this.mounted = true;
    this.mount.visible = true;
    this._mountGlow.visible = true;
    this.group.visible = false;
  }

  unmount() {
    this.mounted = false;
    this.mount.visible = false;
    this._mountGlow.visible = false;
    this.group.visible = true;
  }

  levelUpPet() {
    this.petLevel = Math.min(3, this.petLevel + 1);
    this.pet.scale.setScalar(1 + this.petLevel * 0.25);
    this._petGlow.color.setHex([0xffc857, 0x5fffd0, 0x37e6ff, 0xff6b9d][this.petLevel]);
    this._petGlow.intensity = 0.6 + this.petLevel * 0.5;
  }

  setLane(index) {
    this.targetLaneIndex = Math.max(0, Math.min(2, index));
  }

  startJump() {
    if (this.grounded || this.coyoteTimer > 0) {
      this.velY = CONFIG.jumpVelocity * (this.mounted ? 1.12 : 1);
      this.grounded = false;
      this.jumpCount = 1;
      this.coyoteTimer = 0;
      this.diving = false;
      this.sliding = false;
      this.slideTimer = 0;
      return 1;
    }
    if (this.jumpCount < 2) {
      this.velY = CONFIG.doubleJumpVelocity * (this.mounted ? 1.08 : 1);
      this.jumpCount = 2;
      this.diving = false;
      return 2;
    }
    return 0;
  }

  startSlide() {
    if (!this.grounded) {
      this.diving = true;
      this.velY = -CONFIG.diveVelocity;
      return;
    }
    this.sliding = true;
    this.slideTimer = CONFIG.slideDuration;
  }

  releaseSlide() {
    if (this.sliding && this.slideTimer < CONFIG.slideDuration * 0.35) {
      this.sliding = false;
    }
  }

  triggerSprint(duration = CONFIG.sprintDuration) {
    this.sprinting = true;
    this.sprintTimer = duration;
    this.invincibleTimer = Math.max(this.invincibleTimer, duration);
  }

  activateMagnet(duration = CONFIG.magnetDuration) {
    this.magnetTimer = Math.max(this.magnetTimer, duration);
  }

  activateShield(duration = CONFIG.shieldDuration) {
    this.shieldTimer = Math.max(this.shieldTimer, duration);
  }

  hit() {
    if (this.invincibleTimer > 0 || this.shieldTimer > 0 || this.graceTimer > 0) {
      return false;
    }
    if (this.shieldTimer > 0) {
      this.shieldTimer = 0;
      this.graceTimer = 1.2;
      return true;
    }
    this.graceTimer = 1.6;
    return true;
  }

  revive() {
    this.position.set(this.position.x, CONFIG.groundY + CONFIG.playerHeight / 2, this.laneZ);
    this.velY = 0;
    this.grounded = true;
    this.sliding = false;
    this.diving = false;
    this.graceTimer = 2.2;
    this.invincibleTimer = 2.2;
    this.sprinting = false;
    this.sprintTimer = 0;
  }

  update(dt, speed, input) {
    const wasGrounded = this.grounded;
    this.animTime += dt;

    this.grounded = this.position.y <= CONFIG.groundY + this.height / 2 && this.velY <= 0;
    if (this.grounded) {
      this.position.y = CONFIG.groundY + this.height / 2;
      this.velY = 0;
      this.jumpCount = 0;
      this.diving = false;
      if (!wasGrounded) this.coyoteTimer = 0.1;
    } else {
      this.velY -= CONFIG.gravity * dt;
      this.coyoteTimer -= dt;
    }
    if (this.grounded && this.coyoteTimer > 0) this.coyoteTimer -= dt;
    if (!this.grounded) this.position.y += this.velY * dt;

    if (this.graceTimer > 0) {
      this.graceTimer -= dt;
      this.group.visible = this.mounted ? false : Math.floor(this.animTime * 14) % 2 === 0;
      this.mount.visible = this.mounted && Math.floor(this.animTime * 14) % 2 === 0;
      this.pet.visible = Math.floor(this.animTime * 14) % 2 === 0;
    } else {
      this.group.visible = !this.mounted;
      this.mount.visible = this.mounted;
      this.pet.visible = true;
    }

    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
    if (this.magnetTimer > 0) this.magnetTimer -= dt;
    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    if (this.sprinting) {
      this.sprintTimer -= dt;
      if (this.sprintTimer <= 0) this.sprinting = false;
    }

    if (this.sliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.sliding = false;
    }

    const laneMove = (LANE_Z[this.targetLaneIndex] - this.position.z);
    this.position.z += laneMove * Math.min(1, dt * CONFIG.laneSwitchSpeed);
    if (Math.abs(laneMove) < 0.02) this.position.z = LANE_Z[this.targetLaneIndex];

    this.position.x += speed * dt;

    this._animate(dt, speed);
    this._animatePet(dt);
    if (this.mounted) this._animateMount(dt);
    this.shieldMesh.visible = this.shieldTimer > 0;
    if (this.shieldMesh.visible) this.shieldMesh.rotation.y += dt * 2;
  }

  _animate(dt, speed) {
    if (this.mounted) return;
    const grounded = this.grounded;
    const cycle = this.sliding ? 0 : (this.sprinting ? 16 : 8 + speed * 0.16);
    this.runPhase += dt * cycle;

    if (!grounded) {
      const armsUp = this.velY > 0 ? -1 : 1;
      this.arms[0].rotation.x = armsUp * 2.4;
      this.arms[1].rotation.x = armsUp * 2.4;
      this.legs[0].rotation.x = -0.8;
      this.legs[1].rotation.x = 0.6;
      this.torso.rotation.x = this.velY > 0 ? -0.2 : 0.3;
    } else if (this.sliding) {
      this.torso.rotation.x = Math.PI / 2 - 0.3;
      this.arms[0].rotation.x = Math.PI / 2;
      this.arms[1].rotation.x = Math.PI / 2;
      this.legs[0].rotation.x = 0;
      this.legs[1].rotation.x = 0;
      this.torso.position.y = 0.55;
    } else {
      this.torso.rotation.x = 0.12;
      this.torso.position.y = 1.45;
      this.arms[0].rotation.x = Math.sin(this.runPhase) * 0.9 + 0.4;
      this.arms[1].rotation.x = Math.sin(this.runPhase + Math.PI) * 0.9 + 0.4;
      this.legs[0].rotation.x = Math.sin(this.runPhase) * 1.1;
      this.legs[1].rotation.x = Math.sin(this.runPhase + Math.PI) * 1.1;
    }

    this.group.position.x = this.position.x;
    this.group.position.y = this.position.y;
    this.group.position.z = this.position.z;
    this.group.rotation.z = 0;
  }

  _animatePet(dt) {
    const bob = Math.sin(this.animTime * 6) * 0.15;
    this.pet.position.set(
      this.position.x + 1.5,
      this.position.y + this.petBaseY + bob,
      this.position.z + 0.7
    );
    this.pet.rotation.y += dt * 3;
    this._petGlow.position.copy(this.pet.position);
    if (this.wingLeft) {
      this.wingLeft.rotation.y = Math.sin(this.animTime * 14) * 0.5;
      this.wingRight.rotation.y = -Math.sin(this.animTime * 14) * 0.5;
    }
  }

  _animateMount(dt) {
    this.mount.position.set(this.position.x, 0.15, this.position.z);
    this.mount.rotation.z = Math.sin(this.animTime * 3.2) * 0.03;
    this._mountGlow.position.set(this.position.x, 1.2, this.position.z);
    const lean = (this.position.z - this.laneZ);
    this.mount.rotation.z += lean * 0.02;
    this.mount.children.forEach((c, i) => {
      if (c.isMesh && i < 2) c.material.rotation = this.animTime * 8;
    });
  }
}