// WebAudio 合成音效 + 简易BGM,无外部资源
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.master = null;
  }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  tone(freq, dur = 0.12, type = 'square', vol = 0.25, slideTo = null, delay = 0) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur = 0.2, vol = 0.2, delay = 0) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  jump(double = false) { this.tone(double ? 520 : 380, 0.16, 'square', 0.22, double ? 980 : 720); }
  slide() { this.noise(0.18, 0.18); this.tone(200, 0.15, 'sawtooth', 0.12, 90); }
  coin() { this.tone(950, 0.07, 'square', 0.16); this.tone(1420, 0.12, 'square', 0.14, null, 0.06); }
  hit() { this.noise(0.3, 0.35); this.tone(160, 0.3, 'sawtooth', 0.3, 50); }
  stomp() { this.tone(300, 0.12, 'square', 0.28, 90); this.noise(0.12, 0.2); }
  power() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'square', 0.18, null, i * 0.07)); }
  portal() { this.tone(200, 0.5, 'sawtooth', 0.22, 1200); this.tone(100, 0.5, 'square', 0.15, 800, 0.05); }
  skill() { this.tone(150, 0.4, 'sawtooth', 0.28, 900); this.noise(0.3, 0.15, 0.1); }
  revive() { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.2, null, i * 0.08)); }
  over() { [400, 350, 300, 200].forEach((f, i) => this.tone(f, 0.25, 'sawtooth', 0.2, null, i * 0.18)); }
  click() { this.tone(700, 0.06, 'square', 0.15); }
  startBgm() {
    this.ensure();
    this.stopBgm();
    // 简易bass+arp循环,超奖励/穿越时变速由外部调step
    this.bgmStep = 0;
    const bass = [110, 110, 130.8, 98, 110, 110, 146.8, 130.8];
    const arp = [440, 523, 659, 523, 440, 587, 659, 784];
    this.bgmTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const s = this.bgmStep % 8;
      this.tone(bass[s], 0.22, 'triangle', 0.16);
      this.tone(arp[s], 0.12, 'square', 0.05);
      if (s % 2 === 0) this.tone(arp[(s + 3) % 8] * 2, 0.08, 'sine', 0.04);
      this.bgmStep++;
    }, 240);
  }
  stopBgm() { if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; } }
}
