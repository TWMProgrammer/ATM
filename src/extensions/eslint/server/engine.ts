import { ESLint, Linter } from 'eslint';
import {
	Diagnostic,
	DiagnosticSeverity,
	Range,
	CodeAction,
	CodeActionKind,
	TextEdit,
	WorkspaceEdit
} from 'vscode-languageserver/node';

export class EslintEngine {
	private eslint: ESLint | null = null;
	// Almacenamos los últimos mensajes por URI para poder sugerir arreglos (Code Actions)
	private lastReportedMessages: Map<string, Linter.LintMessage[]> = new Map();

	public async initialize() {
		try {
			this.eslint = new ESLint({
				fix: false, 
			});
		} catch (error) {
			console.error('[Engine] Error al inicializar ESLint:', error);
			this.eslint = null;
		}
	}

	public async lintText(text: string, filePath: string, uri: string): Promise<Diagnostic[]> {
		if (!this.eslint) {
			await this.initialize();
		}

		if (!this.eslint) {
			return [];
		}

		try {
			const results = await this.eslint.lintText(text, { filePath });
			const result = results[0];
			if (!result) {
				return [];
			}

			// Guardamos los mensajes en el caché para las Code Actions
			this.lastReportedMessages.set(uri, result.messages);

			return result.messages.map(msg => this.convertEslintMessageToDiagnostic(msg));

		} catch (error) {
			console.error('[Engine] Fallo en el linting:', error);
			return [];
		}
	}

	/**
	 * Genera sugerencias de corrección (Code Actions) basadas en el error bajo el cursor.
	 */
	public getCodeActions(uri: string, diagnostic: Diagnostic): CodeAction[] {
		const messages = this.lastReportedMessages.get(uri);
		if (!messages) {
			return [];
		}

		const actions: CodeAction[] = [];

		// Buscamos el mensaje de ESLint original que disparó este diagnóstico
		const match = messages.find(m => 
			(m.ruleId === diagnostic.code || m.ruleId === (diagnostic.code as string)) && 
			m.line - 1 === diagnostic.range.start.line &&
			m.column - 1 === diagnostic.range.start.character
		);

		if (match && match.fix) {
			const edit: TextEdit = {
				range: diagnostic.range, // Simplificación: usamos el rango del problema
				newText: match.fix.text
			};

			const workspaceEdit: WorkspaceEdit = {
				changes: {
					[uri]: [edit]
				}
			};

			actions.push({
				title: `Fix ATM: ${match.message}`,
				kind: CodeActionKind.QuickFix,
				diagnostics: [diagnostic],
				edit: workspaceEdit
			});
		}

		return actions;
	}

	private convertEslintMessageToDiagnostic(msg: Linter.LintMessage): Diagnostic {
		const startLine = Math.max(0, msg.line - 1);
		const startChar = Math.max(0, msg.column - 1);
		const endLine = msg.endLine ? Math.max(0, msg.endLine - 1) : startLine;
		const endChar = msg.endColumn ? Math.max(0, msg.endColumn - 1) : startChar + 1;

		const range: Range = {
			start: { line: startLine, character: startChar },
			end: { line: endLine, character: endChar }
		};

		return {
			range,
			message: `${msg.message} (${msg.ruleId})`,
			severity: this.mapSeverity(msg.severity),
			source: 'ESLint (ATM)',
			code: msg.ruleId || undefined
		};
	}

	private mapSeverity(eslintSeverity: number): DiagnosticSeverity {
		switch (eslintSeverity) {
			case 1: return DiagnosticSeverity.Warning;
			case 2: return DiagnosticSeverity.Error;
			default: return DiagnosticSeverity.Information;
		}
	}
}
