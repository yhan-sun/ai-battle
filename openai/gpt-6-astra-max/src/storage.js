const KEY = 'aeromail-save-v1';
const fresh = () => ({ version: 1, bestScore: 0, bestDistance: 0, totalCoins: 0, runs: 0, sound: true });
const validNumber = n => Number.isFinite(n) && n >= 0;
export class SaveStore {
  constructor(storage) {
    this.storage = storage; this.available = true; this.data = fresh();
    try {
      const raw = JSON.parse(storage?.getItem(KEY) || 'null');
      if (raw?.version === 1) {
        for (const key of ['bestScore', 'bestDistance', 'totalCoins', 'runs']) if (validNumber(raw[key])) this.data[key] = raw[key];
        if (typeof raw.sound === 'boolean') this.data.sound = raw.sound;
      }
    } catch { this.available = false; }
  }
  persist() {
    try { if (!this.storage) throw new Error('Storage unavailable'); this.storage.setItem(KEY, JSON.stringify(this.data)); }
    catch { this.available = false; }
  }
  result(game) {
    const record = game.score > this.data.bestScore;
    this.data.bestScore = Math.max(this.data.bestScore, game.score);
    this.data.bestDistance = Math.max(this.data.bestDistance, Math.floor(game.distance));
    this.data.totalCoins += game.coins; this.data.runs++; this.persist(); return record;
  }
  sound(enabled) { this.data.sound = enabled; this.persist(); }
}
