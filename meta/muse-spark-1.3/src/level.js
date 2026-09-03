import * as THREE from 'three';

// 无限程序化关卡:地形分块生成 + 对象池 + 主题场景 + 奖励金币阵列
// 地形: plains(平原) sky(天空浮岛) cave(地下洞窟)
// 奖励: golden(超级奖励) tunnel(穿越奖励) 由Game切换,Level负责换肤+刷币阵

const GEO = {};
const MAT = {};
function shared() {
  if (GEO.ground) return;
  GEO.ground = new THREE.BoxGeometry(1, 1, 6);
  GEO.spike = new THREE.ConeGeometry(0.35, 1.0, 5);
  GEO.block = new THREE.BoxGeometry(1, 1, 2.2);
  GEO.coin = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 10);
  GEO.orb = new THREE.SphereGeometry(0.3, 10, 8);
  GEO.monBody = new THREE.BoxGeometry(0.9, 0.7, 0.9);
  GEO.portal = new THREE.BoxGeometry(0.6, 2.6, 2.0);
  GEO.pick = new THREE.OctahedronGeometry(0.35);
  MAT.ground = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
  MAT.groundTop = new THREE.MeshLambertMaterial({ color: 0x7bdc6b });
  MAT.caveGround = new THREE.MeshLambertMaterial({ color: 0x5a4a6b });
  MAT.skyGround = new THREE.MeshLambertMaterial({ color: 0x8fd3ff });
  MAT.goldGround = new THREE.MeshLambertMaterial({ color: 0xd8a400, emissive: 0x552f00, emissiveIntensity: 0.4 });
  MAT.tunnelGround = new THREE.MeshLambertMaterial({ color: 0x1a2a6e, emissive: 0x0a1a55, emissiveIntensity: 0.6 });
  MAT.spike = new THREE.MeshLambertMaterial({ color: 0x27324a });
  MAT.spikeTip = new THREE.MeshBasicMaterial({ color: 0xff4d6d });
  MAT.block = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  MAT.blockDark = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
  MAT.coin = new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0x7a5200, emissiveIntensity: 0.7 });
  MAT.mon = new THREE.MeshLambertMaterial({ color: 0x9b4dff });
  MAT.monEye = new THREE.MeshBasicMaterial({ color: 0xffffff });
  MAT.portal = new THREE.MeshBasicMaterial({ color: 0x37e6ff, transparent: true, opacity: 0.85 });
  MAT.magnet = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
  MAT.shield = new THREE.MeshBasicMaterial({ color: 0x37e6ff });
  MAT.sprint = new THREE.MeshBasicMaterial({ color: 0xff9a2a });
  MAT.mount = new THREE.MeshBasicMaterial({ color: 0xffd94d });
  MAT.star = new THREE.MeshBasicMaterial({ color: 0xfff6a0 });
}

export class Level {
  constructor(scene) {
    shared();
    this.scene = scene;
    this.grounds = [];   // {mesh,top,x1,x2,theme}
    this.obstacles = []; // {kind,mesh/group,x,y,w,h,active,extra}
    this.coins = [];     // {mesh,x,y,active,taken,vx?}
    this.picks = [];     // {kind,mesh,x,y,active}
    this.portals = [];   // {mesh,x,y,active}
    this.nextX = 0;
    this.theme = 'plains';
    this.baseTheme = 'plains';
    this.chunkCount = 0;
    this.difficulty = 0;
    this.coinSpin = 0;
    this.buildScenery();
  }

