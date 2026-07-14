import type { CommitEmojiEntry } from './types';
import CommitEmoji from '../data';
import { loadUsageCounts, sortEmojisByUsage } from './usage';
import * as vscode from 'vscode';
import type { Repository } from './git';

export interface CommitChange {
	readonly path: string;
	readonly isNew: boolean;
}

const enum GitChangeStatus {
	IndexAdded = 1,
	IndexCopied = 4,
	Untracked = 7,
	IntentToAdd = 9,
}

const keywordMap: Record<string, string> = {
	fix: ':bug:',
	bug: ':bug:',
	issue: ':bug:',
	docs: ':memo:',
	readme: ':memo:',
	style: ':art:',
	format: ':art:',
	refactor: ':recycle:',
	clean: ':recycle:',
	test: ':white_check_mark:',
	tests: ':white_check_mark:',
	chore: ':wrench:',
	build: ':hammer_and_wrench:',
	perf: ':zap:',
	speed: ':zap:',
	wip: ':construction:',
	revert: ':rewind:',
	merge: ':twisted_rightwards_arrows:',
	deps: ':arrow_up:',
	security: ':lock:',
	init: ':unicorn:',
	deploy: ':rocket:',
	ui: ':lipstick:',
	ux: ':children_crossing:',
	seo: ':mag:',
	types: ':label:',
	config: ':wrench:',
};

const releaseKeyword = /\b(?:bump|deploy|publish|release|ship|tag|version|lanzar|publicar|versi[oó]n)\b/iu;
const completedKeyword = /\b(?:complete(?:d)?|done|finish(?:ed)?|finali[sz](?:e|ed)|termin(?:ar|ado)|finaliz(?:ar|ado)|complet(?:ar|ado)|listo)\b/iu;
const projectStartKeyword = /\b(?:bootstrap|init(?:ialise|ialize|ialized)?|scaffold|start(?:ed)?|nuevo proyecto|new project)\b/iu;
const releaseFile = /(?:^|\/)(?:package\.json|changelog(?:\.[^/]*)?\.md)$/iu;

function findEmojiByCode(emojis: CommitEmojiEntry[], code: string): CommitEmojiEntry | undefined {
	return emojis.find((emoji) => emoji.code === code);
}

function hasNewNestedProject(changes: CommitChange[], commitMessage: string): boolean {
	if (projectStartKeyword.test(commitMessage)) {return true;}

	const addedPaths = changes.filter((change) => change.isNew).map((change) => change.path);
	const packagePaths = addedPaths.filter((path) => /(?:^|\/)package\.json$/iu.test(path));
	const indexPaths = addedPaths.filter((path) => /(?:^|\/)index\.[cm]?[jt]sx?$/iu.test(path));

	return packagePaths.some((packagePath) => {
		const projectDirectory = packagePath.slice(0, packagePath.lastIndexOf('/') + 1);
		return projectDirectory.length > 0
			&& indexPaths.some((indexPath) => indexPath.startsWith(projectDirectory));
	});
}

/**
 * Normalizes staged and unstaged repository changes to unique files.
 */
export function getRepositoryChanges(repository: Repository): CommitChange[] {
	const changes = [
		...repository.state.indexChanges,
		...repository.state.workingTreeChanges,
		...repository.state.untrackedChanges,
	];
	const isAdded = new Set<number>([
		GitChangeStatus.IndexAdded,
		GitChangeStatus.IndexCopied,
		GitChangeStatus.Untracked,
		GitChangeStatus.IntentToAdd,
	]);
	const uniqueChanges = new Map<string, CommitChange>();

	for (const change of changes) {
		const path = change.uri.fsPath || change.uri.path;
		const existing = uniqueChanges.get(path);
		uniqueChanges.set(path, {
			path,
			isNew: (existing?.isNew ?? false) || isAdded.has(change.status),
		});
	}

	return [...uniqueChanges.values()];
}

export function getBestEmojiForCommit(
	commitMessage: string,
	context: vscode.ExtensionContext,
	customEmojis: CommitEmojiEntry[] = [],
	changes: CommitChange[] = [],
): CommitEmojiEntry | undefined {
	const allEmojis = [...CommitEmoji, ...customEmojis];
	const normalizedMessage = commitMessage.toLowerCase();
	const words = normalizedMessage.split(/[\s,.-]+/);
	const changedPaths = changes.map((change) => change.path);

	// Change-set rules are intentionally evaluated before message keywords.
	// They make automatic suggestions predictable for the common SCM workflows.
	const touchesReleaseFile = changedPaths.some((path) => releaseFile.test(path));
	if (touchesReleaseFile && releaseKeyword.test(normalizedMessage)) {
		return findEmojiByCode(allEmojis, ':seedling:');
	}

	if (hasNewNestedProject(changes, normalizedMessage)) {
		return findEmojiByCode(allEmojis, ':unicorn:');
	}

	if (completedKeyword.test(normalizedMessage)) {
		return findEmojiByCode(allEmojis, ':soccer:');
	}

	if (changes.some((change) => change.isNew)) {
		return findEmojiByCode(allEmojis, ':building_construction:');
	}

	if (changes.length > 2) {
		return findEmojiByCode(allEmojis, ':hammer_and_wrench:');
	}

	if (changes.length === 1) {
		return findEmojiByCode(allEmojis, ':wrench:');
	}

	// Message keywords remain useful when Git has no visible file changes.
	for (const word of words) {
		if (keywordMap[word]) {
			const match = findEmojiByCode(allEmojis, keywordMap[word]);
			if (match) { return match; }
		}
	}

	for (const word of words) {
		if (word.length < 3) { continue; }
		const match = allEmojis.find((e) => e.description?.toLowerCase().includes(word));
		if (match) { return match; }
	}

	const usage = loadUsageCounts(context);
	const sorted = sortEmojisByUsage(allEmojis, usage);
	if (sorted.length > 0 && usage[sorted[0].code ?? '']) {
		return sorted[0] as CommitEmojiEntry;
	}

	return findEmojiByCode(allEmojis, ':wrench:') ?? allEmojis[0];
}
