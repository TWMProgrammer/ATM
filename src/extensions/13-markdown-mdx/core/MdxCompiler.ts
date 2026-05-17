export class MdxCompiler {
  private static readonly maxCacheEntries = 40;
  private static readonly compileCache = new Map<string, string>();

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

  private static getCacheKey(mdxCode: string, baseUrl?: string): string {
    return `${baseUrl || ''}\n---\n${mdxCode}`;
  }

  private static cacheGet(key: string): string | undefined {
    const cached = this.compileCache.get(key);
    if (!cached) {
      return undefined;
    }

    // Refresh insertion order for simple LRU behavior.
    this.compileCache.delete(key);
    this.compileCache.set(key, cached);
    return cached;
  }

  private static cacheSet(key: string, value: string): void {
    if (this.compileCache.has(key)) {
      this.compileCache.delete(key);
    }
    this.compileCache.set(key, value);

    if (this.compileCache.size > this.maxCacheEntries) {
      const firstKey = this.compileCache.keys().next().value;
      if (firstKey) {
        this.compileCache.delete(firstKey);
      }
    }
  }

  public static async compileToJS(mdxCode: string, baseUrl?: string): Promise<string> {
    try {
      const cacheKey = this.getCacheKey(mdxCode, baseUrl);
      const cached = this.cacheGet(cacheKey);
      if (cached) {
        return cached;
      }

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
        const output = String(compiled);
        this.cacheSet(cacheKey, output);
        return output;
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
          const output = String(retried);
          this.cacheSet(cacheKey, output);
          return output;
        }

        throw strictErr;
      }
    } catch (err) {
      console.error('[MdxCompiler] compilation error:', err);
      throw err;
    }
  }
}
