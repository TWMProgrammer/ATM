export type PetState = 'IDLE' | 'CODING' | 'SLEEPING';

export class AtomEntity {
  x: number = 0;
  y: number = 0;
  targetX: number = 0;
  targetY: number = 0;
  state: PetState = 'IDLE';

  constructor(startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
    this.targetX = startX;
    this.targetY = startY;
  }

  setState(newState: PetState) {
    this.state = newState;
  }

  update(tick: number, dpr: number, canvasWidth: number, canvasHeight: number) {
    // Smoothed movement towards target
    this.x += (this.targetX - this.x) * 0.1;

    // Base floating Y based on tick
    let floatOffset = Math.sin(tick / 800) * 10 * dpr;
    if (this.state === 'SLEEPING') floatOffset = Math.sin(tick / 1200) * 5 * dpr;
    if (this.state === 'CODING') {
      floatOffset += (Math.random() - 0.5) * 5 * dpr; // Small glitchy movement when coding
    }
    
    // Smooth target Y movement
    this.targetY += (canvasHeight / 2 - this.targetY) * 0.05; 
    this.y = this.targetY + floatOffset;

    // Boundary constraints
    const margin = 20 * dpr;
    if (this.x < margin) this.x = margin;
    if (this.x > canvasWidth - margin) this.x = canvasWidth - margin;
  }

  input(keys: { [key: string]: boolean }, moveSpeed: number) {
    if (keys['ArrowLeft']) this.targetX -= moveSpeed;
    if (keys['ArrowRight']) this.targetX += moveSpeed;
  }
}
