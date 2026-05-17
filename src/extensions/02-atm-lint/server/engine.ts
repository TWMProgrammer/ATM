import { ESLint, Linter } from 'eslint';
import * as path from 'path';
import {
	Diagnostic,
	DiagnosticSeverity,
	Range,
	CodeAction,
	CodeActionKind,
	WorkspaceEdit
} from 'vscode-languageserver/node';

type LogFn = (message: string) => void;
type StatusEventFn = (status: 'ok' | 'missing-config' | 'error', message?: string) => void;

type LintFix = {
	range: [number, number];
	text: string;
};

type CodeActionOptions = {
	includeSuggestions?: boolean;
};

export class LintEngine {
	private instances: Map<string, ESLint> = new Map();
	private documentVersion: Map<string, number> = new Map();
	private lastDocumentText: Map<string, string> = new Map();
	private workspaceRoots: string[] = [];
	private log: LogFn;
	private onStatusChange?: StatusEventFn;
	private showOperationalWarnings: boolean = false;

	constructor(log: LogFn, onStatusChange?: StatusEventFn) {
		this.log = log;
		this.onStatusChange = onStatusChange;
	}

	/**
	 * Sets workspace root paths for proper cwd resolution.
	 * ESLint instances are keyed by workspace root instead of each file's directory.
	 */
	public setWorkspaceRoots(roots: string[]): void {
		this.workspaceRoots = roots;
		this.log(`[Engine] Workspace roots set: ${roots.join(', ')}`);
	}

	/**
	 * Resolves the best cwd for a given file path.
	 * Uses the closest workspace root that contains the file,
	 * falling back to the file's parent directory if no root matches.
	 */
	private resolveCwd(filePath: string): string {
		if (this.workspaceRoots.length === 0) {
			return path.dirname(filePath);
		}

		let bestRoot = '';
		let bestLength = 0;

		for (const root of this.workspaceRoots) {
			if (filePath.startsWith(root + path.sep) && root.length > bestLength) {
				bestRoot = root;
				bestLength = root.length;
			}
		}

		return bestRoot || path.dirname(filePath);
	}

	private getOrCreateInstance(cwd: string): ESLint {
		let instance = this.instances.get(cwd);
		if (!instance) {
			// Initialize ESLint focused on the workspace root
			instance = new ESLint({ fix: false, cwd });
			this.instances.set(cwd, instance);
			this.log(`[Engine] ESLint instance created for cwd: ${cwd}`);
		}
		return instance;
	}

	public resetInstances(): void {
		this.instances.clear();
		this.log('[Engine] All cached ESLint instances cleared.');
	}

	public clearDocumentData(uri: string): void {
		this.lastDocumentText.delete(uri);
		this.documentVersion.delete(uri);
	}

	public setShowOperationalWarnings(enabled: boolean): void {
		this.showOperationalWarnings = enabled;
		this.log(`[Engine] showOperationalWarnings=${enabled}`);
	}

