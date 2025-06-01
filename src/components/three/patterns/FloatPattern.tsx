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
      yOffset: (Math.random() - 0.5) * 20, // Increased range for more vertical spread
      speed: 0.2 + Math.random() * 0.3, // Slower base speed for smoother motion
      phase: Math.random() * Math.PI * 2,
      driftRadius: 3 + Math.random() * 7, // Increased drift radius
      rotationSpeed: 0.1 + Math.random() * 0.2 // Slower rotation for smoother motion
    }));
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationEnabled ? this.settings.animationSpeed / 25 : 0;
    const animationTime = time * speedMultiplier;

    // Generate positions for all slots (both photos and empty slots)
    for (let i = 0; i < this.settings.photoCount; i++) {
      const param = this.floatParams[i];
      if (!param) continue;

      // Calculate vertical floating motion with larger amplitude
      const verticalMotion = Math.sin(animationTime * param.speed + param.phase) * 10;
      const y = this.settings.wallHeight + param.yOffset + verticalMotion;
      
      // Add horizontal drift with smooth circular motion
      const driftX = Math.sin(animationTime * 0.2 + param.phase) * param.driftRadius;
      const driftZ = Math.cos(animationTime * 0.2 + param.phase + Math.PI/4) * param.driftRadius;

      const x = param.x + driftX;
      const z = param.z + driftZ;

      positions.push([x, y, z]);

      // Calculate rotation to face camera with smooth wobble
      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z);
        const wobbleX = Math.sin(animationTime * param.rotationSpeed + param.phase) * 0.15;
        const wobbleZ = Math.cos(animationTime * param.rotationSpeed + param.phase) * 0.15;
        rotations.push([wobbleX, rotationY, wobbleZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}