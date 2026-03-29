export function initAtomPet() {
  const root = document.getElementById('atm-game-root');
  if (root) {
    console.log('[atm-data] Initialized.');
  }

  // --- Data & Logic for Carousel ---
  const stats = [
    {
      id: 'stat-time',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      value: '2h',
      label: 'Tiempo en VS Code'
    },
    {
      id: 'stat-commits',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"></path><path d="M12 12v3"></path></svg>',
      value: '4',
      label: 'Commits Hoy'
    },
    {
      id: 'stat-files',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>',
      value: '12',
      label: 'Archivos Tocados'
    },
    {
      id: 'stat-streak',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>',
      value: '5',
      label: 'Días de Racha'
    }
  ];

  let currentIndex = 1; // Centro empieza en Commits
  const total = stats.length;

  const leftPill = document.getElementById('pill-left');
  const centerPill = document.getElementById('pill-center');
  const rightPill = document.getElementById('pill-right');
  const prevBtn = document.getElementById('nav-prev');
  const nextBtn = document.getElementById('nav-next');
  
  const renderPill = (pill: HTMLElement | null, stat: any) => {
    if (!pill || !stat) return;
    pill.style.opacity = '0';
    pill.style.transform = 'scale(0.8)';
    pill.title = stat.label;
    
    setTimeout(() => {
      const circle = pill.querySelector('.day-circle');
      const value = pill.querySelector('.pill-value');
      if (circle) circle.innerHTML = stat.icon;
      if (value) {
        value.textContent = stat.value;
        value.id = stat.id;
      }

      // Update theme class
      const currentThemes = Array.from(pill.classList).filter(c => c.startsWith('theme-'));
      currentThemes.forEach(c => pill.classList.remove(c));
      const newTheme = stat.id.replace('stat-', 'theme-');
      pill.classList.add(newTheme);

      pill.style.opacity = '1';
      pill.style.transform = 'scale(1)';
    }, 150);
  };

  const updateCarousel = () => {
    const leftIndex = (currentIndex - 1 + total) % total;
    const rightIndex = (currentIndex + 1) % total;

    renderPill(leftPill, stats[leftIndex]);
    renderPill(centerPill, stats[currentIndex]);
    renderPill(rightPill, stats[rightIndex]);
  };

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + total) % total;
      updateCarousel();
    });

    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % total;
      updateCarousel();
    });

    // Initial render
    // Trigger instantly for initial load
    if (leftPill) { leftPill.style.transition = 'all 0.3s ease'; }
    if (centerPill) { centerPill.style.transition = 'all 0.3s ease'; }
    if (rightPill) { rightPill.style.transition = 'all 0.3s ease'; }
    
    updateCarousel();
  }

  // Global teardown mechanism to prevent memory leaks during hot-reloads
  const oldCleanup = (window as any).__atmGameCleanup;
  (window as any).__atmGameCleanup = () => {
    if (oldCleanup) oldCleanup();
  };
}
