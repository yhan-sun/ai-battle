export class AudioEngine {
  constructor(enabled = true) { this.enabled = enabled; this.ctx = null; this.lastCoin = 0; }
  unlock() {
    try {
      if (!this.ctx) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (Audio) this.ctx = new Audio();
      }
      if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch { /* Audio is optional on browsers without a usable output device. */ }
  }
  tone(frequency, duration = .12, type = 'sine', volume = .055, delay = 0, end = frequency) {
    if (!this.enabled || this.ctx?.state !== 'running') return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain); gain.connect(this.ctx.destination); osc.start(start); osc.stop(start + duration + .01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  play(event) {
    if (event.type === 'coin') {
      const now = this.ctx?.currentTime ?? 0;
      if (now - this.lastCoin < .045) return;
      this.lastCoin = now;
      this.tone([659, 784, 880, 1046, 1174, 1318][event.combo % 6], .1, 'sine', .034);
    } else if (event.type === 'jump') this.tone(event.double ? 570 : 310, .16, 'triangle', .055, 0, event.double ? 1030 : 660);
    else if (event.type === 'land') this.tone(130, .055, 'triangle', .025, 0, 75);
    else if (['start', 'revive', 'power'].includes(event.type)) [523, 659, 784].forEach((f, i) => this.tone(f, .2, 'triangle', .05, i * .075));
    else if (['mode', 'return'].includes(event.type)) [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, .3, 'sine', .065, i * .085));
    else if (event.type === 'skill') this.tone(180, .5, 'sawtooth', .025, 0, 1100);
    else if (event.type === 'stomp') { this.tone(160, .15, 'square', .035, 0, 500); this.tone(780, .17, 'sine', .04, .1); }
    else if (['hit', 'break'].includes(event.type)) this.tone(125, .22, 'sawtooth', .045, 0, 45);
    else if (event.type === 'death') [370, 277, 185].forEach((f, i) => this.tone(f, .3, 'triangle', .06, i * .14));
  }
}
