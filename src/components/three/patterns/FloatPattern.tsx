import { BasePattern, type PatternState, type Position } from './BasePattern';

type FloatParams = {
  baseX: number;
  baseZ: number;
  speed: number;
  phase: number;
  driftRadius: number;
  rotationSpeed: number;
};

export class FloatPattern extends BasePattern {
  private floatParams: FloatParams[];
  private readonly FLOOR_LEVEL = 0; // Floor level
  private readonly MAX_HEIGHT = 60; // Maximum height photos can reach
  private readonly SPAWN_INTERVAL = 0.5; // Time between photo spawns

  constructor(settings: any, photos: any[]) {
    super(settings, photos);
    this.floatParams = this.initializeFloatParams();
  }

  private initializeFloatParams(): FloatParams[] {
    const floorSize = this.settings.floorSize * 0.7;
    const count = Math.min(this.settings.photoCount, 500);
    
    return Array(count).fill(0).map((_, index) => ({
      baseX: (Math.random() - 0.5) * floorSize,
      baseZ: (Math.random() - 0.5) * floorSize,
      speed: 8 + Math.random() * 12, // Units per second upward speed
      phase: index * this.SPAWN_INTERVAL, // Stagger spawn times
      driftRadius: 1 + Math.random() * 3,
      rotationSpeed: 0.2 + Math.random() * 0.3
    }));
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationEnabled ? this.settings.animationSpeed / 100 : 0;
    const animationTime = time * speedMultiplier;

    for (let i = 0; i < this.settings.photoCount; i++) {
      const param = this.floatParams[i];
      if (!param) continue;

      // Calculate how long this photo has been floating
      const photoStartTime = param.phase;
      const floatDuration = animationTime - photoStartTime;
      
      let y: number;
      
      if (floatDuration < 0) {
        // Photo hasn't started floating yet - keep it below the floor
        y = this.FLOOR_LEVEL - 10;
      } else {
        // Photo is floating upward
        const baseHeight = this.settings.wallHeight + this.FLOOR_LEVEL;
        const floatHeight = floatDuration * param.speed;
        
        // If photo has reached max height, reset it to start over
        if (floatHeight > this.MAX_HEIGHT) {
          // Reset by updating the phase (restart time)
          param.phase = animationTime;
          // Randomize position for next cycle
          const floorSize = this.settings.floorSize * 0.7;
          param.baseX = (Math.random() - 0.5) * floorSize;
          param.baseZ = (Math.random() - 0.5) * floorSize;
          y = baseHeight;
        } else {
          y = baseHeight + floatHeight;
        }
      }
      
      // Add horizontal drift
      const driftPhase = animationTime * 0.5 + i;
      const driftX = Math.sin(driftPhase) * param.driftRadius;
      const driftZ = Math.cos(driftPhase + Math.PI/3) * param.driftRadius;
      
      // Add gentle bobbing motion
      const bobbing = Math.sin(animationTime * 3 + i) * 0.5;

      const x = param.baseX + driftX;
      const z = param.baseZ + driftZ;
      const finalY = y + bobbing;

      positions.push([x, finalY, z]);

      // Calculate rotation to face camera with gentle wobble
      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z);
        const wobbleX = Math.sin(animationTime * param.rotationSpeed + i) * 0.08;
        const wobbleZ = Math.cos(animationTime * param.rotationSpeed + i) * 0.08;
        rotations.push([wobbleX, rotationY, wobbleZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}