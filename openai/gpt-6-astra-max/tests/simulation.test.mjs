import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, World, createSegment, createBonus, STEP, BONUS_TARGET, MAX_SPEED } from '../src/simulation.js';
import { SaveStore } from '../src/storage.js';

function run(game, seconds) { for (let i = 0; i < Math.ceil(seconds / STEP); i++) game.update(STEP); }
function cleanGame() {
  const game = new Game(7007); game.start();
  for (const s of game.world.segments) s.entities = [];
  game.player.effects.invulnerable = 0;
  return game;
}
function entity(game, type, x, y, properties = {}) {
  const e = { id: `test:${type}`, type, x, y, active: true, width: 1.3, height: 1.1, ...properties };
  game.world.segments[0].entities.push(e); return e;
}

test('start resets run and advances automatic distance and score', () => {
  const g = cleanGame(); run(g, 1); assert.equal(g.phase, 'running');
  assert.ok(g.distance > 9 && g.player.x > 13); assert.ok(g.score >= 45);
  g.start(); assert.equal(g.distance, 0); assert.equal(g.usedRevive, false);
});
test('jump, double jump, third-jump rejection and landing reset', () => {
  const g = cleanGame(); assert.ok(g.action('jump')); run(g, .18);
  const y = g.player.y; assert.ok(y > 1);
  assert.ok(g.action('jump')); assert.equal(g.player.jumps, 2); assert.equal(g.action('jump'), false);
  run(g, .2); assert.ok(g.player.y > y); run(g, 1.2);
  assert.equal(g.player.grounded, true); assert.equal(g.player.jumps, 0); assert.ok(g.action('jump'));
});
test('held crouch clears overhead barrier, standing hits it', () => {
  const duck = cleanGame(); entity(duck, 'arch', 7, 1, { width: 2.3, height: 2.4 });
  duck.action('duck', true); run(duck, .7); assert.equal(duck.phase, 'running');
  duck.action('duck', false); assert.equal(duck.player.crouching, false);
  const stand = cleanGame(); entity(stand, 'arch', 7, 1, { width: 2.3, height: 2.4 }); run(stand, .3);
  assert.equal(stand.phase, 'dead'); assert.match(stand.reason, /拱门/);
});
test('skill flies over gaps, destroys obstacles and consumes charge once', () => {
  const g = cleanGame(); entity(g, 'hurdle', 7, 0, { height: 2 });
  assert.ok(g.action('skill')); assert.equal(g.player.charge, 0); assert.equal(g.action('skill'), false);
  run(g, .3); assert.equal(g.phase, 'running'); assert.ok(g.player.y > 1); assert.equal(g.speed, 25);
  g.world.segments[0].platforms = [{ x: 0, end: 5, y: 0 }, { x: 50, end: 64, y: 0 }];
  run(g, 1.5); assert.equal(g.phase, 'running'); assert.ok(g.player.y > 0);
});
test('pause freezes physics, effect timers, bonus timer, score and input', () => {
  const g = cleanGame(); g.enterBonus('super'); g.action('skill'); run(g, .2);
  g.action('pause'); const before = g.snapshot(); run(g, 5);
  assert.deepEqual(g.snapshot(), before); assert.equal(g.action('jump'), false); assert.equal(g.action('skill'), false);
  g.action('pause'); run(g, .1); assert.ok(g.distance > before.distance); assert.ok(g.mode.remaining < before.remaining);
});
test('a descending monster stomp bounces, scores, and refreshes a jump', () => {
  const g = cleanGame(); const monster = entity(g, 'monster', 5, 0, { height: 1.05 });
  Object.assign(g.player, { x: 4.9, y: 1.1, vy: -7, grounded: false, jumps: 2 });
  run(g, .02); assert.equal(g.phase, 'running'); assert.equal(monster.active, false);
  assert.equal(g.stomps, 1); assert.ok(g.points >= 150); assert.ok(g.player.vy > 0); assert.equal(g.player.jumps, 1);
});
for (const effect of ['shield', 'mount']) test(`${effect} absorbs exactly one impact`, () => {
  const g = cleanGame(); g.player.effects[effect] = 12;
  entity(g, 'hurdle', 6, 0); run(g, .25);
  assert.equal(g.phase, 'running'); assert.equal(g.player.effects[effect], 0); assert.ok(g.player.effects.invulnerable > 0);
  g.player.effects.invulnerable = 0; entity(g, 'hurdle', g.player.x + 1, 0); run(g, .1); assert.equal(g.phase, 'dead');
});
for (const power of ['shield', 'magnet', 'mount', 'dash']) test(`actual ${power} pickup sets a timed effect`, () => {
  const g = cleanGame(); entity(g, 'power', 5, 1.2, { power }); run(g, .1);
  assert.ok(g.player.effects[power] > 0); const time = g.player.effects[power]; run(g, .15); assert.ok(g.player.effects[power] < time);
});
test('pet collects nearby coins and magnet extends collection range', () => {
  const g = cleanGame(); entity(g, 'coin', 5, 1); entity(g, 'coin', 10, 3.5); run(g, .02);
  assert.equal(g.coins, 1); g.player.effects.magnet = 10; run(g, .02); assert.equal(g.coins, 2);
  assert.ok(g.points >= 20); assert.equal(g.bonusCharge, 2);
});
test('coin charge enters super reward; time expires and safely restores normal route', () => {
  const g = cleanGame(); const normalX = g.player.x; g.bonusCharge = BONUS_TARGET - 1;
  entity(g, 'coin', normalX + .2, 1); run(g, .02);
  assert.equal(g.mode.id, 'super'); assert.equal(g.multiplier, 3); assert.equal(g.rewards, 1);
  assert.ok(g.mode.entities.length > 200); assert.equal(g.player.x < 1, true);
  run(g, 12.1); assert.equal(g.mode.id, 'normal'); assert.equal(g.multiplier, 1);
  assert.ok(g.player.x > normalX && g.player.x < normalX + 20); assert.ok(g.player.effects.invulnerable > 0);
  assert.ok(g.coins > 30); assert.equal(g.returnPoint, null);
});
test('actual portal enters a separate 30 m/s warp route and returns after 9 seconds', () => {
  const g = cleanGame(); entity(g, 'portal', 5, 0); run(g, .05);
  assert.equal(g.mode.id, 'warp'); assert.equal(g.speed, 30); assert.equal(g.multiplier, 5);
  assert.ok(g.player.y > 1); assert.ok(g.mode.entities.length >= 300);
  run(g, 9.05); assert.equal(g.mode.id, 'normal'); assert.ok(g.distance > 270); assert.ok(g.player.x < 20);
});
test('safe return preserves portals and a nearby portal can start warp during super cooldown', () => {
  const g = cleanGame(); const portal = entity(g, 'portal', 8, 0);
  entity(g, 'hurdle', 9, 0); g.world.clearNear(8);
  assert.equal(portal.active, true); g.modeCooldown = 6; run(g, .5);
  assert.equal(g.mode.id, 'warp');
});
test('bonus arrays cover their full playable travel range and modes cannot nest', () => {
  for (const id of ['super', 'warp']) {
    const b = createBonus(id); const speed = id === 'super' ? 13 : 30;
    assert.ok(b.entities.at(-1).x > speed * b.duration);
    const g = cleanGame(); assert.ok(g.enterBonus(id)); assert.equal(g.enterBonus(id === 'warp' ? 'super' : 'warp'), false);
  }
});
test('revival uses a safe platform, clears nearby hazards and is available only once', () => {
  const g = cleanGame(); entity(g, 'hurdle', 6, 0); run(g, .3); assert.equal(g.phase, 'dead');
  const distance = g.distance; assert.equal(g.action('jump'), false); assert.ok(g.action('revive'));
  assert.equal(g.phase, 'running'); assert.equal(g.usedRevive, true); assert.equal(g.distance, distance);
  assert.ok(g.world.ground(g.player.x) !== null); assert.ok(g.player.effects.shield > 0); assert.equal(g.action('revive'), false);
  g.player.effects.shield = 0; g.player.effects.invulnerable = 0;
  entity(g, 'hurdle', g.player.x + .6, 0); run(g, .1); assert.equal(g.phase, 'ended'); assert.equal(g.action('revive'), false);
});
test('falling kills without protection and shield rescues from a gap', () => {
  const unprotected = cleanGame(); Object.assign(unprotected.player, { y: -5.5, grounded: false }); run(unprotected, .01);
  assert.equal(unprotected.phase, 'dead');
  const protectedGame = cleanGame(); protectedGame.player.effects.shield = 5;
  Object.assign(protectedGame.player, { y: -5.5, grounded: false }); run(protectedGame, .01);
  assert.equal(protectedGame.phase, 'running'); assert.equal(protectedGame.player.effects.shield, 0); assert.equal(protectedGame.player.grounded, true);
});
test('finish and menu transitions, charge regeneration, speed cap', () => {
  const g = cleanGame(); g.player.charge = 10; run(g, 1); assert.ok(g.player.charge > 14);
  g.distance = 1e8; assert.equal(g.baseSpeed, MAX_SPEED); assert.equal(g.speed, MAX_SPEED);
  g.die('test'); g.action('finish'); assert.equal(g.phase, 'ended'); g.action('menu'); assert.equal(g.phase, 'menu');
});
test('seeded route generation is deterministic and retains only a bounded world window', () => {
  assert.deepEqual(createSegment(11, 907), createSegment(11, 907));
  const world = new World(1);
  for (let x = 0; x < 100_000; x += 37) {
    world.ensure(x); assert.ok(world.segments.length <= 6); assert.ok(world.entities.length < 250);
  }
});
test('400 generated terrain cases are traversable at minimum and maximum normal speed', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 50; seed++) for (let index = 1; index <= 4; index++) for (const speed of [9, 17]) {
    const g = cleanGame(); const segment = createSegment(index, seed);
    seen.add(segment.kind);
    segment.entities = segment.entities.filter(e => !['coin', 'power', 'portal'].includes(e.type));
    g.world.segments = [segment]; g.world.ensure = () => {};
    Object.assign(g.player, { x: segment.start + .2, y: 0, grounded: true });
    g.distance = speed === 17 ? 4000 : 0;
    let frames = 0;
    while (g.player.x < segment.end - 1 && g.phase === 'running' && frames++ < 1400) {
      const p = g.player;
      const arch = segment.entities.find(e => e.active && e.type === 'arch' && Math.abs(e.x - p.x) < 6);
      g.action('duck', !!arch);
      if (p.grounded && !arch) {
        const hurdle = segment.entities.find(e => e.active && ['hurdle', 'monster'].includes(e.type) && e.x > p.x && e.x - p.x < g.speed * .24 + .7);
        const platform = segment.platforms.find(f => p.x >= f.x && p.x < f.end);
        const gap = platform && platform.end < segment.end && !segment.platforms.some(f => Math.abs(f.x - platform.end) < .01);
        if (hurdle || (gap && platform.end - p.x < g.speed * .22 + .4)) g.action('jump');
      }
      g.update(STEP);
    }
    assert.equal(g.phase, 'running', `seed=${seed}, template=${segment.kind}, speed=${speed}, x=${g.player.x}: ${g.reason}`);
    assert.ok(g.player.x >= segment.end - 1); assert.ok(frames < 1400);
  }
  assert.equal(seen.size, 4);
});
test('save schema persists records/settings, rejects corrupt data and survives denied storage', () => {
  const data = new Map(); const memory = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const store = new SaveStore(memory); const g = cleanGame(); run(g, 1);
  assert.equal(store.result(g), true); store.sound(false);
  const loaded = new SaveStore(memory); assert.equal(loaded.data.bestScore, g.score); assert.equal(loaded.data.sound, false); assert.equal(loaded.data.runs, 1);
  memory.setItem('aeromail-save-v1', '{oops'); assert.doesNotThrow(() => new SaveStore(memory));
  const denied = new SaveStore({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } });
  assert.doesNotThrow(() => denied.result(g)); assert.equal(denied.available, false); assert.equal(denied.data.bestScore, g.score);
});
