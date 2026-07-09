import * as vscode from 'vscode';
import * as path from 'path';
import { formatterService } from '../core/formatterService';
import { languageRegistry } from '../core/languageRegistry';
import { configFromVsCodeSettings, mergeConfig, formatterSettingKeys } from '../core/options';
import { resolveConfigForFile, readIgnorePatterns, isPathIgnored } from '../core/configResolver';
import type { FormatterConfig } from '../core/types';

/**
 * VS Code formatting providers (document + range) backed by the
 * {@link FormatterService}.
 *
 * The provider resolves the parser from the language registry, merges
 * config from `.prettierrc` (if found) with VS Code settings, calls
 * Prettier, and returns a single minimal `TextEdit` computed by diffing
 * the common prefix/suffix so VS Code applies the smallest possible change.
 */

/** Get the workspace root folder for a document, or the first workspace folder. */
function getWorkspaceRoot(document: vscode.TextDocument): string {
	if (document.uri.scheme === 'file') {
		const folder = vscode.workspace.getWorkspaceFolder(document.uri);
		if (folder) { return folder.uri.fsPath; }
	}
	const folders = vscode.workspace.workspaceFolders;
	return folders?.[0]?.uri.fsPath ?? process.cwd();
}

/** Resolve the full config for a document: .prettierrc (priority) + VS Code settings. */
function resolveFullConfig(document: vscode.TextDocument): { config: FormatterConfig; hasConfigFile: boolean } {
	const workspaceRoot = getWorkspaceRoot(document);
	const filePath = document.uri.fsPath;

	// 1. Try .prettierrc / package.json prettier key
	const prettierConfig = document.uri.scheme === 'file'
		? resolveConfigForFile(filePath, workspaceRoot)
		: { config: null, configPath: null };

	// 2. VS Code settings (used as fallback for missing options)
	const vsCodeConfig = configFromVsCodeSettings((key) =>
		vscode.workspace.getConfiguration().get(key),
	);

	// 3. Merge: .prettierrc wins, VS Code fills the gaps
	const merged = mergeConfig(prettierConfig.config, vsCodeConfig);
	return { config: merged, hasConfigFile: prettierConfig.configPath !== null };
}

/** Check if a document is ignored by .prettierignore. */
function isDocumentIgnored(document: vscode.TextDocument): boolean {
	if (document.uri.scheme !== 'file') { return false; }
	const workspaceRoot = getWorkspaceRoot(document);
	const ignorePathSetting = vscode.workspace.getConfiguration().get<string>(formatterSettingKeys.ignorePath) ?? '.prettierignore';
	const patterns = readIgnorePatterns(ignorePathSetting, workspaceRoot);
	if (patterns.length === 0) { return false; }
	return isPathIgnored(document.uri.fsPath, workspaceRoot, patterns);
}

/** Compute a single minimal TextEdit by diffing common prefix/suffix. */
function computeMinimalEdit(document: vscode.TextDocument, oldText: string, newText: string): vscode.TextEdit[] {
	if (oldText === newText) { return []; }

	// Find common prefix length
	let prefixLen = 0;
	const minLen = Math.min(oldText.length, newText.length);
	while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) {
		prefixLen++;
	}

	// Find common suffix length (not overlapping with prefix)
	let suffixLen = 0;
	while (
		suffixLen < minLen - prefixLen &&
		oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
	) {
		suffixLen++;
	}

	const startPos = document.positionAt(prefixLen);
	const endPos = document.positionAt(oldText.length - suffixLen);
	const replaceText = newText.slice(prefixLen, newText.length - suffixLen);

	return [vscode.TextEdit.replace(new vscode.Range(startPos, endPos), replaceText)];
}

/** Whether the formatter is enabled and the document should be formatted. */
function shouldFormat(document: vscode.TextDocument): boolean {
	const enabled = vscode.workspace.getConfiguration().get<boolean>(formatterSettingKeys.enable, true);
	if (!enabled) { return false; }
	if (!languageRegistry.isLanguageSupported(document.languageId)) { return false; }
	if (isDocumentIgnored(document)) { return false; }
	return true;
}

/** Check if requireConfig is set and no config file exists. */
function isConfigRequiredButMissing(document: vscode.TextDocument): boolean {
	const requireConfig = vscode.workspace.getConfiguration().get<boolean>(formatterSettingKeys.requireConfig, false);
	if (!requireConfig) { return false; }
	if (document.uri.scheme !== 'file') { return false; }
	const workspaceRoot = getWorkspaceRoot(document);
	const { configPath } = resolveConfigForFile(document.uri.fsPath, workspaceRoot);
	return configPath === null;
}

