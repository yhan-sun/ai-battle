import * as THREE from 'three';
import { CONFIG, findMount, findPet } from './config.js';
import { clamp, damp } from './utils.js';

/**
 * 玩家角色�? * - 低多边形几何体拼装的跑�?+ 悬浮坐骑 + 浮游宠物�? * - 负责跳跃 / 二段�?/ 下蹲 / 冲刺姿�?/ 死亡翻滚等物理与动画�? * - 碰撞盒高度随下蹲变化，供 Game �?AABB 判定�? */
export class Player {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;

    this.root = new THREE.Group();
    this.root.position.set(0, 0, 0);
    scene.add(this.root);

    this.rig = new THREE.Group();
    this.rig.position.y = 0.1;
    this.root.add(this.rig);

    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.jumps = 0;
    this.coyote = 0;
    this.crouchHeld = false;
    this.crouchAmount = 0;
    this.dead = false;
    this.deathTime = 0;
    this.runPhase = 0;
    this.time = 0;
    this.dashing = false;
    this.invincible = false;
    this.justLanded = false;
    this.fell = false;

    this.mountData = findMount('board');
    this.petData = findPet('fox');
    this.mountGroup = null;
    this.petGroup = null;
    this.petPhase = Math.random() * Math.PI * 2;

    this.materials = {
      suit: new THREE.MeshStandardMaterial({ color: 0x2b3158, roughness: 0.5, metalness: 0.3 }),
      suitLight: new THREE.MeshStandardMaterial({
        color: 0x8defff,
        emissive: 0x1f8fa8,
        emissiveIntensity: 0.8,
        roughness: 0.32,
        metalness: 0.35,
      }),
      accent: new THREE.MeshStandardMaterial({
        color: 0xff5cae,
        emissive: 0xa11a62,
        emissiveIntensity: 0.7,
        roughness: 0.4,
      }),
      skin: new THREE.MeshStandardMaterial({ color: 0xffcfae, roughness: 0.68 }),
      hair: new THREE.MeshStandardMaterial({ color: 0x17122c, roughness: 0.55 }),
      boot: new THREE.MeshStandardMaterial({ color: 0x101329, roughness: 0.45, metalness: 0.4 }),
      visor: new THREE.MeshStandardMaterial({
        color: 0x9ffcff,
        emissive: 0x37e8ff,
        emissiveIntensity: 1.8,
        roughness: 0.2,
        metalness: 0.2,
      }),
      jet: new THREE.MeshBasicMaterial({ color: 0x63f4ff, transparent: true, opacity: 0.7 }),
    };

