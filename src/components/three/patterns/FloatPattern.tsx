import { BasePattern, type PatternState, type Position } from './BasePattern';

const FLOAT_MAX_HEIGHT = 50;
const FLOAT_MIN_HEIGHT = -10;

type FloatParams = {
  x: number;
  z: number;
  y: number;
  speed: number;
  phase: number;
  driftRadius: number;
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
      y: FLOAT_MIN_HEIGHT + Math.random() * (FLOAT_MAX_HEIGHT - FLOAT_MIN_HEIGHT),
      speed: 0.5 + Math.random() * 0.5, // More consistent speed range
      phase: Math.random() * Math.PI * 2,
      driftRadius: 2 + Math.random() * 3 // Random drift radius for each photo
    }));
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationSpeed / 50;
    const animationTime = this.settings.animationEnabled ? time * speedMultiplier : 0;

    for (const param of this.floatParams) {
      // Calculate base vertical position
      let y = param.y + (animationTime * param.speed);
      
      // Wrap around when reaching the top
      const totalHeight = FLOAT_MAX_HEIGHT - FLOAT_MIN_HEIGHT;
      y = ((y - FLOAT_MIN_HEIGHT) % totalHeight) + FLOAT_MIN_HEIGHT;

      // Add horizontal drift using param.driftRadius
      const driftX = Math.sin(animationTime * 0.5 + param.phase) * param.driftRadius;
      const driftZ = Math.cos(animationTime * 0.5 + param.phase + Math.PI/4) * param.driftRadius;

      const x = param.x + driftX;
      const z = param.z + driftZ;

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