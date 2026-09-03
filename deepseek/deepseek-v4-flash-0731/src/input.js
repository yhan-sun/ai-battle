export class InputManager {
  constructor() {
    this.keys = new Set();
    this.jumpQueued = false;
    this.slideQueued = false;
    this.onJump = null;
    this.onSlide = null;
    this.onLaneChange = null;
    this.onPause = null;
    this.onMute = null;
    this.onAbility = null;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'f', 'shift'].includes(k) || e.key === ' ') {
        e.preventDefault();
      }
      if (e.repeat) return;
      this.keys.add(k);
      if (k === ' ' || k === 'arrowup' || k === 'w') {
        this.jumpQueued = true;
        if (this.onJump) this.onJump('press');
      }
      if (k === 's' || k === 'arrowdown') {
        this.slideQueued = true;
        if (this.onSlide) this.onSlide('press');
      }
      if (k === 'a' || k === 'arrowleft') { if (this.onLaneChange) this.onLaneChange(-1); }
      if (k === 'd' || k === 'arrowright') { if (this.onLaneChange) this.onLaneChange(1); }
      if (k === 'f' || k === 'shift') { if (this.onAbility) this.onAbility(); }
      if (k === 'p' || k === 'escape') { if (this.onPause) this.onPause(); }
      if (k === 'm') { if (this.onMute) this.onMute(); }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === 's' || k === 'arrowdown') { if (this.onSlide) this.onSlide('release'); }
      if (k === ' ' || k === 'arrowup' || k === 'w') { if (this.onJump) this.onJump('release'); }
    });

    const tz = document.createElement('div');
    tz.className = 'touch-zones active';
    tz.innerHTML = `
      <div class="tz tz-left"><div class="tz-btn">滑行</div></div>
      <div class="tz tz-center"><div class="tz-btn">下蹲</div></div>
      <div class="tz tz-right"><div class="tz-btn">跳跃</div></div>
    `;
    document.body.appendChild(tz);

    const bindTouch = (el, action, handler) => {
      el.addEventListener('touchstart', (e) => { e.preventDefault(); handler('press'); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); handler('release'); }, { passive: false });
    };
    const center = tz.querySelector('.tz-center');
    const left = tz.querySelector('.tz-left');
    const right = tz.querySelector('.tz-right');
    bindTouch(right, 'jump', (p) => {
      if (p === 'press') { this.jumpQueued = true; if (this.onJump) this.onJump('press'); }
      else { if (this.onJump) this.onJump('release'); }
    });
    bindTouch(left, 'slide', (p) => {
      if (p === 'press') { this.slideQueued = true; if (this.onSlide) this.onSlide('press'); }
      else { if (this.onSlide) this.onSlide('release'); }
    });
    bindTouch(center, 'lane', (p) => {
      if (p === 'press') { if (this.onLaneChange) this.onLaneChange(1); }
    });
  }

  consumeJump() {
    const q = this.jumpQueued;
    this.jumpQueued = false;
    return q;
  }

  consumeSlide() {
    const q = this.slideQueued;
    this.slideQueued = false;
    return q;
  }
}