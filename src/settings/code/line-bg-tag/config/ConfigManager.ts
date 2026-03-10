import * as vscode from 'vscode';

export class ConfigManager {
  public colors: string[] = [];
  public errorColor: string = '';
  public tabmixColor: string = '';
  public indicatorStyle: string = '';
  public lineWidth: number = 1;
  public updateDelay: number = 100;
  public ignoreLinePatterns: RegExp[] = [];
  public colorOnWhiteSpaceOnly: boolean = false;
  public includedLanguages: string[] = [];
  public excludedLanguages: string[] = [];
  public ignoreErrorLanguages: string[] = [];
  public applyNativeEnhancements: boolean = true;

  // Sets for O(1) lookup instead of O(n) includes()
  private includedSet: Set<string> = new Set();
  private excludedSet: Set<string> = new Set();
  private ignoreErrorSet: Set<string> = new Set();

  constructor() {
    this.reload();
  }

  public reload() {
    const config = vscode.workspace.getConfiguration('indentRainbow');

    // Premium color palette — intermediate opacity for perfect balance
    this.colors = config.get<string[]>('colors') ?? [
      'rgba(99,102,241,0.09)', // Indigo
      'rgba(16,185,129,0.09)', // Emerald
      'rgba(245,158,11,0.09)', // Amber
      'rgba(244,63,94,0.09)', // Rose
    ];

    this.errorColor =
      config.get<string>('errorColor') ?? 'rgba(239,68,68,0.14)';
    this.tabmixColor = config.get<string>('tabmixColor') ?? '';
    this.indicatorStyle = config.get<string>('indicatorStyle') ?? 'classic';
    this.lineWidth = config.get<number>('lightIndicatorStyleLineWidth') ?? 1;
    this.updateDelay = config.get<number>('updateDelay') ?? 100;
    this.colorOnWhiteSpaceOnly =
      config.get<boolean>('colorOnWhiteSpaceOnly') ?? false;
    this.applyNativeEnhancements =
      config.get<boolean>('applyNativeEnhancements') ?? true;

    this.includedLanguages = config.get<string[]>('includedLanguages') ?? [];
    this.excludedLanguages = config.get<string[]>('excludedLanguages') ?? [];
    this.ignoreErrorLanguages =
      config.get<string[]>('ignoreErrorLanguages') ?? [];

    // Build Sets for O(1) lookup
    this.includedSet = new Set(this.includedLanguages);
    this.excludedSet = new Set(this.excludedLanguages);
    this.ignoreErrorSet = new Set(this.ignoreErrorLanguages);

    const ignorePatternsConfig = config.get<any[]>('ignoreLinePatterns') ?? [];

    this.ignoreLinePatterns = ignorePatternsConfig
      .map((pattern) => {
        if (typeof pattern === 'string') {
          try {
            const match = pattern.match(/^\/(.*?)\/([gimsuy]*)$/);
            if (match) {
              // Strip 'g' flag to prevent stateful lastIndex bug in test()
              const safeFlags = match[2].replace(/g/g, '');
              return new RegExp(match[1], safeFlags);
            }
            return new RegExp(pattern);
          } catch (e) {
            console.warn(
              `[Atm Extension] Invalid regex provided in settings: ${pattern}`,
              e,
            );
            return null;
          }
        }
        return null;
      })
      .filter((r): r is RegExp => r !== null && r.source !== '(?:)');
  }

  /** O(1) language check via Set */
  public isLanguageIncluded(langId: string): boolean {
    if (this.includedSet.size > 0 && !this.includedSet.has(langId)) {
      return false;
    }
    if (this.excludedSet.size > 0 && this.excludedSet.has(langId)) {
      return false;
    }
    return true;
  }

  /** O(1) error-skip check via Set */
  public shouldSkipErrors(langId: string): boolean {
    if (this.ignoreErrorSet.size === 0) {
      return false;
    }
    return this.ignoreErrorSet.has('*') || this.ignoreErrorSet.has(langId);
  }
}
