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

import { URI } from 'vscode-uri';
import { EslintEngine } from './engine';

// Crea una conexión para el servidor utilizando Node IPC.
const connection = createConnection(ProposedFeatures.all);

// Gestor de documentos con la clase EslintEngine
const engine = new EslintEngine();
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

// 1. EL "HANDSHAKE" INICIAL
connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);

	const result: InitializeResult = {
		capabilities: {
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
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	// Inicializamos el motor después de que la conexión esté lista
	engine.initialize();
});

// 2. ESCUCHANDO CAMBIOS EN LOS ARCHIVOS
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

// 3. LA VALIDACIÓN REAL CON ESLINT
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// Obtenemos la ruta real del archivo en el sistema operativo
	const filePath = URI.parse(textDocument.uri).fsPath;
	const text = textDocument.getText();
	
	// Ejecutamos el engine real
	const diagnostics = await engine.lintText(text, filePath);

	// Enviar el listado de diagnósticos a VS Code
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// 4. ARRANQUE
documents.listen(connection);
connection.listen();
