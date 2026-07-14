export interface TextPoint {
	line: number;
	character: number;
}

export interface TextSelection {
	start: TextPoint;
	end: TextPoint;
}

export type BeforeSelectionResult =
	| { status: 'changed'; beforeText: string }
	| { status: 'unchanged' };

type DiffKind = 'equal' | 'delete' | 'insert';

interface DiffOperation {
	kind: DiffKind;
}

interface LineMapping {
	currentLine: number;
	oldLine?: number;
	changed: boolean;
}

export function findBeforeSelection(
	beforeText: string,
	currentText: string,
	selection: TextSelection
): BeforeSelectionResult {
	const beforeLines = splitLines(beforeText);
	const currentLines = splitLines(currentText);
	const mappings = buildLineMappings(beforeLines, currentLines);
	const lastSelectedLine = selection.end.character === 0 && selection.end.line > selection.start.line
		? selection.end.line - 1
		: selection.end.line;
	const selectedMappings = mappings.slice(selection.start.line, lastSelectedLine + 1);

	if (!selectedMappings.some((mapping) => mapping.changed)) {
		return { status: 'unchanged' };
	}

	const mapped = selectedMappings.filter(
		(mapping): mapping is LineMapping & { oldLine: number } => mapping.oldLine !== undefined
	);
	if (mapped.length === 0) {
		return { status: 'changed', beforeText: '' };
	}

	const first = mapped[0];
	const last = mapped[mapped.length - 1];
	const oldStartLine = first.oldLine;
	const oldEndLine = last.oldLine;
	let oldStartCharacter = 0;
	let oldEndCharacter = beforeLines[oldEndLine]?.length ?? 0;

	if (first.currentLine === selection.start.line) {
		oldStartCharacter = mapColumn(
			beforeLines[oldStartLine] ?? '',
			currentLines[first.currentLine] ?? '',
			selection.start.character,
			'start'
		);
	}
	if (last.currentLine === selection.end.line) {
		oldEndCharacter = mapColumn(
			beforeLines[oldEndLine] ?? '',
			currentLines[last.currentLine] ?? '',
			selection.end.character,
			'end'
		);
	}

	if (oldStartLine === oldEndLine && first.currentLine !== last.currentLine) {
		oldStartCharacter = 0;
		oldEndCharacter = beforeLines[oldEndLine]?.length ?? 0;
	}

	const eol = currentText.includes('\r\n') ? '\r\n' : '\n';
	let selectedBefore = sliceLines(
		beforeLines,
		{ line: oldStartLine, character: oldStartCharacter },
		{ line: oldEndLine, character: oldEndCharacter },
		eol
	);
	if (selection.end.character === 0 && selection.end.line > selection.start.line) {
		selectedBefore += eol;
	}

	const selectedCurrent = sliceLines(currentLines, selection.start, selection.end, eol);
	if (normalizeEol(selectedBefore) === normalizeEol(selectedCurrent)) {
		return { status: 'unchanged' };
	}
	return { status: 'changed', beforeText: selectedBefore };
}

function buildLineMappings(beforeLines: string[], currentLines: string[]): LineMapping[] {
	const operations = diffLines(beforeLines, currentLines);
	const mappings: LineMapping[] = [];
	let oldLine = 0;
	let currentLine = 0;
	let operationIndex = 0;

	while (operationIndex < operations.length) {
		if (operations[operationIndex].kind === 'equal') {
			mappings[currentLine] = { currentLine, oldLine, changed: false };
			oldLine++;
			currentLine++;
			operationIndex++;
			continue;
		}

		const oldStart = oldLine;
		const currentStart = currentLine;
		let oldCount = 0;
		let currentCount = 0;
		while (operationIndex < operations.length && operations[operationIndex].kind !== 'equal') {
			if (operations[operationIndex].kind === 'delete') {
				oldCount++;
				oldLine++;
			} else {
				currentCount++;
				currentLine++;
			}
			operationIndex++;
		}

		for (let offset = 0; offset < currentCount; offset++) {
			const mappedOldLine = oldCount === 0
				? undefined
				: oldStart + Math.min(oldCount - 1, Math.floor(offset * oldCount / currentCount));
			mappings[currentStart + offset] = {
				currentLine: currentStart + offset,
				oldLine: mappedOldLine,
				changed: true
			};
		}
	}

	return mappings;
}

