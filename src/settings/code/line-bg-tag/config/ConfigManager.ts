import * as vscode from 'vscode';
import { LINE_BG_COLORS } from '../ui/colors';

export class ConfigManager {
  public colors: string[] = [];

  public tabmixColor: string = '';
  public indicatorStyle: string = '';
  public lineWidth: number = 1;
  public updateDelay: number = 100;
  public ignoreLinePatterns: RegExp[] = [];
  public colorOnWhiteSpaceOnly: boolean = false;
  public includedLanguages: string[] = [];
  public excludedLanguages: string[] = [];

  public applyNativeEnhancements: boolean = true;

  // Sets for O(1) lookup instead of O(n) includes()
  private includedSet: Set<string> = new Set();
  private excludedSet: Set<string> = new Set();


  constructor() {
    this.reload();
  }

  public reload() {
    const config = vscode.workspace.getConfiguration('indentRainbow');

    // Premium color palette — intermediate opacity for perfect balance
    this.colors =
      config.get<string[]>('colors') ?? LINE_BG_COLORS.defaultColors;

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


    // Build Sets for O(1) lookup
    this.includedSet = new Set(this.includedLanguages);
    this.excludedSet = new Set(this.excludedLanguages);


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
}
