# Restoring Indentation Error Detection

This document contains instructions and code snippets for restoring the red "indentation error" highlighting feature that was intentionally removed to ensure only normal indentation coloring is applied. 

If you or an AI agent need to restore this feature in the future, follow the instructions below to re-add the error detection logic across the three core files.

## 1. `src/settings/code/line-bg-tag/config/ConfigManager.ts`

**Re-add error configuration properties and sets:**

Add the properties near the top of the class:
```typescript
  public errorColor: string = '';
  public ignoreErrorLanguages: string[] = [];
  private ignoreErrorSet: Set<string> = new Set();
```

Inside the `reload()` method, load the configuration and initialize the set:
```typescript
    this.errorColor = config.get<string>('errorColor') ?? 'rgba(239,68,68,0.14)';
    this.ignoreErrorLanguages = config.get<string[]>('ignoreErrorLanguages') ?? [];
    this.ignoreErrorSet = new Set(this.ignoreErrorLanguages);
```

Add the skip logic method back to the class:
```typescript
  /** O(1) error-skip check via Set */
  public shouldSkipErrors(langId: string): boolean {
    if (this.ignoreErrorSet.size === 0) {
      return false;
    }
    return this.ignoreErrorSet.has('*') || this.ignoreErrorSet.has(langId);
  }
```

## 2. `src/settings/code/line-bg-tag/ui/DecoratorManager.ts`

**Re-add the error decoration type:**

Add the property:
```typescript
  public errorDecorationType: vscode.TextEditorDecorationType | null = null;
```

Inside `buildDecorations()`, pull `errorColor` from the config and instantiate the decoration type:
```typescript
    const { colors, indicatorStyle, lineWidth, tabmixColor, errorColor } = this.config;
    // ... loop for normal colors ...

    this.errorDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: errorColor,
    });
```

Make sure to clear it in `clearFromEditors()`:
```typescript
      if (this.errorDecorationType) {
        editor.setDecorations(this.errorDecorationType, empty);
      }
```

Make sure to dispose it in `disposeAll()`:
```typescript
    if (this.errorDecorationType) {
      this.errorDecorationType.dispose();
      this.errorDecorationType = null;
    }
```

## 3. `src/settings/code/line-bg-tag/core/IndentEngine.ts`

**Re-add the engine logic that checks for bad indentations:**

Inside `clearAllDecorations()`, clear the error decorator:
```typescript
    if (this.decorator.errorDecorationType) {
      editor.setDecorations(this.decorator.errorDecorationType, empty);
    }
```

Inside `updateDecorations()`, prepare the array and flags before the loop:
```typescript
    const errorDecorator: vscode.DecorationOptions[] = [];
    const skipAllErrors = this.config.shouldSkipErrors(langId);
```

Inside the `for (let lineIndex = ...)` loop, right after calculating `wsEnd` and `indentWidth`, restore the skip and error detection condition:
```typescript
        // Check if the line should skip error coloring
        let skip = skipAllErrors;

        if (!skip && hasIgnorePatterns) {
          const ignorePatterns = this.config.ignoreLinePatterns;
          const patternsLen = ignorePatterns.length;
          for (let i = 0; i < patternsLen; i++) {
            if (ignorePatterns[i].test(text)) {
              skip = true;
              break;
            }
          }
        }

        // Calculate indent width without creating any new strings
        // Tab = tabSize spaces, Space = 1 space
        let indentWidth = 0;
        for (let i = 0; i < wsEnd; i++) {
          indentWidth += text.charCodeAt(i) === CHAR_TAB ? tabSize : 1;
        }

        // --- RESTORED LOGIC ---
        // Indent error detection (not a multiple of tabSize)
        if (!skip && indentWidth % tabSize !== 0) {
          errorDecorator.push({
            range: new vscode.Range(lineIndex, 0, lineIndex, wsEnd),
          });
        } else {
           // ... (The rest of the normal tabmix and position block parsing logic goes here, nested inside this else block) ...
        }
```

Finally, apply the decorations to the editor at the end of `updateDecorations()`:
```typescript
    if (this.decorator.errorDecorationType) {
      editor.setDecorations(this.decorator.errorDecorationType, errorDecorator);
    }
```
