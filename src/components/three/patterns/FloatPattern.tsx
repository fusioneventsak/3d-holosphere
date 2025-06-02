import { BasePattern, type PatternState, type Position } from './BasePattern';

export class FloatPattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    
    // Base animation speed scaled by settings (0-100%)
    const speed = this.settings.animationSpeed / 100;
    const animationTime = time * speed;
    
    // Floor area configuration - use the FULL floor area
    const floorSize = this.settings.floorSize || 100;
    const fullFloorArea = floorSize; // Use 100% of floor area
    const riseSpeed = 8; // Units per second rising speed
    const maxHeight = 60; // Maximum height before recycling
    const startHeight = -15; // Start well below the floor
    const totalRiseDistance = maxHeight - startHeight; // 75 units total
    
    // Calculate grid-like distribution for better coverage
    const gridSize = Math.ceil(Math.sqrt(totalPhotos));
    const cellSize = fullFloorArea / gridSize;
    
    for (let i = 0; i < totalPhotos; i++) {
      // Create a grid-based distribution with randomness within each cell
      const gridX = i % gridSize;
      const gridZ = Math.floor(i / gridSize);
      
      // Add randomness within each grid cell for natural distribution
      const randomOffsetX = ((i * 73) % 1000) / 1000 - 0.5; // -0.5 to 0.5
      const randomOffsetZ = ((i * 137) % 1000) / 1000 - 0.5; // -0.5 to 0.5
      const timeOffset = ((i * 211) % 1000) / 1000; // 0 to 1
      
      // Calculate position within the grid cell
      const cellCenterX = (gridX + 0.5) * cellSize - fullFloorArea / 2;
      const cellCenterZ = (gridZ + 0.5) * cellSize - fullFloorArea / 2;
      
      // Add randomness within the cell (but keep it within cell bounds)
      const baseX = cellCenterX + (randomOffsetX * cellSize * 0.8);
      const baseZ = cellCenterZ + (randomOffsetZ * cellSize * 0.8);
      
      // Calculate rising motion - each photo has its own timing offset
      // Spread out the initial positions across the full height range
      const initialOffset = timeOffset * totalRiseDistance;
      
      let y: number;
      
      if (this.settings.animationEnabled) {
        // Calculate position in the rise cycle
        const riseProgress = (animationTime * riseSpeed + initialOffset) % totalRiseDistance;
        
        // Position is simply start height + progress through the cycle
        y = startHeight + riseProgress;
        
        // Add subtle bobbing motion for more natural floating
        y += Math.sin(animationTime * 2 + i * 0.3) * 0.4;
      } else {
        // Static position when animation is disabled - distribute evenly
        y = startHeight + initialOffset;
      }
      
      // Add horizontal position with gentle drift
      let x = baseX;
      let z = baseZ;
      
      if (this.settings.animationEnabled) {
        // Gentle horizontal drift as photos rise (like wind effect)
        const driftStrength = 1.5; // Reduced to keep photos from drifting too far
        const driftSpeed = 0.3;
        x += Math.sin(animationTime * driftSpeed + i * 0.5) * driftStrength;
        z += Math.cos(animationTime * driftSpeed * 0.8 + i * 0.7) * driftStrength;
      }
      
      positions.push([x, y, z]);
      
      // Calculate rotation to face camera if enabled
      if (this.settings.photoRotation) {
        // Calculate angle to face towards center (0, 0, 0) where camera typically looks
        const rotationY = Math.atan2(-x, -z);
        
        // Add very gentle rotation wobble as photos float up
        const wobbleX = this.settings.animationEnabled ? Math.sin(animationTime * 0.5 + i * 0.2) * 0.03 : 0;
        const wobbleZ = this.settings.animationEnabled ? Math.cos(animationTime * 0.4 + i * 0.3) * 0.03 : 0;
        
        rotations.push([wobbleX, rotationY, wobbleZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}