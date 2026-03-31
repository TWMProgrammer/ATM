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

        // Security & Performance: Use textContent over innerText to avoid forced reflows
        const originalText = downloadBtn.querySelector('span')?.textContent || 'Download Snapshot';
        const spanNode = downloadBtn.querySelector('span');

        try {
            isTakingSnapshot = true;
            downloadBtn.classList.add('loading');
            if (spanNode) spanNode.textContent = "Capturing...";

            // Performance: Temporarily reset complex CSS properties for rapid capture
            const prevTransform = containerNode.style.transform;
            const prevTransition = containerNode.style.transition;
            const prevBackdrop = containerNode.style.backdropFilter;
            const prevWebkitBackdrop = (containerNode.style as any).webkitBackdropFilter;
            const prevBackground = containerNode.style.background;
            const prevBoxShadow = containerNode.style.boxShadow;
            
            // Background resolution: get current body background based on VS Code theme
            const bodyBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim() || '#050505';

            containerNode.style.transition = 'none';
            containerNode.style.transform = 'scale(1) translateY(0)';
            
            // Removing backdrop-filter and box-shadow makes html-to-image significantly faster
            containerNode.style.backdropFilter = 'none';
            (containerNode.style as any).webkitBackdropFilter = 'none';
            containerNode.style.boxShadow = 'none';
            containerNode.style.background = 'var(--card-bg, #121212)';
            
            // Wait for paint to reflow correctly
            await new Promise(r => requestAnimationFrame(r));
            await new Promise(r => setTimeout(r, 80));

            const scale = 2; // High resolution rendering
            const dataUrl = await htmlToImage.toJpeg(containerNode, {
                pixelRatio: scale,
                quality: 0.95,
                skipFonts: true, // Speeds up capturing
                backgroundColor: bodyBg, // Fix for transparent exports! Adds solid background
                style: {
                    margin: '0',
                    border: '1px solid #30363d', // Fallback border if CSS vars fail
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)' // Static shadow for aesthetic export
                }
            });

            // Revert DOM state immediately after capture to unblock UI
            containerNode.style.backdropFilter = prevBackdrop;
            (containerNode.style as any).webkitBackdropFilter = prevWebkitBackdrop;
            containerNode.style.background = prevBackground;
            containerNode.style.boxShadow = prevBoxShadow;

            vscode.postMessage({
                command: 'saveImage',
                data: dataUrl,
                extension: 'jpg'
            });

            // Revert Button state
            downloadBtn.classList.remove('loading');
            downloadBtn.classList.add('success');
            if (spanNode) spanNode.textContent = "Saved!";
            
            // Restore animation/transform
            containerNode.style.transform = prevTransform;
            setTimeout(() => { containerNode.style.transition = prevTransition; }, 50);

            setTimeout(() => {
                downloadBtn.classList.remove('success');
                if (spanNode) spanNode.textContent = originalText;
            }, 2500);

        } catch (err: any) {
            downloadBtn.classList.remove('loading');
            if (spanNode) spanNode.textContent = "Failed";
            vscode.postMessage({ command: 'error', text: err.hasOwnProperty('message') ? err.message : String(err) });
            
            setTimeout(() => {
                if (spanNode) spanNode.textContent = originalText;
            }, 2500);
        } finally {
            isTakingSnapshot = false;
        }
    });

    // --- SKELETON & DATA FETCH LOGIC ---
    const handleEl = document.getElementById('ui-handle');
    const nicknameStr = handleEl?.textContent?.trim() ?? '';
    vscode.postMessage({ command: 'requestData', nickname: nicknameStr });

    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg.command === 'updateData') {
            const data = msg.data;
            const currentYear = new Date().getFullYear().toString();
            
            if (msg.newNickname) {
                if (handleEl) handleEl.textContent = msg.newNickname.startsWith('@') ? msg.newNickname : `@${msg.newNickname}`;
            }

            const currentNickname = handleEl?.textContent?.trim() ?? '';
            
            const mappings: Record<string, string> = {
                'ui-name': data.name || currentNickname.replace('@', ''),
                'ui-followers': data.followers.toString(),
                'ui-following': data.following.toString(),
                'ui-bio': data.bio || 'Programming enthusiast.',
                'ui-commits': `${data.totalCommits.toLocaleString()} Commits`,
                'ui-years': `${data.years} ${data.years === 1 ? 'Year' : 'Years'}`,
                'ui-heat-year': currentYear,
                'ui-heat-commits': `${data.totalCommitsYear} Commits,`,
                'ui-heat-days': `${data.activeDays || 0} Days,`,
                'ui-heat-streak': `${data.dayStreak} Days`,
                'ui-stat-time': data.timeLabel,
                'ui-stat-commits': data.commitsToday.toString(),
                'ui-stat-files': data.filesChanged.toString(),
                'ui-stat-streak': data.dayStreak.toString()
            };

            for (const [id, value] of Object.entries(mappings)) {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = value;
                    el.style.width = 'auto'; // Clear skeleton width
                }
            }

            const nameEl = document.getElementById('ui-name');
            if (nameEl) nameEl.style.width = 'auto';
            if (handleEl) handleEl.style.width = 'auto';

            if (data.avatarUrl) {
                const img = document.getElementById('ui-avatar') as HTMLImageElement;
                if (img) img.src = data.avatarUrl;
            }

            // Remove skeletons to reveal UI
            requestAnimationFrame(() => {
                document.querySelectorAll('.skeleton').forEach(el => {
                    el.classList.remove('skeleton');
                });
                
                // Add heatmap data
                if (data.heatmapData && Array.isArray(data.heatmapData)) {
                    const cells = document.querySelectorAll('.heatmap-cell');
                    data.heatmapData.forEach((level: number, i: number) => {
                        if (cells[i]) {
                            cells[i].className = 'heatmap-cell';
                            if (level > 0) {
                                cells[i].classList.add(`level-${level}`);
                            }
                        }
                    });
                }
            });
        } else if (msg.command === 'showSkeletons') {
            const elsToSkeleton = [
                'ui-avatar', 'ui-name', 'ui-handle', 'ui-followers', 'ui-following', 'ui-bio',
                'ui-commits', 'ui-years', 'ui-heat-year', 'ui-heat-commits', 'ui-heat-days',
                'ui-heat-streak', 'ui-stat-time', 'ui-stat-commits', 'ui-stat-files', 'ui-stat-streak'
            ];
            elsToSkeleton.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('skeleton');
            });
            const heatmapCells = document.querySelectorAll('.heatmap-cell');
            heatmapCells.forEach(cell => cell.classList.add('skeleton'));
            const fireIcon = document.querySelector('.heatmap-fire');
            if (fireIcon) fireIcon.classList.add('skeleton');
        }
    });

    // Close window
    const closeBtn = document.querySelector('.mac-button.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'closePanel' });
        });
    }
});
