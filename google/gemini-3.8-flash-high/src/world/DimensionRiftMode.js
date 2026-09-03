import * as THREE from 'three';
import { Coin, COIN_TYPES } from '../entities/Coin.js';

export class DimensionRiftMode {
  constructor(scene, soundManager, particleManager) {
    this.scene = scene;
    this.sound = soundManager;
    this.particles = particleManager;

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.group.visible = false;

    this.isActive = false;
    this.timer = 12.0;
    this.maxTime = 12.0;
    this.heightOffset = -80; // Placed far below in the cyber hyperspace void!

    this.coins = [];
    this.platforms = [];
    this.laserGates = [];
    this.warpStars = [];

    this.buildCyberTunnel();
  }

  buildCyberTunnel() {
    // Neon Cyber Roadway
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true
    });
    const roadCoreMat = new THREE.MeshStandardMaterial({
      color: 0x050518,
      roughness: 0.1,
      metalness: 0.9
    });

    // 10 Segments of high-tech neon highway
    for (let i = 0; i < 20; i++) {
      const segX = i * 25;
      const segGroup = new THREE.Group();

      // Main asphalt
      const roadGeo = new THREE.BoxGeometry(25, 0.8, 8);
      const road = new THREE.Mesh(roadGeo, roadCoreMat);
      road.position.set(segX + 12.5, this.heightOffset - 0.4, 0);

      // Neon grid glowing overlay
      const grid = new THREE.Mesh(roadGeo, gridMat);
      grid.position.set(segX + 12.5, this.heightOffset - 0.38, 0);

      segGroup.add(road, grid);

      // Neon Laser Arches
      const archGeo = new THREE.TorusGeometry(3.5, 0.12, 6, 24, Math.PI);
      const archMat = new THREE.MeshBasicMaterial({
        color: (i % 2 === 0) ? 0x00ffff : 0xff00ff
      });
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.set(segX + 12.5, this.heightOffset, 0);
      segGroup.add(arch);
      this.laserGates.push(arch);

      this.group.add(segGroup);

      this.platforms.push({
        minX: segX,
        maxX: segX + 25,
        topY: this.heightOffset
      });
    }

    // Warp Stars / Streaks
    const starGeo = new THREE.BoxGeometry(0.08, 0.08, 3.5);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, blending: THREE.AdditiveBlending });

    for (let s = 0; s < 40; s++) {
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(
        (Math.random() - 0.5) * 150,
        this.heightOffset + Math.random() * 12 - 2,
        (Math.random() - 0.5) * 20
      );
      this.group.add(star);
      this.warpStars.push(star);
    }
  }

  generateRiftCollectibles() {
    this.coins.forEach(c => this.group.remove(c.mesh));
    this.coins = [];

    // Dense cyber crystal streams in mid-air and on road
    for (let x = 20; x < 250; x += 3.5) {
      // High-value Star Gems and Rainbow Diamonds
      const coinType = (Math.random() < 0.4) ? COIN_TYPES.RAINBOW : COIN_TYPES.STAR_GEM;
      const waveY = Math.sin(x * 0.4) * 3.0 + 3.0; // Fun high floating waves
      const gem = new Coin(coinType, x, this.heightOffset + waveY);
      this.group.add(gem.mesh);
      this.coins.push(gem);

      // Ground gold stream
      const groundCoin = new Coin(COIN_TYPES.GOLD, x + 1.5, this.heightOffset + 1.0);
      this.group.add(groundCoin.mesh);
      this.coins.push(groundCoin);
    }
  }

  enter(player, onEnterCallback) {
    this.isActive = true;
    this.timer = this.maxTime;
    this.group.visible = true;

    // Transport player into Cyber Hyperspace
    player.position.set(0, this.heightOffset + 2, 0);
    player.velocity.set(player.baseSpeed * 1.6, 0, 0); // High speed in rift!
    player.gravity = -24.0; // Reduced floaty gravity!
    player.isOnGround = true;

    this.generateRiftCollectibles();

    this.sound.setBgmMode('rift');
    this.sound.playPortalEnter();
    this.particles.spawnCoinSparkles(player.position, 0x00ffff, 25);
    this.particles.addShake(0.5);

    if (onEnterCallback) onEnterCallback();
  }

  exit(player, returnTrackX, onExitCallback) {
    this.isActive = false;
    this.group.visible = false;

    // Restore standard physics
    player.gravity = -38.0;
    player.position.set(returnTrackX + 6, 6, 0);
    player.velocity.set(player.baseSpeed, 0, 0);
    player.isOnGround = false;
    player.invincibleTimer = 3.0; // Safe grace period on return

    this.sound.setBgmMode('normal');
    this.sound.playPortalEnter();
    this.particles.spawnLandingImpact(player.position);

    if (onExitCallback) onExitCallback();
  }

  update(dt, player, scoreManager) {
    if (!this.isActive) return;

    this.timer -= dt;

    // Pulse laser arches
    this.laserGates.forEach((arch, idx) => {
      arch.rotation.y = Math.sin(this.timer * 4 + idx) * 0.2;
    });

    // Animate warp stars flying backwards fast
    this.warpStars.forEach(s => {
      s.position.x -= dt * 60;
      if (s.position.x < player.position.x - 30) {
        s.position.x = player.position.x + 50 + Math.random() * 20;
      }
    });

    // Collectibles collection
    const isMagnet = player.magnetTimer > 0 || player.pet.hasPassiveMagnet();

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.update(dt, player.position, isMagnet);

      if (!c.isCollected && player.hitbox.intersectsBox(c.hitbox)) {
        c.isCollected = true;
        this.group.remove(c.mesh);

        // 2x Bonus multiplier in Dimension Rift!
        scoreManager.addCoin(c.value * 2, c.feverEnergy * 1.5);
        this.sound.playCoin(3);
        this.particles.spawnCoinSparkles(c.position, 0x00ffff, 8);
        this.coins.splice(i, 1);
      }
    }
  }
}
