export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: document.getElementById('hud'),
      score: document.getElementById('hud-score'),
      distance: document.getElementById('hud-distance'),
      combo: document.getElementById('hud-combo'),
      timer: document.getElementById('hud-timer'),
      timerLabel: document.getElementById('hud-timer-label'),
      timerValue: document.getElementById('hud-timer-value'),
      timerMult: document.getElementById('hud-timer-mult'),
      magnet: document.getElementById('power-magnet'),
      shield: document.getElementById('power-shield'),
      magnetBar: document.querySelector('#power-magnet .power-bar i'),
      shieldBar: document.querySelector('#power-shield .power-bar i'),
      ability: document.getElementById('btn-ability'),
      startOverlay: document.getElementById('overlay-start'),
      pauseOverlay: document.getElementById('overlay-pause'),
      deadOverlay: document.getElementById('overlay-dead'),
      deadScore: document.getElementById('dead-score'),
      deadDistance: document.getElementById('dead-distance'),
      deadBest: document.getElementById('dead-best'),
      reviveCount: document.getElementById('revive-count'),
      startBest: document.getElementById('start-best'),
      toast: document.getElementById('toast'),
      btnMute: document.getElementById('btn-mute'),
    };
    this._toastTimer = null;
    this._muted = false;
    this.el.btnMute.addEventListener('click', () => this.toggleMute());
    document.getElementById('btn-mute').textContent = '🔊';
  }

  showHud() {
    this.el.hud.classList.remove('hidden');
  }

  hideOverlays() {
    this.el.startOverlay.classList.add('hidden');
    this.el.pauseOverlay.classList.add('hidden');
    this.el.deadOverlay.classList.add('hidden');
  }

  showPause() {
    this.el.pauseOverlay.classList.remove('hidden');
  }

  showDead(game) {
    this.el.deadScore.textContent = Math.round(game.score);
    this.el.deadDistance.textContent = `${Math.floor(game.distance)} m`;
    this.el.deadBest.textContent = Math.max(game.bestScore, Math.round(game.score));
    this.el.reviveCount.textContent = String(game.revivesLeft);
    const btn = document.getElementById('btn-revive');
    btn.disabled = game.revivesLeft <= 0;
    btn.style.opacity = game.revivesLeft <= 0 ? '0.45' : '1';
    this.el.deadOverlay.classList.remove('hidden');
  }

  update(game) {
    const p = game.player;
    this.el.score.textContent = Math.round(game.score).toLocaleString();
    this.el.distance.textContent = `${Math.floor(game.distance)} m`;
    this.el.combo.textContent = `x${game.combo}`;
    this.el.combo.style.color = game.combo > 4 ? '#ffc857' : '';

    const magnetFrac = Math.max(0, p.magnetTimer / 8);
    this.el.magnet.classList.toggle('active', p.magnetTimer > 0);
    this.el.magnetBar.style.width = `${magnetFrac * 100}%`;

    const shieldFrac = Math.max(0, p.shieldTimer / 10);
    this.el.shield.classList.toggle('active', p.shieldTimer > 0);
    this.el.shieldBar.style.width = `${shieldFrac * 100}%`;

    this.el.ability.disabled = p.sprinting;
    this.el.ability.textContent = p.sprinting ? '⚡ 冲刺中' : '⚡ 冲刺';

    if (game.state === 'menu') {
      this.el.startBest.innerHTML = `最高分：<strong>${game.bestScore.toLocaleString()}</strong>`;
    }
  }

  updateTimer(label, value, mult) {
    this.el.timer.classList.remove('hidden');
    this.el.timerLabel.textContent = label;
    this.el.timerValue.textContent = String(value);
    this.el.timerMult.textContent = mult;
    this.el.timerValue.style.color = value <= 5 ? '#ff6b6b' : '#ffc857';
  }

  hideTimer() {
    this.el.timer.classList.add('hidden');
  }

  timerVisible() {
    return !this.el.timer.classList.contains('hidden');
  }

  toggleMute() {
    this._muted = !this._muted;
    this.game.audio.setMuted(this._muted);
    document.getElementById('btn-mute').textContent = this._muted ? '🔇' : '🔊';
    if (this._muted) this.game.audio.stopBgm();
    else if (this.game.state !== 'menu' && this.game.state !== 'dead') this.game.audio.startBgm();
  }

  toast(msg) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.remove('hidden');
    this.el.toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.el.toast.classList.add('hidden');
    }, 2000);
  }
}