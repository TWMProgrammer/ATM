/**
 * Initializes the data screen.
 */
export function initAtomPet() {
  const root = document.getElementById('atm-game-root');
  if (root) {
    console.log('[atm-data] Initialized.');
  }

  // Global teardown mechanism to prevent memory leaks during hot-reloads
  (window as any).__atmGameCleanup = () => {
    // Teardown logic here
  };
}
