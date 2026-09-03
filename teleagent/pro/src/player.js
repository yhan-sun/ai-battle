// 玩家角色：程序化小人 + 坐骑/宠物机制 + 跑跳蹲动画
import * as THREE from 'three';

export class Player {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.group = new THREE.Group();
    scene.add(this.group);

    // 逻辑状态
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.jumpCount = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.duckT = 0;
    this.ducking = false;
    this.invincible = 0;
    this.dashing = 0;
    this.phase = 0; // 奔跑动画相位

    // 构建小人
    this.buildBody();
    // 坐骑
    this.mount = null;
    this.buildMount();
    // 宠物
    this.pet = null;
    this.buildPet();
  }

  buildBody() {
    const g = this.group;
    const skin = new THREE.MeshStandardMaterial({ color: 0xffd9a8, roughness: 0.7 });
    const suit = new THREE.MeshStandardMaterial({ color: 0x4ee3c0, roughness: 0.5, metalness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0e1a2e, roughness: 0.7 });

    // 头
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), skin);
    this.head.position.y = 1.62;
    this.head.scale.set(1, 1.1, 1);
    // 眼睛
    const eyeGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x14202e });
    this.eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeL.position.set(-0.13, 1.7, 0.32);
    this.eyeR = this.eyeL.clone();
    this.eyeR.position.x = 0.13;
    // 发带
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 6, 20), new THREE.MeshStandardMaterial({ color: 0xff5d73 }));
    band.position.y = 1.78;
    band.rotation.x = Math.PI / 2;

    // 躯干
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), suit);
    this.torso.position.y = 1.05;
    // 腿
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), dark);
    this.legL.position.set(-0.14, 0.42, 0);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.14;
    // 手臂
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.13), suit);
    this.armL.position.set(-0.36, 1.15, 0);
    this.armR = this.armL.clone();
    this.armR.position.x = 0.36;

    this.group.add(this.head, this.eyeL, this.eyeR, band, this.torso, this.legL, this.legR, this.armL, this.armR);
  }

  buildMount() {
    // 悬浮滑板坐骑：扁平光板 + 尾焰
    const mount = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.18, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x7aa5ff, emissive: 0x1a3a7a, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3 })
    );
    board.position.y = 0.15;
    // 悬浮光环
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.04, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0x4ee3c0, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    // 尾焰粒子容器
    this.mountFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.8, 8),
      new THREE.MeshBasicMaterial({ color: 0x7ad4ff, transparent: true, opacity: 0.8 })
    );
    this.mountFlame.rotation.x = -Math.PI / 2;
    this.mountFlame.position.set(0, 0.15, -1.1);
    mount.add(board, ring, this.mountFlame);
    mount.position.y = -0.3;
    this.group.add(mount);
    this.mount = mount;
  }

  buildPet() {
    // 悬浮小宠：发光球体 + 小眼睛
    const pet = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffcf4d, emissive: 0x6b4d00, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.4 })
    );
    const pEye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshStandardMaterial({ color: 0x14181c }));
    pEye.position.set(0, 0.06, 0.22);
    pet.add(body, pEye);
    pet.position.set(0.9, 2.3, 0.6);
    this.group.add(pet);
    this.pet = pet;
    this.petBaseY = 2.3;
  }

  // ---------- 输入动作 ----------
  tryJump() {
    this.buffer = 0.15;
  }

  duck() {
    this.duckT = 0.35;
    this.ducking = true;
  }

  // ---------- 物理更新 ----------
  update(dt) {
    // 跳跃缓冲
    if (this.buffer > 0) {
      this.buffer -= dt;
      if (this.coyote > 0 || this.grounded) {
        this.doJump(false);
        this.buffer = 0;
      } else if (this.jumpCount < 2) {
        this.doJump(true);
        this.buffer = 0;
      }
    }
    // 土狼时间
    if (this.grounded) {
      this.coyote = 0.1;
    } else if (this.coyote > 0) {
      this.coyote -= dt;
    }

    // 重力
    this.vy -= 28 * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) {
      this.y = 0;
      this.vy = 0;
      this.grounded = true;
      this.jumpCount = 0;
    } else {
      this.grounded = false;
    }

    // 下蹲计时
    if (this.duckT > 0) this.duckT -= dt;
    else this.ducking = false;

    this.animateBody(dt);
  }

  doJump(double) {
    this.vy = double ? 9.2 : 10.6;
    this.y = Math.max(this.y, 0.01);
    this.grounded = false;
    this.jumpCount = double ? 2 : 1;
    if (double) this.audio.doubleJump();
    else this.audio.jump();
    this.group.position.y = this.y;
  }

  // 被击中时弹跳 + 无敌帧
  hurt() {
    this.audio.hurt();
    this.invincible = 1.6;
    this.vy = 8;
    this.y = Math.max(this.y, 0.1);
    this.grounded = false;
    this.jumpCount = 2;
  }

  hitDash() {
    this.dashing = 1.5;
    this.audio.dash();
  }

  // 动画：奔跑摆臂/摆腿，跳跃姿态，下蹲压缩
  animateBody(dt) {
    this.phase += dt * 12;
    const run = this.grounded && !this.ducking;
    // 腿
    if (run) {
      const s = Math.sin(this.phase);
      this.legL.rotation.x = s * 0.9;
      this.legR.rotation.x = -s * 0.9;
      this.armL.rotation.x = -s * 0.7;
      this.armR.rotation.x = s * 0.7;
    } else {
      // 空中或下蹲姿态
      this.legL.rotation.x = this.ducking ? -0.5 : 0.4;
      this.legR.rotation.x = this.ducking ? 0.6 : -0.4;
      this.armL.rotation.x = this.ducking ? -1.4 : 0.3;
      this.armR.rotation.x = this.ducking ? -1.2 : 0.2;
    }
    // 下蹲整体下沉
    const duckY = this.ducking ? -0.5 : 0;
    this.group.children.forEach((c) => {
      if (c === this.mount) c.position.y = -0.3 + duckY * 0.5;
    });
    // 身体缩放模拟下蹲
    this.torso.scale.y = this.ducking ? 0.7 : 1;
    // 眼睛眨眼
    if (Math.sin(this.phase * 0.3) > 0.98) {
      this.eyeL.scale.y = 0.1;
      this.eyeR.scale.y = 0.1;
    } else {
      this.eyeL.scale.y = 1;
      this.eyeR.scale.y = 1;
    }
    // 坐骑尾焰脉动
    if (this.mountFlame) {
      const p = 0.7 + Math.sin(this.phase * 2) * 0.3;
      this.mountFlame.scale.set(p, p * 1.6, p);
    }
    // 宠物绕飞
    if (this.pet) {
      this.pet.position.x = 0.9 + Math.cos(this.phase * 0.5) * 0.15;
      this.pet.position.y = this.petBaseY + Math.sin(this.phase * 0.8) * 0.12;
      this.pet.rotation.y += 0.02;
    }
    // 无敌帧闪烁
    this.group.visible = this.invincible > 0 ? Math.floor(this.phase * 8) % 2 === 0 : true;
  }

  // 供碰撞检测使用的受击盒
  getDuckingHeight() {
    return this.ducking ? 0.9 : 1.85;
  }
}