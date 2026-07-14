import * as fs from 'fs';
import * as path from 'path';
import type { FormatterConfig, ResolvedConfig } from './types';

/**
 * Resolves Prettier configuration for a given file path.
 *
 * This is a lightweight implementation that supports JSON-based config
 * files (`.prettierrc`, `.prettierrc.json`, `package.json` `prettier` key).
 * JS/TS/YAML/TOML config support can be added later by extending
 * `CONFIG_FILENAMES` and the `loadConfigFile` switch.
 *
 * Walks up from the file's directory until a config is found or the
 * workspace root is reached.
 */

const CONFIG_FILENAMES = [
	'.prettierrc',
	'.prettierrc.json',
] as const;

/** Read and parse a JSON config file, returning `null` on any error. */
function loadJsonConfig(filePath: string): FormatterConfig | null {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		return JSON.parse(content) as FormatterConfig;
	} catch {
		return null;
	}
}

/** Extract the `prettier` key from a `package.json`, or `null`. */
function loadPrettierFromPackageJson(dir: string): FormatterConfig | null {
	try {
		const pkgPath = path.join(dir, 'package.json');
		const content = fs.readFileSync(pkgPath, 'utf-8');
		const pkg = JSON.parse(content) as Record<string, unknown>;
		if (pkg.prettier && typeof pkg.prettier === 'object') {
			return pkg.prettier as FormatterConfig;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Walks up from `startDir` looking for a Prettier config file.
 * Stops at `rootDir` (inclusive).
 */
function findConfigFile(startDir: string, rootDir: string): string | null {
	let dir = startDir;
	while (true) {
		for (const name of CONFIG_FILENAMES) {
			const candidate = path.join(dir, name);
			if (fs.existsSync(candidate)) {
				return candidate;
			}
		}
		// Check package.json prettier key
		const pkgPath = path.join(dir, 'package.json');
		if (fs.existsSync(pkgPath)) {
			try {
				const content = fs.readFileSync(pkgPath, 'utf-8');
				const pkg = JSON.parse(content) as Record<string, unknown>;
				if (pkg.prettier && typeof pkg.prettier === 'object') {
					return pkgPath;
				}
			} catch {
				// ignore malformed package.json
			}
		}

		if (path.resolve(dir) === path.resolve(rootDir)) {
			break;
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			break;
		}
		dir = parent;
	}
	return null;
}

/** Load a config from a resolved path (supports .prettierrc/.json + package.json). */
function loadConfigFromPath(configPath: string): FormatterConfig | null {
	const base = path.basename(configPath);
	if (base === 'package.json') {
		const dir = path.dirname(configPath);
		return loadPrettierFromPackageJson(dir);
	}
	return loadJsonConfig(configPath);
}

/**
 * Resolve the Prettier config for a document at `filePath`, walking up
 * from the file's directory to `workspaceRoot`.
 *
 * @returns `{ config: null, configPath: null }` when no config is found.
 */
export function resolveConfigForFile(
	filePath: string,
	workspaceRoot: string,
): ResolvedConfig {
	const startDir = path.dirname(filePath);
	const configPath = findConfigFile(startDir, workspaceRoot);
	if (!configPath) {
		return { config: null, configPath: null };
	}
	const config = loadConfigFromPath(configPath);
	return { config, configPath };
}

/* ── Ignore files ──────────────────────────────────────────────────── */

/**
 * Reads the configured ignore file and `.prettierignore`, returning
 * non-comment, non-empty patterns. Returns `[]` if neither file exists.
 */
export function readIgnorePatterns(ignorePath: string, workspaceRoot: string): string[] {
	const fullPath = path.isAbsolute(ignorePath)
		? ignorePath
		: path.join(workspaceRoot, ignorePath);
	const prettierIgnorePath = path.join(workspaceRoot, '.prettierignore');
	const ignorePaths = [fullPath];
	// TODO everything: remove temporary .prettierignore support.
	if (path.resolve(fullPath) !== path.resolve(prettierIgnorePath)) {
		ignorePaths.push(prettierIgnorePath);
	}

	return ignorePaths.flatMap((filePath) => {
		try {
			const content = fs.readFileSync(filePath, 'utf-8');
			return content
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line.length > 0 && !line.startsWith('#'));
		} catch {
			return [];
		}
	});
}

/**
 * Simple gitignore-style pattern matcher.
 *
 * Supports:
 *  - Exact path matches (src/foo.ts)
 *  - Directory prefixes (src/)
 *  - Glob patterns (.ts extension globs, double-star recursive globs)
 *
 * This is a minimal implementation — not a full gitignore parser.
 * For complex patterns, consider using the "ignore" npm package in the future.
 */
export function isPathIgnored(filePath: string, workspaceRoot: string, patterns: string[]): boolean {
	const relative = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
	for (const pattern of patterns) {
		if (matchPattern(relative, pattern)) {
			return true;
		}
		// Also check the basename for simple *.ext patterns
		if (pattern.startsWith('*.') && relative.endsWith(pattern.slice(1))) {
			return true;
		}
	}
	return false;
}

function matchPattern(relative: string, pattern: string): boolean {
	// Normalize pattern
	const p = pattern.replace(/\\/g, '/');

	// Exact match
	if (relative === p) { return true; }

	// Directory prefix: "src/" matches anything under src/
	if (p.endsWith('/') && (relative.startsWith(p) || relative.startsWith(p.slice(0, -1) + '/'))) {
		return true;
	}

	// Simple glob with ** (convert to regex)
	if (p.includes('*')) {
		const regexStr = p
			.replace(/\*\*/g, '<<DBLSTAR>>')
			.replace(/\*/g, '[^/]*')
			.replace(/<<DBLSTAR>>/g, '.*')
			.replace(/\?/g, '[^/]');
		const regex = new RegExp(`^${regexStr}$`);
		if (regex.test(relative)) { return true; }
		// Also test without leading ./
		if (regex.test(relative.replace(/^\.\//, ''))) { return true; }
	}

	return false;
}
