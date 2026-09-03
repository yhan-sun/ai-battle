import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const positional = args.filter((value, index) => !value.startsWith('--') && args[index - 1] !== '--host' && args[index - 1] !== '--port');
const rootArg = positional[0] ?? '.';
const hostIndex = args.indexOf('--host');
const portIndex = args.indexOf('--port');
const host = hostIndex >= 0 ? args[hostIndex + 1] : '127.0.0.1';
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT ?? 5173);
const root = resolve(process.cwd(), rootArg);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const cleaned = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolute = resolve(root, `.${cleaned.startsWith(sep) ? cleaned : sep + cleaned}`);
  return absolute.startsWith(root) ? absolute : null;
}

const server = createServer((req, res) => {
  let file = safePath(req.url ?? '/');
  if (!file) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) && !extname(file)) file = join(root, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  console.log(`LUMEN TIDE dev server: http://${host}:${port}`);
  console.log(`Serving ${root}`);
});
