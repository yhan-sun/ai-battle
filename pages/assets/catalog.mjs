/** Pure catalog operations. The production roster always comes from submissions.json. */
export const REPOSITORY = 'https://github.com/yhan-sun/ai-battle';
const SLUG = /^[a-z0-9][a-z0-9._-]*$/;
const IMAGE = /^\.\/output\/(?:playwright|covers)\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|jpe?g|webp|avif|svg)$/i;
const SORTS = new Set(['default', 'name', 'provider']);
const VIEWS = new Set(['grid', 'list']);
const PROTOCOLS = new Set(['all', '0', '1']);
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const validText = (value) => typeof value === 'string' && value.trim().length > 0;
const validSlug = (value) => typeof value === 'string' && SLUG.test(value) && !value.includes('..');

/** Accept only calendar-valid ISO timestamps with an explicit timezone. */
export function parseTimestamp(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match) return null;
  const time = Date.parse(value);
  const day = new Date(`${match[1]}T00:00:00Z`);
  if (!Number.isFinite(time) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== match[1]) return null;
  return time;
}

function normalizeTimestamp(value) {
  const time = parseTimestamp(value);
  return time === null ? null : new Date(time).toISOString();
}

export function parseManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.providers)) {
    throw new TypeError('Unsupported submissions manifest');
  }
  const seenProviders = new Set();
  const seenEntries = new Set();
  const entries = [];
  const providers = manifest.providers.map((provider) => {
    if (!provider || !validSlug(provider.slug) || !validText(provider.name) || !Array.isArray(provider.models) || seenProviders.has(provider.slug)) {
      throw new TypeError('Invalid or duplicate provider');
    }
    seenProviders.add(provider.slug);
    const company = {
      slug: provider.slug,
      name: provider.name.trim(),
      code: provider.slug.toUpperCase(),
      mark: [...provider.name.trim()][0].toUpperCase(),
      // Treat optional styling as data, never as arbitrary CSS.
      accent: /^#[\da-f]{6}$/i.test(provider.accent ?? '') ? provider.accent : '#c2f78c',
      count: provider.models.length,
    };
    for (const model of provider.models) {
      const id = `${company.slug}/${model?.slug}`;
      if (!model || !validSlug(model.slug) || !validText(model.name) || !validText(model.title) || ![0, 1].includes(model.protocolVersion) || model.path !== `./${id}/` || !IMAGE.test(model.image ?? '') || seenEntries.has(id)) {
        throw new TypeError('Invalid or duplicate model');
      }
      seenEntries.add(id);
      entries.push({
        id, provider: company, slug: model.slug, name: model.name.trim(),
        title: model.title.trim(), protocolVersion: model.protocolVersion,
        path: model.path, image: model.image, index: entries.length,
        // Optional to remain compatible with older deployed manifests.
        testedAt: normalizeTimestamp(model.testedAt),
        submittedAt: normalizeTimestamp(model.submittedAt),
      });
    }
    return company;
  });
  return { providers, entries };
}

export function readState(search, savedView = 'grid') {
  const params = new URLSearchParams(search);
  return {
    q: (params.get('q') ?? '').slice(0, 200),
    provider: params.get('provider') ?? 'all',
    protocol: PROTOCOLS.has(params.get('protocol')) ? params.get('protocol') : 'all',
    sort: SORTS.has(params.get('sort')) ? params.get('sort') : 'default',
    view: VIEWS.has(params.get('view')) ? params.get('view') : VIEWS.has(savedView) ? savedView : 'grid',
  };
}

export function normalizeState(state, providers) {
  return {
    q: typeof state.q === 'string' ? state.q.slice(0, 200) : '',
    provider: providers.some((p) => p.slug === state.provider) ? state.provider : 'all',
    protocol: PROTOCOLS.has(state.protocol) ? state.protocol : 'all',
    sort: SORTS.has(state.sort) ? state.sort : 'default',
    view: VIEWS.has(state.view) ? state.view : 'grid',
  };
}

export function stateUrl(currentUrl, state) {
  const url = new URL(currentUrl);
  const defaults = { q: '', provider: 'all', protocol: 'all', sort: 'default', view: 'grid' };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (state[key] === defaultValue) url.searchParams.delete(key);
    else url.searchParams.set(key, state[key]);
  }
  return url;
}

const normalizeSearch = (value) => value.normalize('NFKC').toLocaleLowerCase().trim();
export function filterEntries(entries, state) {
  const terms = normalizeSearch(state.q).split(/\s+/).filter(Boolean);
  const filtered = entries.filter((entry) => {
    if (state.provider !== 'all' && entry.provider.slug !== state.provider) return false;
    if (state.protocol !== 'all' && entry.protocolVersion !== Number(state.protocol)) return false;
    const searchable = normalizeSearch(`${entry.name} ${entry.title} ${entry.slug} ${entry.provider.name} ${entry.provider.slug}`);
    return terms.every((term) => searchable.includes(term));
  });
  if (state.sort === 'default') {
    filtered.sort((a, b) => {
      const aTime = parseTimestamp(a.testedAt) ?? parseTimestamp(a.submittedAt) ?? -Infinity;
      const bTime = parseTimestamp(b.testedAt) ?? parseTimestamp(b.submittedAt) ?? -Infinity;
      // Sort across providers. Equal/unknown times retain a deterministic order.
      return bTime - aTime || a.index - b.index;
    });
  }
  if (state.sort === 'name') filtered.sort((a, b) => collator.compare(a.name, b.name) || a.index - b.index);
  if (state.sort === 'provider') filtered.sort((a, b) => collator.compare(a.provider.name, b.provider.name) || collator.compare(a.name, b.name) || a.index - b.index);
  return filtered;
}

export const sourceUrl = (entry) => `${REPOSITORY}/tree/main/${entry.id}`;
export const hasFilters = (state) => Boolean(state.q.trim() || state.provider !== 'all' || state.protocol !== 'all' || state.sort !== 'default');
export const protocolLabel = (version) => version === 1 ? '隔离 v1' : '历史 v0';
