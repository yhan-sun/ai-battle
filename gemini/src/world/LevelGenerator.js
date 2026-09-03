import * as THREE from 'three';
import { Obstacle, OBSTACLE_TYPES } from '../entities/Obstacle.js';
import { Coin, COIN_TYPES } from '../entities/Coin.js';
import { Powerup, POWERUP_TYPES } from '../entities/Powerup.js';

export class LevelGenerator {
  constructor(scene, soundManager, particleManager) {
    this.scene = scene;
    this.sound = soundManager;
    this.particles = particleManager;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Track active entities
    this.platforms = [];
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.decorations = [];

    // Generation state
    this.lastGeneratedX = -10;
    this.chunkWidth = 45;
    this.nextPortalDistance = 450; // Portal spawns around 450m, 900m, etc.
    this.nextPowerupDistance = 80;

    // Platform Materials
    this.groundTopMat = new THREE.MeshStandardMaterial({
      color: 0x44bb55, // Grass green top
      roughness: 0.8
    });
    this.groundSideMat = new THREE.MeshStandardMaterial({
      color: 0x5a3d28, // Soil brown sides
      roughness: 0.9
    });
    this.floatingPlatMat = new THREE.MeshStandardMaterial({
      color: 0x3388ee, // Futuristic floating platform
      roughness: 0.3,
      metalness: 0.6
    });

    // Build initial safe starting runway
    this.buildInitialRunway();
  }

  buildInitialRunway() {
    // 60m of flat safe ground for game start
    this.createPlatform(-15, 65, 0, false);
    this.lastGeneratedX = 65;

    // A welcome streak of gold coins
    for (let x = 10; x < 55; x += 3) {
      this.createCoin(COIN_TYPES.GOLD, x, 1.2);
    }
  }

  createPlatform(minX, maxX, topY, isFloating = false) {
    const width = maxX - minX;
    const height = isFloating ? 1.0 : 8.0;
    const depth = 4.0;

    const platGroup = new THREE.Group();

    // Top surface layer
    const topGeo = new THREE.BoxGeometry(width, 0.3, depth);
    const topMesh = new THREE.Mesh(topGeo, isFloating ? this.floatingPlatMat : this.groundTopMat);
    topMesh.position.set(minX + width / 2, topY - 0.15, 0);
    platGroup.add(topMesh);

    // Body block underneath
    const bodyGeo = new THREE.BoxGeometry(width, height - 0.3, depth - 0.2);
    const bodyMesh = new THREE.Mesh(bodyGeo, isFloating ? this.floatingPlatMat : this.groundSideMat);
    bodyMesh.position.set(minX + width / 2, topY - 0.3 - (height - 0.3) / 2, 0);
    platGroup.add(bodyMesh);

    this.group.add(platGroup);

    const platformData = {
      minX,
      maxX,
      topY,
      meshGroup: platGroup,
      isFloating
    };
    this.platforms.push(platformData);
    return platformData;
  }

  createCoin(type, x, y) {
    const coin = new Coin(type, x, y);
    this.group.add(coin.mesh);
    this.coins.push(coin);
    return coin;
  }

  createObstacle(type, x, y, options = {}) {
    const obs = new Obstacle(type, x, y, options);
    this.group.add(obs.mesh);
    this.obstacles.push(obs);
    return obs;
  }

  createPowerup(type, x, y) {
    const p = new Powerup(type, x, y);
    this.group.add(p.mesh);
    this.powerups.push(p);
    return p;
  }

  update(playerX) {
    // Generate chunks ahead of player (keep ~100m generated in front)
    while (this.lastGeneratedX < playerX + 110) {
      this.generateNextChunk();
    }

    // Prune distant objects behind player (< playerX - 35)
    this.pruneBehind(playerX - 35);
  }

