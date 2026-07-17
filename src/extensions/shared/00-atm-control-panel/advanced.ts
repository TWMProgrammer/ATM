import * as vscode from 'vscode';
import {
	CONSTANTS,
	type ControlPanelQuickPickItem,
	type RenderContext,
	type ToolState,
	escapeMarkdown,
	getToolStats,
	organizeToolsByCategory
} from './utils';
import { SvgIcons } from './svg-icons';

const activeStatePattern = /active|enabled|running/i;

export function renderAdvancedTooltip(
	statusBarItem: vscode.StatusBarItem,
	context: RenderContext
): void {
	const md = createTooltipMarkdown();
	const stats = getToolStats();
	const activeFeatures = getActiveFeatureCount(context, stats.activeTools);
	const pausedControls = getPausedControlCount(context);
	const currentAudio = CONSTANTS.TERMINAL_SOUND_AUDIO_OPTIONS[context.currentTerminalSoundAudioIndex];

	md.appendMarkdown(
		`<table width="${CONSTANTS.TOOLTIP_WIDTH}"><tr><td width="36"><img src="${SvgIcons.getBrandMark(context.extensionContext)}" width="28" height="28" alt="ATM" /></td>` +
		`<td><strong>ATM Control Center</strong><br/><sub><span style="color:#8C8C8C;">Workspace tools &amp; preferences</span></sub></td>` +
		`<td align="right"><strong><span style="color:#4EC9B0;">$(pulse) ${activeFeatures} active</span></strong><br/>` +
		`<sub><span style="color:#8C8C8C;">${pausedControls > 0 ? `${pausedControls} control${pausedControls === 1 ? '' : 's'} off` : 'All controls on'}</span></sub></td></tr></table>\n\n`
	);
	md.appendMarkdown('---\n\n');

	md.appendMarkdown(`**TOOLS** &nbsp; <sub><span style="color:#8C8C8C;">${stats.totalTools} registered</span></sub>\n\n`);
	renderTools(md, context, stats.totalTools);

	md.appendMarkdown('---\n\n');
	md.appendMarkdown('**WORKSPACE CONTROLS**\n\n');

	const tailwindState = context.isTailwindFoldEnabled
		? stateLabel(true, context.isTailwindAutoFold ? 'Auto-fold on' : 'Auto-fold off')
		: stateLabel(false, 'Off');
	const tailwindPrimary = context.isTailwindFoldEnabled
		? commandLink(context.isTailwindAutoFold ? '$(unfold) Unfold' : '$(fold) Fold', CONSTANTS.COMMANDS.TAILWIND_TOGGLE_AUTO_FOLD, 'Toggle automatic class folding')
		: '';
	const tailwindToggle = commandLink(
		context.isTailwindFoldEnabled ? '$(circle-slash) Turn off' : '$(play) Turn on',
		CONSTANTS.COMMANDS.TAILWIND_TOGGLE_ENABLED,
		context.isTailwindFoldEnabled ? 'Disable Tailwind Fold' : 'Enable Tailwind Fold'
	);
	md.appendMarkdown(`$(symbol-color) **Tailwind Fold** &nbsp;&nbsp; ${tailwindState}<br/>${actionRow(tailwindPrimary, tailwindToggle)}\n\n`);

	const bracketState = stateLabel(context.isBracketLynxEnabled, context.isBracketLynxEnabled ? 'On' : 'Off');
	const bracketToggle = commandLink(
		context.isBracketLynxEnabled ? '$(circle-slash) Turn off' : '$(play) Turn on',
		CONSTANTS.COMMANDS.BRACKET_LYNX_TOGGLE,
		context.isBracketLynxEnabled ? 'Disable bracket decorations' : 'Enable bracket decorations'
	);
	md.appendMarkdown(`$(bracket-dot) **Bracket Lynx** &nbsp;&nbsp; ${bracketState}<br/>${actionRow(bracketToggle)}\n\n`);

	const codeSpellState = stateLabel(context.isCodeSpellEnabled, context.isCodeSpellEnabled ? 'On' : 'Off');
	const codeSpellToggle = commandLink(
		context.isCodeSpellEnabled ? '$(circle-slash) Turn off' : '$(play) Turn on',
		CONSTANTS.COMMANDS.CODE_SPELL_TOGGLE,
		context.isCodeSpellEnabled ? 'Disable Code Spell' : 'Enable Code Spell'
	);
	md.appendMarkdown(`$(book) **Code Spell** &nbsp;&nbsp; ${codeSpellState}<br/>${actionRow(codeSpellToggle)}\n\n`);

	const normalLayout = context.isPro
		? commandLink('$(circle-outline) Normal', CONSTANTS.COMMANDS.LAYOUT_NORMAL, 'Use the classic workspace layout')
		: activeChoice('Normal');
	const proLayout = context.isPro
		? activeChoice('Pro')
		: commandLink('$(circle-outline) Pro', CONSTANTS.COMMANDS.LAYOUT_PRO, 'Use the wide-screen workspace layout');
	md.appendMarkdown(`$(layout) **Layout** &nbsp;&nbsp; ${context.isPro ? stateLabel(true, 'Pro') : stateLabel(true, 'Normal')}<br/>${actionRow(normalLayout, proLayout)}\n\n`);

	const audioWave = `<img src="${SvgIcons.getAudioWave()}" width="16" height="12" alt="Audio" />`;
	const audioState = stateLabel(context.isTerminalSoundEnabled, context.isTerminalSoundEnabled ? currentAudio.name : 'Muted');
	const audioTest = context.isTerminalSoundEnabled
		? commandLink('$(play) Test', CONSTANTS.COMMANDS.TERMINAL_SOUND_TEST_AUDIO, `Preview ${currentAudio.name}`)
		: '';
	const audioToggle = commandLink(
		context.isTerminalSoundEnabled ? '$(mute) Mute' : '$(unmute) Unmute',
		CONSTANTS.COMMANDS.TERMINAL_SOUND_TOGGLE_MUTE,
		context.isTerminalSoundEnabled ? 'Mute terminal error audio' : 'Enable terminal error audio'
	);
	md.appendMarkdown(`${audioWave} &nbsp; **Terminal Sound** &nbsp;&nbsp; ${audioState}<br/>${actionRow(audioTest, audioToggle)}\n\n`);

	md.appendMarkdown('---\n\n');
	md.appendMarkdown(
		`${commandLink('$(list-unordered) Open menu', CONSTANTS.COMMANDS.STATUS_CLICKED, 'Open the complete control menu')} &nbsp;&nbsp; ` +
		`${commandLink('$(refresh) Refresh', CONSTANTS.COMMANDS.REFRESH_TOOLS, 'Refresh registered tools')} &nbsp;&nbsp; ` +
		`${commandLink('$(collapse-all) Compact', CONSTANTS.COMMANDS.TOGGLE_COMPACT, 'Switch to compact view')} &nbsp;&nbsp; ` +
		`[$(github) GitHub](https://github.com/bastndev/ATM "Open ATM repository")\n\n`
	);
	md.appendMarkdown(
		`<sub><span style="color:${stats.totalTools > 0 ? '#4EC9B0' : '#8C8C8C'};">` +
		`${stats.totalTools > 0 ? '$(check-all) Ready · controls apply instantly' : '$(info) Waiting for tool registration'}</span></sub>`
	);

	statusBarItem.tooltip = md;
}

