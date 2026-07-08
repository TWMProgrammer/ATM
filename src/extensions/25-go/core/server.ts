'use strict';

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { Socket, AddressInfo } from 'net';
import WebSocket = require('ws');

import { contentTypeFor, isHtml } from './mime';
import { injectReloadClient, RELOAD_PATH } from './inject';

// ======================================
// GO LIVE — STATIC DEV SERVER | MARK: SERVER
// ======================================
//
// A lean replacement for the vendored `live-server` lib. Serves static files
// over http/https from a root directory, injects a live-reload client into
// HTML responses, and exposes reload()/reloadCss() for the file watcher to
// call. Deliberately free of any `vscode` import so it can be exercised in a
// plain Node harness.

export interface HttpsOptions {
  key: string;
  cert: string;
  passphrase?: string;
}

export interface MountRule {
  /** URL prefix, always starting with "/" (e.g. "/vendor"). */
  route: string;
  /** Absolute directory served under that prefix. */
  dir: string;
}

export interface ServerOptions {
  /** Absolute directory to serve. */
  root: string;
  host: string;
  port: number;
  https?: HttpsOptions | null;
  /** Extra response headers merged into every response. */
  headers?: Record<string, string>;
  /** Add permissive CORS headers when true. */
  cors?: boolean;
  /** Route → directory mounts resolved before the root. */
  mounts?: MountRule[];
  /** Root-relative file served for navigation 404s (single-page-app support). */
  spaFallback?: string;
}

type ReloadMessage = { type: 'reload' } | { type: 'css' };

export class LiveServer {
  private server: http.Server | https.Server | undefined;
  private readonly wss = new WebSocket.Server({ noServer: true });
  private readonly sockets = new Set<Socket>();
  private readonly root: string;

  constructor(private readonly options: ServerOptions) {
    // Normalise once so every containment check compares like-for-like.
    this.root = path.resolve(options.root);
  }

  // ------------------------------------
  // Lifecycle | MARK: LIFECYCLE
  // ------------------------------------

