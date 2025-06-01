import { BasePattern, type PatternState, type Position } from './BasePattern';

type FloatParams = {
  x: number;
  z: number;
  y: number;
  speed: number;
  phase: number;
  driftRadius: number;
  rotationSpeed: number;
  spawnTime: number; // When this photo was last spawned
};

export class FloatPattern extends BasePattern {
  private floatParams: FloatParams[];
  private readonly MAX_HEIGHT = 50;
  private readonly MIN_HEIGHT = -10;
  private readonly VERTICAL_SPEED = 2;
  private readonly DRIFT_SCALE = 0.5;
  private readonly SPAWN_INTERVAL = 0.5; // Seconds between spawns
  private lastSpawnTime = 0;
  private spawnIndex = 0;

  constructor(settings: any, photos: any[]) {
    super(settings, photos);
    this.floatParams = this.initializeFloatParams();
  }

  private initializeFloatParams(): FloatParams[] {
    const floorSize = this.settings.floorSize * 0.8;
    const count = Math.min(this.settings.photoCount, 500);
    
    // Initialize all photos below the floor, staggered over time
    return Array(count).fill(0).map((_, index) => {
      return {
        x: (Math.random() - 0.5) * floorSize,
        z: (Math.random() - 0.5) * floorSize,
        y: this.MIN_HEIGHT - 5, // Start below visible area
        speed: this.VERTICAL_SPEED * (0.8 + Math.random() * 0.4),
        phase: Math.random() * Math.PI * 2,
        driftRadius: 2 + Math.random() * 3,
        rotationSpeed: 0.05 + Math.random() * 0.1,
        spawnTime: -index * this.SPAWN_INTERVAL // Stagger initial spawn times
      };
    });
  }

  private spawnPhoto(param: FloatParams, currentTime: number): void {
    // Reset position below the floor
    param.y = this.MIN_HEIGHT - 2;
    param.x = (Math.random() - 0.5) * this.settings.floorSize * 0.8;
    param.z = (Math.random() - 0.5) * this.settings.floorSize * 0.8;
    param.phase = Math.random() * Math.PI * 2;
    param.spawnTime = currentTime;
  }

  generatePositions(time: number): PatternState {
    const positions: Position[] = [];
    const rotations: [number, number, number][] = [];
    
    // Scale animation speed based on settings (0-100%)
    const speedMultiplier = this.settings.animationEnabled ? (this.settings.animationSpeed / 100) : 0;
    const animationTime = time * speedMultiplier;

    // Update and generate positions
    for (let i = 0; i < this.settings.photoCount; i++) {
      const param = this.floatParams[i];
      if (!param) continue;

      // Check if this photo should be spawned yet
      const timeSinceSpawn = animationTime - param.spawnTime;
      
      if (timeSinceSpawn < 0) {
        // Photo hasn't spawned yet, keep it hidden below
        positions.push([param.x, this.MIN_HEIGHT - 10, param.z]);
        rotations.push([0, 0, 0]);
        continue;
      }

      // Update vertical position based on time since spawn
      param.y = this.MIN_HEIGHT + (timeSinceSpawn * param.speed * speedMultiplier);

      // If photo has reached max height, respawn it
      if (param.y > this.MAX_HEIGHT) {
        this.spawnPhoto(param, animationTime);
        // Use the new position immediately
        param.y = this.MIN_HEIGHT + (0 * param.speed * speedMultiplier);
      }
      
      // Photos move straight up without horizontal drift
      const x = param.x;
      const z = param.z;

      positions.push([x, param.y, z]);

      // Keep photos straight (no rotation)
      rotations.push([0, 0, 0]);
    }

    return { positions, rotations };
  }
}