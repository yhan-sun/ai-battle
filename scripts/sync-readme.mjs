import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSubmissions } from './lib/submissions.mjs';
import { replaceReadmeModelIndex } from './lib/readme-index.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const readmePath = join(root, 'README.md');
const checkOnly = process.argv.includes('--check');
const submissions = discoverSubmissions(root);
const readme = readFileSync(readmePath, 'utf8');
const nextReadme = replaceReadmeModelIndex(readme, submissions);

if (nextReadme === readme) {
  console.log(`README model index is up to date (${submissions.length} models).`);
} else if (checkOnly) {
  console.error('README model index is out of date. Run npm run sync:readme.');
  process.exitCode = 1;
} else {
  writeFileSync(readmePath, nextReadme);
  console.log(`Updated README model index with ${submissions.length} models.`);
}
