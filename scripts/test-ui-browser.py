"""Offline browser checks for the portal, not the games or production deployment.

Requires Python 3.10+, playwright==1.57.0 and Chromium. Set CHROMIUM_PATH to
use a system browser; otherwise Playwright's installed Chromium is used.
The first-party modules are concatenated without imports/exports solely for
in-memory rendering. No remote page, contestant code or screenshot is read.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


def model(provider: str, slug: str, name: str, title: str, protocol: int = 1) -> dict:
    return {"slug": slug, "name": name, "title": title, "protocolVersion": protocol,
            "path": f"./{provider}/{slug}/", "image": f"./output/covers/{provider}-{slug}.svg"}


def fixture() -> dict:
    data = {"schemaVersion": 1, "providers": [
        {"slug": "lab-a", "name": "Alpha", "accent": "#6fe7ff", "models": [
            model("lab-a", "model-10", "Model 10", "星空疾行"),
            model("lab-a", "model-2", "Model 2", "Ocean Runner", 0)]},
        {"slug": "lab-b", "name": "Beta", "accent": "#ff8a54", "models": [
            model("lab-b", "model-3", "Model 3", "星空漂流")]},
    ]}
    data['providers'][0]['models'][0]['submittedAt'] = '2026-09-01T00:00:00Z'
    data['providers'][0]['models'][1]['submittedAt'] = '2026-09-02T00:00:00Z'
    data['providers'][1]['models'][0]['submittedAt'] = '2026-09-03T00:00:00Z'
    return data


def offline_html() -> str:
    html = (ROOT / "pages/index.html").read_text(encoding="utf-8")
    css = (ROOT / "pages/assets/arena.css").read_text(encoding="utf-8")
    catalog = (ROOT / "pages/assets/catalog.mjs").read_text(encoding="utf-8")
    app = (ROOT / "pages/assets/arena.mjs").read_text(encoding="utf-8")
    catalog = re.sub(r"^export ", "", catalog, flags=re.M)
    app = re.sub(r"^import [^\n]+\n", "", app, flags=re.M)
    app = re.sub(r"^export ", "", app, flags=re.M)
    data = json.dumps(fixture(), ensure_ascii=True).replace("<", "\\u003c")
    bootstrap = f"""
