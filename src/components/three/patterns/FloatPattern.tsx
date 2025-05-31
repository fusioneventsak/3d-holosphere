import { BasePattern, type PatternState, type Position } from './BasePattern';

const FLOAT_MAX_HEIGHT = 50;
const FLOAT_MIN_HEIGHT = -20;

type FloatParams = {
  x: number;
  z: number;
  y: number;
  speed: number;
  resetY: number;
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
    const cellSize = floorSize / gridSize;
    
    return Array(this.settings.photoCount).fill(0).map((_, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      
      return {
        x: (col - gridSize/2) * cellSize + (Math.random() - 0.5) * cellSize * 0.5,
        z: (row - gridSize/2) * cellSize + (Math.random() - 0.5) * cellSize * 0.5,
        y: FLOAT_MIN_HEIGHT,
        speed: 0.8 + Math.random() * 0.2,
        resetY: FLOAT_MIN_HEIGHT
      };
    });
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const baseSpeed = this.settings.animationSpeed * 5;
    
    this.floatParams.forEach((param) => {
      let y = param.y + (baseSpeed * param.speed);
      
      // Reset when reaching max height
      if (y > FLOAT_MAX_HEIGHT) {
        param.y = param.resetY;
        y = param.resetY;
      } else {
        param.y = y;
      }
      
      positions.push([param.x, y, param.z]);
    });

    return { positions };
  }
}