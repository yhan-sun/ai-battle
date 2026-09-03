import './style.css';
import { Game } from './game.js';
import { bindUI } from './ui.js';

// 雨涵来启动啦 呜哇
const container=document.getElementById('game-container');
const game=new Game(container);
const ui=bindUI(game);

// loading 隐藏
const loading=document.getElementById('loading');
setTimeout(()=>{ if(loading) loading.style.display='none'; }, 700);

// 首次点击解锁音频
let unlocked=false;
function unlock(){
  if(unlocked) return;
  unlocked=true;
  game.audio.init();
  if(game.audio.ctx && game.audio.ctx.state==='suspended') game.audio.ctx.resume();
}
window.addEventListener('pointerdown', unlock, {once:true});
window.addEventListener('keydown', unlock, {once:true});

// 防止右键菜单/双击缩放
document.addEventListener('contextmenu', e=>e.preventDefault());
document.addEventListener('touchmove', e=>{ if(e.touches.length>1) e.preventDefault(); }, {passive:false});

// 暴露方便调试 诶嘿
window.__NOVA_GAME=game;
console.log('%c★ NOVA RUSH %cby Muse Spark 1.2','background:#a890ff;color:#0a0a14;padding:4px 8px;border-radius:999px;font-weight:900','color:#8d8fb8');
