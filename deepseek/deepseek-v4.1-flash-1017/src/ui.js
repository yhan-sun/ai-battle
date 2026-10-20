import { MOUNTS, PETS } from './config.js';
import { clamp, formatDistance, formatNumber } from './utils.js';

const $ = (id) => document.getElementById(id);

/**
 * DOM 界面层：开始 / HUD / 暂停 / 复活 / 结算 / 奖励横幅 / Toast。
 * 只负责展示与事件转发，不持有游戏状态。
 */
export class UI {
  constructor() {
    this.el = {
      hud: $('hud'),
      screenStart: $('screen-start'),
      screenPause: $('screen-pause'),
      screenRevive: $('screen-revive'),
      screenGameover: $('screen-gameover'),

      startBest: $('start-best'),
      startDistance: $('start-distance'),
      startCoins: $('start-coins'),
      mountOptions: $('mount-options'),
      petOptions: $('pet-options'),

      score: $('hud-score'),
      distance: $('hud-distance'),
      coins: $('hud-coins'),
      speed: $('hud-speed'),
      superFill: $('hud-super-fill'),
      superPct: $('hud-super-pct'),
      superMeter: document.querySelector('.super-meter'),
      combo: $('combo'),
      comboCount: $('combo-count'),
      comboMult: $('combo-mult'),

      rewardBanner: $('reward-banner'),
      rewardTitle: $('reward-title'),
      rewardSub: $('reward-sub'),
      rewardTime: $('reward-time'),
      rewardFill: $('reward-fill'),

      puMagnet: $('pu-magnet'),
      puShield: $('pu-shield'),
      puDouble: $('pu-double'),
      skillBtn: $('btn-skill'),
      skillEnergy: $('skill-energy'),

      reviveCount: $('revive-count'),
      reviveNote: $('revive-note'),
      reviveBtn: $('btn-revive'),

      goScore: $('go-score'),
      goDistance: $('go-distance'),
      goCoins: $('go-coins'),
      goCombo: $('go-combo'),
      goRewards: $('go-rewards'),
      goRecord: $('go-record'),
      goBest: $('go-best'),
      goBank: $('go-bank'),

      toast: $('toast'),
      toastTitle: $('toast-title'),
      toastSub: $('toast-sub'),
      fade: $('fade'),
      flash: $('flash'),
      btnMute: $('btn-mute'),
      btnMuteStart: $('btn-mute-start'),
    };

    this.handlers = {};
    this.cache = {};
    this.toastTimer = 0;
    this.rewardMode = null;

    this.puTime = {
      magnet: this.el.puMagnet.querySelector('.pu-time'),
      shield: this.el.puShield.querySelector('.pu-time'),
      double: this.el.puDouble.querySelector('.pu-time'),
    };

    this.renderOptions();
  }

  bind(handlers = {}) {
    this.handlers = handlers;

    const on = (id, event, fn) => {
      const element = $(id);
      if (element) element.addEventListener(event, fn);
    };

    on('btn-start', 'click', () => this.emit('start'));
    on('btn-pause', 'click', () => this.emit('pause'));
    on('btn-mute', 'click', () => this.emit('mute'));
    on('btn-mute-start', 'click', () => this.emit('mute'));
    on('btn-resume', 'click', () => this.emit('resume'));
    on('btn-restart-pause', 'click', () => this.emit('restart'));
    on('btn-quit', 'click', () => this.emit('quit'));
    on('btn-revive', 'click', () => this.emit('revive'));
    on('btn-giveup', 'click', () => this.emit('giveUp'));
    on('btn-retry', 'click', () => this.emit('retry'));
    on('btn-menu', 'click', () => this.emit('menu'));

    const bindOptions = (container, kind) => {
      if (!container) return;
      container.addEventListener('click', (event) => {
        const card = event.target.closest('.option-card');
        if (!card) return;
        this.emit('select', kind, card.dataset.id);
      });
    };
    bindOptions(this.el.mountOptions, 'mount');
    bindOptions(this.el.petOptions, 'pet');

    const touch = (id, action) => {
      const button = $(id);
      if (!button) return;
      const press = (event) => {
        event.preventDefault();
        this.emit('touch', action, true);
      };
      const release = (event) => {
        event.preventDefault();
        this.emit('touch', action, false);
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    };
    touch('touch-jump', 'jump');
    touch('touch-crouch', 'crouch');
    touch('touch-skill', 'skill');
  }

  emit(name, ...args) {
    const handler = this.handlers[name];
    if (typeof handler === 'function') handler(...args);
  }

  renderOptions() {
    const create = (item, kind) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'option-card';
      button.dataset.id = item.id;
      button.dataset.kind = kind;
      button.setAttribute('aria-pressed', 'false');

      const name = document.createElement('span');
      name.className = 'option-name';
      name.textContent = item.name;

      const tag = document.createElement('span');
      tag.className = 'option-tag';
      tag.textContent = item.tag;

      const desc = document.createElement('span');
      desc.className = 'option-desc';
      desc.textContent = item.desc;

      button.append(name, tag, desc);
      return button;
    };

    for (const mount of MOUNTS) this.el.mountOptions.appendChild(create(mount, 'mount'));
    for (const pet of PETS) this.el.petOptions.appendChild(create(pet, 'pet'));
  }

