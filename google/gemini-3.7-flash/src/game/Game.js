import * as THREE from 'three';
import { Player, PlayerState } from './Player.js';
import { LevelGenerator, Biome } from './LevelGenerator.js';
import { ObstacleManager, ObstacleType } from './Obstacles.js';
import { CollectibleManager, ItemType } from './Collectibles.js';
import { ParticleSystem } from './ParticleSystem.js';
import { ParallaxBackground } from './ParallaxBackground.js';
import { CameraManager } from './CameraManager.js';
import { SoundSynth } from '../audio/SoundSynth.js';

export const GameState = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  SUPER_REWARD: 'SUPER_REWARD',
  WARP_REWARD: 'WARP_REWARD',
  PAUSED: 'PAUSED',
  REVIVE_COUNTDOWN: 'REVIVE_COUNTDOWN',
  GAMEOVER: 'GAMEOVER'
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = GameState.MENU;

    // Three.js Core
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050814);
    this.scene.fog = new THREE.FogExp2(0x050814, 0.015);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 400);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Subsystems
    this.sound = new SoundSynth();
    this.particles = new ParticleSystem(this.scene);
    this.cameraMgr = new CameraManager(this.camera, this.scene);
    this.parallax = new ParallaxBackground(this.scene);
    this.obsMgr = new ObstacleManager(this.scene, this.particles);
    this.itemMgr = new CollectibleManager(this.scene, this.particles);
    this.levelGen = new LevelGenerator(this.scene, this.obsMgr, this.itemMgr);
    this.player = new Player(this.scene, this.sound, this.particles);

    // Gameplay Metrics & Scoring
    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.scoreMultiplier = 1.0;
    this.baseSpeed = 13.5;
    this.currentSpeed = 13.5;
    
    // Reward Stage Energies & Timers
    this.superEnergy = 0; // 0 to 100
    this.warpEnergy = 0;  // 0 to 100
    this.rewardTimer = 0;
    this.rewardDuration = 10;
    this.previousState = GameState.PLAYING;

    // Revive mechanic
    this.hasUsedRevive = false;
    this.reviveTimer = 4.0;

    // Local Storage High Scores
    this.highScore = parseInt(localStorage.getItem('cyber_dash_high_score') || '0', 10);
    this.totalCoins = parseInt(localStorage.getItem('cyber_dash_total_coins') || '0', 10);

    // Delta Time
    this.clock = new THREE.Clock();
    this.lastTime = performance.now();

    // Bind UI hooks
    this.ui = this.bindUIElements();

    // Event listeners
    this.bindInputs();
    window.addEventListener('resize', () => this.onWindowResize());

    // Init Scene
    this.resetGame();
  }

  bindUIElements() {
    return {
      hud: document.getElementById('hud'),
      scoreVal: document.getElementById('hud-score'),
      distVal: document.getElementById('hud-distance'),
      coinsVal: document.getElementById('hud-coins'),
      superFill: document.getElementById('super-energy-fill'),
      warpFill: document.getElementById('warp-energy-fill'),
      buffsContainer: document.getElementById('hud-buffs'),
      skillOverlay: document.getElementById('skill-cooldown-overlay'),
      menuScreen: document.getElementById('menu-screen'),
      pauseModal: document.getElementById('pause-modal'),
      reviveModal: document.getElementById('revive-modal'),
      reviveCountdown: document.getElementById('revive-countdown-num'),
      gameoverModal: document.getElementById('gameover-modal'),
      stageBanner: document.getElementById('stage-banner'),
      highScoreDisplay: document.getElementById('menu-high-score'),
      finalScore: document.getElementById('go-final-score'),
      finalDist: document.getElementById('go-final-distance'),
      finalCoins: document.getElementById('go-final-coins')
    };
  }

  bindInputs() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (this.state === GameState.MENU) this.startGame();
        else this.handleJumpInput();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.handleSlideInput();
      } else if (e.code === 'KeyE' || e.code === 'KeyF') {
        this.handleSkillInput();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        this.togglePause();
      }
    });

    // Touch / Buttons
    const btnJump = document.getElementById('btn-jump');
    const btnSlide = document.getElementById('btn-slide');
    const btnSkill = document.getElementById('btn-skill');
    const btnPause = document.getElementById('btn-pause');
    const btnAudio = document.getElementById('btn-audio');

    btnJump?.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleJumpInput(); });
    btnJump?.addEventListener('mousedown', (e) => { e.preventDefault(); this.handleJumpInput(); });

    btnSlide?.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleSlideInput(); });
    btnSlide?.addEventListener('mousedown', (e) => { e.preventDefault(); this.handleSlideInput(); });

    btnSkill?.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleSkillInput(); });
    btnSkill?.addEventListener('mousedown', (e) => { e.preventDefault(); this.handleSkillInput(); });

    btnPause?.addEventListener('click', () => this.togglePause());
    btnAudio?.addEventListener('click', () => {
      const muted = this.sound.toggleMute();
      btnAudio.textContent = muted ? '🔇' : '🔊';
    });

    document.getElementById('btn-start')?.addEventListener('click', () => this.startGame());
    document.getElementById('btn-resume')?.addEventListener('click', () => this.togglePause());
    document.getElementById('btn-restart')?.addEventListener('click', () => this.startGame());
    document.getElementById('btn-revive-now')?.addEventListener('click', () => this.revivePlayer());
    document.getElementById('btn-skip-revive')?.addEventListener('click', () => this.endGame());
    document.getElementById('btn-play-again')?.addEventListener('click', () => this.startGame());
  }

  handleJumpInput() {
    if (this.state === GameState.PLAYING || this.state === GameState.SUPER_REWARD || this.state === GameState.WARP_REWARD) {
      this.player.jump();
    }
  }

  handleSlideInput() {
    if (this.state === GameState.PLAYING || this.state === GameState.SUPER_REWARD || this.state === GameState.WARP_REWARD) {
      this.player.slide();
    }
  }

  handleSkillInput() {
    if (this.state === GameState.PLAYING || this.state === GameState.SUPER_REWARD || this.state === GameState.WARP_REWARD) {
      if (this.player.activateSkill()) {
        // Skill effect: Clear on-screen obstacles into coins
        this.cameraMgr.addTrauma(0.6);
        for (const obs of this.obsMgr.obstacles) {
          if (obs.group.position.x > this.player.x && obs.group.position.x < this.player.x + 30) {
            this.itemMgr.spawn(ItemType.COIN, obs.group.position.x, obs.group.position.y + 1, 0);
            this.obsMgr.destroyObstacle(obs, true);
          }
        }
      }
    }
  }

  togglePause() {
    if (this.state === GameState.PLAYING || this.state === GameState.SUPER_REWARD || this.state === GameState.WARP_REWARD) {
      this.previousState = this.state;
      this.state = GameState.PAUSED;
      this.ui.pauseModal.style.display = 'flex';
      this.sound.stopBGM();
    } else if (this.state === GameState.PAUSED) {
      this.state = this.previousState;
      this.ui.pauseModal.style.display = 'none';
      this.sound.startBGM();
    }
  }

  resetGame() {
    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.scoreMultiplier = 1.0;
    this.baseSpeed = 13.5;
    this.currentSpeed = 13.5;
    this.superEnergy = 0;
    this.warpEnergy = 0;
    this.hasUsedRevive = false;

    this.levelGen.reset();
    this.player.reset(0, 0);
    this.cameraMgr.setMode(Biome.NORMAL_CYBER);
    this.parallax.setMode(Biome.NORMAL_CYBER);

    if (this.ui.highScoreDisplay) {
      this.ui.highScoreDisplay.textContent = this.highScore.toLocaleString();
    }
  }

  startGame() {
    this.sound.resume();
    this.resetGame();
    this.state = GameState.PLAYING;

    // UI visibility
    this.ui.menuScreen.style.display = 'none';
    this.ui.pauseModal.style.display = 'none';
    this.ui.reviveModal.style.display = 'none';
    this.ui.gameoverModal.style.display = 'none';
    this.ui.hud.style.display = 'block';

    this.sound.setBGMMode('normal');
    this.sound.startBGM();
  }

  enterSuperReward() {
    this.state = GameState.SUPER_REWARD;
    this.rewardDuration = 10.0;
    this.rewardTimer = this.rewardDuration;
    this.superEnergy = 0;
    this.scoreMultiplier = 3.5;

    this.levelGen.setBiome(Biome.SUPER_REWARD);
    this.parallax.setMode(Biome.SUPER_REWARD);
    this.cameraMgr.setMode(Biome.SUPER_REWARD);
    this.sound.setBGMMode('super');
    this.sound.playSuperRewardStart();

    this.showBanner('SUPER REWARD!', 'banner-super');
  }

  enterWarpReward() {
    this.state = GameState.WARP_REWARD;
    this.rewardDuration = 8.0;
    this.rewardTimer = this.rewardDuration;
    this.warpEnergy = 0;
    this.scoreMultiplier = 5.0;

    this.levelGen.setBiome(Biome.WARP_REWARD);
    this.parallax.setMode(Biome.WARP_REWARD);
    this.cameraMgr.setMode(Biome.WARP_REWARD);
    this.sound.setBGMMode('warp');
    this.sound.playWarpStart();

    this.showBanner('WARP SPEED!', 'banner-warp');
  }

  exitRewardMode() {
    this.state = GameState.PLAYING;
    this.scoreMultiplier = 1.0;

    this.levelGen.setBiome(Biome.NORMAL_CYBER);
    this.parallax.setMode(Biome.NORMAL_CYBER);
    this.cameraMgr.setMode(Biome.NORMAL_CYBER);
    this.sound.setBGMMode('normal');
  }

  showBanner(text, cssClass) {
    if (!this.ui.stageBanner) return;
    this.ui.stageBanner.textContent = text;
    this.ui.stageBanner.className = `stage-banner ${cssClass} banner-show`;
    setTimeout(() => {
      this.ui.stageBanner.classList.remove('banner-show');
    }, 2200);
  }

  onPlayerHit() {
    const result = this.player.takeDamage();
    if (result === 'shield_saved' || result === 'mount_saved') {
      this.cameraMgr.addTrauma(0.5);
    } else if (result === 'dead') {
      this.cameraMgr.addTrauma(0.8);
      this.sound.stopBGM();

      if (!this.hasUsedRevive) {
        // Trigger Revive Dialog
        this.state = GameState.REVIVE_COUNTDOWN;
        this.reviveTimer = 4.0;
        this.ui.reviveModal.style.display = 'flex';
      } else {
        // Direct Game Over
        setTimeout(() => this.endGame(), 1000);
      }
    }
  }

  revivePlayer() {
    this.hasUsedRevive = true;
    this.ui.reviveModal.style.display = 'none';
    this.state = GameState.PLAYING;
    this.player.revive(this.player.x, this.player.groundY);
    this.sound.startBGM();
  }

  endGame() {
    this.state = GameState.GAMEOVER;
    this.ui.reviveModal.style.display = 'none';
    this.ui.gameoverModal.style.display = 'flex';

    // Save records
    if (this.score > this.highScore) {
      this.highScore = Math.floor(this.score);
      localStorage.setItem('cyber_dash_high_score', this.highScore.toString());
    }
    this.totalCoins += this.coins;
    localStorage.setItem('cyber_dash_total_coins', this.totalCoins.toString());

    // Settlement UI
    if (this.ui.finalScore) this.ui.finalScore.textContent = Math.floor(this.score).toLocaleString();
    if (this.ui.finalDist) this.ui.finalDist.textContent = Math.floor(this.distance) + ' m';
    if (this.ui.finalCoins) this.ui.finalCoins.textContent = this.coins.toLocaleString();
  }

  checkCollisions() {
    if (this.player.state === PlayerState.DEAD) return;

    // Obstacle Collisions
    for (const obs of this.obsMgr.obstacles) {
      if (!obs.active) continue;

      if (this.player.box.intersectsBox(obs.box)) {
        if (obs.type === ObstacleType.SPRING_PAD) {
          // Launch trampoline
          this.player.vy = 23;
          this.player.state = PlayerState.JUMPING;
          this.player.canDoubleJump = true;
          this.sound.playDoubleJump();
          this.particles.spawnJumpShockwave(obs.group.position.x, obs.group.position.y + 0.3, 0, true);
        }
        else if (obs.type === ObstacleType.STOMP_MONSTER) {
          // Check if stomping from above
          const playerBottom = this.player.y;
          const monsterTop = obs.box.max.y - 0.2;
          if (playerBottom >= monsterTop && this.player.vy <= 2) {
            // Stomp Success!
            this.player.stompBounce();
            this.obsMgr.destroyObstacle(obs, true);
            this.score += 1500 * this.scoreMultiplier;
            this.superEnergy = Math.min(100, this.superEnergy + 6);
            this.cameraMgr.addTrauma(0.35);
          } else {
            // Lethal hit
            if (this.player.sprintTime > 0) {
              this.obsMgr.destroyObstacle(obs, true);
              this.score += 1000 * this.scoreMultiplier;
            } else {
              this.onPlayerHit();
            }
          }
        }
        else {
          // Spike or Laser hit
          if (this.player.sprintTime > 0) {
            this.obsMgr.destroyObstacle(obs, true);
            this.score += 1000 * this.scoreMultiplier;
          } else {
            this.onPlayerHit();
          }
        }
      }
    }

    // Collectibles Collisions
    const pBox = this.player.box;
    for (const item of this.itemMgr.items) {
      if (!item.active) continue;

      const dx = Math.abs(this.player.x - item.mesh.position.x);
      const dy = Math.abs((this.player.y + 0.9) - item.mesh.position.y);

      if (dx < item.radius + 0.5 && dy < item.radius + 0.8) {
        this.itemMgr.collectItem(item);

        if (item.type === ItemType.COIN) {
          this.coins += 1;
          this.score += 100 * this.scoreMultiplier;
          this.superEnergy = Math.min(100, this.superEnergy + 1.2);
          this.warpEnergy = Math.min(100, this.warpEnergy + 0.8);
          this.sound.playCoin();
        } 
        else if (item.type === ItemType.GEM_BLUE) {
          this.coins += 3;
          this.score += 350 * this.scoreMultiplier;
          this.superEnergy = Math.min(100, this.superEnergy + 3.5);
          this.sound.playGem();
        } 
        else if (item.type === ItemType.GEM_PINK) {
          this.coins += 10;
          this.score += 1200 * this.scoreMultiplier;
          this.superEnergy = Math.min(100, this.superEnergy + 8.0);
          this.sound.playGem();
        } 
        else if (item.type === ItemType.BUFF_MAGNET) {
          this.player.activateMagnet(12);
        } 
        else if (item.type === ItemType.BUFF_SHIELD) {
          this.player.activateShield(18);
        } 
        else if (item.type === ItemType.BUFF_SPRINT) {
          this.player.activateSprint(6);
        } 
        else if (item.type === ItemType.WARP_RING) {
          this.score += 5000 * this.scoreMultiplier;
          this.sound.playGem();
          this.cameraMgr.addTrauma(0.3);
        }
      }
    }
  }

  updateHUD() {
    if (this.ui.scoreVal) this.ui.scoreVal.textContent = Math.floor(this.score).toLocaleString();
    if (this.ui.distVal) this.ui.distVal.textContent = `${Math.floor(this.distance)} m`;
    if (this.ui.coinsVal) this.ui.coinsVal.textContent = this.coins.toLocaleString();

    // Energy Bars
    if (this.ui.superFill) {
      if (this.state === GameState.SUPER_REWARD) {
        this.ui.superFill.style.width = `${(this.rewardTimer / this.rewardDuration) * 100}%`;
      } else {
        this.ui.superFill.style.width = `${this.superEnergy}%`;
      }
    }

    if (this.ui.warpFill) {
      if (this.state === GameState.WARP_REWARD) {
        this.ui.warpFill.style.width = `${(this.rewardTimer / this.rewardDuration) * 100}%`;
      } else {
        this.ui.warpFill.style.width = `${this.warpEnergy}%`;
      }
    }

    // Skill Cooldown Overlay
    if (this.ui.skillOverlay) {
      const pct = (this.player.skillTimer / this.player.skillCooldown) * 100;
      this.ui.skillOverlay.style.height = `${pct}%`;
      this.ui.skillOverlay.textContent = this.player.skillTimer > 0 ? Math.ceil(this.player.skillTimer) : '⚡';
    }

    // Active Buff Badges
    if (this.ui.buffsContainer) {
      let html = '';
      if (this.player.shieldTime > 0) {
        html += `<div class="buff-badge"><span class="buff-icon">🛡️</span><div class="buff-info"><span class="buff-name">护盾</span><span class="buff-timer">${Math.ceil(this.player.shieldTime)}s</span></div></div>`;
      }
      if (this.player.magnetTime > 0) {
        html += `<div class="buff-badge"><span class="buff-icon">🧲</span><div class="buff-info"><span class="buff-name">磁铁</span><span class="buff-timer">${Math.ceil(this.player.magnetTime)}s</span></div></div>`;
      }
      if (this.player.sprintTime > 0) {
        html += `<div class="buff-badge"><span class="buff-icon">🚀</span><div class="buff-info"><span class="buff-name">冲刺</span><span class="buff-timer">${Math.ceil(this.player.sprintTime)}s</span></div></div>`;
      }
      this.ui.buffsContainer.innerHTML = html;
    }
  }

  update(dt) {
    // Revive countdown timer
    if (this.state === GameState.REVIVE_COUNTDOWN) {
      this.reviveTimer -= dt;
      if (this.ui.reviveCountdown) {
        this.ui.reviveCountdown.textContent = Math.ceil(this.reviveTimer);
      }
      if (this.reviveTimer <= 0) {
        this.endGame();
      }
      return;
    }

    if (this.state === GameState.PAUSED || this.state === GameState.GAMEOVER) {
      return;
    }

    const isRunningState = (this.state === GameState.PLAYING || this.state === GameState.SUPER_REWARD || this.state === GameState.WARP_REWARD);

    if (isRunningState) {
      // Speed Progression
      this.baseSpeed += dt * 0.08; // Steady acceleration
      let targetSpeed = this.baseSpeed;
      if (this.player.sprintTime > 0) targetSpeed *= 1.9;
      if (this.state === GameState.WARP_REWARD) targetSpeed *= 2.2;
      this.currentSpeed += (targetSpeed - this.currentSpeed) * dt * 4;

      // Distance & Score
      const stepDist = this.currentSpeed * dt;
      this.distance += stepDist;
      this.score += stepDist * 12 * this.scoreMultiplier;

      // Forward Player Movement
      this.player.x += stepDist;

      // Reward Mode Timers
      if (this.state === GameState.SUPER_REWARD || this.state === GameState.WARP_REWARD) {
        this.rewardTimer -= dt;
        if (this.rewardTimer <= 0) {
          this.exitRewardMode();
        }
      } else {
        // Auto-trigger Reward modes when energy reaches 100%
        if (this.superEnergy >= 100) {
          this.enterSuperReward();
        } else if (this.warpEnergy >= 100) {
          this.enterWarpReward();
        }
      }
    }

    // Ground Height Detection
    const groundY = this.levelGen.getGroundHeightAt(this.player.x, this.player.y);

    // Subsystems Update
    this.player.update(dt, this.currentSpeed, groundY);
    this.levelGen.update(this.player.x);
    this.obsMgr.update(dt, this.player.x);
    this.itemMgr.update(dt, this.player.x, this.player.y, this.player.z, this.player.magnetTime > 0);
    this.parallax.update(dt, this.player.x);
    this.particles.update(dt);
    this.cameraMgr.update(dt, this.player.x, this.player.y, this.player.z);

    // Collisions
    if (isRunningState) {
      this.checkCollisions();
      this.updateHUD();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.update(dt);
    this.render();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}
