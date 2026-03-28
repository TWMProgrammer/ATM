import { ArenaEngine } from './arena/arena.engine';
import { AtomEntity } from './atom/atom.entity';

/**
 * Initializes the game and binds it to the current view.
 * You can mount any custom GameObject into the ArenaEngine here.
 */
export function initAtomPet() {
  const engine = new ArenaEngine();
  
  const canvas = document.getElementById('atomCanvas') as HTMLCanvasElement | null;
  if (canvas) {
    // Instantiate our minimalist Atom pet
    const atom = new AtomEntity(canvas.clientWidth / 2, canvas.clientHeight / 2);
    
    // Abstract Engine architecture: Add any entity you want!
    // Example: engine.addGameObject(new Coin(x, y));
    engine.addGameObject(atom);
  }

  // Starts the ~60FPS game loop and resize observers
  engine.start();

  // Expose a global teardown mechanism to prevent memory leaks during hot-reloads
  (window as any).__atmGameCleanup = () => {
    engine.stop();
  };
}
