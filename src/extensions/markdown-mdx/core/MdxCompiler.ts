export class MdxCompiler {
  private static depsPromise:
    | Promise<{
        compile: (source: string, options: Record<string, unknown>) => Promise<unknown>;
        remarkFrontmatter: unknown;
        remarkGfm: unknown;
      }>
    | undefined;

  private static getDeps() {
    if (!this.depsPromise) {
      this.depsPromise = (async () => {
        const { compile } = await import('@mdx-js/mdx');
        const { default: remarkFrontmatter } = await import('remark-frontmatter');
        const { default: remarkGfm } = await import('remark-gfm');

        return {
          compile,
          remarkFrontmatter,
          remarkGfm
        };
      })();
    }

    return this.depsPromise;
  }

  public static async compileToJS(mdxCode: string, baseUrl?: string): Promise<string> {
    try {
      const { compile, remarkFrontmatter, remarkGfm } = await this.getDeps();

      const baseOptions = {
        outputFormat: 'function-body' as const,
        development: false,
        baseUrl,
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
