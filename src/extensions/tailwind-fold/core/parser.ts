type FoldStyle = "ALL" | "QUOTES";
type ClassAttributeName = "class" | "className" | "class:list";

type ParsedValue = {
    fullStart: number;
    fullEnd: number; // exclusive
    contentStart: number;
    contentEnd: number; // exclusive
    quotedInnerStart?: number;
    quotedInnerEnd?: number; // exclusive
};

type FoldRange = {
    start: number;
    end: number; // exclusive
};

export type ParserMatch = {
    // Range that will be used by folding/decorations.
    start: number;
    end: number;
    length: number;
    textToFold: string;

    // Exact range of the detected class value (including wrappers like quotes/braces).
    valueStart: number;
    valueEnd: number;

    attribute: ClassAttributeName;
};

export class Parser {
    // We match only exact attribute names to prevent false positives like "myclass".
    private static readonly targetAttributes = new Set<ClassAttributeName>([
        "class",
        "className",
        "class:list",
    ]);

    // Main parser entrypoint. It scans tags and attributes deterministically (no monolithic regex).
    static getMatches(text: string, foldStyle: FoldStyle): ParserMatch[] {
        const matches: ParserMatch[] = [];
        let index = 0;

        while (index < text.length) {
            if (text[index] === "<" && this.looksLikeTagStart(text, index)) {
                index = this.parseTag(text, index, foldStyle, matches);
                continue;
            }

            index += 1;
        }

        return matches;
    }

    // Parses one JSX/HTML-like tag and extracts class-related attributes.
    private static parseTag(
        text: string,
        tagStart: number,
        foldStyle: FoldStyle,
        matches: ParserMatch[]
    ): number {
        const length = text.length;

        // Handle HTML comments quickly.
        if (text.startsWith("<!--", tagStart)) {
            const commentEnd = text.indexOf("-->", tagStart + 4);
            return commentEnd === -1 ? length : commentEnd + 3;
        }

        let index = tagStart + 1;

        // Skip declarations like <!DOCTYPE ...>.
        if (text[index] === "!") {
            while (index < length && text[index] !== ">") {
                index += 1;
            }
            return index < length ? index + 1 : length;
        }

        // Closing tags do not carry attributes we want to parse.
        if (text[index] === "/") {
            while (index < length && text[index] !== ">") {
                index += 1;
            }
            return index < length ? index + 1 : length;
        }

        // Move over tag name.
        index = this.skipWhitespace(text, index);
        while (index < length && this.isTagNameChar(text[index])) {
            index += 1;
        }

        while (index < length) {
            index = this.skipWhitespace(text, index);

            if (index >= length) {
                return length;
            }

            if (text[index] === ">") {
                return index + 1;
            }

            if (text[index] === "/" && text[index + 1] === ">") {
                return index + 2;
            }

            // Skip spread attributes: {...props}
            if (text[index] === "{") {
                const spreadEnd = this.findMatchingBrace(text, index);
                if (spreadEnd === -1) {
                    return length;
                }
                index = spreadEnd + 1;
                continue;
            }

            // Defensive step if current char does not start a valid attribute name.
            if (!this.isAttributeNameChar(text[index])) {
                index += 1;
                continue;
            }

            const attrStart = index;
            while (index < length && this.isAttributeNameChar(text[index])) {
                index += 1;
            }

            const attrName = text.slice(attrStart, index);
            index = this.skipWhitespace(text, index);

            // Ignore boolean attributes (without explicit value assignment).
            if (text[index] !== "=") {
                continue;
            }

            index += 1;
            index = this.skipWhitespace(text, index);

            const parsedValue = this.parseAttributeValue(text, index);
            if (!parsedValue) {
                index += 1;
                continue;
            }

            if (this.isTargetAttribute(attrName)) {
                const foldRange = this.selectFoldRange(parsedValue, foldStyle);
                if (foldRange && foldRange.end > foldRange.start) {
                    const textToFold = text.slice(foldRange.start, foldRange.end);

                    matches.push({
                        start: foldRange.start,
                        end: foldRange.end,
                        length: foldRange.end - foldRange.start,
                        textToFold,
                        valueStart: parsedValue.fullStart,
                        valueEnd: parsedValue.fullEnd,
                        attribute: attrName,
                    });
                }
            }

            index = parsedValue.fullEnd;
        }

        return length;
    }

    // Parses the value after '='. Supports quoted, braced expression and plain unquoted forms.
    private static parseAttributeValue(text: string, valueStart: number): ParsedValue | null {
        if (valueStart >= text.length) {
            return null;
        }

        const first = text[valueStart];

        // class="a b" | class='a b' | class=`a b`
        if (first === '"' || first === "'" || first === "`") {
            const quoteEnd = this.findQuotedEnd(text, valueStart, first);
            if (quoteEnd === -1) {
                return null;
            }

            return {
                fullStart: valueStart,
                fullEnd: quoteEnd + 1,
                contentStart: valueStart + 1,
                contentEnd: quoteEnd,
            };
        }

        // class={'a b'} | class={`a b`} | class:list={{ active: cond }}
        if (first === "{") {
            const braceEnd = this.findMatchingBrace(text, valueStart);
            if (braceEnd === -1) {
                return null;
            }

            const quotedInner = this.findSingleQuotedLiteralInsideBraces(text, valueStart, braceEnd);

            return {
                fullStart: valueStart,
                fullEnd: braceEnd + 1,
                contentStart: valueStart + 1,
                contentEnd: braceEnd,
                quotedInnerStart: quotedInner?.start,
                quotedInnerEnd: quotedInner?.end,
            };
        }

        // class=foo (rare but valid in some templates)
        let end = valueStart;
        while (end < text.length && !this.isUnquotedValueTerminator(text[end])) {
            end += 1;
        }

        return {
            fullStart: valueStart,
            fullEnd: end,
            contentStart: valueStart,
            contentEnd: end,
        };
    }

