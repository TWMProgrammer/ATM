import * as vscode from 'vscode';
import {
	CONSTANTS,
	type ControlPanelQuickPickItem,
	type RenderContext,
	escapeMarkdown,
	getToolStats
} from './utils';
import { SvgIcons } from './svg-icons';

export function renderMinimalTooltip(
	statusBarItem: vscode.StatusBarItem,
	context: RenderContext
): void {
	const md = new vscode.MarkdownString('', true);
	md.isTrusted = true;
	md.supportThemeIcons = true;
	md.supportHtml = true;

	const stats = getToolStats();
	const tools = [...context.toolRegistry.values()]
		.sort((left, right) => (right.priority || 0) - (left.priority || 0) || left.name.localeCompare(right.name))
		.slice(0, 5);
	const currentAudio = CONSTANTS.TERMINAL_SOUND_AUDIO_OPTIONS[context.currentTerminalSoundAudioIndex];

	md.appendMarkdown(
		`<img src="${SvgIcons.getWidthSpacer(CONSTANTS.COMPACT_TOOLTIP_WIDTH)}" width="${CONSTANTS.COMPACT_TOOLTIP_WIDTH}" height="1" alt="" />\n`
	);
	md.appendMarkdown(
		`<table width="100%"><tr><td width="36"><img src="${SvgIcons.getBrandMark()}" width="28" height="28" alt="ATM" /></td>` +
		'<td><strong>ATM Control Center</strong><br/><sub><span style="color:#8C8C8C;">Compact overview</span></sub></td>' +
		'<td align="right"><sub><span style="color:#8C8C8C;">COMPACT</span></sub></td></tr></table>\n\n'
	);
	md.appendMarkdown('---\n\n');

	if (tools.length === 0) {
		md.appendMarkdown('$(info) _No tools registered yet_\n\n');
	} else {
		md.appendMarkdown(`**TOOLS** &nbsp; <sub><span style="color:#8C8C8C;">${stats.totalTools} registered</span></sub>\n\n`);
		for (const tool of tools) {
			const keybinding = tool.keybinding
				? ` &nbsp; <sub><span style="color:#569CD6;">${escapeMarkdown(tool.keybinding)}</span></sub>`
				: '';
			md.appendMarkdown(`${tool.icon} &nbsp; **[${escapeMarkdown(tool.name)}](command:${tool.command})**${keybinding}\n\n`);
		}
		if (stats.totalTools > tools.length) {
			md.appendMarkdown(`<sub><span style="color:#8C8C8C;">$(ellipsis) ${stats.totalTools - tools.length} more in the menu</span></sub>\n\n`);
		}
	}

	md.appendMarkdown('---\n\n');
	md.appendMarkdown('**AT A GLANCE**\n\n');
	md.appendMarkdown(
		`$(symbol-color) **Tailwind Fold** &nbsp; ${compactState(context.isTailwindFoldEnabled, context.isTailwindFoldEnabled ? (context.isTailwindAutoFold ? 'Auto-fold' : 'Manual') : 'Off')} &nbsp; ` +
		`[Toggle](command:${CONSTANTS.COMMANDS.TAILWIND_TOGGLE_ENABLED} "Toggle Tailwind Fold")\n\n`
	);
	md.appendMarkdown(
		`$(bracket-dot) **Bracket Lynx** &nbsp; ${compactState(context.isBracketLynxEnabled, context.isBracketLynxEnabled ? 'On' : 'Off')} &nbsp; ` +
		`[Toggle](command:${CONSTANTS.COMMANDS.BRACKET_LYNX_TOGGLE} "Toggle Bracket Lynx")\n\n`
	);
	const layoutCommand = context.isPro ? CONSTANTS.COMMANDS.LAYOUT_NORMAL : CONSTANTS.COMMANDS.LAYOUT_PRO;
	md.appendMarkdown(
		`$(layout) **Layout** &nbsp; ${compactState(true, context.isPro ? 'Pro' : 'Normal')} &nbsp; ` +
		`[Use ${context.isPro ? 'Normal' : 'Pro'}](command:${layoutCommand} "Switch workspace layout")\n\n`
	);
	md.appendMarkdown(
		`$(unmute) **Terminal Sound** &nbsp; ${compactState(context.isTerminalSoundEnabled, context.isTerminalSoundEnabled ? currentAudio.name : 'Muted')} &nbsp; ` +
		`[${context.isTerminalSoundEnabled ? 'Mute' : 'Unmute'}](command:${CONSTANTS.COMMANDS.TERMINAL_SOUND_TOGGLE_MUTE} "Toggle terminal sound")\n\n`
	);

	md.appendMarkdown('---\n\n');
	md.appendMarkdown(
		`[$(list-unordered) Open menu](command:${CONSTANTS.COMMANDS.STATUS_CLICKED} "Open control menu") &nbsp;&nbsp; ` +
		`[$(refresh) Refresh](command:${CONSTANTS.COMMANDS.REFRESH_TOOLS} "Refresh tools") &nbsp;&nbsp; ` +
		`[$(expand-all) Expanded view](command:${CONSTANTS.COMMANDS.TOGGLE_COMPACT} "Open expanded view")`
	);

	statusBarItem.tooltip = md;
}

