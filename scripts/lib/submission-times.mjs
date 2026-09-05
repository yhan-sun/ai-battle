// Maintainer-side timeline enrichment. Never use build time or filesystem mtime.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { parseManifest, parseTimestamp } from '../../pages/assets/catalog.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function withSubmissionTimes(root, manifest, { warn = console.warn } = {}) {
  const entries = parseManifest(manifest).entries;
  const ids = new Set(entries.map((entry) => entry.id));
  const recordPath = join(root, 'pages', 'test-times.json');
  let records = {};
  if (existsSync(recordPath)) {
    const data = JSON.parse(readFileSync(recordPath, 'utf8'));
    if (!isObject(data) || data.schemaVersion !== 1 || !isObject(data.testedAt) || Object.keys(data).some((key) => !['schemaVersion', 'testedAt'].includes(key))) {
      throw new TypeError(`${recordPath}: expected { schemaVersion: 1, testedAt: { ... } }`);
    }
    for (const [id, value] of Object.entries(data.testedAt)) {
      if (!ids.has(id) || parseTimestamp(value) === null) {
        throw new TypeError(`${recordPath}: ${id} must name a current entry and have a valid ISO timestamp with timezone`);
      }
    }
    records = data.testedAt;
  }

  const git = (...args) => execFileSync('git', ['--literal-pathspecs', ...args], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024,
  }).trim();
  let haveHistory = false;
  try {
    // Do not accidentally read a containing repository when building an archive.
    haveHistory = realpathSync(git('rev-parse', '--show-toplevel')) === realpathSync(root);
  } catch { /* Source archives do not carry Git history. */ }
  if (haveHistory && git('rev-parse', '--is-shallow-repository') === 'true') {
    throw new Error('First-submission dates require complete Git history. Run git fetch --unshallow or set actions/checkout fetch-depth: 0.');
  }
  if (!haveHistory) warn('Git history unavailable: missing submission times remain unknown; no dates will be invented.');

  const times = new Map(entries.map((entry) => {
    let submittedAt = null;
    if (haveHistory) {
      // A later metadata/README edit, retest, or deployment must not make a
      // historical entry look newly submitted. Use the first file addition in
      // its current directory; do not use submission.json (added retroactively).
      const first = git('log', '--reverse', '--format=%ct', '--diff-filter=A', '--', `${entry.id}/`).split(/\r?\n/)[0];
      if (first) {
        if (!/^\d+$/.test(first)) throw new Error(`Invalid Git timestamp for ${entry.id}`);
        submittedAt = new Date(Number(first) * 1000).toISOString();
      }
    }
    return [entry.id, {
      testedAt: Object.hasOwn(records, entry.id) ? new Date(parseTimestamp(records[entry.id])).toISOString() : null,
      submittedAt,
    }];
  }));

  return {
    ...manifest,
    providers: manifest.providers.map((provider) => ({
      ...provider,
      models: provider.models.map((model) => ({ ...model, ...times.get(`${provider.slug}/${model.slug}`) })),
    })),
  };
}
