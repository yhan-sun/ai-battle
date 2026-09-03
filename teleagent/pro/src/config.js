// 全局配置与共享常量
export const CFG = {
  // 画布/相机
  cameraFov: 58,
  cameraY: 4.6,
  cameraZ: 9.5,
  cameraLerp: 6,

  // 角色基础
  runSpeed0: 16, // 初始横向速度
  runSpeedMax: 40, // 上限
  speedRamp: 0.22, // 每米加速
  jumpVelocity: 10.6,
  jump2Velocity: 9.2,
  gravity: 28,
  duckTime: 0.35, // 下蹲持续时间

  // 技能
  dashDuration: 1.5,
  dashSpeedMult: 1.9,
  dashCooldown: 3.5,
  magnetRadius: 7.5,
  magnetDuration: 8,
  doubleDuration: 10,
  shieldDuration: 8,
  shieldBlocks: 3,
  droneDuration: 10,

  // 关卡生成
  segmentGap: 6, // 每个地形单元间隔
  obstacleChance: 0.32,
  safeRunAhead: 60, // 初始安全距离
  minGapX: 11, // 障碍最小横向间距

  // 奖励
  superBonusDuration: 32,
  warpDuration: 10,
  coinValue: 10,
  obstacleScore: 20,
  enemyScore: 100,
  distanceScore: 1, // 每米
};

export const STORAGE_KEY = 'aether_dash_best';

export function loadBest() {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(v) {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    /* ignore */
  }
}