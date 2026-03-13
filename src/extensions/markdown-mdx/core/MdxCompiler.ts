export class MdxCompiler {
  public static async compileToJS(mdxCode: string): Promise<string> {
    try {
      const { compile } = await import('@mdx-js/mdx');
      const { default: remarkFrontmatter } = await import('remark-frontmatter');
      const { default: remarkGfm } = await import('remark-gfm');

      const baseOptions = {
        outputFormat: 'function-body' as const,
        development: false,
        remarkPlugins: [remarkFrontmatter, remarkGfm]
      };

      try {
        const compiled = await compile(mdxCode, {
          ...baseOptions,
          format: 'mdx'
        });
        return String(compiled);
      } catch (strictErr: any) {
        const details = [
          strictErr?.message,
          strictErr?.reason,
          strictErr?.cause?.message
        ]
          .filter(Boolean)
          .join(' | ')
          .toLowerCase();

        // Keep preview in true MDX mode: normalize common problematic top-level comment blocks
        // (e.g. {/** ... */}) and retry instead of degrading to plain Markdown rendering.
        if (details.includes('import/exports') || details.includes('blockstatement')) {
          const sanitized = mdxCode.replace(/^[ \t]*\{\/\*[\s\S]*?\*\/\}[ \t]*$/gm, '');
          const retried = await compile(sanitized, {
            ...baseOptions,
            format: 'mdx'
          });
          return String(retried);
        }

        throw strictErr;
      }
    } catch (err) {
      console.error('[MdxCompiler] compilation error:', err);
      throw err;
    }
  }
}
