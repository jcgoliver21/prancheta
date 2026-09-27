/* Servidor estatico minimo, sem dependencias, so para desenvolvimento e testes.
   O app e um HTML unico que nao precisa de build; isso existe apenas para
   servir por http:// (assim o service worker e o manifest funcionam como em
   producao) e para o Playwright ter um baseURL.

   uso: node tools/serve.mjs [porta] */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';

    // impede escapar da raiz do repositorio
    const abs = normalize(join(ROOT, rel));
    if (!abs.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      res.writeHead(403).end('403 forbidden');
      return;
    }

    const info = await stat(abs).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 ' + rel);
      return;
    }

    const body = await readFile(abs);
    res.writeHead(200, {
      'content-type': TYPES[extname(abs).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      // sem cache: durante o desenvolvimento nao queremos arquivo velho
      'cache-control': 'no-store',
      'service-worker-allowed': '/',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('500 ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`prancheta em http://localhost:${PORT}/  (raiz: ${ROOT})`);
});
