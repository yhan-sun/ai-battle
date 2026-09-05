// Platform-maintainer tests; these do not inspect or execute contestant projects.
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { withSubmissionTimes } from './lib/submission-times.mjs';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, cpSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseManifest, parseTimestamp, filterEntries, normalizeState, readState, stateUrl, sourceUrl, hasFilters } from '../pages/assets/catalog.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const model = (provider, slug, name, title, protocolVersion = 1) => ({ slug, name, title, protocolVersion, path: `./${provider}/${slug}/`, image: `./output/covers/${provider}-${slug}.svg` });
const fixture = () => ({ schemaVersion: 1, providers: [
  { slug: 'lab-a', name: 'Alpha', accent: '#6fe7ff', models: [model('lab-a', 'model-10', 'Model 10', '星空疾行'), model('lab-a', 'model-2', 'Model 2', 'Ocean Runner', 0)] },
  { slug: 'lab-b', name: 'Beta', accent: '#ff8a54', models: [model('lab-b', 'model-3', 'Model 3', '星空漂流')] },
] });
const defaults = () => readState('');

test('manifest: discovers all models in all providers without a company-selection gate', () => {
  const { providers, entries } = parseManifest(fixture());
  assert.equal(providers.length, 2);
  assert.equal(entries.length, 3);
  assert.equal(filterEntries(entries, defaults()).length, 3);
  assert.equal(entries[0].id, 'lab-a/model-10');
});
test('manifest: a valid empty manifest is not a network error', () => {
  assert.deepEqual(parseManifest({ schemaVersion: 1, providers: [] }), { providers: [], entries: [] });
});
test('manifest: rejects unsupported versions and invalid shapes', () => {
  for (const invalid of [null, {}, { schemaVersion: 2, providers: [] }, { schemaVersion: 1, providers: null }]) assert.throws(() => parseManifest(invalid), TypeError);
});
test('manifest: rejects duplicate providers and model IDs', () => {
  const a = fixture(); a.providers.push(a.providers[0]);
  assert.throws(() => parseManifest(a), TypeError);
  const b = fixture(); b.providers[0].models.push(b.providers[0].models[0]);
  assert.throws(() => parseManifest(b), TypeError);
});
test('manifest: rejects executable, external, traversal and mismatched game URLs', () => {
  for (const path of ['javascript:alert(1)', '//evil.example/', 'https://evil.example/', './../secret/', './lab-b/model-10/', './lab-a/model-10/?x=1']) {
    const f = fixture(); f.providers[0].models[0].path = path;
    assert.throws(() => parseManifest(f), TypeError);
  }
});
test('manifest: rejects invalid image paths and protocol versions', () => {
  for (const image of ['https://evil.example/x.png', 'data:image/svg+xml,x', './output/covers/../../x.svg', './output/covers/x.html']) {
    const f = fixture(); f.providers[0].models[0].image = image;
    assert.throws(() => parseManifest(f), TypeError);
  }
  const f = fixture(); f.providers[0].models[0].protocolVersion = '1';
  assert.throws(() => parseManifest(f), TypeError);
});
test('manifest: keeps existing dotted model slugs and known screenshot paths valid', () => {
  const f = fixture(); f.providers[0].models = [model('lab-a', 'gpt-5.6-pro', 'GPT-5.6 Pro', 'Runner')];
  f.providers[0].models[0].image = './output/playwright/lab-a-gpt-5.6-pro.png';
  assert.equal(parseManifest(f).entries[0].slug, 'gpt-5.6-pro');
});
test('manifest: invalid optional accent becomes safe default styling', () => {
  const f = fixture(); f.providers[0].accent = 'red;background:url(https://evil.example)';
  assert.equal(parseManifest(f).providers[0].accent, '#c2f78c');
});
test('catalog: Chinese title search, NFKC normalization and multi-term search', () => {
  const { entries } = parseManifest(fixture());
  assert.equal(filterEntries(entries, { ...defaults(), q: '星空' }).length, 2);
  assert.equal(filterEntries(entries, { ...defaults(), q: 'ＭＯＤＥＬ １０' }).length, 1);
  assert.equal(filterEntries(entries, { ...defaults(), q: 'alpha ocean' }).length, 1);
  assert.equal(filterEntries(entries, { ...defaults(), q: '   ' }).length, 3);
});
test('catalog: company, protocol and search compose rather than override', () => {
  const { entries } = parseManifest(fixture());
  assert.equal(filterEntries(entries, { ...defaults(), provider: 'lab-a', protocol: '1', q: '星空' }).length, 1);
  assert.equal(filterEntries(entries, { ...defaults(), provider: 'lab-a', protocol: '0', q: '星空' }).length, 0);
});
test('catalog: sorting does not mutate original manifest order', () => {
  const { entries } = parseManifest(fixture());
  const ids = entries.map((x) => x.id);
  assert.deepEqual(filterEntries(entries, { ...defaults(), sort: 'name' }).map((x) => x.name), ['Model 2', 'Model 3', 'Model 10']);
  assert.deepEqual(entries.map((x) => x.id), ids);
  assert.deepEqual(filterEntries(entries, defaults()).map((x) => x.id), ids);
});
test('catalog: unknown providers and invalid URL state fall back safely', () => {
  const { providers } = parseManifest(fixture());
  assert.deepEqual(normalizeState(readState('?provider=missing&sort=rating&protocol=99&view=hacked'), providers), defaults());
  assert.equal(readState(`?q=${'a'.repeat(250)}`).q.length, 200);
});
test('catalog: explicit URL view overrides stored preference', () => {
  assert.equal(readState('?view=grid', 'list').view, 'grid');
  assert.equal(readState('', 'list').view, 'list');
  assert.equal(readState('', 'invalid').view, 'grid');
});
test('catalog: URL serialization preserves Pages subpaths, unrelated parameters and hash', () => {
  const state = { ...defaults(), provider: 'lab-b', q: '星空', protocol: '1', view: 'list' };
  const url = stateUrl('https://example.test/fork-name/?utm_source=test#gallery', state);
  assert.equal(url.pathname, '/fork-name/');
  assert.equal(url.hash, '#gallery');
  assert.equal(url.searchParams.get('utm_source'), 'test');
  assert.deepEqual(readState(url.search), state);
  const reset = stateUrl(url.href, defaults());
  assert.equal(reset.search, '?utm_source=test');
});
test('catalog: new providers and entries appear without frontend edits', () => {
  const f = fixture();
  f.providers.push({ slug: 'new-lab', name: 'New Lab', models: [model('new-lab', 'new-model', 'New Model', 'New Game')] });
  const { entries, providers } = parseManifest(f);
  assert.equal(entries.length, 4);
  assert.equal(providers.length, 3);
  assert.equal(filterEntries(entries, { ...defaults(), provider: 'new-lab' }).length, 1);
});
test('catalog: source links use validated IDs, reset includes sorting', () => {
  const { entries } = parseManifest(fixture());
  assert.equal(sourceUrl(entries[0]), 'https://github.com/yhan-sun/ai-battle/tree/main/lab-a/model-10');
  assert.equal(hasFilters(defaults()), false);
  assert.equal(hasFilters({ ...defaults(), sort: 'name' }), true);
});
test('page: retains the real manifest fetch required by repository verification', () => {
  const html = readFileSync(join(root, 'pages/index.html'), 'utf8');
  assert.ok(html.includes('fetch("./submissions.json"'));
  assert.ok(html.includes('AI_SUBMISSION_GUIDE.md'));
  assert.ok(html.includes('<noscript>'));
  assert.ok(html.includes('<dialog'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(!html.includes('const companies = {'));
  assert.ok(!html.includes('<iframe'));
});
test('build: copies all first-party UI assets alongside index.html', () => {
  const build = readFileSync(join(root, 'scripts/build-pages.mjs'), 'utf8');
  assert.ok(build.includes("cpSync(join(root, 'pages', 'assets'), join(site, 'assets'), { recursive: true })"));
  const destination = mkdtempSync(join(tmpdir(), 'arena-assets-'));
  try {
    cpSync(join(root, 'pages/assets'), join(destination, 'assets'), { recursive: true });
    for (const file of ['arena.css', 'arena.mjs', 'catalog.mjs']) {
      assert.ok(existsSync(join(destination, 'assets', file)));
      assert.equal(readFileSync(join(destination, 'assets', file), 'utf8'), readFileSync(join(root, 'pages/assets', file), 'utf8'));
    }
  } finally { rmSync(destination, { recursive: true, force: true }); }
});

// Newest-first regression tests. Synthetic dates are test fixtures, not claims
// about actual contestants or their test history.
function timedFixture() {
  const f = fixture();
  f.providers[0].models[0].submittedAt = '2026-09-01T00:00:00Z';
  f.providers[0].models[1].submittedAt = '2026-09-02T00:00:00Z';
  f.providers[1].models[0].submittedAt = '2026-09-03T00:00:00Z';
  return f;
}

test('time: default and legacy default URL sort across providers newest first', () => {
  const { entries } = parseManifest(timedFixture());
  for (const state of [defaults(), readState('?sort=default')]) {
    assert.deepEqual(filterEntries(entries, state).map((e) => e.name), ['Model 3', 'Model 2', 'Model 10']);
  }
  assert.deepEqual(entries.map((e) => e.name), ['Model 10', 'Model 2', 'Model 3']);
});
test('time: recorded retest takes precedence over first submission and moves entry to front', () => {
  const f = timedFixture();
  f.providers[0].models[0].testedAt = '2026-09-04T08:00:00+08:00';
  const { entries } = parseManifest(f);
  assert.equal(entries[0].testedAt, '2026-09-04T00:00:00.000Z');
  assert.equal(filterEntries(entries, defaults())[0].name, 'Model 10');
});
test('time: company/search/protocol filtering retains descending chronology', () => {
  const { entries } = parseManifest(timedFixture());
  assert.deepEqual(filterEntries(entries, { ...defaults(), provider: 'lab-a' }).map((e) => e.name), ['Model 2', 'Model 10']);
  assert.deepEqual(filterEntries(entries, { ...defaults(), q: '星空', protocol: '1' }).map((e) => e.name), ['Model 3', 'Model 10']);
});
test('time: equal instants preserve stable order and missing/invalid dates go last', () => {
  const f = timedFixture();
  f.providers[0].models[0].submittedAt = '2026-09-03T08:00:00+08:00';
  f.providers[0].models[1].submittedAt = 'invalid';
  const { entries } = parseManifest(f);
  assert.deepEqual(filterEntries(entries, defaults()).map((e) => e.name), ['Model 10', 'Model 3', 'Model 2']);
  assert.equal(entries[1].submittedAt, null);
});
test('time: malformed optional test timestamp falls back to known submission time', () => {
  const f = timedFixture();
  f.providers[0].models[1].testedAt = '9999';
  const { entries } = parseManifest(f);
  assert.deepEqual(filterEntries(entries, defaults()).map((e) => e.name), ['Model 3', 'Model 2', 'Model 10']);
});
test('time: timestamp parser rejects date-only, local time and impossible dates', () => {
  for (const value of [undefined, null, 0, '', '2026-09-05', '2026-09-05T12:00:00', '2026-02-29T00:00:00Z', '2026-02-30T00:00:00Z', '2026-09-05T24:00:00Z', '2026-09-05T12:00:00+25:00', '2026-09-05T12:00:00Z trailing']) {
    assert.equal(parseTimestamp(value), null, String(value));
  }
  assert.equal(parseTimestamp('2024-02-29T00:00:00.123Z'), Date.parse('2024-02-29T00:00:00.123Z'));
  assert.equal(parseTimestamp('2026-09-05T08:30:00+08:00'), parseTimestamp('2026-09-05T00:30:00Z'));
});
test('time: resetting explicit name sort returns to newest-first, not source order', () => {
  const { entries } = parseManifest(timedFixture());
  assert.deepEqual(filterEntries(entries, readState('?sort=name')).map((e) => e.name), ['Model 2', 'Model 3', 'Model 10']);
  assert.equal(filterEntries(entries, defaults())[0].name, 'Model 3');
  assert.equal(hasFilters(defaults()), false);
});

function historyFixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'arena-history-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = (args, date) => execFileSync('git', args, {
    cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
  }).trim();
  run(['init', '-q']);
  run(['config', 'user.name', 'UI Test Fixture']);
  run(['config', 'user.email', 'fixture@example.invalid']);
  const commit = (date) => { run(['add', '.']); run(['-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic fixture'], date); };
  for (const [i, id] of ['lab-a/model-10', 'lab-a/model-2', 'lab-b/model-3'].entries()) {
    mkdirSync(join(dir, id), { recursive: true });
    writeFileSync(join(dir, id, 'index.html'), id);
    commit(`2026-09-0${i + 1}T00:00:00Z`);
  }
  mkdirSync(join(dir, 'pages'), { recursive: true });
  return { dir, run, commit };
}

