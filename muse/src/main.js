import './style.css';
import { Game, GameState } from './game.js';
import { UI } from './ui.js';

const ui = new UI();
const container = document.getElementById('game-container');
const game = new Game(container, ui);
document.getElementById('loading').style.display = 'none';

// 读取存档初始化选项
let mountOn = game.save.mount !== false;
let petOn = game.save.pet !== false;
let charIdx = 0;
const chars = ['疾风少年', '星语少女'];
function refreshToggles() {
  const m = document.getElementById('opt-mount');
  const p = document.getElementById('opt-pet');
  const c = document.getElementById('opt-char');
  m.textContent = `星角兽:${mountOn ? '开' : '关'}`;
  m.classList.toggle('on', mountOn);
  p.textContent = `跟屁虫:${petOn ? '开' : '关'}`;
  p.classList.toggle('on', petOn);
  c.textContent = chars[charIdx];
}
refreshToggles();
game.applyLoadout(mountOn, petOn, charIdx);
ui.showStart(game.save);

document.getElementById('opt-mount').onclick = () => { mountOn = !mountOn; refreshToggles(); game.audio.click(); };
document.getElementById('opt-pet').onclick = () => { petOn = !petOn; refreshToggles(); game.audio.click(); };
document.getElementById('opt-char').onclick = () => { charIdx = (charIdx + 1) % 2; refreshToggles(); game.audio.click(); };

document.getElementById('btn-start').onclick = () => {
  game.applyLoadout(mountOn, petOn, charIdx);
  game.start();
};
document.getElementById('btn-pause').onclick = () => game.togglePause();
document.getElementById('btn-mute').onclick = () => game.toggleMute();
document.getElementById('btn-resume').onclick = () => game.resume();
document.getElementById('btn-restart1').onclick = () => game.restart();
document.getElementById('btn-quit1').onclick = () => { game.quitToMenu(); refreshToggles(); };
document.getElementById('btn-restart2').onclick = () => game.restart();
document.getElementById('btn-quit2').onclick = () => game.quitToMenu();
document.getElementById('btn-revive').onclick = () => game.revive();

// 触屏按钮(阻止冒泡避免同时触发跳)
const bindHold = (id, fn) => {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); fn(); });
};
bindHold('tc-jump', () => game.pressJump());
bindHold('tc-slide', () => game.pressSlide());
bindHold('tc-skill', () => game.pressSkill());
// 上滑=跳 下滑=蹲(移动端手势)
let touchY = null;
window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchend', (e) => {
  if (touchY == null) return;
  const dy = (e.changedTouches[0].clientY - touchY);
  if (Math.abs(dy) > 40 && game.state === GameState.PLAYING) {
    if (dy < 0) game.pressJump(); else game.pressSlide();
  }
  touchY = null;
}, { passive: true });
