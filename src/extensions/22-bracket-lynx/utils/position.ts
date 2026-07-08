import * as vscode from 'vscode';

export function nextLine(position: vscode.Position, increment = 1): vscode.Position {
	return new vscode.Position(position.line + increment, 0);
}

export function nextCharacter(position: vscode.Position, increment = 1): vscode.Position {
	return new vscode.Position(position.line, position.character + increment);
}

export function minPosition(positions: vscode.Position[]): vscode.Position {
	return positions.reduce((a, b) => (a.isBefore(b) ? a : b), positions[0]!);
}

export function maxPosition(positions: vscode.Position[]): vscode.Position {
	return positions.reduce((a, b) => (a.isAfter(b) ? a : b), positions[0]!);
}
