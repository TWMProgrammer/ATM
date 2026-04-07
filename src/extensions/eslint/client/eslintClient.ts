import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activateEslintClient(context: ExtensionContext) {
	// 1. RUTA AL SERVIDOR
	// context.asAbsolutePath resuelve la ruta relativa hacia la carpeta 'dist' desde la
	// raíz de tu extensión, donde esbuild acaba de empaquetar nuestro servidor.
	const serverModule = context.asAbsolutePath(path.join('dist', 'eslintServer.js'));

	// 2. OPCIONES DE EJECUCIÓN DEL PROCESO
	// Si lo corremos en modo 'debug' (Start Debugging en VS Code), abriremos el inspector de Node.
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// 3. COMUNICACIÓN Y REGLAS CLIENTE->SERVIDOR
	const clientOptions: LanguageClientOptions = {
		// Aquí definimos en qué archivos se activará el servidor LSP.
		// En el futuro, lo conectaremos con las configuraciones (probe) que definiste en package.json.
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
			// Le avisamos al servidor si el usuario modifica cualquier archivo ".eslint*" 
			// en su disco, para poder reiniciar o limpiar cachés.
			fileEvents: workspace.createFileSystemWatcher('**/.eslint*')
		}
	};

	// Creamos el cliente, pero no lo arrancamos inmediatamente aquí, 
	// dejaremos que el ciclo de vida lo maneje startClient().
	client = new LanguageClient(
		'atmEslintServer',       // ID interno
		'ATM ESLint Server',     // Nombre visible al usuario
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

export function deactivateEslintClient(): Thenable<void> | undefined {
	return stopClient();
}
