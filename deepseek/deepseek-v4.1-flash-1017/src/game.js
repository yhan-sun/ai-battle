import {
  CONFIG,
  THEMES,
  findMount,
  findPet,
} from './config.js';
import { clamp, formatNumber, rand } from './utils.js';
import { Input } from './input.js';
import { SaveStore } from './save.js';
import { AudioSystem } from './audio.js';
import { Assets } from './assets.js';
import { Particles } from './particles.js';
import { Environment } from './environment.js';
import { World } from './world.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { UI } from './ui.js';

/**
 * 游戏主控：状态机、物理循环、碰撞、计分、奖励场景切换、存档与界面同步。
 *
 * 状态：menu → playing ⇄ paused → dead → revive / gameover
 * 模式：main ⇄ super / travel
 */
export class Game {
  constructor({ scene, camera, renderer }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.save = new SaveStore();
    this.audio = new AudioSystem(this.save);
    this.input = new Input();
    this.input.attach();
    this.assets = new Assets();
    this.environment = new Environment(scene);
    this.particles = new Particles(scene, 800);
    this.world = new World(scene, this.assets);
    this.player = new Player(scene, this.assets);
    this.cameraRig = new CameraRig(camera);
    this.ui = new UI();

    this.time = 0;
    this.state = 'menu';
    this.mode = 'main';
    this.cameraMode = 'menu';
    this.currentSpeed = 0;
    this.transition = null;

    this.loadout = {
      mount: this.save.data.mount,
      pet: this.save.data.pet,
    };
    this.player.setLoadout(this.loadout.mount, this.loadout.pet);

    this.resetRunState();
    this.distance = 0;
    this.themeIndex = 0;

    this.environment.setTheme(0);
    this.environment.setMode('main');
    this.world.reset('main');
    this.world.startTrack(0, 'main');
    this.world.updateTheme(this.environment.palette, 0.016);
    this.player.reset();
    this.cameraRig.setMode('menu');
    this.ui.setFade(0);

    this.ui.bind({
      start: () => this.handleStart(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      restart: () => this.startRun(),
      quit: () => this.quitToMenu(),
      revive: () => this.revive(),
      giveUp: () => this.giveUp(),
      retry: () => this.startRun(),
      menu: () => this.quitToMenu(),
      mute: () => this.toggleMute(),
      select: (kind, id) => this.selectLoadout(kind, id),
      touch: (action, pressed) => this.handleTouch(action, pressed),
    });

    this.ui.showStart({
      highScore: this.save.data.highScore,
      bestDistance: this.save.data.bestDistance,
      totalCoins: this.save.data.totalCoins,
      mount: this.loadout.mount,
      pet: this.loadout.pet,
      muted: this.save.data.muted,
    });
    this.ui.setMuted(this.save.data.muted);

    this.bindWindowEvents();
  }

  resetRunState() {
    this.scoreFloat = 0;
    this.runCoins = 0;
    this.distance = 0;
    this.currentSpeed = 0;
    this.energy = 0;
    this.superMeter = 0;
    this.superQueued = false;
    this.superDelay = 0;
    this.power = { magnet: 0, double: 0, shield: false };
    this.dashTimer = 0;
    this.invincible = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.rewards = 0;
    this.revivesUsed = 0;
    this.deathTimer = 0;
    this.reviveTimer = 0;
    this.reviveShown = false;
    this.runCommitted = false;
    this.nextThemeAt = 650;
    this.nextPortalAt = CONFIG.reward.portalFirst;
    this.portalScheduled = false;
    this.reward = null;
    this.petTimer = 0;
    this.beeTimer = 26;
    this.transition = null;
    this.cameraMode = 'main';
  }

  bindWindowEvents() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.autoPause();
    });
    window.addEventListener('blur', () => this.autoPause());
  }

  // ------------------------------------------------------------------
  // 流程控制
  // ------------------------------------------------------------------

  handleStart() {
    if (this.state !== 'menu') return;
    this.audio.unlock();
    this.audio.click();
    this.startRun();
  }

  selectLoadout(kind, id) {
    if (this.state !== 'menu') return;
    if (kind !== 'mount' && kind !== 'pet') return;
    this.loadout[kind] = id;
    this.save.patch({ [kind]: id });
    this.player.setLoadout(this.loadout.mount, this.loadout.pet);
    this.ui.setLoadout(this.loadout.mount, this.loadout.pet);
    this.audio.unlock();
    this.audio.click();
  }

  startRun() {
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'dead') {
      this.commitRun();
    }

    this.ui.hideStart();
    this.ui.hidePause();
    this.ui.hideRevive();
    this.ui.hideGameOver();
    this.ui.hideToast();
    this.ui.hideRewardBanner();

    this.resetRunState();
    this.themeIndex = 0;
    this.mode = 'main';
    this.state = 'playing';
    this.currentSpeed = CONFIG.speed.start;

    this.player.setLoadout(this.loadout.mount, this.loadout.pet);
    this.player.reset();
    this.player.setInvincible(true);
    this.player.setShield(false);
    this.player.setDashing(false);

    this.world.reset('main');
    this.world.startTrack(0, 'main');
    this.environment.setTheme(0);
    this.environment.setMode('main');
    this.cameraRig.setMode('main');
    this.cameraMode = 'main';

    this.invincible = CONFIG.player.startInvincible;

    const pet = findPet(this.loadout.pet);
    if (pet.id === 'bee') {
      this.power.shield = true;
      this.player.setShield(true);
    }

    this.ui.showHUD();
    this.ui.setFade(0);
    this.audio.unlock();
    this.audio.startMusic();
    this.audio.duckMusic(false);
    this.audio.powerup();

    this.ui.toast('星轨已点亮', '收集金币充满超级奖励', 2200);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.audio.duckMusic(true);
    this.ui.showPause();
    this.input.clear();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hidePause();
    this.audio.duckMusic(false);
    this.input.clear();
  }

  autoPause() {
    // 窗口失焦或页面隐藏时自动暂停，避免跑图时被后台事件影响成绩。
    if (this.state === 'playing') this.pause();
  }

  quitToMenu() {
    if (this.state === 'menu') return;
    this.commitRun();
    this.state = 'menu';
    this.mode = 'main';
    this.cameraMode = 'menu';
    this.currentSpeed = 0;
    this.distance = 0;
    this.themeIndex = 0;
    this.reward = null;
    this.transition = null;

    this.ui.hidePause();
    this.ui.hideRevive();
    this.ui.hideGameOver();
    this.ui.hideRewardBanner();
    this.ui.hideHUD();
    this.ui.hideToast();
    this.ui.setFade(0);

    this.player.reset();
    this.player.setInvincible(false);
    this.player.setShield(false);
    this.player.setDashing(false);

    this.world.reset('main');
    this.world.startTrack(0, 'main');
    this.environment.setMode('main');
    this.environment.setTheme(0);
    this.cameraRig.setMode('menu');

    this.audio.stopMusic();
    this.audio.duckMusic(false);

    this.ui.showStart({
      highScore: this.save.data.highScore,
      bestDistance: this.save.data.bestDistance,
      totalCoins: this.save.data.totalCoins,
      mount: this.loadout.mount,
      pet: this.loadout.pet,
      muted: this.save.data.muted,
    });
  }

  // ------------------------------------------------------------------
  // 死亡与结算
  // ------------------------------------------------------------------

  die(cause = 'hit') {
    if (this.state !== 'playing' || this.mode !== 'main') return;
    if (this.reward) return;
    this.state = 'dead';
    this.deathTimer = 0;
    this.reviveTimer = 5;
    this.reviveShown = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.dashTimer = 0;
    this.cameraMode = 'death';
    this.cameraRig.setMode('death');
    this.cameraRig.addShake(0.65);
    this.player.setDashing(false);
    this.player.setInvincible(false);
    this.player.die();
    this.audio.hit();
    this.audio.duckMusic(true);
    this.ui.flashDamage();
    this.ui.hideRewardBanner();
    this.ui.toast(cause === 'fall' ? '坠入星渊' : '撞击！', '抓住复活机会继续奔跑', 1200);

    this.particles.burst(
      { x: 0, y: Math.max(0.8, this.player.y + 0.8), z: 0 },
      {
        count: 34,
        colors: [0xff5470, 0xffa36b, 0xffffff, 0x8a6bff],
        speed: 8,
        size: 0.38,
        life: 0.95,
        gravity: 14,
      },
    );
  }

  revive() {
    if (this.state !== 'dead' || !this.reviveShown) return;
    const free = this.revivesUsed === 0;
    const cost = CONFIG.reward.reviveCost;
    if (!free && this.save.data.totalCoins < cost) return;
    if (!free) {
      this.save.patch({ totalCoins: this.save.data.totalCoins - cost });
    }

    this.revivesUsed += 1;
    this.state = 'playing';
    this.mode = 'main';
    this.cameraMode = 'main';
    this.reward = null;
    this.transition = null;
    this.deathTimer = 0;
    this.reviveShown = false;
    this.reviveTimer = 0;
    this.portalScheduled = false;
    this.nextPortalAt = Math.max(this.nextPortalAt, this.distance + 320);
    this.superQueued = false;
    this.superDelay = 0;

    this.ui.hideRevive();
    this.ui.setFade(0);
    this.player.reviveVisual();
    this.player.setInvincible(true);
    this.player.setShield(true);
    this.player.setDashing(false);
    this.power.shield = true;
    this.power.magnet = 0;
    this.power.double = 0;

    this.world.reset('main');
    this.world.startTrack(this.distance, 'main');
    this.environment.setMode('main');
    this.environment.setTheme(this.themeIndex);
    this.cameraRig.setMode('main');
    this.cameraRig.addShake(0.25);

    this.invincible = CONFIG.player.reviveInvincible;
    this.currentSpeed = this.computeSpeed();
    this.audio.revive();
    this.audio.duckMusic(false);
    this.ui.toast('复活成功', '护盾已展开，前方生成安全跑道', 1800);
  }

  giveUp() {
    if (this.state !== 'dead') return;
    this.gameOver();
  }

  commitRun() {
    if (this.runCommitted) {
      return {
        score: Math.floor(this.scoreFloat),
        isRecord: false,
        bank: this.save.data.totalCoins,
      };
    }
    this.runCommitted = true;
    const score = Math.floor(this.scoreFloat);
    const isRecord = score > this.save.data.highScore;
    const bank = this.save.data.totalCoins + this.runCoins;
    this.save.patch({
      highScore: Math.max(score, this.save.data.highScore),
      bestDistance: Math.max(Math.floor(this.distance), this.save.data.bestDistance),
      totalCoins: bank,
      runs: this.save.data.runs + 1,
    });
    return { score, isRecord, bank };
  }

  gameOver() {
    if (this.state === 'gameover') return;
    const result = this.commitRun();
    const runCoins = this.runCoins;

    this.state = 'gameover';
    this.mode = 'main';
    this.cameraMode = 'gameover';
    this.cameraRig.setMode('gameover');
    this.currentSpeed = 0;
    this.reward = null;
    this.transition = null;
    this.ui.setFade(0);
    this.ui.hideRevive();
    this.ui.hideHUD();
    this.ui.hideRewardBanner();

    this.ui.showGameOver({
      score: result.score,
      distance: this.distance,
      coins: runCoins,
      combo: this.maxCombo,
      rewards: this.rewards,
      best: this.save.data.highScore,
      isRecord: result.isRecord,
      bank: result.bank,
    });

    this.audio.stopMusic();
    this.audio.duckMusic(false);
    this.audio.gameOver();
    if (result.isRecord) {
      window.setTimeout(() => {
        if (this.state === 'gameover') this.audio.record();
      }, 600);
    }
  }

  // ------------------------------------------------------------------
  // 输入
  // ------------------------------------------------------------------

  handleTouch(action, pressed) {
    if (action === 'skill') {
      if (pressed) this.input.pressVirtual('skill');
      else this.input.releaseVirtual('skill');
      return;
    }
    if (pressed) this.input.pressVirtual(action);
    else this.input.releaseVirtual(action);
  }

  toggleMute() {
    this.audio.unlock();
    const muted = !this.save.data.muted;
    this.save.patch({ muted });
    this.audio.setMuted(muted);
    this.ui.setMuted(muted);
    if (!muted) this.audio.click();
  }

  // ------------------------------------------------------------------
  // 主循环
  // ------------------------------------------------------------------

  update(dt) {
    const step = Math.min(dt, 0.05);
    this.time += step;
    this.input.update(step);

    if (this.input.consume('mute')) this.toggleMute();
    if (this.state !== 'paused') this.updateTransition(step);

    if (this.state === 'menu') this.updateMenu(step);
    else if (this.state === 'playing') this.updatePlaying(step);
    else if (this.state === 'paused') this.updatePaused(step);
    else if (this.state === 'dead') this.updateDead(step);
    else if (this.state === 'gameover') this.updateGameover(step);

    if (this.state !== 'paused') this.particles.update(step);

    this.cameraRig.update(step, {
      playerY: this.player.y,
      speed: this.state === 'playing' ? this.currentSpeed : 0,
      mode: this.cameraMode,
      time: this.time,
    });

    this.input.endFrame();
  }

  updateTransition(dt) {
    if (!this.transition) return;
    const transition = this.transition;
    transition.t += dt;
    const progress = clamp(transition.t / transition.duration, 0, 1);
    const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
    this.ui.setFade(alpha);

    if (!transition.fired && progress >= 0.5) {
      transition.fired = true;
      transition.callback();
    }
    if (progress >= 1) {
      this.transition = null;
      this.ui.setFade(0);
    }
  }

  startTransition(callback, duration = 0.9) {
    if (this.transition) return;
    this.transition = { t: 0, duration, callback, fired: false };
  }

  updateMenu(dt) {
    if (this.input.consume('start')) {
      this.audio.unlock();
      this.startRun();
      return;
    }
    this.environment.update(dt, 4.5, 'main');
    this.world.updateTheme(this.environment.palette, dt);
    this.player.updateIdle(dt);
  }

  updatePaused(dt) {
    if (this.input.consume('pause') || this.input.consume('start')) {
      this.resume();
    }
  }

  updatePlaying(dt) {
    if (this.input.consume('pause')) {
      this.pause();
      return;
    }

    this.tickTimers(dt);

    const speed = this.mode === 'main'
      ? this.computeSpeed()
      : this.mode === 'super'
        ? CONFIG.reward.superSpeed
        : CONFIG.reward.travelSpeed;

    this.currentSpeed = speed;
    const dx = speed * dt;
    this.distance += dx;
    this.scoreFloat += dx * CONFIG.score.perMeter * this.getScoreMultiplier();

    this.handleGameplayInput();

    this.world.update(dt, {
      speed,
      mode: this.mode,
      magnet: this.power.magnet > 0,
      playerY: this.player.getCenterY(),
    });
    this.world.updateTheme(this.environment.palette, dt);
    this.environment.update(dt, speed, this.mode);

    const floorUnder = this.world.hasFloorAt(0);
    this.player.update(dt, speed, floorUnder);

    if (this.player.fell) {
      this.player.fell = false;
      if (this.transition) {
        // 过渡淡出期间不因坑洞中断流程
        this.player.y = 0;
        this.player.vy = 0;
        this.player.grounded = true;
      } else if (this.mode === 'main') {
        this.die('fall');
      }
    }

    if (this.state === 'playing') this.handleCollisions();
    if (this.state !== 'playing') return;

    this.updatePet(dt);
    this.maybeChangeTheme();
    this.updatePortal(dt);
    this.maybeStartSuper(dt);

    if (this.mode !== 'main' && this.reward && !this.reward.ending) {
      this.reward.remaining -= dt;
      this.ui.updateReward(this.reward.remaining, this.reward.duration);
      if (this.reward.remaining <= 0) this.endReward();
    }

    if (this.dashTimer > 0) {
      this.particles.emit(
        { x: 0, y: this.player.y + 0.75, z: 0 },
        { colors: [0x63f4ff, 0x8a6bff, 0xd8f6ff], size: 0.4, life: 0.38, speed: 0.5, gravity: 0 },
      );
    }

    this.ui.updateHUD({
      score: Math.floor(this.scoreFloat),
      distance: this.distance,
      coins: this.runCoins,
      speed: this.currentSpeed,
      superMeter: this.mode === 'main' ? this.superMeter : 0,
      combo: this.comboTimer > 0 ? this.combo : 0,
      comboMult: this.getComboMult(),
      magnet: this.power.magnet,
      shield: this.power.shield,
      double: this.power.double,
      energy: this.energy,
      dashing: this.dashTimer > 0,
    });
  }

  updateDead(dt) {
    this.player.update(dt, 0, true);
    this.environment.update(dt, 0, 'main');
    this.world.updateTheme(this.environment.palette, dt);
    this.deathTimer += dt;

    if (!this.reviveShown && this.deathTimer > 0.68) {
      this.reviveShown = true;
      this.reviveTimer = 5;
      this.ui.showRevive({
        free: this.revivesUsed === 0,
        cost: CONFIG.reward.reviveCost,
        bank: this.save.data.totalCoins,
      });
    }

    if (this.reviveShown) {
      this.reviveTimer -= dt;
      const free = this.revivesUsed === 0;
      const affordable = free || this.save.data.totalCoins >= CONFIG.reward.reviveCost;
      this.ui.updateRevive(this.reviveTimer, affordable);
      if (this.reviveTimer <= 0) this.gameOver();
    }
  }

  updateGameover(dt) {
    if (this.input.consume('start') || this.input.consume('restart')) {
      this.startRun();
      return;
    }
    this.player.update(dt, 0, true);
    this.environment.update(dt, 2.5, 'main');
    this.world.updateTheme(this.environment.palette, dt);
  }

  // ------------------------------------------------------------------
  // 玩法
  // ------------------------------------------------------------------

  handleGameplayInput() {
    if (this.state !== 'playing') return;
    if (this.input.consumeJump()) {
      const result = this.player.requestJump();
      if (result === 'jump') {
        this.audio.jump();
        this.particles.burst(
          { x: 0, y: 0.12, z: 0 },
          { count: 8, colors: [0xfff3b0, 0xffd257, 0xffffff], speed: 3.2, size: 0.24, life: 0.42, gravity: 8 },
        );
      } else if (result === 'double') {
        this.audio.doubleJump();
        this.particles.burst(
          { x: 0, y: this.player.y + 0.7, z: 0 },
          { count: 14, colors: [0x63f4ff, 0xbafaff, 0x8a6bff], speed: 4.5, size: 0.28, life: 0.5, gravity: 2, spread: 0.7 },
        );
      }
    }

    this.player.setCrouch(this.input.isDown('crouch'));

    if (this.input.consume('skill')) this.activateDash();
  }

  tickTimers(dt) {
    if (this.invincible > 0) {
      this.invincible = Math.max(0, this.invincible - dt);
      this.player.setInvincible(this.invincible > 0);
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.dashTimer = 0;
        this.player.setDashing(false);
      }
    }

    if (this.power.magnet > 0) this.power.magnet = Math.max(0, this.power.magnet - dt);
    if (this.power.double > 0) this.power.double = Math.max(0, this.power.double - dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.combo = 0;
      }
    }

    if (this.power.shield) this.player.setShield(true);
    else this.player.setShield(false);
  }

  computeSpeed() {
    const mount = findMount(this.loadout.mount);
    const progress = clamp(this.distance / CONFIG.speed.rampDistance, 0, 1);
    let speed = CONFIG.speed.start + (CONFIG.speed.max - CONFIG.speed.start) * progress;
    speed *= mount.speed;
    if (this.dashTimer > 0) speed *= CONFIG.speed.dashMultiplier;
    return speed;
  }

  getComboMult() {
    if (this.combo <= 0) return 1;
    return Math.min(
      CONFIG.score.comboMax,
      1 + Math.floor(this.combo / CONFIG.score.comboStep),
    );
  }

  getScoreMultiplier() {
    let multiplier = 1;
    if (this.power.double > 0) multiplier *= 2;
    if (this.mode === 'super') multiplier *= CONFIG.reward.superMultiplier;
    else if (this.mode === 'travel') multiplier *= CONFIG.reward.travelMultiplier;
    return multiplier;
  }

  addScore(amount) {
    this.scoreFloat += amount;
  }

  activateDash() {
    if (this.energy < 100 || this.dashTimer > 0) return;
    this.energy = 0;
    this.dashTimer = 1.35;
    this.invincible = Math.max(this.invincible, 1.4);
    this.player.setDashing(true);
    this.player.setInvincible(true);
    this.audio.dash();
    this.cameraRig.addShake(0.22);
    this.ui.toast('疾风冲刺', '撞碎前方障碍，短暂无敌', 1300);
    this.particles.burst(
      { x: -0.2, y: this.player.y + 0.7, z: 0 },
      { count: 24, colors: [0x63f4ff, 0xffffff, 0x8a6bff], speed: 7, size: 0.32, life: 0.6, gravity: 3 },
    );
  }

  updatePet(dt) {
    const pet = findPet(this.loadout.pet);
    this.petTimer += dt;

    if (pet.id === 'fox') {
      if (this.petTimer >= 0.32) {
        this.petTimer = 0;
        const collected = this.world.collectNear(this.player.getCenterY(), 3.2, 2.4);
        if (collected.length > 0) this.onCoins(collected);
      }
    } else if (pet.id === 'bee') {
      this.beeTimer -= dt;
      if (this.beeTimer <= 0) {
        this.beeTimer = 26;
        if (!this.power.shield) {
          this.power.shield = true;
          this.player.setShield(true);
          this.audio.magic();
          this.ui.toast('护卫蜂', '已补充一层护盾', 1300);
        }
      }
    }
  }

  maybeChangeTheme() {
    if (this.mode !== 'main') return;
    if (this.distance < this.nextThemeAt) return;
    this.themeIndex = (this.themeIndex + 1) % THEMES.length;
    const theme = this.environment.setTheme(this.themeIndex);
    this.nextThemeAt += 680;
    this.ui.toast(theme.name, '地形主题切换', 1700);
    this.audio.magic();
  }

  updatePortal(dt) {
    if (this.mode !== 'main') return;

    if (!this.portalScheduled && !this.transition && this.distance >= this.nextPortalAt - 62) {
      this.world.spawnPortal(62);
      if (this.world.getPortal()) {
        this.portalScheduled = true;
        this.audio.portal();
        this.ui.toast('穿越之门出现', '撞入传送门进入高速时空', 1500);
      }
    }

    if (this.portalScheduled && !this.world.getPortal() && !this.transition) {
      this.portalScheduled = false;
      this.nextPortalAt = this.distance + rand(300, 480);
    }
  }

  maybeStartSuper(dt) {
    if (this.mode !== 'main' || this.transition) return;
    if (this.superQueued) {
      this.superDelay -= dt;
      if (this.superDelay <= 0) {
        this.superQueued = false;
        this.superMeter = 0;
        this.startTransition(() => this.beginReward('super'), 0.9);
      }
      return;
    }
    if (this.superMeter >= 100) {
      this.superQueued = true;
      this.superDelay = 0.55;
      this.audio.superReady();
      this.ui.toast('超级奖励就绪', '即将切换黄金场景', 1400);
    }
  }

  // ------------------------------------------------------------------
  // 碰撞
  // ------------------------------------------------------------------

  handleCollisions() {
    const box = this.player.getBox();
    const centerY = this.player.getCenterY();

    const coins = this.world.collectCoins(centerY);
    if (coins.length > 0) this.onCoins(coins);

    if (this.mode !== 'main') return;

    for (const pickup of this.world.pickups) {
      if (pickup.userData.dead) continue;
      const half = 0.72;
      const left = pickup.position.x - half;
      const right = pickup.position.x + half;
      const bottom = pickup.position.y - half;
      const top = pickup.position.y + half;
      if (
        box.right > left &&
        box.left < right &&
        box.top > bottom &&
        box.bottom < top
      ) {
        this.onPickup(pickup);
      }
    }

    const portal = this.world.getPortal();
    if (portal) {
      if (Math.abs(portal.position.x) < 1.5 && box.top > 0.4 && box.bottom < 3.5) {
        this.onPortal();
      }
    }

    if (this.transition) return;

    for (const obstacle of this.world.obstacles) {
      const ud = obstacle.userData;
      if (ud.dead) continue;
      const left = obstacle.position.x + (ud.ox || 0) - ud.w / 2;
      const right = obstacle.position.x + (ud.ox || 0) + ud.w / 2;
      const bottom = ud.oy;
      const top = ud.oy + ud.h;
      const horizontal = box.right > left + 0.04 && box.left < right - 0.04;
      const vertical = box.top > bottom + 0.05 && box.bottom < top - 0.08;
      if (!horizontal || !vertical) continue;

      if (this.dashTimer > 0) {
        this.world.destroyObstacle(obstacle);
        this.addScore(CONFIG.score.dashBreak * this.getScoreMultiplier());
        this.audio.stomp();
        this.cameraRig.addShake(0.12);
        this.particles.burst(
          { x: Math.max(-1, Math.min(1, obstacle.position.x)), y: bottom + ud.h * 0.5, z: 0 },
          { count: 14, colors: [0xffd257, 0xffffff, 0x63f4ff], speed: 6, size: 0.28, life: 0.5, gravity: 10 },
        );
        continue;
      }

      if (ud.stompable && this.player.vy < -1.0 && box.bottom >= top - 0.62) {
        this.world.destroyObstacle(obstacle);
        this.player.bounce();
        this.addScore(CONFIG.score.stomp * this.getScoreMultiplier());
        this.audio.stomp();
        this.cameraRig.addShake(0.18);
        this.particles.burst(
          { x: 0, y: top, z: 0 },
          { count: 18, colors: [0x4be3a2, 0x63f4ff, 0xffffff], speed: 5.5, size: 0.3, life: 0.55, gravity: 12 },
        );
        continue;
      }

      this.hitObstacle(obstacle);
      if (this.state !== 'playing') return;
    }
  }

  hitObstacle(obstacle) {
    if (this.invincible > 0) return;
    if (this.power.shield) {
      this.power.shield = false;
      this.player.setShield(false);
      this.world.destroyObstacle(obstacle);
      this.invincible = 1.3;
      this.player.setInvincible(true);
      this.audio.shieldBreak();
      this.cameraRig.addShake(0.3);
      this.ui.flashDamage();
      this.ui.toast('护盾破碎', '获得 1.3 秒无敌', 1200);
      this.particles.burst(
        { x: 0, y: this.player.y + 0.9, z: 0 },
        { count: 26, colors: [0x63f4ff, 0xbafaff, 0xffffff], speed: 7, size: 0.34, life: 0.65, gravity: 4 },
      );
      return;
    }
    this.die('hit');
  }

  onCoins(coins) {
    for (const coin of coins) {
      this.runCoins += 1;
      this.combo += 1;
      this.comboTimer = CONFIG.score.comboWindow;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.addScore(CONFIG.score.coin * this.getComboMult() * this.getScoreMultiplier());
      this.energy = Math.min(100, this.energy + 3.6);
      if (this.mode === 'main') {
        this.superMeter = Math.min(100, this.superMeter + CONFIG.reward.superCoinGain);
      } else if (this.reward) {
        this.reward.coins += 1;
      }
      this.particles.emit(
        { x: coin.x, y: coin.y, z: coin.z },
        { colors: [0xffd257, 0xfff3b0, 0xffffff], size: 0.3, life: 0.48, speed: 1.6, gravity: 3 },
      );
    }
    this.audio.coin();
  }

  onPickup(pickup) {
    const type = pickup.userData.type;
    this.world.collectPickup(pickup);
    this.audio.powerup();
    this.particles.burst(
      { x: pickup.position.x, y: pickup.position.y, z: 0 },
      { count: 20, colors: [0x63f4ff, 0xffd257, 0xffffff], speed: 5.5, size: 0.32, life: 0.6, gravity: 4 },
    );

    if (type === 'magnet') {
      this.power.magnet = Math.min(15, this.power.magnet + 8);
      this.ui.toast('金币磁铁', '8 秒内自动吸附附近金币', 1400);
    } else if (type === 'shield') {
      if (this.power.shield) {
        this.addScore(400 * this.getScoreMultiplier());
        this.ui.toast('护盾已满', '转化为 400 表现分', 1200);
      } else {
        this.power.shield = true;
        this.player.setShield(true);
        this.ui.toast('护盾展开', '可抵挡一次撞击', 1400);
      }
    } else {
      this.power.double = Math.min(18, this.power.double + 10);
      this.ui.toast('双倍表现分', '10 秒内表现分 ×2', 1400);
    }
  }

  onPortal() {
    if (this.transition) return;
    this.world.removePortal();
    this.portalScheduled = false;
    this.nextPortalAt = this.distance + rand(650, 880);
    this.audio.portal();
    this.ui.toast('穿越时空', '高速隧道即将开启', 1200);
    this.startTransition(() => this.beginReward('travel'), 0.9);
  }

  // ------------------------------------------------------------------
  // 奖励场景
  // ------------------------------------------------------------------

  beginReward(type) {
    if (this.state !== 'playing') return;
    const duration = type === 'super' ? CONFIG.reward.superDuration : CONFIG.reward.travelDuration;
    const multiplier = type === 'super' ? CONFIG.reward.superMultiplier : CONFIG.reward.travelMultiplier;

    this.mode = type;
    this.rewards += 1;
    this.reward = {
      type,
      duration,
      remaining: duration,
      multiplier,
      coins: 0,
      bonus: 0,
      ending: false,
    };
    this.superQueued = false;
    this.superMeter = 0;
    this.superDelay = 0;
    this.portalScheduled = false;
    this.dashTimer = 0;
    this.player.setDashing(false);
    this.player.setCrouch(false);
    this.player.setInvincible(false);
    this.invincible = 0;
    this.currentSpeed = type === 'super' ? CONFIG.reward.superSpeed : CONFIG.reward.travelSpeed;

    this.world.reset(type);
    this.world.startTrack(this.distance, type);
    this.environment.setMode(type);
    this.cameraRig.setMode(type);
    this.cameraMode = type;
    this.ui.showRewardBanner(type, duration, multiplier);
    this.audio.reward(type);
    this.audio.duckMusic(false);
    this.cameraRig.addShake(0.22);

    this.particles.burst(
      { x: 0, y: 1.2, z: 0 },
      {
        count: 46,
        colors: type === 'super'
          ? [0xffd257, 0xfff3b0, 0xff8a5c, 0xffffff]
          : [0x63f4ff, 0x8a6bff, 0xffffff, 0xff4fb7],
        speed: 9,
        size: 0.4,
        life: 1.2,
        gravity: 6,
      },
    );

    this.ui.toast(
      type === 'super' ? '进入超级奖励' : '进入穿越奖励',
      type === 'super' ? '黄金金币雨 · 表现分 ×3' : '高速时空隧道 · 表现分 ×4',
      1800,
    );
  }

  endReward() {
    if (!this.reward || this.reward.ending) return;
    this.reward.ending = true;
    const bonus = this.reward.type === 'super'
      ? CONFIG.reward.superBonus
      : CONFIG.reward.travelBonus;
    this.reward.bonus = bonus;
    this.addScore(bonus);
    this.startTransition(() => this.finishReward(), 0.9);
  }

  finishReward() {
    if (!this.reward) return;
    const reward = this.reward;
    const type = reward.type;
    const bonus = reward.bonus;
    this.reward = null;
    this.mode = 'main';
    this.cameraMode = 'main';
    this.superMeter = 0;
    this.superQueued = false;
    this.superDelay = 0;
    this.dashTimer = 0;
    this.player.setDashing(false);
    this.player.setCrouch(false);

    this.world.reset('main');
    this.world.startTrack(this.distance, 'main');
    this.environment.setMode('main');
    this.environment.setTheme(this.themeIndex);
    this.cameraRig.setMode('main');
    this.cameraRig.addShake(0.15);

    this.invincible = 2.0;
    this.player.setInvincible(true);
    this.player.setShield(this.power.shield);

    // 若穿越门在奖励期间已经到期，返回后短暂缓冲就放行，避免超级奖励连续触发导致穿越长期不出现。
    if (this.nextPortalAt < this.distance + 80) {
      this.nextPortalAt = this.distance + 80;
    }
    this.portalScheduled = false;

    this.ui.hideRewardBanner();
    this.ui.toast(
      type === 'super' ? '超级奖励完成' : '穿越完成',
      `奖励加成 +${formatNumber(bonus)} 表现分`,
      1900,
    );
    this.audio.powerup();
  }
}
