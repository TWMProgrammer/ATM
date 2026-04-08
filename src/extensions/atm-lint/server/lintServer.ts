import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	CodeActionKind
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { LintEngine } from './engine';
import { ATM_LINT_REVALIDATE_REQUEST, RevalidateOpenDocumentsResponse } from '../shared/types';

const connection = createConnection(ProposedFeatures.all);
const engine = new LintEngine((msg) => connection.console.log(msg));
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

type AtmLintSettings = {
	enableSuggestions: boolean;
};

const defaultSettings: AtmLintSettings = {
	enableSuggestions: true
};

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let globalSettings: AtmLintSettings = defaultSettings;

// Debounce timers per document URI (250ms)
const DEBOUNCE_MS = 250;
const debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);

	// Pass workspace roots to the engine for proper cwd resolution
	const workspaceRoots = (params.workspaceFolders ?? [])
		.map(folder => URI.parse(folder.uri).fsPath);
	engine.setWorkspaceRoots(workspaceRoots);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Incremental,
				save: true
			},
			codeActionProvider: {
				codeActionKinds: [CodeActionKind.QuickFix]
			},
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

	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(() => {
			void (async () => {
				await refreshWorkspaceRoots();
				engine.resetInstances();
				await revalidateOpenDocuments();
			})();
		});
	}

	void refreshSettings();
	connection.console.log('[Server] ATM Lint Server initialized.');
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

connection.onRequest(ATM_LINT_REVALIDATE_REQUEST, async (): Promise<RevalidateOpenDocumentsResponse> => {
	const revalidatedDocuments = await revalidateOpenDocuments();
	return { revalidatedDocuments };
});

documents.onDidOpen(change => {
	void validateTextDocument(change.document);
});

documents.onDidChangeContent(change => {
	scheduleValidation(change.document);
});

documents.onDidClose(change => {
	clearDebounce(change.document.uri);
	engine.clearDocumentData(change.document.uri);
	connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] });
});

/**
 * Schedules a lint pass after a debounce period.
 * Prevents redundant linting during rapid typing.
 */
function scheduleValidation(document: TextDocument): void {
	const uri = document.uri;
	clearDebounce(uri);

	const timer = setTimeout(() => {
		debounceTimers.delete(uri);
		void validateTextDocument(document);
	}, DEBOUNCE_MS);

	debounceTimers.set(uri, timer);
}

function clearDebounce(uri: string): void {
	const existing = debounceTimers.get(uri);
	if (existing) {
		clearTimeout(existing);
		debounceTimers.delete(uri);
	}
}

async function refreshSettings(): Promise<void> {
	if (!hasConfigurationCapability) {
		globalSettings = defaultSettings;
		return;
	}

	try {
		const userConfig = await connection.workspace.getConfiguration('atm.lint') as Partial<AtmLintSettings> | undefined;
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

async function refreshWorkspaceRoots(): Promise<void> {
	if (!hasWorkspaceFolderCapability) {
		return;
	}

	try {
		const folders = await connection.workspace.getWorkspaceFolders();
		const workspaceRoots = (folders ?? []).map(folder => URI.parse(folder.uri).fsPath);
		engine.setWorkspaceRoots(workspaceRoots);
		connection.console.log(`[Server] Workspace roots refreshed: ${workspaceRoots.length}`);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		connection.console.log(`[Server] Failed to refresh workspace roots: ${errorMessage}`);
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
	const version = textDocument.version;

	const diagnostics = await engine.lintText(text, filePath, textDocument.uri);

	// Discard stale results: if document closed or changed while linting, skip
	const currentDocument = documents.get(textDocument.uri);
	if (!currentDocument) {
		return;
	}

	if (currentDocument.version !== version) {
		return;
	}

	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onCodeAction((params) => {
	const actions = [];
	for (const diagnostic of params.context.diagnostics) {
		if (diagnostic.source === 'Lint (ATM)') {
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
