'use strict';

// ======================================
// GO LIVE — MIME TYPES | MARK: MIME
// ======================================
//
// A small, dependency-free content-type table. Live Server's original stack
// pulled `send`/`serve-index` (and their trees) just for this; a static dev
// server only needs the handful of types a browser actually requests.

const TYPES: Readonly<Record<string, string>> = {
	'.html': 'text/html',
	'.htm': 'text/html',
	'.xhtml': 'application/xhtml+xml',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.cjs': 'text/javascript',
	'.json': 'application/json',
	'.map': 'application/json',
	'.xml': 'application/xml',
	'.txt': 'text/plain',
	'.md': 'text/markdown',
	'.csv': 'text/csv',
	'.wasm': 'application/wasm',
	// Images
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.ico': 'image/x-icon',
	'.bmp': 'image/bmp',
	// Fonts
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
	'.eot': 'application/vnd.ms-fontobject',
	// Media
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.ogv': 'video/ogg',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.ogg': 'audio/ogg',
	'.flac': 'audio/flac',
	'.m4a': 'audio/mp4',
	// Documents
	'.pdf': 'application/pdf',
};

// Text types are sent with an explicit UTF-8 charset so browsers render
// non-ASCII content correctly instead of guessing the encoding.
const TEXTUAL = /^(text\/|application\/(json|xml|xhtml\+xml|javascript|wasm)|image\/svg\+xml)/;

/** Resolve a Content-Type header from a file extension (lower-cased, with dot). */
export function contentTypeFor(extname: string): string {
	const type = TYPES[extname.toLowerCase()] ?? 'application/octet-stream';
	return TEXTUAL.test(type) ? `${type}; charset=utf-8` : type;
}

/** True when the extension is an HTML document we should inject the reload client into. */
export function isHtml(extname: string): boolean {
	const ext = extname.toLowerCase();
	return ext === '.html' || ext === '.htm' || ext === '.xhtml';
}
