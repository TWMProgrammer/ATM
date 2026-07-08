export function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return text.substring(0, maxLength - 3) + '...';
}

export function isEmpty(text: string | null | undefined): boolean {
	return !text || text.trim().length === 0;
}

export function getBaseName(filePath: string): string {
	const parts = filePath.split(/[/\\]/);
	return parts[parts.length - 1] ?? filePath;
}

export function isMinifiedFile(fileName: string): boolean {
	const lowerName = fileName.toLowerCase();
	const patterns = ['.min.js', '.min.css', '.bundle.js', '.chunk.js', '.min.map', '.bundle.css', '.dist.js', '.prod.js'];
	return patterns.some((pattern) => lowerName.endsWith(pattern));
}

export function isAllowedJsonFile(fileName: string, allowedFiles: readonly string[]): boolean {
	return allowedFiles.includes(getBaseName(fileName));
}
