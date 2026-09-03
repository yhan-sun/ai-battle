import * as THREE from 'three';

export const PlayerState = {
  RUNNING: 'RUNNING',
  JUMPING: 'JUMPING',
  DOUBLE_JUMPING: 'DOUBLE_JUMPING',
  SLIDING: 'SLIDING',
  STOMPING: 'STOMPING',
  HURT: 'HURT',
  DEAD: 'DEAD'
};

export class Player {
  constructor(scene, soundSynth, particleSystem) {
    this.scene = scene;
    this.sound = soundSynth;
    this.particles = particleSystem;

    // Position & Physics
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vy = 0;
    this.gravity = -38;
    this.jumpForce = 16.5;
    this.doubleJumpForce = 15.0;
    this.stompBounceForce = 14.5;
    this.groundY = 0;
    this.isGrounded = true;
    this.canDoubleJump = true;

    // State
    this.state = PlayerState.RUNNING;
    this.animTime = 0;
    this.flipAngle = 0;
    this.slideTimer = 0;
    this.slideDuration = 0.55;

    // Hitbox (AABB)
    this.box = new THREE.Box3();
    this.width = 0.7;
    this.height = 1.8;
    this.depth = 0.7;

    // Buffs & Mechanics
    this.hasShield = false;
    this.shieldTime = 0;
    this.magnetTime = 0;
    this.sprintTime = 0;
    this.invulnerableTime = 0;
    
    // Skill cooldown
    this.skillCooldown = 14.0;
    this.skillTimer = 0; // ready at 0

    // Mount & Pet Configuration
    this.hasMount = true;
    this.mountType = 'cyber_raptor'; // 'cyber_raptor' | 'none'
    this.hasPet = true;
    this.petType = 'cyber_drone';

    // Root Group
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Build Procedural 3D Models
    this.buildCharacterMesh();
    this.buildMountMesh();
    this.buildPetMesh();
    this.buildShieldMesh();

    this.reset(0, 0);
  }

