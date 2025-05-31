import { BasePattern, type PatternState, type Position } from './BasePattern';

const FLOAT_MAX_HEIGHT = 50;
const FLOAT_MIN_HEIGHT = -10;

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
      
      const x = (col - gridSize/2) * spacing + (Math.random() - 0.5) * spacing * 0.3;
      const z = (row - gridSize/2) * spacing + (Math.random() - 0.5) * spacing * 0.3;
      const y = FLOAT_MIN_HEIGHT - (Math.random() * Math.abs(FLOAT_MIN_HEIGHT));
      
      return {
        x,
        z,
        y,
        speed: 0.2 + Math.random() * 0.3, // Reduced base speed range
        phase: Math.random() * Math.PI * 2
      };
    });
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const normalizedSpeed = Math.max(0, Math.min(1, this.settings.animationSpeed / 100)); // Convert 0-100 to 0-1
    
    for (let i = 0; i < this.floatParams.length; i++) {
      const param = this.floatParams[i];
      
      // Calculate vertical movement with normalized speed
      const verticalSpeed = normalizedSpeed * param.speed;
      param.y += verticalSpeed;
      
      if (param.y > FLOAT_MAX_HEIGHT) {
        param.y = FLOAT_MIN_HEIGHT;
      }
      
      // Calculate horizontal drift with normalized speed
      const driftScale = 0.5;
      const driftSpeed = normalizedSpeed * 0.1;
      const xDrift = Math.sin(time * driftSpeed + param.phase) * driftScale;
      const zDrift = Math.cos(time * driftSpeed + param.phase) * driftScale;
      
      positions.push([
        param.x + xDrift,
        param.y,
        param.z + zDrift
      ]);
    }

    return { positions };
  }
}