/**
 * 全程序化音频系统。
 * - 所有音效由 WebAudio 振荡器 / 噪声实时合成；
 * - 背景音乐是 32 步循环，由低音、琶音、底鼓与踩镲组成；
 * - 首次用户手势后才创建 AudioContext，符合浏览器自动播放策略。
 */
export class AudioSystem {
  constructor(save) {
    this.save = save;
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noiseBuffer = null;
    this.muted = Boolean(save.data.muted);
    this.musicTimer = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.musicPlaying = false;
    this.lastCoinAt = 0;
  }

  init() {
    if (this.ctx) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    try {
      this.ctx = new AudioCtx();
    } catch {
      return false;
    }

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.62;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);

    const length = Math.floor(this.ctx.sampleRate * 1.2);
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;

    return true;
  }

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      const target = muted ? 0 : 0.62;
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }
  }

  tone({
    freq = 440,
    toFreq = null,
    duration = 0.18,
    type = 'sine',
    volume = 0.16,
    delay = 0,
    attack = 0.006,
  } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (toFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), t0 + duration);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  noise({
    duration = 0.2,
    volume = 0.18,
    filterFreq = 1200,
    filterType = 'lowpass',
    delay = 0,
    q = 0.8,
  } = {}) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    source.start(t0);
    source.stop(t0 + duration + 0.02);
  }

  click() {
    this.tone({ freq: 620, toFreq: 880, duration: 0.07, type: 'sine', volume: 0.1 });
  }

  jump() {
    this.tone({ freq: 310, toFreq: 560, duration: 0.16, type: 'triangle', volume: 0.16 });
    this.noise({ duration: 0.09, volume: 0.06, filterFreq: 1600, filterType: 'highpass' });
  }

  doubleJump() {
    this.tone({ freq: 520, toFreq: 940, duration: 0.18, type: 'sine', volume: 0.14 });
    this.tone({ freq: 780, toFreq: 1240, duration: 0.14, type: 'triangle', volume: 0.08, delay: 0.03 });
  }

  land() {
    this.noise({ duration: 0.09, volume: 0.08, filterFreq: 420 });
    this.tone({ freq: 130, toFreq: 70, duration: 0.1, type: 'sine', volume: 0.08 });
  }

  coin() {
    if (!this.ctx) return;
    // 限制金币音效密度，避免连续吃币时爆音。
    if (this.ctx.currentTime - this.lastCoinAt < 0.045) return;
    this.lastCoinAt = this.ctx.currentTime;
    const base = 980 + Math.random() * 140;
    this.tone({ freq: base, duration: 0.07, type: 'sine', volume: 0.09 });
    this.tone({ freq: base * 1.5, duration: 0.1, type: 'sine', volume: 0.07, delay: 0.045 });
  }

  stomp() {
    this.tone({ freq: 240, toFreq: 85, duration: 0.16, type: 'square', volume: 0.14 });
    this.noise({ duration: 0.16, volume: 0.16, filterFreq: 900 });
  }

  hit() {
    this.noise({ duration: 0.34, volume: 0.32, filterFreq: 800 });
    this.tone({ freq: 190, toFreq: 48, duration: 0.4, type: 'sawtooth', volume: 0.2 });
    this.tone({ freq: 96, toFreq: 40, duration: 0.5, type: 'sine', volume: 0.18 });
  }

  shieldBreak() {
    this.tone({ freq: 1100, toFreq: 320, duration: 0.28, type: 'sine', volume: 0.16 });
    this.noise({ duration: 0.22, volume: 0.14, filterFreq: 3000, filterType: 'highpass' });
  }

  powerup() {
    [523, 659, 784, 1046].forEach((freq, index) => {
      this.tone({ freq, duration: 0.16, type: 'sine', volume: 0.12, delay: index * 0.055 });
    });
  }

  magic() {
    [880, 1174, 1568].forEach((freq, index) => {
      this.tone({ freq, duration: 0.22, type: 'sine', volume: 0.07, delay: index * 0.05 });
    });
  }

  dash() {
    this.noise({ duration: 0.34, volume: 0.18, filterFreq: 2400, filterType: 'highpass' });
    this.tone({ freq: 180, toFreq: 720, duration: 0.3, type: 'sawtooth', volume: 0.12 });
  }

  portal() {
    [392, 523, 659, 880, 1046].forEach((freq, index) => {
      this.tone({ freq, duration: 0.35, type: 'triangle', volume: 0.09, delay: index * 0.06 });
    });
    this.noise({ duration: 0.7, volume: 0.1, filterFreq: 2800, filterType: 'highpass' });
  }

  reward(type = 'super') {
    const base = type === 'travel' ? 523 : 659;
    const scale = type === 'travel' ? [1, 1.2, 1.5, 2, 2.4, 3] : [1, 1.25, 1.5, 2, 2.5, 3];
    scale.forEach((mult, index) => {
      this.tone({
        freq: base * mult,
        duration: 0.26,
        type: 'triangle',
        volume: 0.11,
        delay: index * 0.07,
      });
    });
  }

  revive() {
    [220, 330, 440, 660, 880].forEach((freq, index) => {
      this.tone({ freq, duration: 0.3, type: 'sine', volume: 0.1, delay: index * 0.06 });
    });
  }

  gameOver() {
    [392, 349, 294, 220].forEach((freq, index) => {
      this.tone({ freq, duration: 0.42, type: 'triangle', volume: 0.12, delay: index * 0.14 });
    });
    this.noise({ duration: 0.9, volume: 0.07, filterFreq: 500 });
  }

  record() {
    [784, 988, 1174, 1568].forEach((freq, index) => {
      this.tone({ freq, duration: 0.3, type: 'triangle', volume: 0.1, delay: index * 0.09 });
    });
  }

  superReady() {
    [880, 1108, 1318].forEach((freq, index) => {
      this.tone({ freq, duration: 0.2, type: 'sine', volume: 0.1, delay: index * 0.07 });
    });
  }

  // ------------------------- 背景音乐 -------------------------

  startMusic() {
    if (!this.init() || this.musicPlaying) return;
    this.musicPlaying = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.15;
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.4);
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 70);
    this.scheduleMusic();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    }
  }

  duckMusic(ducked) {
    if (!this.musicBus || !this.ctx || !this.musicPlaying) return;
    this.musicBus.gain.setTargetAtTime(ducked ? 0.13 : 0.5, this.ctx.currentTime, 0.25);
  }

  scheduleMusic() {
    if (!this.ctx || !this.musicPlaying) return;
    const stepDuration = 60 / 112 / 2; // 112 BPM，八分音符
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextNoteTime, stepDuration);
      this.step = (this.step + 1) % 32;
      this.nextNoteTime += stepDuration;
    }
  }

  playStep(step, time, stepDuration) {
    if (this.muted) return;
    const bar = Math.floor(step / 8) % 4;
    const bassNotes = [110, 87.31, 130.81, 98];
    const arpScale = [440, 523.25, 659.25, 523.25, 587.33, 698.46, 880, 698.46];

    if (step % 4 === 0) {
      this.musicTone(bassNotes[bar], time, stepDuration * 3.6, 'triangle', 0.09);
    }

    const arpFreq = arpScale[step % arpScale.length] * (bar === 3 ? 1.5 : 1);
    this.musicTone(arpFreq, time, stepDuration * 0.9, 'sine', 0.032);

    if (step % 2 === 0) {
      this.musicNoise(time, 0.035, 0.018, 7200, 'highpass');
    }

    if (step % 8 === 0) {
      this.musicKick(time);
    }

    if (step % 8 === 4) {
      this.musicNoise(time, 0.12, 0.03, 1600, 'bandpass');
    }
  }

  musicTone(freq, time, duration, type, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  musicNoise(time, duration, volume, freq, type) {
    if (!this.noiseBuffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    source.start(time);
    source.stop(time + duration + 0.02);
  }

  musicKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    gain.gain.setValueAtTime(0.11, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    osc.connect(gain);
    gain.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.18);
  }
}
