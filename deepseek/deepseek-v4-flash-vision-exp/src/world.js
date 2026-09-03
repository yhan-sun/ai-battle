// 环境系统：灯光、天空、多层程序化视差背景（远山/城市/云/星）
import * as THREE from 'three';
import { COLORS } from './config.js';

const SPAN = 260; // 视差无缝循环跨度
const WRAP_KEY = `--wrap-${Math.random()}`;

function setWrap(group, camX, coef, span = SPAN) {
  group.position.x = -((camX * coef) % span);
  group.userData.wrapKey = WRAP_KEY;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.build();
  }

  build() {
    this.scene.fog = new THREE.Fog(0x0d1440, 42, 170);

    const hemi = new THREE.HemisphereLight(0x9fb6ff, 0x1a1440, 1.1);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xfff2e0, 1.5);
    dir.position.set(-6, 14, -8);
    this.scene.add(dir);

    // 霓虹点光跟随玩家（前景氛围光）
    this.neon = new THREE.PointLight(COLORS.mount, 22, 26, 1.6);
    this.neon.position.set(0, 4, 3);
    this.scene.add(this.neon);

    this.stars = this.makeStars();
    this.layerFar = this.makeMountains();
    this.layerMid = this.makeCity();
    this.layerNear = this.makeClouds();
    this.layerDecor = this.makeSideGlow();

    this.parts.push(this.stars, this.layerFar, this.layerMid, this.layerNear, this.layerDecor);
  }

  makeStars() {
    const g = new THREE.BufferGeometry();
    const count = 120;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SPAN * 0.6;
      pos[i * 3 + 1] = 10 + Math.random() * 40;
      pos[i * 3 + 2] = -95 - Math.random() * 30;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0xbdd6ff,
      size: 0.9,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      fog: false,
    });
    const p = new THREE.Points(g, m);
    this.scene.add(p);
    return p;
  }

  makeMountains() {
    const group = new THREE.Group();
    const geo = new THREE.ConeGeometry(1, 1, 4);
    const matA = new THREE.MeshBasicMaterial({ color: 0x1c2a66 });
    const matB = new THREE.MeshBasicMaterial({ color: 0x22346e });
    for (let i = 0; i < 9; i++) {
      const h = 14 + Math.random() * 26;
      const w = (10 + Math.random() * 14) * 0.5;
      const c = new THREE.Mesh(geo, i % 2 ? matA : matB);
      c.scale.set(w * 2, h, w * 2);
      c.position.set(i * (SPAN / 9), h * 0.5 - 2, -46 - Math.random() * 10);
      c.rotation.y = Math.random() * Math.PI;
      group.add(c);
    }
    this.scene.add(group);
    return group;
  }

  makeCity() {
    const group = new THREE.Group();
    const mats = [0x25307a, 0x1b2158, 0x2d3f8f].map((c) => new THREE.MeshBasicMaterial({ color: c }));
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 14; i++) {
      const h = 7 + Math.random() * 20;
      const w = 3.4 + Math.random() * 5;
      const b = new THREE.Mesh(box, mats[i % 3]);
      b.scale.set(w, h, 4);
      b.position.set(i * (SPAN / 14), h * 0.5 - 1.2, -24);
      group.add(b);
      // 窗户小亮块
      const win = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x46e0ff : 0xffd23e }));
      win.scale.set(Math.max(0.5, w * 0.12), h * 0.55, 0.3);
      win.position.set(i * (SPAN / 14), h * 0.55 - 1.2, -21.8);
      group.add(win);
    }
    this.scene.add(group);
    return group;
  }

  makeClouds() {
    const group = new THREE.Group();
    const mat = new THREE.SpriteMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(mat.clone());
      const w = 9 + Math.random() * 14;
      s.scale.set(w, w * 0.36, 1);
      s.position.set(i * (SPAN / 10) + (Math.random() - 0.5) * 12, 8 + Math.random() * 16, -32 - Math.random() * 18);
      group.add(s);
    }
    this.scene.add(group);
    return group;
  }

  // 路边霓虹光柱，增强速度感
  makeSideGlow() {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.28, 5.4, 0.28);
    const mats = [new THREE.MeshBasicMaterial({ color: 0xff5ecf }), new THREE.MeshBasicMaterial({ color: 0x46e0ff })];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(geo, i % 2 ? mats[0] : mats[1]);
      m.position.set(i * (SPAN / 16), 2.4, 3.6);
      group.add(m);
    }
    this.scene.add(group);
    return group;
  }

  update(camX, dt) {
    setWrap(this.stars, camX, 0.04);
    setWrap(this.layerFar, camX, 0.12);
    setWrap(this.layerMid, camX, 0.26);
    setWrap(this.layerNear, camX, 0.5);
    setWrap(this.layerDecor, camX, 0.4);
    // 云缓慢水平漂动
    const drift = Math.sin(performance.now() * 0.0004) * 0.4;
    for (let i = 0; i < this.layerNear.children.length; i++) {
      const child = this.layerNear.children[i];
      child.position.y += Math.sin(performance.now() * 0.0003 + i) * dt * 0.25;
      child.position.x += drift * dt * 0.3;
    }
  }

  setNeon(pos) {
    if (this.neon) this.neon.position.set(pos.x, 4.5, 3);
  }

  // 奖励关环境切换：远景可见性 + 空气色
  setMode(mode) {
    const { scene } = this;
    switch (mode) {
      case 'super':
        scene.fog.color.setHex(0x123a6e);
        scene.fog.near = 60;
        scene.fog.far = 220;
        break;
      case 'warp':
        scene.fog.color.setHex(0x1a071e);
        scene.fog.near = 20;
        scene.fog.far = 110;
        break;
      case 'menu':
      case 'main':
      default:
        scene.fog.color.setHex(0x0d1440);
        scene.fog.near = 42;
        scene.fog.far = 170;
        break;
    }
  }
}
