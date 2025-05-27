import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Grid, Plane } from '@react-three/drei';
import * as THREE from 'three';

// Create gradient background shader
const gradientShader = {
  uniforms: {
    colorA: { value: new THREE.Color() },
    colorB: { value: new THREE.Color() },
    gradientAngle: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 colorA;
    uniform vec3 colorB;
    varying vec2 vUv;
    
    void main() {
      gl_FragColor = vec4(mix(colorA, colorB, 1.0 - vUv.y), 1.0);
    }
  `
};

import { useSceneStore } from '../../store/sceneStore';
import { getStockPhotos } from '../../lib/stockPhotos';

// Create a shared texture loader with memory management
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, { texture: THREE.Texture; lastUsed: number }>();

const loadTexture = (url: string): THREE.Texture => {
  if (textureCache.has(url)) {
    const entry = textureCache.get(url)!;
    entry.lastUsed = Date.now();
    return entry.texture;
  }
  
  const texture = textureLoader.load(url);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = 1;
  
  textureCache.set(url, {
    texture,
    lastUsed: Date.now()
  });
  return texture;
};

const cleanupTexture = (url: string) => {
  if (textureCache.has(url)) {
    const entry = textureCache.get(url)!;
    entry.texture.dispose();
    textureCache.delete(url);
  }
};

// Cleanup old textures periodically
const cleanupOldTextures = () => {
  const now = Date.now();
  const maxAge = 60000; // 1 minute
  
  for (const [url, entry] of textureCache.entries()) {
    if (now - entry.lastUsed > maxAge) {
      cleanupTexture(url);
    }
  }
};

setInterval(cleanupOldTextures, 30000); // Run cleanup every 30 seconds

type Photo = {
  id: string;
  url: string;
};

type PhotoPlaneProps = {
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  pattern: 'float' | 'wave' | 'spiral' | 'grid';
  speed: number;
  animationEnabled: boolean;
  size: number;
  settings: any;
  photos: Photo[];
  index: number;
  wall?: 'front' | 'back';
};

// Helper functions
const generatePhotoList = (photos: Photo[], maxCount: number, useStockPhotos: boolean, stockPhotos: string[]): Photo[] => {
  const result: Photo[] = [];
  const userPhotos = photos.slice(0, maxCount);
  
  // Calculate number of slots to fill
  const totalSlots = maxCount;
  const emptySlots = totalSlots - userPhotos.length;
  
  if (useStockPhotos && stockPhotos.length > 0) {
    // Mix user photos with stock photos
    result.push(...userPhotos);
    
    // Fill remaining slots with stock photos
    for (let i = 0; i < emptySlots; i++) {
      result.push({
        id: `stock-${i}`,
        url: stockPhotos[i % stockPhotos.length]
      });
    }
  } else {
    // When stock photos are disabled, put user photos in front
    // Fill background with empty slots first
    for (let i = 0; i < emptySlots; i++) {
      result.push({
        id: `empty-${i}`,
        url: ''
      });
    }
    
    // Then add user photos so they appear in the foreground
    if (userPhotos.length > 0) {
      result.push(...userPhotos);
    }
  }
  
  return result;
};

// Helper to generate random rotation for photos
const randomRotation = (): [number, number, number] => {
  return [0, 0, 0]; // Keep photos straight
};

// Calculate optimal floor dimensions based on photo count and aspect ratio
const calculateOptimalFloorDimensions = (photoCount: number, spacing: number, aspectRatio: number): {
  size: number,
  cols: number,
  rows: number,
  cellSize: number
} => {
  // Calculate grid dimensions based on aspect ratio
  const cols = Math.ceil(Math.sqrt(photoCount * aspectRatio));
  const rows = Math.ceil(photoCount / cols);
  
  // Calculate minimum floor size needed to fit all photos with proper spacing
  // Add some padding (1.2 multiplier) to ensure photos don't touch the edge
  const minSize = Math.max(cols, rows) * spacing * 1.2;
  
  // Cell size within the floor
  const cellSize = minSize / Math.max(cols, rows);
  
  return {
    size: minSize,
    cols,
    rows,
    cellSize
  };
};

// Scene setup component with camera initialization
const SceneSetup: React.FC<{ settings: any, pattern: string }> = ({ settings, pattern }) => {
  const gradientMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorA: { value: new THREE.Color(settings.backgroundGradientStart) },
        colorB: { value: new THREE.Color(settings.backgroundGradientEnd) }
      },
      vertexShader: gradientShader.vertexShader,
      fragmentShader: gradientShader.fragmentShader,
      depthWrite: false
    });
  }, []);
  
  useEffect(() => {
    gradientMaterial.uniforms.colorA.value.set(settings.backgroundGradientStart);
    gradientMaterial.uniforms.colorB.value.set(settings.backgroundGradientEnd);
  }, [gradientMaterial, settings.backgroundGradientStart, settings.backgroundGradientEnd]);

  const { camera } = useThree();

  useEffect(() => {
    if (camera) {
      // Set higher camera position for grid pattern to see the entire wall
      if (pattern === 'grid') {
        camera.position.set(0, settings.cameraHeight * 1.5, settings.cameraDistance * 1.2);
      } else {
        camera.position.set(0, settings.cameraHeight, settings.cameraDistance);
      }
      camera.updateProjectionMatrix();
    }
  }, [camera, settings.cameraHeight, settings.cameraDistance, pattern]);

  return (
    <>
      {settings.backgroundGradient ? (
        <mesh position={[0, 0, -1]}>
          <planeGeometry args={[2, 2]} />
          <primitive object={gradientMaterial} attach="material" />
        </mesh>
      ) : (
        <color attach="background" args={[settings.backgroundColor]} />
      )}
      <ambientLight intensity={settings.ambientLightIntensity} />
      {Array.from({ length: settings.spotlightCount }).map((_, i) => {
        const angle = (i / settings.spotlightCount) * Math.PI * 2;
        const x = Math.cos(angle) * settings.spotlightDistance;
        const z = Math.sin(angle) * settings.spotlightDistance;
        const target = new THREE.Object3D();
        target.position.set(0, -2, 0); // Target the floor

        return (
          <group key={i}>
            <primitive object={target} />
            <spotLight
              position={[x, settings.spotlightHeight, z]}
              intensity={settings.spotlightIntensity}
              power={40}
              color={settings.spotlightColor}
              angle={Math.min(settings.spotlightAngle * Math.pow(settings.spotlightWidth, 3), Math.PI)}
              decay={1.5}
              penumbra={settings.spotlightPenumbra}
              distance={300}
              target={target}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-bias={-0.001}
            />
          </group>
        );
      })}
    </>
  );
};

// Loading fallback component
const LoadingFallback: React.FC = () => {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="white" />
    </mesh>
  );
};

// Component for individual photo planes
const PhotoPlane: React.FC<PhotoPlaneProps> = ({ url, position, rotation, pattern, speed, animationEnabled, size, settings, photos, index }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const initialPosition = useRef<[number, number, number]>(position);
  const startDelay = useRef<number>(Math.random() * 2); // Reduced delay for smoother start
  const elapsedTime = useRef<number>(0);
  const time = useRef<number>(0);
  const { camera, size: canvasSize } = useThree();
  
  // Pattern-specific refs
  const floatProgress = useRef<number>(Math.random()); // Random starting progress for float animation
  const floatYOffset = useRef<number>(Math.random() * 5); // Random height offset
  const floatSpeed = useRef<number>(0.1 + Math.random() * 0.4); // Random speed for each photo
  
  const waveBasePosition = useRef<{x: number, z: number}>({x: position[0], z: position[2]});
  const waveAmplitude = useRef<number>(0.5 + Math.random() * 1.5); // Random amplitude between 0.5 and 2.0
  const waveFrequency = useRef<number>(0.3 + Math.random() * 0.5); // Random frequency
  const wavePhaseOffset = useRef<number>(Math.random() * Math.PI * 2); // Random phase offset
  
  const texture = useMemo(() => {
    if (!url) return null;
    return loadTexture(url);
  }, [url]);
  
  useEffect(() => {
    return () => {
      if (url) cleanupTexture(url);
    };
  }, [url]);
  
  // Initialize pattern-specific positions
  useEffect(() => {
    if (pattern === 'wave' || pattern === 'float') {
      // Get floor size - use settings or calculate based on photo count
      const spacing = settings.photoSize * (1 + settings.photoSpacing);
      const { size: calculatedFloorSize } = calculateOptimalFloorDimensions(
        photos.length,
        spacing,
        canvasSize.width / canvasSize.height
      );
      
      // Use the larger of user setting or calculated size
      const floorSize = Math.max(settings.floorSize, calculatedFloorSize);
      
      // For wave pattern, save the base position for the wave effect
      if (pattern === 'wave') {
        // Calculate position based on index to distribute evenly across the floor
        const totalPhotos = photos.length;
        const cols = Math.ceil(Math.sqrt(totalPhotos));
        const rows = Math.ceil(totalPhotos / cols);
        
        // Calculate position within grid
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        // Size of each cell in the grid
        const cellWidth = floorSize / cols;
        const cellDepth = floorSize / rows;
        
        // Calculate position (centered on floor)
        const x = (col * cellWidth) - (floorSize / 2) + (cellWidth / 2);
        const z = (row * cellDepth) - (floorSize / 2) + (cellDepth / 2);
        
        // Save base position for wave animation
        waveBasePosition.current = {x, z};
      }
      
      // For float pattern, save initial vertical position
      if (pattern === 'float') {
        // Calculate initial y position between -10 (below floor) and 20 (above floor)
        // This allows for a continuous stream of upward movement with photos entering from below
        floatProgress.current = Math.random();
      }
    }
  }, [pattern, settings.floorSize, settings.photoSize, settings.photoSpacing, photos.length, canvasSize, index, position]);
  
  useFrame((state, delta) => {
    if (!meshRef.current || !animationEnabled || !camera) return;
    
    // Use consistent time steps for animations
    const timeStep = Math.fround(delta * speed);
    elapsedTime.current += timeStep;
    time.current += timeStep;
    
    // Wait for start delay before beginning animation
    if (elapsedTime.current < startDelay.current) {
      return;
    }
    
    const mesh = meshRef.current;
    
    // Use spacing setting consistently across all patterns
    const spacing = settings.photoSize * (1 + settings.photoSpacing);
    
    // Get floor size - use settings or calculate based on photo count
    const { size: calculatedFloorSize } = calculateOptimalFloorDimensions(
      photos.length,
      spacing,
      canvasSize.width / canvasSize.height
    );
    
    // Use the larger of user setting or calculated size
    const floorSize = Math.max(settings.floorSize, calculatedFloorSize);
    
    // Define floor level constant - this is where our floor is positioned
    const floorLevel = -2;
    // Define minimum height above floor for all photos
    const minHeightAboveFloor = 0.5;
    
    switch (pattern) {
      case 'grid':
        // GRID PATTERN: Wall of photos hovering above the floor
        // ----------------------------------------
        // Calculate grid dimensions
        const totalPhotos = photos.length;
        let gridCols, gridRows;
        
        // Dynamic grid sizing based on photo count
        if (totalPhotos <= 100) {
          // Standard sizing for smaller collections
          gridCols = Math.ceil(Math.sqrt(totalPhotos));
        } else {
          // More columns for larger collections to create wider, shorter walls
          const aspectRatio = 1.5; // Wider than tall
          gridCols = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
        }
        
        gridRows = Math.ceil(totalPhotos / gridCols);
        
        // Calculate solid wall effect with minimal spacing
        // The spacing value now directly controls the gap between photos
        const basePhotoSize = settings.photoSize;
        
        // Map photoSpacing to actual spacing (creating a solid wall effect)
        // At minimum (0.5), photos will be completely adjacent (no gap)
        // At maximum (2.0), photos will have visible spacing between them
        const gapMultiplier = Math.max(0, settings.photoSpacing - 0.5) * 2; // 0 at min spacing, 1 at mid spacing, 3 at max spacing
        const photoGap = basePhotoSize * 0.05 * gapMultiplier; // Very small gap at minimum spacing
        
        // Calculate effective photo size with gap
        const effectivePhotoWidth = basePhotoSize;
        const effectivePhotoHeight = basePhotoSize * 1.5; // Account for photo aspect ratio
        
        // Position in wall grid
        const col = index % gridCols;
        const row = Math.floor(index / gridCols);
        
        // Calculate grid dimensions
        const wallWidth = gridCols * (effectivePhotoWidth + photoGap);
        const wallHeight = gridRows * (effectivePhotoHeight + photoGap);
        
        // Center the grid
        const gridXOffset = (wallWidth / 2) - (effectivePhotoWidth / 2);
        
        // Ensure bottom row is above floor
        const bottomRowY = floorLevel + minHeightAboveFloor + (effectivePhotoHeight / 2);
        
        // Calculate positions with minimal gaps for solid wall effect
        const xPos = gridXOffset - col * (effectivePhotoWidth + photoGap);
        const yPos = bottomRowY + row * (effectivePhotoHeight + photoGap);
        const zPos = -5; // Fixed distance behind
        
        // Apply calculated position
        mesh.position.set(xPos, yPos, zPos);
        
        // Face camera directly
        mesh.lookAt(camera.position);
        break;
        
      case 'float':
        // FLOAT PATTERN: Continuous upward stream of photos
        // ----------------------------------------
        // Calculate position for the photo in the floor grid
        const floatCols = Math.ceil(Math.sqrt(photos.length));
        const floatCol = index % floatCols;
        const floatRow = Math.floor(index / floatCols);
        
        // Size of each cell in the grid
        const cellWidth = floorSize / floatCols;
        const cellDepth = floorSize / floatCols;
        
        // Base X and Z position (center of cell)
        const baseX = (floatCol * cellWidth) - (floorSize / 2) + (cellWidth / 2);
        const baseZ = (floatRow * cellDepth) - (floorSize / 2) + (cellDepth / 2);
        
        // Add slight drift to X and Z over time
        const driftX = Math.sin(time.current * 0.2 + index) * 0.5;
        const driftZ = Math.cos(time.current * 0.3 + index * 1.3) * 0.5;
        
        // Update float progress
        floatProgress.current += delta * floatSpeed.current * speed;
        if (floatProgress.current > 1) {
          floatProgress.current = 0; // Reset when reaching the top
        }
        
        // Calculate Y position (continuous upward motion)
        // Map progress from 0-1 to a height range (-2 to 20)
        const minHeight = floorLevel; // Start at floor level
        const floatMaxHeight = 20;    // Maximum height
        const floatY = minHeight + (floatMaxHeight - minHeight) * floatProgress.current;
        
        // Update position with continuous upward motion
        mesh.position.set(
          baseX + driftX,
          Math.max(floatY, floorLevel + minHeightAboveFloor), // Ensure always above floor
          baseZ + driftZ
        );
        
        // Always face the camera
        mesh.lookAt(camera.position);
        break;
        
      case 'wave':
        // WAVE PATTERN: Distributed wave effect across the entire floor
        // ----------------------------------------
        // Get base position from ref
        const { x: waveX, z: waveZ } = waveBasePosition.current;
        
        // Calculate wave height based on position and time
        const waveY = Math.sin(
          time.current * speed * waveFrequency.current + 
          wavePhaseOffset.current + 
          (Math.sin(waveX * 0.1) + Math.cos(waveZ * 0.1))
        ) * waveAmplitude.current;
        
        // Ensure wave stays above the floor (minimum height above floor)
        const minWaveHeight = minHeightAboveFloor;
        
        // Set position with wave effect
        mesh.position.set(
          waveX,
          floorLevel + minWaveHeight + Math.abs(waveY), // Use absolute value to keep waves above floor
          waveZ
        );
        
        // Always face the camera
        mesh.lookAt(camera.position);
        break;
        
      case 'spiral':
        // SPIRAL PATTERN: Spiral animation
        // ----------------------------------------
        // Spiral parameters
        const spiralMaxHeight = 15;
        const spiralRadius = Math.sqrt(photos.length) * (1 + settings.photoSpacing * 0.5);
        const verticalSpeed = speed * 0.5;
        const rotationSpeed = speed * 2;
        
        // Calculate time-based position
        const t = ((time.current * verticalSpeed + (index / photos.length)) % 1) * Math.PI * 2;
        const spiralAngle = t + time.current * rotationSpeed;
        
        // Calculate spiral position
        const progress = t / (Math.PI * 2);
        const currentRadius = spiralRadius * (1 - progress);
        const spiralX = Math.cos(spiralAngle) * currentRadius * 2;
        const spiralY = spiralMaxHeight * (1 - progress);
        const spiralZ = Math.sin(spiralAngle) * currentRadius * 2;
        
        // Update position for spiral
        mesh.position.set(
          spiralX,
          Math.max(floorLevel + minHeightAboveFloor, floorLevel + spiralY), // Keep above floor
          spiralZ
        );
        
        // Look at camera
        mesh.lookAt(camera.position);
        break;
    }
  });

  if (!url) {
    return (
      <mesh ref={meshRef} position={position} rotation={rotation}>
        <planeGeometry args={[size, size * 1.5, 1, 1]} />
        <meshPhysicalMaterial 
          color={settings.emptySlotColor}
          metalness={0.8}
          roughness={0.2} 
          clearcoat={0.5}
          clearcoatRoughness={0.3}
        />
      </mesh>
    );
  }

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[size, size * 1.5]} />
      <meshStandardMaterial 
        map={texture || null}
        side={THREE.DoubleSide}
        castShadow
        receiveShadow
        transparent={false}
        toneMapped={true}
      />
    </mesh>
  );
};

// Photos container component
const PhotosContainer: React.FC<{ photos: Photo[], settings: any }> = ({ photos, settings }) => {
  const { size: canvasSize } = useThree();
  
  const photoProps = useMemo(() => {
    // Calculate spacing
    const spacing = settings.photoSize * (1 + settings.photoSpacing);
    
    // Calculate optimal dimensions for initial positioning
    const aspectRatio = canvasSize.width / canvasSize.height;
    const { size: floorSize, cols, rows } = calculateOptimalFloorDimensions(
      photos.length,
      spacing,
      aspectRatio
    );
    
    // Calculate cell size
    const cellWidth = floorSize / cols;
    const cellDepth = floorSize / rows;
    
    // Define floor level constant - this is where our floor is positioned
    const floorLevel = -2;
    // Define minimum height above floor for all photos
    const minHeightAboveFloor = 0.5;
    
    // Generate initial props for all photos
    return photos.map((photo, index) => {
      // Calculate position within grid
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // Calculate centered position on floor
      const x = (col * cellWidth) - (floorSize / 2) + (cellWidth / 2);
      const z = (row * cellDepth) - (floorSize / 2) + (cellDepth / 2);
      
      // Initial Y position depends on the pattern
      let y = floorLevel + minHeightAboveFloor; // Default - just above floor
      
      if (settings.animationPattern === 'grid') {
        // For grid, position above floor in a wall
        const gridRows = Math.ceil(photos.length / cols);
        const gridRow = Math.floor(index / cols);
        
        // Calculate grid dimensions
        const totalPhotos = photos.length;
        let gridCols;
        
        // Dynamic grid sizing based on photo count
        if (totalPhotos <= 100) {
          gridCols = Math.ceil(Math.sqrt(totalPhotos));
        } else {
          const aspectRatio = 1.5;
          gridCols = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
        }
        
        const gridRows = Math.ceil(totalPhotos / gridCols);
        
        // For solid wall effect, minimal spacing between photos
        const basePhotoSize = settings.photoSize;
        const photoHeight = basePhotoSize * 1.5;
        
        // Calculate minimal gap (can be zero for perfect grid)
        const gapMultiplier = Math.max(0, settings.photoSpacing - 0.5) * 2;
        const photoGap = basePhotoSize * 0.05 * gapMultiplier;
        
        // Ensure bottom row is above floor
        const bottomRowY = floorLevel + minHeightAboveFloor + (photoHeight / 2);
        
        // Position in stack based on row
        y = bottomRowY + (gridRow * (photoHeight + photoGap));
      } else if (settings.animationPattern === 'float') {
        // For float, spread vertically based on index
        y = floorLevel + minHeightAboveFloor + (Math.random() * 20); // Start at random heights above floor
      } else if (settings.animationPattern === 'spiral') {
        // For spiral, Y depends on progress in the spiral
        y = floorLevel + minHeightAboveFloor + (Math.random() * 5); // Varied initial heights above floor
      }
      
      return {
        key: photo.id,
        url: photo.url,
        position: [x, y, z] as [number, number, number],
        rotation: randomRotation(),
        pattern: settings.animationPattern,
        speed: settings.animationSpeed,
        animationEnabled: settings.animationEnabled,
        settings: settings,
        size: settings.photoSize,
        photos: photos,
        index: index
      };
    });
  }, [photos, settings, canvasSize]);

  return (
    <>
      {photoProps.map((props) => (
        <PhotoPlane key={props.key} {...props} />
      ))}
    </>
  );
};

// Floor component with Grid
const Floor: React.FC<{ settings: any, photos: Photo[] }> = ({ settings, photos }) => {
  const { scene, size: canvasSize } = useThree();
  const [isGridReady, setIsGridReady] = React.useState(false);

  // Calculate optimal floor size based on photo count
  const spacing = settings.photoSize * (1 + settings.photoSpacing);
  const { size: calculatedSize } = calculateOptimalFloorDimensions(
    photos.length, 
    spacing, 
    canvasSize.width / canvasSize.height
  );
  
  // Use the larger of user setting or calculated size
  const effectiveFloorSize = Math.max(settings.floorSize, calculatedSize);

  useEffect(() => {
    // Wait for scene to be ready before enabling grid
    if (scene) {
      const timeout = setTimeout(() => setIsGridReady(true), 100);
      return () => clearTimeout(timeout);
    }
  }, [scene]);

  if (!settings.floorEnabled) return null;

  return (
    <>
      {/* Render grid FIRST - positioned slightly above the floor */}
      {settings.gridEnabled && isGridReady && (
        <Grid
          position={[0, -1.99, 0]} // Position grid ABOVE the floor
          args={[effectiveFloorSize, settings.gridDivisions]}
          cellSize={1}
          cellThickness={0.5}
          cellColor={settings.gridColor}
          sectionSize={3}
          fadeDistance={30}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid={false}
        />
      )}
      
      {/* Then render the floor with depthWrite set to false */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -2, 0]}
        receiveShadow
      >
        <planeGeometry args={[effectiveFloorSize, effectiveFloorSize]} />
        <meshStandardMaterial 
          color={new THREE.Color(settings.floorColor)}
          receiveShadow
          transparent={true}
          opacity={settings.floorOpacity}
          metalness={settings.floorMetalness}
          roughness={settings.floorRoughness}
          side={THREE.DoubleSide}
          depthWrite={false} // This is critical - prevents floor from occluding grid
        />
      </mesh>
    </>
  );
};

// Camera setup component
const CameraSetup: React.FC<{ settings: any, pattern: string }> = ({ settings, pattern }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (camera) {
      // Adjust camera height based on pattern
      if (pattern === 'grid') {
        // For grid pattern, position camera higher to see the full wall
        camera.position.set(0, settings.cameraHeight * 2, settings.cameraDistance * 1.2);
      } else {
        camera.position.set(0, settings.cameraHeight, settings.cameraDistance);
      }
      camera.updateProjectionMatrix();
    }
  }, [camera, settings.cameraHeight, settings.cameraDistance, pattern]);

  return null;
};

type CollageSceneProps = {
  photos: Photo[];
};

// Main scene component
const CollageScene: React.FC<CollageSceneProps> = ({ photos }) => {
  const settings = useSceneStore((state) => state.settings);
  const [stockPhotos, setStockPhotos] = React.useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSceneReady, setIsSceneReady] = React.useState(false);

  useEffect(() => {
    getStockPhotos().then(setStockPhotos);
  }, []);

  const displayedPhotos = useMemo(() => 
    generatePhotoList(
      Array.isArray(photos) ? photos : [],
      settings.photoCount,
      settings.useStockPhotos,
      stockPhotos
    ),
    [photos, settings.photoCount, settings.useStockPhotos, stockPhotos]
  );

  const handleCreated = ({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.setClearColor(0x000000, 0);
    gl.info.autoReset = true;
    gl.physicallyCorrectLights = true;
    
    // Mark scene as ready after a short delay to ensure everything is initialized
    setTimeout(() => setIsSceneReady(true), 100);
  };

  // Set initial camera position based on pattern
  const initialCameraHeight = settings.animationPattern === 'grid' 
    ? settings.cameraHeight * 2 // Higher for grid pattern
    : settings.cameraHeight;
    
  const initialCameraDistance = settings.animationPattern === 'grid'
    ? settings.cameraDistance * 1.2 // Further back for grid pattern
    : settings.cameraDistance;

  return (
    <div className="w-full h-full">
      <Canvas
        ref={canvasRef}
        gl={{ 
          antialias: true,
          powerPreference: "high-performance",
          precision: "highp",
          logarithmicDepthBuffer: true
        }}
        dpr={[1, 1.5]}
        frameloop="always"
        performance={{ min: 0.8 }}
        onCreated={handleCreated}
        camera={{
          fov: 60,
          near: 0.1,
          far: 2000,
          position: [0, initialCameraHeight, initialCameraDistance]
        }}
        style={{ visibility: isSceneReady ? 'visible' : 'hidden' }}
      >
        <React.Suspense fallback={null}>
          {isSceneReady && (
            <>
            <CameraSetup settings={settings} pattern={settings.animationPattern} />
            <SceneSetup settings={settings} pattern={settings.animationPattern} />
            <Floor settings={settings} photos={displayedPhotos} />
            
            <OrbitControls 
              makeDefault
              enableZoom={true}
              enablePan={false}
              autoRotate={settings.cameraEnabled && settings.cameraRotationEnabled}
              autoRotateSpeed={settings.cameraRotationSpeed}
              minDistance={5}
              maxDistance={100}
              maxPolarAngle={Math.PI * 0.65}
              dampingFactor={0.1}
              enableDamping={true}
              rotateSpeed={0.8}
              zoomSpeed={0.8}
            />
            
            <PhotosContainer photos={displayedPhotos} settings={settings} />
            </>
          )}
        </React.Suspense>
      </Canvas>
      {!isSceneReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-2 text-gray-400">Loading scene...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollageScene;