import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverSubmissions } from './lib/submissions.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const submissions = discoverSubmissions(root);

if (submissions.length === 0) throw new Error('No marked AI Battle submissions found.');

for (const submission of submissions) {
  console.log(`Building ${submission.path}`);
  execFileSync(npmCommand, ['--prefix', submission.path, 'run', 'build'], {
    cwd: root,
    stdio: 'inherit',
  });
}
