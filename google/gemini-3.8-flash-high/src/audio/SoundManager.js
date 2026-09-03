// Web Audio API Synthesizer for Retro/Arcade Runner
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.muted = false;
    this.bgmStarted = false;
    this.currentBgmMode = 'normal'; // 'normal', 'super', 'rift'
    
    // Musical timing
    this.bpm = 138;
    this.stepIndex = 0;
    this.nextNoteTime = 0;
    this.timerId = null;
    this.comboPitchOffset = 0;
    this.comboResetTimer = null;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.bgmGain.connect(this.masterGain);
  }

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime);
    }
    return this.muted;
  }

  // --- SOUND EFFECTS ---

  playJump() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(560, t + 0.15);
    
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(t);
    osc.stop(t + 0.18);
  }

  playDoubleJump() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.18);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(660, t);
    osc2.frequency.exponentialRampToValueAtTime(1320, t + 0.18);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.22);
    osc2.stop(t + 0.22);
  }

  playSlide() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.22;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.22);
    filter.Q.value = 2.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + 0.23);
  }

  playCoin(tier = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    
    // Combo pitch increment
    this.comboPitchOffset = Math.min(10, this.comboPitchOffset + 1);
    clearTimeout(this.comboResetTimer);
    this.comboResetTimer = setTimeout(() => {
      this.comboPitchOffset = 0;
    }, 700);

    const baseFreqs = [784, 988, 1175, 1568, 1975]; // G5, B5, D6, G6, B6
    const f1 = baseFreqs[Math.min(tier - 1, baseFreqs.length - 1)] * Math.pow(1.05946, this.comboPitchOffset * 0.5);
    const f2 = f1 * 1.5;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f1, t);
    osc1.frequency.setValueAtTime(f1 * 1.2, t + 0.04);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(f2, t);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.15);
    osc2.stop(t + 0.15);
  }

  playStomp() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    
    // Thud + Cartoon Boing
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(450, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.22);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.24);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  playPowerup() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C E G C E
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startT = t + idx * 0.05;
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startT);
      gain.gain.setValueAtTime(0.2, startT);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startT);
      osc.stop(startT + 0.14);
    });
  }

  playShieldBreak() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Shatter sound
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(800, t + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + 0.32);
  }

  playSpringboard() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.25);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  playPortalEnter() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.45);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.52);
  }

  playFeverStart() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const fanfareNotes = [392, 523.25, 659.25, 783.99, 1046.5]; // G4 C5 E5 G5 C6
    fanfareNotes.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteT = t + i * 0.08;

      osc.type = 'square';
      osc.frequency.setValueAtTime(f, noteT);

      gain.gain.setValueAtTime(0.2, noteT);
      gain.gain.exponentialRampToValueAtTime(0.01, noteT + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(noteT);
      osc.stop(noteT + 0.32);
    });
  }

  playHit() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  // --- DYNAMIC BACKGROUND MUSIC ---

  startBgm() {
    if (!this.ctx) this.init();
    if (this.bgmStarted) return;
    this.bgmStarted = true;
    this.stepIndex = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.scheduleBgm();
  }

  stopBgm() {
    this.bgmStarted = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  setBgmMode(mode) {
    // 'normal', 'super', 'rift'
    this.currentBgmMode = mode;
  }

  setSpeedFactor(factor) {
    // Faster running speeds up music slightly
    this.bpm = Math.min(170, 138 * Math.pow(factor, 0.25));
  }

  scheduleBgm() {
    if (!this.bgmStarted || !this.ctx) return;

    const secondsPerStep = 60 / this.bpm / 4; // 16th note steps
    const lookAhead = 0.1;

    while (this.nextNoteTime < this.ctx.currentTime + lookAhead) {
      this.playStep(this.stepIndex, this.nextNoteTime);
      this.stepIndex = (this.stepIndex + 1) % 64; // 4-bar loop
      this.nextNoteTime += secondsPerStep;
    }

    this.timerId = setTimeout(() => this.scheduleBgm(), 25);
  }

  playStep(step, time) {
    if (this.muted) return;

    // Drum kick on beats 0, 4, 8, 12, 16...
    if (step % 4 === 0) {
      this.playKick(time);
    }
    // Snare on beats 4, 12 (i.e. step 8, 24 in 16th notes)
    if (step % 16 === 4 || step % 16 === 12) {
      this.playSnare(time);
    }
    // Hi-hat on every odd step
    if (step % 2 === 1) {
      this.playHiHat(time, step % 4 === 1 ? 0.04 : 0.08);
    }

    // Melodies & Basslines depending on Mode
    if (this.currentBgmMode === 'normal') {
      this.playNormalBassMelody(step, time);
    } else if (this.currentBgmMode === 'super') {
      this.playSuperRewardMusic(step, time);
    } else if (this.currentBgmMode === 'rift') {
      this.playRiftMusic(step, time);
    }
  }

  playKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(35, time + 0.08);

    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    osc.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(time);
    osc.stop(time + 0.12);
  }

  playSnare(time) {
    // Noise buffer
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.25;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);

    noise.start(time);
    noise.stop(time + 0.11);
  }

  playHiHat(time, vol = 0.06) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(8000, time);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    osc.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(time);
    osc.stop(time + 0.035);
  }

  playNormalBassMelody(step, time) {
    // Upbeat C-G-Am-F bassline
    const chords = [65.41, 49.00, 55.00, 43.65]; // C2, G1, A1, F1
    const chordIdx = Math.floor(step / 16);
    const baseFreq = chords[chordIdx];

    // Bass on 8th notes (steps 0, 2, 4, 6...)
    if (step % 2 === 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const freq = (step % 4 === 2) ? baseFreq * 1.5 : baseFreq;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.09);

      osc.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(time);
      osc.stop(time + 0.1);
    }

    // Lead melody pentatonic C5 D5 E5 G5 A5 C6
    const melodyPattern = [
      523.25, 0, 659.25, 523.25, 783.99, 0, 659.25, 0,
      880.00, 783.99, 659.25, 0, 523.25, 0, 587.33, 0,
      659.25, 0, 783.99, 0, 1046.5, 0, 880.00, 0,
      783.99, 659.25, 587.33, 523.25, 587.33, 0, 523.25, 0
    ];
    const note = melodyPattern[step % 32];
    if (note > 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note, time);

      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

      osc.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(time);
      osc.stop(time + 0.13);
    }
  }

  playSuperRewardMusic(step, time) {
    // Euphoric shimmering high arpeggios in major key (G major / C major)
    const arpeggio = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 1318.5, 1046.5];
    const freq = arpeggio[step % arpeggio.length];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.16, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(time);
    osc.stop(time + 0.09);
  }

  playRiftMusic(step, time) {
    // Fast cyber arpeggio with sawtooth punch (Synthwave Cyber vibe)
    const cyberNotes = [174.61, 220, 261.63, 349.23, 440, 523.25, 698.46, 523.25];
    const freq = cyberNotes[step % cyberNotes.length];

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.75, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400 + Math.sin(step * 0.5) * 1200, time);

    gain.gain.setValueAtTime(0.14, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + 0.07);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(time);
    osc.stop(time + 0.08);
  }
}
