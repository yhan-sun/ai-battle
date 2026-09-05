// The simulation has no DOM or Three.js dependency. Distances are world metres.
export const STEP = 1 / 120;
export const SEGMENT_LENGTH = 64;
export const BONUS_TARGET = 28;
export const GRAVITY = 27;
export const JUMP_SPEED = 11.6;
export const MAX_SPEED = 17;
export const PLAYER_HEIGHT = 1.65;
export const DUCK_HEIGHT = 0.68;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSegment(index, seed) {
  const rng = random(seed + index * 7919);
  const start = index * SEGMENT_LENGTH;
  const kind = index === 0 ? 0 : Math.floor(rng() * 4);
  const biome = Math.floor(index / 5) % 2 ? 'cave' : 'sky';
  const segment = { id: `s${index}`, index, start, end: start + SEGMENT_LENGTH, kind, biome, platforms: [], entities: [] };
  let eid = 0;
  const floor = (a, b, y = 0) => segment.platforms.push({ x: start + a, end: start + b, y });
  const add = (type, x, y, extra = {}) => segment.entities.push({ id: `${index}:${eid++}`, type, x: start + x, y, active: true, ...extra });
  const coins = (from, to, y = 1.05, spacing = 2) => { for (let x = from; x <= to; x += spacing) add('coin', x, y); };
  if (kind === 0) {
    floor(0, 64);
    if (index > 0) add('hurdle', 20, 0, { width: 1.3, height: 1.15 });
    add('monster', 45, 0, { width: 1.3, height: 1.05 });
    coins(7, 15); coins(23, 33); coins(43, 47, 2.65); coins(53, 59);
  } else if (kind === 1) {
    floor(0, 25); floor(29.2, 64);
    for (let i = 0; i < 7; i++) add('coin', 21.5 + i * 1.85, 1.3 + Math.sin(i / 6 * Math.PI) * 2.2);
    add('hurdle', 49, 0, { width: 1.3, height: 1.35 });
    coins(6, 14); coins(54, 60);
  } else if (kind === 2) {
    floor(0, 64);
    add('arch', 21, 1.0, { width: 2.3, height: 2.4 });
    add('monster', 46, 0, { width: 1.3, height: 1.05 });
    coins(7, 13); coins(18, 24, 0.42, 1.5); coins(31, 37); coins(44, 48, 2.6); coins(54, 60);
  } else {
    floor(0, 19); floor(19, 36, -0.6); floor(36, 52, -0.3); floor(52, 64);
    add('hurdle', 27, -0.6, { width: 1.25, height: 1.2 });
    add('arch', 50, 0.7, { width: 2.2, height: 2.5 });
    coins(7, 13); coins(24, 30, 2.1); coins(37, 43, 0.75); coins(48, 52, 0.18); coins(56, 60);
  }
  // Decisions are >= 19 m apart. At 17 m/s this leaves > 1.1 s between hazards.
  // The 4.2 m gap is shorter than the 7.7 m minimum-speed single-jump range.
  const powers = ['shield', 'magnet', 'mount', 'dash'];
  add('power', index === 0 ? 24 : 10, 1.3, { power: powers[index % powers.length] });
  if (index % 6 === 3) add('portal', 59, 0, { width: 2, height: 5 });
  return segment;
}

export class World {
  constructor(seed) { this.seed = seed; this.segments = []; this.nextIndex = 0; this.ensure(0); }
  ensure(x) {
    while (this.nextIndex * SEGMENT_LENGTH < x + 140) this.segments.push(createSegment(this.nextIndex++, this.seed));
    this.segments = this.segments.filter(s => s.end > x - 80);
  }
  get entities() { return this.segments.flatMap(s => s.entities); }
  ground(x) {
    for (const segment of this.segments) for (const platform of segment.platforms) {
      if (x >= platform.x && x < platform.end) return platform.y;
    }
    return null;
  }
  safePosition(x) {
    this.ensure(x);
    for (const s of this.segments) for (const p of s.platforms) {
      const candidate = Math.max(x, p.x + 1.2);
      if (candidate < p.end - 9) return { x: candidate, y: p.y };
    }
    throw new Error('No safe recovery platform generated');
  }
  clearNear(x, radius = 10) {
    for (const e of this.entities) if (['hurdle', 'arch', 'monster'].includes(e.type) && Math.abs(e.x - x) < radius) e.active = false;
  }
}

