// 全局配置与平衡数值
export const Config = {
  baseSpeed: 12,
  maxSpeed: 30,
  speedGainPerMeter: 0.012, // 每米加速
  gravity: 34,
  jumpV: 12.5,
  doubleJumpV: 11,
  slideTime: 0.65,
  coyoteTime: 0.1,
  jumpBuffer: 0.15,
  coinScore: 10,
  distScore: 1.2, // 每米表现分
  stompScore: 100,
  energyPerCoin: 4, // 25币满
  superDuration: 9,
  superMult: 4,
  crossDuration: 10,
  crossSpeedMult: 1.6,
  skillCD: 18,
  skillDuration: 3,
  magnetDuration: 8,
  shieldDuration: 12,
  sprintDuration: 3,
  reviveInvincible: 3,
  magnetRadius: 7,
};

export const Storage = {
  KEY: 'star-dash-save-v1',
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return { best: 0, bestDist: 0, bestCoins: 0, plays: 0, mount: true, pet: true };
      return Object.assign({ best: 0, bestDist: 0, bestCoins: 0, plays: 0, mount: true, pet: true }, JSON.parse(raw));
    } catch { return { best: 0, bestDist: 0, bestCoins: 0, plays: 0, mount: true, pet: true }; }
  },
  save(s) {
    try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch {}
  }
};
