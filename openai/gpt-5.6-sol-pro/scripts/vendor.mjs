import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const source = resolve(root, 'node_modules/three/build/three.module.min.js');
const target = resolve(root, 'src/vendor/three.module.min.js');

const sourceInfo = await stat(source).catch(() => null);
if (!sourceInfo?.isFile()) {
  const targetInfo = await stat(target).catch(() => null);
  if (targetInfo?.isFile() && targetInfo.size > 100000) {
    console.log('Using existing vendored Three.js module.');
    process.exit(0);
  }
  throw new Error('Three.js is not installed. Run npm install before starting the game.');
}

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log('Prepared Three.js r170 runtime module.');