export class AtmFormatterProvider
	implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {

	constructor(private readonly outputChannel: vscode.OutputChannel) {}

	async provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		_options: vscode.FormattingOptions,
		_token: vscode.CancellationToken,
	): Promise<vscode.TextEdit[]> {
		return this.formatDocument(document);
	}

	async provideDocumentRangeFormattingEdits(
		document: vscode.TextDocument,
		range: vscode.Range,
		_options: vscode.FormattingOptions,
		_token: vscode.CancellationToken,
	): Promise<vscode.TextEdit[]> {
		return this.formatRange(document, range);
	}

	/** Format the entire document. */
	async formatDocument(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
		if (!shouldFormat(document)) { return []; }
		if (isConfigRequiredButMissing(document)) {
			this.outputChannel.appendLine(`[formatter] Skipping ${document.fileName} — no config found and requireConfig is on`);
			return [];
		}

		const parser = formatterService.getParserForLanguageId(document.languageId);
		if (!parser) { return []; }

		const { config } = resolveFullConfig(document);
		const text = document.getText();
		const filepath = document.uri.scheme === 'file' ? document.uri.fsPath : undefined;

		this.outputChannel.appendLine(`[formatter] Formatting ${document.fileName} (parser: ${parser})`);
		const result = await formatterService.formatDocument({ text, parser, filepath, config });

		if (result.error) {
			this.outputChannel.appendLine(`[formatter] Error: ${result.error}`);
			vscode.window.showWarningMessage(vscode.l10n.t('ATM Formatter: {0}', result.error));
			return [];
		}

		return computeMinimalEdit(document, text, result.formatted);
	}

	/** Format a selection range within the document. */
	async formatRange(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.TextEdit[]> {
		if (!shouldFormat(document)) { return []; }
		if (!formatterService.supportsRangeFormatting(document.languageId)) { return []; }

		const parser = formatterService.getParserForLanguageId(document.languageId);
		if (!parser) { return []; }

		const { config } = resolveFullConfig(document);
		const text = document.getText();
		const filepath = document.uri.scheme === 'file' ? document.uri.fsPath : undefined;
		const rangeStart = document.offsetAt(range.start);
		const rangeEnd = document.offsetAt(range.end);

		this.outputChannel.appendLine(`[formatter] Formatting range ${document.fileName}:${range.start.line + 1}-${range.end.line + 1}`);
		const result = await formatterService.formatRange({
			text, parser, filepath, config, rangeStart, rangeEnd,
		});

		if (result.error) {
			this.outputChannel.appendLine(`[formatter] Error: ${result.error}`);
			return [];
		}

		return computeMinimalEdit(document, text, result.formatted);
	}

	/** Force format — ignores .prettierignore and requireConfig. */
	async forceFormat(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
		const parser = formatterService.getParserForLanguageId(document.languageId);
		if (!parser) {
			vscode.window.showWarningMessage(vscode.l10n.t('ATM Formatter: language "{0}" is not supported', document.languageId));
			return [];
		}

		const { config } = resolveFullConfig(document);
		const text = document.getText();
		const filepath = document.uri.scheme === 'file' ? document.uri.fsPath : undefined;

		this.outputChannel.appendLine(`[formatter] Force formatting ${document.fileName}`);
		const result = await formatterService.formatDocument({ text, parser, filepath, config });

		if (result.error) {
			this.outputChannel.appendLine(`[formatter] Error: ${result.error}`);
			vscode.window.showWarningMessage(vscode.l10n.t('ATM Formatter: {0}', result.error));
			return [];
		}

		return computeMinimalEdit(document, text, result.formatted);
	}
}

/* ── Code action provider for "format on save" ─────────────────────── */

export class AtmFormatterCodeActionProvider implements vscode.CodeActionProvider {
	provideCodeActions(
		document: vscode.TextDocument,
		_range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		_token: vscode.CancellationToken,
	): vscode.CodeAction[] {
		if (context.only?.value !== 'source.fixAll' && context.only?.value !== 'source.organizeImports') {
			// Only show for fixAll (format on save)
			if (!context.only) { return []; }
		}

		if (!languageRegistry.isLanguageSupported(document.languageId)) { return []; }

		const action = new vscode.CodeAction(
			vscode.l10n.t('Format with ATM Formatter'),
			vscode.CodeActionKind.SourceFixAll,
		);
		action.command = {
			title: 'Format',
			command: 'atm.formatter.formatDocument',
			arguments: [document.uri],
		};
		return [action];
	}
}

/* ── Selector builders ──────────────────────────────────────────────── */

/** Build the DocumentFilter selectors for document formatting registration. */
export function buildDocumentSelectors(): vscode.DocumentFilter[] {
	return languageRegistry.getEnabledLanguageIds().map((languageId) => ({
		language: languageId,
		scheme: 'file',
	}));
}

/** Build the DocumentFilter selectors for range formatting registration. */
export function buildRangeSelectors(): vscode.DocumentFilter[] {
	return languageRegistry.getRangeFormattingLanguageIds().map((languageId) => ({
		language: languageId,
		scheme: 'file',
	}));
}
