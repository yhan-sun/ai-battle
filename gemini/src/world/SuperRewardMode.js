import * as THREE from 'three';
import { Coin, COIN_TYPES } from '../entities/Coin.js';

export class SuperRewardMode {
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
    this.heightOffset = 80; // High in the sky!

    this.coins = [];
    this.platforms = [];
    this.decorations = [];

    this.buildSkyParadise();
  }

  buildSkyParadise() {
    // Golden Cloud road material
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffeedd,
      roughness: 0.3,
      metalness: 0.1,
      emissive: 0xffaa44,
      emissiveIntensity: 0.2
    });

    const rainbowColors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x8b00ff];

    // Background Rainbow Arches
    for (let r = 0; r < rainbowColors.length; r++) {
      const archGeo = new THREE.TorusGeometry(35 + r * 1.2, 0.4, 8, 36, Math.PI);
      const archMat = new THREE.MeshBasicMaterial({ color: rainbowColors[r] });
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.set(50, this.heightOffset - 5, -25);
      this.group.add(arch);
      this.decorations.push(arch);
    }

    // Giant Sparkling Stars in Sky
    for (let s = 0; s < 30; s++) {
      const starGeo = new THREE.OctahedronGeometry(1.2 + Math.random() * 0.8);
      const starMat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xffffff : 0xffdd44,
        wireframe: true
      });
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(
        (Math.random() - 0.5) * 180,
        this.heightOffset + 10 + Math.random() * 25,
        -15 - Math.random() * 20
      );
      this.group.add(star);
      this.decorations.push(star);
    }

    // Cloud Road Segments (continuous, 100% safe)
    for (let i = 0; i < 20; i++) {
      const segGroup = new THREE.Group();
      const segX = i * 25;

      // Cloud floor
      const roadGeo = new THREE.CylinderGeometry(2.5, 2.5, 26, 12);
      roadGeo.rotateZ(Math.PI / 2);
      const road = new THREE.Mesh(roadGeo, cloudMat);
      road.position.set(segX + 12.5, this.heightOffset - 1.2, 0);
      segGroup.add(road);

      // Fluffy cloud puffs along the edge
      for (let p = 0; p < 8; p++) {
        const puffGeo = new THREE.SphereGeometry(1.5 + Math.random() * 0.8, 8, 8);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(segX + p * 3.2, this.heightOffset - 1.2, (p % 2 === 0 ? 1 : -1) * 2.2);
        segGroup.add(puff);
      }

      this.group.add(segGroup);

      this.platforms.push({
        minX: segX,
        maxX: segX + 25,
        topY: this.heightOffset
      });
    }

    // Generate Super Coin Formations
    this.generateCoinFormations();
  }

  generateCoinFormations() {
    // Clear old coins
    this.coins.forEach(c => this.group.remove(c.mesh));
    this.coins = [];

    // Pattern 1: Heart shaped coin formation
    const heartX = 30;
    const heartPoints = [
      [0, 3], [-1, 4], [1, 4], [-2, 3], [2, 3], [-3, 2], [3, 2],
      [-2, 1], [2, 1], [-1, 0], [1, 0], [0, -1]
    ];
    heartPoints.forEach(([dx, dy]) => {
      const coin = new Coin(COIN_TYPES.GOLD, heartX + dx * 0.9, this.heightOffset + dy * 0.8 + 2);
      this.group.add(coin.mesh);
      this.coins.push(coin);
    });

    // Pattern 2: "COOL" or Wave Formation
    for (let x = 60; x < 250; x += 1.8) {
      const waveY = Math.sin(x * 0.25) * 2.2 + 2.5;
      const coinType = (Math.floor(x) % 5 === 0) ? COIN_TYPES.STAR_GEM : COIN_TYPES.GOLD;
      const coin = new Coin(coinType, x, this.heightOffset + waveY);
      this.group.add(coin.mesh);
      this.coins.push(coin);

      // Double lane of coins
      if (Math.random() < 0.6) {
        const coin2 = new Coin(COIN_TYPES.SILVER, x, this.heightOffset + waveY + 1.2);
        this.group.add(coin2.mesh);
        this.coins.push(coin2);
      }
    }

    // High altitude Rainbow Diamonds
    for (let x = 100; x < 240; x += 30) {
      const dia = new Coin(COIN_TYPES.RAINBOW, x, this.heightOffset + 5.5);
      this.group.add(dia.mesh);
      this.coins.push(dia);
    }
  }

  enter(player, onEnterCallback) {
    this.isActive = true;
    this.timer = this.maxTime;
    this.group.visible = true;

    // Reposition player to the sky paradise
    player.position.set(0, this.heightOffset + 2, 0);
    player.velocity.y = 0;
    player.isOnGround = true;

    // Reset coins
    this.generateCoinFormations();

    this.sound.setBgmMode('super');
    this.sound.playFeverStart();
    this.particles.spawnCoinSparkles(player.position, 0xffd700, 30);
    this.particles.addShake(0.4);

    if (onEnterCallback) onEnterCallback();
  }

  exit(player, returnTrackX, onExitCallback) {
    this.isActive = false;
    this.group.visible = false;

    // Drop player safely back to main track
    player.position.set(returnTrackX + 5, 6, 0);
    player.velocity.set(player.baseSpeed, 0, 0);
    player.isOnGround = false;
    player.invincibleTimer = 3.0; // Grace period so player won't land directly on a hazard

    this.sound.setBgmMode('normal');
    this.particles.spawnLandingImpact(player.position);

    if (onExitCallback) onExitCallback();
  }

  update(dt, player, scoreManager) {
    if (!this.isActive) return;

    this.timer -= dt;

    // Rotate sky decorations
    this.decorations.forEach((d, idx) => {
      d.rotation.y += dt * 0.5 * (idx % 2 === 0 ? 1 : -1);
      d.rotation.z += dt * 0.3;
    });

    // Magnet or normal coin collection in Super Reward
    const isMagnet = player.magnetTimer > 0 || player.pet.hasPassiveMagnet();

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.update(dt, player.position, isMagnet);

      if (!c.isCollected && player.hitbox.intersectsBox(c.hitbox)) {
        c.isCollected = true;
        this.group.remove(c.mesh);

        // 3x Performance Score Multiplier in Super Reward!
        scoreManager.addCoin(c.value * 3, c.feverEnergy);
        this.sound.playCoin(c.value > 100 ? 3 : 2);
        this.particles.spawnCoinSparkles(c.position, 0xffdd00, 6);
        this.coins.splice(i, 1);
      }
    }
  }
}