  buildCharacterMesh() {
    this.charGroup = new THREE.Group();
    this.group.add(this.charGroup);

    // Materials
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x1E293B,
      roughness: 0.3,
      metalness: 0.7
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x3B82F6,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x1D4ED8,
      emissiveIntensity: 0.2
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00F0FF,
      emissive: 0x00F0FF,
      emissiveIntensity: 0.9,
      roughness: 0.1
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xFBBF24,
      roughness: 0.5
    });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.65, 0.35);
    this.torso = new THREE.Mesh(torsoGeo, armorMat);
    this.torso.position.y = 1.05;
    this.charGroup.add(this.torso);

    // Chest Core (glowing)
    const coreGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8);
    coreGeo.rotateX(Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF });
    const chestCore = new THREE.Mesh(coreGeo, coreMat);
    chestCore.position.set(0, 0.05, 0.18);
    this.torso.add(chestCore);

    // Head
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.55, 0);
    this.charGroup.add(this.headGroup);

    const headGeo = new THREE.BoxGeometry(0.4, 0.42, 0.42);
    const headMesh = new THREE.Mesh(headGeo, suitMat);
    this.headGroup.add(headMesh);

    // Visor
    const visorGeo = new THREE.BoxGeometry(0.42, 0.14, 0.2);
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, 0.04, 0.16);
    this.headGroup.add(visorMesh);

    // Energy Cape / Scarf
    const capeGeo = new THREE.PlaneGeometry(0.4, 0.8, 4, 4);
    capeGeo.rotateX(Math.PI / 8);
    this.capeMat = new THREE.MeshStandardMaterial({
      color: 0xEF4444,
      emissive: 0xDC2626,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide
    });
    this.cape = new THREE.Mesh(capeGeo, this.capeMat);
    this.cape.position.set(0, 1.3, -0.22);
    this.charGroup.add(this.cape);

    // Left & Right Arms
    const limbMat = suitMat;
    const armGeo = new THREE.BoxGeometry(0.16, 0.55, 0.18);
    armGeo.translate(0, -0.22, 0);

    this.leftArm = new THREE.Mesh(armGeo, limbMat);
    this.leftArm.position.set(-0.35, 1.3, 0);
    this.charGroup.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, limbMat);
    this.rightArm.position.set(0.35, 1.3, 0);
    this.charGroup.add(this.rightArm);

    // Left & Right Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.65, 0.2);
    legGeo.translate(0, -0.28, 0);

    this.leftLeg = new THREE.Mesh(legGeo, armorMat);
    this.leftLeg.position.set(-0.16, 0.65, 0);
    this.charGroup.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, armorMat);
    this.rightLeg.position.set(0.16, 0.65, 0);
    this.charGroup.add(this.rightLeg);
  }

  buildMountMesh() {
    this.mountGroup = new THREE.Group();
    this.group.add(this.mountGroup);

    const mountMat = new THREE.MeshStandardMaterial({
      color: 0x0EA5E9,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x0284C7,
      emissiveIntensity: 0.3
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0F172A,
      metalness: 0.9,
      roughness: 0.3
    });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8 });

    // Body
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.5, 0.7);
    this.mountBody = new THREE.Mesh(bodyGeo, mountMat);
    this.mountBody.position.set(0, 0.55, 0);
    this.mountGroup.add(this.mountBody);

    // Head / Cockpit
    const headGeo = new THREE.ConeGeometry(0.3, 0.7, 5);
    headGeo.rotateZ(-Math.PI / 2.5);
    const mountHead = new THREE.Mesh(headGeo, mountMat);
    mountHead.position.set(0.7, 0.65, 0);
    this.mountGroup.add(mountHead);

    // Mount Thruster Vents
    const ventGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.3, 8);
    ventGeo.rotateZ(Math.PI / 2);
    const vent = new THREE.Mesh(ventGeo, darkMat);
    vent.position.set(-0.65, 0.55, 0);
    this.mountGroup.add(vent);

    // Energy Wings (pop out during double jump or sprint)
    const wingGeo = new THREE.PlaneGeometry(0.8, 0.5);
    wingGeo.rotateY(Math.PI / 2);
    this.wingLeft = new THREE.Mesh(wingGeo, neonMat);
    this.wingLeft.position.set(-0.1, 0.8, 0.5);
    this.wingRight = new THREE.Mesh(wingGeo, neonMat);
    this.wingRight.position.set(-0.1, 0.8, -0.5);
    this.mountGroup.add(this.wingLeft);
    this.mountGroup.add(this.wingRight);
    this.wingLeft.visible = false;
    this.wingRight.visible = false;

    // Legs
    const mLegGeo = new THREE.BoxGeometry(0.14, 0.45, 0.14);
    mLegGeo.translate(0, -0.2, 0);
    this.mLegFL = new THREE.Mesh(mLegGeo, darkMat);
    this.mLegFL.position.set(0.4, 0.35, 0.3);
    this.mLegFR = new THREE.Mesh(mLegGeo, darkMat);
    this.mLegFR.position.set(0.4, 0.35, -0.3);
    this.mLegBL = new THREE.Mesh(mLegGeo, darkMat);
    this.mLegBL.position.set(-0.4, 0.35, 0.3);
    this.mLegBR = new THREE.Mesh(mLegGeo, darkMat);
    this.mLegBR.position.set(-0.4, 0.35, -0.3);

    this.mountGroup.add(this.mLegFL);
    this.mountGroup.add(this.mLegFR);
    this.mountGroup.add(this.mLegBL);
    this.mountGroup.add(this.mLegBR);
  }

  buildPetMesh() {
    this.petGroup = new THREE.Group();
    this.scene.add(this.petGroup); // Free-floating companion

    const droneMat = new THREE.MeshStandardMaterial({
      color: 0xA855F7,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x9333EA,
      emissiveIntensity: 0.4
    });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xE879F9, wireframe: true });

    // Sphere core
    const coreGeo = new THREE.SphereGeometry(0.22, 12, 12);
    const core = new THREE.Mesh(coreGeo, droneMat);
    this.petGroup.add(core);

    // Orbital ring
    const ringGeo = new THREE.TorusGeometry(0.38, 0.03, 8, 20);
    this.petRing = new THREE.Mesh(ringGeo, ringMat);
    this.petGroup.add(this.petRing);

    // Glowing Eye
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.18, 0.02, 0);
    this.petGroup.add(eye);
  }

  buildShieldMesh() {
    const shieldGeo = new THREE.SphereGeometry(1.4, 20, 20);
    this.shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00F0FF,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, this.shieldMat);
    this.shieldMesh.position.y = 0.9;
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);
  }

  reset(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vy = 0;
    this.groundY = y;
    this.isGrounded = true;
    this.canDoubleJump = true;
    this.state = PlayerState.RUNNING;
    this.animTime = 0;
    this.flipAngle = 0;
    this.slideTimer = 0;
    
    this.hasShield = false;
    this.shieldTime = 0;
    this.magnetTime = 0;
    this.sprintTime = 0;
    this.invulnerableTime = 0;
    this.skillTimer = 0;

    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.set(0, 0, 0);
    this.updateHitbox();
  }

  jump() {
    if (this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return false;

    if (this.isGrounded || this.state === PlayerState.SLIDING) {
      // First Jump
      this.vy = this.jumpForce;
      this.isGrounded = false;
      this.canDoubleJump = true;
      this.state = PlayerState.JUMPING;
      this.slideTimer = 0;
      this.sound.playJump();
      this.particles.spawnJumpShockwave(this.x, this.y, this.z, false);
      return true;
    } else if (this.canDoubleJump) {
      // Double Jump Flip
      this.vy = this.doubleJumpForce;
      this.canDoubleJump = false;
      this.state = PlayerState.DOUBLE_JUMPING;
      this.flipAngle = 0;
      this.sound.playDoubleJump();
      this.particles.spawnJumpShockwave(this.x, this.y + 0.5, this.z, true);
      return true;
    }
    return false;
  }

  slide() {
    if (this.state === PlayerState.DEAD || this.state === PlayerState.HURT) return;

    if (this.isGrounded) {
      this.state = PlayerState.SLIDING;
      this.slideTimer = this.slideDuration;
      this.sound.playSlide();
    } else {
      // Fast drop stomping down from air
      this.vy = -28;
      this.state = PlayerState.STOMPING;
    }
  }

  stompBounce() {
    this.vy = this.stompBounceForce;
    this.canDoubleJump = true;
    this.isGrounded = false;
    this.state = PlayerState.JUMPING;
    this.sound.playStomp();
    this.particles.spawnExplosion(this.x, this.y, this.z, { r: 1, g: 0.8, b: 0.2 });
  }

  takeDamage() {
    if (this.invulnerableTime > 0 || this.sprintTime > 0) return false;

    if (this.hasShield) {
      this.hasShield = false;
      this.invulnerableTime = 1.8;
      this.sound.playShieldBreak();
      this.particles.spawnExplosion(this.x, this.y + 1, this.z, { r: 0, g: 0.9, b: 1.0 });
      return 'shield_saved';
    }

    if (this.hasMount && this.mountType !== 'none') {
      // Mount absorbs 1 fatal hit
      this.hasMount = false;
      this.invulnerableTime = 2.0;
      this.sound.playShieldBreak();
      this.particles.spawnExplosion(this.x, this.y + 0.6, this.z, { r: 0.2, g: 0.6, b: 1.0 });
      return 'mount_saved';
    }

    // Lethal Hit
    this.state = PlayerState.DEAD;
    this.vy = 8;
    this.sound.playGameOver();
    this.particles.spawnExplosion(this.x, this.y + 1, this.z, { r: 1, g: 0.2, b: 0.2 });
    return 'dead';
  }

  activateShield(duration = 15) {
    this.hasShield = true;
    this.shieldTime = duration;
    this.sound.playPowerup();
  }

  activateMagnet(duration = 12) {
    this.magnetTime = duration;
    this.sound.playPowerup();
  }

  activateSprint(duration = 6) {
    this.sprintTime = duration;
    this.invulnerableTime = Math.max(this.invulnerableTime, duration);
    this.sound.playPowerup();
  }

  activateSkill() {
    if (this.skillTimer > 0 || this.state === PlayerState.DEAD) return false;
    this.skillTimer = this.skillCooldown;
    this.sound.playSuperRewardStart();
    this.particles.spawnExplosion(this.x + 3, this.y + 1, this.z, { r: 0.8, g: 0.3, b: 1.0 });
    return true; // Game controller handles clearing screen
  }

  revive(x, y) {
    this.x = x;
    this.y = y + 1.5;
    this.vy = 6;
    this.groundY = y;
    this.state = PlayerState.JUMPING;
    this.invulnerableTime = 3.5;
    this.hasShield = true;
    this.hasMount = true;
    this.sound.playSuperRewardStart();
  }

  updateHitbox() {
    if (this.state === PlayerState.SLIDING) {
      this.height = 0.75;
      this.box.min.set(this.x - 0.55, this.y, this.z - 0.4);
      this.box.max.set(this.x + 0.65, this.y + 0.75, this.z + 0.4);
    } else {
      this.height = 1.8;
      this.box.min.set(this.x - 0.4, this.y, this.z - 0.4);
      this.box.max.set(this.x + 0.4, this.y + 1.8, this.z + 0.4);
    }
  }

  update(dt, currentSpeed, targetGroundY) {
    this.animTime += dt * (currentSpeed * 0.45);

    // Buff Timers
    if (this.shieldTime > 0) {
      this.shieldTime -= dt;
      if (this.shieldTime <= 0) this.hasShield = false;
    }
    if (this.magnetTime > 0) this.magnetTime -= dt;
    if (this.sprintTime > 0) {
      this.sprintTime -= dt;
      this.particles.spawnSpeedStreaks(this.x, this.y, this.z, 2, false);
    }
    if (this.invulnerableTime > 0) this.invulnerableTime -= dt;
    if (this.skillTimer > 0) this.skillTimer = Math.max(0, this.skillTimer - dt);

    // Physics
    if (this.state !== PlayerState.DEAD) {
      this.vy += this.gravity * dt;
      this.y += this.vy * dt;

      // Ground landing test
      if (this.y <= targetGroundY) {
        this.y = targetGroundY;
        this.vy = 0;
        this.groundY = targetGroundY;
        if (!this.isGrounded) {
          this.isGrounded = true;
          this.canDoubleJump = true;
          if (this.state === PlayerState.JUMPING || this.state === PlayerState.DOUBLE_JUMPING || this.state === PlayerState.STOMPING) {
            this.state = PlayerState.RUNNING;
            this.particles.spawnRunDust(this.x, this.y, this.z);
          }
        }
      } else {
        this.isGrounded = false;
      }
    } else {
      // Dead fall
      this.vy += this.gravity * dt;
      this.y += this.vy * dt;
      this.charGroup.rotation.z += dt * 4;
    }

    // Slide timer
    if (this.state === PlayerState.SLIDING) {
      this.slideTimer -= dt;
      this.particles.spawnSlideSparks(this.x, this.y, this.z);
      if (this.slideTimer <= 0) {
        this.state = PlayerState.RUNNING;
      }
    }

    // Double Jump Flip
    if (this.state === PlayerState.DOUBLE_JUMPING) {
      this.flipAngle += dt * 14;
      this.charGroup.rotation.z = -this.flipAngle;
      if (this.flipAngle >= Math.PI * 2) {
        this.charGroup.rotation.z = 0;
      }
    } else if (this.state !== PlayerState.DEAD) {
      this.charGroup.rotation.z = 0;
    }

    // Running Dust
    if (this.isGrounded && this.state === PlayerState.RUNNING && Math.random() < 0.3) {
      this.particles.spawnRunDust(this.x, this.y, this.z);
    }

    // Mount Visibility & Wings
    this.mountGroup.visible = this.hasMount;
    if (this.hasMount) {
      this.charGroup.position.y = 0.35; // Player sits higher on mount
      this.wingLeft.visible = this.state === PlayerState.DOUBLE_JUMPING || this.sprintTime > 0;
      this.wingRight.visible = this.wingLeft.visible;
    } else {
      this.charGroup.position.y = 0;
    }

    // Animate Character & Mount Limbs
    this.animateLimbs(dt);

    // Update Pet Floating Position
    this.updatePet(dt);

    // Shield Mesh Update
    this.shieldMesh.visible = this.hasShield;
    if (this.hasShield) {
      this.shieldMesh.rotation.y += dt * 2.5;
      this.shieldMesh.rotation.x += dt * 1.2;
    }

    // Flickering when invulnerable
    if (this.invulnerableTime > 0) {
      this.group.visible = Math.floor(Date.now() / 80) % 2 === 0;
    } else {
      this.group.visible = true;
    }

    // Root Group position
    this.group.position.set(this.x, this.y, this.z);
    this.updateHitbox();
  }

  animateLimbs(dt) {
    const runCycle = Math.sin(this.animTime * 12);
    const armCycle = Math.cos(this.animTime * 12);

    if (this.state === PlayerState.RUNNING) {
      // Normal run
      this.charGroup.position.x = 0;
      this.charGroup.rotation.x = 0;
      this.leftLeg.rotation.x = runCycle * 0.7;
      this.rightLeg.rotation.x = -runCycle * 0.7;
      this.leftArm.rotation.x = -armCycle * 0.7;
      this.rightArm.rotation.x = armCycle * 0.7;

      if (this.hasMount) {
        this.mLegFL.rotation.x = runCycle * 0.6;
        this.mLegBR.rotation.x = runCycle * 0.6;
        this.mLegFR.rotation.x = -runCycle * 0.6;
        this.mLegBL.rotation.x = -runCycle * 0.6;
      }
    } else if (this.state === PlayerState.SLIDING) {
      // Slide Pose (lowered down, tilt back)
      this.charGroup.position.y = this.hasMount ? 0.1 : -0.2;
      this.charGroup.rotation.x = -Math.PI / 3;
      this.leftLeg.rotation.x = Math.PI / 4;
      this.rightLeg.rotation.x = Math.PI / 4;
      this.leftArm.rotation.x = -Math.PI / 3;
      this.rightArm.rotation.x = -Math.PI / 3;
    } else if (this.state === PlayerState.JUMPING || this.state === PlayerState.DOUBLE_JUMPING) {
      // Jump Pose
      this.leftLeg.rotation.x = -0.4;
      this.rightLeg.rotation.x = 0.5;
      this.leftArm.rotation.x = -1.2;
      this.rightArm.rotation.x = -1.0;
    }

    // Scarf Flutter
    this.cape.rotation.x = Math.PI / 6 + Math.sin(this.animTime * 16) * 0.2;
  }

  updatePet(dt) {
    if (!this.hasPet) {
      this.petGroup.visible = false;
      return;
    }
    this.petGroup.visible = true;

    // Smooth follow target: floating behind and slightly above player
    const targetX = this.x - 1.4;
    const targetY = this.y + 1.8 + Math.sin(Date.now() * 0.005) * 0.3;
    const targetZ = this.z + 0.6;

    this.petGroup.position.x += (targetX - this.petGroup.position.x) * dt * 6;
    this.petGroup.position.y += (targetY - this.petGroup.position.y) * dt * 6;
    this.petGroup.position.z += (targetZ - this.petGroup.position.z) * dt * 6;

    this.petRing.rotation.x += dt * 3.5;
    this.petRing.rotation.y += dt * 2.5;
  }
}
