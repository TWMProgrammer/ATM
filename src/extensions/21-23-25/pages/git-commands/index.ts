import * as crypto from 'crypto';
import * as fs from 'fs';
import * as vscode from 'vscode';

/* ------------------------------------------------------------------ */
/* Git command data                                                    */
/* ------------------------------------------------------------------ */

interface GitCommand {
	readonly command: string;
	readonly desc: string;
	readonly icon: string;
}

interface GitCategory {
	readonly name: string;
	readonly color: string;
	readonly icon: string;
	readonly commands: GitCommand[];
}

const GIT_CATEGORIES: GitCategory[] = [
	{
		name: 'Setup',
		color: '#a78bfa',
		icon: '⚙️',
		commands: [
			{ command: 'git init',                         desc: 'Initialize a new local repository',                   icon: '🗂️' },
			{ command: 'git clone <url>',                  desc: 'Clone a remote repository locally',                   icon: '📦' },
			{ command: 'git config --global user.name',    desc: 'Set your global username',                            icon: '👤' },
			{ command: 'git config --global user.email',   desc: 'Set your global email address',                       icon: '📧' },
		],
	},
	{
		name: 'Staging & Snapshot',
		color: '#60a5fa',
		icon: '📸',
		commands: [
			{ command: 'git status',                       desc: 'Show working tree status',                            icon: '📊' },
			{ command: 'git add .',                        desc: 'Stage all changes in the current directory',           icon: '➕' },
			{ command: 'git add <file>',                   desc: 'Stage a specific file',                               icon: '📄' },
			{ command: 'git commit -m "<message>"',        desc: 'Commit staged changes with a message',                icon: '✅' },
			{ command: 'git commit --amend',               desc: 'Modify the most recent commit',                       icon: '✏️' },
			{ command: 'git diff',                         desc: 'Show unstaged changes',                               icon: '🔍' },
			{ command: 'git diff --staged',                desc: 'Show staged changes (vs last commit)',                 icon: '🔎' },
		],
	},
	{
		name: 'Branching',
		color: '#4ade80',
		icon: '🌿',
		commands: [
			{ command: 'git branch',                       desc: 'List all local branches',                             icon: '📋' },
			{ command: 'git branch <name>',                desc: 'Create a new branch',                                 icon: '🌱' },
			{ command: 'git branch -d <name>',             desc: 'Delete a local branch (safe)',                        icon: '🗑️' },
			{ command: 'git branch -D <name>',             desc: 'Force-delete a local branch',                        icon: '💥' },
			{ command: 'git switch <name>',                desc: 'Switch to an existing branch',                        icon: '🔀' },
			{ command: 'git switch -c <name>',             desc: 'Create and switch to a new branch',                   icon: '✨' },
			{ command: 'git checkout <name>',              desc: 'Switch branches (classic syntax)',                     icon: '🔃' },
			{ command: 'git checkout -b <name>',           desc: 'Create and checkout a new branch (classic)',           icon: '🆕' },
		],
	},
	{
		name: 'Merging & Rebasing',
		color: '#f472b6',
		icon: '🔀',
		commands: [
			{ command: 'git merge <branch>',               desc: 'Merge a branch into the current branch',              icon: '🔗' },
			{ command: 'git merge --no-ff <branch>',       desc: 'Merge with a merge commit (no fast-forward)',         icon: '🔀' },
			{ command: 'git merge --abort',                desc: 'Abort an in-progress merge',                         icon: '🚫' },
			{ command: 'git rebase <branch>',              desc: 'Rebase current branch onto another',                  icon: '📐' },
			{ command: 'git rebase -i HEAD~<n>',           desc: 'Interactive rebase of last n commits',                icon: '🎛️' },
			{ command: 'git rebase --abort',               desc: 'Abort an in-progress rebase',                        icon: '🛑' },
			{ command: 'git rebase --continue',            desc: 'Continue rebase after resolving conflicts',           icon: '▶️' },
		],
	},
	{
		name: 'Remote',
		color: '#fb923c',
		icon: '🌐',
		commands: [
			{ command: 'git remote -v',                    desc: 'List all configured remotes',                         icon: '🔗' },
			{ command: 'git remote add origin <url>',      desc: 'Add a new remote named "origin"',                     icon: '➕' },
			{ command: 'git remote remove <name>',         desc: 'Remove a remote',                                     icon: '🗑️' },
			{ command: 'git fetch',                        desc: 'Download changes without merging',                    icon: '⬇️' },
			{ command: 'git fetch --all',                  desc: 'Fetch from all remotes',                              icon: '⬇️' },
			{ command: 'git pull',                         desc: 'Fetch and merge from remote',                         icon: '🔽' },
			{ command: 'git pull --rebase',                desc: 'Fetch and rebase instead of merge',                   icon: '📐' },
			{ command: 'git push',                         desc: 'Push commits to remote',                              icon: '⬆️' },
			{ command: 'git push -u origin <branch>',      desc: 'Push and set upstream tracking branch',               icon: '🚀' },
			{ command: 'git push --force-with-lease',      desc: 'Safe force push (checks remote state)',               icon: '⚡' },
		],
	},
	{
		name: 'Stash',
		color: '#facc15',
		icon: '🗃️',
		commands: [
			{ command: 'git stash',                        desc: 'Stash current working directory changes',             icon: '📦' },
			{ command: 'git stash push -m "<name>"',       desc: 'Stash with a descriptive name',                      icon: '🏷️' },
			{ command: 'git stash list',                   desc: 'List all stash entries',                              icon: '📋' },
			{ command: 'git stash pop',                    desc: 'Apply and drop the latest stash',                     icon: '📤' },
			{ command: 'git stash apply stash@{n}',        desc: 'Apply a specific stash entry',                        icon: '📥' },
			{ command: 'git stash drop stash@{n}',         desc: 'Delete a specific stash entry',                       icon: '🗑️' },
			{ command: 'git stash clear',                  desc: 'Remove all stash entries',                            icon: '🧹' },
		],
	},
	{
		name: 'History & Log',
		color: '#38bdf8',
		icon: '📜',
		commands: [
			{ command: 'git log',                          desc: 'Show commit history',                                 icon: '📜' },
			{ command: 'git log --oneline',                desc: 'Compact one-line commit log',                         icon: '📝' },
			{ command: 'git log --oneline --graph',        desc: 'ASCII branch graph with log',                         icon: '🌳' },
			{ command: 'git log -p',                       desc: 'Show commit history with diffs (patches)',             icon: '🔍' },
			{ command: 'git log --author="<name>"',        desc: 'Filter commits by author',                            icon: '👤' },
			{ command: 'git blame <file>',                 desc: 'Show who changed each line of a file',                icon: '🕵️' },
			{ command: 'git show <commit>',                desc: 'Show metadata and diff for a commit',                 icon: '🔎' },
			{ command: 'git shortlog -sn',                 desc: 'Summarize commits by author count',                   icon: '📊' },
		],
	},
	{
		name: 'Undoing',
		color: '#f87171',
		icon: '↩️',
		commands: [
			{ command: 'git restore <file>',               desc: 'Discard unstaged changes in a file',                  icon: '↩️' },
			{ command: 'git restore --staged <file>',      desc: 'Unstage a file (keep changes)',                       icon: '⏪' },
			{ command: 'git reset HEAD~1',                 desc: 'Undo last commit, keep changes staged',               icon: '⬅️' },
			{ command: 'git reset --soft HEAD~1',          desc: 'Undo last commit, keep changes staged',               icon: '🔙' },
			{ command: 'git reset --hard HEAD~1',          desc: 'Undo last commit and discard all changes',            icon: '💣' },
			{ command: 'git revert <commit>',              desc: 'Create new commit that undoes a commit',              icon: '🔄' },
			{ command: 'git clean -fd',                    desc: 'Remove untracked files and directories',              icon: '🧹' },
		],
	},
	{
		name: 'Tags',
		color: '#e879f9',
		icon: '🏷️',
		commands: [
			{ command: 'git tag',                          desc: 'List all tags',                                       icon: '🏷️' },
			{ command: 'git tag <name>',                   desc: 'Create a lightweight tag',                            icon: '🔖' },
			{ command: 'git tag -a <name> -m "<msg>"',     desc: 'Create an annotated tag with message',                icon: '📌' },
			{ command: 'git push origin <tag>',            desc: 'Push a specific tag to remote',                       icon: '⬆️' },
			{ command: 'git push origin --tags',           desc: 'Push all local tags to remote',                       icon: '🚀' },
			{ command: 'git tag -d <name>',                desc: 'Delete a local tag',                                  icon: '🗑️' },
		],
	},
	{
		name: 'Advanced',
		color: '#94a3b8',
		icon: '🛠️',
		commands: [
			{ command: 'git cherry-pick <commit>',         desc: 'Apply a commit from another branch',                  icon: '🍒' },
			{ command: 'git bisect start',                 desc: 'Start binary search for buggy commit',                icon: '🔬' },
			{ command: 'git reflog',                       desc: 'Show history of HEAD movements',                      icon: '📓' },
			{ command: 'git submodule add <url>',          desc: 'Add a submodule to the repository',                   icon: '🧩' },
			{ command: 'git worktree add <path> <branch>', desc: 'Checkout a branch in a separate directory',           icon: '🌲' },
			{ command: 'git archive --format=zip HEAD',    desc: 'Export the repo as a zip archive',                    icon: '📦' },
		],
	},
];

