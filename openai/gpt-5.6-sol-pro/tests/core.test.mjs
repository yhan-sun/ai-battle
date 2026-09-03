import test from 'node:test';
import assert from 'node:assert/strict';
import { BonusMode, GameState, RunnerModel, SeededRandom, createBonusPattern, createSegmentPlan, inspectPassability } from '../src/core.js';

test('seeded random is deterministic', () => {
  const a = new SeededRandom(42), b = new SeededRandom(42);
  assert.deepEqual(Array.from({ length: 8 }, () => a.next()), Array.from({ length: 8 }, () => b.next()));
});

test('run starts cleanly', () => { const m = new RunnerModel(); assert.equal(m.start(), true); assert.equal(m.state, GameState.RUNNING); });
test('jump allows exactly one air jump', () => { const m = new RunnerModel(); m.start(); assert.equal(m.jump(), true); assert.equal(m.jump(), true); assert.equal(m.jump(), false); });
test('crouch changes hitbox and causes fast fall', () => { const m = new RunnerModel(); m.start(); const h = m.hitboxHeight; m.jump(); m.setCrouch(true); assert.ok(m.hitboxHeight < h); assert.ok(m.velocityY <= -8.5); });
test('skill grants linked buffs and observes cooldown', () => { const m = new RunnerModel(); m.start(); assert.equal(m.activateSkill(), true); assert.equal(m.activateSkill(), false); assert.ok(m.dashTime > 0 && m.magnetTime > 0 && m.shieldTime > 0 && m.mountTime > 0); });
test('shield and one-shot revive flow work', () => { const m = new RunnerModel(); m.start(); m.grantPower('shield', 5); assert.equal(m.receiveHit().result, 'blocked'); m.invulnerable = 0; assert.equal(m.receiveHit().result, 'down'); assert.equal(m.revive(), true); m.shieldTime = 0; m.invulnerable = 0; assert.equal(m.receiveHit().result, 'down'); assert.equal(m.revive(), false); });
test('both bonus states return to normal run', () => { const m = new RunnerModel(); m.start(); assert.equal(m.enterBonus(BonusMode.SUPER, 6), true); assert.equal(m.exitBonus(), true); assert.equal(m.enterBonus(BonusMode.TRAVERSE, 6), true); assert.equal(m.exitBonus(), true); assert.equal(m.state, GameState.RUNNING); });
test('mode and skill multiply score', () => { const m = new RunnerModel(); m.start(); m.combo = 24; const base = m.scoreMultiplier; m.activateSkill(); m.enterBonus(BonusMode.SUPER, 8); assert.ok(m.scoreMultiplier >= base * 6); });
test('2500 generated segments preserve passability', () => { for (let seed = 0; seed < 25; seed += 1) for (let index = 0; index < 100; index += 1) { const report = inspectPassability(createSegmentPlan(seed, index)); assert.equal(report.passable, true, `${seed}:${index} ${report.reasons.join(',')}`); } });
test('reward modes produce distinct collectible routes', () => { const a = createBonusPattern(BonusMode.SUPER, 2), b = createBonusPattern(BonusMode.TRAVERSE, 3); assert.ok(a.filter((x) => x.type === 'coin').length >= 16); assert.ok(b.filter((x) => x.type === 'coin').length >= 14); assert.notDeepEqual(a.map((x) => x.y), b.map((x) => x.y)); });
