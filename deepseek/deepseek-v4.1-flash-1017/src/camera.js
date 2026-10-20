import * as THREE from 'three';
import { clamp, damp } from './utils.js';

/**
 * 第三人称侧视相机：
 * - 不同模式使用不同机位与 FOV（主场景 / 超级奖励 / 穿越 / 死亡 / 菜单）；
 * - 抖动使用 trauma 衰减，叠加 FOV 随速度扩张，强化冲刺与撞击反馈。
 */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'menu';
    this.time = 0;
    this.trauma = 0;
    this.baseFov = camera.fov;

    this.position = new THREE.Vector3(-7.8, 4.4, 13.6);
    this.look = new THREE.Vector3(2.2, 2.0, 0);

    this._posTarget = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._shake = new THREE.Vector3();
    this._lookShake = new THREE.Vector3();
    this._initialized = false;
  }

  setMode(mode) {
    this.mode = mode;
  }

  addShake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt, options = {}) {
    const { playerY = 0, speed = 0, mode = this.mode, time = 0 } = options;
    this.time = time;
    this.mode = mode;

    let fovTarget = this.baseFov;

    if (mode === 'menu') {
      this._posTarget.set(
        -7.6 + Math.sin(time * 0.22) * 0.7,
        4.35 + Math.sin(time * 0.33) * 0.16,
        13.4,
      );
      this._lookTarget.set(2.4 + Math.sin(time * 0.17) * 0.5, 1.85, 0);
      fovTarget = 48;
    } else if (mode === 'super') {
      this._posTarget.set(-7.3, 5.9, 14.3);
      this._lookTarget.set(4.6, 2.7, 0);
      fovTarget = 56;
    } else if (mode === 'travel') {
      this._posTarget.set(-6.8, 4.8, 15.8);
      this._lookTarget.set(5.8, 2.7, 0);
      fovTarget = 68;
    } else if (mode === 'death') {
      this._posTarget.set(-6.6, 4.4, 12.2);
      this._lookTarget.set(0.6, 1.4, 0);
      fovTarget = 50;
    } else if (mode === 'gameover') {
      this._posTarget.set(-7.0, 4.8, 13.2);
      this._lookTarget.set(1.2, 1.7, 0);
      fovTarget = 50;
    } else {
      this._posTarget.set(-7.6, 5.15 + playerY * 0.1, 13.5);
      this._lookTarget.set(4.3, 2.15 + playerY * 0.22, 0);
      const speedBoost = clamp((speed - 13.5) * 0.26, 0, 5.2);
      fovTarget = 51 + speedBoost;
    }

    if (!this._initialized) {
      this.position.copy(this._posTarget);
      this.look.copy(this._lookTarget);
      this.camera.fov = fovTarget;
      this.camera.updateProjectionMatrix();
      this._initialized = true;
    }

    const posBlend = 1 - Math.exp(-4.2 * dt);
    const lookBlend = 1 - Math.exp(-6.5 * dt);
    this.position.lerp(this._posTarget, posBlend);
    this.look.lerp(this._lookTarget, lookBlend);

    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    const shake = this.trauma * this.trauma;
    this._shake.set(
      Math.sin(time * 61.7) * 0.5 * shake,
      Math.sin(time * 73.1 + 1.7) * 0.38 * shake,
      Math.sin(time * 47.3 + 0.4) * 0.28 * shake,
    );
    this._lookShake.set(
      Math.sin(time * 55.1 + 0.8) * 0.16 * shake,
      Math.sin(time * 67.9) * 0.12 * shake,
      0,
    );

    this.camera.position.copy(this.position).add(this._shake);
    this.camera.lookAt(
      this.look.x + this._lookShake.x,
      this.look.y + this._lookShake.y,
      this.look.z + this._lookShake.z,
    );
    this.camera.rotateZ(Math.sin(time * 43.7) * 0.03 * shake);

    const newFov = damp(this.camera.fov, fovTarget, 3.2, dt);
    if (Math.abs(newFov - this.camera.fov) > 0.01) {
      this.camera.fov = newFov;
      this.camera.updateProjectionMatrix();
    }
  }
}
