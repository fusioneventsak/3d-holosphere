import { BasePattern, type PatternState, type Position } from './BasePattern';

export class WavePattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    const spacing = this.settings.photoSize * (1 + this.settings.photoSpacing);
    
    const patternSettings = this.settings.patterns.wave;
    const columns = Math.ceil(Math.sqrt(totalPhotos));
    const rows = Math.ceil(totalPhotos / columns);
    const frequency = patternSettings.frequency;
    const amplitude = patternSettings.amplitude;
    
    for (let i = 0; i < totalPhotos; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = (col - columns / 2) * spacing;
      const z = (row - rows / 2) * spacing;
      let y = this.settings.wallHeight;
      
      if (this.settings.animationEnabled) {
        const wavePhase = time * patternSettings.animationSpeed;
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        y += Math.sin(distanceFromCenter * frequency - wavePhase) * amplitude;
      }
      
      positions.push([x, y, z]);
    }

    return { positions };
  }
}