// Simple WebAudio Synthesizer for retro sound effects
class SoundSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, vol = 0.1, slide = 0) {
        if (!this.enabled) return;
        this.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slide !== 0) {
            osc.frequency.exponentialRampToValueAtTime(freq * slide, this.ctx.currentTime + duration);
        }
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    jump() { this.playTone(300, 'square', 0.2, 0.1, 2); }
    doubleJump() { this.playTone(400, 'square', 0.2, 0.1, 2); }
    coin() { this.playTone(800, 'sine', 0.1, 0.1, 1.5); }
    stomp() { this.playTone(200, 'sawtooth', 0.2, 0.15, 0.5); }
    hit() { this.playTone(150, 'sawtooth', 0.3, 0.2, 0.2); }
    dash() { this.playTone(600, 'triangle', 0.5, 0.1, 0.5); }
    shieldBreak() { this.playTone(300, 'square', 0.4, 0.2, 0.1); }
    modeChange() { this.playTone(500, 'sine', 1.0, 0.1, 2); }
}

export const sound = new SoundSystem();
