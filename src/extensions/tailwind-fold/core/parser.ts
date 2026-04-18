export class Parser {
    // Expanded regex to support Vue (:class), Angular ([ngClass]), Astro/Svelte (class:list), etc.
    // Group 5 and Group 10 contain the actual class strings.
    static regEx = /(?:class|className|:class|\[ngClass\]|class:list)(?:=|:|:\s)((({\s*?.*?\()([\s\S]*?)(\)\s*?}))|(({?\s*?(['"`]))([\s\S]*?)(\8|\9\s*?})))/g;
    
    static regExGroupsAll = [0];
    static regExGroupsQuotes = [4, 9];
    
    static getMatches(text: string, foldStyle: "ALL" | "QUOTES") {
        const matches: { start: number, length: number, textToFold: string }[] = [];
        let match;
        const groups = foldStyle === "ALL" ? this.regExGroupsAll : this.regExGroupsQuotes;

        while ((match = this.regEx.exec(text))) {
            let matchedGroup = undefined;

            for (const group of groups) {
                if (match[group]) {
                    matchedGroup = group;
                    break;
                }
            }

            if (matchedGroup === undefined) {
                continue;
            }

            const fullMatchText = match[0];
            const textToFold = match[matchedGroup];
            const foldStartIndex = fullMatchText.indexOf(textToFold);

            matches.push({
                start: match.index + foldStartIndex,
                length: textToFold.length,
                textToFold
            });
        }
        
        return matches;
    }
}