window.__fixture = {data};
window.__mode = 'success';
window.__arena = createArena({{ siteBase: 'https://example.test/fork-name/', fetchTimeout: 160 }});
window.__arena.load(async (signal) => {{
  if (window.__mode === 'error') throw new Error('HTTP 503 (simulated)');
  if (window.__mode === 'json') throw new SyntaxError('Malformed JSON (simulated)');
  if (window.__mode === 'timeout') return new Promise((resolve, reject) => {{
    signal.addEventListener('abort', () => reject(new Error('Aborted')), {{ once: true }});
  }});
  return window.__fixture;
}});
"""
    html = html.replace('<link rel="stylesheet" href="./assets/arena.css" />', f"<style>{css}</style>")
    return re.sub(r'<script type="module">[\s\S]*?</script>',
                  lambda _: '<script type="module">\n' + catalog + '\n' + app + bootstrap + '</script>', html)


def main() -> None:
    passed: list[str] = []
    errors: list[str] = []

    def check(name: str, condition: bool = True) -> None:
        if not condition:
            raise AssertionError(name)
        passed.append(name)
        print(f"PASS {name}")

    with sync_playwright() as playwright:
        executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
        options = {"headless": True}
        if executable:
            options["executable_path"] = executable
        browser = playwright.chromium.launch(**options)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        # All external resource requests are blocked by the fixture harness.
        context.route("**/*", lambda route: route.abort())
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.set_content(offline_html())
        expect(page.locator('#catalog-region')).to_have_attribute('data-state', 'ready')
        expect(page.locator('.model-card')).to_have_count(3)
        check("all models visible on first load")
        check("default sorts by descending time across providers", page.locator('.model-card h3').all_text_contents() == ['Model 3', 'Model 2', 'Model 10'])
        check("default sort label communicates newest first", page.locator('#sort option:checked').inner_text() == '时间：新 → 旧')
        check("dynamic model/provider totals", page.locator('#model-count').inner_text() == '03' and page.locator('#provider-count').inner_text() == '02')

        page.locator('[data-provider="lab-b"]').click()
        expect(page.locator('.model-card')).to_have_count(1)
        expect(page.locator('[data-provider="lab-b"]')).to_have_attribute('aria-pressed', 'true')
        check("provider selection and pressed state")
        page.locator('[data-provider="lab-a"]').click()
        check("provider filter preserves time order", page.locator('.model-card h3').all_text_contents() == ['Model 2', 'Model 10'])
        page.locator('[data-provider="lab-b"]').click()
        page.locator('#protocol').select_option('0')
        expect(page.locator('#empty-state')).to_be_visible()
        expect(page.locator('#random-play')).to_have_attribute('aria-disabled', 'true')
        check("composed filters yield recoverable empty state")
        page.locator('#empty-reset').click()
        expect(page.locator('.model-card')).to_have_count(3)
        expect(page.locator('#search')).to_be_focused()
        check("empty-state reset restores catalog and focus")
        check("reset restores default time order", page.locator('.model-card h3').all_text_contents() == ['Model 3', 'Model 2', 'Model 10'])

        page.locator('#search').fill('星空')
        expect(page.locator('.model-card')).to_have_count(2)
        page.locator('#search').press('Escape')
        expect(page.locator('.model-card')).to_have_count(3)
        check("Chinese search and Escape clear")
        page.locator('#search').evaluate("e => e.dispatchEvent(new CompositionEvent('compositionstart'))")
        page.locator('#search').fill('Ocean')
        page.wait_for_timeout(180)
        expect(page.locator('.model-card')).to_have_count(3)
        page.locator('#search').evaluate("e => e.dispatchEvent(new CompositionEvent('compositionend'))")
        expect(page.locator('.model-card')).to_have_count(1)
        check("IME composition is not interrupted by rerendering")
        page.locator('#clear-search').click()
        page.locator('#search').fill('<img src=x onerror=alert(1)>')
        expect(page.locator('#empty-state')).to_be_visible()
        check("untrusted query renders as text", page.locator('#empty-description img').count() == 0)
        page.locator('#empty-reset').click()
        page.locator('#sort').select_option('name')
        check("name sorting", page.locator('.model-card h3').all_text_contents() == ['Model 2', 'Model 3', 'Model 10'])

        page.locator('#list-view').click()
        expect(page.locator('#model-grid')).to_have_attribute('data-view', 'list')
        expect(page.locator('#list-view')).to_have_attribute('aria-pressed', 'true')
        check("list view works even when storage/history are unavailable")
        page.locator('#grid-view').click()
        page.locator('.detail-button').first.click()
        expect(page.locator('#detail-dialog')).to_be_visible()
        expect(page.locator('#close-detail')).to_be_focused()
        page.keyboard.press('Shift+Tab')
        expect(page.locator('#detail-source')).to_be_focused()
        page.keyboard.press('Tab')
        expect(page.locator('#close-detail')).to_be_focused()
        check("native modal initial focus and keyboard containment")
        check("detail identifies submission-time fallback honestly", '首次提交（未记录测试时间）' in page.locator('#detail-time').inner_text())
        page.keyboard.press('Escape')
        expect(page.locator('#detail-dialog')).not_to_be_visible()
        expect(page.locator('.detail-button').first).to_be_focused()
        check("Escape closes modal and restores trigger focus")
        page.keyboard.press('/')
        expect(page.locator('#search')).to_be_focused()
        check("slash shortcut focuses search outside inputs")
        page.locator('#search').fill('Ocean')
        expect(page.locator('.model-card')).to_have_count(1)
        page.evaluate("document.getElementById('random-play').addEventListener('click', e => e.preventDefault())")
        page.locator('#random-play').click()
        check("random action selects within current results and preserves fork subpath", page.locator('#random-play').get_attribute('href') == 'https://example.test/fork-name/lab-a/model-2/')
        page.locator('#reset-filters').click()
        check("all new-tab links isolate opener", page.evaluate("Array.from(document.querySelectorAll('a[target=_blank]')).every(a => a.relList.contains('noopener') && a.relList.contains('noreferrer'))"))
        check("all buttons have accessible labels", page.evaluate("Array.from(document.querySelectorAll('button')).every(b => (b.getAttribute('aria-label') || b.textContent).trim().length > 0)"))
        check("single page heading", page.locator('h1').count() == 1)

        page.locator('#prompt-disclosure summary').click()
        expect(page.locator('#challenge-prompt')).to_be_visible()
        page.locator('#copy-prompt').click()
        expect(page.locator('#toast')).to_be_visible()
        check("prompt copy reports success or manual-copy fallback", '复制' in page.locator('#toast').inner_text())
        page.locator('#prompt-disclosure summary').click()

        for width in [320, 375, 390, 580, 768, 1024, 1440]:
            page.set_viewport_size({"width": width, "height": 900})
            check(f"no horizontal page overflow at {width}px", page.evaluate("document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth"))
        page.set_viewport_size({"width": 320, "height": 800})
        page.locator('#list-view').click()
        check("mobile list becomes readable compact cards", page.locator('.cover-link').first.is_hidden())
        page.emulate_media(reduced_motion='reduce')
        check("reduced-motion preference honored", page.evaluate("getComputedStyle(document.documentElement).scrollBehavior === 'auto'"))
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.locator('#grid-view').click()

        page.evaluate("async () => { window.__fixture.providers[0].models[0].testedAt = '2026-09-05T00:00:00Z'; await window.__arena.load(); }")
        check("recorded retest moves older entry to front", page.locator('.model-card h3').first.inner_text() == 'Model 10')
        page.locator('.detail-button').first.click()
        check("detail distinguishes recorded test time", '测试记录' in page.locator('#detail-time').inner_text())
        page.keyboard.press('Escape')

        for mode in ['error', 'json', 'timeout']:
            page.evaluate(f"async () => {{ window.__mode = '{mode}'; await window.__arena.load(); }}")
            expect(page.locator('#catalog-region')).to_have_attribute('data-state', 'error')
            expect(page.locator('#retry')).to_be_enabled()
            expect(page.locator('#catalog-region')).to_have_attribute('aria-busy', 'false')
            check(f"{mode} failure is announced and leaves working retry")
            page.evaluate("window.__mode = 'success'")
            page.locator('#retry').click()
            expect(page.locator('#catalog-region')).to_have_attribute('data-state', 'ready')
        check("retry restores roster after each failure")
        page.evaluate("async () => { window.__fixture = { schemaVersion: 1, providers: [] }; await window.__arena.load(); }")
        expect(page.locator('#empty-title')).to_have_text('还没有收录作品')
        expect(page.locator('#error-state')).not_to_be_visible()
        check("empty deployment distinguished from transport failure")
        page.evaluate("async () => { window.__fixture = { schemaVersion: 9, providers: [] }; await window.__arena.load(); }")
        expect(page.locator('#error-state')).to_be_visible()
        check("malformed manifest produces visible error")

        data = fixture()
        data['providers'][0]['models'][0]['name'] = '<img src=x onerror=alert(1)> 超长模型名称' * 10
        data['providers'][0]['models'][0]['image'] = './output/playwright/unavailable.png'
        page.evaluate("async data => { window.__fixture = data; await window.__arena.load(); }", data)
        expect(page.locator('#catalog-region')).to_have_attribute('data-state', 'ready')
        expect(page.locator('.model-card h3 img')).to_have_count(0)
        long_entry = page.locator('.model-card[data-entry="lab-a/model-10"]')
        image = long_entry.locator('.card-cover img')
        if image.count():
            image.evaluate("image => image.dispatchEvent(new Event('error'))")
        expect(image).to_have_count(0)
        check("metadata is text-only and broken screenshots retain generated cover")
        page.set_viewport_size({"width": 320, "height": 800})
        check("long model names do not overflow mobile", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        long_entry.locator('.detail-button').click()
        check("long metadata wraps inside modal", page.locator('#detail-dialog').evaluate("d => d.scrollWidth <= d.clientWidth"))
        page.keyboard.press('Escape')
        check("no uncaught browser JavaScript exceptions", not errors)
        browser.close()
    print(f"\n{len(passed)} offline browser checks passed. Served module loading, production data and game builds are not covered.")


if __name__ == '__main__':
    main()
