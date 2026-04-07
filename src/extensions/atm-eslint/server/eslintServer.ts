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
import { ATM_ESLINT_REVALIDATE_REQUEST, RevalidateOpenDocumentsResponse } from '../shared/types';

const connection = createConnection(ProposedFeatures.all);
const engine = new EslintEngine((msg) => connection.console.log(msg));
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

type AtmEslintSettings = {
	enableSuggestions: boolean;
};

const defaultSettings: AtmEslintSettings = {
	enableSuggestions: true
};

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let globalSettings: AtmEslintSettings = defaultSettings;

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
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Incremental,
				save: true
			},
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
	void refreshSettings();
	connection.console.log('[Server] ATM ESLint Server initialized.');
});

connection.onDidChangeConfiguration(() => {
	void (async () => {
		await refreshSettings();
		engine.resetInstances();
		await revalidateOpenDocuments();
	})();
});

connection.onDidChangeWatchedFiles(() => {
	engine.resetInstances();
	void revalidateOpenDocuments();
});

connection.onRequest(ATM_ESLINT_REVALIDATE_REQUEST, async (): Promise<RevalidateOpenDocumentsResponse> => {
	const revalidatedDocuments = await revalidateOpenDocuments();
	return { revalidatedDocuments };
});

documents.onDidOpen(change => {
	void validateTextDocument(change.document);
});

documents.onDidChangeContent(change => {
	void validateTextDocument(change.document);
});

documents.onDidSave(change => {
	void validateTextDocument(change.document);
});

documents.onDidClose(change => {
	engine.clearDocumentData(change.document.uri);
	connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] });
});

async function refreshSettings(): Promise<void> {
	if (!hasConfigurationCapability) {
		globalSettings = defaultSettings;
		return;
	}

	try {
		const userConfig = await connection.workspace.getConfiguration('atm.eslint') as Partial<AtmEslintSettings> | undefined;
		globalSettings = {
			enableSuggestions: userConfig?.enableSuggestions ?? defaultSettings.enableSuggestions
		};
		connection.console.log(`[Server] Settings loaded: enableSuggestions=${globalSettings.enableSuggestions}`);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		globalSettings = defaultSettings;
		connection.console.log(`[Server] Failed to load settings, using defaults: ${errorMessage}`);
	}
}

async function revalidateOpenDocuments(): Promise<number> {
	const openDocuments = documents.all();
	await Promise.all(openDocuments.map(document => validateTextDocument(document)));
	connection.console.log(`[Server] Revalidated ${openDocuments.length} open documents.`);
	return openDocuments.length;
}

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
			const codeActions = engine.getCodeActions(params.textDocument.uri, diagnostic, {
				includeSuggestions: globalSettings.enableSuggestions
			});
			actions.push(...codeActions);
		}
	}
	return actions;
});

documents.listen(connection);
connection.listen();
