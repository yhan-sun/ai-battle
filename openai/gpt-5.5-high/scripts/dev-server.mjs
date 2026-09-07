import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const portArg = args.find((arg, index) => args[index - 1] === '--port') || args.find((arg) => arg.startsWith('--port='));
const hostArg = args.find((arg, index) => args[index - 1] === '--host') || args.find((arg) => arg.startsWith('--host='));
const port = Number(portArg?.includes('=') ? portArg.split('=')[1] : portArg) || Number(process.env.PORT) || 5176;
const host = hostArg?.includes('=') ? hostArg.split('=')[1] : hostArg || process.env.HOST || '127.0.0.1';
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8']
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = normalize(join(root, decoded === '/' ? 'index.html' : decoded));
  return target.startsWith(root) ? target : join(root, 'index.html');
}

createServer((request, response) => {
  const target = safePath(request.url || '/');
  const file = existsSync(target) && statSync(target).isFile() ? target : join(root, 'index.html');
  response.writeHead(200, { 'content-type': mime.get(extname(file)) || 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(port, host, () => {
  console.log(`星轨疾跑 dev server: http://${host}:${port}`);
});
