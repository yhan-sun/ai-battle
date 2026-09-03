import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadmeModelIndex } from './lib/readme-index.mjs';
import { createPublicManifest, discoverSubmissions } from './lib/submissions.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const rootPackagePath = join(root, 'package.json');
const rootReadmePath = join(root, 'README.md');
const guidePath = join(root, 'AI_SUBMISSION_GUIDE.md');
const schemaPath = join(root, 'submission.schema.json');
const pagesIndexPath = join(root, 'pages', 'index.html');
const pagesWorkflowPath = join(root, '.github', 'workflows', 'deploy-pages.yml');
const buildPagesPath = join(root, 'scripts', 'build-pages.mjs');
const syncReadmePath = join(root, 'scripts', 'sync-readme.mjs');
const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
const rootReadme = readFileSync(rootReadmePath, 'utf8');
const guide = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const pagesIndex = existsSync(pagesIndexPath) ? readFileSync(pagesIndexPath, 'utf8') : '';
const pagesWorkflow = existsSync(pagesWorkflowPath) ? readFileSync(pagesWorkflowPath, 'utf8') : '';
const buildPages = existsSync(buildPagesPath) ? readFileSync(buildPagesPath, 'utf8') : '';
const failures = [];

function check(condition, message) {
  if (condition) console.log(`PASS ${message}`);
  else {
    failures.push(message);
    console.error(`FAIL ${message}`);
  }
}

let submissions = [];
try {
  submissions = discoverSubmissions(root);
} catch (error) {
  failures.push('submission.json 元数据可以被自动发现和解析');
  console.error(`FAIL submission.json 元数据可以被自动发现和解析\n${error.message}`);
}

check(submissions.length > 0, '至少发现一个带 submission.json 的参赛项目');
check(rootReadme.includes('## 📜 统一考验提示词'), '根 README 包含统一考验提示词');
check(rootReadme.includes('## 🤖 AI 隔离参赛指南'), '根 README 有独立的 AI 隔离参赛入口');
check(rootReadme.includes('## 🧩 如何参与'), '根 README 有如何参与入口');
check(rootReadme.includes('Pull Request') && rootReadme.includes('权限证明截图'), '根 README 说明 PR 与权限材料');
check(rootReadme.includes('./AI_SUBMISSION_GUIDE.md'), '根 README 链接完整 AI 参赛指南');
check(existsSync(guidePath), '存在 AI_SUBMISSION_GUIDE.md');
check(existsSync(schemaPath), '存在 submission.json Schema');
check(guide.includes('不得打开、读取、搜索'), 'AI 指南明确禁止查看其他选手内容');
check(guide.includes('git sparse-checkout'), 'AI 指南提供文件级 sparse checkout 隔离');
check(guide.includes('不得安装 Playwright'), 'AI 指南禁止安装 Playwright');
check(guide.includes('不得生成或提交截图'), 'AI 指南不要求生成截图');
check(guide.includes('Pull Request') && guide.includes('权限证明截图'), 'AI 指南说明 PR 与权限材料');
check(existsSync(pagesIndexPath), '存在 GitHub Pages 体验入口页');
check(existsSync(pagesWorkflowPath), '存在 GitHub Pages Actions 工作流');
check(existsSync(buildPagesPath), '存在 Pages 构建脚本');
check(existsSync(syncReadmePath), '存在 README 模型索引同步脚本');
check(existsSync(join(root, 'scripts', 'build-projects.mjs')), '存在自动项目构建脚本');
check(existsSync(join(root, 'scripts', 'install-projects.mjs')), '存在自动依赖安装脚本');
check(existsSync(join(root, 'scripts', 'verify-submission.mjs')), '存在隔离提交校验脚本');
check(
  guide.includes('scripts/lib/submission-metadata.mjs') &&
    !guide.includes('scripts/lib/submissions.mjs'),
  'AI 指南只暴露不含历史选手名单的通用校验器',
);
check(rootPackage.scripts?.test === 'node scripts/verify-projects.mjs', '根 package.json 使用仓库级校验器');
check(
  rootPackage.scripts?.['test:submission'] === 'node scripts/verify-submission.mjs',
  '根 package.json 提供隔离提交校验入口',
);
check(
  rootPackage.scripts?.['install:projects'] === 'node scripts/install-projects.mjs',
  '根 package.json 自动安装已标记项目',
);
check(
  rootPackage.scripts?.['build:all'] === 'node scripts/build-projects.mjs',
  '根 package.json 自动构建已标记项目',
);
check(
  rootPackage.scripts?.['build:pages'] === 'node scripts/build-pages.mjs',
  '根 package.json 包含自动 Pages 构建入口',
);
check(
  rootPackage.scripts?.['sync:readme'] === 'node scripts/sync-readme.mjs',
  '根 package.json 包含 README 模型索引同步入口',
);
check(pagesIndex.includes('fetch("./submissions.json"'), 'Pages 入口从生成清单读取选手');
check(!pagesIndex.includes('const companies = {'), 'Pages 入口不再硬编码公司和模型');
check(buildPages.includes("join(site, 'submissions.json')"), 'Pages 构建会生成 submissions.json');
check(buildPages.includes("join(site, 'output', 'covers')"), 'Pages 构建可生成无截图文字封面');
check(
  pagesWorkflow.includes('npm run install:projects') &&
    pagesWorkflow.includes('actions/upload-pages-artifact') &&
    pagesWorkflow.includes('actions/deploy-pages'),
  'Pages 工作流自动安装、上传并部署全部已标记项目',
);
check(
  pagesWorkflow.includes('contents: write') &&
    pagesWorkflow.includes('npm run sync:readme') &&
    pagesWorkflow.includes('git push origin HEAD:main'),
  'Pages 工作流会自动同步并提交 README 模型索引',
);
check(!rootReadme.includes('anthropic/cluade-fable-5'), '根 README 未把 Meta 作品误归为 Anthropic');
check(!pagesIndex.includes('anthropic/cluade-fable-5'), 'Pages 入口未把 Meta 作品误归为 Anthropic');

