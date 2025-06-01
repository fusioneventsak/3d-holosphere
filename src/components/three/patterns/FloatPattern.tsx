import { BasePattern, type PatternState, type Position } from './BasePattern';

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
  private readonly MAX_HEIGHT = 50;
  private readonly MIN_HEIGHT = -20;
  private readonly MAX_HEIGHT = 50;
  private readonly MIN_HEIGHT = -20;

  constructor(settings: any, photos: any[]) {
    super(settings, photos);
    this.floatParams = this.initializeFloatParams();
  }

  private initializeFloatParams(): FloatParams[] {
    const floorSize = this.settings.floorSize * 0.8;
    const count = Math.min(this.settings.photoCount, 500);
    
    // Distribute initial Y positions evenly
    
    // Distribute initial Y positions evenly
    return Array(count).fill(0).map(() => ({
      x: (Math.random() - 0.5) * floorSize,
      z: (Math.random() - 0.5) * floorSize,
      y: Math.random() * (this.MAX_HEIGHT - this.MIN_HEIGHT) + this.MIN_HEIGHT,
      speed: 0.1 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      driftRadius: 5 + Math.random() * 10,
      rotationSpeed: 0.05 + Math.random() * 0.1
    }));
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Base animation speed scaled by settings (0-100%)
    const speed = this.settings.animationSpeed / 100;
    const animationTime = time * speed;

    // Generate positions for all slots (both photos and empty slots)
    for (let i = 0; i < this.settings.photoCount; i++) {
      const param = this.floatParams[i];
      if (!param) continue;

      // Update vertical position
      param.y += param.speed * speed * 5;

      // Reset to bottom when reaching max height
      if (param.y > this.MAX_HEIGHT) {
        param.y = this.MIN_HEIGHT;
        param.z = (Math.random() - 0.5) * this.settings.floorSize * 0.8;
        param.phase = Math.random() * Math.PI * 2;
      }
      
      const y = param.yOffset;
      
      // Add horizontal drift with smooth circular motion
      const driftX = Math.sin(animationTime * 0.1 + param.phase) * param.driftRadius;
      const driftZ = Math.cos(animationTime * 0.1 + param.phase + Math.PI/4) * param.driftRadius;

      const x = param.x + driftX;
      const z = param.z + driftZ;

      positions.push([x, y, z]);

      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z) * 0.5;
        rotations.push([0, rotationY, 0]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}