  /** Start listening. Resolves with the actually-bound port, rejects on bind errors (e.g. EADDRINUSE). */
  start(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const handler = (req: http.IncomingMessage, res: http.ServerResponse): void => {
        this.handleRequest(req, res).catch(() => this.fail(res, 500, 'Internal Server Error'));
      };

      const server = this.options.https
        ? https.createServer(
            {
              key: this.options.https.key,
              cert: this.options.https.cert,
              passphrase: this.options.https.passphrase,
            },
            handler
          )
        : http.createServer(handler);

      this.server = server;

      // Track live sockets so stop() can tear them down promptly — keep-alive
      // connections would otherwise hold server.close() open for seconds.
      server.on('connection', (socket) => {
        this.sockets.add(socket);
        socket.once('close', () => this.sockets.delete(socket));
      });

      server.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket as Socket, head));

      const onListenError = (err: NodeJS.ErrnoException): void => reject(err);
      server.once('error', onListenError);
      server.listen(this.options.port, this.options.host, () => {
        server.removeListener('error', onListenError);
        resolve((server.address() as AddressInfo).port);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise<void>((resolve) => {
      for (const client of this.wss.clients) {
        client.terminate();
      }
      this.wss.close();

      const server = this.server;
      if (!server) {
        resolve();
        return;
      }
      this.server = undefined;
      server.close(() => resolve());
      // Drop any lingering keep-alive connections so close() completes.
      for (const socket of this.sockets) {
        socket.destroy();
      }
      this.sockets.clear();
    });
  }

  /** Tell every connected page to reload. */
  reload(): void {
    this.broadcast({ type: 'reload' });
  }

  /** Tell every connected page to hot-swap stylesheets without a full reload. */
  reloadCss(): void {
    this.broadcast({ type: 'css' });
  }

  private broadcast(message: ReloadMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  private handleUpgrade(req: http.IncomingMessage, socket: Socket, head: Buffer): void {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    } catch {
      socket.destroy();
      return;
    }
    // Only our dedicated reload channel is accepted; anything else (e.g. an
    // app's own WebSocket) is refused rather than silently held open.
    if (pathname !== RELOAD_PATH) {
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (client) => {
      this.wss.emit('connection', client, req);
    });
  }

  // ------------------------------------
  // Request handling | MARK: REQUEST
  // ------------------------------------

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    this.applyDefaultHeaders(res);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      this.fail(res, 405, 'Method Not Allowed');
      return;
    }

    let pathname: string;
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      pathname = decodeURIComponent(pathname);
    } catch {
      this.fail(res, 400, 'Bad Request');
      return;
    }
    // Reject NUL bytes outright — a classic path-truncation trick.
    if (pathname.includes('\0')) {
      this.fail(res, 400, 'Bad Request');
      return;
    }

    const target = this.resolvePath(pathname);
    if (!target) {
      this.fail(res, 403, 'Forbidden');
      return;
    }

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(target.fsPath);
    } catch {
      await this.handleNotFound(req, res);
      return;
    }

    if (stat.isDirectory()) {
      await this.serveDirectory(req, res, target.fsPath, pathname);
      return;
    }
    await this.serveFile(req, res, target.fsPath, stat);
  }

  /**
   * Map a URL path to an absolute file-system path, honouring mounts and
   * guaranteeing the result stays inside the served root (or a mount dir).
   * Returns undefined when the path escapes its base (path traversal).
   */
  private resolvePath(pathname: string): { fsPath: string; base: string } | undefined {
    for (const mount of this.options.mounts ?? []) {
      if (pathname === mount.route || pathname.startsWith(mount.route + '/')) {
        const sub = pathname.slice(mount.route.length);
        const base = path.resolve(mount.dir);
        return this.within(base, sub);
      }
    }
    return this.within(this.root, pathname);
  }

  private within(base: string, sub: string): { fsPath: string; base: string } | undefined {
    const fsPath = path.resolve(base, '.' + path.sep + sub);
    if (fsPath !== base && !fsPath.startsWith(base + path.sep)) {
      return undefined;
    }
    return { fsPath, base };
  }

  private async handleNotFound(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const fallback = this.options.spaFallback;
    const wantsHtml = (req.headers.accept ?? '').includes('text/html');
    if (fallback && wantsHtml) {
      const resolved = this.within(this.root, '/' + fallback.replace(/^[\\/]+/, ''));
      if (resolved) {
        try {
          const stat = await fs.promises.stat(resolved.fsPath);
          if (stat.isFile()) {
            await this.serveHtml(req, res, resolved.fsPath, 200);
            return;
          }
        } catch {
          // Fall through to 404.
        }
      }
    }
    this.fail(res, 404, 'Not Found');
  }

  // ------------------------------------
  // File & directory responses | MARK: RESPONSES
  // ------------------------------------

  private async serveFile(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    fsPath: string,
    stat: fs.Stats
  ): Promise<void> {
    const ext = path.extname(fsPath);
    if (isHtml(ext)) {
      await this.serveHtml(req, res, fsPath, 200);
      return;
    }

    res.setHeader('Content-Type', contentTypeFor(ext));
    res.setHeader('Accept-Ranges', 'bytes');

    // Range request (e.g. video seeking) -> 206 Partial Content.
    const range = this.parseRange(req.headers.range, stat.size);
    if (range) {
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`);
      res.setHeader('Content-Length', String(range.end - range.start + 1));
      res.writeHead(206);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      this.pipe(res, fs.createReadStream(fsPath, { start: range.start, end: range.end }));
      return;
    }

    res.setHeader('Content-Length', String(stat.size));
    res.writeHead(200);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    this.pipe(res, fs.createReadStream(fsPath));
  }

  private pipe(res: http.ServerResponse, stream: fs.ReadStream): void {
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }

  private async serveHtml(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    fsPath: string,
    status: number
  ): Promise<void> {
    const raw = await fs.promises.readFile(fsPath, 'utf8');
    const body = Buffer.from(injectReloadClient(raw), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', String(body.byteLength));
    res.writeHead(status);
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  private async serveDirectory(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    dirPath: string,
    urlPath: string
  ): Promise<void> {
    // Directory URLs must end in "/" so relative links resolve correctly.
    if (!urlPath.endsWith('/')) {
      res.writeHead(301, { Location: encodeURI(urlPath) + '/' });
      res.end();
      return;
    }

    for (const indexName of ['index.html', 'index.htm']) {
      const indexPath = path.join(dirPath, indexName);
      try {
        if ((await fs.promises.stat(indexPath)).isFile()) {
          await this.serveHtml(req, res, indexPath, 200);
          return;
        }
      } catch {
        // No such index file — keep looking / fall back to a listing.
      }
    }

    const listing = await this.renderDirectoryListing(dirPath, urlPath);
    const body = Buffer.from(injectReloadClient(listing), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', String(body.byteLength));
    res.writeHead(200);
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  private async renderDirectoryListing(dirPath: string, urlPath: string): Promise<string> {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    entries.sort((a, b) => {
      const dirDelta = Number(b.isDirectory()) - Number(a.isDirectory());
      return dirDelta !== 0 ? dirDelta : a.name.localeCompare(b.name);
    });

    const rows = entries
      .map((entry) => {
        const slash = entry.isDirectory() ? '/' : '';
        const href = encodeURIComponent(entry.name) + slash;
        return `<li><a href="${href}">${escapeHtml(entry.name)}${slash}</a></li>`;
      })
      .join('\n');

    const parent = urlPath === '/' ? '' : '<li><a href="../">../</a></li>';

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Index of ${escapeHtml(urlPath)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 46rem; padding: 0 1rem; }
  h1 { font-size: 1.1rem; font-weight: 600; word-break: break-all; }
  ul { list-style: none; padding: 0; margin: 1rem 0 0; }
  li { padding: .15rem 0; }
  a { text-decoration: none; color: #2563eb; }
  a:hover { text-decoration: underline; }
  @media (prefers-color-scheme: dark) { a { color: #6ea8fe; } }
</style>
</head>
<body>
<h1>Index of ${escapeHtml(urlPath)}</h1>
<ul>
${parent}
${rows}
</ul>
</body>
</html>`;
  }

  // ------------------------------------
  // Helpers | MARK: HELPERS
  // ------------------------------------

  private applyDefaultHeaders(res: http.ServerResponse): void {
    // Always revalidate in a dev server so a reload never shows stale bytes.
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (this.options.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    for (const [key, value] of Object.entries(this.options.headers ?? {})) {
      res.setHeader(key, value);
    }
  }

  /** Parse a single-range `Range` header. Returns undefined when absent or unsatisfiable. */
  private parseRange(
    header: string | undefined,
    size: number
  ): { start: number; end: number } | undefined {
    if (!header) {
      return undefined;
    }
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!match || (match[1] === '' && match[2] === '')) {
      return undefined;
    }
    let start: number;
    let end: number;
    if (match[1] === '') {
      // Suffix range: last N bytes.
      const suffix = parseInt(match[2], 10);
      start = Math.max(0, size - suffix);
      end = size - 1;
    } else {
      start = parseInt(match[1], 10);
      end = match[2] === '' ? size - 1 : Math.min(parseInt(match[2], 10), size - 1);
    }
    if (start > end || start >= size) {
      return undefined;
    }
    return { start, end };
  }

  private fail(res: http.ServerResponse, status: number, message: string): void {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const body = `${status} ${message}`;
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(body);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
