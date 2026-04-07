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

const connection = createConnection(ProposedFeatures.all);
const engine = new EslintEngine((msg) => connection.console.log(msg));
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

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

documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	const filePath = URI.parse(textDocument.uri).fsPath;
	const text = textDocument.getText();

	const diagnostics = await engine.lintText(text, filePath, textDocument.uri);
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

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

documents.listen(connection);
connection.listen();
