export function initAtomPet() {
  const root = document.getElementById('atm-data-root');
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
  let isAnimating = false;

  const leftPill  = document.getElementById('pill-left');
  const centerPill = document.getElementById('pill-center');
  const rightPill = document.getElementById('pill-right');
  const prevBtn   = document.getElementById('nav-prev');
  const nextBtn   = document.getElementById('nav-next');

  // direction: 1 = right button pressed, -1 = left button pressed
  // Center pill: slides horizontally in the direction of travel.
  // Side pills : simple scale+fade.
  const animatePill = (pill: HTMLElement | null, stat: any, isCenter: boolean, direction: number) => {
    if (!pill || !stat) return;

    // direction=1  → exits LEFT, enters from RIGHT
    // direction=-1 → exits RIGHT, enters from LEFT (mirror)
    const exitX  = isCenter ? `${direction * -22}px` : '0px';
    const enterX = isCenter ? `${direction *  18}px` : '0px';
    const exitScale  = isCenter ? 0.86 : 0.82;
    const enterScale = isCenter ? 0.90 : 0.90;

    // Phase 1: exit — slide + fade out
    pill.style.transition = 'opacity 0.13s ease, transform 0.13s ease';
    pill.style.opacity = '0';
    pill.style.transform = `translateX(${exitX}) scale(${exitScale})`;
    pill.classList.remove('pill-land');

    setTimeout(() => {
      // Swap content while invisible
      const circle = pill.querySelector('.day-circle');
      const value  = pill.querySelector('.pill-value');
      if (circle) circle.innerHTML = stat.icon;
      if (value) { value.textContent = stat.value; value.id = stat.id; }

      // Theme class swap
      pill.classList.forEach(c => { if (c.startsWith('theme-')) pill.classList.remove(c); });
      pill.classList.add(stat.id.replace('stat-', 'theme-'));
      pill.title = stat.label;

      // Start from opposite side (no transition yet)
      pill.style.transition = 'none';
      pill.style.transform = `translateX(${enterX}) scale(${enterScale})`;
      void (pill as HTMLElement).offsetHeight; // force reflow

      // Phase 2: enter — spring for center, snappy for sides
      const easing = isCenter
        ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'  // spring overshoot
        : 'cubic-bezier(0.25, 0.8, 0.25, 1)';
      pill.style.transition = `opacity 0.20s ease, transform 0.28s ${easing}`;
      pill.style.opacity = '1';
      pill.style.transform = 'translateX(0) scale(1)';

      // Extra: glow-pulse on center pill landing
      if (isCenter) {
        setTimeout(() => {
          pill.classList.add('pill-land');
          setTimeout(() => pill.classList.remove('pill-land'), 500);
        }, 240);
      }
    }, 125);
  };

  const updateCarousel = (direction: number = 1) => {
    if (isAnimating) return;
    isAnimating = true;
    setTimeout(() => { isAnimating = false; }, 320);

    const leftIndex  = (currentIndex - 1 + total) % total;
    const rightIndex = (currentIndex + 1) % total;

    animatePill(leftPill,   stats[leftIndex],     false, direction);
    animatePill(centerPill, stats[currentIndex],  true,  direction);
    animatePill(rightPill,  stats[rightIndex],    false, direction);
  };

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + total) % total;
      updateCarousel(-1);
    });

    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % total;
      updateCarousel(1);
    });

    // Initial render — instant, no animation
    const setStatic = (pill: HTMLElement | null, stat: any) => {
      if (!pill || !stat) return;
      const circle = pill.querySelector('.day-circle');
      const value  = pill.querySelector('.pill-value');
      if (circle) circle.innerHTML = stat.icon;
      if (value) { value.textContent = stat.value; value.id = stat.id; }
      pill.classList.forEach(c => { if (c.startsWith('theme-')) pill.classList.remove(c); });
      pill.classList.add(stat.id.replace('stat-', 'theme-'));
      pill.title = stat.label;
      pill.style.opacity = '1';
      pill.style.transform = 'translateY(0) scale(1)';
    };
    setStatic(leftPill,   stats[(currentIndex - 1 + total) % total]);
    setStatic(centerPill, stats[currentIndex]);
    setStatic(rightPill,  stats[(currentIndex + 1) % total]);
  }

  // Teardown hook
  const oldCleanup = (window as any).__atmDataCleanup;
  (window as any).__atmDataCleanup = () => { if (oldCleanup) oldCleanup(); };
}
