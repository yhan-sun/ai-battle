// 玩家：程序化小人 + 坐骑(赛博滑板) + 宠物(小精灵) + 物理与动画
import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';

const R = Math.PI / 2;

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.buildBody();
    this.buildMount();
    this.buildPet();
    this.buildShadow();

    this.reset();
  }

  buildBody() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.playerBody, roughness: 0.5, metalness: 0.1, emissive: 0x331133 });
    const skinMat = new THREE.MeshStandardMaterial({ color: COLORS.playerSkin, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: COLORS.playerHair, roughness: 0.6 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d2148, roughness: 0.8 });

    this.root = new THREE.Group();
    this.group.add(this.root);

    // 躯干
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.5), bodyMat);
    this.torso.position.y = 0.92;
    this.root.add(this.torso);

    // 头
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), skinMat);
    this.head.position.y = 1.58;
    this.root.add(this.head);

    // 头发（一抹蓝挑染）
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 1.64;
    hair.rotation.x = -0.25;
    this.root.add(hair);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6), hairMat);
    fin.position.set(0.62, 1.72, 0);
    fin.rotation.z = -R;
    this.root.add(fin);

    // 手臂（挂肩部，随奔跑摆动）
    this.armL = new THREE.Group();
    this.armL.position.set(0.42, 1.22, 0);
    const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.52, 4, 8), skinMat);
    armMesh.position.y = -0.3;
    this.armL.add(armMesh);
    this.root.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(-0.42, 1.22, 0);
    const armMesh2 = armMesh.clone();
    this.armR.add(armMesh2);
    this.root.add(this.armR);

    // 腿（挂髋部）
    const legGeo = new THREE.CapsuleGeometry(0.13, 0.52, 4, 8);
    this.legL = new THREE.Group();
    this.legL.position.set(0.2, 0.58, 0);
    const legMesh = new THREE.Mesh(legGeo, darkMat);
    legMesh.position.y = -0.32;
    this.legL.add(legMesh);
    this.root.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(-0.2, 0.58, 0);
    const legMesh2 = legMesh.clone();
    this.legR.add(legMesh2);
    this.root.add(this.legR);

    // 背包（呆萌小布丁挂件）
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.3), new THREE.MeshStandardMaterial({ color: 0xffb159, roughness: 0.9 }));
    bag.position.set(-0.48, 0.95, -0.05);
    this.root.add(bag);

    // 背光灯（速度越高越亮）
    this.dashGlow = new THREE.PointLight(0xff5ecf, 0, 8, 1.8);
    this.dashGlow.position.set(-0.7, 1.2, 0);
    this.root.add(this.dashGlow);

    // 发光眼镜边（特征位）
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244, emissiveIntensity: 0.8 });
    const glass = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.028, 8, 20), glassMat);
    glass.position.set(0.16, 1.6, 0.33);
    this.root.add(glass);
  }

  buildMount() {
    // 赛博滑板（坐骑）
    this.mountGroup = new THREE.Group();
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.12, 0.7),
      new THREE.MeshStandardMaterial({ color: COLORS.mount, emissive: 0x0c6273, emissiveIntensity: 1.2 }),
    );
    this.mountGroup.add(deck);
    const hover = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x0a2240, emissive: 0x46e0ff, emissiveIntensity: 1.6 }),
    );
    hover.rotation.z = Math.PI;
    hover.position.y = -0.3;
    this.mountGroup.add(hover);
    const hover2 = hover.clone();
    hover2.position.y = -0.3;
    hover2.position.x = 0;
    this.mountGroup.children[1] = hover2;
    this.mountGroup.visible = false;
    this.group.add(this.mountGroup);
  }

  buildPet() {
    // 小精灵宠物（金色小光团，绕玩家飞行）
    this.pet = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshStandardMaterial({ color: COLORS.pet, emissive: 0xffaa00, emissiveIntensity: 1.4 }),
    );
    this.pet.add(core);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffd76a, emissiveIntensity: 1, transparent: true, opacity: 0.85 });
    const wingL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 6), wingMat);
    wingL.rotation.z = R;
    wingL.position.x = -0.2;
    this.pet.add(wingL);
    const wingR = wingL.clone();
    wingR.rotation.z = -R;
    wingR.position.x = 0.2;
    this.pet.add(wingR);
    this.pet.userData.time = Math.random() * 4;
    this.group.add(this.pet);
  }

  buildShadow() {
    const circle = new THREE.CircleGeometry(0.5, 20);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
    this.shadow = new THREE.Mesh(circle, mat);
    this.shadow.rotation.x = -R;
    this.shadow.position.y = 0.02;
    this.group.add(this.shadow);
  }

  reset() {
    this.group.position.set(0, 0, 0);
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.airJumps = 0;
    this.crouching = false;
    this.crouchTime = 0;
    this.invincible = 0;
    this.shieldTimer = 0;
    this.magnetTimer = 0;
    this.dashTimer = 0;
    this.skillCharge = 0;
    this.skillReady = false;
    this.mounted = false;
    this.dead = false;
    this.runT = 0;
    this.animSpeed = 1;
  }

  get speedBonus() {
    return this.dashTimer > 0 ? CONFIG.dashSpeed : 0;
  }

  // 碰撞盒（半尺寸），按下蹲状态调整高度
  aabb() {
    const h = this.crouching ? CONFIG.slideHeight : CONFIG.standHeight;
    const p = this.group.position;
    return {
      minX: p.x - CONFIG.playerWidth / 2,
      maxX: p.x + CONFIG.playerWidth / 2,
      minY: p.y,
      maxY: p.y + h,
      minZ: -0.45,
      maxZ: 0.45,
    };
  }

  currentHeight() {
    return this.crouching ? CONFIG.slideHeight : CONFIG.standHeight;
  }

  /* ---------- 输入动作 ---------- */
  jump(ctx) {
    if (this.dead) return;
    // 骑乘拥有三段跳（空中 2 次），普通为二段跳（空中 1 次）
    const maxAir = this.mounted ? CONFIG.maxAirJumps : CONFIG.maxAirJumps - 1;
    if (this.grounded) {
      this.grounded = false;
      this.vy = CONFIG.jumpSpeed;
      this.airJumps = 0;
      ctx.events.jump();
      return { type: 'jump', stage: 1 };
    }
    if (this.airJumps < maxAir && this.vy < 18) {
      // 上升阶段也允许连跳（预输入友好）
      this.vy = this.airJumps === 0 ? CONFIG.doubleJumpSpeed : CONFIG.tripleJumpSpeed;
      this.airJumps++;
      this.crouching = false;
      ctx.events.airJump(this.airJumps + 1);
      return { type: 'jump', stage: this.airJumps + 1 };
    }
    return null;
  }

  slide(ctx) {
    if (this.dead) return;
    if (!this.grounded) {
      // 空中：俯冲
      if (this.vy > -1) this.vy = -CONFIG.diveSpeed;
      return { type: 'dive' };
    }
    this.crouching = true;
    this.crouchTime = CONFIG.slideDuration;
    ctx.events.slide();
    return { type: 'slide' };
  }

  endSlide() {
    this.crouching = false;
  }

  dash() {
    if (!this.skillReady) return false;
    this.skillReady = false;
    this.skillCharge = 0;
    this.dashTimer = CONFIG.dashDuration;
    this.invincible = Math.max(this.invincible, CONFIG.dashDuration);
    return true;
  }

  activateItem(kind) {
    if (kind === 'magnet') this.magnetTimer = CONFIG.magnetDuration;
    if (kind === 'shield') this.shieldTimer = CONFIG.shieldDuration;
    if (kind === 'dash') {
      this.dashTimer = CONFIG.dashDuration * 0.7;
      this.invincible = Math.max(this.invincible, this.dashTimer);
    }
    if (kind === 'mount') this.mounted = true;
  }

  gainSkill(n) {
    this.skillCharge += n;
    if (this.skillCharge >= CONFIG.dashChargeNeed && !this.skillReady) {
      this.skillReady = true;
    }
  }

  takeHit() {
    // 返回 true = 护盾挡下；false = 真受伤
    if (this.invincible > 0) return 'invincible';
    if (this.shieldTimer > 0) {
      this.shieldTimer = 0;
      this.invincible = Math.max(this.invincible, 1.2);
      return 'shielded';
    }
    if (this.mounted) {
      this.mounted = false;
      this.invincible = Math.max(this.invincible, CONFIG.invincibleAfterDamage);
      return 'lost-mount';
    }
    return 'hit';
  }

  kill() {
    this.dead = true;
  }

  revive() {
    this.dead = false;
    this.invincible = CONFIG.reviveInvincible;
    this.crouching = false;
    this.vy = 0;
  }

  /* ---------- 每帧 ---------- */
  update(dt, groundY, opts = {}) {
    const { speed = 0, levelPaused = false } = opts;
    if (this.dead) return { dying: true };

    const p = this.group.position;

    // 计时器
    this.invincible = Math.max(0, this.invincible - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    if (this.dashTimer <= 0) this.skillReady = this.skillCharge >= CONFIG.dashChargeNeed;

    // 物理
    if (groundY === null) {
      // 脚下无平台：转为下落，交给重力
      this.grounded = false;
      this.crouching = false;
    } else if (!this.grounded) {
      this.vy -= CONFIG.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.grounded = true;
        this.airJumps = 0;
        if (this.crouchTime > 0) this.endSlide();
      }
    } else {
      this.y = groundY;
      if (this.crouchTime > 0) {
        this.crouchTime -= dt;
        if (this.crouchTime <= 0) this.endSlide();
      }
    }
    p.y = this.y;

    // 动画
    this.animSpeed = speed;
    this.animate(dt);

    return {};
  }

  animate(dt) {
    const p = this.group.position;
    const t = performance.now() * 0.001;
    this.runT += dt * Math.max(6, this.animSpeed * 0.9);

    const flying = !this.grounded;
    const runFreq = 10 + this.animSpeed * 0.35;

    // 腿：跑步摆动 / 跳跃收腿
    const legSwing = Math.sin(this.runT * runFreq) * (flying ? 0.35 : 0.75);
    this.legL.rotation.x = flying ? 0.6 : legSwing;
    this.legR.rotation.x = flying ? 0.6 : -legSwing;

    // 手臂反相摆动；冲刺时后摆
    const armSwing = Math.sin(this.runT * runFreq + Math.PI) * (flying ? 0.25 : 0.6);
    this.armL.rotation.x = flying ? -0.6 : armSwing;
    this.armR.rotation.x = flying ? -0.6 : -armSwing;

    // 下蹲姿态
    const squat = this.crouching ? 0.42 : 0;
    this.root.scale.y = 1 - squat + (this.dashTimer > 0 ? 0.08 : 0);
    this.root.position.y = -0.14;

    // 骑乘姿态 + 滑板位置
    if (this.mounted) {
      this.mountGroup.visible = true;
      this.mountGroup.position.set(0, 0.12 + Math.sin(t * 9) * 0.06, 0);
      this.root.rotation.x = -0.08;
      this.root.scale.y = 0.78;
      this.legL.rotation.x = -1.1;
      this.legR.rotation.x = -1.1;
    } else {
      this.mountGroup.visible = false;
      this.root.rotation.x = this.crouching ? 0.15 : 0;
    }

    // 宠物绕飞
    const pet = this.pet;
    const pt = t * 2.6;
    pet.userData.time += dt * 2;
    pet.position.set(Math.sin(pt * 1.3) * 1.6, 1.35 + Math.sin(pt * 0.7 + 1) * 0.35, Math.cos(pt * 0.9) * 0.9);
    pet.rotation.y = pt * 2;
    const wingFlap = Math.sin(pet.userData.time * 14) * 0.6;
    pet.children[1].rotation.z = R + wingFlap;
    pet.children[2].rotation.z = -R - wingFlap;

    // 无敌盾牌光圈 + 闪烁
    const shieldRing = this.group.getObjectByName('shield-ring') || this.makeShieldRing();
    shieldRing.visible = this.shieldTimer > 0;
    if (shieldRing.visible) {
      shieldRing.rotation.z = t * 2;
      shieldRing.material.opacity = 0.5 + Math.sin(t * 8) * 0.2;
    }

    // 受击无敌闪烁
    if (this.invincible > 0 && this.dashTimer <= 0) {
      this.root.visible = Math.floor(t * 14) % 2 === 0;
    } else {
      this.root.visible = true;
    }

    // 冲刺辉光
    const glow = this.dashTimer > 0 ? 6 : 0;
    this.dashGlow.intensity = glow + (this.dashTimer > 0 ? Math.sin(t * 30) * 2 : 0);
    this.dashGlow.color.setHex(this.dashTimer > 0 ? 0x46e0ff : 0xff5ecf);

    // 假阴影跟着离地远近变淡变小
    const airH = Math.max(0, this.y);
    this.shadow.position.y = 0.02;
    const sh = Math.max(0.45, 1 - airH * 0.12);
    this.shadow.scale.set(sh, sh, 1);
    this.shadow.material.opacity = Math.max(0.08, 0.32 - airH * 0.05);

    // 磁铁可视反馈：宠物与金币方向牵引光
    this.pet.children[0].material.emissiveIntensity = this.magnetTimer > 0 ? 2.4 : 1.4;
  }

  makeShieldRing() {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.06, 8, 40),
      new THREE.MeshStandardMaterial({
        color: COLORS.shieldItem,
        emissive: COLORS.shieldItem,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );
    ring.name = 'shield-ring';
    ring.rotation.x = R;
    ring.position.y = 0.9;
    this.group.add(ring);
    return ring;
  }

  setWorldX(x) {
    this.group.position.x = x;
  }
}
