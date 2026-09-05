# AI Battle — Playable Arena UI/UX redesign

## Scope and baseline

Platform-maintainer work against `main@50aa26d8b73b7c65a8f458ab75e0de83c3d35be3` (2026-09-05). This is **not** an isolated competition entry. No contestant source, submission metadata, challenge requirements, isolation guide, or deployment permissions are changed.

The repository describes a showcase of playable AI-generated runner games. It does not provide verified ratings, popularity, release timestamps, performance scores, or an online-service health API. The interface must not invent those signals.

## Problem and design decision

The previous landing page required visitors to select a company before revealing any games. A large decorative hero repeated the selection process, while a narrow nested model panel constrained cards. There was no cross-provider search, optional protocol filter, model detail view, or in-place retry.

The new primary journey is **discover → play → inspect**. All entries are visible on initial load. Provider chips narrow an already useful gallery instead of unlocking it. “Start playing” is the primary card action; source and metadata are secondary. The entire landing page remains an independent, lightweight static surface.

## Information architecture

1. Header: gallery, common challenge, participation guide, repository.
2. Hero: Chinese value proposition and immediate gallery link; a labelled conceptual track illustration, not a contestant screenshot.
3. Manifest-derived counts: entries and providers, plus the single common prompt.
4. Gallery: search, provider, protocol, default/name/provider ordering, grid/list view, random entry from current results.
5. Common challenge: three evaluation themes, the unmodified complete challenge prompt, copy with manual fallback.
6. Participation: isolated-entry warning and canonical `AI_SUBMISSION_GUIDE.md` link.
7. Detail dialog: actual provider, model, game title, protocol declaration, repository path, source and play links.

## Visual system

| Token | Value | Use |
| --- | --- | --- |
| Background | `#101310` | Charcoal canvas |
| Surface | `#181d18` | Cards, controls, dialog |
| Raised surface | `#202720` | Hover and secondary surface |
| Border | `#303930` | Structural separation |
| Foreground | `#f1f5ed` | Primary text |
| Muted foreground | `#a5b09e` | Supporting text |
| Accent | `#c2f78c` | Main actions and focus indication |
| Accent foreground | `#15200c` | Text on accent buttons |
| Content width | `1240px` maximum | Desktop reading width |

Use system fonts; no hosted font or image dependency is required. Provider accents are validated six-digit hex metadata, not arbitrary CSS. Cards use existing raster screenshots when present. Missing, broken, or generated SVG covers use procedural decoration labelled **“自动封面 · 非游戏截图”**. The hero carries the same non-screenshot distinction.

Layout moves from three columns to two at 1100px, then one at 580px. On small screens, provider chips scroll within their own labelled group; list view removes decorative covers. Motion is restrained and disabled for `prefers-reduced-motion`.

## Interaction and states

Search matches provider, model name/slug, and game title, with NFKC normalization and AND matching across terms. It is debounced by 120ms, respects Chinese IME composition, and can be focused with `/` or cleared with Escape. Search, provider and protocol conditions compose. Sorting never mutates the source roster.

`q`, `provider`, `protocol`, `sort` and `view` are shareable URL parameters. Unrelated parameters and the current anchor are retained. Explicit filter changes create history entries; typing replaces the current entry. Grid/list preference uses guarded local storage; failure of storage/history does not prevent filtering. Invalid URL selections fall back to safe defaults.

The gallery differentiates loading, successful empty roster, zero filtered matches, invalid data, and network/timeout failure. Loading disables controls, exposes `aria-busy`, and reserves card space. Errors offer an in-place retry; a 12-second timeout and request identity guard prevent stale requests overwriting newer results.

Games open in separate tabs using native links with `noopener noreferrer`. The landing page does not embed or preload game engines. Random play is disabled when no result exists. No authentication, vote, fake leaderboard, or unsupported performance comparison is added.

Native dialog semantics provide background isolation and Escape dismissal. An explicit first/last Tab loop covers the tested Chromium focus edge case. Closing returns focus to the trigger. Dynamic text uses `textContent`, and model/image URLs are restricted to the existing local manifest contract. Clipboard denial selects the prompt and explains manual copying.

## Integration contract

- `pages/index.html` still performs the real `fetch("./submissions.json", ...)` call.
- `pages/assets/catalog.mjs` contains pure parsing, filtering and URL functions.
- `pages/assets/arena.mjs` owns rendering and interaction.
- `pages/assets/arena.css` owns the responsive presentation.
- `scripts/build-pages.mjs` keeps discovery, game builds, covers and manifest generation intact; its only functional addition is copying `pages/assets` to `site/assets`.
- The existing `npm test` command and participant scripts remain unchanged. `npm run test:ui` is an additional platform-only check.
- `.github/workflows/ui-checks.yml` runs platform-only checks on relevant pull requests. It does not deploy, mutate README, install contestant dependencies, or change the entrant isolation policy.
- The downloaded standalone HTML is a review artifact with an embedded index snapshot. It is **not** the production data source and must not replace `pages/index.html`.

## Verification record

Executed locally on 2026-09-05:

```sh
npm run test:ui
python scripts/test-ui-browser.py
```

- Node 22.16.0: **18 tests passed**. Includes strict manifest parsing, dotted model slugs, injection/path rejection, Chinese search, combined filters, sorting, URL/subpath behavior, auto-discovery compatibility and static-resource copy checks.
- Playwright 1.57.0 with system Chromium: **37 offline browser checks passed**. Covers initial visibility, controls, IME, dialog focus, copy fallback, retry/timeout/invalid JSON states, long metadata, reduced motion, and no page-wide horizontal overflow at 320, 375, 390, 580, 768, 1024 and 1440px.
- Browser test rendering uses the production HTML/CSS and concatenated first-party modules, with synthetic metadata loaded in memory. External navigation is blocked in the authoring environment. It deliberately does not bypass that restriction.

**Not established by these checks:** served ES module loading/MIME types, real image delivery, production `submissions.json`, browser back/forward across served documents, all contestant builds or gameplay, Safari/Firefox behavior, real-device touch behavior, Lighthouse scores, or full accessibility conformance. No production-deployment claim is made.

Browser-test dependencies are maintainer tooling only:

```sh
python -m pip install playwright==1.57.0
python -m playwright install chromium
python scripts/test-ui-browser.py
```

The test uses `CHROMIUM_PATH` when supplied, a system `chromium` if found, or Playwright's installed browser otherwise. It never needs to visit a contestant page.

## Before merge / deployment acceptance

Run the repository checks and complete site build in the full repository:

```sh
npm test
npm run test:ui
npm run install:projects
npm run build:pages
python -m http.server 8000 --directory site
```

For localhost root serving, build with `PAGES_BASE_PATH=''` so contestant bundles use root-relative paths. Otherwise serve the output under the configured repository subpath. On the served site, verify CSS/module MIME types, all manifest entries, actual cover loading, each game link, source paths, filter URL reload/back/forward, and keyboard/touch use. Test both the normal Pages repository subpath and a renamed fork.

Only merge after review and the required checks. Existing main deployment remains authoritative. A rollback is a normal revert of this platform PR, not deletion or changes to contestant projects.