  generateNextChunk() {
    const startX = this.lastGeneratedX;
    // Guaranteed beatable platform gap (single jump reaches 8m easily)
    const hasPit = Math.random() < 0.65;
    const gapWidth = hasPit ? (3.5 + Math.random() * 3.5) : 0; // 3.5m to 7.0m gap
    const platX = startX + gapWidth;
    const platLen = 22 + Math.random() * 18; // 22m to 40m
    const platEnd = platX + platLen;

    // Platform height variations (Ground Y=0, or slightly elevated Y=1.5)
    const platY = 0;
    this.createPlatform(platX, platEnd, platY);

    // Sometimes spawn an elevated floating platform overhead (Upper Path)
    const hasUpperPath = Math.random() < 0.45;
    if (hasUpperPath) {
      const upStart = platX + 5;
      const upEnd = platEnd - 5;
      if (upEnd > upStart + 8) {
        this.createPlatform(upStart, upEnd, 3.8, true);

        // Rich star gems & diamond on upper path!
        for (let ux = upStart + 2; ux < upEnd - 2; ux += 3.5) {
          const gemType = (Math.random() < 0.3) ? COIN_TYPES.STAR_GEM : COIN_TYPES.GOLD;
          this.createCoin(gemType, ux, 5.0);
        }
      }
    }

    // Guide coins across the pit gap if there is a pit!
    if (hasPit) {
      // Parabolic jump arc of coins
      const midX = startX + gapWidth / 2;
      this.createCoin(COIN_TYPES.GOLD, startX + 1, platY + 1.5);
      this.createCoin(COIN_TYPES.GOLD, midX, platY + 3.2);
      this.createCoin(COIN_TYPES.GOLD, platX - 1, platY + 1.8);
    }

    // Check if Dimension Rift Portal should spawn in this chunk!
    if (platX >= this.nextPortalDistance) {
      this.createObstacle(OBSTACLE_TYPES.PORTAL_GATE, platX + 10, platY);
      this.nextPortalDistance += 550 + Math.random() * 150;
    } else {
      // Procedural obstacle and challenge layout inside this platform
      this.populateChunkChallenges(platX, platEnd, platY, hasUpperPath);
    }

    // Spawn Powerups periodically
    if (platX >= this.nextPowerupDistance) {
      const powerupList = [
        POWERUP_TYPES.MAGNET,
        POWERUP_TYPES.SHIELD,
        POWERUP_TYPES.SPRINT,
        POWERUP_TYPES.GIANT,
        POWERUP_TYPES.MULTIPLIER
      ];
      const selected = powerupList[Math.floor(Math.random() * powerupList.length)];
      this.createPowerup(selected, platX + 15, platY + 1.8);
      this.nextPowerupDistance += 90 + Math.random() * 50;
    }

    this.lastGeneratedX = platEnd;
  }

  populateChunkChallenges(platX, platEnd, platY, hasUpperPath) {
    const length = platEnd - platX;
    let cursor = platX + 6;

    while (cursor < platEnd - 7) {
      const roll = Math.random();

      if (roll < 0.28) {
        // --- CHALLENGE 1: Overhead Hanging Saw (Requires SLIDE!) ---
        this.createObstacle(OBSTACLE_TYPES.HANGING_SAW, cursor, platY);
        // Low slide coins under the saw!
        this.createCoin(COIN_TYPES.GOLD, cursor - 1.5, platY + 0.4);
        this.createCoin(COIN_TYPES.GOLD, cursor, platY + 0.4);
        this.createCoin(COIN_TYPES.GOLD, cursor + 1.5, platY + 0.4);
        cursor += 9;
      } else if (roll < 0.55) {
        // --- CHALLENGE 2: Bouncing Stompable Monster ---
        this.createObstacle(OBSTACLE_TYPES.BOUNCING_MONSTER, cursor, platY);
        // High star coin above monster rewarded for stomping!
        this.createCoin(COIN_TYPES.STAR_GEM, cursor, platY + 4.5);
        cursor += 8;
      } else if (roll < 0.78) {
        // --- CHALLENGE 3: Ground Spikes (Requires JUMP) ---
        const spikeCount = Math.random() < 0.5 ? 2 : 3;
        this.createObstacle(OBSTACLE_TYPES.GROUND_SPIKE, cursor, platY, { count: spikeCount });
        // Coin arc jumping over the spikes
        this.createCoin(COIN_TYPES.SILVER, cursor - 1.5, platY + 1.2);
        this.createCoin(COIN_TYPES.GOLD, cursor, platY + 2.8);
        this.createCoin(COIN_TYPES.SILVER, cursor + 1.5, platY + 1.2);
        cursor += 9;
      } else {
        // --- CHALLENGE 4: Springboard Launch into Sky Coin Wave! ---
        this.createObstacle(OBSTACLE_TYPES.SPRINGBOARD, cursor, platY);
        // Sky coin arc launching high up
        for (let s = 1; s <= 5; s++) {
          const arcX = cursor + s * 2.2;
          const arcY = platY + 2.5 + Math.sin((s / 6) * Math.PI) * 5.0;
          this.createCoin(s === 3 ? COIN_TYPES.STAR_GEM : COIN_TYPES.GOLD, arcX, arcY);
        }
        cursor += 15;
      }
    }
  }

  pruneBehind(minX) {
    // Prune platforms
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      const p = this.platforms[i];
      if (p.maxX < minX) {
        this.group.remove(p.meshGroup);
        this.platforms.splice(i, 1);
      }
    }

    // Prune obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (obs.position.x < minX || obs.isDead) {
        this.group.remove(obs.mesh);
        this.obstacles.splice(i, 1);
      }
    }

    // Prune coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      if (coin.position.x < minX || coin.isCollected) {
        this.group.remove(coin.mesh);
        this.coins.splice(i, 1);
      }
    }

    // Prune powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      if (p.position.x < minX || p.isCollected) {
        this.group.remove(p.mesh);
        this.powerups.splice(i, 1);
      }
    }
  }

  reset() {
    // Clean all entities
    this.platforms.forEach(p => this.group.remove(p.meshGroup));
    this.obstacles.forEach(o => this.group.remove(o.mesh));
    this.coins.forEach(c => this.group.remove(c.mesh));
    this.powerups.forEach(p => this.group.remove(p.mesh));

    this.platforms = [];
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.decorations = [];

    this.lastGeneratedX = -10;
    this.nextPortalDistance = 450;
    this.nextPowerupDistance = 80;

    this.buildInitialRunway();
  }
}
