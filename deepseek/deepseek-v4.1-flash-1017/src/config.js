/**
 * 全局数值与内容配置。
 * 所有平衡性参数集中在这里，便于调整节奏与难度。
 */

export const CONFIG = {
  version: '1.0.0',

  speed: {
    start: 13.5,
    max: 30.5,
    /** 从起始速度线性提升到最高速度所需距离（米）。 */
    rampDistance: 2600,
    dashMultiplier: 1.75,
  },

  player: {
    gravity: 46,
    jumpSpeed: 14.2,
    doubleJumpSpeed: 12.8,
    crouchFallBoost: 34,
    coyote: 0.1,
    jumpBuffer: 0.14,
    height: 1.68,
    crouchHeight: 0.92,
    width: 0.74,
    startInvincible: 1.6,
    reviveInvincible: 2.5,
    fallDeathY: -0.28,
  },

  world: {
    spawnAhead: 66,
    despawnX: -28,
    safeZone: 80,
    maxChunksPerFrame: 16,
  },

  score: {
    perMeter: 1.25,
    coin: 10,
    stomp: 80,
    dashBreak: 40,
    comboWindow: 3,
    comboStep: 10,
    comboMax: 5,
  },

  reward: {
    superCost: 100,
    superCoinGain: 3.4,
    superDuration: 12,
    superSpeed: 27,
    superMultiplier: 3,
    superBonus: 1200,
    travelDuration: 8,
    travelSpeed: 46,
    travelMultiplier: 4,
    travelBonus: 1800,
    portalFirst: 420,
    portalIntervalMin: 520,
    portalIntervalMax: 780,
    reviveCost: 150,
  },

  coins: {
    capacity: 240,
  },

  camera: {
    fov: 52,
  },
};

/** 可选的坐骑（悬浮板），只影响数值与外观，不影响公平性。 */
export const MOUNTS = [
  {
    id: 'board',
    name: '疾风滑板',
    tag: '速度 +8%',
    desc: '轻量反重力板，基础奔跑速度提升 8%。',
    speed: 1.08,
    jump: 1.0,
    boardColor: '#63f4ff',
    accentColor: '#ff4fb7',
  },
  {
    id: 'wing',
    name: '星翼滑板',
    tag: '跳跃 +10%',
    desc: '双翼稳定器，起跳与二段跳高度提升 10%。',
    speed: 1.0,
    jump: 1.1,
    boardColor: '#ffd257',
    accentColor: '#8a6bff',
  },
];

/** 可选宠物，提供自动化的轻量辅助。 */
export const PETS = [
  {
    id: 'fox',
    name: '星尾狐',
    tag: '自动吸金',
    desc: '每 0.32 秒吸附身边 3.2 米内的金币。',
  },
  {
    id: 'bee',
    name: '护卫蜂',
    tag: '循环护盾',
    desc: '开局获得护盾，之后每 26 秒补充一次。',
  },
];

/**
 * 四种主场景主题。环境系统会在这四套色板之间平滑过渡，
 * 地面、雾、天空、灯光与视差层都由这些颜色驱动。
 */
export const THEMES = [
  {
    id: 'dawn',
    name: '晨曦 · 浮空群岛',
    skyTop: '#241a5e',
    skyBottom: '#ff9f6e',
    fog: '#d97b63',
    ground: '#4a3448',
    groundSide: '#2a1b2e',
    edge: '#ffd166',
    accent: '#ff9a5c',
    light: '#ffd7b0',
    hemiSky: '#ffd2ae',
    hemiGround: '#38243f',
    intensity: 1.0,
    dirIntensity: 2.2,
    star: 0.1,
    decor: 'ridge',
  },
  {
    id: 'city',
    name: '霓虹 · 天穹都市',
    skyTop: '#05021c',
    skyBottom: '#3b1268',
    fog: '#241046',
    ground: '#15102c',
    groundSide: '#090616',
    edge: '#ff3fa4',
    accent: '#2ef2ff',
    light: '#cbb6ff',
    hemiSky: '#9d7bff',
    hemiGround: '#120a28',
    intensity: 1.05,
    dirIntensity: 1.8,
    star: 0.9,
    decor: 'city',
  },
  {
    id: 'cave',
    name: '地心 · 晶簇隧道',
    skyTop: '#031113',
    skyBottom: '#0f3f37',
    fog: '#072624',
    ground: '#12362f',
    groundSide: '#071e1b',
    edge: '#45ffc8',
    accent: '#39ffd0',
    light: '#aafff2',
    hemiSky: '#46e0c0',
    hemiGround: '#041e1a',
    intensity: 0.92,
    dirIntensity: 1.55,
    star: 0.15,
    decor: 'cave',
  },
  {
    id: 'aurora',
    name: '极光 · 星辉冰原',
    skyTop: '#020a26',
    skyBottom: '#0b5372',
    fog: '#0a3d58',
    ground: '#bcdceb',
    groundSide: '#6f9fb4',
    edge: '#8dffd8',
    accent: '#79f7ff',
    light: '#d9f9ff',
    hemiSky: '#a9f4ff',
    hemiGround: '#1c4e63',
    intensity: 1.08,
    dirIntensity: 1.9,
    star: 0.55,
    decor: 'aurora',
  },
];

/** 奖励场景色板。 */
export const REWARD_PALETTES = {
  super: {
    skyTop: '#7a2c00',
    skyBottom: '#ffd166',
    fog: '#f2b45c',
    ground: '#b97812',
    groundSide: '#5a3405',
    edge: '#fff3b0',
    accent: '#ffd257',
    light: '#fff0c4',
    hemiSky: '#ffe3a1',
    hemiGround: '#5a2a05',
    intensity: 1.25,
    dirIntensity: 2.5,
    star: 0.05,
  },
  travel: {
    skyTop: '#020014',
    skyBottom: '#190b4f',
    fog: '#0b0430',
    ground: '#0a0824',
    groundSide: '#040211',
    edge: '#7b5cff',
    accent: '#63f4ff',
    light: '#a9d8ff',
    hemiSky: '#4f3cff',
    hemiGround: '#03010f',
    intensity: 0.9,
    dirIntensity: 1.6,
    star: 1.0,
  },
};

export const DEFAULT_LOADOUT = {
  mount: MOUNTS[0].id,
  pet: PETS[0].id,
};

export function findMount(id) {
  return MOUNTS.find((m) => m.id === id) || MOUNTS[0];
}

export function findPet(id) {
  return PETS.find((p) => p.id === id) || PETS[0];
}
