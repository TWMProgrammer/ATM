import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('🎉 La extensión "atm" está activa.');

  const disposable = vscode.commands.registerCommand(
    'atm.helloWorld',
    async () => {
      // Muestra un cuadro modal encima de todo
      await vscode.window.showInformationMessage(
        '¡Hola desde ATM!',
        { modal: true },
        'OK'
      );
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
