import * as vscode from 'vscode';
import { CONFIG_SECTION } from '../core/constants';
import { getConfig, isValidHexColor, normalizeHexColor } from '../core/config';
import { refreshDecorations } from './toggle';

const DEFAULT_COLOR = '#515151';

interface ColorOption extends vscode.QuickPickItem {
	value: string;
}

function getAvailableColors(): ColorOption[] {
	return [
		{ label: 'Default Gray', value: '#515151', description: 'Default bracket color' },
		{ label: 'Light Gray', value: '#ADB5BD', description: 'Light gray decorations' },
		{ label: 'Red', value: '#A13030', description: 'Warm muted red decorations' },
		{ label: 'Blue', value: '#4A4D66', description: 'Dark blue decorations' },
		{ label: 'Yellow', value: '#9D956B', description: 'Subtle yellow-beige' },
		{ label: 'Green', value: '#6B7C5D', description: 'Muted sage green decorations' },
		{ label: 'Purple', value: '#6D5D73', description: 'Soft purple-gray decorations' },
		{ label: 'Write Custom', value: 'write-custom', description: 'Enter your own hex color' },
	];
}

export async function changeColor(): Promise<void> {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor) {
		vscode.window.showWarningMessage('No active editor for color picker');
		return;
	}

	const config = getConfig();
	const originalColor = normalizeHexColor(config.get('color', DEFAULT_COLOR));

	const quickPick = vscode.window.createQuickPick<ColorOption>();
	quickPick.items = getAvailableColors();
	quickPick.placeholder = 'Choose a color for bracket decorations';
	quickPick.canSelectMany = false;

	let previewActive = false;
	let previewColor = originalColor;

	async function applyColor(color: string): Promise<void> {
		previewColor = normalizeHexColor(color);
		await config.update('color', previewColor, vscode.ConfigurationTarget.Global);
		refreshDecorations();
	}

	async function restoreOriginal(): Promise<void> {
		if (previewActive) {
			await config.update('color', originalColor, vscode.ConfigurationTarget.Global);
			refreshDecorations();
			previewActive = false;
		}
	}

	quickPick.onDidChangeActive(async (items) => {
		const item = items[0];
		if (item && item.value !== 'write-custom') {
			previewActive = true;
			await applyColor(item.value);
		}
	});

	quickPick.onDidAccept(async () => {
		const selected = quickPick.selectedItems[0];
		if (!selected) {
			await restoreOriginal();
			quickPick.dispose();
			return;
		}

		if (selected.value === 'write-custom') {
			quickPick.hide();
			const customColor = await vscode.window.showInputBox({
				prompt: 'Enter hex color for bracket decorations',
				placeHolder: '#ffffff',
				value: originalColor,
				validateInput: (value) => {
					if (!value) {
						return 'Color is required';
					}
					if (!isValidHexColor(value)) {
						return 'Please enter a valid hex color (e.g., #ff6b6b)';
					}
					return null;
				},
			});

			if (customColor) {
				await config.update('color', normalizeHexColor(customColor), vscode.ConfigurationTarget.Global);
				refreshDecorations();
				vscode.window.showInformationMessage(`Bracket Lynx color changed to ${customColor}`);
			} else {
				await restoreOriginal();
			}
		} else {
			await config.update('color', normalizeHexColor(selected.value), vscode.ConfigurationTarget.Global);
			refreshDecorations();
			vscode.window.showInformationMessage(`Bracket Lynx color changed to ${selected.label}`);
		}

		quickPick.dispose();
	});

	quickPick.onDidHide(async () => {
		if (quickPick.selectedItems.length === 0) {
			await restoreOriginal();
		}
		quickPick.dispose();
	});

	quickPick.show();
}
