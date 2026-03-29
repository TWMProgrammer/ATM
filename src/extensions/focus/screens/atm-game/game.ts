export function initAtomPet() {
  const root = document.getElementById('atm-game-root');
  if (root) {
    console.log('[atm-data] Initialized.');
  }

  // --- Stats Carousel Logic ---
  const prevBtn = document.getElementById('nav-prev');
  const nextBtn = document.getElementById('nav-next');
  const dashboardStats = document.getElementById('dashboard-stats');

  const updatePillClasses = () => {
    if (!dashboardStats) return;
    const pills = Array.from(dashboardStats.querySelectorAll('.stat-pill'));
    if (pills.length === 3) {
      pills.forEach((pill, index) => {
        // Reset classes
        pill.className = 'day-pill stat-pill ' + (index === 1 ? 'large teal active' : 'medium pink');
        
        // Handle inner value font size modifier based on position
        const valueDiv = pill.querySelector('.pill-value');
        if (valueDiv) {
          if (index === 1) valueDiv.classList.add('large-val');
          else valueDiv.classList.remove('large-val');
        }

      });
    }
  };

  if (prevBtn && nextBtn && dashboardStats) {
    prevBtn.addEventListener('click', () => {
      const pills = dashboardStats.querySelectorAll('.stat-pill');
      if (pills.length === 3) {
        // Move last pill to the beginning
        dashboardStats.insertBefore(pills[2], pills[0]);
        updatePillClasses();
      }
    });

    nextBtn.addEventListener('click', () => {
      const pills = dashboardStats.querySelectorAll('.stat-pill');
      if (pills.length === 3) {
        // Move first pill to the end (before the next button)
        dashboardStats.insertBefore(pills[0], nextBtn);
        updatePillClasses();
      }
    });

    // Initial setup
    updatePillClasses();
  }

  // Global teardown mechanism to prevent memory leaks during hot-reloads
  const oldCleanup = (window as any).__atmGameCleanup;
  (window as any).__atmGameCleanup = () => {
    if (oldCleanup) oldCleanup();
    // Teardown logic here (event listeners will be GC'd when elements are replaced)
  };
}
