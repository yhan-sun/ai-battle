import { Game, GAME_STATE } from './game/Game.js';
import { MOUNT_TYPES } from './entities/Mount.js';
import { PET_TYPES } from './entities/Pet.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas);

  // Selected gear in menu
  let selectedMount = MOUNT_TYPES.PANTHER;
  let selectedPet = PET_TYPES.DRAKE;

  // DOM Elements - Overlays
  const hudOverlay = document.getElementById('hud-overlay');
  const menuOverlay = document.getElementById('menu-overlay');
  const pauseOverlay = document.getElementById('pause-overlay');
  const reviveOverlay = document.getElementById('revive-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');

  // DOM Elements - HUD
  const hudPerfScore = document.getElementById('hud-perf-score');
  const hudDistance = document.getElementById('hud-distance');
  const hudCoins = document.getElementById('hud-coins');
  const feverFill = document.getElementById('fever-progress-fill');
  const feverPercent = document.getElementById('fever-percent');
  const rewardBanner = document.getElementById('reward-banner');
  const rewardBannerTitle = document.getElementById('reward-banner-title');
  const rewardBannerDesc = document.getElementById('reward-banner-desc');
  const rewardTimerFill = document.getElementById('reward-timer-fill');

  // Buff elements
  const buffShield = document.getElementById('buff-shield');
  const buffMagnet = document.getElementById('buff-magnet');
  const buffSprint = document.getElementById('buff-sprint');
  const buffGiant = document.getElementById('buff-giant');
  const buffMultiplier = document.getElementById('buff-multiplier');
  const timeMagnet = document.getElementById('time-magnet');
  const timeSprint = document.getElementById('time-sprint');
  const timeGiant = document.getElementById('time-giant');
  const timeMultiplier = document.getElementById('time-multiplier');

  // Skill mask
  const skillCdMask = document.getElementById('skill-cd-mask');

  // Menu Stats
  const menuHighScore = document.getElementById('menu-high-score');
  const menuBestDist = document.getElementById('menu-best-dist');
  const menuTotalCoins = document.getElementById('menu-total-coins');

  // Settlement Elements
  const settleDistance = document.getElementById('settle-distance');
  const settlePerf = document.getElementById('settle-perf');
  const settleCoins = document.getElementById('settle-coins');
  const settleTotal = document.getElementById('settle-total');
  const newRecordBadge = document.getElementById('new-record-badge');
  const reviveCountdownNum = document.getElementById('revive-countdown-num');

  // Buttons
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnRestart = document.getElementById('btn-restart');
  const btnHome = document.getElementById('btn-home');
  const btnSound = document.getElementById('btn-sound');
  const btnJump = document.getElementById('btn-jump');
  const btnSlide = document.getElementById('btn-slide');
  const btnSkill = document.getElementById('btn-skill');
  const btnDoRevive = document.getElementById('btn-do-revive');
  const btnSkipRevive = document.getElementById('btn-skip-revive');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnSettleHome = document.getElementById('btn-settle-home');

  // --- GARAGE / SELECTION LOGIC ---
  const mountChips = document.querySelectorAll('#mount-options .select-chip');
  mountChips.forEach(chip => {
    chip.addEventListener('click', () => {
      mountChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedMount = chip.getAttribute('data-mount');
      game.player.setMount(selectedMount);
    });
  });

  const petChips = document.querySelectorAll('#pet-options .select-chip');
  petChips.forEach(chip => {
    chip.addEventListener('click', () => {
      petChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedPet = chip.getAttribute('data-pet');
      game.player.setPet(selectedPet);
    });
  });

  // --- BUTTON EVENT LISTENERS ---
  btnStart.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    hudOverlay.classList.remove('hidden');
    game.startGame(selectedMount, selectedPet);
  });

  btnPause.addEventListener('click', () => {
    game.pauseGame();
    pauseOverlay.classList.remove('hidden');
  });

  btnResume.addEventListener('click', () => {
    pauseOverlay.classList.add('hidden');
    game.resumeGame();
  });

  btnRestart.addEventListener('click', () => {
    pauseOverlay.classList.add('hidden');
    game.resetRun();
    game.state = GAME_STATE.PLAYING;
  });

  btnHome.addEventListener('click', () => {
    pauseOverlay.classList.add('hidden');
    hudOverlay.classList.add('hidden');
    menuOverlay.classList.remove('hidden');
    game.state = GAME_STATE.MENU;
  });

  btnSound.addEventListener('click', () => {
    const isMuted = game.sound.toggleMute();
    btnSound.innerText = isMuted ? '🔇' : '🔊';
  });

  btnDoRevive.addEventListener('click', () => {
    reviveOverlay.classList.add('hidden');
    game.revivePlayer();
  });

  btnSkipRevive.addEventListener('click', () => {
    reviveOverlay.classList.add('hidden');
    game.triggerGameOver();
  });

  btnPlayAgain.addEventListener('click', () => {
    gameoverOverlay.classList.add('hidden');
    game.resetRun();
    game.state = GAME_STATE.PLAYING;
  });

  btnSettleHome.addEventListener('click', () => {
    gameoverOverlay.classList.add('hidden');
    hudOverlay.classList.add('hidden');
    menuOverlay.classList.remove('hidden');
    game.state = GAME_STATE.MENU;
  });

  // Action Buttons (Touch / Mouse Pointer Events)
  const handleJumpAction = (e) => {
    e.preventDefault();
    if (game.state === GAME_STATE.PLAYING || game.state === GAME_STATE.SUPER_REWARD || game.state === GAME_STATE.DIMENSION_RIFT) {
      game.player.jump();
    }
  };

  const handleSlideAction = (e) => {
    e.preventDefault();
    if (game.state === GAME_STATE.PLAYING || game.state === GAME_STATE.SUPER_REWARD || game.state === GAME_STATE.DIMENSION_RIFT) {
      game.player.slide();
    }
  };

  const handleSkillAction = (e) => {
    e.preventDefault();
    if (game.state === GAME_STATE.PLAYING || game.state === GAME_STATE.SUPER_REWARD || game.state === GAME_STATE.DIMENSION_RIFT) {
      game.player.triggerSkill();
    }
  };

  btnJump.addEventListener('pointerdown', handleJumpAction);
  btnSlide.addEventListener('pointerdown', handleSlideAction);
  btnSkill.addEventListener('pointerdown', handleSkillAction);

  // --- KEYBOARD CONTROLS ---
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return; // Ignore auto-repeat for clean crisp jumps

    const code = e.code;

    // Jump keys: Space, KeyW, ArrowUp, KeyK
    if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp' || code === 'KeyK') {
      e.preventDefault();
      if (game.state === GAME_STATE.PLAYING || game.state === GAME_STATE.SUPER_REWARD || game.state === GAME_STATE.DIMENSION_RIFT) {
        game.player.jump();
      }
    }

    // Slide keys: KeyS, ArrowDown, KeyJ
    if (code === 'KeyS' || code === 'ArrowDown' || code === 'KeyJ') {
      e.preventDefault();
      if (game.state === GAME_STATE.PLAYING || game.state === GAME_STATE.SUPER_REWARD || game.state === GAME_STATE.DIMENSION_RIFT) {
        game.player.slide();
      }
    }

    // Skill keys: KeyF, KeyL, KeyE
    if (code === 'KeyF' || code === 'KeyL' || code === 'KeyE') {
      e.preventDefault();
      if (game.state === GAME_STATE.PLAYING || game.state === GAME_STATE.SUPER_REWARD || game.state === GAME_STATE.DIMENSION_RIFT) {
        game.player.triggerSkill();
      }
    }

    // Pause key: Escape, KeyP
    if (code === 'Escape' || code === 'KeyP') {
      if (game.state === GAME_STATE.PLAYING || game.state === GAME_STATE.SUPER_REWARD || game.state === GAME_STATE.DIMENSION_RIFT) {
        game.pauseGame();
        pauseOverlay.classList.remove('hidden');
      } else if (game.state === GAME_STATE.PAUSED) {
        pauseOverlay.classList.add('hidden');
        game.resumeGame();
      }
    }
  });

  // --- UI SYNC LOOP ---
  function updateUI() {
    requestAnimationFrame(updateUI);

    const sm = game.scoreManager;
    const p = game.player;

    if (game.state === GAME_STATE.MENU) {
      menuHighScore.innerText = sm.highScore.toLocaleString();
      menuBestDist.innerText = `${sm.bestDistance.toLocaleString()} m`;
      menuTotalCoins.innerText = sm.totalBankCoins.toLocaleString();
      return;
    }

    // Update HUD Stats
    hudPerfScore.innerText = sm.performanceScore.toLocaleString();
    hudDistance.innerText = `${sm.distance.toLocaleString()} m`;
    hudCoins.innerText = sm.coins.toLocaleString();

    // Fever Bar
    const feverPct = Math.min(100, Math.floor(sm.feverEnergy));
    feverFill.style.width = `${feverPct}%`;
    feverPercent.innerText = `${feverPct}%`;

    // Reward Banners
    if (game.state === GAME_STATE.SUPER_REWARD) {
      rewardBanner.classList.remove('hidden');
      rewardBannerTitle.innerText = '☁️ 云端金币乐园';
      rewardBannerDesc.innerText = '表现分 300% 狂欢加成！';
      const pct = Math.max(0, (game.superReward.timer / game.superReward.maxTime) * 100);
      rewardTimerFill.style.width = `${pct}%`;
    } else if (game.state === GAME_STATE.DIMENSION_RIFT) {
      rewardBanner.classList.remove('hidden');
      rewardBannerTitle.innerText = '🌌 异次元赛博时空';
      rewardBannerDesc.innerText = '超光速穿梭 · 丰厚水晶奖励！';
      const pct = Math.max(0, (game.dimensionRift.timer / game.dimensionRift.maxTime) * 100);
      rewardTimerFill.style.width = `${pct}%`;
    } else {
      rewardBanner.classList.add('hidden');
    }

    // Buff Tags
    buffShield.classList.toggle('hidden', !p.shieldActive);

    if (p.magnetTimer > 0) {
      buffMagnet.classList.remove('hidden');
      timeMagnet.innerText = `(${Math.ceil(p.magnetTimer)}s)`;
    } else {
      buffMagnet.classList.add('hidden');
    }

    if (p.sprintTimer > 0) {
      buffSprint.classList.remove('hidden');
      timeSprint.innerText = `(${Math.ceil(p.sprintTimer)}s)`;
    } else {
      buffSprint.classList.add('hidden');
    }

    if (p.giantTimer > 0) {
      buffGiant.classList.remove('hidden');
      timeGiant.innerText = `(${Math.ceil(p.giantTimer)}s)`;
    } else {
      buffGiant.classList.add('hidden');
    }

    if (p.multiplierTimer > 0) {
      buffMultiplier.classList.remove('hidden');
      timeMultiplier.innerText = `(${Math.ceil(p.multiplierTimer)}s)`;
    } else {
      buffMultiplier.classList.add('hidden');
    }

    // Skill Cooldown Mask
    if (p.skillTimer > 0) {
      const cdPct = (p.skillTimer / p.skillCooldown) * 100;
      skillCdMask.style.height = `${cdPct}%`;
    } else {
      skillCdMask.style.height = '0%';
    }

    // Reviving Overlay
    if (game.state === GAME_STATE.REVIVING) {
      reviveOverlay.classList.remove('hidden');
      reviveCountdownNum.innerText = Math.ceil(game.reviveTimer);
    } else {
      reviveOverlay.classList.add('hidden');
    }

    // Game Over Settlement Overlay
    if (game.state === GAME_STATE.GAME_OVER) {
      gameoverOverlay.classList.remove('hidden');
      settleDistance.innerText = `${sm.distance.toLocaleString()} m`;
      settlePerf.innerText = sm.performanceScore.toLocaleString();
      settleCoins.innerText = sm.coins.toLocaleString();
      settleTotal.innerText = sm.getTotalScore().toLocaleString();

      if (sm.getTotalScore() > sm.highScore && sm.highScore > 0) {
        newRecordBadge.classList.remove('hidden');
      } else {
        newRecordBadge.classList.add('hidden');
      }
    }
  }

  updateUI();
});
