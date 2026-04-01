import * as htmlToImage from 'html-to-image';

declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

let isTakingSnapshot = false;

document.addEventListener('DOMContentLoaded', () => {
    const containerNode = document.querySelector('.dashboard-container') as HTMLElement | null;
    const actionFooter = document.getElementById('actionFooter') as HTMLElement | null;
    const downloadBtn = document.getElementById('downloadBtn');
    const shareTwitterBtn = document.getElementById('shareTwitterBtn');

    if (!containerNode || !actionFooter || !downloadBtn || !shareTwitterBtn) {
        return;
    }

    // --- SHARE LOGIC ---
    shareTwitterBtn.addEventListener('click', () => {
        const handle = document.getElementById('ui-handle')?.textContent?.trim()?.replace('@', '') || '';
        const url = `https://x.com/${handle}`;
        
        // Use vscode API to open the URL in the system browser
        vscode.postMessage({
            command: 'openExternalBrowser',
            url: url
        });
    });

    // --- DOWNLOAD LOGIC ---
    downloadBtn.addEventListener('click', async () => {
        // Only allow download if we are not already downloading AND the data has fully loaded
        if (isTakingSnapshot || !downloadBtn.classList.contains('ready')) {
            return;
        }

        // Security & Performance: Use textContent over innerText to avoid forced reflows
        const originalText = downloadBtn.querySelector('span')?.textContent || 'Download Snapshot';
        const spanNode = downloadBtn.querySelector('span');

        try {
            isTakingSnapshot = true;
            downloadBtn.classList.add('loading');
            if (spanNode) {
                spanNode.textContent = "Capturing...";
            }

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
            if (spanNode) {
                spanNode.textContent = "Saved!";
            }
            
            // Restore animation/transform
            containerNode.style.transform = prevTransform;
            setTimeout(() => { containerNode.style.transition = prevTransition; }, 50);

            setTimeout(() => {
                downloadBtn.classList.remove('success');
                if (spanNode) {
                    spanNode.textContent = originalText;
                }
            }, 2500);

        } catch (err: any) {
            downloadBtn.classList.remove('loading');
            if (spanNode) {
                spanNode.textContent = "Failed";
            }
            vscode.postMessage({ command: 'error', text: err.hasOwnProperty('message') ? err.message : String(err) });
            
            setTimeout(() => {
                if (spanNode) {
                    spanNode.textContent = originalText;
                }
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
                if (handleEl) {
                    handleEl.textContent = msg.newNickname.startsWith('@') ? msg.newNickname : `@${msg.newNickname}`;
                }
            }

            const currentNickname = handleEl?.textContent?.trim() ?? '';
            
            const mappings: Record<string, string> = {
                'ui-name': data.name || currentNickname.replace('@', ''),
                'ui-followers': data.followers.toString(),
                'ui-following': data.following.toString(),
                'ui-bio': data.bio || 'Programming enthusiast.',
                'ui-commits': `${data.totalCommits.toLocaleString()} Commits`,
                'ui-years': `Week`,
                'ui-heat-year': currentYear,
                'ui-heat-commits': `${data.totalCommitsYear.toLocaleString()} Commits,`,
                'ui-heat-days': `${data.activeDays || 0} Days,`,
                'ui-heat-streak': `${data.dayStreak} Days`,
                'ui-stat-time': data.timeLabel,
                'ui-stat-commits': data.commitsToday.toString(),
                'ui-stat-files': data.filesChanged.toString(),
                'ui-stat-streak': data.dayStreak.toString()
            };

            // Update Month Labels dynamically
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const heatmapMonths = document.querySelector('.heatmap-months');
            const gridEl = document.getElementById('heatmapGrid');

            // Use heatmapMonthPositions if available, otherwise fallback
            if (heatmapMonths) {
                heatmapMonths.innerHTML = '';
                if (data.heatmapMonthPositions && data.heatmapMonthPositions.length > 0) {
                    // Show only the distinct months from the data in order
                    for (const pos of data.heatmapMonthPositions) {
                        const span = document.createElement('span');
                        span.textContent = monthNames[pos.month];
                        heatmapMonths.appendChild(span);
                    }
                } else {
                    // Fallback: 12 months starting from next month
                    const curMonth = new Date().getMonth();
                    for (let i = 1; i <= 12; i++) {
                        const span = document.createElement('span');
                        span.textContent = monthNames[(curMonth + i) % 12];
                        heatmapMonths.appendChild(span);
                    }
                }
            }

            for (const [id, value] of Object.entries(mappings)) {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = value;
                    el.style.width = 'auto'; // Clear skeleton width
                }
            }

            const nameEl = document.getElementById('ui-name');
            if (nameEl) {
                nameEl.style.width = 'auto';
            }
            if (handleEl) {
                handleEl.style.width = 'auto';
            }

            if (data.avatarUrl) {
                const img = document.getElementById('ui-avatar') as HTMLImageElement;
                if (img) {
                    img.src = data.avatarUrl;
                }
            }

            // Remove skeletons to reveal UI with staggered top-to-bottom animation
            requestAnimationFrame(() => {
                // Group UI elements roughly by semantic rows
                const rowGroups = [
                    // Row 1: Profile details
                    ['ui-avatar', 'ui-name', 'ui-handle', 'ui-followers', 'ui-following', 'ui-bio'],
                    // Row 2: Heatmap stats
                    ['ui-commits', 'ui-years', 'ui-heat-year', 'ui-heat-commits', 'ui-heat-days', 'ui-heat-streak', '.heatmap-fire'],
                    // Row 3: The actual heatmap grid (we'll just use a special string to denote it)
                    ['HEATMAP'],
                    // Row 4: Today stats cards
                    ['ui-stat-time', 'ui-stat-commits', 'ui-stat-files', 'ui-stat-streak'],
                    // Row 5: Footer Actions
                    ['downloadBtn']
                ];

                let heatmapDelay = 0;

                // Animate elements row by row
                rowGroups.forEach((group, rowIndex) => {
                    const delay = rowIndex * 0.1; // 100ms per row wave

                    group.forEach(selector => {
                        if (selector === 'HEATMAP') {
                            heatmapDelay = delay;
                            if (heatmapMonths) {
                                heatmapMonths.querySelectorAll('span').forEach(el => {
                                    el.classList.add('reveal-anim');
                                    (el as HTMLElement).style.animationDelay = `${delay}s`;
                                });
                            }
                            return;
                        }

                        // Try finding by ID first, then fallback to classes
                        const elements = document.getElementById(selector) 
                            ? [document.getElementById(selector)]
                            : Array.from(document.querySelectorAll(selector.startsWith('.') ? selector : `.${selector}`));

                        elements.forEach(el => {
                            if (el) {
                                el.classList.remove('skeleton');
                                el.classList.add('reveal-anim');
                                (el as HTMLElement).style.animationDelay = `${delay}s`;
                            }
                        });
                    });
                });

                // Clear any other leftover skeletons (just in case they weren't in a group)
                document.querySelectorAll('.skeleton').forEach(el => {
                    el.classList.remove('skeleton');
                });

                // Add heatmap data using the padded grid format (handles partial weeks correctly)
                if (gridEl && data.heatmapGrid && data.heatmapGrid.length > 0) {
                    const gridData = data.heatmapGrid as number[];
                    
                    // Rebuild grid with exact number of cells matching the data
                    gridEl.innerHTML = '';
                    const frag = document.createDocumentFragment();
                    for (let i = 0; i < gridData.length; i++) {
                        const cell = document.createElement('div');
                        cell.className = 'heatmap-cell reveal-anim';
                        cell.style.animationDelay = `${heatmapDelay}s`;
                        
                        if (gridData[i] === -1) {
                            cell.classList.add('hidden');
                        } else if (gridData[i] > 0) {
                            cell.classList.add(`level-${gridData[i]}`);
                        }
                        frag.appendChild(cell);
                    }
                    gridEl.appendChild(frag);
                } else if (data.heatmapData && Array.isArray(data.heatmapData)) {
                    // Fallback: old format - apply levels to existing skeleton cells
                    const cells = document.querySelectorAll('.heatmap-cell');
                    data.heatmapData.forEach((level: number, i: number) => {
                        if (cells[i]) {
                            cells[i].className = 'heatmap-cell reveal-anim';
                            (cells[i] as HTMLElement).style.animationDelay = `${heatmapDelay}s`;
                            if (level > 0) {
                                cells[i].classList.add(`level-${level}`);
                            }
                        }
                    });
                }
                
                // Enable download button
                const dBtn = document.getElementById('downloadBtn');
                if (dBtn) dBtn.classList.add('ready');
            });
        } else if (msg.command === 'showSkeletons') {
            // Remove lingering animations
            document.querySelectorAll('.reveal-anim').forEach(el => {
                el.classList.remove('reveal-anim');
                (el as HTMLElement).style.animationDelay = '';
            });

            const elsToSkeleton = [
                'ui-avatar', 'ui-name', 'ui-handle', 'ui-followers', 'ui-following', 'ui-bio',
                'ui-commits', 'ui-years', 'ui-heat-year', 'ui-heat-commits', 'ui-heat-days',
                'ui-heat-streak', 'ui-stat-time', 'ui-stat-commits', 'ui-stat-files', 'ui-stat-streak'
            ];
            elsToSkeleton.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.add('skeleton');
                }
            });
            const heatmapCells = document.querySelectorAll('.heatmap-cell');
            heatmapCells.forEach(cell => cell.classList.add('skeleton'));
            const fireIcon = document.querySelector('.heatmap-fire');
            if (fireIcon) {
                fireIcon.classList.add('skeleton');
            }
            
            // Disable download button
            const dBtn = document.getElementById('downloadBtn');
            if (dBtn) {
                dBtn.classList.remove('ready');
            }
        }
    });
});
