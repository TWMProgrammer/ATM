import * as vscode from 'vscode';
import { ProcessFinder } from './process-finder';
import { QuotaManager } from './quota-manager';
import { buildTooltip } from './tooltip-builder';

let statusBarItem: vscode.StatusBarItem;
let processFinder: ProcessFinder;
let quotaManager: QuotaManager;
let updateInterval: NodeJS.Timeout;

export function activateDataId(context: vscode.ExtensionContext): void {
    const appName = vscode.env.appName || '';
    const isAntigravity = appName.toLowerCase().includes('antigravity');

    vscode.commands.executeCommand('setContext', 'atm.isAntigravity', isAntigravity);

    if (isAntigravity) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = '$(sparkle-filled) AI Data'; 
        statusBarItem.tooltip = new vscode.MarkdownString('*Cargando consumo de AI...*');
        statusBarItem.show();

        processFinder = new ProcessFinder();
        quotaManager = new QuotaManager();

        // Comando interno de utilidad para refrescar (usado desde el link del Tooltip)
        const refreshCommand = vscode.commands.registerCommand('atm.dataId.refreshConsumption', async () => {
             // Mostramos estado temporal de carga
             statusBarItem.text = '$(sync~spin) AI Data';
             await fetchAndUpdateQuota();
             vscode.window.showInformationMessage('Datos de uso de IA actualizados correctamente.');
        });

        // Comando al clickear el Status Bar (mantiene compatibilidad con el de CommandPalette)
        const showCmd = vscode.commands.registerCommand('atm.dataId.showConsumption', async () => {
             vscode.commands.executeCommand('atm.dataId.refreshConsumption');
        });

        context.subscriptions.push(statusBarItem, refreshCommand, showCmd);

        // Disparamos la primera llamada en segundo plano (para que esté listo si hacen hover)
        // Agregamos un pequeñísimo delay para no empantanar o robar CPU del inicio de la app.
        setTimeout(() => {
            fetchAndUpdateQuota();
        }, 3000);
        
        // Hacemos Polling pasivo cada 2 minutos (120,000 ms)
        updateInterval = setInterval(() => {
             fetchAndUpdateQuota();
        }, 120 * 1000);
    }
}

/**
 * Función base que orquesta el encontrar el proceso y pedir los datos
 */
async function fetchAndUpdateQuota() {
    try {
        let processInfo = quotaManager.getProcessInfo();
        
        // 1. Si NO tenemos puerto aún, salimos a buscar a memoria el proceso de Antigravity
        if (!processInfo) {
            processInfo = await processFinder.detectProcessInfo(2);
            if (processInfo) {
                quotaManager.init(processInfo.connect_port, processInfo.csrf_token);
                statusBarItem.text = '$(sparkle-filled) AI Data';
            } else {
                statusBarItem.text = '$(error) AI Data';
                statusBarItem.tooltip = new vscode.MarkdownString('No se pudo conectar al proceso local de Antigravity AI.');
                return;
            }
        }

        // 2. Fetch via Local HTTP a los contadores
        const snapshot = await quotaManager.fetchQuota();
        if (snapshot) {
             const md = buildTooltip(snapshot);
             statusBarItem.tooltip = md;
             statusBarItem.text = '$(sparkle-filled) AI Data';
        }

    } catch (e) {
        console.error('ATM Data ID: Error fetching quota:', e);
        // Reseteamos puerto para obligar a buscar el ejecutable otra vez el próximo intento
        quotaManager.init(0, ''); 
        statusBarItem.text = '$(warning) AI Data';
        statusBarItem.tooltip = new vscode.MarkdownString('Error parcial de conexión. Se reintentará automáticamante...');
    }
}
