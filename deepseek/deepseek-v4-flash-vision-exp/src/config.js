// 全局数值配置 - 集中管理便于调平衡
export const CONFIG = {
  // 玩家物理
  gravity: 62,
  jumpSpeed: 17.5,
  doubleJumpSpeed: 16.2,
  tripleJumpSpeed: 15.0,
  maxAirJumps: 2, // 骑乘时可空中连跳次数=2（三段跳）；普通状态=1（二段跳）
  slideDuration: 0.95,
  diveSpeed: 30,

  // 玩家尺寸（碰撞盒，单位：米）
  playerWidth: 0.9,
  standHeight: 1.55,
  slideHeight: 0.72,

  // 奔跑速度
  baseSpeed: 12,
  maxSpeed: 36,
  speedRamp: 0.11, // 每秒加速
  dashSpeed: 46,
  damageBaseSpeed: 9.5, // 受伤后的基础速度

  // 计分
  scorePerMeter: 1,
  coinScore: 15,
  stompScore: 30,
  comboWindow: 1.6, // 踩怪连击窗口
  comboGold: 20, // 连击加成上限

  // 道具
  magnetDuration: 9,
  shieldDuration: 12,
  dashDuration: 5,
  dashChargeNeed: 8, // 技能槽充能所需金币
  invincibleAfterDamage: 2.2,
  reviveInvincible: 4,

  // 奖励触发
  superCoinNeed: 60, // 每 60 金币触发超级奖励门
  warpDistanceStep: 850, // 每 850 米触发穿越奖励门

  // 奖励关参数
  superBonusTime: 22,
  superBonusMultiplier: 6,
  warpBonusTime: 16,
  warpSpeedMultiplier: 2.05,

  // 关卡生成
  chunkMinLen: 26,
  chunkMaxLen: 34,
  spawnAhead: 190, // 提前生成的距离
  recycleBehind: -40, // 回收线

  // 相机
  camOffset: { x: -7.2, y: 5.4, z: 7.2 },
  camLookOffset: { x: 5.6, y: 1.6, z: -0.6 },

  // 存档键
  saveKey: 'neon-rush-3d-save-v1',
};

export const COLORS = {
  skyTop: 0x1a2f7a,
  skyBottom: 0x0a0a2a,
  street: 0x2a2f55,
  streetEdge: 0x46e0ff,
  laneLine: 0xffd23e,
  coin: 0xffc93c,
  coinCore: 0xfff3b0,
  obstacle: 0x5b6bd6,
  obstacleAlt: 0xff5ecf,
  crate: 0x8a5bff,
  monster: 0x3ddc97,
  bat: 0xc77dff,
  magnet: 0xff5e3a,
  shieldItem: 0x46e0ff,
  dashItem: 0xffd23e,
  superGate: 0x4df3ff,
  warpGate: 0xff8a3d,
  burst: 0xffd76a,
  playerBody: 0xff5ecf,
  playerSkin: 0xffd9c0,
  playerHair: 0x4d6bfe,
  mount: 0x46e0ff,
  pet: 0xfff3a0,
};
