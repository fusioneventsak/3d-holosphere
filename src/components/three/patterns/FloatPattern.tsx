import { BasePattern, type PatternState, type Position } from './BasePattern';

const FLOAT_MAX_HEIGHT = 50; // Maximum height before resetting
const FLOAT_MIN_HEIGHT = -10; // Starting height below floor
const BASE_SPEED = 0.005; // Significantly reduced base speed for better control

type FloatParams = {
  x: number;
  z: number;
  y: number;
  speed: number;
  phase: number;
};

export class FloatPattern extends BasePattern {
  private floatParams: FloatParams[];

  constructor(settings: any, photos: any[]) {
    super(settings, photos);
    this.floatParams = this.initializeFloatParams();
  }

  private initializeFloatParams(): FloatParams[] {
    const floorSize = this.settings.floorSize * 0.8;
    const gridSize = Math.ceil(Math.sqrt(this.settings.photoCount));
    const spacing = floorSize / gridSize;
    
    return Array(this.settings.photoCount).fill(0).map((_, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      
      // Calculate grid-based position with slight randomization
      const x = (col - gridSize/2) * spacing + (Math.random() - 0.5) * spacing * 0.3;
      const z = (row - gridSize/2) * spacing + (Math.random() - 0.5) * spacing * 0.3;
      
      // Stagger starting heights below the floor
      const y = FLOAT_MIN_HEIGHT - (Math.random() * Math.abs(FLOAT_MIN_HEIGHT));
      
      return {
        x,
        z,
        y,
        speed: 0.8 + Math.random() * 0.2, // Tighter speed range for more uniform movement
        phase: Math.random() * Math.PI * 2
      };
    });
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const baseSpeed = this.settings.animationSpeed * BASE_SPEED;
    
    for (let i = 0; i < this.floatParams.length; i++) {
      const param = this.floatParams[i];
      
      // Calculate vertical movement with scaled speed
      param.y += baseSpeed * param.speed;
      
      // Reset position when reaching max height
      if (param.y > FLOAT_MAX_HEIGHT) {
        param.y = FLOAT_MIN_HEIGHT;
      }
      
      // Add subtle horizontal drift
      const driftScale = 0.2;
      const xDrift = Math.sin(time * 0.5 + param.phase) * driftScale;
      const zDrift = Math.cos(time * 0.5 + param.phase) * driftScale;
      
      positions.push([
        param.x + xDrift,
        param.y,
        param.z + zDrift
      ]);
    }

    return { positions };
  }
}