function renderTools(md: vscode.MarkdownString, context: RenderContext, totalTools: number): void {
	if (context.toolRegistry.size === 0) {
		md.appendMarkdown('$(info) _No tools registered yet_\n\n');
		md.appendMarkdown('<sub><span style="color:#8C8C8C;">Tools appear automatically when their extension activates.</span></sub>\n\n');
		return;
	}

	const maxTools = 8;
	let renderedTools = 0;
	for (const [category, tools] of organizeToolsByCategory()) {
		if (renderedTools >= maxTools) {
			break;
		}

		const categoryInfo = CONSTANTS.CATEGORIES[category as keyof typeof CONSTANTS.CATEGORIES] || CONSTANTS.CATEGORIES.other;
		const visibleTools = [...tools]
			.sort((left, right) => (right.priority || 0) - (left.priority || 0) || left.name.localeCompare(right.name))
			.slice(0, maxTools - renderedTools);
		md.appendMarkdown(`${categoryInfo.icon} **${categoryInfo.label}** &nbsp; <sub><span style="color:#8C8C8C;">${tools.length}</span></sub>\n\n`);

		for (const tool of visibleTools) {
			const description = tool.description
				? ` &nbsp; <span style="color:${activeStatePattern.test(tool.description) ? '#4EC9B0' : '#8C8C8C'};">— ${escapeMarkdown(tool.description)}</span>`
				: '';
			const keybinding = tool.keybinding
				? ` &nbsp; <sub><span style="color:#569CD6;">${escapeMarkdown(tool.keybinding)}</span></sub>`
				: '';
			const tooltip = escapeMarkdown(tool.description || `Run ${tool.name}`).replace(/"/g, '&quot;');
			md.appendMarkdown(`${tool.icon} &nbsp; **[${escapeMarkdown(tool.name)}](command:${tool.command} "${tooltip}")**${keybinding}${description}\n\n`);
			renderedTools++;
		}
	}

	if (totalTools > renderedTools) {
		md.appendMarkdown(`<sub><span style="color:#8C8C8C;">$(ellipsis) ${totalTools - renderedTools} more available in the menu</span></sub>\n\n`);
	}
}

export async function showAdvancedQuickMenu(context: RenderContext): Promise<void> {
	const stats = getToolStats();
	const items: ControlPanelQuickPickItem[] = [
		separator('$(zap) Quick actions'),
		actionItem('$(refresh) Refresh tools', CONSTANTS.COMMANDS.REFRESH_TOOLS, `${stats.totalTools} registered`, 'Rebuild the control-panel state'),
		actionItem('$(collapse-all) Switch to compact view', CONSTANTS.COMMANDS.TOGGLE_COMPACT, 'Reduce hover detail'),
		separator('$(settings-gear) Workspace controls')
	];

	if (context.isTailwindFoldEnabled) {
		items.push(actionItem(
			context.isTailwindAutoFold ? '$(unfold) Tailwind Fold: unfold by default' : '$(fold) Tailwind Fold: fold by default',
			CONSTANTS.COMMANDS.TAILWIND_TOGGLE_AUTO_FOLD,
			context.isTailwindAutoFold ? 'Auto-fold is on' : 'Auto-fold is off'
		));
	}
	items.push(actionItem(
		context.isTailwindFoldEnabled ? '$(circle-slash) Turn off Tailwind Fold' : '$(play) Turn on Tailwind Fold',
		CONSTANTS.COMMANDS.TAILWIND_TOGGLE_ENABLED,
		context.isTailwindFoldEnabled ? 'Enabled' : 'Disabled'
	));
	items.push(actionItem(
		context.isBracketLynxEnabled ? '$(circle-slash) Turn off Bracket Lynx' : '$(play) Turn on Bracket Lynx',
		CONSTANTS.COMMANDS.BRACKET_LYNX_TOGGLE,
		context.isBracketLynxEnabled ? 'Enabled' : 'Disabled'
	));
	items.push(actionItem(
		context.isCodeSpellEnabled ? '$(circle-slash) Turn off Code Spell' : '$(play) Turn on Code Spell',
		CONSTANTS.COMMANDS.CODE_SPELL_TOGGLE,
		context.isCodeSpellEnabled ? 'Enabled' : 'Disabled'
	));

	items.push(separator('$(layout) Workspace layout'));
	items.push(actionItem(
		context.isPro ? '$(circle-outline) Normal layout' : '$(pass-filled) Normal layout',
		CONSTANTS.COMMANDS.LAYOUT_NORMAL,
		CONSTANTS.LAYOUTS.NORMAL.description,
		context.isPro ? 'Activate this layout' : 'Currently active'
	));
	items.push(actionItem(
		context.isPro ? '$(pass-filled) Pro layout' : '$(circle-outline) Pro layout',
		CONSTANTS.COMMANDS.LAYOUT_PRO,
		CONSTANTS.LAYOUTS.PRO.description,
		context.isPro ? 'Currently active' : 'Activate this layout'
	));

	const currentAudio = CONSTANTS.TERMINAL_SOUND_AUDIO_OPTIONS[context.currentTerminalSoundAudioIndex];
	items.push(separator('$(unmute) Terminal sound'));
	items.push(actionItem(
		context.isTerminalSoundEnabled ? '$(mute) Mute terminal sound' : '$(unmute) Unmute terminal sound',
		CONSTANTS.COMMANDS.TERMINAL_SOUND_TOGGLE_MUTE,
		context.isTerminalSoundEnabled ? `${currentAudio.name} is active` : 'Audio is muted'
	));
	if (context.isTerminalSoundEnabled) {
		items.push(actionItem('$(play) Test current sound', CONSTANTS.COMMANDS.TERMINAL_SOUND_TEST_AUDIO, `Preview ${currentAudio.name}`));
	}

	appendToolItems(items, context);

	const quickPick = vscode.window.createQuickPick<ControlPanelQuickPickItem>();
	quickPick.items = items;
	quickPick.title = `$(verified-filled) ATM Control Center  ·  ${stats.totalTools} tool${stats.totalTools === 1 ? '' : 's'}`;
	quickPick.placeholder = 'Search tools, settings, and workspace actions';
	quickPick.matchOnDescription = true;
	quickPick.matchOnDetail = true;
	quickPick.onDidAccept(async () => {
		const selected = quickPick.selectedItems[0];
		quickPick.hide();
		if (selected?.command) {
			await executeCommand(selected.command);
		}
	});
	quickPick.onDidTriggerItemButton(async event => {
		if (!event.item.toolId) {
			return;
		}
		const tool = context.toolRegistry.get(event.item.toolId);
		if (tool) {
			await showToolInfo(tool);
		}
	});
	quickPick.onDidHide(() => quickPick.dispose());
	quickPick.show();
}

function appendToolItems(items: ControlPanelQuickPickItem[], context: RenderContext): void {
	if (context.toolRegistry.size === 0) {
		items.push(separator('$(info) No tools registered'));
		return;
	}

	for (const [category, tools] of organizeToolsByCategory()) {
		const categoryInfo = CONSTANTS.CATEGORIES[category as keyof typeof CONSTANTS.CATEGORIES] || CONSTANTS.CATEGORIES.other;
		items.push(separator(`${categoryInfo.icon} ${categoryInfo.label}  ·  ${tools.length}`));
		for (const tool of [...tools].sort((left, right) => (right.priority || 0) - (left.priority || 0) || left.name.localeCompare(right.name))) {
			items.push({
				label: `${tool.icon} ${tool.name}`,
				description: tool.keybinding ? `${tool.description || ''}  ·  ${tool.keybinding}` : tool.description,
				detail: tool.command,
				command: tool.command,
				toolId: tool.id,
				buttons: [{ iconPath: new vscode.ThemeIcon('info'), tooltip: 'Tool details' }]
			});
		}
	}
}

function createTooltipMarkdown(): vscode.MarkdownString {
	const md = new vscode.MarkdownString('', true);
	md.isTrusted = true;
	md.supportThemeIcons = true;
	md.supportHtml = true;
	return md;
}

function getActiveFeatureCount(context: RenderContext, activeTools: number): number {
	return activeTools + Number(context.isTailwindFoldEnabled) + Number(context.isTerminalSoundEnabled) + Number(context.isCodeSpellEnabled) + 1;
}

function getPausedControlCount(context: RenderContext): number {
	return Number(!context.isTailwindFoldEnabled) +
		Number(!context.isBracketLynxEnabled) +
		Number(!context.isCodeSpellEnabled) +
		Number(!context.isTerminalSoundEnabled);
}

function stateLabel(enabled: boolean, label: string): string {
	return `<span style="color:${enabled ? '#4EC9B0' : '#8C8C8C'};"><strong>${enabled ? '$(pass-filled)' : '$(circle-slash)'} ${label}</strong></span>`;
}

function activeChoice(label: string): string {
	return `<span style="color:#4EC9B0;">$(pass-filled) **${label}**</span>`;
}

function commandLink(label: string, command: string, title: string): string {
	return `[${label}](command:${command} "${title}")`;
}

function joinActions(...actions: string[]): string {
	return actions.filter(Boolean).join(' &nbsp;·&nbsp; ');
}

function actionRow(...actions: string[]): string {
	return `<span style="color:#8C8C8C;">$(chevron-right)</span> &nbsp;${joinActions(...actions)}`;
}

function separator(label: string): ControlPanelQuickPickItem {
	return { label, kind: vscode.QuickPickItemKind.Separator };
}

function actionItem(
	label: string,
	command: string,
	description?: string,
	detail?: string
): ControlPanelQuickPickItem {
	return { label, command, description, detail, alwaysShow: true };
}

async function executeCommand(command: string): Promise<void> {
	try {
		await vscode.commands.executeCommand(command);
	} catch (error) {
		console.error(`[ATM] Failed to execute ${command}:`, error);
		vscode.window.showErrorMessage(vscode.l10n.t('ATM: Action failed'));
	}
}

async function showToolInfo(tool: ToolState): Promise<void> {
	const category = CONSTANTS.CATEGORIES[tool.category || 'other'];
	const details = [
		tool.description || 'No description available.',
		`Command: ${tool.command}`,
		tool.keybinding ? `Keybinding: ${tool.keybinding}` : undefined,
		`Category: ${category.label}`
	].filter((line): line is string => Boolean(line)).join('\n');
	const action = await vscode.window.showInformationMessage(
		tool.name,
		{ modal: true, detail: details },
		'Run tool',
		'Copy command'
	);

	if (action === 'Run tool') {
		await executeCommand(tool.command);
	} else if (action === 'Copy command') {
		await vscode.env.clipboard.writeText(tool.command);
		vscode.window.setStatusBarMessage('$(check) ATM: Command copied', 1800);
	}
}
