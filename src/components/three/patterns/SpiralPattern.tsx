import { BasePattern, type PatternState, type Position } from './BasePattern';

export class SpiralPattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationEnabled ? (this.settings.animationSpeed / 100) : 0;
    const animationTime = time * speedMultiplier;
    
    const radius = 20;
    const heightStep = 1.0;
    const angleStep = (Math.PI * 2) / Math.max(1, totalPhotos / 3);
    
    for (let i = 0; i < totalPhotos; i++) {
      const angle = this.settings.animationEnabled ? 
        i * angleStep + animationTime : 
        i * angleStep;
        
      const spiralRadius = radius * Math.pow((1 - i / totalPhotos), 0.5);
      const x = Math.cos(angle) * spiralRadius;
      const y = this.settings.wallHeight + (i * heightStep);
      const z = Math.sin(angle) * spiralRadius;
      
      positions.push([x, y, z]);
      
      // Calculate rotation to face camera if enabled
      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z);
        const rotationX = Math.sin(animationTime * 0.5 + i * 0.1) * 0.1;
        const rotationZ = Math.cos(animationTime * 0.5 + i * 0.1) * 0.1;
        rotations.push([rotationX, rotationY, rotationZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}