function diffLines(beforeLines: string[], currentLines: string[]): DiffOperation[] {
	const maxDepth = beforeLines.length + currentLines.length;
	const trace: Map<number, number>[] = [];
	const frontier = new Map<number, number>([[1, 0]]);

	for (let depth = 0; depth <= maxDepth; depth++) {
		trace.push(new Map(frontier));
		for (let diagonal = -depth; diagonal <= depth; diagonal += 2) {
			const down = frontier.get(diagonal + 1) ?? -1;
			const right = frontier.get(diagonal - 1) ?? -1;
			let oldLine = diagonal === -depth || (diagonal !== depth && right < down)
				? Math.max(0, down)
				: right + 1;
			let currentLine = oldLine - diagonal;

			while (
				oldLine < beforeLines.length &&
				currentLine < currentLines.length &&
				beforeLines[oldLine] === currentLines[currentLine]
			) {
				oldLine++;
				currentLine++;
			}
			frontier.set(diagonal, oldLine);

			if (oldLine >= beforeLines.length && currentLine >= currentLines.length) {
				return backtrack(trace, beforeLines.length, currentLines.length);
			}
		}
	}

	return [];
}

function backtrack(trace: Map<number, number>[], oldLength: number, currentLength: number): DiffOperation[] {
	const operations: DiffOperation[] = [];
	let oldLine = oldLength;
	let currentLine = currentLength;

	for (let depth = trace.length - 1; depth >= 0; depth--) {
		const frontier = trace[depth];
		const diagonal = oldLine - currentLine;
		const down = frontier.get(diagonal + 1) ?? -1;
		const right = frontier.get(diagonal - 1) ?? -1;
		const previousDiagonal = diagonal === -depth || (diagonal !== depth && right < down)
			? diagonal + 1
			: diagonal - 1;
		const previousOldLine = Math.max(0, frontier.get(previousDiagonal) ?? 0);
		const previousCurrentLine = previousOldLine - previousDiagonal;

		while (oldLine > previousOldLine && currentLine > previousCurrentLine) {
			operations.push({ kind: 'equal' });
			oldLine--;
			currentLine--;
		}
		if (depth === 0) {
			break;
		}
		if (oldLine === previousOldLine) {
			operations.push({ kind: 'insert' });
			currentLine--;
		} else {
			operations.push({ kind: 'delete' });
			oldLine--;
		}
	}

	return operations.reverse();
}

function mapColumn(beforeLine: string, currentLine: string, column: number, bias: 'start' | 'end'): number {
	let prefix = 0;
	while (prefix < beforeLine.length && prefix < currentLine.length && beforeLine[prefix] === currentLine[prefix]) {
		prefix++;
	}

	let suffix = 0;
	while (
		suffix < beforeLine.length - prefix &&
		suffix < currentLine.length - prefix &&
		beforeLine[beforeLine.length - suffix - 1] === currentLine[currentLine.length - suffix - 1]
	) {
		suffix++;
	}

	const currentChangeEnd = currentLine.length - suffix;
	const beforeChangeEnd = beforeLine.length - suffix;
	const safeColumn = Math.max(0, Math.min(column, currentLine.length));
	if (safeColumn <= prefix) {
		return safeColumn;
	}
	if (safeColumn >= currentChangeEnd) {
		return Math.min(beforeLine.length, beforeChangeEnd + safeColumn - currentChangeEnd);
	}
	return bias === 'start' ? prefix : beforeChangeEnd;
}

function sliceLines(lines: string[], start: TextPoint, end: TextPoint, eol: string): string {
	if (start.line === end.line) {
		return (lines[start.line] ?? '').slice(start.character, end.character);
	}
	const parts = [(lines[start.line] ?? '').slice(start.character)];
	for (let line = start.line + 1; line < end.line; line++) {
		parts.push(lines[line] ?? '');
	}
	parts.push((lines[end.line] ?? '').slice(0, end.character));
	return parts.join(eol);
}

function splitLines(value: string): string[] {
	return value.split(/\r?\n/);
}

function normalizeEol(value: string): string {
	return value.replace(/\r\n/g, '\n');
}
