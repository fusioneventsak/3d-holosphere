import { BasePattern, type PatternState, type Position } from './BasePattern';

const FLOAT_MAX_HEIGHT = 50;
const FLOAT_MIN_HEIGHT = -10;
const BASE_SPEED = 10;

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
      
      // Distribute initial heights evenly throughout the vertical space
      const heightRange = FLOAT_MAX_HEIGHT - FLOAT_MIN_HEIGHT;
      const phase = (index / this.settings.photoCount) * heightRange;
      
      return {
        x,
        z,
        y: FLOAT_MIN_HEIGHT + phase,
        speed: BASE_SPEED + (Math.random() - 0.5) * 2, // Speed variation of ±1
        phase
      };
    });
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const heightRange = FLOAT_MAX_HEIGHT - FLOAT_MIN_HEIGHT;
    const baseSpeed = this.settings.animationSpeed * BASE_SPEED;
    
    this.floatParams.forEach((param) => {
      // Calculate vertical position with wrapping
      let y = param.y + (baseSpeed * param.speed * time);
      
      // Wrap around when reaching max height
      y = ((y - FLOAT_MIN_HEIGHT) % heightRange) + FLOAT_MIN_HEIGHT;
      
      // Store updated Y position
      param.y = y;
      
      // Add subtle horizontal drift based on height
      const driftScale = 0.2;
      const xDrift = Math.sin(y * 0.1 + param.phase) * driftScale;
      const zDrift = Math.cos(y * 0.1 + param.phase) * driftScale;
      
      positions.push([
        param.x + xDrift,
        y,
        param.z + zDrift
      ]);
    });

    return { positions };
  }
}