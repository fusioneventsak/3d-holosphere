import { BasePattern, type PatternState, type Position } from './BasePattern';

export class FloatPattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    
    // Floor area configuration
    const floorSize = this.settings.floorSize || 100;
    const fullFloorArea = floorSize;
    const riseSpeed = 8; // Units per second rising speed
    const maxHeight = 60; // Maximum height before recycling
    const startHeight = -20; // Start well below the floor
    const cycleHeight = maxHeight - startHeight; // Total distance to travel
    
    // Calculate grid-like distribution for better coverage
    const gridSize = Math.ceil(Math.sqrt(totalPhotos));
    const cellSize = fullFloorArea / gridSize;
    
    const speed = this.settings.animationSpeed / 100;
    const animationTime = time * speed;
    
    for (let i = 0; i < totalPhotos; i++) {
      // Create a grid-based distribution with randomness within each cell
      const gridX = i % gridSize;
      const gridZ = Math.floor(i / gridSize);
      
      // Deterministic pseudo-random values based on photo index
      const randomOffsetX = Math.sin(i * 0.73) * 0.5;
      const randomOffsetZ = Math.cos(i * 1.37) * 0.5;
      const phaseOffset = (i * 0.211) % 1; // 0 to 1, for staggering
      
      // Calculate position within the grid cell
      const cellCenterX = (gridX + 0.5) * cellSize - fullFloorArea / 2;
      const cellCenterZ = (gridZ + 0.5) * cellSize - fullFloorArea / 2;
      
      // Add randomness within the cell
      const baseX = cellCenterX + (randomOffsetX * cellSize * 0.8);
      const baseZ = cellCenterZ + (randomOffsetZ * cellSize * 0.8);
      
      // Calculate Y position with proper wrapping
      let y: number;
      
      if (this.settings.animationEnabled) {
        // Calculate total distance traveled including the phase offset
        const totalDistance = (animationTime * riseSpeed) + (phaseOffset * cycleHeight);
        
        // Use modulo to wrap around when reaching the top
        const positionInCycle = totalDistance % cycleHeight;
        
        // Add to start height to get actual Y position
        y = startHeight + positionInCycle;
        
        // Add subtle bobbing motion
        y += Math.sin(animationTime * 2 + i * 0.3) * 0.4;
      } else {
        // Static position when animation is disabled - distribute evenly through the height
        y = startHeight + (phaseOffset * cycleHeight);
      }
      
      // Add horizontal position with gentle drift
      let x = baseX;
      let z = baseZ;
      
      if (this.settings.animationEnabled) {
        // Gentle horizontal drift as photos rise
        const driftStrength = 1.5;
        const driftSpeed = 0.3;
        x += Math.sin(animationTime * driftSpeed + i * 0.5) * driftStrength;
        z += Math.cos(animationTime * driftSpeed * 0.8 + i * 0.7) * driftStrength;
      }
      
      positions.push([x, y, z]);
      
      // Calculate rotation
      if (this.settings.photoRotation) {
        // Face towards center
        const rotationY = Math.atan2(-x, -z);
        
        // Add gentle wobble
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