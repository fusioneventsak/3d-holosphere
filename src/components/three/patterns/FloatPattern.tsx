import { BasePattern, type PatternState, type Position } from './BasePattern';

type FloatParams = {
  x: number;
  z: number;
  yOffset: number;
  speed: number;
  phase: number;
  driftRadius: number;
  rotationSpeed: number;
};

export class FloatPattern extends BasePattern {
  private floatParams: FloatParams[];
  private readonly MAX_HEIGHT = 60;
  private readonly MIN_HEIGHT = -5;

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
      yOffset: Math.random() * (this.MAX_HEIGHT - this.MIN_HEIGHT) + this.MIN_HEIGHT,
      speed: 0.2 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      driftRadius: 3 + Math.random() * 7,
      rotationSpeed: 0.1 + Math.random() * 0.2
    }));
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Scale animation speed based on settings (0-100%)
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationEnabled ? this.settings.animationSpeed / 25 : 0;
    const animationTime = time * speedMultiplier;

      // Each photo has a unique offset in the cycle based on its index
      
      // Calculate the current position in the cycle
      
      // Convert cycle position to world Y coordinate
    // Generate positions for all slots (both photos and empty slots)
    for (let i = 0; i < this.settings.photoCount; i++) {
      const param = this.floatParams[i];
      if (!param) continue;

      // Update vertical position
      param.yOffset += param.speed * speedMultiplier * 8;

      // Reset to bottom when reaching max height
      if (param.yOffset > this.MAX_HEIGHT) {
        param.yOffset = this.MIN_HEIGHT;
        param.x = (Math.random() - 0.5) * this.settings.floorSize * 0.8;
        param.z = (Math.random() - 0.5) * this.settings.floorSize * 0.8;
        param.phase = Math.random() * Math.PI * 2;
      }
      
      // Only render photos that are in the visible range
        // Generate consistent but random-looking X and Z positions based on photo index
      // Add horizontal drift with smooth circular motion
      const driftX = Math.sin(animationTime * 0.2 + param.phase) * param.driftRadius;
      const driftZ = Math.cos(animationTime * 0.2 + param.phase + Math.PI/4) * param.driftRadius;

      const x = param.x + driftX;
      const z = param.z + driftZ;

      positions.push([x, param.yOffset, z]);

      // Calculate rotation to face camera with smooth wobble
      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z);
        const wobbleX = Math.sin(animationTime * param.rotationSpeed + param.phase) * 0.15;
        const wobbleZ = Math.cos(animationTime * param.rotationSpeed + param.phase) * 0.15;
        rotations.push([wobbleX, rotationY, wobbleZ]);
      } else {
        // Hide photos that are outside the visible range
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}