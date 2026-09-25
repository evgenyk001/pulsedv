// Optional local preview. The published site consists of static files in dist/.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = fileURLToPath(new URL('./dist/', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpeg':'image/jpeg', '.ttf':'font/ttf', '.webp':'image/webp', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8' };
http.createServer(async (req,res) => {
  try {
    const requestUrl = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(requestUrl.pathname).replace(/^\/pulsedv(?=\/|$)/, '') || '/';
    if(pathname.endsWith('/') && pathname!=='/')pathname+='index.html';
    // Local-only layout check. This development server is never deployed.
    const qaWidth = requestUrl.searchParams.get('qa');
    if (pathname === '/' && ['320','375','390','430','768','1440'].includes(qaWidth)) {
      const width = Number(qaWidth);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><html><head><meta charset="utf-8"><title>PULSE layout check</title></head><body style="margin:0;background:#dce0e5"><iframe title="PULSE at ${width}px" src="/?qa-content=1" style="border:0;width:${width}px;height:${width===1440?1000:1300}px;display:block;margin:0 auto;${width===1440?'transform:scale(.88);transform-origin:top left;':''}"></iframe></body></html>`);
    }
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403); return res.end('Forbidden'); }
    let data = await readFile(file);
    if (pathname === '/' && requestUrl.searchParams.get('qa-content') === '1') {
      // Touch browsers use overlay scrollbars; keep the test frame's CSS width exact.
      data = data.toString().replace('</head>', '<style>html{scrollbar-width:none}::-webkit-scrollbar{display:none}</style></head>');
    }
    res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});
    res.end(data);
  } catch { res.writeHead(404);res.end('Not found'); }
}).listen(4173,'0.0.0.0',() => console.log('PULSE.DV preview ready on port 4173'));
