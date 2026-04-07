import { ESLint, Linter } from 'eslint';
import * as path from 'path';
import {
	Diagnostic,
	DiagnosticSeverity,
	Range
} from 'vscode-languageserver/node';

export class EslintEngine {
	private eslint: ESLint | null = null;

	/**
	 * Inicializa o refresca la instancia de ESLint según la configuración.
	 */
	public async initialize() {
		try {
			// Configuramos la instancia principal de ESLint.
			// En el futuro, cargaremos opciones dinámicas desde VS Code Settings.
			this.eslint = new ESLint({
				fix: false, // Por ahora solo queremos reporte, no modificar el archivo real.
			});
		} catch (error) {
			console.error('[Engine] Error al inicializar ESLint:', error);
			this.eslint = null;
		}
	}

	/**
	 * Valida el contenido de un documento y devuelve los diagnósticos de VS Code.
	 */
	public async lintText(text: string, filePath: string): Promise<Diagnostic[]> {
		if (!this.eslint) {
			await this.initialize();
		}

		if (!this.eslint) {
			return [];
		}

		try {
			// Ejecutamos el linter sobre el texto crudo proporcionado por el LSP
			const results = await this.eslint.lintText(text, { filePath });
			
			// ESLint devuelve un array por archivo, tomamos el primero
			const result = results[0];
			if (!result) {
				return [];
			}

			// Transformamos los mensajes de ESLint al estándar Diagnostic de VS Code
			return result.messages.map(msg => this.convertEslintMessageToDiagnostic(msg));

		} catch (error) {
			// Si falla (ej. error sintáctico grave o config corrupta), enviamos un aviso
			console.error('[Engine] Fallo en el linting:', error);
			return [];
		}
	}

	/**
	 * Convierte un objeto de error de ESLint en un Diagnostic legible por VS Code.
	 */
	private convertEslintMessageToDiagnostic(msg: Linter.LintMessage): Diagnostic {
		// Ajustamos los índices: ESLint usa 1-based, LSP usa 0-based
		const startLine = Math.max(0, msg.line - 1);
		const startChar = Math.max(0, msg.column - 1);
		
		// Calculamos el final. Si el mensaje no trae una línea final, usamos la misma.
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

	/**
	 * Mapea la severidad numérica de ESLint a la constante de VS Code.
	 */
	private mapSeverity(eslintSeverity: number): DiagnosticSeverity {
		switch (eslintSeverity) {
			case 1: return DiagnosticSeverity.Warning;
			case 2: return DiagnosticSeverity.Error;
			default: return DiagnosticSeverity.Information;
		}
	}
}
