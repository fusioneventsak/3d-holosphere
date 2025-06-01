import { BasePattern, type PatternState, type Position } from './BasePattern';

export class WavePattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    const spacing = this.settings.photoSize * (1 + this.settings.photoSpacing);
    
    // Calculate grid dimensions based on total photos
    const columns = Math.ceil(Math.sqrt(totalPhotos));
    const rows = Math.ceil(totalPhotos / columns);
    
    // Get wave parameters from settings
    const amplitude = this.settings.patterns.wave.amplitude;
    const frequency = this.settings.patterns.wave.frequency;
    
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationEnabled ? this.settings.animationSpeed / 50 : 0;
    const wavePhase = time * speedMultiplier;
    
    // Generate positions for all photos
    for (let i = 0; i < totalPhotos; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      
      // Calculate base grid position
      const x = (col - columns / 2) * spacing;
      const z = (row - rows / 2) * spacing;
      
      // Calculate wave height based on distance from center
      const distanceFromCenter = Math.sqrt(x * x + z * z);
      const y = this.settings.wallHeight + 
        (this.settings.animationEnabled 
          ? Math.sin(distanceFromCenter * frequency - wavePhase) * amplitude
          : 0);
      
      positions.push([x, y, z]);
    }

    // Calculate rotations if photo rotation is enabled
    const rotations = this.settings.photoRotation ? positions.map(([x, y, z]) => {
      const angle = Math.atan2(x, z);
      return [
        Math.sin(time * 0.5) * 0.1,
        angle,
        Math.cos(time * 0.5) * 0.1
      ] as [number, number, number];
    }) : undefined;

    return { positions, rotations };
  }
}