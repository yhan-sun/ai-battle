// 以太冲刺 · Aether Dash — 主入口与游戏循环
import * as THREE from 'three';
import { CFG, loadBest, saveBest } from './config.js';
import { AudioSystem } from './audio.js';
import { Level } from './level.js';
import { BonusScene } from './bonusScene.js';
import { Player } from './player.js';
import { Particles } from './particles.js';
import { UI } from './ui.js';

// ---------- 渲染器 / 场景 / 相机 ----------
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);
scene.fog = new THREE.Fog(0x0b1020, 30, 90);

const camera = new THREE.PerspectiveCamera(CFG.cameraFov, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, CFG.cameraY, CFG.cameraZ);
camera.lookAt(8, 1.6, 0);

scene.add(new THREE.AmbientLight(0x8aa0ff, 0.7));
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1a2040, 0.6));
const dir = new THREE.DirectionalLight(0xfff2d8, 1.1);
dir.position.set(-6, 14, 8);
scene.add(dir);

// ---------- 系统 ----------
const audio = new AudioSystem();
const level = new Level(scene);
const bonusScene = new BonusScene(scene);
const player = new Player(scene, audio);
const particles = new Particles(scene);
const ui = new UI();

// ---------- 游戏状态 ----------
const state = {
  mode: 'menu',
  stage: 'main',
  score: 0,
  distance: 0,
  speed: CFG.runSpeed0,
  best: loadBest(),
  powerups: { shield: 0, magnet: 0, double: 0, drone: 0 },
  bonusTimer: 0,
  warpTimer: 0,
  superTriggered: false,
  warpTriggered: false,
  lastObstacleX: -Infinity,
  terrainLength: 0,
  lives: 3,
};

// 玩家沿轨道前进的世界 x 坐标
const playerX = { value: 0 };

let clock = new THREE.Clock();
let elapsed = 0;
let cameraShake = 0;

// 确定性随机
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return s / 4294967296;
  };
}

// ---------- 关卡初始化 ----------
function initRun() {
  level.reset();
  level.buildRunway(140);
  state.terrainLength = 140;
  // 安全区：前 60 格只放金币
  for (let x = 8; x < 60; x += 3) level.spawnCoin(x, 2.4, 0);
  // 初始障碍
  const rng = makeRng(12345);
  for (let x = 62; x < 140; x += 11 + Math.floor(rng() * 6)) {
    level.placePattern(x, rng, 0);
    state.lastObstacleX = x;
  }
}

// ---------- 关卡动态延伸 ----------
function advanceWorld(dt) {
  const need = playerX.value + CFG.safeRunAhead;
  if (need <= state.terrainLength) return;

  const start = state.terrainLength;
  const count = 120;
  for (let x = start; x < start + count; x++) level.buildTile(x);
  state.terrainLength = start + count;

  const rng = makeRng(start * 31 + 7);
  const diff = Math.min(1, state.distance / 400);
  let x = Math.max(state.lastObstacleX + CFG.minGapX, start);
  while (x < start + count) {
    level.placePattern(x, rng, diff);
    state.lastObstacleX = x;
    x += 10 + Math.floor(rng() * 6);
  }
}

// ---------- 输入 ----------
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (state.mode === 'menu') {
    if (e.code === 'Space' || e.code === 'Enter') startGame();
    return;
  }
  if (state.mode !== 'playing') return;
  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') player.tryJump();
  if (e.code === 'KeyS' || e.code === 'ArrowDown') player.duck();
  if (e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') tryDash();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') toggleMute();
});

function bindTouch(el, action) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state.mode !== 'playing') return;
    if (action === 'jump') player.tryJump();
    else player.duck();
  });
}
bindTouch(document.getElementById('touch-right'), 'jump');
bindTouch(document.getElementById('touch-left'), 'duck');

// ---------- UI 按钮 ----------
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-howto').addEventListener('click', () => ui.showHowto());
document.getElementById('btn-howto-back').addEventListener('click', () => ui.hideHowto());
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-restart').addEventListener('click', () => {
  ui.hidePause();
  startGame();
});
document.getElementById('btn-quit').addEventListener('click', toMenu);
document.getElementById('btn-retry').addEventListener('click', startGame);
document.getElementById('btn-home').addEventListener('click', toMenu);

// ---------- 流程 ----------
function startGame() {
  audio.ensure();
  audio.resume();
  audio.startMusic();
  state.mode = 'playing';
  state.stage = 'main';
  state.score = 0;
  state.distance = 0;
  state.speed = CFG.runSpeed0;
  state.powerups = { shield: 0, magnet: 0, double: 0, drone: 0 };
  state.bonusTimer = 0;
  state.warpTimer = 0;
  state.superTriggered = false;
  state.warpTriggered = false;
  state.lastObstacleX = -Infinity;
  state.lives = 3;
  playerX.value = 0;
  player.y = 0;
  player.vy = 0;
  player.jumpCount = 0;
  player.invincible = 0;
  player.group.position.set(0, 0, 0);
  bonusScene.hide();
  ui.hideAll();
  ui.showHud();
  ui.updateStage('main');
  initRun();
  clock.getDelta();
}

