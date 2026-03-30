import * as htmlToImage from 'html-to-image';

declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

let isTakingSnapshot = false;

document.addEventListener('DOMContentLoaded', () => {
    const containerNode = document.querySelector('.dashboard-container') as HTMLElement | null;
    const actionFooter = document.getElementById('actionFooter') as HTMLElement | null;
    const downloadBtn = document.getElementById('downloadBtn');
    const shareTwitterBtn = document.getElementById('shareTwitterBtn');

    if (!containerNode || !actionFooter || !downloadBtn || !shareTwitterBtn) return;

    // --- SHARE LOGIC ---
    shareTwitterBtn.addEventListener('click', () => {
        const url = `https://x.com/gohitx`;
        
        // Use vscode API to open the URL in the system browser
        vscode.postMessage({
            command: 'openExternalBrowser',
            url: url
        });
    });

    // --- DOWNLOAD LOGIC ---
    downloadBtn.addEventListener('click', async () => {
        if (isTakingSnapshot) return;

        const originalText = downloadBtn.querySelector('span')?.innerText || 'Download Snapshot';
        const spanNode = downloadBtn.querySelector('span');

        try {
            isTakingSnapshot = true;
            downloadBtn.classList.add('loading');
            if (spanNode) spanNode.innerText = "Capturing...";

            // Temporarily reset transforms for capture
            const prevTransform = containerNode.style.transform;
            const prevTransition = containerNode.style.transition;
            containerNode.style.transition = 'none';
            containerNode.style.transform = 'scale(1) translateY(0)';
            
            // Wait for paint to reflow correctly without the footer
            await new Promise(r => setTimeout(r, 80));

            const scale = 2; // High resolution rendering
            const dataUrl = await htmlToImage.toPng(containerNode, {
                pixelRatio: scale,
                skipFonts: true, // Speeds up capturing
            });

            vscode.postMessage({
                command: 'saveImage',
                data: dataUrl,
            });

            // Revert state
            downloadBtn.classList.remove('loading');
            downloadBtn.classList.add('success');
            if (spanNode) spanNode.innerText = "Saved!";
            
            // Restore animation/transform
            containerNode.style.transform = prevTransform;
            setTimeout(() => { containerNode.style.transition = prevTransition; }, 50);

            setTimeout(() => {
                downloadBtn.classList.remove('success');
                if (spanNode) spanNode.innerText = originalText;
            }, 2000);

        } catch (err: any) {
            downloadBtn.classList.remove('loading');
            if (spanNode) spanNode.innerText = "Failed";
            vscode.postMessage({ command: 'error', text: err.message });
            
            setTimeout(() => {
                if (spanNode) spanNode.innerText = originalText;
            }, 2000);
        } finally {
            isTakingSnapshot = false;
        }
    });

    // Close window via mac red button
    const closeBtn = document.querySelector('.mac-button.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'closePanel' });
        });
    }
});
