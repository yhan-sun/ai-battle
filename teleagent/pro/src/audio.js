// 程序化 WebAudio 合成音效与 BGM，无任何外部音频资源
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.lastBeat = 0;
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
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.45;
    this.musicGain.connect(this.master);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // 基础包络音符
  tone({ freq = 440, type = 'sine', dur = 0.15, vol = 0.3, slide = 0, when = 0, dest = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (when || 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest || this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.25, freq = 1200, type = 'highpass' }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  jump() {
    this.tone({ freq: 300, slide: 320, dur: 0.18, type: 'square', vol: 0.12 });
  }
  doubleJump() {
    this.tone({ freq: 420, slide: 420, dur: 0.16, type: 'triangle', vol: 0.14 });
  }
  coin() {
    this.tone({ freq: 880, slide: 260, dur: 0.12, type: 'sine', vol: 0.16 });
    this.tone({ freq: 1320, slide: 0, dur: 0.08, type: 'sine', vol: 0.1, when: 0.05 });
  }
  stomp() {
    this.tone({ freq: 160, slide: -90, dur: 0.14, type: 'sawtooth', vol: 0.2 });
    this.noise({ dur: 0.12, vol: 0.16, freq: 800 });
  }
  hurt() {
    this.tone({ freq: 220, slide: -140, dur: 0.3, type: 'sawtooth', vol: 0.2 });
    this.tone({ freq: 110, slide: -60, dur: 0.4, type: 'square', vol: 0.16, when: 0.04 });
  }
  dash() {
    this.tone({ freq: 240, slide: 900, dur: 0.3, type: 'sawtooth', vol: 0.16 });
    this.noise({ dur: 0.35, vol: 0.18, freq: 2000, type: 'bandpass' });
  }
  powerup() {
    this.tone({ freq: 520, dur: 0.1, type: 'square', vol: 0.12 });
    this.tone({ freq: 780, dur: 0.1, type: 'square', vol: 0.12, when: 0.08 });
    this.tone({ freq: 1040, dur: 0.16, type: 'square', vol: 0.14, when: 0.16 });
  }
  shield() {
    this.tone({ freq: 600, dur: 0.2, type: 'triangle', vol: 0.16 });
    this.tone({ freq: 900, dur: 0.25, type: 'triangle', vol: 0.12, when: 0.06 });
  }
  warp() {
    this.tone({ freq: 100, slide: 1200, dur: 0.6, type: 'sine', vol: 0.2 });
    this.noise({ dur: 0.6, vol: 0.14, freq: 500, type: 'bandpass' });
  }
  bonusStart() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.15, when: i * 0.07 })
    );
  }
  gameover() {
    [392, 330, 262, 196].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.18, when: i * 0.18 })
    );
  }

  // 简单可循环 BGM（小调琶音 + 低音脉冲）
  startMusic() {
    this.ensure();
    if (!this.ctx || this.musicTimer) return;
    this.musicStep = 0;
    this.lastBeat = this.ctx.currentTime + 0.05;
    this.scheduleMusic();
    this.musicTimer = setInterval(() => this.scheduleMusic(), 400);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  scheduleMusic() {
    if (!this.ctx) return;
    const bass = [65.4, 65.4, 98, 87.3, 65.4, 65.4, 98, 110];
    const arp = [523, 659, 784, 659, 587, 659, 784, 988];
    while (this.lastBeat < this.ctx.currentTime + 0.6) {
      const step = this.musicStep % bass.length;
      const when = this.lastBeat - this.ctx.currentTime;
      // 低音
      this.tone({
        freq: bass[step],
        dur: 0.35,
        type: 'triangle',
        vol: 0.16,
        when,
        dest: this.musicGain,
      });
      // 轻快琶音
      if (step % 2 === 0) {
        this.tone({
          freq: arp[this.musicStep % arp.length] * 1,
          dur: 0.18,
          type: 'sine',
          vol: 0.07,
          when: when + 0.2,
          dest: this.musicGain,
        });
      }
      this.lastBeat += 0.22;
      this.musicStep++;
    }
  }
}