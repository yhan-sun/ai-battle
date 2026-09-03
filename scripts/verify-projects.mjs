import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const rootPackagePath = join(root, 'package.json');
const rootReadmePath = join(root, 'README.md');
const pagesIndexPath = join(root, 'pages', 'index.html');
const pagesWorkflowPath = join(root, '.github', 'workflows', 'deploy-pages.yml');
const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
const rootReadme = readFileSync(rootReadmePath, 'utf8');
const pagesIndex = existsSync(pagesIndexPath) ? readFileSync(pagesIndexPath, 'utf8') : '';
const pagesWorkflow = existsSync(pagesWorkflowPath) ? readFileSync(pagesWorkflowPath, 'utf8') : '';
const failures = [];
const ignoredDirectories = new Set(['.git', '.github', 'node_modules', 'output', 'pages', 'scripts', 'site']);

function check(condition, message) {
  if (condition) {
    console.log(`PASS ${message}`);
  } else {
    failures.push(message);
    console.error(`FAIL ${message}`);
  }
}

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
          legacy: true,
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
        legacy: false,
      }));
  });

check(projects.length > 0, '至少发现一个参赛项目');
check(rootReadme.includes('## 📜 统一考验提示词'), '根 README 包含统一考验提示词');
check(rootReadme.includes('## 🤖 AI Agent 参赛流程'), '根 README 包含 AI Agent 参赛流程');
check(rootReadme.includes('npm test'), '根 README 包含仓库级自检命令');
check(existsSync(pagesIndexPath), '存在 GitHub Pages 体验入口页');
check(existsSync(pagesWorkflowPath), '存在 GitHub Pages Actions 工作流');
check(typeof rootPackage.scripts?.['build:pages'] === 'string', '根 package.json 包含 build:pages');
check(existsSync(join(root, 'scripts', 'build-pages.mjs')), '存在 Pages 构建脚本');
check(
  pagesWorkflow.includes('actions/upload-pages-artifact') && pagesWorkflow.includes('actions/deploy-pages'),
  'Pages 工作流包含构建产物上传和部署步骤',
);
check(!rootReadme.includes('anthropic/cluade-fable-5'), '根 README 不再把 Muse 归类为 Anthropic 模型');
check(!pagesIndex.includes('anthropic/cluade-fable-5'), 'Pages 入口不再把 Muse 归类为 Anthropic 模型');

for (const project of projects) {
  const { path: relativePath, provider, screenshotSlug, legacy } = project;
  const projectRoot = join(root, relativePath);
  const projectPackagePath = join(projectRoot, 'package.json');
  const projectPackage = JSON.parse(readFileSync(projectPackagePath, 'utf8'));
  const screenshotPath = join(root, 'output', 'playwright', `${screenshotSlug}.png`);
  const devScript = rootPackage.scripts?.[`dev:${provider}`] ?? '';
  const buildScript = rootPackage.scripts?.['build:all'] ?? '';

  check(existsSync(join(projectRoot, 'index.html')), `${relativePath} 有 index.html`);
  check(existsSync(join(projectRoot, 'README.md')), `${relativePath} 有 README.md`);
  check(typeof projectPackage.scripts?.dev === 'string', `${relativePath} 有 dev 脚本`);
  check(typeof projectPackage.scripts?.build === 'string', `${relativePath} 有 build 脚本`);
  check(devScript.includes(relativePath), `根 package.json 包含 dev:${provider} -> ${relativePath}`);
  check(buildScript.includes(relativePath), `build:all 包含 ${relativePath}`);
  check(rootReadme.includes(`./${relativePath}`), `根 README 链接到 ${relativePath}`);
  check(
    rootReadme.includes(`./output/playwright/${screenshotSlug}.png`),
    `根 README 引用了 ${relativePath} 的截图`,
  );
  check(
    existsSync(screenshotPath) && statSync(screenshotPath).size > 0,
    `${relativePath} 有非空实机截图`,
  );
  check(pagesIndex.includes(`./${relativePath}/`), `Pages 入口链接到 ${relativePath}`);
  check(
    pagesIndex.includes(`./output/playwright/${screenshotSlug}.png`),
    `Pages 入口引用 ${relativePath} 的截图`,
  );
  if (legacy) {
    check(relativePath === 'muse', '历史 Muse 项目保留在 muse/，不虚构模型归属');
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} 项检查失败。`);
  process.exitCode = 1;
} else {
  console.log(`\n全部 ${projects.length} 个参赛项目通过仓库级结构自检。`);
}
