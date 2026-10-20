import { DEFAULT_LOADOUT, MOUNTS, PETS } from './config.js';

const STORAGE_KEY = 'starrunner.save.v1';

const DEFAULTS = {
  highScore: 0,
  bestDistance: 0,
  totalCoins: 0,
  runs: 0,
  mount: DEFAULT_LOADOUT.mount,
  pet: DEFAULT_LOADOUT.pet,
  muted: false,
};

function safeInt(value, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

/** 本地存档：最高分、最远距离、金币银行、偏好与静音状态。 */
export class SaveStore {
  constructor() {
    this.data = this.load();
  }

  load() {
    let parsed = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULTS };

    return {
      highScore: safeInt(parsed.highScore),
      bestDistance: safeInt(parsed.bestDistance),
      totalCoins: safeInt(parsed.totalCoins),
      runs: safeInt(parsed.runs),
      mount: MOUNTS.some((m) => m.id === parsed.mount) ? parsed.mount : DEFAULTS.mount,
      pet: PETS.some((p) => p.id === parsed.pet) ? parsed.pet : DEFAULTS.pet,
      muted: Boolean(parsed.muted),
    };
  }

  patch(partial) {
    this.data = { ...this.data, ...partial };
    this.save();
  }

  save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // 隐私模式或存储空间不足时静默失败，不影响游戏运行。
    }
  }
}
