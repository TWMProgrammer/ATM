import * as vscode from 'vscode';

export async function activateColorBgTag(context: vscode.ExtensionContext) {
  // Leemos si el usuario (tú) activaste el color nativo en las configuraciones (por defecto true)
  const isEnabled = vscode.workspace
    .getConfiguration('atm')
    .get<boolean>('colorBgTag.enabled', true);

  if (!isEnabled) {
    return;
  }

  // Un color azul sencillo, sin bordes visibles
  const hexBackground = '#00a37557'; // Azul puro agradable, con transparencia
  const hexBorder = '#00000000'; // HEX Transparencia 100% (Alpha 00) evita fallback

  const config = vscode.workspace.getConfiguration();
  const currentCustomizations = config.inspect<any>(
    'workbench.colorCustomizations',
  );
  const globalColors = currentCustomizations?.globalValue || {};

  let needsUpdate = false;

  // Inyectar nativamente los colores al resaltador de VS Code
  const keys = [
    { key: 'editor.wordHighlightBackground', val: hexBackground },
    { key: 'editor.wordHighlightBorder', val: hexBorder },
    { key: 'editor.wordHighlightStrongBackground', val: hexBackground },
    { key: 'editor.wordHighlightStrongBorder', val: hexBorder },
  ];

  for (const { key, val } of keys) {
    if (globalColors[key] !== val) {
      globalColors[key] = val;
      needsUpdate = true;
    }
  }

  // Escribir los cambios en la configuración global
  if (needsUpdate) {
    try {
      await config.update(
        'workbench.colorCustomizations',
        globalColors,
        vscode.ConfigurationTarget.Global,
      );
      console.log('ATM: Native Tag Colors Injected Successfully');
    } catch (e) {
      console.error('ATM: Failed to apply native tag colors', e);
    }
  }

  // Escuchar si alguien quiere limpiarlo a futuro
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('atm.colorBgTag.enabled')) {
        const enabledNow = vscode.workspace
          .getConfiguration('atm')
          .get<boolean>('colorBgTag.enabled', true);
        if (!enabledNow) {
          // Limpieza: quitamos nuestros colores si el usuario desactiva la opción
          const resetColors =
            vscode.workspace
              .getConfiguration()
              .get<any>('workbench.colorCustomizations') || {};
          keys.forEach(({ key }) => delete resetColors[key]);
          await vscode.workspace
            .getConfiguration()
            .update(
              'workbench.colorCustomizations',
              resetColors,
              vscode.ConfigurationTarget.Global,
            );
        }
      }
    }),
  );
}
