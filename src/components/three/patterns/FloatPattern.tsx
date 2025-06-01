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
  private readonly MIN_HEIGHT = -10;
  private readonly VERTICAL_SPEED = 2;
  private readonly DRIFT_SCALE = 0.5;

  constructor(settings: any, photos: any[]) {
    super(settings, photos);
    this.floatParams = this.initializeFloatParams();
  }

  private initializeFloatParams(): FloatParams[] {
    const floorSize = this.settings.floorSize * 0.8;
    const count = Math.min(this.settings.photoCount, 500);
    
    // Distribute initial Y positions evenly across the height range
    return Array(count).fill(0).map((_, index) => {
      const heightRange = this.MAX_HEIGHT - this.MIN_HEIGHT;
      const heightStep = heightRange / count;
      
      return {
        x: (Math.random() - 0.5) * floorSize,
        z: (Math.random() - 0.5) * floorSize,
        y: this.MIN_HEIGHT + (index * heightStep), // Evenly distribute initial heights
        speed: this.VERTICAL_SPEED * (0.8 + Math.random() * 0.4), // Slight speed variation
        phase: Math.random() * Math.PI * 2,
        driftRadius: 2 + Math.random() * 3, // Reduced drift for more stable upward motion
        rotationSpeed: 0.05 + Math.random() * 0.1
      };
    });
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationEnabled ? (this.settings.animationSpeed / 100) : 0;
    const animationTime = time * speedMultiplier;

    // Update and generate positions
    for (let i = 0; i < this.settings.photoCount; i++) {
      const param = this.floatParams[i];
      if (!param) continue;

      // Update vertical position
      param.y += param.speed * speedMultiplier;

      // Reset to bottom when reaching max height
      if (param.y > this.MAX_HEIGHT) {
        param.y = this.MIN_HEIGHT;
        param.x = (Math.random() - 0.5) * this.settings.floorSize * 0.8;
        param.z = (Math.random() - 0.5) * this.settings.floorSize * 0.8;
        param.phase = Math.random() * Math.PI * 2;
      }
      
      // Add subtle horizontal drift
      const driftX = Math.sin(animationTime * 0.2 + param.phase) * param.driftRadius * this.DRIFT_SCALE;
      const driftZ = Math.cos(animationTime * 0.2 + param.phase + Math.PI/4) * param.driftRadius * this.DRIFT_SCALE;

      const x = param.x + driftX;
      const z = param.z + driftZ;

      positions.push([x, param.y, z]);

      // Calculate rotation to face camera if enabled
      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z);
        const wobbleX = Math.sin(animationTime * param.rotationSpeed + param.phase) * 0.1;
        const wobbleZ = Math.cos(animationTime * param.rotationSpeed + param.phase) * 0.1;
        rotations.push([wobbleX, rotationY, wobbleZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}