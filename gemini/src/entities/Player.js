import * as THREE from 'three';
import { Mount, MOUNT_TYPES } from './Mount.js';
import { Pet, PET_TYPES } from './Pet.js';

export const PLAYER_STATE = {
  RUNNING: 'RUNNING',
  JUMPING: 'JUMPING',
  DOUBLE_JUMPING: 'DOUBLE_JUMPING',
  TRIPLE_JUMPING: 'TRIPLE_JUMPING',
  SLIDING: 'SLIDING',
  SPRINTING: 'SPRINTING',
  HURT: 'HURT',
  DEAD: 'DEAD'
};

export class Player {
  constructor(scene, soundManager, particleManager) {
    this.scene = scene;
    this.sound = soundManager;
    this.particles = particleManager;

    // Movement & Physics
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(12, 0, 0); // Base running speed
    this.baseSpeed = 12.0;
    this.currentSpeed = 12.0;
    this.maxSpeed = 24.0;
    this.gravity = -38.0;
    this.jumpForce = 14.5;
    this.isOnGround = true;
    this.jumpCount = 0;
    this.groundY = 0;

    // State
    this.state = PLAYER_STATE.RUNNING;
    this.isSliding = false;
    this.slideDuration = 0.55;
    this.slideTimer = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.animTime = 0;

    // Buffs & Active timers
    this.shieldActive = false;
    this.magnetTimer = 0;
    this.sprintTimer = 0;
    this.giantTimer = 0;
    this.invincibleTimer = 0;
    this.multiplierTimer = 0;

    // Active Skill
    this.skillCooldown = 18.0;
    this.skillTimer = 0; // ready when 0

    // Mount and Pet
    this.mount = new Mount(MOUNT_TYPES.PANTHER);
    this.pet = new Pet(PET_TYPES.DRAKE);

    // 3D Visual Mesh Hierarchy
    this.mesh = new THREE.Group();
    this.characterGroup = new THREE.Group();
    this.mesh.add(this.characterGroup);
    this.mesh.add(this.mount.mesh);
    this.scene.add(this.mesh);
    this.scene.add(this.pet.mesh);

    this.buildCharacterModel();
    this.initVfxMeshes();

    // Hitbox Bounding Box
    this.hitbox = new THREE.Box3();
    this.updateHitbox();
  }