  // ---------- 场景/视差背景 ----------
  buildScenery() {
    this.scenery = new THREE.Group();
    this.scene.add(this.scenery);
    // 远山
    this.mountains = [];
    const mGeo = new THREE.ConeGeometry(6, 9, 5);
    const mMat = new THREE.MeshLambertMaterial({ color: 0x3a4a8a });
    const mMat2 = new THREE.MeshLambertMaterial({ color: 0x4a5aa0 });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(mGeo, i % 2 ? mMat : mMat2);
      m.position.set(i * 14 - 20, 1, -26 - Math.random() * 8);
      m.scale.setScalar(0.8 + Math.random() * 1.2);
      this.scenery.add(m); this.mountains.push(m);
    }
    // 云
    this.clouds = [];
    const cGeo = new THREE.BoxGeometry(3, 1, 1.5);
    const cMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(cGeo, cMat);
      c.position.set(Math.random() * 200 - 20, 7 + Math.random() * 7, -8 - Math.random() * 12);
      c.scale.setScalar(0.7 + Math.random() * 1.6);
      this.scenery.add(c); this.clouds.push({ m: c, sp: 0.3 + Math.random() * 0.7 });
    }
    // 星星/隧道光环(穿越用)
    this.rings = [];
    const rGeo = new THREE.TorusGeometry(4, 0.15, 8, 24);
    for (let i = 0; i < 10; i++) {
      const r = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x37e6ff : 0xff6ad5, transparent: true, opacity: 0 }));
      r.position.set(i * 12, 2.5, -2);
      this.scenery.add(r); this.rings.push(r);
    }
    // 地下钟乳石
    this.stalacs = [];
    const sGeo = new THREE.ConeGeometry(0.8, 3, 5);
    const sMat = new THREE.MeshLambertMaterial({ color: 0x3a2f52 });
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(sGeo, sMat);
      s.rotation.x = Math.PI;
      s.position.set(i * 16, 9, -4 - Math.random() * 6);
      s.visible = false;
      this.scenery.add(s); this.stalacs.push(s);
    }
    // 金币雨装饰(超级奖励)
    this.confetti = [];
  }

  setTheme(t) {
    this.theme = t;
    const fogColors = {
      plains: 0x87ceeb, sky: 0x5fb8ff, cave: 0x1a1030,
      golden: 0xffc93e, tunnel: 0x0a0a2e, night: 0x0b1026
    };
    const c = fogColors[t] ?? 0x87ceeb;
    this.scene.fog = new THREE.Fog(c, 25, 95);
    this.scene.background = new THREE.Color(c);
    // 地面换色在生成时用;已存在地面也染色
    for (const g of this.grounds) {
      this.paintGround(g.mesh, t);
      if (g.top) g.top.visible = (t === 'plains');
    }
    // 钟乳石只在cave显示
    for (const s of this.stalacs) s.visible = (t === 'cave');
    // 隧道环只在tunnel显示
    for (const r of this.rings) r.material.opacity = (t === 'tunnel') ? 0.9 : 0;
  }

  paintGround(mesh, theme) {
    let m = MAT.ground;
    if (theme === 'cave') m = MAT.caveGround;
    else if (theme === 'sky') m = MAT.skyGround;
    else if (theme === 'golden') m = MAT.goldGround;
    else if (theme === 'tunnel') m = MAT.tunnelGround;
    mesh.material = m;
  }

  reset() {
    for (const g of this.grounds) { this.scene.remove(g.mesh); this.scene.remove(g.top); }
    for (const o of this.obstacles) { o.active = false; if (o.grp) o.grp.visible = false; }
    for (const c of this.coins) { c.active = false; c.mesh.visible = false; }
    for (const p of this.picks) { p.active = false; p.mesh.visible = false; }
    for (const p of this.portals) { p.active = false; p.grp.visible = false; }
    this.grounds = [];
    this.nextX = -12;
    this.chunkCount = 0;
    this.difficulty = 0;
    this.setTheme('plains');
    // 起始安全区
    this.addGround(-14, 26);
    this.nextX = 12;
  }

  // ---------- 地面 ----------
  addGround(x1, x2, y = 0) {
    const len = x2 - x1;
    const mesh = new THREE.Mesh(GEO.ground, MAT.ground);
    mesh.scale.set(len, 1.2, 1);
    mesh.position.set((x1 + x2) / 2, y - 0.6, 0);
    this.paintGround(mesh, this.theme);
    mesh.frustumCulled = true;
    this.scene.add(mesh);
    // 草皮顶
    const top = new THREE.Mesh(GEO.ground, MAT.groundTop);
    top.scale.set(len, 0.18, 6.4);
    top.position.set((x1 + x2) / 2, y + 0.02, 0);
    if (this.theme !== 'plains') top.visible = false;
    this.scene.add(top);
    const g = { mesh, top, x1, x2, y };
    this.grounds.push(g);
    return g;
  }

  groundAt(x) {
    // 返回 {y, has}
    for (const g of this.grounds) {
      if (x >= g.x1 && x <= g.x2) return { y: g.y, has: true };
    }
    return { y: 0, has: false };
  }

  // ---------- 对象池获取 ----------
  getObstacle(kind) {
    for (const o of this.obstacles) if (!o.active && o.kind === kind) { o.active = true; o.grp.visible = true; return o; }
    const o = this.createObstacle(kind);
    o.active = true;
    this.obstacles.push(o);
    return o;
  }
  getCoin() {
    for (const c of this.coins) if (!c.active) { c.active = true; c.mesh.visible = true; return c; }
    const mesh = new THREE.Mesh(GEO.coin, MAT.coin);
    mesh.rotation.x = Math.PI / 2;
    this.scene.add(mesh);
    const c = { mesh, x: 0, y: 0, active: true, vx: 0, vy: 0, vz: 0, magnet: false };
    this.coins.push(c);
    return c;
  }
  getPick(kind) {
    for (const p of this.picks) if (!p.active && p.kind === kind) { p.active = true; p.mesh.visible = true; return p; }
    const mesh = new THREE.Mesh(GEO.pick, MAT[kind] || MAT.star);
    this.scene.add(mesh);
    const p = { kind, mesh, x: 0, y: 0, active: true };
    this.picks.push(p);
    return p;
  }
  getPortal() {
    for (const p of this.portals) if (!p.active) { p.active = true; p.grp.visible = true; return p; }
    const grp = new THREE.Group();
    const door = new THREE.Mesh(GEO.portal, MAT.portal.clone());
    grp.add(door);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.0, 2.4), new THREE.MeshBasicMaterial({ color: 0xff6ad5 }));
    frame.position.x = -0.1; grp.add(frame);
    // 把门往前放避免z-fight
    door.position.x = 0.15;
    this.scene.add(grp);
    const p = { grp, door, x: 0, y: 0, active: true };
    this.portals.push(p);
    return p;
  }

  createObstacle(kind) {
    const grp = new THREE.Group();
    let w = 1, h = 1, y = 0;
    if (kind === 'spike') {
      w = 1.1; h = 1.0;
      const base = new THREE.Mesh(GEO.block, MAT.spike);
      base.scale.set(w, 0.25, 2.0); base.position.y = 0.12; grp.add(base);
      for (let i = -1; i <= 1; i++) {
        const s = new THREE.Mesh(GEO.spike, MAT.spike);
        s.position.set(0, 0.7, i * 0.6); grp.add(s);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), MAT.spikeTip);
        tip.position.set(0, 1.22, i * 0.6); grp.add(tip);
      }
    } else if (kind === 'doubleSpike') {
      w = 2.3; h = 1.0;
      const base = new THREE.Mesh(GEO.block, MAT.spike);
      base.scale.set(w, 0.25, 2.0); base.position.y = 0.12; grp.add(base);
      for (let k = 0; k < 5; k++) {
        const s = new THREE.Mesh(GEO.spike, MAT.spike);
        s.position.set(-0.9 + k * 0.45, 0.7, 0.6); grp.add(s);
        const s2 = s.clone(); s2.position.z = -0.6; grp.add(s2);
      }
    } else if (kind === 'overhang') {
      w = 2.2; h = 1.5; y = 1.55; // 底部1.55,滑铲(高0.85)可过,站立(2.0)撞
      const slab = new THREE.Mesh(GEO.block, MAT.block);
      slab.scale.set(w, h, 2.4); slab.position.y = y + h / 2; grp.add(slab);
      const under = new THREE.Mesh(GEO.block, MAT.blockDark);
      under.scale.set(w, 0.15, 2.4); under.position.y = y; grp.add(under);
      // 警示条
      const warn = new THREE.Mesh(GEO.block, new THREE.MeshBasicMaterial({ color: 0xffd23e }));
      warn.scale.set(w, 0.12, 2.45); warn.position.y = y + 0.1; grp.add(warn);
    } else if (kind === 'pillar') {
      w = 0.9; h = 1.9;
      const m = new THREE.Mesh(GEO.block, MAT.block);
      m.scale.set(w, h, 2.0); m.position.y = h / 2; grp.add(m);
      const cap = new THREE.Mesh(GEO.block, MAT.blockDark);
      cap.scale.set(w + 0.2, 0.2, 2.2); cap.position.y = h; grp.add(cap);
    } else if (kind === 'monster') {
      w = 0.95; h = 0.85;
      const body = new THREE.Mesh(GEO.monBody, MAT.mon);
      body.position.y = 0.45; grp.add(body);
      const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), MAT.monEye);
      e1.position.set(0.3, 0.6, 0.2); grp.add(e1);
      const e2 = e1.clone(); e2.position.z = -0.2; grp.add(e2);
      const pup = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      pup.position.set(0.4, 0.6, 0.2); grp.add(pup);
      const pup2 = pup.clone(); pup2.position.z = -0.2; grp.add(pup2);
      // 刺?头顶平坦可踩
      const feet = new THREE.Mesh(GEO.block, MAT.blockDark);
      feet.scale.set(0.9, 0.15, 0.9); feet.position.y = 0.07; grp.add(feet);
    }
    grp.visible = false;
    this.scene.add(grp);
    return { kind, grp, x: 0, y, w, h, active: false, t: Math.random() * 10, dead: false };
  }

  placeObstacle(kind, x, groundY = 0) {
    const o = this.getObstacle(kind);
    o.x = x; o.y = groundY; o.dead = false; o.t = Math.random() * 10;
    o.grp.position.set(x, groundY, 0);
    o.grp.visible = true;
    return o;
  }
  placeCoins(pattern, x, groundY = 0) {
    if (pattern === 'line') {
      for (let i = 0; i < 6; i++) this.spawnCoin(x + i * 1.1, groundY + 1.2);
    } else if (pattern === 'arc') {
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        this.spawnCoin(x + i * 1.0, groundY + 1.0 + Math.sin(t * Math.PI) * 1.8);
      }
    } else if (pattern === 'high') {
      for (let i = 0; i < 5; i++) this.spawnCoin(x + i * 1.0, groundY + 2.6);
    } else if (pattern === 'low') {
      for (let i = 0; i < 5; i++) this.spawnCoin(x + i * 1.0, groundY + 0.45);
    } else if (pattern === 'grid') {
      for (let r = 0; r < 3; r++) for (let i = 0; i < 10; i++)
        this.spawnCoin(x + i * 1.1, groundY + 0.8 + r * 0.9);
    } else if (pattern === 'stair') {
      for (let i = 0; i < 8; i++) this.spawnCoin(x + i * 0.9, groundY + 0.8 + i * 0.3);
    }
  }
  spawnCoin(x, y) {
    const c = this.getCoin();
    c.x = x; c.y = y; c.vx = 0; c.vy = 0; c.vz = 0; c.magnet = false;
    c.mesh.position.set(x, y, 0);
    c.mesh.visible = true;
  }
  placePick(kind, x, y) {
    const p = this.getPick(kind);
    p.x = x; p.y = y;
    p.mesh.position.set(x, y, 0);
    p.mesh.visible = true;
  }
  placePortal(x, groundY) {
    const p = this.getPortal();
    p.x = x; p.y = groundY;
    p.grp.position.set(x, groundY + 1.3, 0);
    p.grp.visible = true;
    // 保证可通过:清掉门附近3m内障碍,避免门与刺重叠逼死
    for (const o of this.obstacles) {
      if (o.active && Math.abs(o.x - x) < 3.2) { o.active = false; o.grp.visible = false; }
    }
  }

  // ---------- 程序化生成:保证可通过 ----------
  // 不变量:障碍最小间距>=5.5,深渊<=6.5,不同时叠加高低障碍,奖励模式只刷币
  generateUntil(playerX, mode) {
    const genAhead = playerX + 110;
    let guard = 0;
    while (this.nextX < genAhead && guard++ < 12) {
      if (mode === 'super') this.genSuperChunk();
      else if (mode === 'cross') this.genCrossChunk();
      else this.genNormalChunk();
    }
    // 清理身后
    const killX = playerX - 25;
    for (const g of this.grounds) {
      if (g.x2 < killX && !g._dead) { g._dead = true; this.scene.remove(g.mesh); this.scene.remove(g.top); }
    }
    this.grounds = this.grounds.filter(g => !g._dead);
    for (const o of this.obstacles) if (o.active && o.x < killX - 5) { o.active = false; o.grp.visible = false; }
    for (const c of this.coins) if (c.active && c.x < killX - 3) { c.active = false; c.mesh.visible = false; }
    for (const p of this.picks) if (p.active && p.x < killX - 3) { p.active = false; p.mesh.visible = false; }
    for (const p of this.portals) if (p.active && p.x < killX - 5) { p.active = false; p.grp.visible = false; }
  }

  pickBaseTheme() {
    const d = this.chunkCount;
    if (d < 3) return 'plains';
    const r = Math.random();
    if (r < 0.45) return 'plains';
    if (r < 0.68) return 'sky';
    if (r < 0.88) return 'cave';
    return 'plains';
  }

  genNormalChunk() {
    const theme = this.pickBaseTheme();
    this.baseTheme = theme;
    if (this.theme !== 'super' && this.theme !== 'cross') this.setTheme(theme);
    const startX = this.nextX;
    const len = 26 + Math.random() * 12;
    const diff = Math.min(1, this.chunkCount / 25); // 0..1
    this.difficulty = diff;
    this.chunkCount++;

    if (theme === 'sky') {
      // 2-3段浮岛+深渊,深渊3.5~6可跳
      let x = startX;
      const segs = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let s = 0; s < segs; s++) {
        const segLen = 8 + Math.random() * 7;
        this.addGround(x, x + segLen);
        this.decorateSegment(x, x + segLen, 0, diff);
        x += segLen;
        if (s < segs - 1) {
          const gap = 3.2 + Math.random() * (2 + diff * 1.2); // <=6.4
          // 深渊上给金币指引抛物线
          for (let i = 0; i < 4; i++) this.spawnCoin(x + gap * (i + 0.5) / 4.5, 1.4 + Math.sin((i + 0.5) / 4.5 * Math.PI) * 1.2);
          x += gap;
        }
      }
      this.nextX = x + 2;
    } else if (theme === 'cave') {
      this.addGround(startX, startX + len);
      // 洞窟:连续低顶滑铲段 + 尖刺
      let x = startX + 4;
      const end = startX + len - 3;
      while (x < end) {
        const r = Math.random();
        const gapNeed = 6 + diff * 3;
        if (r < 0.35) {
          this.placeObstacle('overhang', x, 0);
          this.placeCoins('low', x - 0.5, 0);
          x += 2.2 + gapNeed + Math.random() * 3;
        } else if (r < 0.6) {
          this.placeObstacle('spike', x, 0);
          this.placeCoins('arc', x - 2.5, 0);
          x += gapNeed + Math.random() * 3;
        } else if (r < 0.8) {
          this.placeObstacle('monster', x, 0);
          this.placeCoins('line', x - 3, 0);
          x += gapNeed + Math.random() * 2;
        } else {
          this.placeCoins('line', x, 0);
          x += 6 + Math.random() * 4;
        }
      }
      this.nextX = startX + len + 2;
    } else {
      // 平原:偶发小坑
      let x = startX;
      // 20%来个小深渊
      if (this.chunkCount > 4 && Math.random() < 0.25) {
        const g1 = 10 + Math.random() * 6;
        this.addGround(x, x + g1);
        this.decorateSegment(x, x + g1, 0, diff);
        x += g1;
        const gap = 3 + Math.random() * (1.5 + diff * 1.5);
        for (let i = 0; i < 4; i++) this.spawnCoin(x + gap * (i + 0.5) / 4.5, 1.5 + Math.sin((i + 0.5) / 4.5 * Math.PI));
        x += gap;
        const g2len = len - g1 - gap;
        if (g2len > 4) { this.addGround(x, x + g2len); this.decorateSegment(x, x + g2len, 0, diff); x += g2len; }
      } else {
        this.addGround(x, x + len);
        this.decorateSegment(x, x + len, 0, diff);
        x += len;
      }
      // 稀有:穿越门 / 道具
      const roll = Math.random();
      if (this.chunkCount > 5 && roll < 0.14) this.placePortal(x - 8 - Math.random() * 8, 0);
      else if (roll < 0.3) {
        const kinds = ['magnet', 'shield', 'sprint', 'mount'];
        this.placePick(kinds[Math.floor(Math.random() * kinds.length)], x - 10 - Math.random() * 8, 1.6);
      }
      this.nextX = x + 2;
    }
  }

  decorateSegment(x1, x2, groundY, diff) {
    let x = x1 + 3;
    const end = x2 - 2;
    const minGap = 6.5 + diff * 3.5;
    let lastWasAir = false;
    while (x < end) {
      const r = Math.random();
      // 难度越高障碍越密、组合越多,但永不同时双障碍
      if (r < 0.28 - diff * 0.05) {
        // 金币小段,休息
        this.placeCoins(Math.random() < 0.5 ? 'line' : 'stair', x, groundY);
        x += 5 + Math.random() * 3;
        lastWasAir = false;
      } else if (r < 0.5) {
        const kind = (diff > 0.4 && Math.random() < 0.35) ? 'doubleSpike' : 'spike';
        this.placeObstacle(kind, x, groundY);
        this.placeCoins('arc', x - (kind === 'doubleSpike' ? 3 : 2.5), groundY);
        x += minGap + Math.random() * 3;
        lastWasAir = true;
      } else if (r < 0.68) {
        this.placeObstacle('overhang', x, groundY);
        this.placeCoins('low', x - 1, groundY);
        x += minGap + Math.random() * 3;
        lastWasAir = false;
      } else if (r < 0.82) {
        // 柱子(高跳)只在非连续跳跃后出现,保证体力
        if (!lastWasAir) {
          this.placeObstacle('pillar', x, groundY);
          this.placeCoins('high', x - 2, groundY);
        } else this.placeCoins('line', x, groundY);
        x += minGap + Math.random() * 3;
        lastWasAir = true;
      } else {
        this.placeObstacle('monster', x, groundY);
        this.placeCoins('line', x - 3, groundY);
        x += minGap * 0.9 + Math.random() * 2.5;
        lastWasAir = false;
      }
    }
  }

  genSuperChunk() {
    // 超级奖励:纯金币阵列,无障碍无坑,地面连续
    const startX = this.nextX;
    const len = 30;
    this.addGround(startX, startX + len, 0);
    const pats = ['grid', 'stair', 'arc', 'line'];
    let x = startX + 2;
    while (x < startX + len - 8) {
      const p = pats[Math.floor(Math.random() * pats.length)];
      this.placeCoins(p, x, 0);
      x += p === 'grid' ? 13 : 8;
    }
    // 零星shield点缀?不放障碍
    this.nextX = startX + len;
  }

  genCrossChunk() {
    // 穿越奖励:高速隧道,有简单障碍+密集金币,无坑
    const startX = this.nextX;
    const len = 30;
    this.addGround(startX, startX + len, 0);
    let x = startX + 4;
    while (x < startX + len - 4) {
      const r = Math.random();
      if (r < 0.4) { this.placeCoins('line', x, 0); x += 6; }
      else if (r < 0.6) { this.placeObstacle('spike', x, 0); this.placeCoins('arc', x - 2.5, 0); x += 9; }
      else if (r < 0.8) { this.placeObstacle('overhang', x, 0); this.placeCoins('low', x - 1, 0); x += 9; }
      else { this.placeCoins('high', x, 0); x += 6; }
    }
    this.nextX = startX + len;
  }

  update(dt, playerX, speed, mode) {
    this.generateUntil(playerX, mode);
    this.coinSpin += dt * 4;
    // 金币旋转+浮动,怪物巡逻,门旋转
    for (const c of this.coins) {
      if (!c.active) continue;
      // 磁铁吸附在Game里改vx;这里积分位移
      if (c.magnet) {
        c.x += c.vx * dt; c.y += c.vy * dt;
        c.mesh.position.set(c.x, c.y, 0);
      } else {
        c.mesh.rotation.y = this.coinSpin;
        c.mesh.position.y = c.y + Math.sin(this.coinSpin * 0.8 + c.x) * 0.08;
      }
      // 超出太远隐藏由generateUntil处理
    }
    for (const o of this.obstacles) {
      if (!o.active) continue;
      o.t += dt;
      if (o.kind === 'monster') {
        // 来回踱步
        o.grp.position.x = o.x + Math.sin(o.t * 1.6) * 0.8;
        o.grp.position.y = o.y + Math.abs(Math.sin(o.t * 6)) * 0.08;
      }
    }
    for (const p of this.picks) {
      if (!p.active) continue;
      p.mesh.rotation.y += dt * 3;
      p.mesh.position.y = p.y + Math.sin(performance.now() * 0.003 + p.x) * 0.2;
    }
    for (const p of this.portals) {
      if (!p.active) continue;
      p.door.rotation.y += dt * 2;
      p.grp.position.y = p.y + 1.3 + Math.sin(performance.now() * 0.002 + p.x) * 0.15;
    }
    this.updateScenery(dt, playerX, speed);
  }

  updateScenery(dt, playerX, speed) {
    const camX = playerX;
    // 远山:慢速视差,循环
    for (const m of this.mountains) {
      // 保持在相机前方
      while (m.position.x < camX - 30) m.position.x += 16 * 14;
      while (m.position.x > camX + 200) m.position.x -= 16 * 14;
    }
    for (const c of this.clouds) {
      c.m.position.x -= (c.sp + speed * 0.02) * dt * 3;
      if (c.m.position.x < camX - 30) {
        c.m.position.x = camX + 120 + Math.random() * 60;
        c.m.position.y = 7 + Math.random() * 7;
      }
    }
    if (this.theme === 'tunnel') {
      for (const r of this.rings) {
        r.position.x -= speed * 1.2 * dt;
        if (r.position.x < camX - 15) r.position.x += 120;
        r.rotation.z += dt * 2;
      }
    } else if (this.theme === 'golden') {
      for (const c of this.clouds) c.m.material = c.m.material; // 保持
    }
  }
}
