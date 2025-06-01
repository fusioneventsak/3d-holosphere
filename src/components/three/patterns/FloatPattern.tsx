import { BasePattern, type PatternState, type Position } from './BasePattern';

export class FloatPattern extends BasePattern {
  private params: Array<{
    startX: number;
    startZ: number;
    heightOffset: number;
    speed: number;
    amplitude: number;
    phaseX: number;
    phaseZ: number;
  }>;

  constructor(settings: any, photos: any[]) {
    super(settings, photos);
    this.params = this.initializeParams();
  }

  private initializeParams() {
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    const areaSize = this.settings.floorSize * 0.8;
    
    return Array(totalPhotos).fill(0).map(() => ({
      startX: (Math.random() - 0.5) * areaSize,
      startZ: (Math.random() - 0.5) * areaSize,
      heightOffset: Math.random() * 10, // Height variation
      speed: 0.5 + Math.random() * 0.5, // Varied speed
      amplitude: 1 + Math.random() * 2, // Movement amplitude
      phaseX: Math.random() * Math.PI * 2, // Random phase for X movement
      phaseZ: Math.random() * Math.PI * 2  // Random phase for Z movement
    }));
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    
    // Scale animation speed by settings (0-100%)
    const speed = this.settings.animationSpeed / 100;
    const animationTime = time * speed;
    
    // Base height and spacing
    const baseHeight = 10;
    const minHeight = 3; // Minimum height above the floor
    const maxHeight = 40; // Maximum height
    
    for (let i = 0; i < totalPhotos; i++) {
      const param = this.params[i] || this.initializeParams()[0];
      
      // Calculate floating height with a sine wave
      const height = baseHeight + minHeight + (param.heightOffset * 2) + 
        (this.settings.animationEnabled ? 
          Math.sin(animationTime * param.speed + param.phaseX) * param.amplitude * 3 : 0);
      
      // Calculate drifting X and Z positions with sine/cosine
      const driftX = this.settings.animationEnabled ? 
        Math.sin(animationTime * param.speed * 0.3 + param.phaseX) * param.amplitude * 2 : 0;
      
      const driftZ = this.settings.animationEnabled ? 
        Math.cos(animationTime * param.speed * 0.3 + param.phaseZ) * param.amplitude * 2 : 0;
      
      // Combine base position with drift
      const x = param.startX + driftX;
      const y = Math.min(maxHeight, Math.max(minHeight, height));
      const z = param.startZ + driftZ;
      
      positions.push([x, y, z]);
      
      // Calculate rotation to face camera if enabled
      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z);
        const wobbleX = Math.sin(animationTime * 0.5 + i * 0.1) * 0.1;
        const wobbleZ = Math.cos(animationTime * 0.5 + i * 0.1) * 0.1;
        rotations.push([wobbleX, rotationY, wobbleZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }