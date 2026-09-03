// UI 层：HUD 更新、屏幕切换、奖励横幅
export class UI {
  constructor() {
    this.el = {
      start: document.getElementById('start-screen'),
      howto: document.getElementById('howto-screen'),
      pause: document.getElementById('pause-screen'),
      gameover: document.getElementById('gameover-screen'),
      hud: document.getElementById('hud'),
      score: document.getElementById('hud-score'),
      distance: document.getElementById('hud-distance'),
      speed: document.getElementById('hud-speed'),
      lives: document.getElementById('hud-lives'),
      hudStage: document.getElementById('hud-stage'),
      bonusBanner: document.getElementById('bonus-banner'),
      bonusTitle: document.getElementById('bonus-title'),
      bonusTimer: document.getElementById('bonus-timer'),
      bestStart: document.getElementById('best-start'),
      goScore: document.getElementById('go-score'),
      goDistance: document.getElementById('go-distance'),
      goBest: document.getElementById('go-best'),
      touch: document.getElementById('touch-controls'),
    };
    this.chips = {
      shield: document.getElementById('pw-shield'),
      magnet: document.getElementById('pw-magnet'),
      double: document.getElementById('pw-double'),
      drone: document.getElementById('pw-drone'),
    };
    this.chipEls = {
      shield: document.getElementById('chip-shield'),
      magnet: document.getElementById('chip-magnet'),
      double: document.getElementById('chip-double'),
      drone: document.getElementById('chip-drone'),
    };
    this.anyScreen = document.querySelector('.screen');
  }

  showStart(best) {
    this.hideAll();
    this.el.start.classList.remove('hidden');
    this.el.bestStart.textContent = best;
  }

  showHowto() {
    this.el.howto.classList.remove('hidden');
  }
  hideHowto() {
    this.el.howto.classList.add('hidden');
  }

  hideAll() {
    document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
    this.el.hud.classList.add('hidden');
    this.el.touch.classList.add('hidden');
    this.el.bonusBanner.classList.add('hidden');
  }

  showHud() {
    this.el.hud.classList.remove('hidden');
    this.el.touch.classList.remove('hidden');
  }

  showPause() {
    this.el.pause.classList.remove('hidden');
  }
  hidePause() {
    this.el.pause.classList.add('hidden');
  }

  showGameover({ score, distance, best, isRecord }) {
    this.el.gameover.classList.remove('hidden');
    this.el.goScore.textContent = score;
    this.el.goDistance.textContent = distance + ' m';
    this.el.goBest.textContent = (isRecord ? 'NEW ' : '') + best;
    this.el.gameover.querySelector('.gameover-title').textContent = isRecord ? '新纪录！' : '重 启 星 轨';
  }

  // HUD 更新
  updateHUD({ score, distance, speed, lives }) {
    this.el.score.textContent = score;
    this.el.distance.textContent = Math.floor(distance) + ' m';
    this.el.speed.textContent = Math.floor(speed);
    if (this.el.lives) {
      this.el.lives.textContent = '●'.repeat(Math.max(0, lives)) + '○'.repeat(Math.max(0, 3 - lives));
    }
  }

  updateStage(stage) {
    // stage: 'main' | 'super' | 'warp'
    if (stage === 'main') {
      this.el.hud.classList.remove('hidden');
      this.el.hudStage.textContent = '主赛道';
      this.el.hudStage.classList.remove('warp');
      this.el.bonusBanner.classList.add('hidden');
    } else if (stage === 'super') {
      this.el.bonusBanner.classList.remove('hidden');
      this.el.bonusTitle.textContent = '超级奖励';
      this.el.hudStage.textContent = '超级奖励';
    } else if (stage === 'warp') {
      this.el.bonusBanner.classList.remove('hidden');
      this.el.bonusTitle.textContent = '穿越奖励 · 超光速';
      this.el.hudStage.textContent = '穿越时空';
      this.el.hudStage.classList.add('warp');
    }
  }

  updateBonusTimer(sec) {
    this.el.bonusTimer.textContent = '0:' + String(Math.max(0, Math.ceil(sec))).padStart(2, '0');
  }

  updatePowerups(state) {
    const map = { shield: state.shield, magnet: state.magnet, double: state.double, drone: state.drone };
    for (const key of Object.keys(map)) {
      const v = map[key];
      this.chips[key].textContent = v;
      this.chipEls[key].classList.toggle('active', v > 0);
    }
  }

  // 结算分数动画
  animateScore(from, to, cb) {
    const dur = 800;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      this.el.score.textContent = Math.floor(from + (to - from) * ease);
      if (p < 1) requestAnimationFrame(step);
      else if (cb) cb();
    };
    requestAnimationFrame(step);
  }
}