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
  rotationSpeed: number;
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
      speed: 0.5 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      driftRadius: 2 + Math.random() * 3,
      rotationSpeed: 0.2 + Math.random() * 0.3
    }));
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationEnabled ? this.settings.animationSpeed / 50 : 0;
    const animationTime = time * speedMultiplier;

    // Generate positions for all slots (both photos and empty slots)
    for (let i = 0; i < this.settings.photoCount; i++) {
      const param = this.floatParams[i];
      if (!param) continue;

      // Calculate base vertical position with continuous motion
      let y = param.y + Math.sin(animationTime * param.speed + param.phase) * 5;
      
      // Add horizontal drift
      const driftX = Math.sin(animationTime * 0.5 + param.phase) * param.driftRadius;
      const driftZ = Math.cos(animationTime * 0.5 + param.phase + Math.PI/4) * param.driftRadius;

      const x = param.x + driftX;
      const z = param.z + driftZ;

      positions.push([x, y, z]);

      // Calculate rotation to face camera if enabled
      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z);
        const rotationX = Math.sin(animationTime * param.rotationSpeed + param.phase) * 0.1;
        const rotationZ = Math.cos(animationTime * param.rotationSpeed + param.phase) * 0.1;
        rotations.push([rotationX, rotationY, rotationZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}