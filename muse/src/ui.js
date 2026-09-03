// DOM HUD / 界面管理,与Game解耦
export class UI {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.hud = this.$('hud');
    this.score = this.$('hud-score');
    this.mult = this.$('hud-mult');
    this.dist = this.$('hud-dist');
    this.coins = this.$('hud-coins');
    this.speed = this.$('hud-speed');
    this.energyFill = this.$('energy-fill');
    this.buffs = this.$('buffs');
    this.modeBanner = this.$('mode-banner');
    this.modeTitle = this.$('mode-title');
    this.modeTimer = this.$('mode-timer');
    this.modeSub = this.$('mode-sub');
    this.popupEl = this.$('combo-popup');
    this.popupTimer = null;
    this.flashEl = this.$('flash');
  }
  showHUD() {
    this.hud.classList.remove('hidden');
    this.$('screen-start').classList.add('hidden');
    this.$('screen-pause').classList.add('hidden');
    this.$('screen-over').classList.add('hidden');
  }
  showStart(save) {
    this.hud.classList.add('hidden');
    this.$('screen-start').classList.remove('hidden');
    this.$('screen-pause').classList.add('hidden');
    this.$('screen-over').classList.add('hidden');
    this.$('start-best').textContent = (save.best || 0).toLocaleString();
    this.$('start-best-dist').textContent = (save.bestDist || 0) + 'm';
  }
  showPause(score, dist) {
    this.$('pause-score').textContent = Math.floor(score).toLocaleString();
    this.$('pause-dist').textContent = Math.floor(dist) + 'm';
    this.$('screen-pause').classList.remove('hidden');
  }
  hidePause() { this.$('screen-pause').classList.add('hidden'); }
  showOver({ score, dist, coins, stomp, best, record, canRevive, reason }) {
    this.$('over-score').textContent = score.toLocaleString();
    this.$('over-dist').textContent = dist + 'm';
    this.$('over-coins').textContent = coins;
    this.$('over-stomp').textContent = stomp;
    this.$('over-best').textContent = best.toLocaleString();
    this.$('new-record').classList.toggle('hidden', !record);
    this.$('revive-wrap').style.display = canRevive ? '' : 'none';
    if (reason === 'fall') this.popup('掉进深渊了…');
    this.$('screen-over').classList.remove('hidden');
  }
  hideOver() { this.$('screen-over').classList.add('hidden'); }
  showMode(title, sub, t) {
    this.modeBanner.classList.remove('hidden');
    this.modeTitle.textContent = title;
    this.modeSub.textContent = sub;
    this.modeTimer.textContent = t.toFixed(1) + 's';
  }
  tickMode(t) { this.modeTimer.textContent = Math.max(0, t).toFixed(1) + 's'; }
  hideMode() { this.modeBanner.classList.add('hidden'); }
  popup(text, small = false) {
    this.popupEl.textContent = text;
    this.popupEl.classList.remove('hidden');
    this.popupEl.style.fontSize = small ? '22px' : '30px';
    this.popupEl.style.opacity = '1';
    if (this.popupTimer) clearTimeout(this.popupTimer);
    this.popupTimer = setTimeout(() => {
      this.popupEl.style.opacity = '0';
      setTimeout(() => this.popupEl.classList.add('hidden'), 300);
    }, 1100);
  }
  flash() {
    this.flashEl.style.opacity = '0.55';
    setTimeout(() => { this.flashEl.style.opacity = '0'; }, 60);
  }
  setMute(m) { this.$('btn-mute').textContent = m ? '🔇' : '🔊'; }
  updateHUD(s) {
    this.score.textContent = s.score.toLocaleString();
    this.dist.textContent = s.dist + 'm';
    this.coins.textContent = `🪙 ${s.coins}`;
    this.speed.textContent = s.speed.toFixed(1);
    this.energyFill.style.width = `${Math.min(100, s.energy)}%`;
    if (s.mult > 1) { this.mult.classList.remove('hidden'); this.mult.textContent = `x${s.mult}`; }
    else this.mult.classList.add('hidden');
    let html = '';
    if (s.magnet > 0) html += `<span class="buff">🧲 ${s.magnet.toFixed(0)}s</span>`;
    if (s.shield > 0) html += `<span class="buff">🛡 ${s.shield.toFixed(0)}s</span>`;
    if (s.sprint > 0) html += `<span class="buff">🚀 ${s.sprint.toFixed(0)}s</span>`;
    if (s.skillOn) html += `<span class="buff">⚡ 爆裂!</span>`;
    else if (s.skillCD > 0) html += `<span class="buff">⚡ ${s.skillCD.toFixed(0)}s</span>`;
    else html += `<span class="buff">⚡ 就绪(F)</span>`;
    if (s.mode === 'super') html += `<span class="buff">🌟 超级 ${s.modeT.toFixed(0)}s</span>`;
    if (s.mode === 'cross') html += `<span class="buff">🌀 穿越 ${s.modeT.toFixed(0)}s</span>`;
    if (this.buffs._last !== html) { this.buffs.innerHTML = html; this.buffs._last = html; }
  }
}
