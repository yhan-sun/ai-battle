import * as THREE from 'three';
import { Config, Storage } from './config.js';
import { Player } from './player.js';
import { Level } from './level.js';
import { ParticleSystem } from './particles.js';
import { AudioManager } from './audio.js';

export const GameState = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', OVER: 'over' };

export class Game {
  constructor(container, ui) {
    this.container = container;
    this.ui = ui;
    this.save = Storage.load();
    this.audio = new AudioManager();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 25, 95);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camera.position.set(-6, 4, 8);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2cc, 1.4);
    this.sun.position.set(-5, 12, 8);
    this.scene.add(this.sun);
    // 跑道侧光(2.5D立体感)
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
    fill.position.set(0, 4, -6);
    this.scene.add(fill);

    this.particles = new ParticleSystem(this.scene);
    this.player = new Player(this.scene);
    this.level = new Level(this.scene);

    // 状态机
    this.state = GameState.MENU;
    this.mode = 'normal'; // normal | super | cross
    this.modeTimer = 0;
    this.returnInvincible = 0;

    this.score = 0; this.coins = 0; this.dist = 0; this.stomp = 0;
    this.energy = 0;
    this.speed = Config.baseSpeed;
    this.mult = 1;
    this.magnetT = 0; this.shieldT = 0; this.sprintT = 0; this.skillT = 0; this.skillCD = 0;
    this.mountT = 0; // 临时坐骑剩余;永久坐骑用hasMountSkin
    this.reviveUsed = false;
    this.shake = 0;
    this.flashT = 0;
    this.fovTarget = 60;
    this.deadTimer = 0;
    this.pendingJumpSound = null;
    this.runDustT = 0;
    this.lastX = 0;

    this.hasMountSkin = true;
    this.hasPet = true;
    this.charVariant = 0;

    this.clock = new THREE.Clock();
    this.bindInput();
    window.addEventListener('resize', () => this.onResize());
    this.level.reset();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------------- 输入 ----------------
  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); this.pressJump(); }
      else if (k === 'arrowdown' || k === 's') { e.preventDefault(); this.pressSlide(); }
      else if (k === 'f') this.pressSkill();
      else if (k === 'p' || k === 'escape') this.togglePause();
      else if (k === 'm') this.toggleMute();
      else if (k === 'enter' && this.state === GameState.MENU) this.start();
    });
    // 点击画布跳跃(开始后)
    this.renderer.domElement.addEventListener('pointerdown', () => {
      this.audio.ensure();
      if (this.state === GameState.PLAYING) this.pressJump();
    });
  }
  pressJump() {
    if (this.state !== GameState.PLAYING) return;
    this.audio.ensure();
    // 记录以便在player.update返回时播音效
    this.player.tryJump();
    this.jumpQueued = true;
  }
  pressSlide() {
    if (this.state !== GameState.PLAYING) return;
    this.audio.ensure();
    const r = this.player.trySlide();
    if (r === 'slide') {
      this.audio.slide();
      this.particles.dust(this.player.pos.x, this.player.pos.y + 0.2, 0, 6);
      this.shake = Math.max(this.shake, 0.08);
    }
  }
  pressSkill() {
    if (this.state !== GameState.PLAYING) return;
    if (this.skillCD > 0 || this.skillT > 0) { this.ui.popup('技能冷却中…'); return; }
    this.skillT = Config.skillDuration;
    this.skillCD = Config.skillCD;
    this.player.invincible = Math.max(this.player.invincible, Config.skillDuration);
    this.audio.skill();
    this.ui.popup('⚡ 星尘爆裂!无敌冲刺!');
    this.particles.burst(this.player.pos.x, this.player.pos.y + 1, 0, 40, { color: 0x7df9ff, spread: 8, up: 8, life: 0.7 });
    this.shake = 0.5;
    this.flash();
  }
  togglePause() {
    if (this.state === GameState.PLAYING) this.pause();
    else if (this.state === GameState.PAUSED) this.resume();
  }
  toggleMute() {
    this.audio.ensure();
    this.audio.setMuted(!this.audio.muted);
    this.ui.setMute(this.audio.muted);
  }

  // ---------------- 流程 ----------------
  applyLoadout(mount, pet, variant) {
    this.hasMountSkin = mount;
    this.hasPet = pet;
    this.charVariant = variant;
    this.player.setVariant(variant);
    this.player.setPetVisible(pet && this.state !== GameState.MENU ? true : pet);
  }
  start() {
    this.audio.ensure();
    this.audio.click();
    this.audio.startBgm();
    this.resetRun();
    this.state = GameState.PLAYING;
    this.ui.showHUD();
    this.ui.popup('开跑!空格跳跃 ↓滑铲');
  }
  resetRun() {
    this.level.reset();
    this.player.reset(0);
    this.player.setVariant(this.charVariant);
    this.player.setMount(this.hasMountSkin);
    this.player.setPetVisible(this.hasPet);
    this.particles.clear();
    this.score = 0; this.coins = 0; this.dist = 0; this.stomp = 0;
    this.energy = 0; this.speed = Config.baseSpeed; this.mult = 1;
    this.magnetT = 0; this.shieldT = 0; this.sprintT = 0; this.skillT = 0; this.skillCD = 0;
    this.mountT = this.hasMountSkin ? Infinity : 0;
    this.mode = 'normal'; this.modeTimer = 0;
    this.reviveUsed = false;
    this.shake = 0; this.fovTarget = 60;
    this.lastX = 0;
    this.deadTimer = 0;
    this.ui.hideOver();
  }
  pause() {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.PAUSED;
    this.audio.click();
    this.ui.showPause(this.score, this.dist);
  }
  resume() {
    if (this.state !== GameState.PAUSED) return;
    this.state = GameState.PLAYING;
    this.audio.click();
    this.clock.getDelta();
    this.ui.hidePause();
  }
  restart() { this.audio.click(); this.resetRun(); this.state = GameState.PLAYING; this.ui.showHUD(); this.audio.startBgm(); }
  quitToMenu() {
    this.state = GameState.MENU;
    this.audio.stopBgm();
    this.audio.click();
    this.level.reset();
    this.player.reset(0);
    this.player.setMount(false);
    this.ui.showStart(this.save);
  }
  gameOver(reason) {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.OVER;
    this.audio.hit();
    this.audio.over();
    this.audio.stopBgm();
    this.shake = 0.9;
    this.flash();
    this.particles.burst(this.player.pos.x, this.player.pos.y + 1, 0, 60, { color: 0xff4d6d, spread: 10, up: 10, life: 0.9 });
    this.particles.burst(this.player.pos.x, this.player.pos.y + 1, 0, 30, { color: 0xffe45e, spread: 8, up: 8, life: 0.8 });
    // 存档
    const sc = Math.floor(this.score);
    const isRecord = sc > (this.save.best || 0);
    if (isRecord) this.save.best = sc;
    if (this.dist > (this.save.bestDist || 0)) this.save.bestDist = Math.floor(this.dist);
    if (this.coins > (this.save.bestCoins || 0)) this.save.bestCoins = this.coins;
    this.save.plays = (this.save.plays || 0) + 1;
    this.save.mount = this.hasMountSkin; this.save.pet = this.hasPet;
    Storage.save(this.save);
    setTimeout(() => {
      this.ui.showOver({
        score: sc, dist: Math.floor(this.dist), coins: this.coins, stomp: this.stomp,
        best: this.save.best, record: isRecord, canRevive: !this.reviveUsed, reason
      });
    }, 700);
  }
  revive() {
    if (this.reviveUsed || this.state !== GameState.OVER) return;
    this.reviveUsed = true;
    this.audio.revive();
    this.ui.hideOver();
    this.state = GameState.PLAYING;
    this.audio.startBgm();
    // 复活:回到有地面的位置,3s无敌冲刺
    let x = this.player.pos.x;
    // 往前找地面
    for (let i = 0; i < 20; i++) {
      const g = this.level.groundAt(x + i * 0.5);
      if (g.has) { x = x + i * 0.5; break; }
    }
    this.player.pos.x = x;
    this.player.y = 2; this.player.vy = 2;
    this.player.grounded = false;
    this.player.invincible = Config.reviveInvincible;
    this.sprintT = Config.reviveInvincible;
    // 清掉身边障碍
    for (const o of this.level.obstacles) if (o.active && Math.abs(o.x - x) < 14) { o.active = false; o.grp.visible = false; }
    this.ui.popup('💖 复活!无敌冲刺3秒!');
    this.ui.showHUD();
  }

  // ---------------- 奖励模式切换 ----------------
  enterSuper() {
    if (this.mode === 'super') return;
    this.mode = 'super'; this.modeTimer = Config.superDuration;
    this.energy = 0;
    this.level.setTheme('golden');
    this.player.invincible = Math.max(this.player.invincible, Config.superDuration);
    this.audio.portal(); this.audio.power();
    this.ui.showMode('SUPER REWARD 超级奖励', '金币狂欢 x4!无敌!', Config.superDuration);
    this.ui.popup('🌟 SUPER REWARD!金币阵列!');
    this.flash();
    this.shake = 0.4;
    // 清掉前方障碍保证纯金币体验
    const px = this.player.pos.x;
    for (const o of this.level.obstacles) if (o.active && o.x > px && o.x < px + 60) { o.active = false; o.grp.visible = false; }
    for (const p of this.level.portals) if (p.active && p.x > px && p.x < px + 60) { p.active = false; p.grp.visible = false; }
  }
  enterCross() {
    if (this.mode !== 'normal') return;
    this.mode = 'cross'; this.modeTimer = Config.crossDuration;
    this.level.setTheme('tunnel');
    this.audio.portal();
    this.ui.showMode('CROSS 穿越奖励', '高速隧道!小心!', Config.crossDuration);
    this.ui.popup('🌀 穿越!高速隧道!');
    this.flash();
    this.shake = 0.5;
    const px = this.player.pos.x;
    for (const p of this.level.portals) if (p.active && Math.abs(p.x - px) < 20) { p.active = false; p.grp.visible = false; }
  }
  exitReward(toNormal = true) {
    const was = this.mode;
    this.mode = 'normal'; this.modeTimer = 0;
    this.level.setTheme(this.level.baseTheme || 'plains');
    this.player.invincible = Math.max(this.player.invincible, 2);
    this.ui.hideMode();
    this.ui.popup(was === 'super' ? '超级奖励结束!继续跑!' : '穿越结束!漂亮!');
    this.audio.power();
  }

  flash() {
    this.ui.flash();
  }

  // ---------------- 主循环 ----------------
  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.033);
    if (this.state === GameState.PLAYING) this.update(dt);
    else if (this.state === GameState.MENU) this.updateMenu(dt);
    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
  updateMenu(dt) {
    // 主页慢速展示:角色原地跑,镜头环绕
    const t = performance.now() * 0.001;
    this.player.root.position.x = 0;
    this.player.runPhase += dt * 8;
    this.player.animate(dt, 8);
    this.player.updatePet(dt);
    this.level.updateScenery(dt, -t * 2, 6);
    this.camera.position.lerp(new THREE.Vector3(-5.5 + Math.sin(t * 0.3), 3.6, 7.4), 0.05);
    this.camera.lookAt(1.5, 1.2, 0);
  }

  update(dt) {
    const P = this.player;
    // 计时器
    if (this.magnetT > 0) this.magnetT -= dt;
    if (this.shieldT > 0) this.shieldT -= dt;
    if (this.sprintT > 0) this.sprintT -= dt;
    if (this.skillT > 0) this.skillT -= dt;
    if (this.skillCD > 0) this.skillCD -= dt;
    if (this.returnInvincible > 0) this.returnInvincible -= dt;

    // 奖励倒计时
    if (this.mode !== 'normal') {
      this.modeTimer -= dt;
      this.ui.tickMode(this.modeTimer);
      if (this.modeTimer <= 0) this.exitReward();
    }

    // 速度:距离递增 + 模式/道具加成
    const targetBase = Math.min(Config.maxSpeed, Config.baseSpeed + this.dist * Config.speedGainPerMeter);
    let sp = targetBase;
    if (this.mode === 'cross') sp *= Config.crossSpeedMult;
    if (this.mode === 'super') sp *= 1.15;
    if (this.sprintT > 0 || this.skillT > 0) sp *= 1.55;
    this.speed += (sp - this.speed) * Math.min(1, dt * 2);
    this.fovTarget += ((this.sprintT > 0 || this.skillT > 0 || this.mode === 'cross' ? 72 : 60) - this.fovTarget) * Math.min(1, dt * 3);
    if (Math.abs(this.camera.fov - this.fovTarget) > 0.1) {
      this.camera.fov += (this.fovTarget - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }

    // 前进
    P.pos.x += this.speed * dt;
    this.dist = P.pos.x;
    this.mult = (this.mode === 'super' ? Config.superMult : 1) * (this.skillT > 0 ? 2 : 1);
    this.score += this.speed * dt * Config.distScore * this.mult;

    // 地面查询
    const g = this.level.groundAt(P.pos.x);
    const jumpEvt = P.update(dt, this.speed, g.y, g.has || this.mode === 'super' || this.mode === 'cross');
    if (this.jumpQueued) {
      this.jumpQueued = false;
      if (jumpEvt === 'jump') { this.audio.jump(false); this.particles.dust(P.pos.x, P.pos.y, 0, 5); }
      else if (jumpEvt === 'double') {
        this.audio.jump(true);
        this.particles.burst(P.pos.x, P.pos.y + 0.3, 0, 12, { color: 0x7df9ff, spread: 4, up: 3, life: 0.5 });
      }
    } else if (jumpEvt === 'jump') { this.audio.jump(false); }
    else if (jumpEvt === 'double') { this.audio.jump(true); }

    // 跑步扬尘
    this.runDustT -= dt;
    if (P.grounded && this.runDustT <= 0) {
      this.runDustT = 0.18;
      this.particles.dust(P.pos.x - 0.5, P.pos.y + 0.1, (Math.random() - 0.5), 1);
    }
    // 冲刺拖尾
    if (this.sprintT > 0 || this.skillT > 0 || this.mode === 'super') {
      this.particles.spawn(P.pos.x - 0.6, P.pos.y + 1 + (Math.random() - 0.5), (Math.random() - 0.5) * 1.5,
        -6, (Math.random() - 0.5) * 2, 0, 0.4, this.mode === 'super' ? 0xffd94d : 0x7df9ff, 0);
    }

    // 关卡生成与动画
    this.level.update(dt, P.pos.x, this.speed, this.mode);

    // 掉坑
    if (P.pos.y < -7) { this.gameOver('fall'); return; }
    // 长时间无地面且下坠(深渊)不用额外判,掉下去即死

    this.handleCollisions(dt);

    // 能量满进超级奖励(奖励中不攒)
    if (this.mode === 'normal' && this.energy >= 100) this.enterSuper();

    // 坐骑超时
    if (this.mountT !== Infinity && this.mountT > 0) {
      this.mountT -= dt;
      if (this.mountT <= 0) { P.setMount(false); this.ui.popup('坐骑时间结束!'); }
    }

    this.updateCamera(dt);
    // 护盾/无敌气泡可视化
    const showShield = this.shieldT > 0 || P.invincible > 0;
    if (P.shieldMesh) {
      P.shieldMesh.visible = showShield;
      if (showShield) P.shieldMesh.material.opacity = 0.16 + Math.sin(performance.now() * 0.01) * 0.08;
    }
    // HUD
    this.ui.updateHUD({
      score: Math.floor(this.score), dist: Math.floor(this.dist), coins: this.coins,
      speed: this.speed, energy: this.energy, mult: this.mult,
      magnet: this.magnetT, shield: this.shieldT, sprint: this.sprintT,
      skillCD: this.skillCD, skillOn: this.skillT > 0, mode: this.mode, modeT: this.modeTimer
    });
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
  }

  aabbOverlap(a, b) {
    return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
  }

  handleCollisions(dt) {
    const P = this.player;
    const pa = P.getAABB();
    const px = P.pos.x, py = P.pos.y;
    const inv = P.invincible > 0 || this.mode === 'super' || this.sprintT > 0 || this.skillT > 0;

    // --- 障碍 ---
    for (const o of this.level.obstacles) {
      if (!o.active) continue;
      if (o.x < px - 6 || o.x > px + 6) continue;
      // 怪物位置随踱步偏移
      const ox = o.kind === 'monster' ? o.grp.position.x : o.x;
      const ob = { minX: ox - o.w / 2 + 0.12, maxX: ox + o.w / 2 - 0.12, minY: o.y, maxY: o.y + o.h };
      if (o.kind === 'overhang') { ob.minY = o.y + 1.55; ob.maxY = o.y + 1.55 + 1.5; }
      if (!this.aabbOverlap(pa, ob)) continue;

      if (o.kind === 'monster') {
        // 踩踏判定:下落中且脚高于怪顶-0.35
        const footY = pa.minY;
        const mTop = o.y + o.h;
        if (P.vy < -0.5 && footY > mTop - 0.45) {
          // 消灭!
          o.active = false; o.grp.visible = false;
          P.vy = Config.jumpV * 0.85; P.grounded = false; P.jumps = 1;
          this.stomp++;
          const gain = Config.stompScore * this.mult;
          this.score += gain;
          this.energy = Math.min(100, this.energy + 6);
          this.audio.stomp();
          this.particles.burst(ox, mTop, 0, 22, { color: 0x9b4dff, spread: 6, up: 7, life: 0.6 });
          this.ui.popup(`踩怪 +${Math.floor(gain)}!`, true);
          this.shake = Math.max(this.shake, 0.25);
          continue;
        }
        // 否则按受伤处理
      }
      if (inv) {
        // 无敌撞碎(超级/冲刺/技能):加分+粒子,不死亡
        if (o.kind !== 'monster' || true) {
          if (Math.abs(ox - px) < 2.5) {
            o.active = false; o.grp.visible = false;
            this.score += 50 * this.mult;
            this.particles.burst(ox, py + 1, 0, 18, { color: 0xffe45e, spread: 7, up: 6, life: 0.55 });
            this.audio.stomp();
            this.shake = Math.max(this.shake, 0.2);
          }
          continue;
        }
      }
      // 受伤:坐骑/护盾抵挡一次
      if (P.mounted || this.mountT > 0) {
        P.setMount(false); this.mountT = 0;
        P.invincible = 2;
        this.audio.hit();
        this.ui.popup('坐骑保护了你一次!');
        this.particles.burst(px, py + 1, 0, 26, { color: 0xffb84d, spread: 7, up: 7, life: 0.7 });
        this.shake = 0.5; this.flash();
        o.active = false; o.grp.visible = false;
        continue;
      }
      if (this.shieldT > 0) {
        this.shieldT = 0;
        P.invincible = 1.5;
        this.audio.hit();
        this.ui.popup('护盾碎裂!保护了你!');
        this.particles.burst(px, py + 1, 0, 26, { color: 0x37e6ff, spread: 7, up: 7, life: 0.7 });
        this.shake = 0.5; this.flash();
        o.active = false; o.grp.visible = false;
        continue;
      }
      this.gameOver(o.kind);
      return;
    }

    // --- 金币(含磁铁) ---
    const magnetR = this.magnetT > 0 ? Config.magnetRadius : (this.hasPet ? 2.6 : 1.6);
    // 技能/冲刺也带磁铁
    const bigMagnet = this.magnetT > 0 || this.sprintT > 0 || this.skillT > 0 || this.mode === 'super';
    const mr = bigMagnet ? Math.max(magnetR, 6) : magnetR;
    for (const c of this.level.coins) {
      if (!c.active) continue;
      const dx = c.x - px, dy = (c.mesh.position.y) - (py + 1);
      const d2 = dx * dx + dy * dy;
      if (d2 < mr * mr && (this.magnetT > 0 || bigMagnet || this.hasPet)) {
        // 吸附飞向玩家
        if (d2 > 0.4) {
          const d = Math.sqrt(d2) || 1;
          const pull = bigMagnet ? 26 : 14;
          c.magnet = true;
          c.vx = -dx / d * pull; c.vy = -dy / d * pull;
          continue;
        }
      }
      // 直接拾取
      const pr = 0.9;
      if (Math.abs(dx) < pr && Math.abs(dy) < 1.2) this.collectCoin(c);
      else if (c.magnet && d2 < 1.2) this.collectCoin(c);
    }

    // --- 道具 ---
    for (const p of this.level.picks) {
      if (!p.active) continue;
      if (Math.abs(p.x - px) > 1.2) continue;
      if (Math.abs(p.mesh.position.y - (py + 1)) > 1.4) continue;
      p.active = false; p.mesh.visible = false;
      this.applyPick(p.kind);
    }
    // --- 穿越门 ---
    for (const p of this.level.portals) {
      if (!p.active) continue;
      if (Math.abs(p.x - px) < 1.3 && py < 3) {
        this.enterCross();
        break;
      }
    }
  }

  collectCoin(c) {
    c.active = false; c.mesh.visible = false; c.magnet = false;
    this.coins++;
    const gain = Config.coinScore * this.mult;
    this.score += gain;
    if (this.mode === 'normal') this.energy = Math.min(100, this.energy + Config.energyPerCoin);
    this.audio.coin();
    this.particles.coinSpark(c.x, c.mesh.position.y, 0);
  }

  applyPick(kind) {
    this.audio.power();
    if (kind === 'magnet') { this.magnetT = Config.magnetDuration; this.ui.popup('🧲 磁铁!金币飞来!'); }
    else if (kind === 'shield') { this.shieldT = Config.shieldDuration; this.ui.popup('🛡 护盾!可挡一次!'); }
    else if (kind === 'sprint') { this.sprintT = Config.sprintDuration; this.player.invincible = Math.max(this.player.invincible, Config.sprintDuration); this.ui.popup('🚀 冲刺!无敌!'); this.shake = 0.4; }
    else if (kind === 'mount') {
      this.player.setMount(true); this.mountT = 15;
      this.ui.popup('⭐ 星角兽!骑乘15s+抵挡一次!');
    }
    this.particles.burst(this.player.pos.x, this.player.pos.y + 1.4, 0, 20, { color: 0xffffff, spread: 5, up: 6, life: 0.6 });
  }

  updateCamera(dt) {
    const P = this.player.pos;
    const py = this.player.pos.y;
    const slideDip = this.player.sliding ? -0.5 : 0;
    const tx = P.x - 6.2, ty = 3.8 + py * 0.35 + slideDip, tz = 7.4;
    const k = 1 - Math.pow(0.0001, dt);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (ty - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    if (this.shake > 0) {
      const s = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(P.x + 3.6, 1.3 + py * 0.4, 0);
    // 太阳跟随
    this.sun.position.set(P.x - 5, 12, 8);
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
