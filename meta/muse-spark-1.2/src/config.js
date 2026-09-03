// 呜哇 配置都堆这里啦 方便调数值 诶嘿
export const CONFIG = {
  baseSpeed: 11,
  maxSpeed: 28,
  accel: 0.52, // per second before clamp
  gravity: 30,
  jumpVel: 14.2,
  doubleJumpVel: 13.0,
  coyote: 0.13,
  jumpBuffer: 0.14,
  slideDuration: 0.62,
  laneWidth: 3.2,
  laneLerp: 14,
  dashSpeedBoost: 9,
  dashDuration: 3.0,
  dashCooldown: 11,
  magnetDuration: 8,
  magnetRadius: 7,
  shieldDuration: 10,
  invincibleAfterDamage: 2.0,
  superNeed: 28, // coins to fill
  superDuration: 9,
  crossDuration: 8,
  chunkLen: 32,
  chunkCount: 12,
  maxCoinsPerChunk: 14,
};

export const STORAGE_KEY = 'nova_rush_best_v1';
export function loadBest(){
  try{ const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); return v||{score:0, dist:0, coins:0}; }catch{ return {score:0, dist:0, coins:0}; }
}
export function saveBest(best){ localStorage.setItem(STORAGE_KEY, JSON.stringify(best)); }
