import * as THREE from 'three';
import { Biome } from './LevelGenerator.js';

export class CameraManager {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;

    // Follow offsets
    this.targetOffset = new THREE.Vector3(5.5, 3.5, 9.5);
    this.currentPos = new THREE.Vector3(0, 3.5, 9.5);
    this.lookOffset = new THREE.Vector3(4.0, 1.6, 0);

    // Dynamic FOV
    this.baseFOV = 62;
    this.targetFOV = 62;

    // Screen Shake (Trauma model)
    this.trauma = 0;
    this.maxShakeX = 0.4;
    this.maxShakeY = 0.4;

    this.setupLighting();
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.7);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xFFFFFF, 1.2);
    this.dirLight.position.set(10, 20, 15);
    this.scene.add(this.dirLight);

    this.neonPointLight = new THREE.PointLight(0x00F0FF, 2.5, 25);
    this.scene.add(this.neonPointLight);
  }

  addTrauma(amount) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  setMode(biome, isSprinting = false) {
    if (biome === Biome.SUPER_REWARD) {
      this.targetFOV = 72;
      this.ambientLight.color.setHex(0xFFE4A0);
      this.neonPointLight.color.setHex(0xFFD700);
    } else if (biome === Biome.WARP_REWARD) {
      this.targetFOV = 90;
      this.ambientLight.color.setHex(0x80D0FF);
      this.neonPointLight.color.setHex(0x00F0FF);
    } else {
      this.targetFOV = isSprinting ? 78 : this.baseFOV;
      this.ambientLight.color.setHex(0xFFFFFF);
      this.neonPointLight.color.setHex(0x38BDF8);
    }
  }

  update(dt, playerX, playerY, playerZ) {
    // Smooth camera following
    const desiredX = playerX + this.targetOffset.x;
    const desiredY = Math.max(2.8, playerY + this.targetOffset.y);
    const desiredZ = this.targetOffset.z;

    this.currentPos.x += (desiredX - this.currentPos.x) * dt * 7.0;
    this.currentPos.y += (desiredY - this.currentPos.y) * dt * 6.0;
    this.currentPos.z += (desiredZ - this.currentPos.z) * dt * 5.0;

    // Shake calculation
    let shakeX = 0;
    let shakeY = 0;
    if (this.trauma > 0) {
      const shakeVal = this.trauma * this.trauma;
      shakeX = (Math.random() * 2 - 1) * this.maxShakeX * shakeVal;
      shakeY = (Math.random() * 2 - 1) * this.maxShakeY * shakeVal;
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
    }

    this.camera.position.set(
      this.currentPos.x + shakeX,
      this.currentPos.y + shakeY,
      this.currentPos.z
    );

    // Look at slightly ahead of player
    this.camera.lookAt(playerX + this.lookOffset.x, Math.max(1.0, playerY) + this.lookOffset.y, playerZ);

    // Dynamic FOV interpolation
    if (Math.abs(this.camera.fov - this.targetFOV) > 0.1) {
      this.camera.fov += (this.targetFOV - this.camera.fov) * dt * 4.0;
      this.camera.updateProjectionMatrix();
    }

    // Move dynamic lights with player
    this.neonPointLight.position.set(playerX + 2, playerY + 2, 2);
    this.dirLight.position.set(playerX + 10, 20, 15);
    this.dirLight.target.position.set(playerX, 0, 0);
  }
}