  setLoadout(mount, pet) {
    for (const card of this.el.mountOptions.querySelectorAll('.option-card')) {
      const selected = card.dataset.id === mount;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
    for (const card of this.el.petOptions.querySelectorAll('.option-card')) {
      const selected = card.dataset.id === pet;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
  }

  // ------------------------------------------------------------------

  showStart(data) {
    this.el.screenStart.classList.remove('hidden');
    this.el.screenPause.classList.add('hidden');
    this.el.screenRevive.classList.add('hidden');
    this.el.screenGameover.classList.add('hidden');
    this.el.hud.classList.add('hidden');
    this.hideRewardBanner();
    this.hideToast();
    this.cache = {};

    this.el.startBest.textContent = formatNumber(data.highScore);
    this.el.startDistance.textContent = formatDistance(data.bestDistance);
    this.el.startCoins.textContent = formatNumber(data.totalCoins);
    this.setLoadout(data.mount, data.pet);
    this.setMuted(data.muted);
  }

  hideStart() {
    this.el.screenStart.classList.add('hidden');
  }

  showHUD() {
    this.el.hud.classList.remove('hidden');
    this.cache = {};
  }

  hideHUD() {
    this.el.hud.classList.add('hidden');
  }

  showPause() {
    this.el.screenPause.classList.remove('hidden');
  }

  hidePause() {
    this.el.screenPause.classList.add('hidden');
  }

  showRevive(data) {
    this.el.reviveNote.textContent = data.free
      ? '本次奔跑首次复活免费，恢复后获得 2.5 秒无敌与安全跑道。'
      : `再次复活将消耗 ${data.cost} 金币（当前金币银行 ${formatNumber(data.bank)}）。`;
    this.el.reviveBtn.textContent = data.free ? '免费复活' : `花费 ${data.cost} 金币复活`;
    this.el.reviveBtn.disabled = !data.free && data.bank < data.cost;
    this.el.reviveCount.textContent = '5';
    this.el.screenRevive.classList.remove('hidden');
  }

  updateRevive(seconds, affordable) {
    const value = String(Math.max(0, Math.ceil(seconds)));
    if (this.cache.reviveCount !== value) {
      this.el.reviveCount.textContent = value;
      this.cache.reviveCount = value;
    }
    const disabled = !affordable;
    if (this.el.reviveBtn.disabled !== disabled) this.el.reviveBtn.disabled = disabled;
  }

  hideRevive() {
    this.el.screenRevive.classList.add('hidden');
  }

  showGameOver(data) {
    this.el.goScore.textContent = formatNumber(data.score);
    this.el.goDistance.textContent = formatDistance(data.distance);
    this.el.goCoins.textContent = formatNumber(data.coins);
    this.el.goCombo.textContent = formatNumber(data.combo);
    this.el.goRewards.textContent = formatNumber(data.rewards);
    this.el.goBest.textContent = formatNumber(data.best);
    this.el.goBank.textContent = formatNumber(data.bank);
    this.el.goRecord.classList.toggle('hidden', !data.isRecord);
    this.el.screenGameover.classList.remove('hidden');
  }

  hideGameOver() {
    this.el.screenGameover.classList.add('hidden');
  }

  showRewardBanner(mode, duration, multiplier) {
    this.rewardMode = mode;
    this.el.rewardBanner.dataset.mode = mode;
    this.el.rewardTitle.textContent = mode === 'super' ? '超级奖励' : '穿越奖励';
    this.el.rewardSub.textContent = mode === 'super'
      ? `黄金金币雨 · 表现分 ×${multiplier}`
      : `高速时空隧道 · 表现分 ×${multiplier}`;
    this.el.rewardTime.textContent = duration.toFixed(1);
    this.el.rewardFill.style.width = '100%';
    this.el.rewardBanner.classList.remove('hidden');
  }

  updateReward(remaining, duration) {
    if (this.el.rewardBanner.classList.contains('hidden')) return;
    const ratio = clamp(remaining / duration, 0, 1);
    this.el.rewardTime.textContent = Math.max(0, remaining).toFixed(1);
    this.el.rewardFill.style.width = `${ratio * 100}%`;
  }

  hideRewardBanner() {
    this.el.rewardBanner.classList.add('hidden');
    this.rewardMode = null;
  }

  updateHUD(data) {
    const setText = (element, key, value) => {
      if (this.cache[key] === value) return;
      element.textContent = value;
      this.cache[key] = value;
    };

    setText(this.el.score, 'score', formatNumber(data.score));
    setText(this.el.distance, 'distance', formatDistance(data.distance));
    setText(this.el.coins, 'coins', formatNumber(data.coins));
    setText(this.el.speed, 'speed', String(Math.round(data.speed * 3.6)));

    const meter = clamp(data.superMeter, 0, 100);
    const meterWidth = `${meter.toFixed(1)}%`;
    if (this.cache.meterWidth !== meterWidth) {
      this.el.superFill.style.width = meterWidth;
      this.cache.meterWidth = meterWidth;
    }
    setText(this.el.superPct, 'meterPct', `${Math.floor(meter)}%`);
    const ready = meter >= 100;
    if (this.cache.meterReady !== ready) {
      this.el.superMeter.classList.toggle('ready', ready);
      this.cache.meterReady = ready;
    }

    const comboVisible = data.combo > 1;
    if (this.cache.comboVisible !== comboVisible) {
      this.el.combo.classList.toggle('hidden', !comboVisible);
      this.cache.comboVisible = comboVisible;
    }
    if (comboVisible) {
      setText(this.el.comboCount, 'comboCount', String(data.combo));
      setText(this.el.comboMult, 'comboMult', `×${data.comboMult}`);
    }

    const powerups = [
      { el: this.el.puMagnet, active: data.magnet > 0, text: data.magnet > 0 ? `${Math.ceil(data.magnet)}s` : '--', key: 'magnet' },
      { el: this.el.puShield, active: data.shield, text: data.shield ? '就绪' : '--', key: 'shield' },
      { el: this.el.puDouble, active: data.double > 0, text: data.double > 0 ? `${Math.ceil(data.double)}s` : '--', key: 'double' },
    ];
    for (const item of powerups) {
      if (this.cache[`${item.key}Active`] !== item.active) {
        item.el.classList.toggle('active', item.active);
        this.cache[`${item.key}Active`] = item.active;
      }
      setText(this.puTime[item.key], `${item.key}Time`, item.text);
    }

    const energy = clamp(data.energy, 0, 100);
    const energyWidth = `${energy.toFixed(0)}%`;
    if (this.cache.energyWidth !== energyWidth) {
      this.el.skillBtn.style.setProperty('--energy', energyWidth);
      this.cache.energyWidth = energyWidth;
    }
    setText(this.el.skillEnergy, 'energyText', `${Math.floor(energy)}%`);
    const skillReady = energy >= 100;
    if (this.cache.skillReady !== skillReady) {
      this.el.skillBtn.classList.toggle('ready', skillReady);
      this.cache.skillReady = skillReady;
    }
    const dashing = Boolean(data.dashing);
    if (this.cache.dashing !== dashing) {
      this.el.skillBtn.classList.toggle('dashing', dashing);
      this.cache.dashing = dashing;
    }
  }

  toast(title, sub = '', duration = 1700) {
    window.clearTimeout(this.toastTimer);
    this.el.toastTitle.textContent = title;
    this.el.toastSub.textContent = sub;
    this.el.toast.classList.remove('hidden');
    this.el.toast.style.animation = 'none';
    void this.el.toast.offsetWidth;
    this.el.toast.style.animation = '';
    this.toastTimer = window.setTimeout(() => {
      this.el.toast.classList.add('hidden');
    }, duration);
  }

  hideToast() {
    window.clearTimeout(this.toastTimer);
    this.el.toast.classList.add('hidden');
  }

  setFade(alpha) {
    const value = clamp(alpha, 0, 1);
    const rounded = Math.round(value * 100) / 100;
    if (this.cache.fade === rounded) return;
    this.cache.fade = rounded;
    this.el.fade.style.opacity = String(rounded);
    this.el.fade.style.pointerEvents = rounded > 0.02 ? 'auto' : 'none';
  }

  flashDamage() {
    this.el.flash.classList.remove('active');
    void this.el.flash.offsetWidth;
    this.el.flash.classList.add('active');
  }

  setMuted(muted) {
    this.el.btnMute.textContent = muted ? '静' : '♪';
    this.el.btnMute.setAttribute('aria-label', muted ? '开启音效' : '关闭音效');
    this.el.btnMuteStart.textContent = muted ? '音效：关' : '音效：开';
  }
}
