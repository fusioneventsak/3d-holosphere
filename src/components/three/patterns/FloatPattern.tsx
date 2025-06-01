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
    const floorArea = floorSize * 0.9; // Use 90% of floor area
    const riseSpeed = 8; // Units per second rising speed
    const maxHeight = 60; // Maximum height before recycling
    const startHeight = -15; // Start well below the floor
    const totalRiseDistance = maxHeight - startHeight;
    
    for (let i = 0; i < totalPhotos; i++) {
      // Distribute photos evenly across the entire floor plane
      // Use a pseudo-random but consistent distribution based on photo index
      const seed1 = ((i * 73 + 17) % 1000) / 1000; // Pseudo-random X position (0-1)
      const seed2 = ((i * 137 + 43) % 1000) / 1000; // Pseudo-random Z position (0-1)
      const seed3 = ((i * 211 + 67) % 1000) / 1000; // Pseudo-random timing offset (0-1)
      
      // Convert to floor coordinates - spread across entire floor
      const baseX = (seed1 - 0.5) * floorArea;
      const baseZ = (seed2 - 0.5) * floorArea;
      
      // Calculate rising motion - each photo has its own timing offset
      const timeOffset = seed3 * (totalRiseDistance / riseSpeed); // Stagger timing
      const adjustedTime = animationTime + timeOffset;
      
      // Calculate height based on continuous rising motion
      let y = startHeight + (adjustedTime * riseSpeed) % totalRiseDistance;
      
      // Add horizontal position with gentle drift
      let x = baseX;
      let z = baseZ;
      
      if (this.settings.animationEnabled) {
        // Gentle horizontal drift as photos rise (like wind effect)
        const driftStrength = 2;
        const driftSpeed = 0.3;
        x += Math.sin(animationTime * driftSpeed + i * 0.5) * driftStrength;
        z += Math.cos(animationTime * driftSpeed * 0.8 + i * 0.7) * driftStrength;
        
        // Subtle bobbing motion for more natural floating
        y += Math.sin(animationTime * 2 + i * 0.3) * 0.4;
      }
      
      positions.push([x, y, z]);
      
      // Calculate rotation to face camera if enabled
      if (this.settings.photoRotation) {
        // Calculate angle to face towards center (0, 0, 0) where camera typically looks
        const rotationY = Math.atan2(-x, -z);
        
        // Add very gentle rotation wobble as photos float up
        const wobbleX = Math.sin(animationTime * 0.5 + i * 0.2) * 0.03;
        const wobbleZ = Math.cos(animationTime * 0.4 + i * 0.3) * 0.03;
        
        rotations.push([wobbleX, rotationY, wobbleZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}