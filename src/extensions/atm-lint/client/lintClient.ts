import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { ATM_LINT_REVALIDATE_REQUEST, RevalidateOpenDocumentsResponse } from '../shared/types';

let client: LanguageClient;

	export function activateLintClient(context: ExtensionContext) {
		// 1. Path to the server
		const serverModule = context.asAbsolutePath(path.join('dist', 'lintServer.js'));

	// 2. Process execution options
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// 3. Client -> Server communication rules
	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ scheme: 'file', language: 'javascript' },
			{ scheme: 'file', language: 'typescript' },
			{ scheme: 'file', language: 'javascriptreact' },
			{ scheme: 'file', language: 'typescriptreact' },
			{ scheme: 'file', language: 'vue' },
			{ scheme: 'file', language: 'html' },
			{ scheme: 'file', language: 'mdx' },
			{ scheme: 'file', language: 'astro' }
		],
		synchronize: {
			// Notify the server about ".eslint*" file changes to clear caches
			fileEvents: workspace.createFileSystemWatcher('**/.eslint*'),
			configurationSection: 'atm.lint'
		}
	};

	// 4. Instantiation
	client = new LanguageClient(
		'atmLintServer',
		'ATM Lint Server',
		serverOptions,
		clientOptions
	);
}

export async function startClient() {
	if (client) {
		await client.start();
	}
}

export async function stopClient(): Promise<void> {
	if (client) {
		await client.stop();
	}
}

export async function revalidateOpenDocuments(): Promise<number> {
	if (!client) {
		return 0;
	}

	const response = await client.sendRequest<RevalidateOpenDocumentsResponse>(ATM_LINT_REVALIDATE_REQUEST);
	return response.revalidatedDocuments;
}

export function deactivateLintClient(): Thenable<void> | undefined {
	return stopClient();
}
