import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const required = [
  'index.html',
  'src/main.js',
  'src/core.js',
  'src/styles.css',
  'src/vendor/three.module.min.js',
];

for (const relative of required) {
  const file = resolve(root, relative);
  const info = await stat(file).catch(() => null);
  if (!info?.isFile() || info.size === 0) throw new Error(`Missing build input: ${relative}`);
}

const index = await readFile(resolve(root, 'index.html'), 'utf8');
if (!index.includes('src/main.js')) throw new Error('index.html must load src/main.js');
const main = await readFile(resolve(root, 'src/main.js'), 'utf8');
if (!main.includes("./vendor/three.module.min.js")) throw new Error('main.js must use the local Three.js module');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(resolve(root, 'index.html'), resolve(dist, 'index.html'));
await cp(resolve(root, 'src'), resolve(dist, 'src'), { recursive: true });
await writeFile(resolve(dist, 'build-meta.json'), `${JSON.stringify({ title: 'LUMEN TIDE', builtAt: new Date().toISOString() }, null, 2)}\n`);
console.log('Built LUMEN TIDE into dist/');
