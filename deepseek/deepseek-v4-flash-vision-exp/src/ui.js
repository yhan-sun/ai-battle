// UI 层：开始/暂停/结算/HUD/触屏控制
export class UI {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.els = {
      menu: this.$('menu-screen'),
      hud: this.$('hud'),
      pause: this.$('pause-screen'),
      gameover: this.$('gameover-screen'),
      banner: this.$('bonus-banner'),
      coins: this.$('hud-coins'),
      score: this.$('hud-score'),
      distance: this.$('hud-distance'),
      speed: this.$('hud-speed'),
      buffSkill: this.$('buff-skill'),
      buffMagnet: this.$('buff-magnet'),
      buffShield: this.$('buff-shield'),
      hudMount: this.$('hud-mount'),
      touch: this.$('touch-ui'),
      goScore: this.$('go-score'),
      goDistance: this.$('go-distance'),
      goCoins: this.$('go-coins'),
      goBest: this.$('go-best'),
      goTitle: this.$('go-title'),
      goNew: this.$('go-new-record'),
      btnRevive: this.$('btn-revive'),
      menuBest: this.$('menu-best-score'),
    };
    this.on = {};
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (this.isTouch) this.els.touch.classList.remove('hidden');
  }

  bind(handlers) {
    this.on = handlers;
    const click = (id, fn) => {
      const el = this.$(id);
      if (el) el.addEventListener('click', fn);
    };
    click('btn-start', () => this.on.start && this.on.start());
    click('btn-resume', () => this.on.resume && this.on.resume());
    click('btn-restart', () => this.on.restart && this.on.restart());
    click('btn-menu', () => this.on.menu && this.on.menu());
    click('btn-retry', () => this.on.retry && this.on.retry());
    click('btn-go-menu', () => this.on.menu && this.on.menu());
    click('btn-revive', () => this.on.revive && this.on.revive());
    click('btn-pause', () => this.on.pause && this.on.pause());
    click('btn-sound', () => this.on.sound && this.on.sound());

    if (this.isTouch) {
      const jumpEl = this.$('touch-jump');
      const slideEl = this.$('touch-slide');
      jumpEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.on.jump && this.on.jump();
      });
      slideEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.on.slide && this.on.slide();
      });
    }
  }

  screen(name) {
    this.els.menu.classList.add('hidden');
    this.els.pause.classList.add('hidden');
    this.els.gameover.classList.add('hidden');
    if (name === 'menu') this.els.menu.classList.remove('hidden');
    if (name === 'pause') this.els.pause.classList.remove('hidden');
    if (name === 'gameover') this.els.gameover.classList.remove('hidden');
  }

  hudVisible(v) {
    if (v) this.els.hud.classList.remove('hidden');
    else this.els.hud.classList.add('hidden');
  }

  touchVisible(v) {
    if (this.isTouch) this.els.touch.classList.toggle('hidden', !v);
  }

  updateHud(s) {
    this.els.coins.textContent = s.coins;
    this.els.score.textContent = s.score;
    this.els.distance.textContent = Math.floor(s.distance);
    this.els.speed.textContent = `x${s.speedMult.toFixed(1)}`;
  }

  // 技能/道具条：ratio 0..1
  updateBuffers({ skill = 0, magnet = 0, shield = 0, mounted = false } = {}) {
    this.setFill(this.els.buffSkill, skill);
    this.setFill(this.els.buffMagnet, magnet);
    this.setFill(this.els.buffShield, shield);
    this.els.buffSkill.style.borderColor = skill >= 1 ? 'rgba(70,224,255,0.9)' : '';
    this.els.hudMount.style.display = mounted ? '' : 'none';
  }

  setFill(el, ratio) {
    const fill = el.querySelector('.buffer-fill');
    if (fill) fill.style.height = `${Math.round(ratio * 100)}%`;
  }

  banner(text, sub = '') {
    this.els.banner.innerHTML = `${text}${sub ? `<div style="font-size:0.5em;color:#bcd8ff;letter-spacing:6px">${sub}</div>` : ''}`;
    this.els.banner.classList.remove('hidden');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => this.els.banner.classList.add('hidden'), 2000);
  }

  combo(text) {
    const t = document.getElementById('combo-toast');
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(this._ct);
    this._ct = setTimeout(() => t.classList.add('hidden'), 650);
  }

  showMenu(best) {
    this.els.menuBest.textContent = best;
    this.screen('menu');
    this.hudVisible(false);
    this.touchVisible(false);
  }

  showGameOver(stats, opts) {
    this.els.goTitle.textContent = opts.diedInBonus ? '奖励关结束' : '结 算';
    this.els.goScore.textContent = stats.score;
    this.els.goDistance.textContent = `${Math.floor(stats.distance)} m`;
    this.els.goCoins.textContent = stats.coins;
    this.els.goBest.textContent = stats.best;
    this.els.goNew.classList.toggle('hidden', !stats.newRecord);
    this.els.btnRevive.style.display = opts.canRevive ? '' : 'none';
    this.screen('gameover');
    this.hudVisible(false);
    this.touchVisible(false);
  }
}
