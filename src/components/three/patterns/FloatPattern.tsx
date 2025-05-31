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
    const gridSize = Math.ceil(Math.sqrt(this.settings.photoCount));
    const spacing = floorSize / gridSize;
    
    return Array(this.settings.photoCount).fill(0).map((_, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      
      const x = (col - gridSize/2) * spacing + (Math.random() - 0.5) * spacing * 0.3;
      const z = (row - gridSize/2) * spacing + (Math.random() - 0.5) * spacing * 0.3;
      const y = FLOAT_MIN_HEIGHT - (Math.random() * Math.abs(FLOAT_MIN_HEIGHT));
      
      return {
        x,
        z,
        y,
        speed: 0.2 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2
      };
    });
  }

  generatePositions(time: number): PatternState {
    if (!this.settings.animationEnabled) {
      return {
        positions: this.floatParams.map(param => [param.x, param.y, param.z])
      };
    }

    const positions: Position[] = [];
    const speedMultiplier = this.settings.animationSpeed / 50;
    
    for (let i = 0; i < this.floatParams.length; i++) {
      const param = this.floatParams[i];
      
      // Only update position if animation is enabled and speed > 0
      if (this.settings.animationEnabled && speedMultiplier > 0) {
        // Calculate vertical movement
        const verticalSpeed = param.speed * speedMultiplier;
        param.y += verticalSpeed;
        
        // Reset position when reaching max height
        if (param.y > FLOAT_MAX_HEIGHT) {
          param.y = FLOAT_MIN_HEIGHT;
        }
        
        // Calculate horizontal drift
        const driftScale = 2.0;
        const driftSpeed = speedMultiplier * 0.5;
        const xDrift = Math.sin(time * driftSpeed + param.phase) * driftScale;
        const zDrift = Math.cos(time * driftSpeed + param.phase) * driftScale;
        
        positions.push([
          param.x + xDrift,
          param.y,
          param.z + zDrift
        ]);
      } else {
        // If animation is disabled or speed is 0, keep current position
        positions.push([param.x, param.y, param.z]);
      }
    }

    return { positions };
  }
}