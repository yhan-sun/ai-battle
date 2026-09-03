// WebAudio 全程序化合成音效与 BGM，无任何外部音频资源
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.4;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.85;
    this.sfxGain.connect(this.master);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  // 基础音：一个带包络的振荡器
  tone({ freq = 440, end = freq, dur = 0.12, type = 'sine', vol = 0.25, when = 0, gainNode = null }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (end !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(gainNode || this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  // 噪声爆发（踩踏、爆炸、冲刺）
  noise({ dur = 0.2, vol = 0.3, freq = 800, when = 0, gainNode = null, filterType = 'lowpass' }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(gainNode || this.sfxGain);
    src.start(t0);
  }

  /* ---------------- SFX ---------------- */
  jump() {
    this.tone({ freq: 330, end: 660, dur: 0.14, type: 'square', vol: 0.16 });
  }
  doubleJump() {
    this.tone({ freq: 440, end: 880, dur: 0.14, type: 'square', vol: 0.16 });
    this.tone({ freq: 660, end: 990, dur: 0.12, type: 'sine', vol: 0.2, when: 0.03 });
  }
  tripleJump() {
    this.tone({ freq: 520, end: 1180, dur: 0.18, type: 'square', vol: 0.17 });
    this.tone({ freq: 780, end: 1300, dur: 0.16, type: 'sine', vol: 0.24, when: 0.05 });
  }
  slide() {
    this.noise({ dur: 0.22, vol: 0.18, freq: 900, filterType: 'highpass' });
  }
  coin(combo = 0) {
    const base = 1050 + Math.min(combo, 12) * 55;
    this.tone({ freq: base, end: base * 1.5, dur: 0.09, type: 'triangle', vol: 0.2 });
    this.tone({ freq: base * 1.5, end: base * 1.9, dur: 0.11, type: 'sine', vol: 0.16, when: 0.045 });
  }
  stomp() {
    this.noise({ dur: 0.18, vol: 0.32, freq: 500 });
    this.tone({ freq: 180, end: 60, dur: 0.16, type: 'sawtooth', vol: 0.22 });
  }
  hurt() {
    this.noise({ dur: 0.28, vol: 0.34, freq: 320, filterType: 'lowpass' });
    this.tone({ freq: 300, end: 90, dur: 0.28, type: 'sawtooth', vol: 0.3 });
  }
  pickup(item) {
    if (item === 'magnet') {
      this.tone({ freq: 620, end: 1240, dur: 0.2, type: 'square', vol: 0.18 });
      this.tone({ freq: 930, end: 1860, dur: 0.18, type: 'sine', vol: 0.18, when: 0.08 });
    } else if (item === 'shield') {
      this.tone({ freq: 520, end: 1040, dur: 0.25, type: 'triangle', vol: 0.22 });
      this.tone({ freq: 1040, dur: 0.2, type: 'sine', vol: 0.14, when: 0.1 });
    } else if (item === 'dash') {
      this.noise({ dur: 0.4, vol: 0.26, freq: 1200, filterType: 'highpass' });
      this.tone({ freq: 240, end: 480, dur: 0.35, type: 'sawtooth', vol: 0.2 });
    } else if (item === 'mount') {
      this.tone({ freq: 300, end: 900, dur: 0.3, type: 'triangle', vol: 0.24 });
      this.tone({ freq: 450, end: 1350, dur: 0.26, type: 'sine', vol: 0.2, when: 0.1 });
    }
  }
  skill() {
    this.noise({ dur: 0.5, vol: 0.3, freq: 1500, filterType: 'highpass' });
    this.tone({ freq: 200, end: 1000, dur: 0.5, type: 'sawtooth', vol: 0.24 });
  }
  dash() {
    this.noise({ dur: 0.35, vol: 0.32, freq: 2000, filterType: 'highpass' });
    this.tone({ freq: 130, end: 420, dur: 0.4, type: 'sawtooth', vol: 0.26 });
  }
  gate() {
    // 琶音：奖励门 点亮
    const seq = [523, 659, 784, 1047, 1319];
    seq.forEach((f, i) => this.tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.22, when: i * 0.08 }));
  }
  bonusEnter() {
    const seq = [392, 523, 659, 784, 1047, 1319, 1568];
    seq.forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'square', vol: 0.2, when: i * 0.09 }));
  }
  bonusExit() {
    const seq = [1568, 1319, 1047, 784, 659, 523, 392];
    seq.forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.2, when: i * 0.07 }));
  }
  dead() {
    const seq = [660, 560, 470, 390, 300, 200];
    seq.forEach((f, i) => this.tone({ freq: f, end: f * 0.85, dur: 0.22, type: 'sawtooth', vol: 0.24, when: i * 0.12 }));
    this.noise({ dur: 0.5, vol: 0.3, freq: 300, when: 0.1 });
  }
  revive() {
    const seq = [262, 392, 523, 784];
    seq.forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'sine', vol: 0.24, when: i * 0.1 }));
  }
  ui() {
    this.tone({ freq: 700, dur: 0.07, type: 'sine', vol: 0.14 });
  }
  comboUp(level) {
    this.tone({ freq: 500 + level * 160, end: 700 + level * 160, dur: 0.14, type: 'triangle', vol: 0.2 });
  }

  /* ---------------- BGM ---------------- */
  // 8 小节循环：低音 + 主旋律，基于五分音符序列
  startMusic(kind = 'main') {
    this.ensure();
    if (!this.ctx) return;
    this.stopMusic();
    this.musicKind = kind;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => this.tickMusic(), 220);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  tickMusic() {
    if (!this.ctx || this.muted || !this.musicGain) return;
    const s = this.musicStep % 24;
    const main = this.musicKind === 'warp' || this.musicKind === 'bonus';
    // 旋律表（freq 或 0=休止）
    const lead = main
      ? [523, 0, 659, 784, 0, 880, 0, 784, 659, 0, 523, 587, 659, 0, 392, 0, 523, 0, 659, 784, 1047, 0, 880, 659]
      : [392, 523, 0, 587, 523, 0, 440, 523, 392, 0, 330, 392, 440, 0, 440, 0, 392, 523, 0, 587, 523, 0, 440, 392];
    const bass = [131, 0, 0, 196, 0, 0, 147, 0, 0, 131, 0, 0, 123, 0, 147, 0, 131, 0, 0, 196, 0, 0, 147, 0];
    const nextLead = lead[s];
    const nextBass = bass[s];
    const stepDur = 0.212;
    if (nextLead) {
      this.tone({
        freq: nextLead,
        dur: stepDur * 0.9,
        type: main ? 'square' : 'triangle',
        vol: main ? 0.1 : 0.09,
        gainNode: this.musicGain,
      });
    }
    if (nextBass && s % 4 === 0) {
      this.tone({
        freq: nextBass,
        dur: stepDur * 2.2,
        type: 'sine',
        vol: 0.16,
        gainNode: this.musicGain,
      });
    }
    this.musicStep++;
  }
}
