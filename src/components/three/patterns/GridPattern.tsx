import { BasePattern, type PatternState, type Position } from './BasePattern';

export class GridPattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    const spacing = this.settings.photoSize * (1 + this.settings.photoSpacing);
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    
    const aspectRatio = this.settings.gridAspectRatio;
    const columns = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
    const rows = Math.ceil(totalPhotos / columns);

    const wallHeight = this.settings.wallHeight;
    
    const speed = this.settings.animationSpeed / 100;
    const animationTime = this.settings.animationEnabled ? time * speed : 0;
    
    for (let i = 0; i < totalPhotos; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = (col - columns / 2) * spacing;
      let y = wallHeight + (rows / 2 - row) * spacing;
      let z = 0;
      
      if (this.settings.animationEnabled) {
        // Add wave motion
        const waveX = Math.sin(animationTime + col * 0.3) * 2;
        const waveY = Math.cos(animationTime + row * 0.3) * 2;
        y += waveX + waveY;
        z += Math.sin(animationTime * 0.3 + (col + row) * 0.2) * 2;
      }
      
      positions.push([x, y, z]);
      
      // Calculate rotation to face camera if enabled
      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z);
        const rotationX = Math.sin(animationTime * 0.5 + col * 0.1) * 0.1;
        const rotationZ = Math.cos(animationTime * 0.5 + row * 0.1) * 0.1;
        rotations.push([rotationX, rotationY, rotationZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}