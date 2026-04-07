import { ESLint, Linter } from 'eslint';
import * as path from 'path';
import {
	Diagnostic,
	DiagnosticSeverity,
	Range,
	CodeAction,
	CodeActionKind,
	TextEdit,
	WorkspaceEdit
} from 'vscode-languageserver/node';

type LogFn = (message: string) => void;

export class EslintEngine {
	private instances: Map<string, ESLint> = new Map();
	private lastReportedMessages: Map<string, Linter.LintMessage[]> = new Map();
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
		if (!messages) return [];

		const actions: CodeAction[] = [];

		const match = messages.find(m =>
			m.ruleId !== null &&
			String(m.ruleId) === String(diagnostic.code) &&
			m.line - 1 === diagnostic.range.start.line &&
			m.column - 1 === diagnostic.range.start.character
		);

		if (match && match.fix) {
			actions.push({
				title: `Fix ATM: ${match.message} (${match.ruleId})`,
				kind: CodeActionKind.QuickFix,
				diagnostics: [diagnostic],
				isPreferred: true,
				edit: {
					changes: {
						[uri]: [{
							range: diagnostic.range,
							newText: match.fix.text
						}]
					}
				}
			});
		}

		return actions;
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
