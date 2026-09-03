import * as THREE from 'three';
import { CONFIG } from './config.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Level, EntityType } from './level.js';
import { ParticleSystem } from './particles.js';
import { AudioManager } from './audio.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';

const State = {
  MENU: 'menu',
  RUNNING: 'running',
  SUPER_BONUS: 'super_bonus',
  WARP: 'warp',
  PAUSED: 'paused',
  DEAD: 'dead',
};

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false;

    this.world = new World();
    this.player = new Player(this.world.scene);
    this.level = new Level(this.world.scene);
    this.particles = new ParticleSystem(this.world.scene);
    this.audio = new AudioManager();
    this.input = new InputManager();
    this.ui = new UI(this);

    this.state = State.MENU;
    this.speed = CONFIG.baseSpeed;
    this.score = 0;
    this.distance = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.coins = 0;
    this.stomps = 0;
    this.gates = 0;
    this.revivesLeft = CONFIG.maxRevives;
    this.bestScore = Number(localStorage.getItem('deepseek-runner-best') || 0);
    this.bonusTimer = 0;
    this.bonusMult = 1;
    this.warpTimer = 0;
    this.nextBonusAt = 500 + Math.random() * 400;
    this.bonusReturning = false;
    this._lastModeTheme = 'day';
    this.sprintBoost = 0;
    this._bind();
    this._loop();
  }

  _bind() {
    this.input.onJump = () => {
      if (this.state === State.MENU) this.start();
      if (this.state === State.DEAD) {
        if (this.revivesLeft > 0) this.revive();
        return;
      }
      if (this.state === State.RUNNING || this.state === State.SUPER_BONUS || this.state === State.WARP) {
        const kind = this.player.startJump();
        if (kind) this.audio.jump(kind === 2);
      }
    };
    this.input.onSlide = (phase) => {
      if (this.state !== State.RUNNING && this.state !== State.SUPER_BONUS && this.state !== State.WARP) return;
      if (phase === 'press') {
        this.player.startSlide();
        this.audio.noise && 0;
      } else {
        this.player.releaseSlide();
      }
    };
    this.input.onLaneChange = (dir) => {
      if (this.state === State.MENU) return;
      this.player.setLane(this.player.targetLaneIndex + dir);
    };
    this.input.onPause = () => {
      if (this.state === State.RUNNING || this.state === State.SUPER_BONUS || this.state === State.WARP) {
        this.pause();
      } else if (this.state === State.PAUSED) {
        this.resume();
      }
    };
    this.input.onMute = () => this.ui.toggleMute();
    this.input.onAbility = () => this.triggerSprint();

    document.getElementById('btn-start').addEventListener('click', () => this.start());
    document.getElementById('btn-pause').addEventListener('click', () => this.pause());
    document.getElementById('btn-resume').addEventListener('click', () => this.resume());
    document.getElementById('btn-restart').addEventListener('click', () => this.start());
    document.getElementById('btn-retry').addEventListener('click', () => this.start());
    document.getElementById('btn-revive').addEventListener('click', () => this.revive());
    document.getElementById('btn-ability').addEventListener('click', () => this.triggerSprint());
  }

  start() {
    this.audio.init();
    this.audio.resume();
    this.state = State.RUNNING;
    this.speed = CONFIG.baseSpeed;
    this.score = 0;
    this.distance = 0;
    this.combo = 0;
    this.coins = 0;
    this.stomps = 0;
    this.gates = 0;
    this.bonusMult = 1;
    this.nextBonusAt = 500 + Math.random() * 400;
    this.bonusReturning = false;
    this.revivesLeft = CONFIG.maxRevives;
    this.player = new Player(this.world.scene);
    this.level.reset();
    this.world.setTheme('day');
    this.world.setFovBase(CONFIG.cameraFov);
    this.world.setFovBoost(0);
    this.audio.startBgm();
    this.ui.showHud();
    this.ui.hideOverlays();
    this.ui.update(this);
  }

  pause() {
    if (this.state === State.RUNNING || this.state === State.SUPER_BONUS || this.state === State.WARP) {
      this.state = State.PAUSED;
      this.ui.showPause();
    }
  }

  resume() {
    if (this.state === State.PAUSED) {
      this.state = State.RUNNING;
      this.ui.hideOverlays();
    }
  }

  triggerSprint() {
    if (this.state !== State.RUNNING && this.state !== State.SUPER_BONUS && this.state !== State.WARP) return;
    if (this.player.sprinting) return;
    this.player.triggerSprint();
    this.sprintBoost = CONFIG.sprintMultiplier;
    this.audio.sprint();
    this.world.shakeAmount(0.5);
    this.ui.toast('⚡ 冲刺！');
  }

  revive() {
    if (this.revivesLeft <= 0) return;
    this.revivesLeft--;
    this.player.revive();
    this.state = this._lastBonusState() || State.RUNNING;
    this.bonusReturning = false;
    if (this.state === State.WARP) {
      this.warpTimer = Math.max(this.warpTimer, 3);
    }
    this.audio.revive();
    this.audio.startBgm();
    this.ui.hideOverlays();
    this.ui.update(this);
  }

  _lastBonusState() {
    return this._wasInBonus ? this._wasInBonus : State.RUNNING;
  }

  die() {
    this.state = State.DEAD;
    this.audio.gameOver();
    this.audio.stopBgm();
    this.world.shakeAmount(1);
    this.ui.showDead(this);
    const best = Math.max(this.bestScore, Math.round(this.score));
    if (best > this.bestScore) {
      this.bestScore = best;
      localStorage.setItem('deepseek-runner-best', String(best));
    }
  }

  _enterSuperBonus() {
    this.state = State.SUPER_BONUS;
    this.bonusTimer = CONFIG.superBonusDuration;
    this.bonusMult = CONFIG.superBonusMultiplier;
    this.bonusReturning = false;
    this._lastModeTheme = this.world.theme;
    this.world.setTheme('bonus');
    this.player.revive();
    this.player.position.x = 0;
    this.level.spawnBonusCoins();
    this.audio.bonusStart();
    this.ui.toast('✨ 超级奖励！金币翻倍！');
  }

  _enterWarp() {
    this.state = State.WARP;
    this.warpTimer = CONFIG.warpDuration;
    this.bonusMult = 1;
    this.bonusReturning = false;
    this._lastModeTheme = this.world.theme;
    this.world.setTheme('warp');
    this.player.revive();
    this.player.position.x = 0;
    this.level.spawnWarpTrack();
    this.audio.warpStart();
    this.ui.toast('🌀 穿越奖励！全速前进！');
  }

  _exitBonus() {
    if (this.state === State.SUPER_BONUS) {
      this.ui.toast('超级奖励结束，返回赛道');
      this.world.shakeAmount(0.4);
    } else if (this.state === State.WARP) {
      this.ui.toast('穿越结束，返回赛道');
    }
    this.state = State.RUNNING;
    this.bonusMult = 1;
    this.bonusReturning = false;
    this.world.setTheme(this._lastModeTheme);
    this.level.reset();
    this.level.nextSpawnX = this.player.position.x + CONFIG.spawnAhead;
    this.player.revive();
    this.player.position.x += 8;
  }

  update(dt) {
    if (this.state === State.PAUSED || this.state === State.MENU || this.state === State.DEAD) {
      if (this.state === State.DEAD) this.particles.update(dt);
      return;
    }

    const running = this.state === State.RUNNING;
    let speed = this.speed;
    if (this.state === State.WARP) speed = this.speed * CONFIG.warpSpeedMultiplier;
    speed *= this.player.sprinting ? CONFIG.sprintMultiplier : 1;
    this.sprintBoost = Math.max(0, this.sprintBoost - dt);

    this.player.update(dt, speed, this.input);
    this.level.update(this.player.position.x, speed, dt, this.player);
    this.level.updateEntities(dt);
    this.particles.update(dt);

    // 速度递增
    if (running) {
      this.speed = Math.min(CONFIG.maxSpeed, this.speed + CONFIG.speedPerSecond * dt);
      this.distance += speed * dt;
    } else {
      this.distance += speed * dt;
    }

    // 分数
    this.score += speed * dt * 2 * this.bonusMult;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // 奖励倒计时
    if (this.state === State.SUPER_BONUS) {
      this.bonusTimer -= dt;
      this.ui.updateTimer('超级奖励', Math.max(0, Math.ceil(this.bonusTimer)), `x${CONFIG.superBonusMultiplier}`);
      if (this.bonusTimer <= 0) this._exitBonus();
    } else if (this.state === State.WARP) {
      this.warpTimer -= dt;
      this.ui.updateTimer('穿越奖励', Math.max(0, Math.ceil(this.warpTimer)), `x${CONFIG.warpSpeedMultiplier}`);
      if (this.warpTimer <= 0) this._exitBonus();
    } else if (this.ui.timerVisible()) {
      this.ui.hideTimer();
    }

    // 奖励触发
    if (running && !this.player.sprinting) {
      if (this.distance >= this.nextBonusAt) {
        this.nextBonusAt = this.distance + 700 + Math.random() * 500;
        this._wasInBonus = null;
        if (Math.random() < 0.55) this._enterSuperBonus();
        else this._enterWarp();
      }
    }

    // 坐骑与宠物升级
    if (running) {
      if (this.distance >= 800 && !this.player.mounted) {
        this.player.mountOn();
        this.ui.toast('🚀 骑乘疾风悬浮艇！');
      }
      if (this.distance >= 300 && this.player.petLevel === 0) this._levelUpPet();
      if (this.distance >= 1400 && this.player.petLevel === 1) this._levelUpPet();
      if (this.distance >= 2600 && this.player.petLevel === 2) this._levelUpPet();
    }

    // FOV 冲刺拉伸
    const fovBoost = (this.player.sprinting || this.state === State.WARP) ? 14 : 0;
    this.world.setFovBoost(fovBoost);
    this.world.setFovBase(CONFIG.cameraFov + (this.state === State.WARP ? 6 : 0));

    // 碰撞
    this._collide(speed, dt);

    // 掉落判定
    if (this.player.position.y < -12 && (this.state === State.RUNNING || this.state === State.SUPER_BONUS || this.state === State.WARP)) {
      this.die();
      return;
    }

    this.world.update(this.player, speed, dt, running);
    this.ui.update(this);
  }

  _levelUpPet() {
    this.player.levelUpPet();
    this.audio.power();
    const names = ['✨ 小精灵升级！', '✨ 小精灵升到 2 级！', '✨ 小精灵满级！'];
    this.ui.toast(names[this.player.petLevel - 1]);
  }

  _collide(speed, dt) {
    const p = this.player;
    const pMin = new THREE.Vector3(p.position.x - 0.35, p.position.y - p.height / 2, p.position.z - 0.35);
    const pMax = new THREE.Vector3(p.position.x + 0.35, p.position.y + p.height / 2, p.position.z + 0.35);

    for (const e of this.level.entities) {
      const ex = e.group.position.x;
      if (Math.abs(ex - p.position.x) > 3.2) continue;
      const laneDiff = Math.abs(e.group.position.z - p.position.z);

      switch (e.type) {
        case EntityType.COIN: {
          if (e.taken) continue;
          if (laneDiff < 1.0) {
            const coinY = e.group.position.y + 1.0;
            if (Math.abs(coinY - p.position.y) < 1.8) {
              e.taken = true;
              this.collectCoin(e);
            }
          } else if (p.magnetTimer > 0 && laneDiff < 3.4) {
            e.taken = true;
            this.collectCoin(e);
            this.particles.burst(e.group.position, 4, { color: '#ffc857' });
          }
          break;
        }
        case EntityType.POWERUP: {
          if (e.taken) continue;
          if (laneDiff < 1.0 && Math.abs(e.group.position.y + 1.4 - p.position.y) < 1.6) {
            e.taken = true;
            this.sceneRemove(e);
            if (e.kind === 'magnet') {
              p.activateMagnet();
              this.audio.power();
              this.ui.toast('🧲 磁铁启动！金币自动吸附');
            } else {
              p.activateShield();
              this.audio.shield();
              this.ui.toast('🛡 护盾启动！抵挡一次碰撞');
            }
            this.particles.burst(e.group.position, 12, { color: e.kind === 'magnet' ? '#37e6ff' : '#5fffd0' });
          }
          break;
        }
        case EntityType.SPRING: {
          if (e.used) continue;
          if (laneDiff < 0.9 && Math.abs(p.position.y - 0.7) < 0.8) {
            e.used = true;
            e.anim = 0.4;
            p.velY = CONFIG.jumpVelocity * 1.45;
            p.grounded = false;
            p.jumpCount = 1;
            p.diving = false;
            p.sliding = false;
            this.audio.jump();
            this.particles.burst(e.group.position, 10, { color: '#ffc857', vy: 4 });
            this.addScore(15, '弹跳');
          }
          break;
        }
        case EntityType.MONSTER: {
          if (e.dead) continue;
          if (laneDiff < 1.0) {
            const monsterTop = e.group.position.y + 1.3;
            const playerBottom = p.position.y - p.height / 2;
            if (Math.abs(ex - p.position.x) < 0.9 && playerBottom < monsterTop && p.position.y > e.group.position.y + 0.4 && p.velY < 0) {
              e.dead = true;
              this.sceneRemove(e);
              p.velY = CONFIG.jumpVelocity * 0.82;
              p.grounded = false;
              p.jumpCount = 1;
              this.stomps++;
              this.audio.stomp();
              this.addScore(20, '踩踏');
              this.combo++;
              this.comboTimer = 2.5;
              this.particles.burst(e.group.position, 14, { color: '#ff6b6b' });
              this.world.shakeAmount(0.35);
            } else if (Math.abs(ex - p.position.x) < 0.85 && laneDiff < 0.9 && playerBottom < monsterTop && playerBottom > e.group.position.y - 0.2) {
              if (!this._tryHurt(e)) break;
            }
          }
          break;
        }
        case EntityType.OBSTACLE: {
          if (laneDiff >= 1.1) continue;
          const pLeft = pMin.x + 0.05, pRight = pMax.x - 0.05;
          const eLeft = ex - e.size.x / 2, eRight = ex + e.size.x / 2;
          if (pRight < eLeft || pLeft > eRight) continue;
          if (e.kind === 'barrier') {
            if (p.position.y - p.height / 2 < 1.0) this._tryHurt(e);
          } else if (e.kind === 'wall') {
            this._tryHurt(e);
          } else if (e.kind === 'overhang') {
            const headTop = p.position.y + p.height / 2;
            if (!p.sliding && headTop > 1.55 && p.position.y - p.height / 2 < 2.3) this._tryHurt(e);
          }
          break;
        }
        case EntityType.GATE: {
          if (e.passed) continue;
          if (laneDiff < 1.0 && Math.abs(ex - p.position.x) < 1.2 && Math.abs(e.group.position.y + 2.0 - p.position.y) < 2.4) {
            e.passed = true;
            this.gates++;
            this.addScore(50, '穿越');
            this.audio.coinCombo(this.gates);
            this.particles.burst(e.group.position, 10, { color: '#b06bff' });
          }
          break;
        }
      }
    }
  }

  _tryHurt(e) {
    const p = this.player;
    if (p.hit()) {
      this.audio.hit();
      this.world.shakeAmount(0.8);
      this.particles.burst(p.position.clone().add(new THREE.Vector3(0, 1, 0)), 16, { color: '#ff6b6b' });
      if (p.shieldTimer > 0) {
        this.ui.toast('🛡 护盾抵挡了碰撞！');
      }
      return true;
    }
    this.die();
    return false;
  }

  collectCoin(e) {
    const base = 5;
    const gained = Math.round(base * (1 + Math.min(this.combo, 10) * 0.1) * this.bonusMult);
    this.coins++;
    this.combo++;
    this.comboTimer = 2.5;
    this.score += gained;
    this.audio.coinCombo(this.combo);
    this.sceneRemove(e);
    this.particles.burst(e.group.position, 4, { color: '#ffc857', vy: 2 });
  }

  addScore(v, label) {
    this.score += v * this.bonusMult;
  }

  sceneRemove(e) {
    this.world.scene.remove(e.group);
    const idx = this.level.entities.indexOf(e);
    if (idx >= 0) this.level.entities.splice(idx, 1);
  }

  _loop = () => {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clockDelta());
    this.update(dt);
    this.renderer.render(this.world.scene, this.world.camera);
  };

  clockDelta() {
    const now = performance.now() / 1000;
    const dt = this._lastTime ? now - this._lastTime : 0.016;
    this._lastTime = now;
    return dt;
  }
}