function toMenu() {
  state.mode = 'menu';
  audio.stopMusic();
  bonusScene.hide();
  ui.hideAll();
  ui.showStart(state.best);
}

function resumeGame() {
  state.mode = 'playing';
  ui.hidePause();
  audio.startMusic();
  clock.getDelta();
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    ui.showPause();
    audio.stopMusic();
  } else if (state.mode === 'paused') {
    resumeGame();
  }
}

function toggleMute() {
  audio.setMuted(!audio.muted);
}

function tryDash() {
  if (state.powerups.drone > 0) return;
  player.hitDash();
}

// ---------- 道具 ----------
function collectPowerup(type) {
  audio.powerup();
  if (type === 'shield') {
    state.powerups.shield += CFG.shieldBlocks;
    audio.shield();
  } else if (type === 'magnet') state.powerups.magnet = CFG.magnetDuration;
  else if (type === 'double') state.powerups.double = CFG.doubleDuration;
  else if (type === 'drone') {
    state.powerups.drone = CFG.droneDuration;
    player.hitDash();
  }
}

// ---------- 奖励关 ----------
function enterSuper() {
  state.stage = 'super';
  state.bonusTimer = CFG.superBonusDuration;
  ui.updateStage('super');
  audio.bonusStart();
  bonusScene.buildSuper(24);
}

function enterWarp() {
  state.stage = 'warp';
  state.warpTimer = CFG.warpDuration;
  ui.updateStage('warp');
  audio.warp();
  bonusScene.show('warp');
}

function exitBonus() {
  state.stage = 'main';
  state.bonusTimer = 0;
  state.warpTimer = 0;
  bonusScene.hide();
  ui.updateStage('main');
  audio.stopMusic();
  audio.startMusic();
  player.invincible = Math.max(player.invincible, 1.5);
}

// ---------- 碰撞 ----------
function playerCenter() {
  return player.y + player.getDuckingHeight() / 2;
}

function collideBox() {
  const magnet = state.powerups.magnet > 0;
  const center = playerCenter();

  // 道具拾取
  for (let i = level.obstacles.length - 1; i >= 0; i--) {
    const o = level.obstacles[i];
    if (o.userData.type !== 'powerup') continue;
    const dx = Math.abs(o.position.x - playerX.value);
    const dy = Math.abs(o.position.y - center);
    if (dx < 1.1 && dy < 1.4) {
      collectPowerup(o.userData.powerType);
      particles.burst(o.position.x, o.position.y, 0, { count: 8, color: 0xffffff, speed: 4, up: 3, life: 0.5 });
      level.group.remove(o);
      level.obstacles.splice(i, 1);
    }
  }

  // 金币
  for (let i = level.coins.length - 1; i >= 0; i--) {
    const c = level.coins[i];
    const dx = Math.abs(c.position.x - playerX.value);
    const dy = Math.abs(c.position.y - center);
    const reach = magnet ? 4.5 : 1.1;
    if (dx < reach && dy < reach) {
      collectCoin(c.position, true);
      level.group.remove(c);
      level.coins.splice(i, 1);
    }
  }
  // 障碍
  for (let i = level.obstacles.length - 1; i >= 0; i--) {
    const o = level.obstacles[i];
    const b = o.userData.bounds;
    if (!b) continue;
    const oy = b.centerY + o.position.y;
    if (Math.abs(o.position.x - playerX.value) < 0.55 + b.half.x) {
      const top = oy + b.half.y;
      const bottom = oy - b.half.y;
      const pyTop = center + player.getDuckingHeight() / 2;
      const pyBottom = center - player.getDuckingHeight() / 2;
      if (Math.min(top, pyTop) - Math.max(bottom, pyBottom) > 0) {
        if (o.userData.enemy && player.vy < 0 && center < bottom) {
          stomp(o);
        } else {
          onHit();
        }
      }
    }
  }
  // 奖励关金币
  for (let i = bonusScene.coins.length - 1; i >= 0; i--) {
    const c = bonusScene.coins[i];
    const dx = Math.abs(c.position.x - playerX.value);
    const dy = Math.abs(c.position.y - center);
    if (dx < 1.2 && dy < 1.2) {
      collectCoin(c.position, true);
      bonusScene.group.remove(c);
      bonusScene.coins.splice(i, 1);
    }
  }
}

function collectCoin(pos, scored) {
  state.score += (state.powerups.double > 0 ? 2 : 1) * CFG.coinValue;
  audio.coin();
  particles.burst(pos.x, pos.y, pos.z || 0, { count: 5, color: 0xffcf4d, speed: 3, up: 2, life: 0.4 });
}

