// Updated CollageScene.tsx - PhotoMesh component fix for portrait orientation

// In the PhotoMesh component, change this line:
// <planeGeometry args={[size, size * (9/16)]} />
// 
// To this line for portrait orientation:
// <planeGeometry args={[size * (9/16), size]} />

// Here's the corrected FloatPattern:
import { BasePattern, type PatternState, type Position } from './BasePattern';

export class FloatPattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    
    // Base animation speed scaled by settings (0-100%)
    const speed = this.settings.animationSpeed / 100;
    const animationTime = time * speed;
    
    // Floor area configuration
    const floorSize = this.settings.floorSize || 100;
    const floorArea = floorSize * 0.8; // Use 80% of floor area
    const maxHeight = 50; // Maximum height before recycling
    const cycleTime = 15; // Time for one complete cycle
    
    for (let i = 0; i < totalPhotos; i++) {
      // Distribute photos evenly across the entire floor plane
      // Use a pseudo-random but consistent distribution
      const seed1 = (i * 73) % 1000 / 1000; // Pseudo-random X position (0-1)
      const seed2 = (i * 137) % 1000 / 1000; // Pseudo-random Z position (0-1)
      
      // Convert to floor coordinates
      const baseX = (seed1 - 0.5) * floorArea;
      const baseZ = (seed2 - 0.5) * floorArea;
      
      // Calculate the photo's position in its rise cycle
      const photoOffset = (i / totalPhotos) * cycleTime; // Stagger start times
      const cyclePosition = (animationTime + photoOffset) % cycleTime;
      
      // Calculate height - photos rise from below floor to max height
      const heightProgress = cyclePosition / cycleTime;
      let y = this.settings.wallHeight - 5 + (heightProgress * (maxHeight + 10));
      
      // Add gentle floating motion if animation is enabled
      let x = baseX;
      let z = baseZ;
      
      if (this.settings.animationEnabled) {
        // Gentle horizontal drift as photos rise
        const driftAmount = 1.5;
        x += Math.sin(animationTime * 0.4 + i * 0.3) * driftAmount;
        z += Math.cos(animationTime * 0.3 + i * 0.5) * driftAmount;
        
        // Add slight bobbing motion
        y += Math.sin(animationTime * 1.5 + i * 0.1) * 0.3;
      } else {
        // If animations are disabled, just place them in a static rising pattern
        y = this.settings.wallHeight + (i * 2) % maxHeight;
      }
      
      positions.push([x, y, z]);
      
      // Calculate rotation to face camera if enabled
      if (this.settings.photoRotation) {
        // Calculate angle to face towards center (0, 0, 0) where camera typically looks
        const rotationY = Math.atan2(-x, -z);
        
        // Add gentle rotation wobble as photos float up
        const wobbleX = Math.sin(animationTime * 0.3 + i * 0.1) * 0.05;
        const wobbleZ = Math.cos(animationTime * 0.3 + i * 0.1) * 0.05;
        
        rotations.push([wobbleX, rotationY, wobbleZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}