declare module '@vitalets/google-translate-api' {
  interface TranslateResult {
    text: string;
    raw: unknown;
  }

  interface TranslateOptions {
    to: string;
    from?: string;
  }

  export function translate(
    text: string,
    options: TranslateOptions
  ): Promise<TranslateResult>;
}
