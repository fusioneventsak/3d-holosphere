import { BasePattern, type PatternState, type Position } from './BasePattern';

const FLOAT_MAX_HEIGHT = 50;
const FLOAT_MIN_HEIGHT = -10;
const BASE_SPEED = 5;

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
      
      // Start photos at different heights below the floor
      const heightRange = Math.abs(FLOAT_MIN_HEIGHT);
      const phase = Math.random() * Math.PI * 2;
      
      return {
        x,
        z,
        y: FLOAT_MIN_HEIGHT - (Math.random() * heightRange),
        speed: 0.8 + Math.random() * 0.4, // Tighter speed range
        phase
      };
    });
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const heightRange = FLOAT_MAX_HEIGHT - FLOAT_MIN_HEIGHT;
    const baseSpeed = this.settings.animationSpeed * BASE_SPEED;
    
    for (let i = 0; i < this.floatParams.length; i++) {
      const param = this.floatParams[i];
      
      // Calculate new Y position
      param.y += baseSpeed * param.speed * 0.016; // Assuming ~60fps
      
      // Wrap around when reaching max height
      if (param.y > FLOAT_MAX_HEIGHT) {
        param.y = FLOAT_MIN_HEIGHT;
      }
      
      // Add subtle horizontal drift based on height
      const driftScale = 0.2;
      const xDrift = Math.sin(param.y * 0.1 + param.phase) * driftScale;
      const zDrift = Math.cos(param.y * 0.1 + param.phase) * driftScale;
      
      positions.push([
        param.x + xDrift,
        param.y,
        param.z + zDrift
      ]);
    }

    return { positions };
  }
}