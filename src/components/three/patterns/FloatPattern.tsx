import { BasePattern, type PatternState, type Position } from './BasePattern';

type FloatParams = {
  baseX: number;
  baseZ: number;
  currentY: number; // Track current position for smooth movement
  speed: number;
  phase: number;
  driftRadius: number;
  rotationSpeed: number;
  isActive: boolean;
};

export class FloatPattern extends BasePattern {
  private floatParams: FloatParams[];
  private readonly FLOOR_LEVEL = 0;
  private readonly MAX_HEIGHT = 50;
  private readonly SPAWN_INTERVAL = 1.0; // Slower spawn rate
  private lastTime: number = 0;

  constructor(settings: any, photos: any[]) {
    super(settings, photos);
    this.floatParams = this.initializeFloatParams();
  }

  private initializeFloatParams(): FloatParams[] {
    const floorSize = this.settings.floorSize * 0.6;
    const count = Math.min(this.settings.photoCount, 500);
    
    return Array(count).fill(0).map((_, index) => ({
      baseX: (Math.random() - 0.5) * floorSize,
      baseZ: (Math.random() - 0.5) * floorSize,
      currentY: this.FLOOR_LEVEL,
      speed: 6 + Math.random() * 4, // Slower, more consistent speed
      phase: index * this.SPAWN_INTERVAL,
      driftRadius: 0.8 + Math.random() * 1.5, // Reduced drift for stability
      rotationSpeed: 0.1 + Math.random() * 0.1,
      isActive: false
    }));
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationEnabled ? this.settings.animationSpeed / 100 : 0;
    const animationTime = time * speedMultiplier;
    
    // Calculate delta time for smooth movement
    const deltaTime = this.lastTime > 0 ? animationTime - this.lastTime : 0;
    this.lastTime = animationTime;

    for (let i = 0; i < this.settings.photoCount; i++) {
      const param = this.floatParams[i];
      if (!param) continue;

      // Check if photo should start floating
      if (!param.isActive && animationTime >= param.phase) {
        param.isActive = true;
        param.currentY = this.FLOOR_LEVEL + this.settings.wallHeight;
      }

      // Update position smoothly
      if (param.isActive && speedMultiplier > 0) {
        param.currentY += param.speed * deltaTime;
        
        // Reset when reaching max height
        if (param.currentY > this.settings.wallHeight + this.MAX_HEIGHT) {
          param.isActive = false;
          param.phase = animationTime + Math.random() * 2; // Random delay before next cycle
          param.currentY = this.FLOOR_LEVEL + this.settings.wallHeight;
          
          // New random position
          const floorSize = this.settings.floorSize * 0.6;
          param.baseX = (Math.random() - 0.5) * floorSize;
          param.baseZ = (Math.random() - 0.5) * floorSize;
        }
      }

      // Calculate final position with minimal drift
      const driftPhase = animationTime * 0.3 + i * 0.5;
      const driftX = Math.sin(driftPhase) * param.driftRadius;
      const driftZ = Math.cos(driftPhase) * param.driftRadius;
      
      // Very subtle bobbing
      const bobbing = Math.sin(animationTime * 1.5 + i * 0.3) * 0.2;

      const x = param.baseX + driftX;
      const z = param.baseZ + driftZ;
      const y = param.isActive ? param.currentY + bobbing : -20; // Hide inactive photos

      positions.push([x, y, z]);

      // Gentle rotation
      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z);
        const wobbleX = Math.sin(animationTime * param.rotationSpeed + i) * 0.03;
        const wobbleZ = Math.cos(animationTime * param.rotationSpeed + i) * 0.03;
        rotations.push([wobbleX, rotationY, wobbleZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}