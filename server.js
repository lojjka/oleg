const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DOMAIN = 'example.ru';
const PORT = process.env.PORT || 3000;
const LAST_MODIFIED = '2026-09-24';
const PAGE_FILE = path.join(__dirname, 'megaOleg.html');
const PLACEHOLDER_DOMAIN = 'example.ru';

const oldAddresses = {
  '/samsung-s24-ultra': '/',
  '/s24': '/'
};

if (!fs.existsSync(PAGE_FILE)) {
  console.log('Не найден файл megaOleg.html. Положи его в одну папку с server.js');
  process.exit(1);
}

let cache = { mtime: 0, html: '', gzip: null };

function getPage() {
  const mtime = fs.statSync(PAGE_FILE).mtimeMs;
  if (mtime !== cache.mtime) {
    const html = fs.readFileSync(PAGE_FILE, 'utf8').split(PLACEHOLDER_DOMAIN).join(DOMAIN);
    cache = { mtime: mtime, html: html, gzip: zlib.gzipSync(html) };
  }
  return cache;
}

const robots = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /*?',
  '',
  'Sitemap: http://' + DOMAIN + '/sitemap.xml',
  ''
].join('\n');

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  '  <url>\n' +
  '    <loc>http://' + DOMAIN + '/</loc>\n' +
  '    <lastmod>' + LAST_MODIFIED + '</lastmod>\n' +
  '  </url>\n' +
  '</urlset>\n';

const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "frame-ancestors 'none'"
};

function redirect(res, to) {
  res.writeHead(301, { Location: to });
  res.end();
}

function send(res, status, type, body, extraHeaders) {
  const headers = Object.assign({ 'Content-Type': type }, baseHeaders, extraHeaders || {});
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer(function (req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  let urlPath = req.url.split('?')[0];
  const host = (req.headers.host || '').split(':')[0].toLowerCase();

  if (urlPath.length > 1 && urlPath.endsWith('/')) {
    urlPath = urlPath.slice(0, -1);
  }

  if (host === 'www.' + DOMAIN) {
    const known = (urlPath === '/robots.txt' || urlPath === '/sitemap.xml') ? urlPath : '/';
    redirect(res, 'http://' + DOMAIN + known);
    return;
  }

  if (urlPath === '/index.html' || urlPath === '/megaOleg.html') {
    redirect(res, '/');
    return;
  }

  if (oldAddresses[urlPath]) {
    redirect(res, oldAddresses[urlPath]);
    return;
  }

  if (urlPath === '/') {
    let page;
    try {
      page = getPage();
    } catch (e) {
      send(res, 500, 'text/plain; charset=utf-8', 'Не удалось прочитать megaOleg.html');
      return;
    }
    const acceptsGzip = String(req.headers['accept-encoding'] || '').includes('gzip');
    if (acceptsGzip) {
      send(res, 200, 'text/html; charset=utf-8', page.gzip, { 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding', 'Cache-Control': 'no-cache' });
    } else {
      send(res, 200, 'text/html; charset=utf-8', page.html, { 'Vary': 'Accept-Encoding', 'Cache-Control': 'no-cache' });
    }
    return;
  }

  if (urlPath === '/robots.txt') {
    send(res, 200, 'text/plain; charset=utf-8', robots);
    return;
  }

  if (urlPath === '/sitemap.xml') {
    send(res, 200, 'application/xml; charset=utf-8', sitemap);
    return;
  }

  send(res, 404, 'text/plain; charset=utf-8', 'Страница не найдена');
});

server.listen(PORT, function () {
  console.log('Сервер запущен: http://localhost:' + PORT);
});
