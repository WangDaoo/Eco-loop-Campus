const fs = require('fs');
const http = require('http');
const path = require('path');

const projectDir = path.resolve(__dirname, '..');
const defaultBuildDir = path.join(projectDir, 'frontend', 'eco-loop-campus-admin', 'build');
const buildDir = path.resolve(process.env.WEB_BUILD_DIR || defaultBuildDir);
const host = process.env.WEB_HOST || '127.0.0.1';
const port = Number(process.env.WEB_PORT || 3002);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function resolveRequestPath(requestUrl) {
  const parsedUrl = new URL(requestUrl, `http://${host}:${port}`);
  const decodedPath = decodeURIComponent(parsedUrl.pathname);
  const requestedPath = path.normalize(path.join(buildDir, decodedPath));

  if (!requestedPath.startsWith(buildDir)) {
    return null;
  }

  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
    return requestedPath;
  }

  return path.join(buildDir, 'index.html');
}

if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
  console.error(`[ERROR] Build folder is missing index.html: ${buildDir}`);
  console.error('[TIP] Run npm run build in frontend/eco-loop-campus-admin first.');
  process.exit(1);
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequestPath(request.url || '/');

  if (!filePath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Internal Server Error');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const isStaticAsset = filePath.includes(`${path.sep}static${path.sep}`);
    response.writeHead(200, {
      'Cache-Control': isStaticAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
    });
    response.end(content);
  });
});

server.listen(port, host, () => {
  console.log(`[OK] Eco-loop Campus web is running at http://${host}:${port}`);
  console.log(`[INFO] Serving build folder: ${buildDir}`);
});