/* ------------------------------------------------------------------ */
/* SVG helpers                                                         */
/* ------------------------------------------------------------------ */

function buildCopySvg(): string {
	return `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.4"/>
		<path d="M11 5V3a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.4"/>
	</svg>`;
}

function buildCheckSvg(): string {
	return `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path d="M3 8l3.5 3.5L13 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>`;
}

function buildSearchSvg(): string {
	return `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="17" cy="17" r="10" stroke="currentColor" stroke-width="2.5"/>
		<path d="M25 25L36 36" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
	</svg>`;
}

/* ------------------------------------------------------------------ */
/* HTML builders                                                       */
/* ------------------------------------------------------------------ */

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCard(cmd: GitCommand): string {
	const safeCmd  = escapeHtml(cmd.command);
	const safeDesc = escapeHtml(cmd.desc);
	return `
		<div
			class="cmd-card"
			role="button"
			tabindex="0"
			data-command="${safeCmd}"
			data-desc="${safeDesc}"
			aria-label="Copy: ${safeCmd}"
		>
			<span class="cmd-icon" aria-hidden="true">${cmd.icon}</span>
			<div class="cmd-body">
				<span class="cmd-code">${safeCmd}</span>
				<span class="cmd-desc">${safeDesc}</span>
			</div>
			<span class="cmd-copy" aria-hidden="true">${buildCopySvg()}</span>
		</div>`.trim();
}

