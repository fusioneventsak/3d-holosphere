import { BasePattern, type PatternState, type Position } from './BasePattern';

export class SpiralPattern extends BasePattern {
  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];

    const totalPhotos = Math.min(this.settings.photoCount, 500);
    const speed = this.settings.animationSpeed / 50;
    const animationTime = time * speed * 2;
    
    // Tornado parameters
    const baseRadius = 3; // Narrow radius at ground level (bottom of funnel)
    const topRadius = 30; // Wide radius at top (top of funnel)
    const maxHeight = 40; // Height of the spiral
    const rotationSpeed = 0.8; // Speed of rotation
    const orbitalChance = 0.2; // 20% chance for a photo to be on an outer orbit
    
    // Distribution parameters
    const verticalBias = 0.7; // Bias towards bottom for density
    
    for (let i = 0; i < totalPhotos; i++) {
      // Generate random but consistent values for each photo
      const randomSeed1 = Math.sin(i * 0.73) * 0.5 + 0.5;
      const randomSeed2 = Math.cos(i * 1.37) * 0.5 + 0.5;
      const randomSeed3 = Math.sin(i * 2.11) * 0.5 + 0.5;
      
      // Determine if this photo is on the main funnel or an outer orbit
      const isOrbital = randomSeed1 < orbitalChance;
      
      // Height distribution - biased towards bottom for density
      let normalizedHeight = Math.pow(randomSeed2, verticalBias);
      const y = this.settings.wallHeight + normalizedHeight * maxHeight;
      
      // Calculate radius at this height (funnel shape)
      const funnelRadius = baseRadius + (topRadius - baseRadius) * normalizedHeight;
      
      let radius: number;
      let angleOffset: number;
      let verticalWobble: number = 0;
      
      if (isOrbital) {
        // Orbital photos - farther out with elliptical paths
        radius = funnelRadius * (1.5 + randomSeed3 * 0.8); // 1.5x to 2.3x funnel radius
        angleOffset = randomSeed3 * Math.PI * 2; // Random starting angle
        
        // Add vertical oscillation for orbital photos
        if (this.settings.animationEnabled) {
          verticalWobble = Math.sin(animationTime * 2 + i) * 3;
        }
      } else {
        // Main funnel photos
        // Add some variation within the funnel
        const radiusVariation = 0.8 + randomSeed3 * 0.4; // 0.8 to 1.2
        radius = funnelRadius * radiusVariation;
        angleOffset = 0;
      }
      
      // Calculate angle with height-based rotation speed
      // Photos at the bottom rotate slower, creating a realistic vortex effect
      const heightSpeedFactor = 0.3 + normalizedHeight * 0.7; // Slower at bottom
      const angle = this.settings.animationEnabled ? 
        (animationTime * rotationSpeed * heightSpeedFactor + i * 0.5 + angleOffset) : 
        (i * 0.5 + angleOffset);
      
      // Calculate position
      let x = Math.cos(angle) * radius;
      let z = Math.sin(angle) * radius;
      
      // Add turbulence for more realistic tornado effect
      if (this.settings.animationEnabled) {
        const turbulenceStrength = isOrbital ? 2 : 1;
        const turbulenceX = Math.sin(animationTime * 3 + y * 0.1 + i) * turbulenceStrength;
        const turbulenceZ = Math.cos(animationTime * 2.5 + y * 0.1 + i * 1.3) * turbulenceStrength;
        
        x += turbulenceX;
        z += turbulenceZ;
      }
      
      positions.push([x, y + verticalWobble, z]);
      
      // Calculate rotation to face camera
      if (this.settings.photoRotation) {
        // Photos face outward from the center of the tornado
        const facingAngle = Math.atan2(x, z);
        
        // Add dynamic tilting based on height and motion
        const tiltAmount = isOrbital ? 0.2 : 0.1;
        const rotationX = this.settings.animationEnabled ? 
          Math.sin(animationTime * 1.5 + i * 0.3) * tiltAmount : 0;
        const rotationZ = this.settings.animationEnabled ? 
          Math.cos(animationTime * 1.2 + i * 0.4) * tiltAmount : 0;
        
        rotations.push([rotationX, facingAngle, rotationZ]);
      } else {
        // Even without face-camera enabled, add some tilt for dynamic feel
        const rotationY = angle;
        const tilt = normalizedHeight * 0.3; // More tilt at top
        rotations.push([tilt, rotationY, 0]);
      }
    }

    return { positions, rotations };
  }
}