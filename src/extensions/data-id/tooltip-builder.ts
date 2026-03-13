import * as vscode from 'vscode';
import { quota_snapshot } from './types';

/**
 * Builds a Rich Markdown Tooltip simulating the visual style 
 * of premium panels like Copilot Pro Status inside VS Code.
 */
export function buildTooltip(snapshot: quota_snapshot): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    // Importante para habilitar formato avanzado como HTML seguro 
    md.isTrusted = true;
    md.supportHtml = true;

    md.appendMarkdown('### $(sparkle) Antigravity AI Data\n');
    md.appendMarkdown('---\n\n');

    if (snapshot.models.length === 0) {
        md.appendMarkdown('*$(sync~spin) Waiting for quota information...*\n');
        return md;
    }

    // Recorrer los modelos
    for (const m of snapshot.models) {
        let isIncluded = m.remaining_percentage === undefined;
        let percentageText = isIncluded ? 'Included' : `${m.remaining_percentage!.toFixed(1)}%`;
        
        // Título del modelo con el % al lado (o 'Included')
        md.appendMarkdown(`**${m.label}** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${percentageText}\n\n`);
        
        if (!isIncluded) {
             const bar = generateProgressBar(m.remaining_percentage!);
             md.appendMarkdown(`${bar}\n\n`);
        } else {
             md.appendMarkdown(`$(check) *Premium unlimited model*\n\n`);
        }

        // Info extra de cuota y recargas
        if (m.is_exhausted) {
             md.appendMarkdown(`$(error) Exhausted. Allowance resets in **${m.time_until_reset_formatted}**.\n\n`);
        } else if (!isIncluded) {
             md.appendMarkdown(`$(clock) Allowance resets in ${m.time_until_reset_formatted}.\n\n`);
        }
        
        md.appendMarkdown('---\n\n');
    }

    // Pie de página útil, agregando un enlace para refrescar sin tener que usar paleta.
    md.appendMarkdown('\n\n[$(refresh) Refresh usage statistics](command:atm.dataId.refreshConsumption)');

    return md;
}

/**
 * Genera barras de progreso interactivas usando caracteres de Bloque para dar un 
 * look de 'barra solida' como en el screenshot que diste.
 * Utilizamos emojis de colores como base dependiendo del % de "salud".
 */
function generateProgressBar(percentage: number): string {
    const totalBlocks = 18;
    const filled = Math.round((percentage / 100) * totalBlocks);
    const empty = Math.max(0, totalBlocks - filled);
    
    // Cambiamos colores dependiendo de cuánto queda
    let colorBlock = '🟩';
    if (percentage < 15) {
        colorBlock = '🟥';
    } else if (percentage < 40) {
        colorBlock = '🟨';
    } else if (percentage < 70) {
        colorBlock = '🟦';
    }
    
    return colorBlock.repeat(filled) + '⬛'.repeat(empty);
}
