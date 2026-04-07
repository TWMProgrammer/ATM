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

type EslintFix = {
	range: [number, number];
	text: string;
};

type CodeActionOptions = {
	includeSuggestions?: boolean;
};

export class EslintEngine {
	private instances: Map<string, ESLint> = new Map();
	private documentVersion: Map<string, number> = new Map();
	private lastDocumentText: Map<string, string> = new Map();
	private log: LogFn;

	constructor(log: LogFn) {
		this.log = log;
	}

	private getOrCreateInstance(cwd: string): ESLint {
		let instance = this.instances.get(cwd);
		if (!instance) {
			// Initialize ESLint focused on the directory where the file is located
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

	public async lintText(text: string, filePath: string, uri: string): Promise<Diagnostic[]> {
		try {
			const cwd = path.dirname(filePath);
			const eslint = this.getOrCreateInstance(cwd);

			const results = await eslint.lintText(text, { filePath });
			const result = results[0];
			if (!result) {
				this.clearDocumentData(uri);
				return [];
			}

			const version = (this.documentVersion.get(uri) ?? 0) + 1;
			this.documentVersion.set(uri, version);
			this.lastDocumentText.set(uri, text);
			const directFixCount = result.messages.reduce((total, message) => total + (message.fix ? 1 : 0), 0);
			const suggestionCount = result.messages.reduce((total, message) => total + (message.suggestions?.length ?? 0), 0);

			this.log(
				`[Engine] Linted ${path.basename(filePath)}: ${result.messages.length} issues found (${directFixCount} direct fixes, ${suggestionCount} suggestions).`
			);
			return result.messages.map(msg => this.convertToDiagnostic(msg, uri));

		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.log(`[Engine] Lint failed for ${filePath}: ${errorMessage}`);

			const cwd = path.dirname(filePath);
			this.instances.delete(cwd);
			this.clearDocumentData(uri);

			return [];
		}
	}

	public getCodeActions(uri: string, diagnostic: Diagnostic, options: CodeActionOptions = {}): CodeAction[] {
		const includeSuggestions = options.includeSuggestions ?? true;
		const text = this.lastDocumentText.get(uri);
		const data = diagnostic.data as { fix?: EslintFix; suggestions?: { desc: string; fix: EslintFix }[]; textVersion?: number } | undefined;

		if (!text || !data) {
			return [];
		}

		// Prevent applying stale fixes from a previous lint pass
		const currentVersion = this.documentVersion.get(uri);
		if (data.textVersion !== undefined && data.textVersion !== currentVersion) {
			return [];
		}

		const actions: CodeAction[] = [];
		let hasPreferred = false;
		const ruleId = diagnostic.code ? String(diagnostic.code) : null;

		if (data.fix) {
			const edit = this.buildEditFromFix(uri, text, data.fix);
			if (edit) {
				actions.push({
					title: this.buildFixTitle(ruleId),
					kind: CodeActionKind.QuickFix,
					diagnostics: [diagnostic],
					isPreferred: true,
					edit
				});
				hasPreferred = true;
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
					isPreferred: !hasPreferred,
					edit
				});

				hasPreferred = true;
			}
		}

		return actions;
	}

	private buildEditFromFix(uri: string, text: string, fix: EslintFix): WorkspaceEdit | undefined {
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

	private buildFixTitle(ruleId: string | null | undefined): string {
		if (!ruleId) {
			return 'ESLint: Apply auto-fix';
		}

		return `ESLint: Apply auto-fix (${ruleId})`;
	}

	private buildSuggestionTitle(description: string, ruleId: string | null | undefined): string {
		if (!ruleId) {
			return `ESLint: ${description}`;
		}

		return `ESLint: ${description} (${ruleId})`;
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
		const startLine = Math.max(0, msg.line - 1);
		const startChar = Math.max(0, msg.column - 1);
		const endLine = msg.endLine ? Math.max(0, msg.endLine - 1) : startLine;
		const endChar = msg.endColumn ? Math.max(0, msg.endColumn - 1) : startChar + 1;

		return {
			range: {
				start: { line: startLine, character: startChar },
				end: { line: endLine, character: endChar }
			},
			message: `${msg.message} (${msg.ruleId})`,
			severity: this.mapSeverity(msg.severity),
			source: 'ESLint (ATM)',
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
