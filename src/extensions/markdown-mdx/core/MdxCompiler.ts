export class MdxCompiler {
  public static async compileToJS(mdxCode: string): Promise<string> {
    try {
      const { compile } = await import('@mdx-js/mdx');
      const { default: remarkFrontmatter } = await import('remark-frontmatter');
      const { default: remarkGfm } = await import('remark-gfm');
      
      const compiled = await compile(mdxCode, {
        outputFormat: 'function-body',
        development: false,
        remarkPlugins: [remarkFrontmatter, remarkGfm]
      });
      return String(compiled);
    } catch (err) {
      console.error('[MdxCompiler] compilation error:', err);
      throw err;
    }
  }
}
