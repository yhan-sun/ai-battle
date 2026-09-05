import './style.css';
import { Game, STEP, BONUS_TARGET } from './simulation.js';
import { GameRenderer } from './renderer.js';
import { AudioEngine } from './audio.js';
import { SaveStore } from './storage.js';

const $ = id => document.getElementById(id);
let local = null;
try { local = window.localStorage; } catch { /* Continue with an in-memory save. */ }
const save = new SaveStore(local);
const audio = new AudioEngine(save.data.sound);
const game = new Game(crypto.getRandomValues(new Uint32Array(1))[0]);
let view;
try { view = new GameRenderer($('world')); }
catch (error) {
  $('error').hidden = false;
  $('error').textContent = '无法创建 WebGL 场景。请在支持 WebGL 2 的浏览器中启用硬件加速后重新加载。';
  $('start').disabled = true;
  console.error(error);
}
let lastPhase = '', lastBiome = '', toastTimer = 0, flashTimer = 0, resultSaved = false;
let effectsHTML = '', accumulator = 0, uiClock = 0;
const pad = n => Math.floor(n).toString().padStart(6, '0');
const biomeNames = { sky: '云海航线', cave: '地心邮路', super: '云顶奖励航线', warp: '星门穿越航道' };
const effectNames = { shield: '◇ 护盾', magnet: '⊂ 磁铁', mount: '✧ 滑翔坐骑', dash: '↯ 冲刺', invulnerable: '◌ 安全保护' };

function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2200);
}
function flash() {
  $('transition').classList.add('flash'); clearTimeout(flashTimer);
  flashTimer = setTimeout(() => $('transition').classList.remove('flash'), 80);
}
function menuRecords() {
  $('best-distance').textContent = `${save.data.bestDistance.toLocaleString()} m`;
  $('best-score').textContent = pad(save.data.bestScore);
}
function syncSound() {
  $('sound').textContent = audio.enabled ? '♪' : '♩';
  $('sound').setAttribute('aria-label', audio.enabled ? '关闭声音' : '开启声音');
  $('sound').setAttribute('aria-pressed', String(audio.enabled));
  $('sound').style.opacity = audio.enabled ? '1' : '.5';
}
function act(action, value = true) {
  audio.unlock();
  if (action === 'start') { resultSaved = false; accumulator = 0; }
  if (action === 'menu') { game.reset(); resultSaved = false; accumulator = 0; }
  const accepted = game.action(action, value);
  flushEvents(); syncUI(); return accepted;
}
function flushEvents() {
  for (const event of game.drainEvents()) {
    audio.play(event); view?.event(event, game);
    if (event.type === 'start') toast('派送开始 · 空格二段跳，↓ 下蹲，X 冲刺');
    else if (event.type === 'skill') toast('邮光冲刺 · 飞越缺口，击碎障碍');
    else if (event.type === 'power') toast(`${effectNames[event.power]} 已获得`);
    else if (event.type === 'stomp') toast('精准踩踏 +150 · 弹跳继续！');
    else if (event.type === 'hit') toast(event.effect === 'mount' ? '坐骑替你挡下了撞击' : '护盾吸收了撞击');
    else if (event.type === 'rescue') toast('安全系统已将你带回浮岛');
    else if (event.type === 'mode') { flash(); toast(event.mode === 'super' ? '超级奖励 · 12 秒 ×3 表现分' : '星门穿越 · 9 秒 ×5 表现分'); }
    else if (event.type === 'return') { flash(); toast(`重返航线 · 奖励航道收集 ${event.coins} 枚星币`); }
    else if (event.type === 'revive') { flash(); toast('救援成功 · 3 秒安全保护'); }
  }
}
function syncUI() {
  if (game.phase !== lastPhase) {
    lastPhase = game.phase;
    const menu = game.phase === 'menu';
    document.body.classList.toggle('playing', !menu);
    $('menu').hidden = !menu; $('menu-footer').hidden = !menu;
    $('hud').hidden = menu || game.phase === 'ended';
    $('pause').hidden = menu || ['dead', 'ended'].includes(game.phase);
    $('pause').textContent = game.phase === 'paused' ? '▷' : 'Ⅱ';
    $('pause').setAttribute('aria-label', game.phase === 'paused' ? '恢复游戏' : '暂停游戏');
    $('pause-screen').hidden = game.phase !== 'paused';
    $('death-screen').hidden = game.phase !== 'dead';
    $('result-screen').hidden = game.phase !== 'ended';
    if (game.phase === 'dead') $('death-reason').textContent = game.reason;
    if (game.phase === 'ended') {
      if (!resultSaved) { $('new-record').hidden = !save.result(game); resultSaved = true; menuRecords(); }
      $('result-score').textContent = game.score.toLocaleString();
      $('result-distance').textContent = `${Math.floor(game.distance).toLocaleString()} m`;
      $('result-coins').textContent = game.coins.toLocaleString();
      $('result-combo').textContent = game.maxCombo; $('result-bonus').textContent = `${game.rewards} 次`;
      if (!save.available) toast('浏览器未允许存档，本次记录仅保留在当前页面');
    }
    if (menu) menuRecords();
  }
  const biome = game.phase === 'menu' ? 'sky' : game.biome;
  if (biome !== lastBiome) {
    if (lastBiome && game.phase === 'running' && game.mode.id === 'normal') toast(`已进入${biomeNames[biome]}`);
    lastBiome = biome; document.body.dataset.mode = biome;
  }
  $('biome').textContent = biomeNames[biome];
  $('score').textContent = pad(game.score); $('coins').textContent = game.coins;
  $('distance').textContent = Math.floor(game.distance).toLocaleString(); $('speed').textContent = `${game.speed.toFixed(1)} m/s`;
  $('multiplier').textContent = `×${game.multiplier}`; $('combo').textContent = `COMBO ${game.combo}`;
  $('bonus-charge-label').textContent = `${game.bonusCharge} / ${BONUS_TARGET}`;
  $('bonus-charge').style.width = `${game.bonusCharge / BONUS_TARGET * 100}%`;
  $('mission').textContent = game.bonusCharge >= BONUS_TARGET ? '超级奖励已满 · 落地后自动进入' : `收集 ${BONUS_TARGET} 枚星币，开启云顶奖励航线`;
  const ready = game.player.charge >= 100 && game.player.effects.dash <= 0;
  $('skill').classList.toggle('ready', ready); $('skill').disabled = !ready || game.phase !== 'running';
  $('skill-label').textContent = ready ? 'X · 已就绪' : game.player.effects.dash > 0 ? '冲刺中 · 安全飞行' : '自动蓄能 · 星币加速';
  $('skill-progress').textContent = `${Math.floor(game.player.charge)}%`;
  const effects = Object.entries(game.player.effects).filter(([, time]) => time > 0).map(([id, time]) => `<div class="effect"><span>${effectNames[id]}</span><b>${time.toFixed(1)}s</b></div>`).join('');
  if (effectsHTML !== effects) { effectsHTML = effects; $('effects').innerHTML = effects; }
  $('bonus-banner').hidden = game.mode.id === 'normal';
  if (game.mode.id !== 'normal') {
    $('bonus-label').textContent = game.mode.id === 'super' ? 'SUPER DELIVERY / ×3' : 'WARP EXPRESS / ×5';
    $('bonus-title').textContent = game.mode.id === 'super' ? '超级奖励航线' : '星门穿越航道';
    $('bonus-timer').textContent = Math.max(0, game.mode.remaining).toFixed(1);
    $('bonus-progress').style.width = `${Math.max(0, game.mode.remaining / game.mode.duration * 100)}%`;
  }
}

