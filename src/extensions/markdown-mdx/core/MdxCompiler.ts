/// <reference types="react" />
import * as React from 'react';

export class MdxCompiler {
  public static async compileToJS(mdxCode: string): Promise<string> {
    try {
      const { compile } = await import('@mdx-js/mdx');
      const compiled = await compile(mdxCode, {
        outputFormat: 'function-body',
        development: false
      });
      return String(compiled);
    } catch (err) {
      console.error('[MdxCompiler] compilation error:', err);
      throw err;
    }
  }
}