    this.buildCharacter();
    this.buildMount();
    this.buildPet();
    this.buildShield();
    this.buildShadow();
  }

  // ------------------------------------------------------------------
  // 构建
  // ------------------------------------------------------------------

  buildCharacter() {
    const geo = this.assets.geo;
    const mat = this.materials;

    this.body = new THREE.Group();
    this.rig.add(this.body);

    const torso = new THREE.Mesh(geo.sphere, mat.suit);
    torso.position.set(0, 1.04, 0);
    torso.scale.set(0.3, 0.38, 0.24);
    this.body.add(torso);

    const chest = new THREE.Mesh(geo.box, mat.suitLight);
    chest.position.set(0, 1.12, 0.2);
    chest.scale.set(0.26, 0.1, 0.06);
    this.body.add(chest);

    const belt = new THREE.Mesh(geo.box, mat.accent);
    belt.position.set(0, 0.82, 0.02);
    belt.scale.set(0.36, 0.08, 0.28);
    this.body.add(belt);

    const backpack = new THREE.Mesh(geo.box, mat.boot);
    backpack.position.set(0, 1.06, -0.24);
    backpack.scale.set(0.3, 0.36, 0.16);
    this.body.add(backpack);

    const thrusterL = new THREE.Mesh(geo.cylinder, mat.jet);
    thrusterL.position.set(-0.13, 0.88, -0.31);
    thrusterL.scale.set(0.045, 0.2, 0.045);
    this.body.add(thrusterL);
    const thrusterR = thrusterL.clone();
    thrusterR.position.x = 0.13;
    this.body.add(thrusterR);
    this.thrusters = [thrusterL, thrusterR];

    this.head = new THREE.Group();
    this.head.position.set(0, 1.48, 0);
    this.body.add(this.head);

    const skull = new THREE.Mesh(geo.sphere, mat.skin);
    skull.scale.set(0.245, 0.255, 0.235);
    this.head.add(skull);

    const hair = new THREE.Mesh(geo.sphere, mat.hair);
    hair.position.set(0, 0.07, -0.035);
    hair.scale.set(0.255, 0.19, 0.25);
    this.head.add(hair);

    const visor = new THREE.Mesh(geo.box, mat.visor);
    visor.position.set(0, 0.015, 0.225);
    visor.scale.set(0.34, 0.095, 0.06);
    this.head.add(visor);

    const earL = new THREE.Mesh(geo.cone, mat.hair);
    earL.position.set(-0.18, 0.16, 0);
    earL.rotation.z = 0.5;
    earL.scale.set(0.07, 0.16, 0.07);
    this.head.add(earL);
    const earR = earL.clone();
    earR.position.x = 0.18;
    earR.rotation.z = -0.5;
    this.head.add(earR);

    this.scarf = new THREE.Group();
    this.scarf.position.set(0, 1.3, -0.12);
    this.body.add(this.scarf);
    for (let i = 0; i < 2; i += 1) {
      const piece = new THREE.Mesh(geo.box, mat.accent);
      piece.position.set(0, -i * 0.12, -0.14 - i * 0.16);
      piece.scale.set(0.18 - i * 0.03, 0.07, 0.3);
      piece.rotation.x = -0.2 - i * 0.08;
      this.scarf.add(piece);
    }

    this.armL = this.buildLimb(0.075, 0.34, mat.suit, -0.33, 1.24);
    this.armR = this.buildLimb(0.075, 0.34, mat.suit, 0.33, 1.24);
    this.legL = this.buildLimb(0.1, 0.52, mat.suit, -0.145, 0.55);
    this.legR = this.buildLimb(0.1, 0.52, mat.suit, 0.145, 0.55);

    // 手臂末端的手�?/ 腿末端靴�?    this.handL = this.addLimbTip(this.armL, mat.skin, 0.075);
    this.handR = this.addLimbTip(this.armR, mat.skin, 0.075);
    this.bootL = this.addLimbTip(this.legL, mat.boot, 0.12, 0.1);
    this.bootR = this.addLimbTip(this.legR, mat.boot, 0.12, 0.1);
    this.bootL.position.y = -0.47;
    this.bootR.position.y = -0.47;

    this.body.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
  }

  buildLimb(radius, length, material, x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(this.assets.geo.sphere, material);
    mesh.scale.set(radius, length / 2 + radius * 0.5, radius);
    mesh.position.y = -length / 2;
    pivot.add(mesh);
    this.body.add(pivot);
    return pivot;
  }

  addLimbTip(pivot, material, size, height = size) {
    const tip = new THREE.Mesh(this.assets.geo.sphereLow, material);
    tip.scale.set(size, height, size * 1.25);
    tip.position.y = -0.42;
    tip.position.z = 0.02;
    pivot.add(tip);
    return tip;
  }

  buildMount() {
    if (this.mountGroup) {
      this.root.remove(this.mountGroup);
    }
    const group = new THREE.Group();
    const mount = this.mountData;
    const deckMat = new THREE.MeshStandardMaterial({
      color: mount.boardColor,
      emissive: mount.boardColor,
      emissiveIntensity: 0.32,
      metalness: 0.75,
      roughness: 0.28,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x14112b, metalness: 0.7, roughness: 0.4 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: mount.accentColor,
      emissive: mount.accentColor,
      emissiveIntensity: 0.9,
      roughness: 0.35,
    });

    const deck = new THREE.Mesh(this.assets.geo.box, deckMat);
    deck.position.set(0, 0.02, 0);
    deck.scale.set(1.05, 0.075, 0.46);
    group.add(deck);

    const nose = new THREE.Mesh(this.assets.geo.coneLow, accentMat);
    nose.position.set(0.62, 0.03, 0);
    nose.rotation.z = -Math.PI / 2;
    nose.scale.set(0.2, 0.26, 0.18);
    group.add(nose);

    const tail = new THREE.Mesh(this.assets.geo.box, darkMat);
    tail.position.set(-0.56, 0.04, 0);
    tail.scale.set(0.18, 0.12, 0.34);
    group.add(tail);

    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(this.assets.geo.box, accentMat);
      fin.position.set(-0.2, -0.02, side * 0.28);
      fin.rotation.x = side * 0.32;
      fin.scale.set(0.5, 0.035, 0.16);
      group.add(fin);
    }

    const glow = new THREE.Mesh(
      this.assets.geo.plane,
      new THREE.MeshBasicMaterial({
        color: mount.boardColor,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, -0.055, 0);
    glow.scale.set(1.5, 0.8, 1);
    group.add(glow);
    this.mountGlow = glow;

    this.mountGroup = group;
    this.root.add(group);
  }

  buildPet() {
    if (this.petGroup) {
      this.root.remove(this.petGroup);
    }
    this.petTail = null;
    this.petWingL = null;
    this.petWingR = null;
    const group = new THREE.Group();
    group.position.set(-0.72, 1.55, -0.18);

    const pet = this.petData;
    if (pet.id === 'fox') {
      const fur = new THREE.MeshStandardMaterial({
        color: 0xff9a5c,
        emissive: 0x6b2b00,
        emissiveIntensity: 0.35,
        roughness: 0.6,
      });
      const cream = new THREE.MeshStandardMaterial({ color: 0xfff0dc, roughness: 0.7 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x1a1024, roughness: 0.5 });

      const body = new THREE.Mesh(this.assets.geo.sphere, fur);
      body.scale.set(0.19, 0.2, 0.17);
      group.add(body);

      const head = new THREE.Mesh(this.assets.geo.sphere, fur);
      head.position.set(0.13, 0.1, 0.08);
      head.scale.set(0.145, 0.14, 0.135);
      group.add(head);

      const muzzle = new THREE.Mesh(this.assets.geo.sphere, cream);
      muzzle.position.set(0.24, 0.06, 0.13);
      muzzle.scale.set(0.075, 0.06, 0.075);
      group.add(muzzle);

      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(this.assets.geo.cone, fur);
        ear.position.set(0.11, 0.24, 0.08);
        ear.position.x += side * 0.055;
        ear.scale.set(0.045, 0.14, 0.045);
        ear.rotation.z = side * 0.24;
        group.add(ear);

        const eye = new THREE.Mesh(this.assets.geo.sphereLow, dark);
        eye.position.set(0.25, 0.12, 0.14 + side * 0.035);
        eye.scale.set(0.018, 0.026, 0.018);
        group.add(eye);
      }

      const tail = new THREE.Mesh(this.assets.geo.cone, fur);
      tail.position.set(-0.22, 0.02, -0.02);
      tail.rotation.z = Math.PI / 2.4;
      tail.scale.set(0.085, 0.42, 0.085);
      group.add(tail);

      const tailTip = new THREE.Mesh(this.assets.geo.sphereLow, cream);
      tailTip.position.set(-0.36, 0.14, -0.02);
      tailTip.scale.set(0.075, 0.075, 0.075);
      group.add(tailTip);

      this.petTail = tail;
    } else {
      const shell = new THREE.MeshStandardMaterial({
        color: 0xffd257,
        emissive: 0xa87400,
        emissiveIntensity: 0.5,
        roughness: 0.4,
      });
      const stripe = new THREE.MeshStandardMaterial({ color: 0x24162e, roughness: 0.45 });
      const wing = new THREE.MeshBasicMaterial({
        color: 0xc9f9ff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const dark = new THREE.MeshStandardMaterial({ color: 0x120c1c, roughness: 0.4 });

      const body = new THREE.Mesh(this.assets.geo.sphere, shell);
      body.scale.set(0.15, 0.18, 0.15);
      group.add(body);

      for (const y of [-0.06, 0.04]) {
        const band = new THREE.Mesh(this.assets.geo.torus, stripe);
        band.position.y = y;
        band.scale.set(0.155, 0.155, 0.11);
        band.rotation.x = Math.PI / 2;
        group.add(band);
      }

      const head = new THREE.Mesh(this.assets.geo.sphere, shell);
      head.position.set(0, 0.18, 0.02);
      head.scale.set(0.11, 0.1, 0.105);
      group.add(head);

      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(this.assets.geo.sphereLow, dark);
        eye.position.set(side * 0.045, 0.19, 0.1);
        eye.scale.set(0.022, 0.03, 0.02);
        group.add(eye);
        const wingMesh = new THREE.Mesh(this.assets.geo.plane, wing);
        wingMesh.position.set(side * 0.14, 0.08, -0.02);
        wingMesh.rotation.set(0.2, side * 0.7, side * 0.5);
        wingMesh.scale.set(0.22, 0.14, 1);
        group.add(wingMesh);
        if (side === -1) this.petWingL = wingMesh;
        else this.petWingR = wingMesh;
      }
      this.petTail = null;
    }

    group.add(
      new THREE.Mesh(
        this.assets.geo.sphereLow,
        new THREE.MeshBasicMaterial({
          color: pet.id === 'fox' ? 0xff8a5c : 0xffd257,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    ).scale.set(0.36, 0.36, 0.36);

    this.petGroup = group;
    this.root.add(group);
  }

  buildShield() {
    const group = new THREE.Group();
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0x63f4ff,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    bubble.scale.set(1.0, 1.1, 1.0);
    group.add(bubble);

    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xbafaff,
        wireframe: true,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    );
    wire.scale.set(1.02, 1.12, 1.02);
    group.add(wire);

    group.position.set(0, 0.95, 0);
    group.visible = false;
    this.shieldGroup = group;
    this.root.add(group);
  }

  buildShadow() {
    const material = new THREE.MeshBasicMaterial({
      color: 0x02020a,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.52, 24), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.03;
    mesh.renderOrder = 1;
    this.scene.add(mesh);
    this.shadow = mesh;
  }

  // ------------------------------------------------------------------
  // 装载 / 重置
  // ------------------------------------------------------------------

  setLoadout(mountId, petId) {
    const mount = findMount(mountId);
    const pet = findPet(petId);
    const mountChanged = mount.id !== this.mountData.id;
    const petChanged = pet.id !== this.petData.id;
    this.mountData = mount;
    this.petData = pet;
    if (mountChanged || !this.mountGroup) this.buildMount();
    if (petChanged || !this.petGroup) this.buildPet();
  }

  reset() {
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.jumps = 0;
    this.coyote = CONFIG.player.coyote;
    this.crouchHeld = false;
    this.crouchAmount = 0;
    this.dead = false;
    this.deathTime = 0;
    this.runPhase = 0;
    this.dashing = false;
    this.invincible = false;
    this.justLanded = false;
    this.fell = false;
    this.rig.rotation.set(0, 0, 0);
    this.rig.scale.set(1, 1, 1);
    this.rig.position.set(0, 0.1, 0);
    this.rig.visible = true;
    this.root.rotation.set(0, 0, 0);
    this.root.position.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.shieldGroup.visible = false;
    this.shadow.visible = true;
    if (this.mountGroup) this.mountGroup.visible = true;
    if (this.petGroup) this.petGroup.visible = true;
    this.petPhase = 0;
  }

  setShield(active) {
    this.shieldGroup.visible = active;
  }

  setInvincible(active) {
    this.invincible = active;
  }

  setDashing(active) {
    this.dashing = active;
  }

  // ------------------------------------------------------------------
  // 操作
  // ------------------------------------------------------------------

  requestJump() {
    if (this.dead) return false;
    const jumpFactor = this.mountData.jump;
    if (this.grounded || this.coyote > 0) {
      this.vy = CONFIG.player.jumpSpeed * jumpFactor;
      this.grounded = false;
      this.coyote = 0;
      this.jumps = 1;
      return 'jump';
    }
    if (this.jumps < 2) {
      this.vy = CONFIG.player.doubleJumpSpeed * jumpFactor;
      this.jumps = 2;
      return 'double';
    }
    return false;
  }

  bounce() {
    this.vy = 11.6;
    this.grounded = false;
    this.coyote = 0;
    this.jumps = 1;
  }

  setCrouch(value) {
    this.crouchHeld = Boolean(value);
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathTime = 0;
    this.vy = 5.2;
    this.grounded = false;
    this.crouchHeld = false;
    this.setShield(false);
    this.dashing = false;
  }

  reviveVisual() {
    this.dead = false;
    this.deathTime = 0;
    this.y = 1.8;
    this.vy = 0;
    this.grounded = false;
    this.jumps = 1;
    this.rig.rotation.set(0, 0, 0);
    this.rig.scale.set(1, 1, 1);
    this.rig.visible = true;
    this.root.rotation.set(0, 0, 0);
    this.shieldGroup.visible = true;
    this.shadow.visible = true;
  }

  // ------------------------------------------------------------------
  // 更新
  // ------------------------------------------------------------------

  update(dt, speed, floorUnder) {
    this.time += dt;
    this.justLanded = false;

    if (this.dead) {
      this.updateDeath(dt);
      this.updatePet(dt);
      this.shieldGroup.visible = false;
      this.shadow.material.opacity = 0.18;
      this.shadow.visible = floorUnder;
      this.shadow.scale.setScalar(1);
      this.rig.visible = true;
      return;
    }

    const wasGrounded = this.grounded;
    this.grounded = false;

    let gravity = CONFIG.player.gravity;
    if (this.crouchHeld && !wasGrounded) gravity += CONFIG.player.crouchFallBoost;

    this.vy -= gravity * dt;
    this.vy = Math.max(this.vy, -46);
    this.y += this.vy * dt;

    if (this.y <= 0) {
      if (floorUnder) {
        if (!wasGrounded && this.vy < -6.5) {
          this.justLanded = true;
        }
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.jumps = 0;
        this.coyote = CONFIG.player.coyote;
      } else if (this.y < CONFIG.player.fallDeathY) {
        this.fell = true;
      }
    }

    if (!this.grounded) {
      this.coyote = Math.max(0, this.coyote - dt);
    }

    this.updateVisual(dt, speed, floorUnder);
  }

  updateDeath(dt) {
    this.deathTime += dt;
    this.vy -= 30 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y === 0) this.vy = 0;
    this.rig.rotation.z = Math.min(1.45, this.deathTime * 3.2);
    this.rig.rotation.x = Math.min(0.7, this.deathTime * 1.4);
    this.root.position.y = this.y;
    this.shadow.material.opacity = 0.2;
  }

  updateVisual(dt, speed, floorUnder) {
    const airborne = !this.grounded;
    const crouchTarget = this.crouchHeld ? 1 : 0;
    this.crouchAmount = damp(this.crouchAmount, crouchTarget, 16, dt);

    const runRate = this.grounded ? 5.5 + speed * 0.55 : 3.2;
    this.runPhase += dt * runRate;

    const squash = 1 - this.crouchAmount * 0.42;
    const lean = this.crouchAmount * 0.3 + (this.dashing ? 0.42 : 0) + (airborne ? clamp(-this.vy * 0.008, -0.08, 0.12) : 0);
    this.rig.scale.set(1 + this.crouchAmount * 0.1, squash, 1);
    this.rig.rotation.x = damp(this.rig.rotation.x, lean, 12, dt);
    this.rig.rotation.z = damp(this.rig.rotation.z, 0, 10, dt);

    const swing = Math.sin(this.runPhase);
    const swing2 = Math.sin(this.runPhase + Math.PI);

    if (this.grounded && !this.crouchHeld && !this.dashing) {
      const amplitude = 0.65 + Math.min(0.4, speed * 0.012);
      this.legL.rotation.x = swing * amplitude;
      this.legR.rotation.x = swing2 * amplitude;
      this.armL.rotation.x = swing2 * amplitude * 0.7;
      this.armR.rotation.x = swing * amplitude * 0.7;
      this.armL.rotation.z = 0.12;
      this.armR.rotation.z = -0.12;
      this.head.rotation.x = 0;
    } else if (this.crouchHeld) {
      this.legL.rotation.x = 1.15;
      this.legR.rotation.x = 0.65;
      this.armL.rotation.x = -1.0;
      this.armR.rotation.x = -0.75;
      this.armL.rotation.z = 0.34;
      this.armR.rotation.z = -0.34;
      this.head.rotation.x = -0.18;
    } else if (this.dashing) {
      this.legL.rotation.x = -0.9;
      this.legR.rotation.x = 0.4;
      this.armL.rotation.x = 1.3;
      this.armR.rotation.x = 1.1;
      this.head.rotation.x = 0.12;
    } else if (airborne) {
      const rising = this.vy > 0;
      this.legL.rotation.x = rising ? 0.9 : 0.2;
      this.legR.rotation.x = rising ? -0.45 : -0.15;
      this.armL.rotation.x = rising ? -1.5 : -0.7;
      this.armR.rotation.x = rising ? -1.2 : -0.5;
      this.armL.rotation.z = 0.32;
      this.armR.rotation.z = -0.32;
    }

    const bob = this.grounded ? Math.abs(Math.sin(this.runPhase)) * 0.045 : 0;
    this.root.position.y = this.dead ? this.y : this.y + bob;
    this.root.position.x = 0;

    // 围巾随速度飘动
    this.scarf.rotation.x = -0.25 - Math.sin(this.time * 8) * 0.08 + Math.min(0.3, speed * 0.008);
    this.scarf.rotation.z = Math.sin(this.time * 6.4) * 0.1;
    this.scarf.children.forEach((piece, index) => {
      piece.rotation.y = Math.sin(this.time * 7 + index) * 0.12;
    });

    // 推进器亮度随速度
    const jetOpacity = 0.45 + Math.min(0.5, speed * 0.014) + (this.dashing ? 0.3 : 0);
    this.materials.jet.opacity = jetOpacity;
    for (const thruster of this.thrusters) {
      thruster.scale.y = 0.14 + Math.min(0.24, speed * 0.006) + (this.dashing ? 0.16 : 0);
    }

    if (this.mountGlow) {
      this.mountGlow.material.opacity = 0.24 + Math.sin(this.time * 7) * 0.06 + (this.dashing ? 0.2 : 0);
    }
    if (this.mountGroup) {
      this.mountGroup.position.y = 0.03 + (this.grounded ? Math.sin(this.time * 4) * 0.012 : 0);
      this.mountGroup.rotation.z = damp(this.mountGroup.rotation.z, this.crouchAmount * -0.1, 8, dt);
    }

    this.updatePet(dt);
    this.updateShield(dt);

    // 无敌闪烁
    if (this.invincible && !this.dead) {
      this.rig.visible = Math.floor(this.time * 18) % 2 === 0;
    } else {
      this.rig.visible = true;
    }

    // 影子
    const shadowScale = clamp(1 - this.y * 0.11, 0.42, 1);
    this.shadow.scale.setScalar(shadowScale);
    this.shadow.material.opacity = floorUnder ? clamp(0.36 - this.y * 0.045, 0.06, 0.36) : 0;
    this.shadow.visible = floorUnder && !this.dead;
  }

  updatePet(dt) {
    if (!this.petGroup) return;
    this.petPhase += dt * 3.4;
    const float = Math.sin(this.petPhase) * 0.07;
    this.petGroup.position.set(-0.74, 1.52 + float, -0.2);
    this.petGroup.rotation.z = Math.sin(this.petPhase * 0.8) * 0.08;
    this.petGroup.rotation.y = Math.sin(this.petPhase * 0.55) * 0.22;
    if (this.petTail) {
      this.petTail.rotation.z = Math.PI / 2.4 + Math.sin(this.petPhase * 1.6) * 0.16;
    }
    if (this.petWingL && this.petWingR) {
      const flap = Math.sin(this.petPhase * 8) * 0.5;
      this.petWingL.rotation.z = 0.5 + flap;
      this.petWingR.rotation.z = -0.5 - flap;
    }
  }

  updateShield(dt) {
    if (!this.shieldGroup.visible) return;
    this.shieldGroup.rotation.y += dt * 0.7;
    this.shieldGroup.rotation.x = Math.sin(this.time * 1.4) * 0.12;
    this.shieldGroup.position.y = this.crouchHeld ? 0.62 : 0.95;
  }

  updateIdle(dt) {
    this.time += dt;
    this.runPhase += dt * 1.2;
    const breath = Math.sin(this.time * 1.6) * 0.018;
    this.rig.scale.set(1, 1 + breath, 1);
    this.rig.rotation.x = damp(this.rig.rotation.x, 0, 6, dt);
    this.rig.rotation.z = damp(this.rig.rotation.z, 0, 6, dt);
    this.armL.rotation.x = damp(this.armL.rotation.x, Math.sin(this.time * 1.3) * 0.06, 5, dt);
    this.armR.rotation.x = damp(this.armR.rotation.x, Math.sin(this.time * 1.3 + 1) * 0.06, 5, dt);
    this.legL.rotation.x = damp(this.legL.rotation.x, 0, 5, dt);
    this.legR.rotation.x = damp(this.legR.rotation.x, 0, 5, dt);
    this.root.position.y = Math.sin(this.time * 1.5) * 0.012;
    this.materials.jet.opacity = 0.35 + Math.sin(this.time * 3) * 0.08;
    this.updatePet(dt);
    this.updateShield(dt);
    if (this.mountGroup) this.mountGroup.position.y = 0.03 + Math.sin(this.time * 2.2) * 0.02;

    this.shadow.material.opacity = 0.28;
    this.shadow.scale.setScalar(1);
    this.shadow.visible = true;
    this.rig.visible = true;
  }

  // ------------------------------------------------------------------
  // 碰撞信息
  // ------------------------------------------------------------------

  getHeight() {
    return this.crouchHeld ? CONFIG.player.crouchHeight : CONFIG.player.height;
  }

  getBox() {
    const height = this.getHeight();
    return {
      left: -CONFIG.player.width / 2,
      right: CONFIG.player.width / 2,
      bottom: this.y,
      top: this.y + height,
      height,
    };
  }

  getCenterY() {
    return this.y + this.getHeight() * 0.52;
  }
}