	public async lintText(text: string, filePath: string, uri: string): Promise<Diagnostic[]> {
		try {
			const cwd = this.resolveCwd(filePath);
			const eslint = this.getOrCreateInstance(cwd);

			const results = await eslint.lintText(text, { filePath });
			const result = results[0];
			if (!result) {
				this.clearDocumentData(uri);
				return [];
			}

			const diagnosticsSourceMessages = this.showOperationalWarnings
				? result.messages
				: result.messages.filter(message => !this.isOperationalEslintMessage(message));
			const suppressedOperationalWarnings = result.messages.length - diagnosticsSourceMessages.length;
			if (suppressedOperationalWarnings > 0) {
				this.log(
					`[Engine] Suppressed ${suppressedOperationalWarnings} operational ESLint warning(s) for ${path.basename(filePath)}.`
				);
			}

			const version = (this.documentVersion.get(uri) ?? 0) + 1;
			this.documentVersion.set(uri, version);
			this.lastDocumentText.set(uri, text);
			const directFixCount = diagnosticsSourceMessages.reduce((total, message) => total + (message.fix ? 1 : 0), 0);
			const suggestionCount = diagnosticsSourceMessages.reduce((total, message) => total + (message.suggestions?.length ?? 0), 0);

			this.log(
				`[Engine] Linted ${path.basename(filePath)}: ${diagnosticsSourceMessages.length} issues found (${directFixCount} direct fixes, ${suggestionCount} suggestions).`
			);
			
			if (this.onStatusChange) {
				if (!this.showOperationalWarnings && suppressedOperationalWarnings > 0 && diagnosticsSourceMessages.length === 0) {
					this.onStatusChange('missing-config');
				} else {
					this.onStatusChange('ok');
				}
			}
			
			return diagnosticsSourceMessages.map(msg => this.convertToDiagnostic(msg, uri));

		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.log(`[Engine] Lint failed for ${filePath}: ${errorMessage}`);

			const cwd = this.resolveCwd(filePath);
			this.instances.delete(cwd);
			this.clearDocumentData(uri);

			if (this.onStatusChange) {
				if (errorMessage.includes('Could not find config file')) {
					this.onStatusChange('missing-config');
				} else {
					this.onStatusChange('error', errorMessage);
				}
			}

			return [];
		}
	}

	public getCodeActions(uri: string, diagnostic: Diagnostic, options: CodeActionOptions = {}): CodeAction[] {
		const includeSuggestions = options.includeSuggestions ?? true;
		const text = this.lastDocumentText.get(uri);
		const data = diagnostic.data as { fix?: LintFix; suggestions?: { desc: string; fix: LintFix }[]; textVersion?: number } | undefined;

		if (!text || !data) {
			return [];
		}

		// Prevent applying stale fixes from a previous lint pass
		const currentVersion = this.documentVersion.get(uri);
		if (data.textVersion !== undefined && data.textVersion !== currentVersion) {
			return [];
		}

		const actions: CodeAction[] = [];
		const ruleId = diagnostic.code ? String(diagnostic.code) : null;

		if (data.fix) {
			const edit = this.buildEditFromFix(uri, text, data.fix);
			if (edit) {
				actions.push({
					title: this.buildFixTitle(ruleId),
					kind: CodeActionKind.QuickFix,
					diagnostics: [diagnostic],
					edit
				});
			}
		}

		if (includeSuggestions && data.suggestions) {
			for (const suggestion of data.suggestions) {
				if (!suggestion.fix) {
					continue;
				}

				const edit = this.buildEditFromFix(uri, text, suggestion.fix);
				if (!edit) {
					continue;
				}

				actions.push({
					title: this.buildSuggestionTitle(suggestion.desc, ruleId),
					kind: CodeActionKind.QuickFix,
					diagnostics: [diagnostic],
					edit
				});
			}
		}

		return actions;
	}

	private buildEditFromFix(uri: string, text: string, fix: LintFix): WorkspaceEdit | undefined {
		const [startOffset, endOffset] = fix.range;
		const range = this.toRangeFromOffsets(text, startOffset, endOffset);
		if (!range) {
			return undefined;
		}

		return {
			changes: {
				[uri]: [{
					range,
					newText: fix.text
				}]
			}
		};
	}

	private getEmojiForAction(ruleId: string | null | undefined, description?: string): string {
		const rule = (ruleId || '').toLowerCase();
		const desc = (description || '').toLowerCase();

		// Eliminar / Limpiar
		if (rule.includes('unused') || rule.includes('empty') || desc.includes('remove') || desc.includes('delete')) {
			return '🗑️'; 
		}
		
		// Estilo / Formato
		if (rule.includes('quotes') || rule.includes('semi') || rule.includes('indent') || rule.includes('space') || rule.includes('comma')) {
			return '🎨';
		}

		// Estricto / Seguridad / Best Practices
		if (rule.includes('eqeqeq') || rule.includes('eval') || rule.includes('var')) {
			return '🔒';
		}

		// Modernización / Sugerencias
		if (rule.includes('prefer') || desc.includes('use')) {
			return '✨';
		}

		return '🔧';
	}