if (submissions.length > 0) {
  check(
    rootReadme.includes(createReadmeModelIndex(submissions)),
    'README 模型索引包含全部已标记模型',
  );
}

for (const submission of submissions) {
  const projectPackagePath = join(submission.root, 'package.json');
  const readmePath = join(submission.root, 'README.md');
  const projectPackage = existsSync(projectPackagePath)
    ? JSON.parse(readFileSync(projectPackagePath, 'utf8'))
    : {};
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';
  const dependencies = { ...projectPackage.dependencies, ...projectPackage.devDependencies };

  check(existsSync(join(submission.root, 'submission.json')), `${submission.path} 有自动收录元数据`);
  check(existsSync(join(submission.root, 'index.html')), `${submission.path} 有 index.html`);
  check(existsSync(projectPackagePath), `${submission.path} 有 package.json`);
  check(existsSync(readmePath), `${submission.path} 有 README.md`);
  check(typeof projectPackage.scripts?.dev === 'string', `${submission.path} 有 dev 脚本`);
  check(typeof projectPackage.scripts?.build === 'string', `${submission.path} 有 build 脚本`);

  if (submission.protocolVersion === 1) {
    check(existsSync(join(submission.root, 'package-lock.json')), `${submission.path} 有 package-lock.json`);
    check(readme.includes('## 隔离合规声明'), `${submission.path} README 有隔离合规声明`);
    check(readme.includes('## 自检记录'), `${submission.path} README 有自检记录`);
    check(
      !('playwright' in dependencies) && !('@playwright/test' in dependencies),
      `${submission.path} 未安装 Playwright`,
    );
  }
}

if (submissions.length > 0) {
  try {
    const manifest = createPublicManifest(submissions);
    const modelCount = manifest.providers.reduce((sum, provider) => sum + provider.models.length, 0);
    check(modelCount === submissions.length, '公开清单包含全部已标记模型');
    check(manifest.providers.every((provider) => provider.models.length > 0), '公开清单按公司分组模型');
    check(
      manifest.providers.every((provider) =>
        provider.models.every((model) => [0, 1].includes(model.protocolVersion)),
      ),
      '公开清单标记每个作品的隔离协议版本',
    );
  } catch (error) {
    failures.push('公开清单可以生成');
    console.error(`FAIL 公开清单可以生成\n${error.message}`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} 项检查失败。`);
  process.exitCode = 1;
} else {
  console.log(`\n全部 ${submissions.length} 个已标记参赛项目通过仓库级结构自检。`);
}
