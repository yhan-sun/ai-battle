// NEON RUSH 3D - 主控制器：状态机 · 物理 · 碰撞裁决 · 积分 · 存档 · 游戏循环
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { AudioEngine } from './audio.js';
import { ParticleEngine } from './particles.js';
import { World } from './world.js';
import { Player } from './player.js';
import { LevelManager } from './level.js';
import { BonusManager } from './bonus.js';
import { UI } from './ui.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 320);
    this.camera.position.set(-9, 5.4, 7.2);
    this.camera.lookAt(6, 1.6, -0.6);

    this.world = new World(this.scene);
    this.level = new LevelManager(this.scene);
    this.bonus = new BonusManager(this.scene);
    this.player = new Player(this.scene);
    this.particles = new ParticleEngine(this.scene);
    this.audio = new AudioEngine();
    this.ui = new UI();

    this.state = 'menu';
    this.prevState = 'running';
    this.shake = 0;
    this.time = 0;

    this.loadSave();
    this.bindInput();
    this.attractSetup();

    window.addEventListener('resize', () => this.onResize());
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /* ---------------- 存档 ---------------- */
  loadSave() {
    let d = {};
    try {
      d = JSON.parse(localStorage.getItem(CONFIG.saveKey) || '{}');
    } catch (e) {
      d = {};
    }
    this.best = { score: d.bestScore || 0, distance: d.bestDistance || 0, coins: d.bestCoins || 0 };
    this.muted = !!d.muted;
    this.audio.setMuted(this.muted);
  }

  save() {
    try {
      localStorage.setItem(
        CONFIG.saveKey,
        JSON.stringify({
          bestScore: this.best.score,
          bestDistance: this.best.distance,
          bestCoins: this.best.coins,
          muted: this.muted,
        }),
      );
    } catch (e) {
      /* 隐私模式等场景下忽略 */
    }
  }

  /* ---------------- 输入 ---------------- */
  bindInput() {
    this.onJump = () => {
      if (this.state !== 'running' && this.state !== 'bonus-super' && this.state !== 'bonus-warp') return;
      this.audio.ensure();
      const r = this.player.jump({
        events: {
          jump: () => this.audio.jump(),
          airJump: (stage) => {
            if (stage === 2) this.audio.doubleJump();
            else if (stage >= 3) this.audio.tripleJump();
          },
          slide: () => this.audio.slide(),
        },
      });
      if (r && r.type === 'jump') this.spawnJumpDust();
    };

    this.onSlide = () => {
      if (this.state !== 'running' && this.state !== 'bonus-super' && this.state !== 'bonus-warp') return;
      this.player.slide({ events: { slide: () => this.audio.slide() } });
    };

    this.onSkill = () => {
      if (this.state !== 'running' && this.state !== 'bonus-super' && this.state !== 'bonus-warp') return;
      if (this.player.dash()) {
        this.audio.dash();
        this.shake = Math.max(this.shake, 0.3);
        this.spawnDashBurst();
      } else {
        this.audio.ui();
      }
    };

    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === ' ' || k === 'w' || k === 'W' || k === 'ArrowUp') {
        e.preventDefault();
        this.onJump();
      } else if (k === 's' || k === 'S' || k === 'ArrowDown') {
        e.preventDefault();
        this.onSlide();
      } else if (k === 'f' || k === 'F' || k === 'Shift') {
        e.preventDefault();
        this.onSkill();
      } else if (k === 'Escape' || k === 'p' || k === 'P') {
        this.togglePause();
      } else if (k === 'm' || k === 'M') {
        this.toggleSound();
      } else if (k === 'Enter') {
        if (this.state === 'menu') this.startRun();
        else if (this.state === 'gameover') this.restartRun();
      } else if (k === 'r' || k === 'R') {
        if (['running', 'bonus-super', 'bonus-warp', 'paused'].includes(this.state)) this.restartRun();
      }
    });

    this.ui.bind({
      start: () => this.startRun(),
      resume: () => this.resume(),
      restart: () => this.restartRun(),
      menu: () => this.toMenu(),
      retry: () => this.restartRun(),
      revive: () => this.revive(),
      pause: () => this.togglePause(),
      sound: () => this.toggleSound(),
      jump: () => this.onJump(),
      slide: () => this.onSlide(),
    });

    this.ui.showMenu(this.best.score);
  }

  toggleSound() {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    this.save();
  }

  togglePause() {
    if (this.state === 'paused') {
      this.resume();
    } else if (['running', 'bonus-super', 'bonus-warp'].includes(this.state)) {
      this.prevState = this.state;
      this.state = 'paused';
      this.audio.stopMusic();
      this.ui.screen('pause');
      this.ui.touchVisible(false);
    }
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.prevState;
    this.audio.startMusic(this.state === 'bonus-warp' ? 'warp' : this.state === 'bonus-super' ? 'bonus' : 'main');
    this.ui.screen(null);
    this.ui.hudVisible(true);
    this.ui.touchVisible(true);
  }

  /* ---------------- 初始场景 / 运行 ---------------- */
  attractSetup() {
    this.level.resetAll();
    this.level.spawnPlatform(-16, 44); // 覆盖 -16..28
    this.level.nextX = 28;
    this.level.ensureAhead(0);
    this.player.reset();
    this.player.setWorldX(0);
  }

  startRun() {
    this.audio.ensure();
    this.audio.ui();
    this.level.resetAll();
    this.bonus.exit();
    this.world.setMode('main');
    this.player.reset();
    this.player.setWorldX(0);
    this.level.spawnPlatform(-16, 44); // 覆盖 -16..28，无缝接后续 chunk
    this.level.nextX = 28;
    this.level.ensureAhead(0);

    this.state = 'running';
    this.baseSpeed = CONFIG.baseSpeed;
    this.dist = 0;
    this.coins = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.superStage = 1;
    this.warpStage = 1;
    this.reviveUsed = false;
    this.gateEntryX = 0;

    this.ui.screen(null);
    this.ui.hudVisible(true);
    this.ui.touchVisible(true);
    this.ui.banner('NEON RUSH · GO!');
    this.audio.startMusic('main');

    // 开场连发金币
    for (let i = 0; i < 6; i++) this.level.spawnCoin(3 + i * 0.85, 0.9);
  }

  restartRun() {
    this.startRun();
  }

  toMenu() {
    this.state = 'menu';
    this.audio.stopMusic();
    this.level.setVisible(true);
    this.attractSetup();
    this.world.setMode('main');
    this.ui.showMenu(this.best.score);
  }

  /* ---------------- 计分事件 ---------------- */
  collectCoin(x, y) {
    const inBonus = this.state === 'bonus-super' || this.state === 'bonus-warp';
    this.coins++;
    const mult = this.state === 'bonus-super' ? CONFIG.superBonusMultiplier : 1;
    this.score += CONFIG.coinScore * mult;
    this.player.gainSkill(1);
    this.audio.coin(this.coins % 12);
    this.particles.spawn(x, y + 0.3, 0, { count: 4, speed: 3.5, color: 0xffd76a, size: 0.2, life: 0.4 });

    // 主赛道金币满额度 → 点亮超级奖励门
    if (!inBonus && this.coins % CONFIG.superCoinNeed === 0) {
      this.superStage++;
      this.level.requestGate('super');
      this.ui.banner('前方出现★超级奖励之门!');
    }
  }

  handleStomp(x, y) {
    this.combo++;
    this.comboTimer = CONFIG.comboWindow;
    const bonus = Math.min(this.combo - 1, 10);
    this.score += CONFIG.stompScore + bonus * 10;
    this.player.grounded = false;
    this.player.vy = 13.8;
    this.player.y += 0.05;
    this.audio.stomp();
    this.particles.spawn(x, y + 0.2, 0, { count: 10, speed: 6.5, color: 0x3ddc97, life: 0.55 });
    this.shake = Math.max(this.shake, 0.22);
    if (this.combo >= 3) {
      this.ui.combo(`连击 x${this.combo}  +${CONFIG.stompScore + bonus * 10}`);
      this.audio.comboUp(Math.min(this.combo, 8));
    }
  }

  handleObstacle(e) {
    if (this.player.dashTimer > 0) {
      this.score += 8;
      this.audio.pickup('dash');
      this.particles.spawn(e.x, 1.2, 0, { count: 12, speed: 8, color: 0x46e0ff, life: 0.6 });
      this.shake = Math.max(this.shake, 0.18);
      return;
    }
    const res = this.player.takeHit();
    if (res === 'invincible') return;
    if (res === 'shielded') {
      this.audio.hurt();
      this.particles.spawn(e.x, 0.9, 0, { count: 14, speed: 7, color: 0x46e0ff, life: 0.6 });
      this.shake = Math.max(this.shake, 0.28);
      return;
    }
    if (res === 'lost-mount') {
      this.audio.hurt();
      this.particles.spawn(e.x, 0.9, 0, { count: 12, speed: 7, color: 0xff5ecf, life: 0.6 });
      this.shake = Math.max(this.shake, 0.25);
      this.combo = 0;
      return;
    }
    this.die();
  }

  die() {
    if (this.player.dead) return;
    this.player.kill();
    this.audio.stopMusic();
    this.audio.dead();
    this.particles.spawn(this.player.group.position.x, Math.max(0.5, this.player.y + 1), 0, {
      count: 26,
      speed: 9,
      color: 0xff5ecf,
      life: 0.9,
      size: 0.4,
    });
    this.shake = Math.max(this.shake, 0.6);

    const newRecord = this.score > this.best.score;
    if (newRecord) this.best = { score: this.score, distance: Math.floor(this.dist), coins: this.coins };
    if (Math.floor(this.dist) > this.best.distance) this.best.distance = Math.floor(this.dist);
    if (this.coins > this.best.coins) this.best.coins = this.coins;
    this.save();

    this.state = 'gameover';
    this.ui.showGameOver(
      { score: Math.floor(this.score), distance: Math.floor(this.dist), coins: this.coins, best: this.best.score, newRecord },
      { canRevive: !this.reviveUsed },
    );
  }

  revive() {
    this.reviveUsed = true;
    this.player.revive();
    this.baseSpeed = Math.max(CONFIG.damageBaseSpeed, this.baseSpeed - 6);
    this.state = 'running';
    this.audio.startMusic('main');
    this.audio.revive();
    this.ui.screen(null);
    this.ui.hudVisible(true);
    this.ui.touchVisible(true);
    this.ui.banner('重新出发！无敌 4 秒');
  }

  /* ---------------- 奖励关 ---------------- */
  enterBonus(gateType, gateX) {
    this.gateEntryX = gateX;
    this.bonus.enter(gateType);
    this.player.setWorldX(this.bonus.spawnX());
    this.player.grounded = false;
    this.player.y = 0;
    if (gateType === 'super') {
      this.state = 'bonus-super';
      this.world.setMode('super');
      this.ui.banner('SUPER 超级奖励', `x${CONFIG.superBonusMultiplier} 倍表现分 · ${CONFIG.superBonusTime}s`);
    } else {
      this.state = 'bonus-warp';
      this.world.setMode('warp');
      this.ui.banner('WARP 穿越奖励', `超时空隧道 · x${CONFIG.warpSpeedMultiplier} 速度`);
    }
    this.audio.bonusEnter();
    this.level.setVisible(false);
    this.audio.startMusic(gateType === 'warp' ? 'warp' : 'bonus');
  }

  exitBonus() {
    this.audio.bonusExit();
    this.bonus.exit();
    this.state = 'running';
    this.world.setMode('main');
    this.level.setVisible(true);
    // 无敌返场保护，从门后继续
    this.player.setWorldX(this.gateEntryX + 9);
    this.player.y = 0;
    this.player.vy = 0;
    this.player.grounded = false;
    this.player.invincible = Math.max(this.player.invincible, 2.5);
    this.audio.startMusic('main');
    this.ui.banner('回到主赛道！');
    this.level.ensureAhead(this.player.group.position.x);
  }

  /* ---------------- 主循环 ---------------- */
  frame() {
    const raw = this.clock.getDelta();
    const dt = Math.min(Math.max(raw, 0.001), 1 / 30);
    this.time += dt;

    if (this.state === 'menu') {
      const t = Math.sin(this.time * 0.4) * 3;
      this.camera.position.x = this.player.group.position.x - 9 + t;
      this.camera.position.y = 5.4;
      this.camera.position.z = 7.2;
      this.camera.lookAt(this.camera.position.x + 14, 1.6, -0.6);
    } else if (this.state === 'running' || this.state === 'bonus-super' || this.state === 'bonus-warp') {
      this.updateRun(dt);
    } else if (this.state === 'gameover') {
      this.updateGameOver(dt);
    }

    this.world.update(this.camera.position.x);
    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateRun(dt) {
    const p = this.player;
    const isSuper = this.state === 'bonus-super';
    const isWarp = this.state === 'bonus-warp';
    const pxObj = p.group.position;

    // 速度
    let speed = this.baseSpeed * (p.mounted ? 1.14 : 1);
    if (isWarp) speed *= CONFIG.warpSpeedMultiplier;
    else if (isSuper) speed *= 0.8;
    if (p.dashTimer > 0) speed = Math.max(speed, CONFIG.dashSpeed);
    if (!isSuper && !isWarp) this.baseSpeed = Math.min(CONFIG.maxSpeed, this.baseSpeed + CONFIG.speedRamp * dt);
    this.speed = speed;

    // 位移
    const vx = speed * dt;
    if (isSuper || isWarp) {
      this.bonus.playerLocalX += vx;
      pxObj.x = this.bonus.playerLocalX;
    } else {
      pxObj.x += vx;
      this.dist += vx;
    }

    // 表现分
    const mult = isSuper ? CONFIG.superBonusMultiplier : isWarp ? 1.5 : 1;
    this.score += vx * CONFIG.scorePerMeter * mult;

    // 当前地面：主赛道按平台查询（null=悬空），奖励关恒为 0
    const gy = isSuper || isWarp ? 0 : this.level.groundAt(pxObj.x);
    p.update(dt, gy, { speed });

    // 掉出深渊
    if (!isSuper && !isWarp && p.y < -2 && !p.dead) {
      this.die();
      return;
    }

    // 连击窗口
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    let events = [];
    if (isSuper || isWarp) {
      const r = this.bonus.update(dt, p);
      events = r.events;
      if (r.exit) {
        this.exitBonus();
      }
    } else {
      this.level.update(dt, pxObj.x);
      this.level.ensureAhead(pxObj.x);
      events = this.level.collide(p.aabb(), { vy: p.vy, y: p.y, flying: !p.grounded });
    }

    // 事件处理
    for (const e of events) {
      if (e.type === 'coin') {
        this.collectCoin(e.x, e.y);
        if (isSuper) this.score += 5;
      } else if (e.type === 'item') {
        this.pickupItem(e.item, e.x, e.y);
      } else if (e.type === 'gate' && !isSuper && !isWarp) {
        this.audio.gate();
        this.enterBonus(e.gate, e.x);
        break;
      } else if (e.type === 'stomp' && !isSuper && !isWarp) {
        this.handleStomp(e.x, e.y);
      } else if (e.type === 'obstacle' && !isSuper && !isWarp) {
        this.handleObstacle(e);
        if (this.state !== 'running') break;
      }
    }

    // 穿越奖励触发（按里程）
    if (!isSuper && !isWarp && this.dist >= CONFIG.warpDistanceStep * this.warpStage) {
      this.warpStage++;
      this.level.requestGate('warp');
      this.ui.banner('前方出现穿越奖励之门!');
    }

    // 相机
    const cam = this.camera;
    const tx = pxObj.x + CONFIG.camOffset.x;
    cam.position.x += (tx - cam.position.x) * Math.min(1, dt * 8);
    cam.position.y = CONFIG.camOffset.y + (isSuper ? 0.6 : 0) + p.y * 0.22;
    cam.position.z = CONFIG.camOffset.z;
    cam.lookAt(pxObj.x + CONFIG.camLookOffset.x, p.y * 0.45 + CONFIG.camLookOffset.y, CONFIG.camLookOffset.z);

    // FOV 动态拉伸
    const targetFov = isWarp ? 68 : p.dashTimer > 0 ? 63 : 58;
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 4);
    cam.updateProjectionMatrix();

    // 镜头震动
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.5;
      this.shake *= Math.pow(0.001, dt);
    }

    this.world.setNeon(pxObj);

    // HUD
    this.ui.updateHud({
      coins: this.coins,
      score: Math.floor(this.score),
      distance: Math.floor(this.dist),
      speedMult: speed / CONFIG.baseSpeed,
    });
    this.ui.updateBuffers({
      skill: Math.min(1, p.skillCharge / CONFIG.dashChargeNeed),
      magnet: p.magnetTimer / CONFIG.magnetDuration,
      shield: p.shieldTimer / CONFIG.shieldDuration,
      mounted: p.mounted,
    });

    // 磁铁吸附金币
    if (p.magnetTimer > 0 && !isSuper && !isWarp) this.applyMagnet(dt);
  }

  updateGameOver(dt) {
    const cam = this.camera;
    cam.position.x += dt * 1.4;
    cam.lookAt(cam.position.x + CONFIG.camLookOffset.x, 1.6, CONFIG.camLookOffset.z);
  }

  pickupItem(item, x, y) {
    this.player.activateItem(item);
    this.audio.pickup(item);
    this.particles.spawn(x, y, 0, { count: 12, speed: 5, color: 0xffffff, life: 0.5 });
    const names = {
      magnet: '磁铁 · 全图吸金币!',
      shield: '护盾 · 抵挡一次撞击!',
      dash: '冲刺 · 横冲直撞!',
      mount: '坐骑 · 赛博滑板(三段跳+加速!)',
    };
    this.ui.banner(names[item] || item);
  }

  applyMagnet(dt) {
    const p = this.player;
    const px = p.group.position.x;
    for (const e of this.level.active) {
      if (e.alive && e.kind === 'coin') {
        const dx = e.x - px;
        const dy = e.y - (p.y + 0.8);
        if (dx > -1 && dx < 12 && Math.abs(dy) < 6) {
          e.x -= dx * dt * 10;
          e.y -= dy * dt * 10;
          e.mesh.position.set(e.x, e.y, 0);
        }
      }
    }
  }

  spawnJumpDust() {
    const p = this.player.group.position;
    this.particles.spawn(p.x - 0.3, 0.15, 0, { count: 5, speed: 2.4, color: 0x9fb6ff, size: 0.18, life: 0.35, grav: 2 });
  }

  spawnDashBurst() {
    const p = this.player.group.position;
    this.particles.spawn(p.x - 0.8, p.y + 0.9, 0, { count: 16, speed: 7, color: 0x46e0ff, size: 0.3, life: 0.5, grav: 0 });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

const game = new Game();
// 暴露用于本地/自动化自检（对玩法无影响）
window.__game = game;