  buildCharacterModel() {
    // Materials
    this.skinMat = new THREE.MeshStandardMaterial({ color: 0xffd1b3, roughness: 0.5 });
    this.jacketMat = new THREE.MeshStandardMaterial({ color: 0x0066ff, roughness: 0.3 });
    this.pantsMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.4 });
    this.hairMat = new THREE.MeshStandardMaterial({ color: 0xff3366, roughness: 0.4 });
    this.shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    this.scarfMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.48, 0.65, 0.35);
    this.torso = new THREE.Mesh(torsoGeo, this.jacketMat);
    this.torso.position.y = 0.95;
    this.characterGroup.add(this.torso);

    // Head
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.48, 0);
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const head = new THREE.Mesh(headGeo, this.skinMat);
    this.headGroup.add(head);

    // Anime hair
    const hairGeo = new THREE.BoxGeometry(0.44, 0.25, 0.44);
    const hair = new THREE.Mesh(hairGeo, this.hairMat);
    hair.position.y = 0.15;
    this.headGroup.add(hair);

    const hairTuftGeo = new THREE.ConeGeometry(0.12, 0.3, 4);
    hairTuftGeo.rotateZ(0.5);
    const hairTuft = new THREE.Mesh(hairTuftGeo, this.hairMat);
    hairTuft.position.set(-0.2, 0.25, 0);
    this.headGroup.add(hairTuft);

    // Glowing Eyes / Visor
    const visorGeo = new THREE.BoxGeometry(0.12, 0.09, 0.32);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0.18, 0.05, 0);
    this.headGroup.add(visor);

    this.characterGroup.add(this.headGroup);

    // Scarf / Cape
    this.scarfSegments = [];
    for (let i = 0; i < 3; i++) {
      const sGeo = new THREE.BoxGeometry(0.25, 0.1, 0.2);
      const sMesh = new THREE.Mesh(sGeo, this.scarfMat);
      sMesh.position.set(-0.25 - i * 0.2, 1.25 - i * 0.05, 0);
      this.characterGroup.add(sMesh);
      this.scarfSegments.push(sMesh);
    }

    // Limbs
    const armGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
    const legGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);

    // Left Arm
    this.armL = new THREE.Group();
    this.armL.position.set(0, 1.2, 0.28);
    const armMeshL = new THREE.Mesh(armGeo, this.jacketMat);
    armMeshL.position.y = -0.22;
    this.armL.add(armMeshL);
    this.characterGroup.add(this.armL);

    // Right Arm
    this.armR = new THREE.Group();
    this.armR.position.set(0, 1.2, -0.28);
    const armMeshR = new THREE.Mesh(armGeo, this.jacketMat);
    armMeshR.position.y = -0.22;
    this.armR.add(armMeshR);
    this.characterGroup.add(this.armR);

    // Left Leg
    this.legL = new THREE.Group();
    this.legL.position.set(0, 0.65, 0.13);
    const legMeshL = new THREE.Mesh(legGeo, this.pantsMat);
    legMeshL.position.y = -0.25;
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.24), this.shoeMat);
    shoeL.position.set(0.04, -0.5, 0);
    this.legL.add(legMeshL, shoeL);
    this.characterGroup.add(this.legL);

    // Right Leg
    this.legR = new THREE.Group();
    this.legR.position.set(0, 0.65, -0.13);
    const legMeshR = new THREE.Mesh(legGeo, this.pantsMat);
    legMeshR.position.y = -0.25;
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.24), this.shoeMat);
    shoeR.position.set(0.04, -0.5, 0);
    this.legR.add(legMeshR, shoeR);
    this.characterGroup.add(this.legR);
  }

  initVfxMeshes() {
    // Shield Energy Sphere
    const shieldGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.35,
      wireframe: true
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.0;
    this.shieldMesh.visible = false;
    this.mesh.add(this.shieldMesh);

    // Magnet Pulsing Ring
    const magnetGeo = new THREE.TorusGeometry(1.4, 0.05, 8, 24);
    const magnetMat = new THREE.MeshBasicMaterial({
      color: 0x3388ff,
      transparent: true,
      opacity: 0.5
    });
    this.magnetMesh = new THREE.Mesh(magnetGeo, magnetMat);
    this.magnetMesh.rotation.x = Math.PI / 2;
    this.magnetMesh.position.y = 0.8;
    this.magnetMesh.visible = false;
    this.mesh.add(this.magnetMesh);
  }

  setMount(type) {
    this.mount.setType(type);
    this.adjustRiderPosition();
  }

  setPet(type) {
    this.pet.setType(type);
  }

  adjustRiderPosition() {
    if (this.mount.type !== MOUNT_TYPES.NONE) {
      this.characterGroup.position.set(0, 0.55, 0);
      // Riding leg pose
      this.legL.rotation.z = 0.4;
      this.legL.rotation.x = 0.3;
      this.legR.rotation.z = 0.4;
      this.legR.rotation.x = -0.3;
    } else {
      this.characterGroup.position.set(0, 0, 0);
      this.legL.rotation.set(0, 0, 0);
      this.legR.rotation.set(0, 0, 0);
    }
  }

  // --- ACTIONS ---

  jump() {
    if (this.state === PLAYER_STATE.DEAD) return;

    const maxJumps = this.mount.getMaxJumps();

    if (this.isOnGround || this.coyoteTimer > 0) {
      // First jump
      this.velocity.y = this.jumpForce;
      this.isOnGround = false;
      this.jumpCount = 1;
      this.coyoteTimer = 0;
      this.state = PLAYER_STATE.JUMPING;
      this.sound.playJump();
      this.particles.spawnLandingImpact(this.position);
    } else if (this.jumpCount < maxJumps) {
      // Double or Triple Jump!
      this.jumpCount++;
      this.velocity.y = this.jumpForce * 0.95;
      if (this.jumpCount === 2) {
        this.state = PLAYER_STATE.DOUBLE_JUMPING;
        this.sound.playDoubleJump();
      } else {
        this.state = PLAYER_STATE.TRIPLE_JUMPING;
        this.sound.playDoubleJump();
      }
      this.particles.spawnCoinSparkles(this.position, 0x00ffff, 8);
      // Reset somersault rotation
      this.characterGroup.rotation.z = 0;
    } else {
      // Queue jump buffer
      this.jumpBufferTimer = 0.15;
    }
  }

  slide() {
    if (this.state === PLAYER_STATE.DEAD) return;

    if (!this.isOnGround) {
      // Fast dive down if in air!
      this.velocity.y = -22.0;
      this.sound.playSlide();
      return;
    }

    if (!this.isSliding) {
      this.isSliding = true;
      this.slideTimer = this.slideDuration;
      this.state = PLAYER_STATE.SLIDING;
      this.sound.playSlide();
      this.particles.spawnFootstepDust(this.position);
    }
  }

  triggerSkill() {
    if (this.skillTimer > 0 || this.state === PLAYER_STATE.DEAD) return false;
    this.skillTimer = this.skillCooldown;
    // Sonic Burst: 2.5s sprint, invulnerability, trail
    this.applySprint(2.5);
    this.sound.playFeverStart();
    this.particles.addShake(0.3);
    this.particles.spawnStompBurst(this.position);
    return true;
  }

  stompBounce() {
    this.velocity.y = this.jumpForce * 1.05;
    this.isOnGround = false;
    this.jumpCount = 1;
    this.state = PLAYER_STATE.JUMPING;
    this.sound.playStomp();
    this.particles.spawnStompBurst(this.position);
  }

  springboardBounce() {
    this.velocity.y = this.jumpForce * 1.6; // Launch way high into the sky!
    this.isOnGround = false;
    this.jumpCount = 1;
    this.state = PLAYER_STATE.JUMPING;
    this.sound.playSpringboard();
    this.particles.spawnLandingImpact(this.position);
    this.particles.spawnCoinSparkles(this.position, 0xff00ff, 12);
  }

  applyShield() {
    this.shieldActive = true;
    this.shieldMesh.visible = true;
    this.sound.playPowerup();
  }

  applyMagnet(duration = 10) {
    this.magnetTimer = Math.max(this.magnetTimer, duration);
    this.magnetMesh.visible = true;
    this.sound.playPowerup();
  }

  applySprint(duration = 5) {
    const boost = (this.mount.type === MOUNT_TYPES.BIKE) ? 1.5 : 1.0;
    this.sprintTimer = Math.max(this.sprintTimer, duration * boost);
    this.state = PLAYER_STATE.SPRINTING;
    this.sound.playPowerup();
  }

  applyGiant(duration = 8) {
    this.giantTimer = Math.max(this.giantTimer, duration);
    this.sound.playPowerup();
  }

  applyMultiplier(duration = 10) {
    this.multiplierTimer = Math.max(this.multiplierTimer, duration);
    this.sound.playPowerup();
  }

  takeDamage() {
    if (this.invincibleTimer > 0 || this.sprintTimer > 0 || this.giantTimer > 0) {
      return false; // Invulnerable
    }

    if (this.shieldActive) {
      // Shield absorbs hit
      this.shieldActive = false;
      this.shieldMesh.visible = false;
      this.invincibleTimer = 1.8;
      this.sound.playShieldBreak();
      this.particles.spawnObstacleExplosion(this.position);
      return false; // Did not die
    }

    // Death
    this.die();
    return true;
  }

  die() {
    this.state = PLAYER_STATE.DEAD;
    this.velocity.set(2, 8, 0);
    this.sound.playHit();
    this.particles.spawnObstacleExplosion(this.position);
  }

  revive() {
    this.state = PLAYER_STATE.RUNNING;
    this.velocity.set(this.baseSpeed, 0, 0);
    this.position.y += 4;
    this.isOnGround = false;
    this.jumpCount = 0;
    this.applyShield();
    this.invincibleTimer = 3.5;
    this.sound.playFeverStart();
    this.particles.spawnCoinSparkles(this.position, 0x00ffff, 20);
  }

  // --- UPDATE LOOP ---

  update(dt, platforms) {
    // Cooldown timers
    if (this.skillTimer > 0) this.skillTimer = Math.max(0, this.skillTimer - dt);
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - dt);
      if (this.magnetTimer <= 0) this.magnetMesh.visible = false;
    }
    if (this.sprintTimer > 0) {
      this.sprintTimer = Math.max(0, this.sprintTimer - dt);
    }
    if (this.giantTimer > 0) {
      this.giantTimer = Math.max(0, this.giantTimer - dt);
    }
    if (this.multiplierTimer > 0) {
      this.multiplierTimer = Math.max(0, this.multiplierTimer - dt);
    }
    if (this.invincibleTimer > 0) {
      this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
      // Flicker mesh
      this.mesh.visible = Math.floor(this.invincibleTimer * 14) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // Handle Speed
    let targetSpeed = this.baseSpeed;
    if (this.sprintTimer > 0) {
      targetSpeed = this.baseSpeed * 2.2;
    } else if (this.state === PLAYER_STATE.DEAD) {
      targetSpeed = 0;
    }
    this.currentSpeed += (targetSpeed - this.currentSpeed) * (dt * 8);
    this.velocity.x = this.currentSpeed;

    // Slide timer
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        if (this.isOnGround && this.state === PLAYER_STATE.SLIDING) {
          this.state = PLAYER_STATE.RUNNING;
        }
      }
    }

    // Jump Buffer & Coyote
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.isOnGround) {
        this.jump();
      }
    }
    if (this.isOnGround) {
      this.coyoteTimer = 0.1;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
    }

    // Gravity & Vertical Physics
    if (!this.isOnGround || this.state === PLAYER_STATE.DEAD) {
      this.velocity.y += this.gravity * dt;
    }

    // Move
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Platform collision check (Grounding)
    if (this.state !== PLAYER_STATE.DEAD) {
      this.checkPlatformCollision(platforms, dt);
    }

    // Mesh position sync
    this.mesh.position.copy(this.position);

    // Update Giant scale effect
    const targetScale = (this.giantTimer > 0) ? 1.8 : 1.0;
    this.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), dt * 6);

    // Update Hitbox
    this.updateHitbox();

    // Vfx rotation & animations
    if (this.shieldMesh.visible) {
      this.shieldMesh.rotation.y += dt * 3;
      this.shieldMesh.rotation.x += dt * 2;
    }
    if (this.magnetMesh.visible) {
      this.magnetMesh.rotation.z += dt * 5;
    }

    // Sprint Particles & Trails
    if (this.sprintTimer > 0) {
      this.particles.spawnTrailParticle(this.position, 0x00ffff);
      this.particles.spawnTrailParticle(this.position, 0xff00ff);
      this.particles.setSpeedLineOpacity(0.8);
    } else {
      this.particles.setSpeedLineOpacity(Math.max(0, (this.currentSpeed - 16) / 10));
    }

    // Update Mount & Pet
    const hasMount = this.mount.type !== MOUNT_TYPES.NONE;
    this.mount.update(dt, this.currentSpeed, this.isOnGround, this.isSliding);

    // Animations of character
    this.updateCharacterAnimations(dt, hasMount);
  }

  checkPlatformCollision(platforms, dt) {
    const footY = this.position.y;
    let foundGround = false;
    let groundHeight = -100;

    // Player X range with small tolerance
    const playerLeft = this.position.x - 0.3;
    const playerRight = this.position.x + 0.3;

    for (const p of platforms) {
      // Check if player X is within platform X bounds
      if (playerRight >= p.minX && playerLeft <= p.maxX) {
        // Check if platform is below player and within landing range
        if (p.topY <= footY + 0.3 && p.topY >= footY - 1.2) {
          if (p.topY > groundHeight) {
            groundHeight = p.topY;
            foundGround = true;
          }
        }
      }
    }

    if (foundGround && this.velocity.y <= 0) {
      if (!this.isOnGround) {
        // Just landed!
        this.particles.spawnLandingImpact(this.position);
      }
      this.position.y = groundHeight;
      this.velocity.y = 0;
      this.isOnGround = true;
      this.jumpCount = 0;
      if (this.state !== PLAYER_STATE.SLIDING && this.state !== PLAYER_STATE.DEAD) {
        this.state = PLAYER_STATE.RUNNING;
      }
    } else {
      this.isOnGround = false;
    }

    // Pit death check
    if (this.position.y < -8) {
      this.die();
    }
  }

  updateHitbox() {
    const scale = (this.giantTimer > 0) ? 1.8 : 1.0;
    if (this.isSliding) {
      // Lower and longer hitbox for sliding under overhead obstacles
      this.hitbox.min.set(this.position.x - 0.7 * scale, this.position.y, this.position.z - 0.4);
      this.hitbox.max.set(this.position.x + 0.7 * scale, this.position.y + 0.8 * scale, this.position.z + 0.4);
    } else {
      // Standing / Running hitbox
      this.hitbox.min.set(this.position.x - 0.45 * scale, this.position.y, this.position.z - 0.4);
      this.hitbox.max.set(this.position.x + 0.45 * scale, this.position.y + 1.85 * scale, this.position.z + 0.4);
    }
  }

  updateCharacterAnimations(dt, hasMount) {
    this.animTime += dt * (this.currentSpeed * 0.8 + 4);

    // Scarf fluttering
    for (let i = 0; i < this.scarfSegments.length; i++) {
      const seg = this.scarfSegments[i];
      seg.rotation.z = Math.sin(this.animTime * 2 + i * 0.8) * 0.25;
      seg.rotation.y = Math.cos(this.animTime * 1.5 + i) * 0.15;
    }

    if (this.state === PLAYER_STATE.DEAD) {
      this.characterGroup.rotation.z += dt * 8;
      return;
    }

    if (this.state === PLAYER_STATE.SLIDING) {
      // Slide pose
      this.characterGroup.position.set(-0.2, 0.25, 0);
      this.characterGroup.rotation.z = -0.85; // Leaning back flat
      this.armL.rotation.z = 1.0;
      this.armR.rotation.z = 1.0;
      if (Math.random() < 0.3) {
        this.particles.spawnFootstepDust(this.position);
      }
      return;
    }

    if (this.state === PLAYER_STATE.DOUBLE_JUMPING || this.state === PLAYER_STATE.TRIPLE_JUMPING) {
      // Somersault spin
      this.characterGroup.rotation.z -= dt * 15;
      return;
    }

    // Reset rotation if not flipping
    this.characterGroup.rotation.z = 0;

    if (hasMount) {
      // Mounted riding stance: slight rhythmic bounce
      this.characterGroup.position.y = 0.55 + Math.sin(this.animTime * 1.5) * 0.04;
      this.armL.rotation.z = 0.5 + Math.sin(this.animTime) * 0.1;
      this.armR.rotation.z = 0.5 - Math.sin(this.animTime) * 0.1;
      return;
    }

    // Normal On-Foot Animations
    if (this.isOnGround) {
      this.characterGroup.position.set(0, 0, 0);
      // Run cycle
      const swing = Math.sin(this.animTime);
      this.legL.rotation.z = swing * 0.9;
      this.legR.rotation.z = -swing * 0.9;
      this.armL.rotation.z = -swing * 0.8;
      this.armR.rotation.z = swing * 0.8;

      // Bobbing head and body
      this.torso.position.y = 0.95 + Math.abs(Math.sin(this.animTime * 2)) * 0.06;
      this.headGroup.position.y = 1.48 + Math.abs(Math.sin(this.animTime * 2)) * 0.06;

      // Dust puff occasionally on footsteps
      if (Math.abs(swing) > 0.85 && Math.random() < 0.25) {
        this.particles.spawnFootstepDust(this.position);
      }
    } else {
      // Airborne leap pose
      this.legL.rotation.z = 0.5;
      this.legR.rotation.z = -0.4;
      this.armL.rotation.z = -1.1;
      this.armR.rotation.z = -1.1;
    }
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.scene.remove(this.pet.mesh);
  }
}
