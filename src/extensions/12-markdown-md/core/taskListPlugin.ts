/* =========================================================
 * ✅ MARKDOWN-IT PLUGIN: GFM TASK LIST CHECKBOXES
 * Renders \`- [ ] text\` as unchecked and \`- [x] text\` as checked checkboxes
 * in the VS Code Markdown preview. Zero external dependencies.
 *
 * Performance notes:
 * - Regex is pre-compiled once (module level)
 * - Token manipulation is done in-place (no cloning)
 * - List item class is set via a single string assignment
 * ========================================================= */

import type MarkdownIt from 'markdown-it';

// Pre-compiled — allocated once at module load
const CHECKBOX_RE = /^\[([ xX])\]\s/;

/* =========================================================
 * 🚀 CORE RULE
 * Transforms list-item tokens containing \`[ ]\` / \`[x]\`
 * into proper checkbox markup.
 * ========================================================= */
function taskListRule(state: MarkdownIt.StateCore): void {
  const tokens = state.tokens;
  const len = tokens.length;
  const TokenCtor = state.Token;

  for (let i = 2; i < len; i++) {
    const token = tokens[i];

    // We only care about inline content inside list items
    if (token.type !== 'inline') { continue; }

    // Previous tokens must form: list_item_open → paragraph_open → inline
    const paragraphOpen = tokens[i - 1];
    const listItemOpen = tokens[i - 2];

    if (
      paragraphOpen.type !== 'paragraph_open' ||
      listItemOpen.type !== 'list_item_open'
    ) {
      continue;
    }

    const content = token.content;
    const match = CHECKBOX_RE.exec(content);
    if (!match) { continue; }

    const checked = match[1] !== ' ';

    // Mark the parent <li> with a class for CSS styling
    listItemOpen.attrSet('class', 'task-list-item');

    // Build new child tokens in-place
    // 1. <input type="checkbox" disabled [checked]>
    const checkboxToken = new TokenCtor('checkbox_input', 'input', 0);
    checkboxToken.attrs = [
      ['type', 'checkbox'],
      ['disabled', ''],
    ];
    if (checked) {
      checkboxToken.attrs.push(['checked', '']);
    }

    // 2. Remaining text after `[ ] ` or `[x] `
    const textToken = new TokenCtor('text', '', 0);
    textToken.content = content.slice(match[0].length);

    // Replace inline children
    token.children = [checkboxToken, textToken];
    // Clear raw content so markdown-it won't double-render
    token.content = '';

    // Walk backwards to find the enclosing <ul>/<ol> and add the container class
    for (let j = i - 2; j >= 0; j--) {
      const t = tokens[j];
      if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
        // Only set once per list
        if (!t.attrGet('class')?.includes('contains-task-list')) {
          t.attrSet('class', 'contains-task-list');
        }
        break;
      }
    }
  }
}

/* =========================================================
 * 🔌 REGISTER PLUGIN
 * Register the plugin on a markdown-it instance.
 * ========================================================= */
export function taskListPlugin(md: MarkdownIt): void {
  md.core.ruler.after('inline', 'github-task-lists', (state) => {
    taskListRule(state);
  });

  // Custom renderer for the checkbox <input> token
  md.renderer.rules['checkbox_input'] = (tokens, idx) => {
    const token = tokens[idx];
    const checked = token.attrs?.some(([k]) => k === 'checked') ?? false;
    return checked
      ? '<input type="checkbox" disabled checked> '
      : '<input type="checkbox" disabled> ';
  };
}
