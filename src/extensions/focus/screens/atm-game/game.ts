import { ArenaEngine } from './arena/arena.engine';

export function initAtomPet() {
  const engine = new ArenaEngine();
  engine.start();

  // Expose global clean-up mechanism for multiple runs during development
  (window as any).__atmGameCleanup = () => {
    engine.stop();
  };
}
