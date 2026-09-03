import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const site = join(root, 'site');
const ignoredDirectories = new Set(['.git', '.github', 'node_modules', 'output', 'pages', 'scripts', 'site']);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const projects = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !ignoredDirectories.has(entry.name))
  .flatMap((entry) => {
    if (existsSync(join(root, entry.name, 'package.json'))) {
      return [
        {
          path: entry.name,
          provider: entry.name,
          model: null,
          screenshotSlug: entry.name,
        },
      ];
    }

    return readdirSync(join(root, entry.name), { withFileTypes: true })
      .filter(
        (model) =>
          model.isDirectory() &&
          existsSync(join(root, entry.name, model.name, 'package.json')),
      )
      .map((model) => ({
        path: `${entry.name}/${model.name}`,
        provider: entry.name,
        model: model.name,
        screenshotSlug: `${entry.name}-${model.name}`,
      }));
  })
  .sort((a, b) => a.path.localeCompare(b.path));

if (projects.length === 0) {
  throw new Error('No participant projects found.');
}

const rawBase = process.env.PAGES_BASE_PATH ?? `/${process.env.PAGES_REPO_NAME ?? 'ai-battle'}`;
const basePath = `/${rawBase.replace(/^\/+|\/+$/g, '')}`;

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

const screenshots = join(root, 'output', 'playwright');
if (existsSync(screenshots)) {
  mkdirSync(join(site, 'output'), { recursive: true });
  mkdirSync(join(site, 'output', 'playwright'), { recursive: true });
  for (const project of projects) {
    const screenshot = join(screenshots, `${project.screenshotSlug}.png`);
    if (existsSync(screenshot)) {
      cpSync(screenshot, join(site, 'output', 'playwright', `${project.screenshotSlug}.png`));
    }
  }
}

const landingPage = readFileSync(join(root, 'pages', 'index.html'), 'utf8');
writeFileSync(join(site, 'index.html'), landingPage);
writeFileSync(join(site, '.nojekyll'), '');
console.log(`Assembled ${projects.length} projects into ${site}`);