	private buildFixTitle(ruleId: string | null | undefined): string {
		const emoji = this.getEmojiForAction(ruleId);
		if (!ruleId) {
			return `Lint [${emoji}]: Apply auto-fix`;
		}

		return `Lint [${emoji}]: Apply auto-fix (${ruleId})`;
	}

	private buildSuggestionTitle(description: string, ruleId: string | null | undefined): string {
		const emoji = this.getEmojiForAction(ruleId, description);
		if (!ruleId) {
			return `Lint [${emoji}]: ${description}`;
		}

		return `Lint [${emoji}]: ${description} (${ruleId})`;
	}

	private toRangeFromOffsets(text: string, startOffset: number, endOffset: number): Range | undefined {
		if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || endOffset < startOffset) {
			return undefined;
		}

		return {
			start: this.offsetToPosition(text, startOffset),
			end: this.offsetToPosition(text, endOffset)
		};
	}

	private isOperationalEslintMessage(msg: Linter.LintMessage): boolean {
		if (msg.ruleId) {
			return false;
		}

		const normalizedMessage = (msg.message || '').toLowerCase();
		if (!normalizedMessage) {
			return false;
		}

		if (normalizedMessage.includes('file ignored because no matching configuration was supplied')) {
			return true;
		}

		if (normalizedMessage.includes('file ignored by default')) {
			return true;
		}

		if (normalizedMessage.includes('file ignored because of a matching ignore pattern')) {
			return true;
		}

		return false;
	}

	private offsetToPosition(text: string, offset: number): { line: number; character: number } {
		const safeOffset = Math.max(0, Math.min(offset, text.length));
		let line = 0;
		let character = 0;

		for (let i = 0; i < safeOffset; i++) {
			const current = text.charCodeAt(i);
			if (current === 10) {
				line += 1;
				character = 0;
				continue;
			}

			if (current !== 13) {
				character += 1;
			}
		}

		return { line, character };
	}

	private convertToDiagnostic(msg: Linter.LintMessage, uri: string): Diagnostic {
		const msgLine = typeof msg.line === 'number' ? msg.line : 1;
		const msgColumn = typeof msg.column === 'number' ? msg.column : 1;
		const startLine = Math.max(0, msgLine - 1);
		const startChar = Math.max(0, msgColumn - 1);

		const msgEndLine = typeof msg.endLine === 'number' ? msg.endLine : msgLine;
		const msgEndColumn = typeof msg.endColumn === 'number' ? msg.endColumn : msgColumn + 1;
		let endLine = Math.max(0, msgEndLine - 1);
		let endChar = Math.max(0, msgEndColumn - 1);

		if (endLine < startLine) {
			endLine = startLine;
		}
		if (endLine === startLine && endChar < startChar) {
			endChar = startChar + 1;
		}

		const messageSuffix = msg.ruleId ? ` (${msg.ruleId})` : '';

		return {
			range: {
				start: { line: startLine, character: startChar },
				end: { line: endLine, character: endChar }
			},
			message: `${msg.message}${messageSuffix}`,
			severity: this.mapSeverity(msg.severity),
			source: 'Lint (ATM)',
			code: msg.ruleId || undefined,
			data: {
				fix: msg.fix,
				suggestions: msg.suggestions,
				textVersion: this.documentVersion.get(uri)
			}
		};
	}



	private mapSeverity(severity: number): DiagnosticSeverity {
		switch (severity) {
			case 1: return DiagnosticSeverity.Warning;
			case 2: return DiagnosticSeverity.Error;
			default: return DiagnosticSeverity.Information;
		}
	}
}
