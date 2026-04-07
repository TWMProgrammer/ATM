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

export class EslintEngine {
	private instances: Map<string, ESLint> = new Map();
	private lastReportedMessages: Map<string, Linter.LintMessage[]> = new Map();
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

	public async lintText(text: string, filePath: string, uri: string): Promise<Diagnostic[]> {
		try {
			const cwd = path.dirname(filePath);
			const eslint = this.getOrCreateInstance(cwd);

			const results = await eslint.lintText(text, { filePath });
			const result = results[0];
			if (!result) return [];

			this.lastReportedMessages.set(uri, result.messages);
			this.lastDocumentText.set(uri, text);

			this.log(`[Engine] Linted ${path.basename(filePath)}: ${result.messages.length} issues found.`);
			return result.messages.map(msg => this.convertToDiagnostic(msg));

		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.log(`[Engine] Lint failed for ${filePath}: ${errorMessage}`);

			const cwd = path.dirname(filePath);
			this.instances.delete(cwd);

			return [];
		}
	}

	public getCodeActions(uri: string, diagnostic: Diagnostic): CodeAction[] {
		const messages = this.lastReportedMessages.get(uri);
		const text = this.lastDocumentText.get(uri);
		if (!messages || !text) return [];

		const actions: CodeAction[] = [];

		const match = messages.find(m =>
			m.ruleId !== null &&
			String(m.ruleId) === String(diagnostic.code) &&
			m.line - 1 === diagnostic.range.start.line &&
			m.column - 1 === diagnostic.range.start.character
		);

		let hasPreferred = false;

		if (match && match.fix) {
			const edit = this.buildEditFromFix(uri, text, match.fix as EslintFix);
			if (edit) {
				actions.push({
					title: `Fix ATM: ${match.message} (${match.ruleId})`,
					kind: CodeActionKind.QuickFix,
					diagnostics: [diagnostic],
					isPreferred: true,
					edit
				});
				hasPreferred = true;
			}
		}

		for (const suggestion of match?.suggestions ?? []) {
			if (!suggestion.fix) continue;

			const edit = this.buildEditFromFix(uri, text, suggestion.fix as EslintFix);
			if (!edit) continue;

			actions.push({
				title: `Fix ATM: ${suggestion.desc} (${match?.ruleId})`,
				kind: CodeActionKind.QuickFix,
				diagnostics: [diagnostic],
				isPreferred: !hasPreferred,
				edit
			});

			hasPreferred = true;
		}

		return actions;
	}

	private buildEditFromFix(uri: string, text: string, fix: EslintFix): WorkspaceEdit | undefined {
		const [startOffset, endOffset] = fix.range;
		const range = this.toRangeFromOffsets(text, startOffset, endOffset);
		if (!range) return undefined;

		return {
			changes: {
				[uri]: [{
					range,
					newText: fix.text
				}]
			}
		};
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

	private convertToDiagnostic(msg: Linter.LintMessage): Diagnostic {
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
			code: msg.ruleId || undefined
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