function stomp(o) {
  state.score += CFG.enemyScore;
  audio.stomp();
  particles.burst(o.position.x, o.position.y + 0.5, 0, { count: 12, color: 0xff8a3c, speed: 5, up: 4, life: 0.5 });
  level.group.remove(o);
  const idx = level.obstacles.indexOf(o);
  if (idx >= 0) level.obstacles.splice(idx, 1);
  player.vy = 9;
  player.y = Math.max(player.y, 0.2);
}

function onHit() {
  if (player.invincible > 0) return;
  if (state.powerups.shield > 0) {
    state.powerups.shield--;
    player.invincible = 1.4;
    audio.shield();
    particles.burst(playerX.value, player.y + 1, 0, { count: 14, color: 0x7ad4ff, speed: 5, up: 3, life: 0.5 });
    return;
  }
  player.hurt();
  state.score = Math.max(0, state.score - 50);
  cameraShake = 0.6;
  state.lives--;
  // 复活：短暂无敌 + 弹跳，保护返场
  player.invincible = Math.max(player.invincible, 1.6);
  if (state.lives <= 0) {
    endGame();
  }
}

function endGame() {
  state.mode = 'gameover';
  audio.stopMusic();
  audio.gameover();
  const record = state.score > state.best;
  if (record) {
    state.best = state.score;
    saveBest(state.best);
  }
  ui.hideAll();
  ui.showGameover({
    score: Math.floor(state.score),
    distance: Math.floor(state.distance),
    best: state.best,
    isRecord: record,
  });
}

// ---------- 主循环 ----------
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const t = elapsed;

  if (state.mode === 'playing') {
    if (state.stage === 'main') {
      playerX.value += state.speed * dt;
      state.distance += state.speed * dt;
      state.score += (state.powerups.double > 0 ? 2 : 1) * CFG.distanceScore * dt;
      state.speed = Math.min(CFG.runSpeedMax, state.speed + CFG.speedRamp * dt);
      advanceWorld(dt);
      player.update(dt);
      collideBox();

      // 奖励关触发（周期性）
      if (!state.superTriggered && state.distance > 350) {
        state.superTriggered = true;
        enterSuper();
      }
      if (state.stage === 'main' && !state.warpTriggered && state.distance > 800) {
        state.warpTriggered = true;
        enterWarp();
      }
    } else if (state.stage === 'super') {
      state.bonusTimer -= dt;
      state.distance += state.speed * 0.5 * dt;
      state.score += 30 * dt;
      player.update(dt);
      collideBox();
      ui.updateBonusTimer(state.bonusTimer);
      if (state.bonusTimer <= 0 || bonusScene.coins.length === 0) exitBonus();
    } else if (state.stage === 'warp') {
      state.warpTimer -= dt;
      state.speed = CFG.runSpeedMax;
      state.distance += state.speed * 2 * dt;
      player.update(dt);
      // 自动高速吸附金币
      for (let i = bonusScene.coins.length - 1; i >= 0; i--) {
        const c = bonusScene.coins[i];
        c.position.x -= dt * 10;
        if (Math.abs(c.position.x - playerX.value) < 1.2) {
          collectCoin(c.position, true);
          bonusScene.group.remove(c);
          bonusScene.coins.splice(i, 1);
        }
      }
      ui.updateBonusTimer(state.warpTimer);
      if (state.warpTimer <= 0 || bonusScene.coins.length === 0) exitBonus();
    }

    // 计时道具
    state.powerups.magnet = Math.max(0, state.powerups.magnet - dt);
    state.powerups.double = Math.max(0, state.powerups.double - dt);
    state.powerups.drone = Math.max(0, state.powerups.drone - dt);
    player.invincible = Math.max(0, player.invincible - dt);

    // 相机
    const targetY = CFG.cameraY + player.y * 0.25;
    camera.position.y += (targetY - camera.position.y) * CFG.cameraLerp * dt;
    if (cameraShake > 0) {
      cameraShake = Math.max(0, cameraShake - dt * 1.5);
      camera.position.x += (Math.random() - 0.5) * cameraShake * 0.4;
      camera.position.y += (Math.random() - 0.5) * cameraShake * 0.4;
    }
    camera.lookAt(playerX.value + 8, 1.8, 0);

    ui.updateHUD({ score: Math.floor(state.score), distance: state.distance, speed: state.speed, lives: state.lives });
    ui.updatePowerups(state.powerups);
  }

  // 视觉层
  level.cull(camera.position.z, playerX.value);
  bonusScene.update(dt, t);
  particles.update(dt);
  player.group.position.x = playerX.value;

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 启动 ----------
initRun();
ui.showStart(state.best);
loop();