test('timeline: Git history enriches real manifest shape and preserves original object', (t) => {
  const { dir } = historyFixture(t);
  const original = fixture();
  const result = withSubmissionTimes(dir, original);
  const { entries } = parseManifest(result);
  assert.equal(entries[0].submittedAt, '2026-09-01T00:00:00.000Z');
  assert.equal(entries[2].submittedAt, '2026-09-03T00:00:00.000Z');
  assert.equal(entries[0].testedAt, null);
  assert.equal(original.providers[0].models[0].submittedAt, undefined);
  assert.deepEqual(filterEntries(entries, defaults()).map((e) => e.name), ['Model 3', 'Model 2', 'Model 10']);
});
test('timeline: later metadata/README changes cannot change first-submission time', (t) => {
  const { dir, commit } = historyFixture(t);
  writeFileSync(join(dir, 'lab-a/model-10/submission.json'), '{}');
  writeFileSync(join(dir, 'lab-a/model-10/README.md'), 'Later metadata migration');
  commit('2026-09-04T00:00:00Z');
  writeFileSync(join(dir, 'README.md'), 'Later site deployment');
  commit('2026-09-05T00:00:00Z');
  const { entries } = parseManifest(withSubmissionTimes(dir, fixture()));
  assert.equal(entries[0].submittedAt, '2026-09-01T00:00:00.000Z');
  assert.equal(filterEntries(entries, defaults())[0].name, 'Model 3');
});
test('timeline: maintainer retest record flows through generation into default ordering', (t) => {
  const { dir } = historyFixture(t);
  writeFileSync(join(dir, 'pages/test-times.json'), JSON.stringify({ schemaVersion: 1, testedAt: { 'lab-a/model-10': '2026-09-05T08:30:00+08:00' } }));
  const { entries } = parseManifest(withSubmissionTimes(dir, fixture()));
  assert.equal(entries[0].testedAt, '2026-09-05T00:30:00.000Z');
  assert.equal(filterEntries(entries, defaults())[0].name, 'Model 10');
});
test('timeline: invalid dates, unknown entries and malformed records fail visibly', (t) => {
  const { dir } = historyFixture(t);
  const invalid = [
    { schemaVersion: 1, testedAt: { 'lab-a/model-10': '2026-02-30T00:00:00Z' } },
    { schemaVersion: 1, testedAt: { 'unknown/model': '2026-09-05T00:00:00Z' } },
    { schemaVersion: 1, testedAt: [] },
    { schemaVersion: 9, testedAt: {} },
    { schemaVersion: 1, testedAt: {}, extra: true },
  ];
  for (const record of invalid) {
    writeFileSync(join(dir, 'pages/test-times.json'), JSON.stringify(record));
    assert.throws(() => withSubmissionTimes(dir, fixture()), TypeError);
  }
});
test('timeline: archives retain unknown dates instead of using current build time', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'arena-no-history-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const warnings = [];
  const { entries } = parseManifest(withSubmissionTimes(dir, fixture(), { warn: (message) => warnings.push(message) }));
  assert.equal(warnings.length, 1);
  assert.ok(entries.every((e) => e.testedAt === null && e.submittedAt === null));
});
test('timeline: a shallow checkout is rejected rather than dating every model at HEAD', (t) => {
  const { dir } = historyFixture(t);
  const shallow = mkdtempSync(join(tmpdir(), 'arena-shallow-'));
  t.after(() => rmSync(shallow, { recursive: true, force: true }));
  execFileSync('git', ['clone', '-q', '--depth=1', `file://${dir}`, shallow], { stdio: 'pipe' });
  assert.throws(() => withSubmissionTimes(shallow, fixture()), /complete Git history/);
});
test('integration: Pages includes times, default label is chronological and CI loads history', () => {
  const html = readFileSync(join(root, 'pages/index.html'), 'utf8');
  const build = readFileSync(join(root, 'scripts/build-pages.mjs'), 'utf8');
  const workflow = readFileSync(join(root, '.github/workflows/deploy-pages.yml'), 'utf8');
  const browser = readFileSync(join(root, 'scripts/test-ui-browser.py'), 'utf8');
  assert.ok(html.includes('<option value="default">时间：新 → 旧</option>'));
  assert.ok(html.includes('id="detail-time"'));
  assert.ok(build.includes('withSubmissionTimes(root, createPublicManifest(projects))'));
  assert.ok(/uses: actions\/checkout@v4\s+with:\s+fetch-depth: 0/.test(workflow));
  assert.ok(browser.includes('submittedAt'));
});
