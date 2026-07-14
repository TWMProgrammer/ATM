import { execFile } from 'child_process';
import * as path from 'path';

const GIT_TIMEOUT_MS = 15000;
const GIT_MAX_BUFFER = 20 * 1024 * 1024;

export type HeadFileResult =
	| { status: 'ok'; content: string }
	| { status: 'no-repository' }
	| { status: 'no-baseline' };

function runGit(cwd: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile('git', args, { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER }, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(stderr.trim() || error.message));
				return;
			}
			resolve(stdout);
		});
	});
}

export async function readHeadFile(filePath: string): Promise<HeadFileResult> {
	let repoRoot: string;
	try {
		repoRoot = (await runGit(path.dirname(filePath), ['rev-parse', '--show-toplevel'])).trim();
	} catch {
		return { status: 'no-repository' };
	}

	const relativePath = path.relative(repoRoot, filePath);
	if (path.isAbsolute(relativePath) || relativePath.startsWith(`..${path.sep}`)) {
		return { status: 'no-repository' };
	}

	try {
		const gitPath = relativePath.split(path.sep).join('/');
		return { status: 'ok', content: await runGit(repoRoot, ['show', `HEAD:${gitPath}`]) };
	} catch {
		return { status: 'no-baseline' };
	}
}
