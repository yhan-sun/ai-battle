import './styles.css';
import * as THREE from 'three';
import { Game } from './game.js';

const canvas = document.getElementById('game-canvas');
const bootError = document.getElementById('boot-error');
const bootErrorText = document.getElementById('boot-error-text');

function showError(message) {
  if (!bootError || !bootErrorText) return;
  bootErrorText.textContent = String(message || '未知错误');
  bootError.classList.remove('hidden');
}

window.addEventListener('error', (event) => {
  showError(event.message || '脚本运行错误');
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  showError((reason && reason.message) || reason || '未处理的 Promise 异常');
});

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
} catch (error) {
  showError(`无法创建 WebGL 上下文：${error.message}`);
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x060515, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  52,
  window.innerWidth / Math.max(1, window.innerHeight),
  0.1,
  420,
);

let game;
try {
  game = new Game({ scene, camera, renderer });
  // 便于自动化冒烟检查与调试；不参与游戏逻辑。
  window.__STARRUN__ = game;
} catch (error) {
  showError(`初始化失败：${error.message}`);
  throw error;
}

function handleResize() {
  const width = window.innerWidth;
  const height = Math.max(1, window.innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
}

window.addEventListener('resize', handleResize);

canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  showError('WebGL 上下文已丢失，请刷新页面重新开始。');
});

const clock = new THREE.Clock();
let accumulatedErrorShown = false;

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  try {
    game.update(dt);
  } catch (error) {
    if (!accumulatedErrorShown) {
      accumulatedErrorShown = true;
      showError(`运行错误：${error.message}`);
    }
    console.error(error);
  }
  renderer.render(scene, camera);
});
