export const GameState = Object.freeze({
  READY: 'READY',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  REVIVE: 'REVIVE',
  GAME_OVER: 'GAME_OVER',
  SUPER_BONUS: 'SUPER_BONUS',
  TRAVERSE_BONUS: 'TRAVERSE_BONUS',
});

export const BonusMode = Object.freeze({ NONE: 'NONE', SUPER: 'SUPER', TRAVERSE: 'TRAVERSE' });
const PLAYABLE = new Set([GameState.RUNNING, GameState.SUPER_BONUS, GameState.TRAVERSE_BONUS]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class SeededRandom {
  constructor(seed = 0x5eeda11) { this.state = (Number(seed) >>> 0) || 1; }
  next() {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) { return min + (max - min) * this.next(); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(values) { return values[this.int(0, values.length - 1)]; }
}

export class RunnerModel {
  constructor() { this.reset(); }
  reset() {
    this.state = GameState.READY; this.mode = BonusMode.NONE; this.y = 1.18; this.velocityY = 0;
    this.groundY = 1.18; this.grounded = true; this.jumpsUsed = 0; this.crouching = false;
    this.speed = 11.5; this.distance = 0; this.score = 0; this.coins = 0; this.combo = 0;
    this.maxCombo = 0; this.comboGrace = 0; this.reviveAvailable = true; this.reviveCountdown = 8;
    this.invulnerable = 0; this.shieldTime = 0; this.magnetTime = 0; this.dashTime = 0;
    this.mountTime = 0; this.skillTime = 0; this.skillCooldown = 0; this.bonusTime = 0;
    this.bonusDuration = 0; this.nextSuperAt = 650; this.nextTraverseAt = 1250; this.pendingEvents = [];
  }
  start() { if (![GameState.READY, GameState.GAME_OVER].includes(this.state)) return false; this.reset(); this.state = GameState.RUNNING; return true; }
  isPlayable() { return PLAYABLE.has(this.state); }
  pause() { if (!this.isPlayable()) return false; this.pausedFrom = this.state; this.state = GameState.PAUSED; return true; }
  resume() { if (this.state !== GameState.PAUSED) return false; this.state = this.pausedFrom ?? GameState.RUNNING; return true; }
  jump() {
    if (!this.isPlayable() || this.crouching || this.jumpsUsed >= 2) return false;
    this.jumpsUsed += 1; this.grounded = false; this.velocityY = this.jumpsUsed === 1 ? 12.6 : 10.8;
    this.pendingEvents.push(this.jumpsUsed === 1 ? 'jump' : 'doubleJump'); return true;
  }
  setCrouch(active) { if (!this.isPlayable()) return false; this.crouching = Boolean(active); if (this.crouching && !this.grounded) this.velocityY = Math.min(this.velocityY, -8.5); return true; }
  get hitboxHeight() { return this.crouching ? 0.92 : 1.82; }
  get scoreMultiplier() {
    const comboTier = 1 + Math.min(4, Math.floor(this.combo / 12));
    const modeMultiplier = this.mode === BonusMode.SUPER ? 3 : this.mode === BonusMode.TRAVERSE ? 2 : 1;
    return comboTier * modeMultiplier * (this.skillTime > 0 ? 2 : 1);
  }
  activateSkill() {
    if (!this.isPlayable() || this.skillCooldown > 0) return false;
    this.skillTime = 5; this.skillCooldown = 14; this.dashTime = Math.max(this.dashTime, 5);
    this.magnetTime = Math.max(this.magnetTime, 7); this.shieldTime = Math.max(this.shieldTime, 5);
    this.mountTime = Math.max(this.mountTime, 8); this.pendingEvents.push('skill'); return true;
  }
  grantPower(type, duration) {
    const value = clamp(Number(duration) || 0, 0, 60);
    if (type === 'shield') this.shieldTime = Math.max(this.shieldTime, value);
    if (type === 'magnet') this.magnetTime = Math.max(this.magnetTime, value);
    if (type === 'dash') this.dashTime = Math.max(this.dashTime, value);
    if (type === 'mount') this.mountTime = Math.max(this.mountTime, value);
    this.pendingEvents.push(`power:${type}`);
  }
  collectCoin(value = 1) {
    if (!this.isPlayable()) return false; const amount = Math.max(1, Math.floor(value));
    this.coins += amount; this.combo += amount; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboGrace = 2.8; this.score += 100 * amount * this.scoreMultiplier; this.pendingEvents.push('coin'); return true;
  }
  reward(action, baseScore) {
    if (!this.isPlayable()) return false; this.combo += 2; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboGrace = 3.1; this.score += Math.floor(baseScore * this.scoreMultiplier); this.pendingEvents.push(action); return true;
  }
  breakCombo() { this.combo = 0; this.comboGrace = 0; }
  receiveHit(reason = 'obstacle') {
    if (!this.isPlayable()) return { result: 'ignored', reason };
    if (this.invulnerable > 0 || this.dashTime > 0) { this.reward('smash', 350); return { result: 'smashed', reason }; }
    if (this.shieldTime > 0 || this.mountTime > 0) {
      if (this.shieldTime > 0) this.shieldTime = 0; else this.mountTime = 0;
      this.invulnerable = 1.25; this.breakCombo(); this.pendingEvents.push('blocked'); return { result: 'blocked', reason };
    }
    this.state = GameState.REVIVE; this.mode = BonusMode.NONE; this.reviveCountdown = 8;
    this.velocityY = 0; this.crouching = false; this.pendingEvents.push('down'); return { result: 'down', reason };
  }
  revive() {
    if (this.state !== GameState.REVIVE || !this.reviveAvailable) return false;
    this.reviveAvailable = false; this.state = GameState.RUNNING; this.mode = BonusMode.NONE;
    this.y = this.groundY; this.velocityY = 0; this.grounded = true; this.jumpsUsed = 0;
    this.invulnerable = 3.2; this.shieldTime = Math.max(this.shieldTime, 3.2);
    this.speed = Math.max(11.5, this.speed * 0.93); this.pendingEvents.push('revive'); return true;
  }
  giveUp() { if (![GameState.REVIVE, GameState.PAUSED].includes(this.state) && !this.isPlayable()) return false; this.state = GameState.GAME_OVER; this.mode = BonusMode.NONE; return true; }
  enterBonus(mode, duration) {
    if (!this.isPlayable() || this.mode !== BonusMode.NONE || ![BonusMode.SUPER, BonusMode.TRAVERSE].includes(mode)) return false;
    this.mode = mode; this.state = mode === BonusMode.SUPER ? GameState.SUPER_BONUS : GameState.TRAVERSE_BONUS;
    this.bonusDuration = clamp(duration, 2, 60); this.bonusTime = this.bonusDuration;
    this.invulnerable = Math.max(this.invulnerable, this.bonusDuration + 0.5);
    this.pendingEvents.push(mode === BonusMode.SUPER ? 'enterSuper' : 'enterTraverse'); return true;
  }
  exitBonus() {
    if (this.mode === BonusMode.NONE) return false; const previous = this.mode;
    this.mode = BonusMode.NONE; this.state = GameState.RUNNING; this.bonusTime = 0; this.bonusDuration = 0;
    this.invulnerable = Math.min(this.invulnerable, 1.5);
    this.pendingEvents.push(previous === BonusMode.SUPER ? 'exitSuper' : 'exitTraverse'); return true;
  }
  update(dt, options = {}) {
    if ([GameState.PAUSED, GameState.READY, GameState.GAME_OVER].includes(this.state)) return this.drainEvents();
    const step = clamp(Number(dt) || 0, 0, 0.05);
    if (this.state === GameState.REVIVE) {
      this.reviveCountdown = Math.max(0, this.reviveCountdown - step);
      if (this.reviveCountdown <= 0) this.state = GameState.GAME_OVER;
      return this.drainEvents();
    }
    for (const key of ['invulnerable', 'shieldTime', 'magnetTime', 'dashTime', 'mountTime', 'skillTime', 'skillCooldown', 'comboGrace']) this[key] = Math.max(0, this[key] - step);
    if (this.comboGrace <= 0 && this.combo > 0) this.combo = Math.max(0, this.combo - step * 8);
    if (this.mode !== BonusMode.NONE) { this.bonusTime = Math.max(0, this.bonusTime - step); if (this.bonusTime <= 0) this.exitBonus(); }
    const target = this.mode === BonusMode.TRAVERSE ? 24 : this.mode === BonusMode.SUPER ? 15 : Math.min(22, 11.5 + this.distance * 0.00235);
    this.speed += (target + (this.dashTime > 0 ? 6 : 0) - this.speed) * Math.min(1, step * (this.dashTime > 0 ? 9 : 3.2));
    this.distance += this.speed * step; this.score += this.speed * step * 15 * this.scoreMultiplier;
    if (!this.grounded || this.velocityY > 0) { this.velocityY += (this.mountTime > 0 ? -23 : -31) * step; this.y += this.velocityY * step; }
    const floor = Number.isFinite(options.groundY) ? options.groundY : this.groundY; this.groundY = floor;
    if (this.y <= floor) { this.y = floor; this.velocityY = 0; this.grounded = true; this.jumpsUsed = 0; } else this.grounded = false;
    if (this.mode === BonusMode.NONE) {
      if (this.distance >= this.nextSuperAt) { this.nextSuperAt += 1350; this.pendingEvents.push('superReady'); }
      if (this.distance >= this.nextTraverseAt) { this.nextTraverseAt += 1900; this.pendingEvents.push('traverseReady'); }
    }
    return this.drainEvents();
  }
  drainEvents() { const events = this.pendingEvents.slice(); this.pendingEvents.length = 0; return events; }
}

const SEGMENT_LENGTH = 20;
const MAX_GAP = 5.25;
const PATTERNS = ['calm', 'hurdle', 'gap', 'beast', 'gate', 'steps', 'rhythm'];
const coinLine = (start, count, spacing, y = 2.15) => Array.from({ length: count }, (_, i) => ({ x: start + i * spacing, y, type: 'coin' }));
const coinArc = (start, count, spacing, baseY = 2.1, height = 2.8) => Array.from({ length: count }, (_, i) => { const t = count <= 1 ? 0 : i / (count - 1); return { x: start + i * spacing, y: baseY + Math.sin(t * Math.PI) * height, type: 'coin' }; });

export function createSegmentPlan(seed, index = 0, theme = 'tide') {
  const random = new SeededRandom((Number(seed) ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  const pattern = index < 2 ? 'calm' : random.pick(PATTERNS);
  const plan = { index, theme, pattern, length: SEGMENT_LENGTH, floor: [{ start: 0, end: SEGMENT_LENGTH, y: 0 }], platforms: [], hazards: [], pickups: [] };
  if (pattern === 'calm') plan.pickups.push(...coinLine(4, 8, 1.45));
  else if (pattern === 'hurdle') { plan.hazards.push({ type: 'hurdle', x: 10.5, y: 0, width: 1.25, height: 1.45 }); plan.pickups.push(...coinArc(6.7, 8, 1.05, 2, 2.35)); }
  else if (pattern === 'gap') {
    const start = random.range(8.2, 9.1), width = random.range(3.8, MAX_GAP);
    plan.floor = [{ start: 0, end: start, y: 0 }, { start: start + width, end: SEGMENT_LENGTH, y: 0 }];
    plan.pickups.push(...coinArc(start - 2.4, 8, (width + 4.8) / 7, 2, 3.25));
  } else if (pattern === 'beast') { plan.hazards.push({ type: 'monster', x: 11.2, y: 0, width: 1.35, height: 1.35 }); plan.pickups.push(...coinArc(7.4, 7, 1.15, 2.05, 2.25)); }
  else if (pattern === 'gate') { plan.hazards.push({ type: 'gate', x: 11, y: 2.05, width: 2.7, height: 0.75 }); plan.pickups.push(...coinLine(7.2, 8, 1.05, 1.12)); }
  else if (pattern === 'steps') { plan.platforms.push({ start: 7.5, end: 10.5, y: 1.15 }, { start: 10.5, end: 13.5, y: 2.15 }, { start: 13.5, end: 16.5, y: 1.15 }); plan.pickups.push(...coinArc(6.8, 10, 1.05, 2.15, 2)); }
  else { plan.hazards.push({ type: 'hurdle', x: 7.4, y: 0, width: 1.1, height: 1.25 }, { type: 'monster', x: 14.1, y: 0, width: 1.25, height: 1.25 }); plan.pickups.push(...coinArc(4.8, 6, .95, 2, 1.8), ...coinArc(11.4, 6, .95, 2, 1.8)); }
  if (index > 1 && random.next() < .22) plan.pickups.push({ type: random.pick(['shield', 'magnet', 'dash', 'mount']), x: 17.1, y: 2.7 });
  return plan;
}

export function inspectPassability(plan) {
  const reasons = [], floor = [...plan.floor].sort((a, b) => a.start - b.start);
  if (!floor.length || floor[0].start > .01 || floor.at(-1).end < plan.length - .01) reasons.push('segment lacks safe entry or exit');
  for (let i = 1; i < floor.length; i += 1) if (floor[i].start - floor[i - 1].end > MAX_GAP) reasons.push('gap exceeds jump envelope');
  const hazards = [...plan.hazards].sort((a, b) => a.x - b.x);
  for (let i = 1; i < hazards.length; i += 1) if (hazards[i].x - hazards[i - 1].x < 4.8) reasons.push('hazards are too tightly chained');
  if (hazards.some((h) => h.x < 3.2 || h.x > plan.length - 2.4)) reasons.push('hazard violates reaction buffer');
  return { passable: reasons.length === 0, reasons };
}

export function createBonusPattern(mode, wave = 0) {
  const pickups = [];
  if (mode === BonusMode.SUPER) {
    const rows = [-.1, 1.5, 3.1];
    for (let i = 0; i < 18; i += 1) pickups.push({ type: 'coin', x: 3.5 + i * 1.15, y: 2.2 + rows[(i + wave) % rows.length] + Math.sin((i + wave) * .65) * .7 });
    if (wave % 3 === 2) pickups.push({ type: 'magnet', x: 15.5, y: 5.2 });
  } else if (mode === BonusMode.TRAVERSE) {
    for (let i = 0; i < 16; i += 1) pickups.push({ type: 'coin', x: 4 + i * 1.35, y: 3.2 + Math.sin((i + wave * 2) * .75) * 2.25 });
    if (wave % 2 === 1) pickups.push({ type: 'dash', x: 17, y: 3.3 });
  }
  return pickups;
}
