import * as THREE from 'three';
import { ObstacleType } from './Obstacles.js';
import { ItemType } from './Collectibles.js';

export const Biome = {
  NORMAL_CYBER: 'NORMAL_CYBER',
  CRYSTAL_SKYWAY: 'CRYSTAL_SKYWAY',
  SUPER_REWARD: 'SUPER_REWARD',
  WARP_REWARD: 'WARP_REWARD'
};

export class LevelGenerator {
  constructor(scene, obstacleManager, collectibleManager) {
    this.scene = scene;
    this.obsMgr = obstacleManager;
    this.itemMgr = collectibleManager;

    this.platforms = [];
    this.chunks = [];
    this.currentX = -10;
    this.currentBiome = Biome.NORMAL_CYBER;
    this.difficulty = 1.0;

    // Platform Materials
    this.cyberRoadMat = new THREE.MeshStandardMaterial({
      color: 0x1E293B,
      roughness: 0.2,
      metalness: 0.8
    });
    this.cyberGlowMat = new THREE.MeshBasicMaterial({ color: 0x00F0FF });
    this.crystalRoadMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x334155
    });
    this.superGoldRoadMat = new THREE.MeshStandardMaterial({
      color: 0xF59E0B,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0xD97706,
      emissiveIntensity: 0.5
    });
    this.warpRoadMat = new THREE.MeshBasicMaterial({
      color: 0x3B82F6,
      wireframe: true
    });
  }

  reset() {
    this.clearAll();
    this.currentX = -10;
    this.currentBiome = Biome.NORMAL_CYBER;
    this.difficulty = 1.0;

    // Initial safe start strip
    this.spawnPlatform(-10, 50, 0, 3.5, Biome.NORMAL_CYBER);
    this.currentX = 40;

    // Pre-generate first few chunks
    for (let i = 0; i < 4; i++) {
      this.generateNextChunk();
    }
  }

  setBiome(biome) {
    this.currentBiome = biome;
  }

  spawnPlatform(x, length, y = 0, width = 3.5, biome = this.currentBiome) {
    const group = new THREE.Group();
    group.position.set(x + length / 2, y - 0.5, 0);

    let mainMat = this.cyberRoadMat;
    let edgeColor = 0x00F0FF;

    if (biome === Biome.CRYSTAL_SKYWAY) {
      mainMat = this.crystalRoadMat;
      edgeColor = 0xA855F7;
    } else if (biome === Biome.SUPER_REWARD) {
      mainMat = this.superGoldRoadMat;
      edgeColor = 0xFDE047;
    } else if (biome === Biome.WARP_REWARD) {
      mainMat = this.warpRoadMat;
      edgeColor = 0x06B6D4;
    }

    // Main surface box
    const bodyGeo = new THREE.BoxGeometry(length, 1.0, width);
    const body = new THREE.Mesh(bodyGeo, mainMat);
    group.add(body);

    // Neon edge rails
    const railGeo = new THREE.BoxGeometry(length, 0.12, 0.12);
    const edgeMat = new THREE.MeshBasicMaterial({ color: edgeColor });
    const railFront = new THREE.Mesh(railGeo, edgeMat);
    railFront.position.set(0, 0.5, width / 2 - 0.06);
    const railBack = new THREE.Mesh(railGeo, edgeMat);
    railBack.position.set(0, 0.5, -width / 2 + 0.06);
    group.add(railFront);
    group.add(railBack);

    this.scene.add(group);

    const platform = {
      group,
      minX: x,
      maxX: x + length,
      y: y,
      width,
      biome,
      active: true
    };
    this.platforms.push(platform);
    return platform;
  }

  generateNextChunk() {
    const chunkStartX = this.currentX;
    const chunkLength = 40;

    if (this.currentBiome === Biome.SUPER_REWARD) {
      // Super Reward Chunk: Continuous golden road, no obstacles, dense coin formations & buffs
      this.spawnPlatform(chunkStartX, chunkLength, 0, 4.0, Biome.SUPER_REWARD);
      this.generateSuperRewardPattern(chunkStartX, chunkLength);
    } 
    else if (this.currentBiome === Biome.WARP_REWARD) {
      // Warp Speed Chunk: Floating cyber grid road + massive Warp Rings
      this.spawnPlatform(chunkStartX, chunkLength, 0, 3.5, Biome.WARP_REWARD);
      for (let x = chunkStartX + 8; x < chunkStartX + chunkLength; x += 12) {
        this.itemMgr.spawn(ItemType.WARP_RING, x, 1.5, 0);
        this.itemMgr.spawn(ItemType.GEM_PINK, x + 3, 1.5, 0);
      }
    } 
    else {
      // Normal Procedural Running Chunk
      const patternChoice = Math.floor(Math.random() * 5);

      if (patternChoice === 0) {
        // Flat segment with alternating spike jumps and high slide lasers
        this.spawnPlatform(chunkStartX, chunkLength, 0, 3.5);
        this.obsMgr.spawn(ObstacleType.SPIKE_BARRIER, chunkStartX + 8, 0);
        this.spawnCoinArc(chunkStartX + 6, chunkStartX + 12, 0, 2.5);

        this.obsMgr.spawn(ObstacleType.HIGH_LASER, chunkStartX + 20, 0);
        this.spawnCoinLine(chunkStartX + 18, chunkStartX + 24, 0.4); // low coins for slide

        this.obsMgr.spawn(ObstacleType.STOMP_MONSTER, chunkStartX + 30, 0);
        this.itemMgr.spawn(ItemType.GEM_BLUE, chunkStartX + 30, 2.8, 0);
      }
      else if (patternChoice === 1) {
        // High Tier Platform reached by Spring Pad or Double Jump
        const p1Len = 14;
        const p2Len = 16;
        this.spawnPlatform(chunkStartX, p1Len, 0, 3.5);
        this.obsMgr.spawn(ObstacleType.SPRING_PAD, chunkStartX + 10, 0);

        // High floating platform with rich gems
        this.spawnPlatform(chunkStartX + 12, p2Len, 3.5, 3.0, Biome.CRYSTAL_SKYWAY);
        this.spawnCoinLine(chunkStartX + 14, chunkStartX + 26, 4.5, ItemType.GEM_BLUE);

        // Lower continuation
        this.spawnPlatform(chunkStartX + 26, 14, 0, 3.5);
        this.obsMgr.spawn(ObstacleType.SPIKE_BARRIER, chunkStartX + 32, 0);
      }
      else if (patternChoice === 2) {
        // Floating island hops with guaranteed jump distances
        const gap1 = 3.5;
        const gap2 = 4.0;
        this.spawnPlatform(chunkStartX, 10, 0, 3.5);
        this.spawnCoinLine(chunkStartX + 2, chunkStartX + 8, 1.0);

        this.spawnPlatform(chunkStartX + 10 + gap1, 10, 1.2, 3.5);
        this.obsMgr.spawn(ObstacleType.STOMP_MONSTER, chunkStartX + 10 + gap1 + 5, 1.2);
        this.spawnCoinArc(chunkStartX + 10 + gap1 + 2, chunkStartX + 10 + gap1 + 8, 1.2, 3.0);

        this.spawnPlatform(chunkStartX + 20 + gap1 + gap2, 12, 0, 3.5);
        this.obsMgr.spawn(ObstacleType.HIGH_LASER, chunkStartX + 20 + gap1 + gap2 + 6, 0);
      }
      else if (patternChoice === 3) {
        // Power-up showcase segment
        this.spawnPlatform(chunkStartX, chunkLength, 0, 3.5);
        const powerupType = Math.random() < 0.35 ? ItemType.BUFF_MAGNET : (Math.random() < 0.5 ? ItemType.BUFF_SHIELD : ItemType.BUFF_SPRINT);
        this.itemMgr.spawn(powerupType, chunkStartX + 8, 1.8, 0);

        // Dense wave of coins to enjoy the powerup
        this.spawnCoinWave(chunkStartX + 12, chunkStartX + 36, 0);
        this.obsMgr.spawn(ObstacleType.STOMP_MONSTER, chunkStartX + 22, 0);
        this.obsMgr.spawn(ObstacleType.SPIKE_BARRIER, chunkStartX + 32, 0);
      }
      else {
        // Double Decker Challenge
        this.spawnPlatform(chunkStartX, chunkLength, 0, 3.5);
        this.spawnPlatform(chunkStartX + 8, 20, 3.0, 2.5, Biome.CRYSTAL_SKYWAY);
        this.obsMgr.spawn(ObstacleType.HIGH_LASER, chunkStartX + 12, 0);
        this.obsMgr.spawn(ObstacleType.HIGH_LASER, chunkStartX + 22, 0);
        this.spawnCoinLine(chunkStartX + 10, chunkStartX + 26, 4.0, ItemType.GEM_PINK);
      }
    }

    this.currentX = chunkStartX + chunkLength;
  }

  generateSuperRewardPattern(startX, length) {
    // Magnificent 5x5 Coin Array and Star Matrix
    const centerX = startX + length / 2;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const itemType = (Math.abs(r) + Math.abs(c) === 2) ? ItemType.GEM_PINK : ItemType.COIN;
        this.itemMgr.spawn(itemType, centerX + c * 1.6, 2.5 + r * 0.8, 0);
      }
    }

    // Entry & Exit Coin Wave Arcs
    this.spawnCoinArc(startX + 3, startX + 12, 0, 3.0);
    this.spawnCoinArc(startX + length - 12, startX + length - 3, 0, 3.0);
  }

  spawnCoinLine(startX, endX, y, type = ItemType.COIN, step = 1.6) {
    for (let x = startX; x <= endX; x += step) {
      this.itemMgr.spawn(type, x, y, 0);
    }
  }

  spawnCoinArc(startX, endX, baseY, apexHeight, type = ItemType.COIN, count = 7) {
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = startX + t * (endX - startX);
      const y = baseY + 1.0 + Math.sin(t * Math.PI) * apexHeight;
      this.itemMgr.spawn(type, x, y, 0);
    }
  }

  spawnCoinWave(startX, endX, baseY) {
    const step = 1.4;
    for (let x = startX; x <= endX; x += step) {
      const y = baseY + 1.2 + Math.sin((x - startX) * 0.8) * 1.0;
      this.itemMgr.spawn(ItemType.COIN, x, y, 0);
    }
  }

  getGroundHeightAt(x, playerY) {
    let highestGround = -100;
    for (const p of this.platforms) {
      if (p.active && x >= p.minX && x <= p.maxX) {
        // Platform is beneath player or player is slightly below top surface
        if (p.y <= playerY + 0.5) {
          if (p.y > highestGround) {
            highestGround = p.y;
          }
        }
      }
    }
    return highestGround;
  }

  update(playerX) {
    // Generate new chunks ahead
    if (this.currentX < playerX + 90) {
      this.generateNextChunk();
    }

    // Clean up old platforms behind
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      const p = this.platforms[i];
      if (p.maxX < playerX - 35) {
        p.active = false;
        this.scene.remove(p.group);
        this.platforms.splice(i, 1);
      }
    }
  }

  clearAll() {
    for (const p of this.platforms) {
      this.scene.remove(p.group);
    }
    this.platforms = [];
    this.obsMgr.clearAll();
    this.itemMgr.clearAll();
  }
}
