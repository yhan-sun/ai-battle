import * as THREE from 'three';
import { Config } from './config.js';

// 程序化低模角色:身体部位全部代码生成,无外部资源
// 支持 跑/跳/二段跳/滑铲/坐骑/受伤 动画
export class Player {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);

    this.variant = 0; // 0 疾风少年蓝, 1 星语少女粉
    this.mounted = false;
    this.sliding = false;
    this.slideTimer = 0;
    this.y = 0; this.vy = 0;
    this.grounded = true;
    this.jumps = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.dead = false;
    this.invincible = 0;
    this.runPhase = 0;
    this.blink = 0;

    this.buildCharacter();
    this.buildMount();
    this.buildPet();
    this.root.position.set(0, 0, 0);
  }

  mat(color, emissive = 0x000000, ei = 0) {
    return new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: ei });
  }

  buildCharacter() {
    // 清理旧的(保留坐骑尾巴引用)
    const keepTail = this.parts?.tail;
    while (this.body.children.length) this.body.remove(this.body.children[0]);
    const boy = this.variant === 0;
    const skin = boy ? 0xffd9b3 : 0xffe3d0;
    const suit = boy ? 0x2e9bff : 0xff5fa2;
    const suit2 = boy ? 0x0b3d91 : 0x8a1c5c;
    const hair = boy ? 0x1c2333 : 0x5b2a86;

    this.parts = {};
    // 躯干
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.4), this.mat(suit));
    torso.position.y = 1.15;
    this.body.add(torso); this.parts.torso = torso;
    // 腰带
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.12, 0.42), this.mat(0xffe45e, 0x664400, 0.3));
    belt.position.y = 0.86; this.body.add(belt);
    // 头
    const headG = new THREE.Group(); headG.position.y = 1.75;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.45), this.mat(skin));
    headG.add(head);
    const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.2, 0.49), this.mat(hair));
    hairM.position.y = 0.22; headG.add(hairM);
    // 眼睛(发光,正面朝+z? 侧视角朝+x,所以眼睛放+x面)
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x10233f });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.08), eyeM);
    eyeL.position.set(0.26, 0.02, 0.1); headG.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.z = -0.1; headG.add(eyeR);
    // 围巾(跑酷标志性)
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.14), this.mat(0xff3b3b, 0x550000, 0.4));
    scarf.position.set(-0.25, -0.18, 0); headG.add(scarf);
    this.parts.scarf = scarf;
    this.body.add(headG); this.parts.head = headG;

    // 手臂(肩膀为轴)
    const mkArm = (z) => {
      const g = new THREE.Group(); g.position.set(0, 1.4, z);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), this.mat(suit2));
      m.position.y = -0.26; g.add(m);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), this.mat(skin));
      hand.position.y = -0.58; g.add(hand);
      this.body.add(g); return g;
    };
    this.parts.armF = mkArm(0.32); this.parts.armB = mkArm(-0.32);
    // 腿(髋部为轴)
    const mkLeg = (z) => {
      const g = new THREE.Group(); g.position.set(0, 0.82, z * 0.6);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), this.mat(0x222a44));
      m.position.y = -0.3; g.add(m);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.24), this.mat(boy ? 0xffffff : 0xffe45e));
      shoe.position.set(0.06, -0.62, 0); g.add(shoe);
      this.body.add(g); return g;
    };
    this.parts.legF = mkLeg(1); this.parts.legB = mkLeg(-1);
    // 背后小披风/喷气
    const jet = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.3), this.mat(0x333a55));
    jet.position.set(-0.35, 1.2, 0); this.body.add(jet);
    this.parts.jet = jet;
    if (keepTail) this.parts.tail = keepTail;
  }

  buildMount() {
    // 星角兽:四足小兽,骑乘时玩家坐在上面
    this.mountG = new THREE.Group();
    const bodyM = this.mat(0xffb84d, 0x442200, 0.25);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 0.6), bodyM);
    body.position.y = 0.65; this.mountG.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), this.mat(0xffe1a8));
    head.position.set(0.8, 1.0, 0); this.mountG.add(head);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), new THREE.MeshBasicMaterial({ color: 0x7df9ff }));
    horn.position.set(0.85, 1.45, 0); this.mountG.add(horn);
    // 眼
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.1), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    eye.position.set(1.05, 1.05, 0.12); this.mountG.add(eye);
    const eye2 = eye.clone(); eye2.position.z = -0.12; this.mountG.add(eye2);
    // 腿
    this.mountLegs = [];
    const legG = new THREE.BoxGeometry(0.2, 0.55, 0.2);
    const legM = this.mat(0x8a4b00);
    [[0.45, 0.2], [0.45, -0.2], [-0.45, 0.2], [-0.45, -0.2]].forEach(([x, z]) => {
      const p = new THREE.Group(); p.position.set(x, 0.45, z);
      const m = new THREE.Mesh(legG, legM); m.position.y = -0.25; p.add(m);
      this.mountG.add(p); this.mountLegs.push(p);
    });
    // 尾巴
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), this.mat(0xff7a3d));
    tail.position.set(-0.85, 0.8, 0); this.mountG.add(tail);
    this.parts.tail = tail;
    this.mountG.visible = false;
    this.root.add(this.mountG);
  }

  buildPet() {
    // 跟屁虫:悬浮三角锥无人机
    this.petG = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshLambertMaterial({ color: 0x7df9ff, emissive: 0x0a4a5a, emissiveIntensity: 0.8 }));
    this.petG.add(core); this.petCore = core;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 16), new THREE.MeshBasicMaterial({ color: 0xffe45e }));
    ring.rotation.y = Math.PI / 2; this.petG.add(ring); this.petRing = ring;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0x10233f }));
    eye.position.x = 0.16; this.petG.add(eye);
    this.petG.visible = true;
    this.scene.add(this.petG);
    this.petPos = new THREE.Vector3(-1.5, 2.2, -1.2);
    // 护盾气泡(受击保护可视化)
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0x37e6ff, transparent: true, opacity: 0.22 })
    );
    this.shieldMesh.position.y = 1.1;
    this.shieldMesh.visible = false;
    this.body.add(this.shieldMesh);
  }

  setVariant(v) { this.variant = v; this.buildCharacter(); this.applyMountPose(); }
  setMount(on) { this.mounted = on; this.mountG.visible = on; this.applyMountPose(); }
  setPetVisible(v) { this.petG.visible = v; }
  applyMountPose() {
    if (this.mounted) { this.body.position.y = 0.75; this.body.scale.set(0.9, 0.9, 0.9); }
    else { this.body.position.y = 0; this.body.scale.set(1, 1, 1); }
  }

  reset(x = 0) {
    this.root.position.set(x, 0, 0);
    this.y = 0; this.vy = 0; this.grounded = true; this.jumps = 0;
    this.sliding = false; this.slideTimer = 0; this.dead = false;
    this.invincible = 0; this.coyote = 0; this.buffer = 0; this.runPhase = 0;
    this.body.rotation.set(0, 0, 0);
    this.body.visible = true;
  }

  tryJump() { this.buffer = Config.jumpBuffer; }
  trySlide() {
    if (!this.grounded) { // 空中下坠加速(快速落地,天天酷跑手感)
      this.vy = Math.min(this.vy, -18);
      return 'dive';
    }
    this.sliding = true; this.slideTimer = Config.slideTime;
    return 'slide';
  }

  // 地面高度由外部传入;hasGround=false表示深渊
  update(dt, speed, groundY, hasGround) {
    // buffer跳
    if (this.buffer > 0) {
      this.buffer -= dt;
      if (this.grounded || this.coyote > 0) {
        this.vy = this.mounted ? Config.jumpV + 1.5 : Config.jumpV;
        this.grounded = false; this.jumps = 1; this.coyote = 0; this.buffer = 0;
        this.sliding = false;
        return 'jump';
      } else if (this.jumps < 2) {
        this.vy = this.mounted ? Config.doubleJumpV + 1.5 : Config.doubleJumpV;
        this.jumps = 2; this.buffer = 0;
        this.sliding = false;
        return 'double';
      }
    }
    // 重力
    this.vy -= Config.gravity * dt;
    if (this.vy < -30) this.vy = -30;
    this.y += this.vy * dt;

    if (hasGround) {
      if (this.y <= groundY) {
        if (!this.grounded && this.vy < -12) { /* 重落地 */ }
        this.y = groundY; this.vy = 0;
        if (!this.grounded) { this.grounded = true; this.jumps = 0; }
        this.coyote = Config.coyoteTime;
      } else {
        if (this.grounded) { /* 离开边缘 */ }
        if (this.grounded && this.y > groundY + 0.02) { this.grounded = false; }
        this.coyote -= dt;
      }
    } else {
      // 深渊:一直掉
      if (this.grounded) { this.grounded = false; this.coyote = Config.coyoteTime; }
      else this.coyote -= dt;
    }

    // 滑铲计时
    if (this.sliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.sliding = false;
    }
    if (this.invincible > 0) this.invincible -= dt;
    if (this.blink > 0) this.blink -= dt;

    this.root.position.y = this.y;
    this.animate(dt, speed);
    // 宠物跟随
    this.updatePet(dt);
    return null;
  }

  animate(dt, speed) {
    const t = (this.runPhase += dt * (6 + speed * 0.45));
    const p = this.parts;
    const air = !this.grounded;
    // 无敌闪烁
    this.body.visible = !(this.invincible > 0 && Math.floor(this.invincible * 12) % 2 === 0 && !this.dead);

    if (this.sliding) {
      // 滑铲姿态:压低+后仰
      this.body.rotation.z = -0.25;
      this.body.scale.y = this.mounted ? 0.9 : 0.55;
      p.legF.rotation.z = -1.2; p.legB.rotation.z = -0.9;
      p.armF.rotation.z = 0.8; p.armB.rotation.z = 0.6;
      p.head.rotation.z = 0.25;
    } else if (air) {
      const rising = this.vy > 0;
      this.body.rotation.z = rising ? 0.12 : -0.18;
      this.body.scale.y = this.mounted ? 0.9 : 1;
      if (this.jumps >= 2) { // 二段跳旋转特效
        p.legF.rotation.z = Math.sin(t * 2) * 0.9 - 0.5;
        p.legB.rotation.z = Math.sin(t * 2 + Math.PI) * 0.9 - 0.3;
        p.armF.rotation.z = 2.4; p.armB.rotation.z = -2.4;
      } else {
        p.legF.rotation.z = rising ? -0.7 : 0.4;
        p.legB.rotation.z = rising ? 0.3 : 0.7;
        p.armF.rotation.z = rising ? -2.6 : -1.2;
        p.armB.rotation.z = rising ? 0.6 : 1.4;
      }
      p.head.rotation.z = 0;
    } else {
      this.body.rotation.z = 0.08 + Math.sin(t * 2) * 0.03;
      this.body.scale.y = this.mounted ? 0.9 : 1;
      const s = Math.sin(t * 2), c = Math.sin(t * 2 + Math.PI);
      p.legF.rotation.z = s * 0.95;
      p.legB.rotation.z = c * 0.95;
      p.armF.rotation.z = c * 0.85;
      p.armB.rotation.z = s * 0.85;
      p.head.rotation.z = Math.sin(t) * 0.05;
      p.head.position.y = 1.75 + Math.abs(Math.sin(t * 2)) * 0.05;
      if (p.scarf) p.scarf.rotation.y = Math.sin(t * 1.5) * 0.4;
      // 坐骑腿
      if (this.mounted) {
        this.mountLegs.forEach((l, i) => { l.rotation.z = Math.sin(t * 2 + (i % 2) * Math.PI) * 0.7; });
        if (p.tail) p.tail.rotation.z = Math.sin(t * 3) * 0.4;
      }
    }
    if (this.mounted) {
      this.mountLegs.forEach((l, i) => { if (air) l.rotation.z = i < 2 ? -0.5 : 0.5; });
    }
    // 喷气抖动
    if (p.jet) p.jet.position.x = -0.35 + Math.sin(t * 6) * 0.02;
  }

  updatePet(dt) {
    if (!this.petG.visible) return;
    const target = new THREE.Vector3(
      this.root.position.x - 1.6,
      this.root.position.y + 2.3 + Math.sin(performance.now() * 0.004) * 0.25,
      -1.1
    );
    this.petPos.lerp(target, 1 - Math.pow(0.001, dt));
    this.petG.position.copy(this.petPos);
    this.petCore.rotation.y += dt * 3;
    this.petCore.rotation.x += dt * 1.5;
    this.petRing.rotation.x += dt * 4;
  }

  // 碰撞盒(世界坐标,X/Y平面),宽容收缩
  getAABB() {
    const x = this.root.position.x;
    const shrink = 0.16;
    if (this.sliding) {
      return { minX: x - 0.55, maxX: x + 0.55, minY: this.y + 0.05, maxY: this.y + 0.85 };
    }
    const h = this.mounted ? 2.15 : 2.0;
    return { minX: x - 0.35 + shrink * 0.4, maxX: x + 0.35 - shrink * 0.4, minY: this.y + 0.05, maxY: this.y + h };
  }
  get pos() { return this.root.position; }
}
