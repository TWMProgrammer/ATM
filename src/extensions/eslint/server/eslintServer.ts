import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// Crea una conexión para el servidor utilizando Node IPC (comunicación entre procesos).
// ProposedFeatures.all nos asegura tener todas las capacidades experimentales o últimas de LSP.
const connection = createConnection(ProposedFeatures.all);

// Crea un administrador de documentos de texto simple. Esto manejará todo el caché 
// de los archivos abiertos y nos dará eventos cuando el usuario escriba ("on change").
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

// 1. EL "HANDSHAKE" INICIAL (Apretón de manos)
// Aquí es donde el cliente le dice al servidor de qué es capaz VS Code.
connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Validamos si el editor soporte configuración de workspace
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);

	// Le respondemos al Cliente qué capacidades va a tener nuestro Servidor.
	const result: InitializeResult = {
		capabilities: {
			// Sincronización Incremental: Solo recibimos las partes del texto que cambian,
			// ahorrando muchísima memoria en archivos gigantes, en vez de todo el archivo.
			textDocumentSync: TextDocumentSyncKind.Incremental,
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Registrarnos para escuchar si el usuario cambia los 'settings' en VS Code 
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
});

// 2. ESCUCHANDO CAMBIOS EN LOS ARCHIVOS
// Este evento se dispara apenas se abre un archivo o cuando el usuario tipea algo.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

// 3. LA VALIDACIÓN (El "lint" falsificado por ahora)
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// ⚠️ AQUÍ conectaremos posteriormente `engine.ts` para que corra el verdadero ESLint.
	
	const text = textDocument.getText();
	const diagnostics: Diagnostic[] = [];
	
	// PRUEBA DE COMUNICACIÓN: Si escribimos "ATM_TEST" en un archivo soportado (ej. .ts o .js)...
	const matchIndex = text.indexOf("ATM_TEST");
	if (matchIndex !== -1) {
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning, // Lo pintará como un 'Warning' en amarillo
			range: {
				start: textDocument.positionAt(matchIndex),
				end: textDocument.positionAt(matchIndex + 8) // "ATM_TEST" tiene 8 caracteres
			},
			message: '¡Punto de control superado! El Servidor LSP de ATM está escuchando y procesando el texto.',
			source: 'ATM Linter Engine'
		};
		diagnostics.push(diagnostic);
	}

	// Enviar el listado de diagnósticos a VS Code para que lo randerice en pantalla.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// 4. ARRANQUE
// Hacemos que el administrador de documentos empiece a escuchar la conexión
documents.listen(connection);
// Y finalmente arrancamos la capa de conexión.
connection.listen();
