import { BasePattern, type PatternState, type Position } from './BasePattern';

export class SpiralPattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    const patternSettings = this.settings.patterns.spiral;
    const radius = patternSettings.radius;
    const heightStep = patternSettings.heightStep;
    const angleStep = (Math.PI * 2) / Math.max(1, totalPhotos / 3);
    
    for (let i = 0; i < totalPhotos; i++) {
      const angle = this.settings.animationEnabled ? 
        i * angleStep + time : 
        i * angleStep;
      const spiralRadius = radius * (1 - i / totalPhotos);
      const x = Math.cos(angle) * spiralRadius;
      const y = this.settings.wallHeight + (i * heightStep);
      const z = Math.sin(angle) * spiralRadius;
      positions.push([x, y, z]);
    }

    return { positions };
  }
}