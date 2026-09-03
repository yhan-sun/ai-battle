import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSubmissionSlug, validateSubmissionMetadata } from './lib/submission-metadata.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = process.argv[2]?.replace(/^\.\//, '').replace(/\/$/, '');

if (!target || target.split('/').length !== 2) {
  console.error('Usage: node scripts/verify-submission.mjs <provider>/<model-slug>');
  process.exit(1);
}

const [provider, model] = target.split('/');
if (!isSubmissionSlug(provider) || !isSubmissionSlug(model)) {
  console.error('Provider and model must be lowercase path slugs.');
  process.exit(1);
}

const projectRoot = join(root, target);
const metadataPath = join(projectRoot, 'submission.json');
let submission;
try {
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  submission = {
    ...validateSubmissionMetadata(metadata, { metadataPath, providerSlug: provider, modelSlug: model }),
    root: projectRoot,
  };
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
}
const failures = [];

function check(condition, message) {
  if (condition) console.log(`PASS ${message}`);
  else {
    failures.push(message);
    console.error(`FAIL ${message}`);
  }
}

const packagePath = join(submission.root, 'package.json');
const readmePath = join(submission.root, 'README.md');
const packageJson = existsSync(packagePath) ? JSON.parse(readFileSync(packagePath, 'utf8')) : {};
const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

check(submission.protocolVersion === 1, '新提交声明使用隔离参赛协议 v1');
check(existsSync(join(submission.root, 'index.html')), `${target} 有 index.html`);
check(existsSync(packagePath), `${target} 有 package.json`);
check(existsSync(readmePath), `${target} 有 README.md`);
check(typeof packageJson.scripts?.dev === 'string', `${target} 有 dev 脚本`);
check(typeof packageJson.scripts?.build === 'string', `${target} 有 build 脚本`);
check(readme.includes('## 隔离合规声明'), 'README 包含隔离合规声明');
check(readme.includes('## 自检记录'), 'README 包含自检记录');
check(
  !('playwright' in dependencies) && !('@playwright/test' in dependencies),
  '项目未安装 Playwright',
);

if (failures.length > 0) {
  console.error(`\n${failures.length} 项提交检查失败。`);
  process.exit(1);
}

console.log(`\n${target} 通过隔离提交结构检查。`);
