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

        // Some MDX files contain content that is markdown-valid but not strict MDX ESM.
        // Retry in markdown mode so preview remains usable instead of failing hard.
        if (details.includes('import/exports') || details.includes('blockstatement')) {
          const fallbackCompiled = await compile(mdxCode, {
            ...baseOptions,
            format: 'md'
          });
          return String(fallbackCompiled);
        }

        throw strictErr;
      }
    } catch (err) {
      console.error('[MdxCompiler] compilation error:', err);
      throw err;
    }
  }
}
