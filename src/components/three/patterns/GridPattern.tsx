import { BasePattern, type PatternState, type Position } from './BasePattern';

export class GridPattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    const spacing = this.settings.photoSize * (1 + this.settings.photoSpacing);
    
    const patternSettings = this.settings.patterns.grid;
    const aspectRatio = patternSettings.aspectRatio;
    const columns = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
    const rows = Math.ceil(totalPhotos / columns);
    
    for (let i = 0; i < totalPhotos; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = (col - columns / 2) * spacing;
      let y = this.settings.wallHeight + (rows / 2 - row) * spacing * (16/9);
      
      if (this.settings.animationEnabled) {
        const waveX = Math.sin(time + col * 0.5) * 0.2;
        const waveY = Math.cos(time + row * 0.5) * 0.2;
        y += waveX + waveY;
      }
      
      const z = 0;
      positions.push([x, y, z]);
    }

    return { positions };
  }
}