import { parseManifest, readState, normalizeState, stateUrl, filterEntries, sourceUrl, hasFilters, protocolLabel } from './catalog.mjs';

const NS = 'http://www.w3.org/2000/svg';
const VIEW_KEY = 'ai-battle:catalog-view';
function element(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}
function externalLink(className, url, label) {
  const link = element('a', className);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  if (label) link.setAttribute('aria-label', `${label}（新标签页）`);
  return link;
}
function savedView() {
  try { return localStorage.getItem(VIEW_KEY) ?? 'grid'; }
  catch { return 'grid'; }
}

/** siteBase is overridden only by the downloadable, embedded-data preview. */
export function createArena({ siteBase = new URL('.', document.baseURI).href, fetchTimeout = 12000 } = {}) {
  const get = (id) => document.getElementById(id);
  const grid = get('model-grid');
  const region = get('catalog-region');
  const providerFilters = get('provider-filters');
  const search = get('search');
  const protocol = get('protocol');
  const sort = get('sort');
  const dialog = get('detail-dialog');
  const randomLink = get('random-play');
  let catalog = { entries: [], providers: [] };
  let state = readState(location.search, savedView());
  let visible = [];
  let ready = false;
  let loader;
  let activeController;
  let requestId = 0;
  let opener;
  let toastTimer;
  let searchTimer;
  let composing = false;
  const gameUrl = (entry) => new URL(entry.path, siteBase).href;

  function notify(message) {
    clearTimeout(toastTimer);
    const toast = get('toast');
    toast.hidden = false;
    toast.textContent = message;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 6000);
  }

  function writeUrl(push = false) {
    try {
      const url = stateUrl(location.href, state);
      const metadata = { ...(history.state ?? {}), arenaView: state.view };
      if (url.href !== location.href) history[push ? 'pushState' : 'replaceState'](metadata, '', url);
      else history.replaceState(metadata, '', url);
    } catch {
      // File previews or privacy policies may deny History access. Filtering still works.
    }
  }

  function cover(entry) {
    const visual = element('div', 'card-cover');
    const art = element('div', 'cover-art');
    art.dataset.variant = String(entry.index % 4);
    art.style.setProperty('--art-color', entry.provider.accent);
    art.append(element('span', 'art-entry', `${entry.provider.code} / GENERATIVE WORLD`), element('span', 'art-word', `${entry.provider.mark}↗`), element('span', 'art-orbit'), element('span', 'art-cube'));
    const caption = element('span', 'cover-caption', '自动封面 · 非游戏截图');
    visual.append(art, caption);
    // The build generates text SVGs when screenshots are absent; render an honest
    // native procedural cover instead. Preserve real screenshots when available.
    if (!entry.image.toLowerCase().endsWith('.svg')) {
      const image = element('img');
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = 960;
      image.height = 540;
      // Keep a layout box: display:none would prevent native lazy loading.
      image.style.opacity = '0';
      image.addEventListener('load', () => {
        image.style.opacity = '1';
        caption.textContent = '作品预览';
      }, { once: true });
      image.addEventListener('error', () => image.remove(), { once: true });
      image.src = new URL(entry.image, siteBase).href;
      visual.append(image);
    }
    return visual;
  }

  function openDetail(entry, button) {
    opener = button;
    get('detail-provider').textContent = entry.provider.name;
    get('detail-title').textContent = entry.name;
    get('detail-game').textContent = entry.title;
    get('detail-protocol').textContent = entry.protocolVersion === 1 ? '隔离协议 v1 · 提交方声明' : '历史记录 v0 · 非 v1 隔离记录';
    const sortTime = entry.testedAt ?? entry.submittedAt;
    get('detail-time').textContent = sortTime
      ? `${new Date(sortTime).toLocaleString('zh-CN', { timeZone: 'UTC', hour12: false })} UTC · ${entry.testedAt ? '测试记录' : '首次提交（未记录测试时间）'}`
      : '未记录时间，排在有时间记录的作品之后';
    get('detail-path').textContent = `${entry.id}/`;
    get('detail-play').href = gameUrl(entry);
    get('detail-source').href = sourceUrl(entry);
    dialog.showModal();
  }

  function card(entry) {
    const article = element('article', 'model-card');
    article.dataset.entry = entry.id;
    const coverLink = externalLink('cover-link', gameUrl(entry));
    // A single, fully labelled primary play link is sufficient for keyboard/AT.
    coverLink.tabIndex = -1;
    coverLink.setAttribute('aria-hidden', 'true');
    coverLink.append(cover(entry));
    const body = element('div', 'card-body');
    const top = element('div', 'card-topline');
    const provider = element('span', 'provider-label');
    const mark = element('span', 'provider-mark', entry.provider.mark);
    mark.setAttribute('aria-hidden', 'true');
    provider.append(mark, document.createTextNode(entry.provider.name));
    const badge = element('span', `protocol-badge${entry.protocolVersion === 0 ? ' historical' : ''}`, protocolLabel(entry.protocolVersion));
    badge.title = entry.protocolVersion === 1 ? '按隔离协议 v1 提交；不代表性能评分或功能验收。' : '历史提交，未标记为 v1 隔离记录。';
    top.append(provider, badge);
    const actions = element('div', 'card-actions');
    const play = externalLink('play-link', gameUrl(entry), `试玩 ${entry.provider.name} ${entry.name}`);
    play.append(icon('play'), document.createTextNode('开始试玩'), icon('external'));
    const source = externalLink('icon-button card-source', sourceUrl(entry), `查看 ${entry.name} 源码`);
    source.title = '查看源码（新标签页）';
    source.append(icon('code'));
    const detail = element('button', 'detail-button', '详情');
    detail.type = 'button';
    detail.setAttribute('aria-label', `查看 ${entry.name} 详情`);
    detail.addEventListener('click', () => openDetail(entry, detail));
    actions.append(play, source, detail);
    body.append(top, element('h3', '', entry.name), element('p', 'game-title', entry.title), actions);
    article.append(coverLink, body);
    return article;
  }

  function renderProviderFilters() {
    const options = [{ slug: 'all', name: '全部作品', count: catalog.entries.length }, ...catalog.providers];
    providerFilters.replaceChildren(...options.map((provider) => {
      const button = element('button', 'filter-chip');
      button.type = 'button';
      button.dataset.provider = provider.slug;
      button.append(document.createTextNode(provider.name), element('span', 'chip-count', String(provider.count)));
      return button;
    }));
  }

  function render() {
    if (!ready) return;
    search.value = state.q;
    protocol.value = state.protocol;
    sort.value = state.sort;
    get('clear-search').hidden = !state.q;
    get('reset-filters').hidden = !hasFilters(state);
    get('grid-view').setAttribute('aria-pressed', String(state.view === 'grid'));
    get('list-view').setAttribute('aria-pressed', String(state.view === 'list'));
    providerFilters.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.provider === state.provider)));
    visible = filterEntries(catalog.entries, state);
    grid.dataset.view = state.view;
    grid.replaceChildren(...visible.map(card));
    grid.hidden = visible.length === 0;
    get('empty-state').hidden = visible.length !== 0;
    const emptyCatalog = catalog.entries.length === 0;
    get('empty-title').textContent = emptyCatalog ? '还没有收录作品' : '没有找到匹配的作品';
    get('empty-description').textContent = emptyCatalog ? '新的合规作品合并并构建后，会自动显示在这里。' : state.q.trim() ? `没有匹配「${state.q.trim()}」的作品。试试其他关键词，或清除筛选。` : '当前提供方与协议条件下没有作品，清除筛选再看看。';
    get('empty-reset').hidden = emptyCatalog;
    get('results-status').textContent = emptyCatalog ? '清单已加载，暂无作品。' : `显示 ${visible.length} / ${catalog.entries.length} 个作品`;
    randomLink.setAttribute('aria-disabled', String(visible.length === 0));
    if (visible.length) randomLink.href = gameUrl(visible[Math.floor(Math.random() * visible.length)]);
    else randomLink.removeAttribute('href');
  }

  function apply(patch, { push = true } = {}) {
    clearTimeout(searchTimer);
    state = normalizeState({ ...state, ...patch }, catalog.providers);
    render();
    writeUrl(push);
  }

  function resetFilters() {
    apply({ q: '', provider: 'all', protocol: 'all', sort: 'default' });
    search.focus({ preventScroll: true });
  }

  function setBusy(busy) {
    region.setAttribute('aria-busy', String(busy));
    document.querySelectorAll('#catalog-toolbar input, #catalog-toolbar select, #catalog-toolbar button').forEach((control) => { control.disabled = busy; });
    get('retry').disabled = busy;
  }

  async function load(loadManifest = loader) {
    if (typeof loadManifest !== 'function') throw new TypeError('A manifest loader is required');
    loader = loadManifest;
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    const id = ++requestId;
    ready = false;
    setBusy(true);
    region.dataset.state = 'loading';
    get('error-state').hidden = true;
    get('empty-state').hidden = true;
    get('reset-filters').hidden = true;
    randomLink.removeAttribute('href');
    randomLink.setAttribute('aria-disabled', 'true');
    providerFilters.replaceChildren();
    grid.hidden = false;
    grid.replaceChildren(...Array.from({ length: 3 }, () => {
      const skeleton = element('div', 'skeleton');
      skeleton.setAttribute('aria-hidden', 'true');
      return skeleton;
    }));
    get('results-status').textContent = '正在载入作品清单…';
    get('model-count').textContent = '—';
    get('provider-count').textContent = '—';
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Roster request timed out')); }, fetchTimeout);
      });
      const manifest = await Promise.race([loadManifest(controller.signal), timeout]);
      if (id !== requestId) return false;
      catalog = parseManifest(manifest);
      state = normalizeState(readState(location.search, state.view), catalog.providers);
      ready = true;
      renderProviderFilters();
      get('model-count').textContent = String(catalog.entries.length).padStart(2, '0');
      get('provider-count').textContent = String(catalog.providers.length).padStart(2, '0');
      setBusy(false);
      region.dataset.state = 'ready';
      render();
      writeUrl();
      return true;
    } catch (error) {
      if (id !== requestId) return false;
      region.setAttribute('aria-busy', 'false');
      region.dataset.state = 'error';
      grid.hidden = true;
      grid.replaceChildren();
      get('error-state').hidden = false;
      get('error-state').setAttribute('role', 'alert');
      get('results-status').textContent = '作品清单加载失败，请重试。';
      get('retry').disabled = false;
      console.warn('Unable to load submissions manifest:', error.message);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  providerFilters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-provider]');
    if (button && ready) apply({ provider: button.dataset.provider, q: search.value });
  });
  function onSearch() {
    if (composing || !ready) return;
    clearTimeout(searchTimer);
    get('clear-search').hidden = !search.value;
    searchTimer = setTimeout(() => apply({ q: search.value }, { push: false }), 120);
  }
  search.addEventListener('input', onSearch);
  search.addEventListener('compositionstart', () => { composing = true; clearTimeout(searchTimer); });
  search.addEventListener('compositionend', () => { composing = false; onSearch(); });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && search.value && !event.isComposing) {
      event.preventDefault();
      apply({ q: '' }, { push: false });
    }
  });
  get('clear-search').addEventListener('click', () => { apply({ q: '' }, { push: false }); search.focus(); });
  protocol.addEventListener('change', () => apply({ protocol: protocol.value, q: search.value }));
  sort.addEventListener('change', () => apply({ sort: sort.value, q: search.value }));
  get('reset-filters').addEventListener('click', resetFilters);
  get('empty-reset').addEventListener('click', resetFilters);
  for (const view of ['grid', 'list']) {
    get(`${view}-view`).addEventListener('click', () => {
      if (!ready) return;
      apply({ view, q: search.value });
      try { localStorage.setItem(VIEW_KEY, view); } catch { /* Optional preference only. */ }
    });
  }
  randomLink.addEventListener('click', (event) => {
    if (!ready || !visible.length) { event.preventDefault(); return; }
    const selected = visible[Math.floor(Math.random() * visible.length)];
    randomLink.href = gameUrl(selected);
    notify(`已选择 ${selected.name}，将在新标签页打开。`);
  });
  get('retry').addEventListener('click', () => load());
  get('close-detail').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((control) => control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  dialog.addEventListener('close', () => {
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    else if (ready) search.focus({ preventScroll: true });
  });
  window.addEventListener('popstate', (event) => {
    clearTimeout(searchTimer);
    if (!ready) return;
    state = normalizeState(readState(location.search, event.state?.arenaView ?? savedView()), catalog.providers);
    if (dialog.open) dialog.close();
    render();
  });
  document.addEventListener('keydown', (event) => {
    if (!ready || dialog.open || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    if (event.key === '/') { event.preventDefault(); search.focus(); }
  });
  get('copy-prompt').addEventListener('click', async () => {
    const button = get('copy-prompt');
    button.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(get('challenge-prompt').textContent.trim());
      notify('完整挑战提示词已复制。参赛前请先阅读隔离指南。');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(get('challenge-prompt'));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      notify('未能自动复制，已选中提示词，请手动复制。');
    } finally { button.disabled = false; }
  });
  return { load };
}
