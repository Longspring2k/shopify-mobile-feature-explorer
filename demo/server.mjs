import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const portText = process.env.PORT ?? '4177';
if (!/^\d+$/.test(portText)) throw new Error('PORT must be an integer');
const port = Number(portText);
if (port < 1 || port > 65535) throw new Error('PORT must be from 1 to 65535');

const root = resolve(import.meta.dirname, '..');
const routes = new Map([
  ['/', ['demo/index.html', 'text/html; charset=utf-8']],
  ['/demo/app.mjs', ['demo/app.mjs', 'text/javascript; charset=utf-8']],
  ['/demo/styles.css', ['demo/styles.css', 'text/css; charset=utf-8']],
  ['/src/browser-adapter.mjs', ['src/browser-adapter.mjs', 'text/javascript; charset=utf-8']],
  ['/src/state-machine.mjs', ['src/state-machine.mjs', 'text/javascript; charset=utf-8']],
]);

const server = http.createServer(async (request, response) => {
  const route = routes.get(new URL(request.url, 'http://localhost').pathname);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!route || request.method !== 'GET') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  try {
    const body = await readFile(resolve(root, route[0]));
    response.writeHead(200, { 'Content-Type': route[1] });
    response.end(body);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Feature explorer: http://127.0.0.1:${port}/`);
});
