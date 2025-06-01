import { BasePattern, type PatternState, type Position } from './BasePattern';

type FloatParams = {
  baseX: number;
  baseZ: number;
  speed: number;
  phase: number;
  driftRadius: number;
  rotationSpeed: number;
  amplitude: number;
};

export class FloatPattern extends BasePattern {
  private floatParams: FloatParams[];
  private readonly CYCLE_HEIGHT = 80; // Total height range for the cycle

  constructor(settings: any, photos: any[]) {
    super(settings, photos);
    this.floatParams = this.initializeFloatParams();
  }

  private initializeFloatParams(): FloatParams[] {
    const floorSize = this.settings.floorSize * 0.8;
    const count = Math.min(this.settings.photoCount, 500);
    
    return Array(count).fill(0).map((_, index) => ({
      baseX: (Math.random() - 0.5) * floorSize,
      baseZ: (Math.random() - 0.5) * floorSize,
      speed: 0.3 + Math.random() * 0.4, // Varied speed for each photo
      phase: (index / count) * Math.PI * 2, // Distribute photos evenly in the cycle
      driftRadius: 2 + Math.random() * 5,
      rotationSpeed: 0.1 + Math.random() * 0.2,
      amplitude: 3 + Math.random() * 4 // Vertical floating amplitude
    }));
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationEnabled ? this.settings.animationSpeed / 100 : 0;
    const animationTime = time * speedMultiplier;

    // Generate positions for all slots
    for (let i = 0; i < this.settings.photoCount; i++) {
      const param = this.floatParams[i];
      if (!param) continue;

      // Each photo has a unique offset in the cycle based on its index
      const cyclePosition = (animationTime * param.speed + param.phase) % (Math.PI * 2);
      
      // Convert cycle position to world Y coordinate (smooth sine wave)
      const baseY = this.settings.wallHeight + 10; // Start above the floor
      const y = baseY + Math.sin(cyclePosition) * this.CYCLE_HEIGHT * 0.5 + this.CYCLE_HEIGHT * 0.5;
      
      // Add horizontal drift with smooth circular motion
      const driftPhase = animationTime * 0.3 + param.phase;
      const driftX = Math.sin(driftPhase) * param.driftRadius;
      const driftZ = Math.cos(driftPhase + Math.PI/4) * param.driftRadius;
      
      // Add gentle vertical floating
      const floatY = Math.sin(animationTime * 2 + param.phase) * param.amplitude;

      const x = param.baseX + driftX;
      const z = param.baseZ + driftZ;
      const finalY = y + floatY;

      positions.push([x, finalY, z]);

      // Calculate rotation to face camera with smooth wobble
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