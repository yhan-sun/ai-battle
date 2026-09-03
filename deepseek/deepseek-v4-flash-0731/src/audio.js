export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._bgmTimer = null;
    this._bgmStep = 0;
    this._bgmNextTime = 0;
    this._bgmActive = false;
    this._noiseBuf = null;
  }

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 1;
    this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.6;
  }

  _env(opts) {
    const { type = 'sine', from = 220, to = from, dur = 0.15, gain = 0.2, attack = 0.005, slide = 'exp' } = opts;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (slide === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    else osc.frequency.linearRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur = 0.2, gain = 0.15, filterFreq = 800, type = 'lowpass') {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filterFreq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, filterFreq * 0.2), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  jump(double = false) {
    if (!this.ctx || this.muted) return;
    this._env({ type: 'square', from: double ? 420 : 300, to: double ? 720 : 540, dur: 0.14, gain: 0.08 });
  }

  coin() {
    if (!this.ctx || this.muted) return;
    this._env({ type: 'sine', from: 1050, to: 1560, dur: 0.09, gain: 0.09 });
  }

  coinCombo(combo) {
    if (!this.ctx || this.muted) return;
    const base = 880 * Math.pow(1.059, Math.min(combo, 12));
    this._env({ type: 'triangle', from: base, to: base * 1.5, dur: 0.11, gain: 0.1 });
  }

  hit() {
    if (!this.ctx || this.muted) return;
    this._noise(0.22, 0.22, 900);
    this._env({ type: 'sawtooth', from: 190, to: 48, dur: 0.25, gain: 0.16 });
  }

  stomp() {
    if (!this.ctx || this.muted) return;
    this._noise(0.16, 0.16, 1400, 'bandpass');
    this._env({ type: 'square', from: 260, to: 90, dur: 0.12, gain: 0.1 });
  }

  shield() {
    if (!this.ctx || this.muted) return;
    this._env({ type: 'sine', from: 300, to: 900, dur: 0.22, gain: 0.1 });
  }

  power() {
    if (!this.ctx || this.muted) return;
    this._env({ type: 'triangle', from: 440, to: 1100, dur: 0.28, gain: 0.1 });
  }

  sprint() {
    if (!this.ctx || this.muted) return;
    this._env({ type: 'sawtooth', from: 120, to: 520, dur: 0.3, gain: 0.1 });
    this._noise(0.3, 0.12, 3000, 'highpass');
  }

  revive() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this._env({ type: 'triangle', from: f, to: f, dur: 0.18, gain: 0.1 }), i * 90);
    });
  }

  bonusStart() {
    if (!this.ctx || this.muted) return;
    [392, 523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this._env({ type: 'triangle', from: f, to: f, dur: 0.16, gain: 0.1 }), i * 70);
    });
  }

  warpStart() {
    if (!this.ctx || this.muted) return;
    this._env({ type: 'sawtooth', from: 90, to: 980, dur: 0.6, gain: 0.1 });
    this._noise(0.6, 0.12, 5000, 'highpass');
  }

  gameOver() {
    if (!this.ctx || this.muted) return;
    [392, 330, 262, 196].forEach((f, i) => {
      setTimeout(() => this._env({ type: 'sawtooth', from: f, to: f * 0.9, dur: 0.3, gain: 0.09 }), i * 160);
    });
  }

  startBgm() {
    if (!this.ctx || this._bgmActive || this.muted) return;
    this._bgmActive = true;
    this._bgmStep = 0;
    this._bgmNextTime = this.ctx.currentTime + 0.1;
    this._scheduleBgm();
  }

  stopBgm() {
    this._bgmActive = false;
    if (this._bgmTimer) { clearTimeout(this._bgmTimer); this._bgmTimer = null; }
  }

  _scheduleBgm() {
    if (!this._bgmActive || !this.ctx) return;
    const now = this.ctx.currentTime;
    const stepDur = 60 / 138 / 2;
    while (this._bgmNextTime < now + 0.25) {
      this._playBgmStep(this._bgmStep, this._bgmNextTime);
      this._bgmStep++;
      this._bgmNextTime += stepDur;
    }
    this._bgmTimer = setTimeout(() => this._scheduleBgm(), 120);
  }

  _playBgmStep(step, t) {
    if (this.muted) return;
    const root = 55;
    const scale = [0, 3, 5, 7, 10, 12, 15, 17];
    const isBass = step % 8 < 2;
    const freq = root * Math.pow(2, scale[step % scale.length] / 12);
    if (isBass) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(g).connect(this.master);
      osc.start(t); osc.stop(t + 0.55);
    } else {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * 4;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.055, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 1.6);
      osc.connect(g).connect(this.master);
      osc.start(t); osc.stop(t + 0.3);
      if (step % 2 === 0) {
        const hat = this.ctx.createBufferSource();
        hat.buffer = this._noiseBuf;
        const hg = this.ctx.createGain();
        hg.gain.setValueAtTime(0.035, t);
        hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        hat.connect(hg).connect(this.master);
        hat.start(t); hat.stop(t + 0.06);
      }
    }
  }
}