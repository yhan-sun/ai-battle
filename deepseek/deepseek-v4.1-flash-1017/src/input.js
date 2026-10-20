import { CONFIG } from './config.js';

const KEY_ACTIONS = {
  Space: 'jump',
  ArrowUp: 'jump',
  KeyW: 'jump',
  ArrowDown: 'crouch',
  KeyS: 'crouch',
  KeyK: 'skill',
  KeyJ: 'skill',
  ShiftLeft: 'skill',
  ShiftRight: 'skill',
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
  Enter: 'start',
};

const PREVENT_DEFAULT = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyS',
  'KeyK',
  'KeyJ',
]);

/**
 * 键盘 + 触屏输入。只负责收集意图，不包含游戏逻辑。
 * 跳跃使用 input buffer，保证按下瞬间的输入不会因帧序丢失。
 */
export class Input {
  constructor() {
    this.down = new Set();
    this.virtualDown = new Set();
    this.pressed = new Set();
    this.jumpBuffer = 0;
    this.enabled = true;
    this._onKeyDown = this.handleKeyDown.bind(this);
    this._onKeyUp = this.handleKeyUp.bind(this);
    this._onBlur = this.clear.bind(this);
  }

  attach(target = window) {
    target.addEventListener('keydown', this._onKeyDown, { passive: false });
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
  }

  handleKeyDown(event) {
    if (!this.enabled) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    if (PREVENT_DEFAULT.has(event.code)) event.preventDefault();
    if (!event.repeat) {
      this.pressed.add(action);
      if (action === 'jump') this.jumpBuffer = CONFIG.player.jumpBuffer;
    }
    this.down.add(action);
  }

  handleKeyUp(event) {
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    this.down.delete(action);
  }

  isDown(action) {
    return this.enabled && (this.down.has(action) || this.virtualDown.has(action));
  }

  consume(action) {
    if (!this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  consumeJump() {
    if (!this.enabled || this.jumpBuffer <= 0) return false;
    this.jumpBuffer = 0;
    return true;
  }

  pressVirtual(action) {
    if (!this.enabled) return;
    this.pressed.add(action);
    this.virtualDown.add(action);
    if (action === 'jump') this.jumpBuffer = CONFIG.player.jumpBuffer;
  }

  releaseVirtual(action) {
    this.virtualDown.delete(action);
  }

  update(dt) {
    if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
  }

  endFrame() {
    this.pressed.clear();
  }

  clear() {
    this.down.clear();
    this.virtualDown.clear();
    this.pressed.clear();
    this.jumpBuffer = 0;
  }
}
