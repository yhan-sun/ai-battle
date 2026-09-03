import * as THREE from 'three';
import { Player, PLAYER_STATE } from '../entities/Player.js';
import { MOUNT_TYPES } from '../entities/Mount.js';
import { PET_TYPES } from '../entities/Pet.js';
import { OBSTACLE_TYPES } from '../entities/Obstacle.js';
import { LevelGenerator } from '../world/LevelGenerator.js';
import { ParallaxBackground } from '../world/ParallaxBackground.js';
import { SuperRewardMode } from '../world/SuperRewardMode.js';
import { DimensionRiftMode } from '../world/DimensionRiftMode.js';
import { SoundManager } from '../audio/SoundManager.js';
import { ParticleManager } from '../vfx/ParticleManager.js';
import { ScoreManager } from './ScoreManager.js';

export const GAME_STATE = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  SUPER_REWARD: 'SUPER_REWARD',
  DIMENSION_RIFT: 'DIMENSION_RIFT',
  PAUSED: 'PAUSED',
  REVIVING: 'REVIVING',
  GAME_OVER: 'GAME_OVER'
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = GAME_STATE.MENU;

    // Clock
    this.clock = new THREE.Clock();
    this.elapsedTime = 0;
    this.hasRevivedThisRun = false;
    this.reviveTimer = 0;
    this.returnTrackX = 0;

    // Setup Three.js Core
    this.initThree();

    // Setup Subsystems
    this.sound = new SoundManager();
    this.particles = new ParticleManager(this.scene);
    this.scoreManager = new ScoreManager(() => this.triggerSuperReward());

    // World & Entities
    this.parallaxBg = new ParallaxBackground(this.scene);
    this.levelGen = new LevelGenerator(this.scene, this.sound, this.particles);
    this.player = new Player(this.scene, this.sound, this.particles);
    this.superReward = new SuperRewardMode(this.scene, this.sound, this.particles);
    this.dimensionRift = new DimensionRiftMode(this.scene, this.sound, this.particles);

    // Active Projectiles (e.g. Pet fireballs)
    this.projectiles = [];

    // Resize listener
    window.addEventListener('resize', () => this.onResize());

    // Start render loop
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x70c5ff); // Pleasant sunny sky
    this.scene.fog = new THREE.Fog(0x70c5ff, 40, 110);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      250
    );
    this.cameraTarget = new THREE.Vector3(3, 2, 0);
    this.camera.position.set(2.5, 3.5, 8.5);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 0.75);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.1);
    dirLight.position.set(15, 30, 20);
    this.scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambientLight);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // --- GAME LIFECYCLE ---

  startGame(mountType = MOUNT_TYPES.PANTHER, petType = PET_TYPES.DRAKE) {
    this.sound.resume();
    this.sound.startBgm();

    this.player.setMount(mountType);
    this.player.setPet(petType);

    this.resetRun();
    this.state = GAME_STATE.PLAYING;
  }

  resetRun() {
    this.levelGen.reset();
    this.scoreManager.reset();
    this.particles.clearAll();
    this.hasRevivedThisRun = false;

    // Reset player position & physics
    this.player.position.set(0, 0.5, 0);
    this.player.velocity.set(this.player.baseSpeed, 0, 0);
    this.player.currentSpeed = this.player.baseSpeed;
    this.player.state = PLAYER_STATE.RUNNING;
    this.player.isOnGround = true;
    this.player.shieldActive = false;
    this.player.magnetTimer = 0;
    this.player.sprintTimer = 0;
    this.player.giantTimer = 0;
    this.player.invincibleTimer = 1.0;
    this.player.shieldMesh.visible = false;
    this.player.magnetMesh.visible = false;

    // Clear pet projectiles
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.projectiles = [];

    // Background music reset
    this.sound.setBgmMode('normal');
  }

  pauseGame() {
    if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.SUPER_REWARD || this.state === GAME_STATE.DIMENSION_RIFT) {
      this.previousState = this.state;
      this.state = GAME_STATE.PAUSED;
    }
  }

  resumeGame() {
    if (this.state === GAME_STATE.PAUSED) {
      this.state = this.previousState || GAME_STATE.PLAYING;
    }
  }

  // --- REWARD MODE SWITCHING ---

  triggerSuperReward() {
    if (this.state !== GAME_STATE.PLAYING) return;
    this.scoreManager.consumeFeverEnergy();
    this.state = GAME_STATE.SUPER_REWARD;
    this.returnTrackX = this.player.position.x;

    this.superReward.enter(this.player, () => {
      this.particles.showFloatingScore('SUPER REWARD 3X!', '#ffd700', { x: 0.5, y: 0.35 });
    });
  }

  ensureSafeReturnLanding(targetX) {
    // Find safe ground platform or synthesize a guaranteed recovery bridge
    let safePlat = this.levelGen.platforms.find(p => !p.isFloating && p.minX <= targetX && p.maxX >= targetX + 10);
    if (!safePlat) {
      // Create a smooth 25m landing bridge at Y=0
      safePlat = this.levelGen.createPlatform(targetX - 2, targetX + 25, 0, false);
    }
    return targetX + 2;
  }

  endSuperReward() {
    this.state = GAME_STATE.PLAYING;
    const safeX = this.ensureSafeReturnLanding(this.returnTrackX);
    this.superReward.exit(this.player, safeX, () => {
      this.particles.showFloatingScore('BACK TO TRACK!', '#ffffff', { x: 0.5, y: 0.4 });
    });
  }

  triggerDimensionRift() {
    if (this.state !== GAME_STATE.PLAYING) return;
    this.state = GAME_STATE.DIMENSION_RIFT;
    this.returnTrackX = this.player.position.x;

    this.dimensionRift.enter(this.player, () => {
      this.particles.showFloatingScore('DIMENSION RIFT 2X!', '#00ffff', { x: 0.5, y: 0.35 });
    });
  }

  endDimensionRift() {
    this.state = GAME_STATE.PLAYING;
    const safeX = this.ensureSafeReturnLanding(this.returnTrackX);
    this.dimensionRift.exit(this.player, safeX, () => {
      this.particles.showFloatingScore('REALITY RESTORED!', '#00ffcc', { x: 0.5, y: 0.4 });
    });
  }

  // --- REVIVE & GAME OVER ---

  handlePlayerDeath() {
    if (this.hasRevivedThisRun) {
      // Direct game over
      this.triggerGameOver();
    } else {
      // Offer Revive
      this.state = GAME_STATE.REVIVING;
      this.reviveTimer = 5.0; // 5s countdown
    }
  }

  revivePlayer() {
    this.hasRevivedThisRun = true;
    this.state = GAME_STATE.PLAYING;
    this.player.revive();

    // Clear all obstacles nearby to prevent immediate damage
    this.levelGen.obstacles.forEach(o => {
      if (Math.abs(o.position.x - this.player.position.x) < 25) {
        o.isDead = true;
        this.particles.spawnObstacleExplosion(o.position);
      }
    });

    this.particles.showFloatingScore('REVIVED!', '#00ff88', { x: 0.5, y: 0.4 });
  }

  triggerGameOver() {
    this.state = GAME_STATE.GAME_OVER;
    this.scoreManager.saveData();
    this.sound.stopBgm();
  }

  // --- PROJECTILES & COMBAT ---

  spawnPetFireball(spawnPos) {
    const geo = new THREE.SphereGeometry(0.3, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      velocity: new THREE.Vector3(32, 0, 0),
      life: 2.5
    });

    this.sound.playPowerup();
  }

  // --- MAIN LOOP ---

  loop() {
    requestAnimationFrame(this.loop);

    const dt = Math.min(this.clock.getDelta(), 0.08); // cap delta time to avoid tunneling

    // Update Game logic based on state
    if (this.state === GAME_STATE.PLAYING) {
      this.updatePlaying(dt);
    } else if (this.state === GAME_STATE.SUPER_REWARD) {
      this.updateSuperReward(dt);
    } else if (this.state === GAME_STATE.DIMENSION_RIFT) {
      this.updateDimensionRift(dt);
    } else if (this.state === GAME_STATE.REVIVING) {
      this.updateReviving(dt);
    } else if (this.state === GAME_STATE.MENU) {
      this.updateMenu(dt);
    }

    // Common updates
    this.particles.update(dt, this.player.position.x);
    this.updateCamera(dt);

    this.renderer.render(this.scene, this.camera);
  }

  updatePlaying(dt) {
    // 1. Gradual speed ramp up (速度递增)
    this.player.baseSpeed = Math.min(
      this.player.maxSpeed,
      12.0 + (this.scoreManager.distance / 120) * 0.9
    );
    this.sound.setSpeedFactor(this.player.baseSpeed / 12.0);

    // 2. Update level generator
    this.levelGen.update(this.player.position.x);

    // 3. Update player with platforms
    this.player.update(dt, this.levelGen.platforms);

    // 4. Update parallax background
    this.parallaxBg.setVisible(true);
    this.parallaxBg.update(this.camera.position.x);

    // 5. Update score
    this.scoreManager.updateDistance(this.player.position.x);

    // 6. Update Pet
    this.player.pet.update(
      dt,
      this.player.position,
      this.player.currentSpeed,
      pos => this.spawnPetFireball(pos),
      type => {
        if (type === 'shield') this.player.applyShield();
        else this.player.applyMagnet(8);
      }
    );

    // 7. Update Projectiles
    this.updateProjectiles(dt);

    // 8. Coin Collections
    this.handleCoinCollisions(dt);

    // 9. Powerup Collections
    this.handlePowerupCollisions();

    // 10. Obstacle Collisions & Stomps
    this.handleObstacleCollisions(dt);

    // 11. Death check
    if (this.player.state === PLAYER_STATE.DEAD) {
      this.handlePlayerDeath();
    }
  }

  updateSuperReward(dt) {
    this.parallaxBg.setVisible(false);
    this.player.update(dt, this.superReward.platforms);
    this.superReward.update(dt, this.player, this.scoreManager);

    // Pet update in super reward
    this.player.pet.update(dt, this.player.position, this.player.currentSpeed);

    if (this.superReward.timer <= 0) {
      this.endSuperReward();
    }
  }

  updateDimensionRift(dt) {
    this.parallaxBg.setVisible(false);
    this.player.update(dt, this.dimensionRift.platforms);
    this.dimensionRift.update(dt, this.player, this.scoreManager);

    // Pet update in dimension rift
    this.player.pet.update(dt, this.player.position, this.player.currentSpeed);

    if (this.dimensionRift.timer <= 0) {
      this.endDimensionRift();
    }
  }

  updateReviving(dt) {
    this.reviveTimer -= dt;
    if (this.reviveTimer <= 0) {
      this.triggerGameOver();
    }
  }

  updateMenu(dt) {
    // Gentle idling in menu
    this.player.position.set(0, 0, 0);
    this.player.update(dt, [{ minX: -10, maxX: 10, topY: 0 }]);
  }

  // --- COLLISION LOGIC ---

  handleCoinCollisions(dt) {
    const isMagnet = this.player.magnetTimer > 0 || this.player.pet.hasPassiveMagnet();
    const coinMultiplier = this.player.mount.getCoinMultiplier() * (this.player.multiplierTimer > 0 ? 2 : 1);
    const feverBonus = this.player.pet.getFeverBonusMultiplier();

    for (let i = this.levelGen.coins.length - 1; i >= 0; i--) {
      const c = this.levelGen.coins[i];
      c.update(dt, this.player.position, isMagnet);

      if (!c.isCollected && this.player.hitbox.intersectsBox(c.hitbox)) {
        c.isCollected = true;
        this.levelGen.group.remove(c.mesh);

        this.scoreManager.addCoin(c.value, c.feverEnergy * feverBonus, coinMultiplier);
        this.sound.playCoin(c.value >= 500 ? 3 : (c.value >= 100 ? 2 : 1));
        this.particles.spawnCoinSparkles(c.position, 0xffd700, 6);
        this.levelGen.coins.splice(i, 1);
      }
    }
  }

  handlePowerupCollisions() {
    for (let i = this.levelGen.powerups.length - 1; i >= 0; i--) {
      const p = this.levelGen.powerups[i];
      p.update(0.016);

      if (!p.isCollected && this.player.hitbox.intersectsBox(p.hitbox)) {
        p.isCollected = true;
        this.levelGen.group.remove(p.mesh);

        switch (p.type) {
          case 'magnet':
            this.player.applyMagnet(10);
            this.particles.showFloatingScore('MAGNET!', '#3399ff');
            break;
          case 'shield':
            this.player.applyShield();
            this.particles.showFloatingScore('SHIELD!', '#00ffcc');
            break;
          case 'sprint':
            this.player.applySprint(5);
            this.particles.showFloatingScore('SPRINT DASH!', '#ffcc00');
            break;
          case 'giant':
            this.player.applyGiant(8);
            this.particles.showFloatingScore('GIANT POTION!', '#ff3366');
            break;
          case 'multiplier':
            this.player.applyMultiplier(10);
            this.particles.showFloatingScore('2X SCORE!', '#aa00ff');
            break;
        }

        this.particles.spawnCoinSparkles(p.position, 0xffffff, 15);
        this.levelGen.powerups.splice(i, 1);
      }
    }
  }

  handleObstacleCollisions(dt) {
    const isInvulnerable = this.player.sprintTimer > 0 || this.player.giantTimer > 0 || (this.player.isSliding && this.player.mount.hasSlideRam());

    for (let i = this.levelGen.obstacles.length - 1; i >= 0; i--) {
      const obs = this.levelGen.obstacles[i];
      obs.update(dt);

      if (obs.isDead) continue;

      if (this.player.hitbox.intersectsBox(obs.hitbox)) {
        // 1. Springboard trigger
        if (obs.type === OBSTACLE_TYPES.SPRINGBOARD) {
          this.player.springboardBounce();
          this.particles.showFloatingScore('SUPER SPRING!', '#ffaa00');
          continue;
        }

        // 2. Portal Gate trigger
        if (obs.type === OBSTACLE_TYPES.PORTAL_GATE) {
          obs.isDead = true;
          this.levelGen.group.remove(obs.mesh);
          this.triggerDimensionRift();
          return;
        }

        // 3. Invulnerable destruction (Sprint / Giant / Bike Slide Ram)
        if (isInvulnerable) {
          obs.isDead = true;
          this.levelGen.group.remove(obs.mesh);
          this.particles.spawnObstacleExplosion(obs.position);
          this.sound.playStomp();
          this.scoreManager.addSlideBonus(300);
          this.particles.showFloatingScore('RAM SMASH +300!', '#ffaa00');
          continue;
        }

        // 4. Stompable Monster check!
        if (obs.type === OBSTACLE_TYPES.BOUNCING_MONSTER) {
          // Check if falling down and player foot is near monster top
          const playerFootY = this.player.position.y;
          const monsterTopY = obs.hitbox.max.y;

          if (this.player.velocity.y < 0 && playerFootY >= monsterTopY - 0.45) {
            // SUCCESSFUL STOMP! (踩怪)
            obs.isDead = true;
            this.levelGen.group.remove(obs.mesh);
            this.player.stompBounce();

            const bonus = this.scoreManager.addStompBonus(this.player.mount.getScoreMultiplier());
            this.particles.showFloatingScore(`STOMP x${bonus.combo}! +${bonus.points}`, '#ff00ff');
            continue;
          }
        }

        // 5. Normal damage collision
        const died = this.player.takeDamage();
        if (died) {
          return;
        } else {
          // Shield broke, destroy the collided obstacle so player doesn't get hit twice
          obs.isDead = true;
          this.levelGen.group.remove(obs.mesh);
        }
      }
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.life -= dt;
      proj.mesh.position.addScaledVector(proj.velocity, dt);

      // Check obstacle hit
      const projBox = new THREE.Box3().setFromCenterAndSize(proj.mesh.position, new THREE.Vector3(0.8, 0.8, 0.8));

      for (const obs of this.levelGen.obstacles) {
        if (!obs.isDead && obs.type !== OBSTACLE_TYPES.PORTAL_GATE && projBox.intersectsBox(obs.hitbox)) {
          obs.isDead = true;
          this.levelGen.group.remove(obs.mesh);
          this.particles.spawnObstacleExplosion(obs.position);

          // Spawn reward star gem
          this.levelGen.createCoin(COIN_TYPES.STAR_GEM, obs.position.x, obs.position.y + 1.2);
          this.particles.showFloatingScore('PET BLAST!', '#ff4400');
          proj.life = 0;
          break;
        }
      }

      if (proj.life <= 0) {
        this.scene.remove(proj.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  // --- CAMERA UPDATE ---

  updateCamera(dt) {
    const targetX = this.player.position.x + 3.0;
    let targetY = this.player.position.y + 2.5;
    let targetZ = 8.5;

    if (this.state === GAME_STATE.SUPER_REWARD) {
      targetY = this.player.position.y + 3.0;
      targetZ = 9.5;
    } else if (this.state === GAME_STATE.DIMENSION_RIFT) {
      targetY = this.player.position.y + 2.2;
      targetZ = 7.5;
    } else {
      // Clamp normal camera Y so small hops don't jerk the camera
      targetY = Math.max(2.5, this.player.position.y + 2.0);
    }

    // Smooth lerp
    this.camera.position.x += (targetX - this.camera.position.x) * (dt * 7.5);
    this.camera.position.y += (targetY - this.camera.position.y) * (dt * 5.0);
    this.camera.position.z += (targetZ - this.camera.position.z) * (dt * 5.0);

    // Apply Screen Shake
    this.camera.position.add(this.particles.shakeOffset);

    // Camera look-at
    this.cameraTarget.set(
      this.camera.position.x + 0.8,
      this.camera.position.y - 0.6,
      0
    );
    this.camera.lookAt(this.cameraTarget);
  }
}