function buildCategory(cat: GitCategory): string {
	const cards  = cat.commands.map(buildCard).join('\n');
	const count  = cat.commands.length;
	const safeColor = escapeHtml(cat.color);
	return `
		<section class="category" style="--cat-color:${safeColor}">
			<div class="category-header">
				<span class="category-dot" style="background:${safeColor}"></span>
				<span class="category-name">${escapeHtml(cat.name)}</span>
				<span class="category-count">${count}</span>
			</div>
			<div class="category-grid">
				${cards}
			</div>
		</section>`.trim();
}

function buildCommandsHtml(): string {
	return GIT_CATEGORIES.map(buildCategory).join('\n');
}

/* ------------------------------------------------------------------ */
/* Webview HTML assembly                                               */
/* ------------------------------------------------------------------ */

function buildToastHtml(): string {
	return `
		<div id="git-toast" class="toast" role="status" aria-live="polite">
			<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M3 8l3.5 3.5L13 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			<span class="toast-msg">Copied!</span>
		</div>`.trim();
}

function buildNoResultsHtml(): string {
	return `
		<div id="no-results" class="no-results" role="status">
			${buildSearchSvg()}
			<span>No commands match your search</span>
		</div>`.trim();
}

/* ------------------------------------------------------------------ */
/* Webview panel                                                       */
/* ------------------------------------------------------------------ */

let panel: vscode.WebviewPanel | undefined;

export function activateGitCommands(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('atm.gitCommands.open', () => {
		if (panel) {
			panel.reveal(vscode.ViewColumn.One);
			return;
		}

		panel = vscode.window.createWebviewPanel(
			'atmGitCommands',
			'Git Commands',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-23-25', 'pages', 'git-commands', 'ui'),
					vscode.Uri.joinPath(context.extensionUri, 'dist'),
				],
			},
		);

		panel.iconPath = vscode.Uri.file(context.asAbsolutePath('src/assets/atm-logo.png'));

		panel.onDidDispose(() => { panel = undefined; });

		panel.webview.html = buildWebviewContent(context, panel.webview);

		panel.webview.onDidReceiveMessage((msg: unknown) => {
			if (msg && typeof msg === 'object') {
				const m = msg as { type?: string; command?: string };
				if (m.type === 'copy' && m.command) {
					vscode.env.clipboard.writeText(m.command);
				}
			}
		});
	});

	context.subscriptions.push(disposable);
}

function buildWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
	const uiRoot = vscode.Uri.joinPath(
		context.extensionUri,
		'src', 'extensions', '21-23-25', 'pages', 'git-commands', 'ui',
	);

	const html = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'git-commands.html').fsPath, 'utf8');
	const css  = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'git-commands.css').fsPath,  'utf8');

	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'dist', 'git-commands.js'),
	);

	const nonce = crypto.randomUUID().replace(/-/g, '');
	const csp = [
		`default-src 'none'`,
		`style-src ${webview.cspSource} 'unsafe-inline'`,
		`font-src https://fonts.gstatic.com`,
		`script-src 'nonce-${nonce}'`,
	].join('; ');

	const gitIconSvg = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
		<line x1="30" y1="18" x2="30" y2="82" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
		<path d="M30 50 C 46 50, 54 50, 70 50" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
		<circle cx="30" cy="18" r="7" fill="currentColor"/>
		<circle cx="30" cy="82" r="7" fill="currentColor"/>
		<circle cx="70" cy="50" r="7" fill="currentColor"/>
	</svg>`;

	return html
		.replace('<!-- ATM_GIT_STYLES -->',
			`<meta http-equiv="Content-Security-Policy" content="${csp}">\n\t<style>\n${css}\n\t</style>`)
		.replace('<!-- ATM_GIT_SCRIPT -->',
			`<script src="${scriptUri}" nonce="${nonce}"></script>`)
		.replace('<!-- ATM_GIT_ICON -->', gitIconSvg)
		.replace('<!-- ATM_GIT_COMMANDS -->', buildCommandsHtml() + '\n' + buildNoResultsHtml())
		.replace('<!-- ATM_GIT_TOAST -->', buildToastHtml());
}
