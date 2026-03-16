import { taskListPlugin } from './core/taskListPlugin';
import { mermaidPlugin } from './core/mermaidPlugin';
import type MarkdownIt from 'markdown-it';

/* =========================================================
 * 🚀 VS CODE CONTRIBUTION POINT ENTRY
 * Exported via \`markdown.markdownItPlugins\` in package.json.
 * The CSS is loaded separately via \`markdown.previewStyles\`.
 *
 * This function is called once by VS Code when the Markdown preview
 * is first opened — there is no need for a full \`activate()\` here
 * because the contribution point handles the lifecycle automatically.
 * ========================================================= */
export function activate() {
  return {
    extendMarkdownIt(md: MarkdownIt) {
      md.use(taskListPlugin);
      md.use(mermaidPlugin);
      return md;
    },
  };
}