export function createBonus(mode) {
  const warp = mode === 'warp';
  const entities = [];
  const spacing = warp ? 4 : 2.3;
  for (let column = 0; column < (warp ? 100 : 95); column++) {
    const x = 8 + column * spacing;
    for (let row = 0; row < 3; row++) {
      const y = warp ? 1.3 + row * 1.2 + Math.sin(column * .32) * .45 : .95 + row * 1.25 + Math.sin(column * .24) * .2;
      entities.push({ id: `b:${column}:${row}`, type: 'coin', x, y, active: true });
    }
  }
  return { id: mode, duration: warp ? 9 : 12, remaining: warp ? 9 : 12, entities, coins: 0 };
}

export class Game {
  constructor(seed = 7007) {
    this.seed = seed;
    this.phase = 'menu';
    this.events = [];
    this.reset();
    this.phase = 'menu';
  }
  reset() {
    this.world = new World(this.seed);
    this.player = { x: 4, y: 0, vy: 0, grounded: true, jumps: 0, crouching: false,
      effects: { shield: 0, magnet: 0, dash: 0, mount: 0, invulnerable: 2 }, charge: 100 };
    this.mode = { id: 'normal' };
    this.returnPoint = null;
    this.time = 0; this.distance = 0; this.points = 0; this.coins = 0; this.bonusCharge = 0;
    this.combo = 0; this.maxCombo = 0; this.comboTime = 0; this.rewards = 0; this.stomps = 0;
    this.usedRevive = false; this.reason = ''; this.modeCooldown = 0; this.events = [];
  }
  get biome() { return this.mode.id !== 'normal' ? this.mode.id : Math.floor(this.player.x / 320) % 2 ? 'cave' : 'sky'; }
  get multiplier() { return this.mode.id === 'warp' ? 5 : this.mode.id === 'super' ? 3 : 1; }
  get score() { return Math.floor(this.distance * 5 + this.points); }
  get baseSpeed() { return Math.min(MAX_SPEED, 9 + this.distance / 350); }
  get speed() {
    if (this.mode.id === 'warp') return 30;
    if (this.player.effects.dash > 0) return 25;
    if (this.mode.id === 'super') return 13;
    return Math.min(MAX_SPEED, this.baseSpeed + (this.player.effects.mount > 0 ? 1.5 : 0));
  }
  get entities() { return this.mode.id === 'normal' ? this.world.entities : this.mode.entities; }
  emit(type, data = {}) { this.events.push({ type, ...data }); if (this.events.length > 60) this.events.shift(); }
  drainEvents() { return this.events.splice(0); }
  start() { this.reset(); this.phase = 'running'; this.emit('start'); }
  action(action, value = true) {
    if (action === 'start') { this.start(); return true; }
    if (action === 'pause' && (this.phase === 'running' || this.phase === 'paused')) {
      this.phase = this.phase === 'running' ? 'paused' : 'running'; this.player.crouching = false;
      this.emit('pause', { paused: this.phase === 'paused' }); return true;
    }
    if (action === 'revive') return this.revive();
    if (action === 'finish' && this.phase === 'dead') { this.phase = 'ended'; this.emit('finish'); return true; }
    if (action === 'menu') { this.phase = 'menu'; this.player.crouching = false; return true; }
    if (this.phase !== 'running') return false;
    const p = this.player;
    if (action === 'duck') { p.crouching = value; return true; }
    if (action === 'jump') {
      if (p.jumps >= 2) return false;
      p.crouching = false; p.vy = JUMP_SPEED * (p.effects.mount > 0 ? 1.08 : 1);
      p.grounded = false; p.jumps++; this.emit('jump', { double: p.jumps === 2 }); return true;
    }
    if (action === 'skill') {
      if (p.charge < 100 || p.effects.dash > 0) return false;
      p.charge = 0; p.effects.dash = 3; p.vy = Math.max(0, p.vy); this.emit('skill'); return true;
    }
    return false;
  }
  update(dt) {
    if (this.phase !== 'running') return;
    // Callers use fixed steps. Guard large deltas to prevent tunnelling after a stall.
    dt = clamp(dt, 0, 1 / 30);
    const p = this.player;
    this.time += dt; this.modeCooldown = Math.max(0, this.modeCooldown - dt);
    for (const key in p.effects) p.effects[key] = Math.max(0, p.effects[key] - dt);
    p.charge = Math.min(100, p.charge + dt * 4.5);
    this.comboTime -= dt;
    if (this.comboTime <= 0) this.combo = 0;
    const travel = this.speed * dt;
    this.distance += travel;
    const previousY = p.y;
    const previousGround = this.mode.id === 'normal' ? this.world.ground(p.x) : 0;
    p.x += travel;
    if (this.mode.id === 'normal') this.world.ensure(p.x);
    const ground = this.mode.id === 'normal' ? this.world.ground(p.x) : 0;
    const flying = this.mode.id === 'warp' || p.effects.dash > 0;
    if (flying) {
      const hover = p.crouching ? .12 : 1.45;
      p.vy -= GRAVITY * .65 * dt;
      p.y += p.vy * dt;
      if (p.y < hover) { p.y += (hover - p.y) * Math.min(1, dt * 18); p.vy = Math.max(0, p.vy); p.jumps = 0; }
      p.grounded = false;
    } else {
      if (p.crouching && !p.grounded) p.vy -= 23 * dt;
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      const walkableStep = p.grounded && previousGround !== null && ground !== null && ground - previousGround <= .7;
      if (ground !== null && p.y <= ground && (previousY >= ground - .06 || walkableStep) && p.vy <= 0) {
        if (!p.grounded) this.emit('land');
        p.y = ground; p.vy = 0; p.grounded = true; p.jumps = 0;
      } else p.grounded = false;
    }
    this.collide(previousY);
    if (this.phase !== 'running') return;
    if (p.y < -5) {
      if (p.effects.dash > 0 || p.effects.mount > 0 || p.effects.shield > 0 || p.effects.invulnerable > 0) {
        if (p.effects.dash <= 0 && p.effects.invulnerable <= 0) {
          if (p.effects.mount > 0) p.effects.mount = 0; else p.effects.shield = 0;
        }
        this.recover(p.x + 1); this.emit('rescue');
      } else this.die('错过了浮岛边缘。试试在空中再跳一次。');
    }
    if (this.mode.id !== 'normal') {
      this.mode.remaining -= dt;
      if (this.mode.remaining <= 0) this.exitBonus();
    } else if (this.bonusCharge >= BONUS_TARGET && this.modeCooldown <= 0 && p.grounded && p.effects.dash <= 0) this.enterBonus('super');
  }
  collect(coin) {
    coin.active = false; this.coins++;
    this.combo++; this.comboTime = 2.1; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.points += (10 + Math.min(20, Math.floor(this.combo / 8) * 2)) * this.multiplier;
    this.player.charge = Math.min(100, this.player.charge + .65);
    if (this.mode.id === 'normal') this.bonusCharge = Math.min(BONUS_TARGET, this.bonusCharge + 1);
    else this.mode.coins++;
    this.emit('coin', { x: coin.x, y: coin.y, combo: this.combo });
  }
  collide(previousY) {
    const p = this.player;
    const height = p.crouching ? DUCK_HEIGHT : PLAYER_HEIGHT;
    const magnetic = p.effects.magnet > 0 || p.effects.dash > 0;
    for (const e of this.entities) {
      if (!e.active || Math.abs(e.x - p.x) > 10) continue;
      if (e.type === 'coin') {
        const radius = magnetic ? 7 : 1.65; // The pet is a permanent short-range collector.
        if (Math.hypot(e.x - p.x, e.y - (p.y + height * .55)) < radius) this.collect(e);
        continue;
      }
      if (e.type === 'power') {
        if (Math.abs(e.x - p.x) < 1.2 && e.y > p.y - .4 && e.y < p.y + height + .7) {
          e.active = false;
          p.effects[e.power] = { shield: 14, magnet: 12, mount: 16, dash: 4 }[e.power];
          this.emit('power', { power: e.power });
        }
        continue;
      }
      if (e.type === 'portal') {
        if (Math.abs(e.x - p.x) < 1) { e.active = false; this.enterBonus('warp'); return; }
        continue;
      }
      if (Math.abs(e.x - p.x) > e.width * .5 + .34 || p.y >= e.y + e.height || p.y + height <= e.y) continue;
      if (e.type === 'monster' && p.vy < 0 && previousY >= e.y + e.height - .23) {
        e.active = false; p.y = e.y + e.height; p.vy = 9; p.grounded = false; p.jumps = 1;
        this.stomps++; this.points += 150 * this.multiplier; this.combo += 5;
        this.maxCombo = Math.max(this.maxCombo, this.combo); this.comboTime = 2.1;
        this.emit('stomp', { x: e.x, y: e.y }); continue;
      }
      if (p.effects.dash > 0 || p.effects.invulnerable > 0) {
        e.active = false; this.points += 30; this.emit('break', { x: e.x, y: e.y });
      } else if (p.effects.shield > 0 || p.effects.mount > 0) {
        const effect = p.effects.shield > 0 ? 'shield' : 'mount';
        p.effects[effect] = 0; p.effects.invulnerable = 1.5; e.active = false;
        this.combo = 0; this.emit('hit', { effect, x: e.x, y: e.y });
      } else { this.die(e.type === 'arch' ? '拱门太低了。按住 ↓ 或 S 从下方滑过。' : e.type === 'monster' ? '碰到了云团怪。从上方踩踏可以弹起加分。' : '碰到了货箱。起跳越过它，或发动冲刺。'); return; }
    }
  }
  enterBonus(id) {
    if (this.phase !== 'running' || this.mode.id !== 'normal' || !['super', 'warp'].includes(id)) return false;
    this.returnPoint = { x: this.player.x };
    this.mode = createBonus(id); this.rewards++; this.bonusCharge = 0;
    Object.assign(this.player, { x: 0, y: id === 'warp' ? 1.45 : 0, vy: 0, jumps: 0, grounded: id !== 'warp', crouching: false });
    this.emit('mode', { mode: id }); return true;
  }
  exitBonus() {
    if (this.mode.id === 'normal') return false;
    const earned = this.mode.coins;
    const resumeX = this.returnPoint?.x ?? 4;
    this.mode = { id: 'normal' }; this.returnPoint = null; this.modeCooldown = 6;
    this.recover(resumeX + 3);
    this.emit('return', { coins: earned }); return true;
  }
  recover(x) {
    const safe = this.world.safePosition(x);
    Object.assign(this.player, { x: safe.x, y: safe.y, vy: 0, grounded: true, jumps: 0, crouching: false });
    this.player.effects.invulnerable = 3;
    this.world.clearNear(safe.x);
  }
  die(reason) {
    if (this.phase !== 'running') return;
    this.reason = reason; this.player.crouching = false;
    this.phase = this.usedRevive ? 'ended' : 'dead';
    this.emit('death', { reason });
  }
  revive() {
    if (this.phase !== 'dead' || this.usedRevive) return false;
    this.usedRevive = true; this.phase = 'running';
    if (this.mode.id !== 'normal') this.exitBonus();
    else this.recover(this.player.x + 3);
    this.player.effects.shield = 6;
    this.emit('revive'); return true;
  }
  snapshot() {
    return { phase: this.phase, mode: this.mode.id, biome: this.biome, score: this.score, coins: this.coins,
      distance: this.distance, speed: this.speed, combo: this.combo, bonusCharge: this.bonusCharge,
      rewards: this.rewards, remaining: this.mode.remaining ?? 0, usedRevive: this.usedRevive,
      player: JSON.parse(JSON.stringify(this.player)), segments: this.world.segments.length, entities: this.entities.length };
  }
}
