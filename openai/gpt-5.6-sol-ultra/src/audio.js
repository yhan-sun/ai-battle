const SILENCE = 0.0001;

export const AUDIO_SFX = Object.freeze([
  'jump',
  'double',
  'coin',
  'hit',
  'shield',
  'stomp',
  'skill',
  'dash',
  'portal',
  'reward',
  'revive',
  'gameover',
  'click',
]);

const KNOWN_SFX = new Set(AUDIO_SFX);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeIntensity(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number <= 1) return clamp(number, 0, 1);
  return clamp(Math.log2(number + 1) / 5, 0, 1);
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * Create a lazy, asset-free WebAudio manager.
 *
 * No AudioContext is constructed until unlock() is called (or the optional
 * first-interaction handler runs), so importing/creating this in SSR and in
 * browsers with autoplay restrictions is safe.
 */
export function createAudio(options = {}) {
  const masterVolume = clamp(Number(options.volume ?? 0.82), 0, 1);
  const sfxVolume = clamp(Number(options.sfxVolume ?? 0.78), 0, 1);
  const musicVolume = clamp(Number(options.musicVolume ?? 0.2), 0, 1);

  let context = null;
  let master = null;
  let compressor = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuffer = null;
  let unlockPromise = null;
  let unlocked = false;
  let muted = Boolean(options.muted);
  let intensity = normalizeIntensity(options.intensity, 0.25);
  let mode = String(options.mode ?? 'play').toLowerCase();
  let nextStepAt = 0;
  let stepIndex = 0;
  let lastMusicLevel = -1;
  let pendingSfx = [];
  let gestureTarget = null;

  const activeSources = new Set();

  function createNoiseBuffer() {
    if (!context) return null;
    const length = Math.ceil(context.sampleRate * 1.25);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;

    for (let i = 0; i < samples.length; i += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.32 + white * 0.68;
      samples[i] = previous;
    }

    return buffer;
  }

  function ensureContext() {
    if (context && context.state !== 'closed') return context;

    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      context = new AudioContextClass();
      master = context.createGain();
      compressor = context.createDynamicsCompressor();
      sfxBus = context.createGain();
      musicBus = context.createGain();

      master.gain.value = muted ? 0 : masterVolume;
      sfxBus.gain.value = sfxVolume;
      musicBus.gain.value = musicVolume;

      compressor.threshold.value = -18;
      compressor.knee.value = 14;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;

      sfxBus.connect(master);
      musicBus.connect(master);
      master.connect(compressor);
      compressor.connect(context.destination);
      noiseBuffer = createNoiseBuffer();
      nextStepAt = context.currentTime + 0.04;
      stepIndex = 0;
      lastMusicLevel = musicVolume;
    } catch {
      context = null;
      master = null;
      compressor = null;
      sfxBus = null;
      musicBus = null;
      noiseBuffer = null;
    }

    return context;
  }

  function trackSource(source, cleanup = []) {
    activeSources.add(source);
    source.addEventListener?.('ended', () => {
      activeSources.delete(source);
      for (const node of cleanup) {
        try {
          node.disconnect();
        } catch {
          // It is safe for teardown to race AudioContext.close().
        }
      }
    }, { once: true });
  }

  function connectWithPan(input, bus, pan) {
    if (!context || !bus || !Number.isFinite(pan) || !context.createStereoPanner) {
      input.connect(bus);
      return null;
    }

    const panner = context.createStereoPanner();
    panner.pan.value = clamp(pan, -1, 1);
    input.connect(panner);
    panner.connect(bus);
    return panner;
  }

  function tone({
    frequency,
    endFrequency = frequency,
    duration = 0.12,
    type = 'sine',
    volume = 0.15,
    when,
    attack = 0.004,
    pan = 0,
    detune = 0,
    bus = sfxBus,
  }) {
    if (!context || !bus || context.state !== 'running') return;

    const start = Math.max(context.currentTime, Number(when ?? context.currentTime));
    const length = clamp(Number(duration), 0.015, 3);
    const end = start + length;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const peak = clamp(Number(volume), SILENCE, 1);

    oscillator.type = type;
    oscillator.detune.value = Number(detune) || 0;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), end);

    envelope.gain.setValueAtTime(SILENCE, start);
    envelope.gain.linearRampToValueAtTime(peak, start + Math.min(attack, length * 0.35));
    envelope.gain.exponentialRampToValueAtTime(SILENCE, end);

    oscillator.connect(envelope);
    const panner = connectWithPan(envelope, bus, pan);
    trackSource(oscillator, [oscillator, envelope, panner].filter(Boolean));
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  function noise({
    duration = 0.08,
    volume = 0.12,
    when,
    filterType = 'bandpass',
    frequency = 1800,
    endFrequency = frequency,
    q = 0.8,
    attack = 0.002,
    pan = 0,
    bus = sfxBus,
  }) {
    if (!context || !noiseBuffer || !bus || context.state !== 'running') return;

    const start = Math.max(context.currentTime, Number(when ?? context.currentTime));
    const length = clamp(Number(duration), 0.01, 2);
    const end = start + length;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const peak = clamp(Number(volume), SILENCE, 1);

    source.buffer = noiseBuffer;
    source.loop = true;
    filter.type = filterType;
    filter.Q.value = Math.max(0.001, Number(q));
    filter.frequency.setValueAtTime(Math.max(30, frequency), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), end);

    envelope.gain.setValueAtTime(SILENCE, start);
    envelope.gain.linearRampToValueAtTime(peak, start + Math.min(attack, length * 0.3));
    envelope.gain.exponentialRampToValueAtTime(SILENCE, end);

    source.connect(filter);
    filter.connect(envelope);
    const panner = connectWithPan(envelope, bus, pan);
    trackSource(source, [source, filter, envelope, panner].filter(Boolean));
    source.start(start, Math.random() * 0.6);
    source.stop(end + 0.02);
  }

  function playSound(name, at = context?.currentTime ?? 0) {
    if (!context || context.state !== 'running') return false;

    switch (name) {
      case 'jump':
        tone({ frequency: 270, endFrequency: 690, duration: 0.18, type: 'triangle', volume: 0.22, when: at });
        tone({ frequency: 540, endFrequency: 920, duration: 0.11, type: 'sine', volume: 0.08, when: at + 0.045 });
        break;

      case 'double':
        tone({ frequency: 290, endFrequency: 700, duration: 0.14, type: 'triangle', volume: 0.17, when: at });
        tone({ frequency: 480, endFrequency: 1040, duration: 0.18, type: 'triangle', volume: 0.2, when: at + 0.09 });
        tone({ frequency: 960, endFrequency: 1320, duration: 0.11, type: 'sine', volume: 0.07, when: at + 0.15 });
        break;

      case 'coin':
        tone({ frequency: 880, duration: 0.07, type: 'square', volume: 0.1, when: at });
        tone({ frequency: 1320, duration: 0.08, type: 'triangle', volume: 0.17, when: at + 0.055 });
        tone({ frequency: 1760, duration: 0.1, type: 'sine', volume: 0.11, when: at + 0.105 });
        break;

      case 'hit':
        noise({ duration: 0.16, volume: 0.3, filterType: 'lowpass', frequency: 1700, endFrequency: 180, q: 0.5, when: at });
        tone({ frequency: 185, endFrequency: 48, duration: 0.2, type: 'sawtooth', volume: 0.2, when: at });
        break;

      case 'shield':
        tone({ frequency: 390, endFrequency: 640, duration: 0.26, type: 'sine', volume: 0.2, when: at });
        tone({ frequency: 780, endFrequency: 1180, duration: 0.3, type: 'triangle', volume: 0.1, when: at + 0.025, pan: 0.3 });
        tone({ frequency: 1560, duration: 0.18, type: 'sine', volume: 0.065, when: at + 0.09, pan: -0.25 });
        break;

      case 'stomp':
        tone({ frequency: 145, endFrequency: 38, duration: 0.24, type: 'sine', volume: 0.34, when: at, attack: 0.002 });
        noise({ duration: 0.13, volume: 0.24, filterType: 'lowpass', frequency: 850, endFrequency: 120, q: 0.6, when: at });
        break;

      case 'skill': {
        const notes = [330, 440, 554.37, 659.25, 987.77];
        notes.forEach((frequency, index) => {
          tone({
            frequency,
            endFrequency: frequency * 1.08,
            duration: 0.2,
            type: index < 3 ? 'triangle' : 'sine',
            volume: 0.12,
            when: at + index * 0.055,
            pan: (index - 2) * 0.16,
          });
        });
        noise({ duration: 0.35, volume: 0.07, filterType: 'highpass', frequency: 1900, endFrequency: 7200, q: 0.7, when: at });
        break;
      }

      case 'dash':
        noise({ duration: 0.24, volume: 0.23, filterType: 'bandpass', frequency: 4800, endFrequency: 520, q: 1.2, when: at, pan: -0.2 });
        tone({ frequency: 310, endFrequency: 82, duration: 0.2, type: 'sawtooth', volume: 0.12, when: at, pan: 0.25 });
        break;

      case 'portal':
        for (let i = 0; i < 7; i += 1) {
          const frequency = 300 * (1 + (i % 3) * 0.5);
          tone({
            frequency,
            endFrequency: frequency * (i % 2 ? 0.82 : 1.35),
            duration: 0.24,
            type: 'sine',
            volume: 0.09,
            when: at + i * 0.052,
            pan: Math.sin(i * 2.1) * 0.65,
          });
        }
        noise({ duration: 0.48, volume: 0.055, filterType: 'bandpass', frequency: 500, endFrequency: 4600, q: 3.5, when: at });
        break;

      case 'reward': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((frequency, index) => {
          tone({ frequency, duration: 0.24, type: 'triangle', volume: 0.15, when: at + index * 0.1, pan: index % 2 ? 0.2 : -0.2 });
        });
        [1046.5, 1318.51, 1567.98].forEach((frequency) => {
          tone({ frequency, duration: 0.48, type: 'sine', volume: 0.08, when: at + 0.42 });
        });
        break;
      }

      case 'revive': {
        const notes = [220, 293.66, 392, 523.25, 783.99];
        notes.forEach((frequency, index) => {
          tone({ frequency, endFrequency: frequency * 1.04, duration: 0.3, type: 'sine', volume: 0.13, when: at + index * 0.085 });
        });
        noise({ duration: 0.5, volume: 0.05, filterType: 'highpass', frequency: 1200, endFrequency: 6500, when: at });
        break;
      }

      case 'gameover': {
        const notes = [392, 329.63, 261.63, 196];
        notes.forEach((frequency, index) => {
          tone({ frequency, endFrequency: frequency * 0.92, duration: 0.42, type: 'triangle', volume: 0.17, when: at + index * 0.24 });
        });
        tone({ frequency: 98, endFrequency: 49, duration: 0.85, type: 'sine', volume: 0.18, when: at + 0.72 });
        break;
      }

      case 'click':
        tone({ frequency: 620, endFrequency: 440, duration: 0.045, type: 'square', volume: 0.075, when: at, attack: 0.001 });
        break;

      default:
        return false;
    }

    return true;
  }

  function musicProfile(currentMode, currentIntensity) {
    const label = String(currentMode || 'play').toLowerCase();

    if (/pause|gameover|game-over|dead|silent/.test(label)) {
      return { silent: true, bpm: 90, root: 110, scale: [0], density: 0, level: 0 };
    }
    if (/menu|title|idle|start/.test(label)) {
      return { bpm: 78 + currentIntensity * 12, root: 110, scale: [0, 3, 7, 10], density: 0.3, level: 0.62, style: 'ambient' };
    }
    if (/boss|danger|combat|attack/.test(label)) {
      return { bpm: 126 + currentIntensity * 34, root: 82.41, scale: [0, 1, 5, 6, 8], density: 0.8, level: 1, style: 'danger' };
    }
    if (/rush|dash|speed|turbo|fever/.test(label)) {
      return { bpm: 148 + currentIntensity * 46, root: 110, scale: [0, 3, 5, 7, 10], density: 1, level: 0.95, style: 'rush' };
    }
    if (/portal|space|warp|revive/.test(label)) {
      return { bpm: 94 + currentIntensity * 28, root: 98, scale: [0, 2, 7, 9], density: 0.55, level: 0.78, style: 'portal' };
    }
    if (/reward|win|victory/.test(label)) {
      return { bpm: 112 + currentIntensity * 20, root: 130.81, scale: [0, 4, 7, 9], density: 0.65, level: 0.82, style: 'bright' };
    }

    return {
      bpm: 106 + currentIntensity * 62,
      root: 110,
      scale: [0, 3, 5, 7, 10],
      density: 0.48 + currentIntensity * 0.45,
      level: 0.76 + currentIntensity * 0.2,
      style: 'run',
    };
  }

  function musicKick(when, profile) {
    tone({
      frequency: profile.style === 'danger' ? 142 : 118,
      endFrequency: 43,
      duration: 0.13,
      type: 'sine',
      volume: 0.23,
      attack: 0.002,
      when,
      bus: musicBus,
    });
  }

  function musicSnare(when) {
    noise({ duration: 0.09, volume: 0.12, filterType: 'highpass', frequency: 1100, endFrequency: 2300, q: 0.5, when, bus: musicBus });
    tone({ frequency: 190, endFrequency: 110, duration: 0.075, type: 'triangle', volume: 0.055, when, bus: musicBus });
  }

  function musicHat(when, open = false) {
    noise({
      duration: open ? 0.105 : 0.032,
      volume: open ? 0.055 : 0.038,
      filterType: 'highpass',
      frequency: 6200,
      endFrequency: 8400,
      q: 0.6,
      when,
      pan: (stepIndex % 4 < 2 ? -1 : 1) * 0.22,
      bus: musicBus,
    });
  }

  function scheduleMusicStep(when, index, profile) {
    if (profile.silent) return;

    const step = index % 16;
    const dense = profile.density > 0.72;
    const veryDense = profile.density > 0.9;

    if (step === 0 || step === 8 || (dense && (step === 6 || step === 14))) {
      musicKick(when, profile);
    }
    if (step === 4 || step === 12) musicSnare(when);
    if ((step % (dense ? 2 : 4)) === 0) musicHat(when, step === 14);
    if (veryDense && step % 4 === 3) musicHat(when, false);

    if (step % 2 === 0) {
      const bassPattern = [0, 0, 2, 1, 0, 3, 2, 1];
      const scaleIndex = bassPattern[(step / 2) % bassPattern.length] % profile.scale.length;
      const semitones = profile.scale[scaleIndex];
      const frequency = profile.root * (2 ** (semitones / 12));
      tone({
        frequency,
        endFrequency: frequency * 0.985,
        duration: profile.style === 'ambient' ? 0.28 : 0.15,
        type: profile.style === 'danger' ? 'sawtooth' : 'triangle',
        volume: profile.style === 'danger' ? 0.075 : 0.085,
        when,
        bus: musicBus,
      });
    }

    const melodyEvery = profile.style === 'ambient' ? 8 : (dense ? 4 : 6);
    if (step % melodyEvery === 0) {
      const melodyIndex = (Math.floor(index / melodyEvery) + (step === 8 ? 2 : 0)) % profile.scale.length;
      const semitones = profile.scale[melodyIndex] + 12;
      const frequency = profile.root * (2 ** (semitones / 12));
      tone({
        frequency,
        endFrequency: profile.style === 'portal' ? frequency * 1.18 : frequency,
        duration: profile.style === 'ambient' || profile.style === 'portal' ? 0.42 : 0.2,
        type: 'sine',
        volume: 0.052,
        when,
        pan: step < 8 ? -0.32 : 0.32,
        bus: musicBus,
      });
    }
  }

  function setGain(gainNode, target, seconds = 0.025) {
    if (!context || !gainNode) return;
    const at = context.currentTime;
    const value = Math.max(0, Number(target));
    gainNode.gain.cancelScheduledValues(at);
    gainNode.gain.setValueAtTime(gainNode.gain.value, at);
    gainNode.gain.linearRampToValueAtTime(value, at + seconds);
  }

  function removeGestureUnlock() {
    if (!gestureTarget) return;
    gestureTarget.removeEventListener('pointerdown', onFirstGesture, true);
    gestureTarget.removeEventListener('touchend', onFirstGesture, true);
    gestureTarget.removeEventListener('keydown', onFirstGesture, true);
    gestureTarget = null;
  }

  function onFirstGesture() {
    void unlock();
  }

  function installGestureUnlock() {
    if (options.autoUnlock === false || gestureTarget || !globalThis.document?.addEventListener) return;
    gestureTarget = globalThis.document;
    const listenerOptions = { capture: true, passive: true };
    gestureTarget.addEventListener('pointerdown', onFirstGesture, listenerOptions);
    gestureTarget.addEventListener('touchend', onFirstGesture, listenerOptions);
    gestureTarget.addEventListener('keydown', onFirstGesture, listenerOptions);
  }

  async function unlock() {
    if (unlockPromise) return unlockPromise;

    const work = (async () => {
      const audioContext = ensureContext();
      if (!audioContext) return false;

      try {
        if (audioContext.state !== 'running' && audioContext.state !== 'closed') await audioContext.resume();
      } catch {
        return false;
      }

      if (context !== audioContext || audioContext.state !== 'running') return false;
      unlocked = true;
      removeGestureUnlock();
      setGain(master, muted ? 0 : masterVolume, 0.018);
      nextStepAt = Math.max(nextStepAt, audioContext.currentTime + 0.025);

      const cutoff = nowMs() - 700;
      const queued = pendingSfx.filter((item) => item.time >= cutoff).slice(-4);
      pendingSfx = [];
      queued.forEach((item, index) => playSound(item.name, audioContext.currentTime + 0.012 + index * 0.018));
      return true;
    })();

    unlockPromise = work;
    try {
      return await work;
    } finally {
      if (unlockPromise === work) unlockPromise = null;
    }
  }

  function sfx(name) {
    const sound = String(name || '').toLowerCase();
    if (!KNOWN_SFX.has(sound) || muted) return false;

    if (!context || context.state !== 'running' || !unlocked) {
      pendingSfx.push({ name: sound, time: nowMs() });
      if (pendingSfx.length > 6) pendingSfx.shift();

      if (globalThis.navigator?.userActivation?.isActive) void unlock();
      return false;
    }

    return playSound(sound, context.currentTime);
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    setGain(master, muted ? 0 : masterVolume, 0.025);
    if (!muted && context?.state === 'running') {
      nextStepAt = Math.max(nextStepAt, context.currentTime + 0.025);
    }
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  function isMuted() {
    return muted;
  }

  function update(dt = 1 / 60, nextIntensity = intensity, nextMode = mode) {
    const seconds = clamp(Number(dt) > 4 ? Number(dt) / 1000 : Number(dt), 0, 0.25) || (1 / 60);
    const targetIntensity = normalizeIntensity(nextIntensity, intensity);
    const smoothing = 1 - Math.exp(-seconds * 5);
    intensity += (targetIntensity - intensity) * smoothing;
    mode = String(nextMode ?? mode).toLowerCase();

    if (!context || context.state !== 'running' || !unlocked) return;

    const profile = musicProfile(mode, intensity);
    const targetMusicLevel = musicVolume * profile.level;
    if (Math.abs(targetMusicLevel - lastMusicLevel) > 0.006) {
      setGain(musicBus, targetMusicLevel, 0.08);
      lastMusicLevel = targetMusicLevel;
    }

    if (muted || profile.silent || musicVolume <= 0) {
      nextStepAt = context.currentTime + 0.04;
      return;
    }

    const now = context.currentTime;
    if (!Number.isFinite(nextStepAt) || nextStepAt < now - 0.2) {
      nextStepAt = now + 0.025;
    }

    const horizon = now + clamp(seconds + 0.075, 0.09, 0.18);
    let scheduled = 0;
    while (nextStepAt <= horizon && scheduled < 8) {
      scheduleMusicStep(nextStepAt, stepIndex, profile);
      stepIndex += 1;
      nextStepAt += 60 / profile.bpm / 4;
      scheduled += 1;
    }
  }

  function stop() {
    removeGestureUnlock();
    pendingSfx = [];
    unlocked = false;
    nextStepAt = 0;
    stepIndex = 0;

    for (const source of activeSources) {
      try {
        source.stop();
      } catch {
        // A source may already have ended between iteration and stop().
      }
    }
    activeSources.clear();

    const audioContext = context;
    context = null;
    master = null;
    compressor = null;
    sfxBus = null;
    musicBus = null;
    noiseBuffer = null;
    lastMusicLevel = -1;
    unlockPromise = null;

    if (!audioContext || audioContext.state === 'closed') return Promise.resolve();
    try {
      return audioContext.close().catch(() => {});
    } catch {
      return Promise.resolve();
    }
  }

  installGestureUnlock();

  return {
    unlock,
    sfx,
    setMuted,
    toggleMuted,
    isMuted,
    update,
    stop,
  };
}

export default createAudio;
