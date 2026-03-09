import * as vscode from 'vscode';

export function createDecorationStyles() {
  const getCommonAfter = (radius: string, padding: string) => ({
    margin: '0 0 0 21px',
    textDecoration: `none; font-family: monospace; font-size: 0.85em; border-radius: ${radius}; padding: ${padding};`,
  });

  const updateAvailableOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: getCommonAfter('4px', '2px 6px'),
    dark: {
      after: {
        backgroundColor: '#ff980022',
        color: '#ffb300',
      }
    },
    light: {
      after: {
        backgroundColor: '#fff3e0cc',
        color: '#e65100',
      }
    }
  });

  const updateRecommendedOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: getCommonAfter('7px', '2px 8px'),
    dark: {
      after: {
        backgroundColor: '#9ca3af33',
        color: '#e5e7eb',
      }
    },
    light: {
      after: {
        backgroundColor: '#00000015',
        color: '#4b5563',
      }
    }
  });

  const upToDateOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: getCommonAfter('12px', '2px 8px'),
    dark: {
      after: {
        backgroundColor: '#4caf5022',
        color: '#4caf50',
      }
    },
    light: {
      after: {
        backgroundColor: '#e8f5e9cc',
        color: '#2e7d32',
      }
    }
  });

  const loadingOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: getCommonAfter('4px', '2px 6px'),
    dark: {
      after: {
        backgroundColor: '#8888881a',
        color: '#888888',
      }
    },
    light: {
      after: {
        backgroundColor: '#00000010',
        color: '#71717a',
      }
    }
  });

  return {
    updateAvailable: updateAvailableOptions,
    updateRecommended: updateRecommendedOptions,
    upToDate: upToDateOptions,
    loading: loadingOptions,
    dispose: () => {
      updateAvailableOptions.dispose();
      updateRecommendedOptions.dispose();
      upToDateOptions.dispose();
      loadingOptions.dispose();
    },
  };
}
