import { BasePattern, type PatternState, type Position } from './BasePattern';

const FLOAT_MAX_HEIGHT = 50;
const FLOAT_MIN_HEIGHT = -10;

type FloatParams = {
  x: number;
  z: number;
  y: number;
  speed: number;
  phase: number;
  driftOffset: number;
  currentSpeed: number; // Track current interpolated speed
};

export class FloatPattern extends BasePattern {
  private floatParams: FloatParams[];
  private lastTime: number;
  private speedLerpFactor: number = 0.1; // Speed interpolation factor

  constructor(settings: any, photos: any[]) {
    super(settings, photos);
    this.floatParams = this.initializeFloatParams();
    this.lastTime = 0;
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
        speed: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        driftOffset: Math.random() * Math.PI * 2,
        currentSpeed: 0 // Initialize current speed
      };
    });
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const deltaTime = Math.min(time - this.lastTime, 0.1); // Clamp delta time
    this.lastTime = time;
    
    // Convert animation speed (0-100) to a multiplier (0-2)
    const targetSpeedMultiplier = this.settings.animationEnabled ? 
      (this.settings.animationSpeed / 50) : 0;
    
    for (let i = 0; i < this.floatParams.length; i++) {
      const param = this.floatParams[i];
      
      // Smoothly interpolate to target speed
      param.currentSpeed += (targetSpeedMultiplier - param.currentSpeed) * this.speedLerpFactor;
      
      if (param.currentSpeed > 0.001) { // Small threshold to prevent micro-movements
        // Vertical movement with smooth speed
        const verticalSpeed = param.speed * param.currentSpeed * 5;
        param.y += verticalSpeed * deltaTime;
        
        // Reset position when reaching max height
        if (param.y > FLOAT_MAX_HEIGHT) {
          param.y = FLOAT_MIN_HEIGHT;
        }
        
        // Horizontal drift with smooth speed
        const driftAmplitude = 3.0;
        const driftFrequency = param.currentSpeed * 0.5;
        const driftTime = time * driftFrequency;
        
        const xDrift = Math.sin(driftTime + param.driftOffset) * driftAmplitude;
        const zDrift = Math.cos(driftTime + param.driftOffset) * driftAmplitude;
        
        positions.push([
          param.x + xDrift,
          param.y,
          param.z + zDrift
        ]);
      } else {
        // When effectively stopped, maintain static positions
        positions.push([param.x, param.y, param.z]);
      }
    }

    return { positions };
  }
}