    // ALL folds the full value token. QUOTES folds only inner literal when available.
    private static selectFoldRange(parsedValue: ParsedValue, foldStyle: FoldStyle): FoldRange | null {
        if (foldStyle === "ALL") {
            return {
                start: parsedValue.fullStart,
                end: parsedValue.fullEnd,
            };
        }

        if (
            parsedValue.quotedInnerStart !== undefined &&
            parsedValue.quotedInnerEnd !== undefined &&
            parsedValue.quotedInnerEnd > parsedValue.quotedInnerStart
        ) {
            return {
                start: parsedValue.quotedInnerStart,
                end: parsedValue.quotedInnerEnd,
            };
        }

        if (parsedValue.contentEnd <= parsedValue.contentStart) {
            return null;
        }

        return {
            start: parsedValue.contentStart,
            end: parsedValue.contentEnd,
        };
    }

    // For {'a b'} or {`a b`} this returns the inner literal range (without quotes).
    private static findSingleQuotedLiteralInsideBraces(
        text: string,
        braceStart: number,
        braceEnd: number
    ): { start: number; end: number } | null {
        let innerStart = braceStart + 1;
        let innerEndExclusive = braceEnd;

        innerStart = this.skipWhitespace(text, innerStart);
        while (innerEndExclusive > innerStart && this.isWhitespace(text[innerEndExclusive - 1])) {
            innerEndExclusive -= 1;
        }

        if (innerStart >= innerEndExclusive) {
            return null;
        }

        const first = text[innerStart];
        if (first !== '"' && first !== "'" && first !== "`") {
            return null;
        }

        const quoteEnd = this.findQuotedEnd(text, innerStart, first);
        if (quoteEnd === -1) {
            return null;
        }

        // Accept only a single quoted literal, not a composed expression.
        if (quoteEnd + 1 !== innerEndExclusive) {
            return null;
        }

        return {
            start: innerStart + 1,
            end: quoteEnd,
        };
    }

    // Finds closing quote, supporting escapes and template interpolations ${...}.
    private static findQuotedEnd(text: string, quoteStart: number, quoteChar: string): number {
        let index = quoteStart + 1;

        while (index < text.length) {
            const char = text[index];

            if (char === "\\") {
                index += 2;
                continue;
            }

            if (quoteChar === "`" && char === "$" && text[index + 1] === "{") {
                const expressionEnd = this.findMatchingBrace(text, index + 1);
                if (expressionEnd === -1) {
                    return -1;
                }
                index = expressionEnd + 1;
                continue;
            }

            if (char === quoteChar) {
                return index;
            }

            index += 1;
        }

        return -1;
    }

    // Finds the matching closing brace for a braced expression, skipping strings/comments safely.
    private static findMatchingBrace(text: string, braceStart: number): number {
        let depth = 0;
        let index = braceStart;

        while (index < text.length) {
            const char = text[index];

            if (char === '"' || char === "'" || char === "`") {
                const quoteEnd = this.findQuotedEnd(text, index, char);
                if (quoteEnd === -1) {
                    return -1;
                }
                index = quoteEnd + 1;
                continue;
            }

            if (char === "/" && text[index + 1] === "/") {
                index = this.skipLineComment(text, index + 2);
                continue;
            }

            if (char === "/" && text[index + 1] === "*") {
                index = this.skipBlockComment(text, index + 2);
                continue;
            }

            if (char === "{") {
                depth += 1;
            } else if (char === "}") {
                depth -= 1;
                if (depth === 0) {
                    return index;
                }
            }

            index += 1;
        }

        return -1;
    }

    private static skipLineComment(text: string, index: number): number {
        while (index < text.length && text[index] !== "\n") {
            index += 1;
        }
        return index;
    }

    private static skipBlockComment(text: string, index: number): number {
        while (index < text.length - 1) {
            if (text[index] === "*" && text[index + 1] === "/") {
                return index + 2;
            }
            index += 1;
        }
        return text.length;
    }

    private static isTargetAttribute(value: string): value is ClassAttributeName {
        return this.targetAttributes.has(value as ClassAttributeName);
    }

    private static looksLikeTagStart(text: string, index: number): boolean {
        const next = text[index + 1];
        if (!next) {
            return false;
        }

        return next === "!" || next === "/" || next === ">" || this.isTagNameStartChar(next);
    }

    private static skipWhitespace(text: string, index: number): number {
        while (index < text.length && this.isWhitespace(text[index])) {
            index += 1;
        }
        return index;
    }

    private static isWhitespace(char: string): boolean {
        return char === " " || char === "\n" || char === "\r" || char === "\t";
    }

    private static isTagNameStartChar(char: string): boolean {
        return /[A-Za-z]/.test(char);
    }

    private static isTagNameChar(char: string): boolean {
        return /[A-Za-z0-9:_\-\.]/.test(char);
    }

    private static isAttributeNameChar(char: string): boolean {
        return /[A-Za-z0-9:_\-]/.test(char);
    }

    private static isUnquotedValueTerminator(char: string): boolean {
        return this.isWhitespace(char) || char === ">" || char === "/";
    }
}
