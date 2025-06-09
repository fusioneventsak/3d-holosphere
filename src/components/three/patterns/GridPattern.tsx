import { BasePattern, type PatternState, type Position } from './BasePattern';

export class GridPattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    
    // Calculate grid dimensions with aspect ratio
    const aspectRatio = this.settings.gridAspectRatio || 1.0;
    const columns = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
    const rows = Math.ceil(totalPhotos / columns);
    
    const photoSize = this.settings.photoSize || 1.0;
    const spacingMultiplier = this.settings.photoSpacing || 0;
    
    // FIXED: FORCE edge-to-edge columns + minimal vertical overlap
    let horizontalSpacing, verticalSpacing;
    
    if (spacingMultiplier === 0) {
      // TRUE SOLID WALL: Maximum horizontal overlap for edge-to-edge columns
      horizontalSpacing = photoSize * 0.5;   // 50% horizontal overlap - force edge-to-edge
      verticalSpacing = photoSize * 0.99;    // 1% vertical overlap to prevent flicker only
    } else {
      // EQUAL SPACING: Same calculation for both directions
      const equalGap = spacingMultiplier * photoSize * 0.01; // 1% multiplier
      
      horizontalSpacing = photoSize + equalGap; // Exact same calculation
      verticalSpacing = photoSize + equalGap;   // Exact same calculation
    }
    
    // Wall positioning
    const wallHeight = this.settings.wallHeight || 0;
    
    // Calculate total wall dimensions
    const totalWallWidth = (columns - 1) * horizontalSpacing;
    const totalWallHeight = (rows - 1) * verticalSpacing;
    
    // Animation settings
    const speed = this.settings.animationSpeed / 100;
    const animationTime = this.settings.animationEnabled ? time * speed : 0;
    
    for (let i = 0; i < totalPhotos; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      
      // Use different spacing for X and Y
      const x = (col * horizontalSpacing) - (totalWallWidth / 2);
      const baseY = wallHeight + (row * verticalSpacing);
      
      let z = 0;
      let y = baseY;
      
      // Animation
      if (this.settings.animationEnabled) {
        const actualGap = spacingMultiplier * photoSize;
        const waveIntensity = Math.max(actualGap * 0.3, 0.1);
        
        const waveX = Math.sin(animationTime * 0.5 + col * 0.3) * waveIntensity;
        const waveY = Math.cos(animationTime * 0.5 + row * 0.3) * waveIntensity;
        
        y += waveY;
        z += waveX;
        
        y = Math.max(y, wallHeight);
      }
      
      positions.push([x, y, z]);
      
      // Rotation
      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z + 10);
        const rotationX = Math.sin(animationTime * 0.3 + col * 0.1) * 0.05;
        const rotationZ = Math.cos(animationTime * 0.3 + row * 0.1) * 0.05;
        rotations.push([rotationX, rotationY, rotationZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }
    
    return { positions, rotations };
  }
}