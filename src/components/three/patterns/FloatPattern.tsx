import { BasePattern, type PatternState, type Position } from './BasePattern';

export class FloatPattern extends BasePattern {
  private readonly CYCLE_HEIGHT = 60; // Total height of the cycle
  private readonly VISIBLE_START = -10; // Where photos become visible
  private readonly VISIBLE_END = 50; // Where photos become invisible
  private readonly VERTICAL_SPEED = 2;

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationEnabled ? (this.settings.animationSpeed / 100) : 0;
    const animationTime = time * speedMultiplier;

    const floorSize = this.settings.floorSize * 0.8;
    const totalPhotos = Math.min(this.settings.photoCount, 500);

    for (let i = 0; i < totalPhotos; i++) {
      // Each photo has a unique offset in the cycle based on its index
      const cycleOffset = (i / totalPhotos) * this.CYCLE_HEIGHT;
      
      // Calculate the current position in the cycle
      const cyclePosition = (animationTime * this.VERTICAL_SPEED + cycleOffset) % this.CYCLE_HEIGHT;
      
      // Convert cycle position to world Y coordinate
      const y = this.VISIBLE_START + cyclePosition;
      
      // Only render photos that are in the visible range
      if (y >= this.VISIBLE_START && y <= this.VISIBLE_END) {
        // Generate consistent but random-looking X and Z positions based on photo index
        const seedX = Math.sin(i * 12.9898) * 43758.5453;
        const seedZ = Math.sin(i * 78.233) * 43758.5453;
        const x = (seedX - Math.floor(seedX) - 0.5) * floorSize;
        const z = (seedZ - Math.floor(seedZ) - 0.5) * floorSize;
        
        positions.push([x, y, z]);
        rotations.push([0, 0, 0]);
      } else {
        // Hide photos that are outside the visible range
        positions.push([0, this.VISIBLE_START - 20, 0]);
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}