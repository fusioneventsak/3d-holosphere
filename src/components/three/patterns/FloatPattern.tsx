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
    const count = Math.min(this.settings.photoCount, 500);
    
    return Array(count).fill(0).map(() => ({
      x: (Math.random() - 0.5) * floorSize,
      z: (Math.random() - 0.5) * floorSize,
      y: FLOAT_MIN_HEIGHT + Math.random() * 10,
      speed: 0.8 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2
    }));
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Only animate if enabled
    if (!this.settings.animationEnabled) {
      return {
        positions: this.floatParams.map(param => [param.x, param.y, param.z]),
        rotations: this.floatParams.map(() => [0, 0, 0])
      };
    }

    const normalizedSpeed = this.settings.animationSpeed / 10;
    const totalHeight = FLOAT_MAX_HEIGHT - FLOAT_MIN_HEIGHT;

    for (const param of this.floatParams) {
      // Calculate vertical position with normalized speed
      let y = param.y + (time * normalizedSpeed * param.speed);
      
      // Wrap around when reaching the top
      while (y > FLOAT_MAX_HEIGHT) {
        y = FLOAT_MIN_HEIGHT + (y - FLOAT_MAX_HEIGHT);
      }

      // Add horizontal drift
      const xOffset = Math.sin(time * 0.2 + param.phase) * 2;
      const zOffset = Math.cos(time * 0.2 + param.phase) * 2;

      const x = param.x + xOffset;
      const z = param.z + zOffset;

      positions.push([x, y, z]);

      // Calculate rotation to face camera if enabled
      if (this.settings.photoRotation) {
        const angle = Math.atan2(x, z);
        rotations.push([0, angle, 0]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}