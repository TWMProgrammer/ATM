import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { EslintEngine } from './engine';

// Create IPC connection
const connection = createConnection(ProposedFeatures.all);

// Create engine with logging piped to VS Code's Output panel
const engine = new EslintEngine((msg) => connection.console.log(msg));

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

// 1. HANDSHAKE
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
			codeActionProvider: true,
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: { supported: true }
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	connection.console.log('[Server] ATM ESLint Server initialized.');
});

// 2. DOCUMENT CHANGES
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

// 3. VALIDATION
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	const filePath = URI.parse(textDocument.uri).fsPath;
	const text = textDocument.getText();

	const diagnostics = await engine.lintText(text, filePath, textDocument.uri);
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// 4. CODE ACTIONS (Quick Fix lightbulb)
connection.onCodeAction((params) => {
	const actions = [];
	for (const diagnostic of params.context.diagnostics) {
		if (diagnostic.source === 'ESLint (ATM)') {
			const codeActions = engine.getCodeActions(params.textDocument.uri, diagnostic);
			actions.push(...codeActions);
		}
	}
	return actions;
});

// 5. CONFIG FILE CHANGES — clear cached ESLint instances
documents.onDidClose(() => {
	// Cleanup is handled by the engine's per-cwd cache
});

// 6. START
documents.listen(connection);
connection.listen();