for (const id of ['start', 'restart', 'pause-restart']) $(id).addEventListener('click', () => act('start'));
for (const id of ['pause-menu', 'result-menu']) $(id).addEventListener('click', () => act('menu'));
for (const id of ['pause', 'resume']) $(id).addEventListener('click', () => act('pause'));
$('revive').addEventListener('click', () => act('revive'));
$('finish').addEventListener('click', () => act('finish'));
$('skill').addEventListener('click', () => { if (!act('skill')) toast('冲刺正在蓄能'); });
$('sound').addEventListener('click', () => { audio.unlock(); audio.enabled = !audio.enabled; save.sound(audio.enabled); syncSound(); });
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); if (game.phase === 'running') act('pause'); });
$('jump').addEventListener('pointerdown', event => { event.preventDefault(); act('jump'); });
$('duck').addEventListener('pointerdown', event => { event.preventDefault(); $('duck').setPointerCapture(event.pointerId); act('duck'); });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('duck').addEventListener(type, () => act('duck', false));
$('world').addEventListener('pointerdown', () => { if (game.phase === 'running') act('jump'); });
window.addEventListener('keydown', event => {
  const code = event.code;
  if (!['Space', 'ArrowUp', 'KeyW', 'ArrowDown', 'KeyS', 'KeyX', 'KeyP', 'Escape', 'Enter'].includes(code)) return;
  event.preventDefault();
  if (event.repeat && code !== 'ArrowDown' && code !== 'KeyS') return;
  if (['Space', 'Enter'].includes(code) && ['menu', 'ended'].includes(game.phase)) { act('start'); return; }
  if (['Space', 'ArrowUp', 'KeyW'].includes(code)) act('jump');
  else if (['ArrowDown', 'KeyS'].includes(code)) act('duck');
  else if (code === 'KeyX') act('skill');
  else if (['KeyP', 'Escape'].includes(code)) act('pause');
});
window.addEventListener('keyup', event => { if (['ArrowDown', 'KeyS'].includes(event.code)) act('duck', false); });
const autoPause = () => { if (game.phase === 'running') act('pause'); game.player.crouching = false; };
window.addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.addEventListener('pagehide', () => save.persist());

menuRecords(); syncSound(); syncUI();
let previousTime = performance.now();
function frame(now) {
  const delta = Math.min(.06, (now - previousTime) / 1000); previousTime = now;
  if (game.phase === 'running') {
    accumulator += delta;
    while (accumulator >= STEP) { game.update(STEP); accumulator -= STEP; }
  } else accumulator = 0;
  flushEvents();
  uiClock += delta;
  if (uiClock > .075 || game.phase !== lastPhase) { syncUI(); uiClock = 0; }
  view?.draw(game, delta);
  requestAnimationFrame(frame);
}
if (view) requestAnimationFrame(frame);

// Development-only observability for reproducible checks. Vite removes this from builds.
if (import.meta.env.DEV) window.__AEROMAIL__ = { game, snapshot: () => game.snapshot(), renderer: () => view?.diagnostics(),
  save: () => ({ ...save.data, available: save.available }), audio: () => ({ enabled: audio.enabled, state: audio.ctx?.state ?? 'not-created' }) };
