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

  constructor() {
    this.reload();
  }

  public reload() {
    const config = vscode.workspace.getConfiguration('indentRainbow');
    this.colors = config.get<string[]>('colors') ?? [
      'rgba(255,255,64,0.07)',
      'rgba(127,255,127,0.07)',
      'rgba(255,127,255,0.07)',
      'rgba(79,236,236,0.07)',
    ];
    this.errorColor = config.get<string>('errorColor') ?? 'rgba(128,32,32,0.3)';
    this.tabmixColor = config.get<string>('tabmixColor') ?? '';
    this.indicatorStyle = config.get<string>('indicatorStyle') ?? 'classic';
    this.lineWidth = config.get<number>('lightIndicatorStyleLineWidth') ?? 1;
    this.updateDelay = config.get<number>('updateDelay') ?? 100;
    this.colorOnWhiteSpaceOnly =
      config.get<boolean>('colorOnWhiteSpaceOnly') ?? false;

    this.includedLanguages = config.get<string[]>('includedLanguages') ?? [];
    this.excludedLanguages = config.get<string[]>('excludedLanguages') ?? [];
    this.ignoreErrorLanguages =
      config.get<string[]>('ignoreErrorLanguages') ?? [];

    const ignorePatternsConfig = config.get<any[]>('ignoreLinePatterns') ?? [];
    this.ignoreLinePatterns = ignorePatternsConfig
      .map((pattern) => {
        if (typeof pattern === 'string') {
          const match = pattern.match(/^\/(.*?)\/([gimsuy]*)$/);
          if (match) {
            return new RegExp(match[1], match[2]);
          }
          return new RegExp(pattern);
        }
        return new RegExp('');
      })
      .filter((r) => r.source !== '(?:)');
  }
}
