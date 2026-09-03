export const CONFIG = {
  // 视口 / 相机
  cameraFov: 60,
  cameraZ: 12,
  cameraY: 5.2,
  cameraLookY: 2.6,
  minFov: 55,
  maxFov: 78,

  // 跑道
  laneWidth: 3.2,
  laneCount: 3,
  groundY: 0,
  runwayOffsetX: 34,

  // 角色
  playerHeight: 2.4,
  jumpVelocity: 17,
  gravity: 42,
  doubleJumpVelocity: 14.5,
  slideDuration: 0.9,
  slideHeightFactor: 0.45,
  diveVelocity: 26,

  // 速度
  baseSpeed: 18,
  maxSpeed: 46,
  speedPerSecond: 0.16,
  sprintMultiplier: 2.1,
  sprintDuration: 3.2,
  bonusSpeedMultiplier: 2.4,

  // 车道切换
  laneSwitchSpeed: 16,

  // 道具持续时间
  magnetDuration: 8,
  shieldDuration: 10,

  // 奖励关卡
  superBonusDuration: 22,
  superBonusMultiplier: 2,
  warpDuration: 14,
  warpSpeedMultiplier: 2.5,

  // 复活
  maxRevives: 3,

  // 生成
  spawnAhead: 140,
  despawnBehind: -40,
  segmentLength: 26,
};