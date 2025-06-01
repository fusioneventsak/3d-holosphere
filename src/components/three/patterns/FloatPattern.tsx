import { BasePattern, type PatternState, type Position } from './BasePattern';

export class FloatPattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    const totalPhotos = Math.min(this.settings.photoCount, 500);
    
    // Base animation speed scaled by settings (0-100%)
    const speed = this.settings.animationSpeed / 100;
    const animationTime = time * speed;
    
    // Area configuration for spawning photos
    const spawnRadius = 15; // Radius of the area where photos spawn
    const riseSpeed = 3; // Base upward speed
    const maxHeight = 50; // Maximum height before recycling
    const cycleTime = 20; // Time for one complete cycle
    
    for (let i = 0; i < totalPhotos; i++) {
      // Create consistent spawn positions based on photo index
      const angle = (i / totalPhotos) * Math.PI * 2;
      const radiusVariation = (i % 3) * 2; // Create 3 concentric rings
      const baseX = Math.cos(angle) * (spawnRadius - radiusVariation);
      const baseZ = Math.sin(angle) * (spawnRadius - radiusVariation);
      
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
        const driftAmount = 2;
        x += Math.sin(animationTime * 0.5 + i * 0.3) * driftAmount;
        z += Math.cos(animationTime * 0.3 + i * 0.5) * driftAmount;
        
        // Add slight bobbing motion
        y += Math.sin(animationTime * 2 + i * 0.1) * 0.5;
      } else {
        // If animations are disabled, just place them in a static rising pattern
        y = this.settings.wallHeight + (i * 2) % maxHeight;
      }
      
      positions.push([x, y, z]);
      
      // Calculate rotation to face camera if enabled
      if (this.settings.photoRotation) {
        const rotationY = Math.atan2(x, z);
        // Add gentle rotation as photos float up
        const rotationX = Math.sin(animationTime * 0.3 + i * 0.1) * 0.05;
        const rotationZ = Math.cos(animationTime * 0.3 + i * 0.1) * 0.05;
        rotations.push([rotationX, rotationY, rotationZ]);
      } else {
        rotations.push([0, 0, 0]);
      }
    }

    return { positions, rotations };
  }
}