export async function showMinimalQuickMenu(context: RenderContext): Promise<void> {
	const stats = getToolStats();
	const items: ControlPanelQuickPickItem[] = [
		separator('$(zap) Quick actions'),
		actionItem('$(expand-all) Open expanded view', CONSTANTS.COMMANDS.TOGGLE_COMPACT, 'Show the full control-panel hover'),
		actionItem('$(refresh) Refresh tools', CONSTANTS.COMMANDS.REFRESH_TOOLS, `${stats.totalTools} registered`),
		separator('$(settings-gear) Workspace controls'),
		actionItem(
			context.isTailwindFoldEnabled ? '$(circle-slash) Turn off Tailwind Fold' : '$(play) Turn on Tailwind Fold',
			CONSTANTS.COMMANDS.TAILWIND_TOGGLE_ENABLED,
			context.isTailwindFoldEnabled ? 'Enabled' : 'Disabled'
		),
		actionItem(
			context.isBracketLynxEnabled ? '$(circle-slash) Turn off Bracket Lynx' : '$(play) Turn on Bracket Lynx',
			CONSTANTS.COMMANDS.BRACKET_LYNX_TOGGLE,
			context.isBracketLynxEnabled ? 'Enabled' : 'Disabled'
		),
		actionItem(
			context.isPro ? '$(circle-outline) Use Normal layout' : '$(circle-outline) Use Pro layout',
			context.isPro ? CONSTANTS.COMMANDS.LAYOUT_NORMAL : CONSTANTS.COMMANDS.LAYOUT_PRO,
			context.isPro ? 'Pro is active' : 'Normal is active'
		),
		actionItem(
			context.isTerminalSoundEnabled ? '$(mute) Mute terminal sound' : '$(unmute) Unmute terminal sound',
			CONSTANTS.COMMANDS.TERMINAL_SOUND_TOGGLE_MUTE,
			context.isTerminalSoundEnabled ? 'Audio is active' : 'Audio is muted'
		)
	];

	if (context.toolRegistry.size > 0) {
		items.push(separator(`$(tools) Tools  ·  ${stats.totalTools}`));
		for (const tool of [...context.toolRegistry.values()]
			.sort((left, right) => (right.priority || 0) - (left.priority || 0) || left.name.localeCompare(right.name))
			.slice(0, 10)) {
			items.push({
				label: `${tool.icon} ${tool.name}`,
				description: tool.keybinding ? `${tool.description || ''}  ·  ${tool.keybinding}` : tool.description,
				detail: tool.command,
				command: tool.command
			});
		}
	}

	const quickPick = vscode.window.createQuickPick<ControlPanelQuickPickItem>();
	quickPick.items = items;
	quickPick.title = `$(verified-filled) ATM  ·  ${stats.totalTools} tool${stats.totalTools === 1 ? '' : 's'}`;
	quickPick.placeholder = 'Search tools and quick actions';
	quickPick.matchOnDescription = true;
	quickPick.matchOnDetail = true;
	quickPick.onDidAccept(async () => {
		const selected = quickPick.selectedItems[0];
		quickPick.hide();
		if (selected?.command) {
			await executeCommand(selected.command);
		}
	});
	quickPick.onDidHide(() => quickPick.dispose());
	quickPick.show();
}

function compactState(enabled: boolean, label: string): string {
	return `<sub><span style="color:${enabled ? '#4EC9B0' : '#8C8C8C'};">${enabled ? '$(pass-filled)' : '$(circle-slash)'} ${label}</span></sub>`;
}

function separator(label: string): ControlPanelQuickPickItem {
	return { label, kind: vscode.QuickPickItemKind.Separator };
}

function actionItem(label: string, command: string, description?: string): ControlPanelQuickPickItem {
	return { label, command, description, alwaysShow: true };
}

async function executeCommand(command: string): Promise<void> {
	try {
		await vscode.commands.executeCommand(command);
	} catch (error) {
		console.error(`[ATM] Failed to execute ${command}:`, error);
		vscode.window.showErrorMessage(vscode.l10n.t('ATM: Action failed'));
	}
}
