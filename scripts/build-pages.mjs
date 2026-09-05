import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createPublicManifest, discoverSubmissions } from './lib/submissions.mjs';
import { withSubmissionTimes } from './lib/submission-times.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const site = join(root, 'site');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const projects = discoverSubmissions(root);

if (projects.length === 0) {
  throw new Error('No participant projects found.');
}

const rawBase = process.env.PAGES_BASE_PATH ?? `/${process.env.PAGES_REPO_NAME ?? 'ai-battle'}`;
const normalizedBase = rawBase.replace(/^\/+|\/+$/g, '');
const basePath = normalizedBase ? `/${normalizedBase}` : '';

for (const project of projects) {
  const projectBase = `${basePath}/${project.path}/`;
  console.log(`Building ${project.path} with base ${projectBase}`);
  execFileSync(
    npmCommand,
    ['--prefix', project.path, 'run', 'build', '--', `--base=${projectBase}`],
    { cwd: root, stdio: 'inherit' },
  );
}

rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

for (const project of projects) {
  const source = join(root, project.path, 'dist');
  const destination = join(site, project.path);
  if (!existsSync(source)) {
    throw new Error(`Missing build output: ${source}`);
  }
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]);
}

function createFallbackCover(project) {
  const provider = escapeXml(project.providerName.toUpperCase());
  const model = escapeXml(project.modelName);
  const title = escapeXml(project.title);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-label="${provider} ${model}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#090b12"/><stop offset="1" stop-color="#151b2d"/></linearGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="${project.providerAccent}" stroke-opacity=".09"/></pattern>
  </defs>
  <rect width="960" height="540" fill="url(#bg)"/><rect width="960" height="540" fill="url(#grid)"/>
  <path d="M56 72H904M56 468H904" stroke="${project.providerAccent}" stroke-opacity=".55"/>
  <text x="60" y="130" fill="${project.providerAccent}" font-family="ui-monospace,monospace" font-size="24" font-weight="700" letter-spacing="5">${provider} / PLAYABLE DEMO</text>
  <text x="56" y="278" fill="#f0f5ff" font-family="system-ui,sans-serif" font-size="72" font-weight="800">${model}</text>
  <text x="60" y="340" fill="#91a0b7" font-family="system-ui,sans-serif" font-size="28">${title}</text>
  <circle cx="850" cy="134" r="34" fill="none" stroke="${project.providerAccent}"/><path d="M836 134h28m-14-14v28" stroke="${project.providerAccent}" stroke-width="3"/>
</svg>`;
}

const screenshots = join(root, 'output', 'playwright');
const publicScreenshots = join(site, 'output', 'playwright');
const publicCovers = join(site, 'output', 'covers');
mkdirSync(publicCovers, { recursive: true });

for (const project of projects) {
  const screenshotName = `${project.screenshotSlug}.png`;
  const screenshot = join(screenshots, screenshotName);
  if (existsSync(screenshot)) {
    mkdirSync(publicScreenshots, { recursive: true });
    cpSync(screenshot, join(publicScreenshots, screenshotName));
    project.publicImage = `./output/playwright/${screenshotName}`;
  } else {
    const coverName = `${project.screenshotSlug}.svg`;
    writeFileSync(join(publicCovers, coverName), createFallbackCover(project));
    project.publicImage = `./output/covers/${coverName}`;
  }
}

const landingPage = readFileSync(join(root, 'pages', 'index.html'), 'utf8');
writeFileSync(join(site, 'index.html'), landingPage);
cpSync(join(root, 'pages', 'assets'), join(site, 'assets'), { recursive: true });
writeFileSync(
  join(site, 'submissions.json'),
  `${JSON.stringify(withSubmissionTimes(root, createPublicManifest(projects)), null, 2)}\n`,
);
writeFileSync(join(site, '.nojekyll'), '');
console.log(`Assembled ${projects.length} projects into ${site}`);
