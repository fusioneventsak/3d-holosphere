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
const SceneSetup: React.FC<{ settings: any }> = ({ settings }) => {
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
      camera.position.set(0, settings.cameraHeight, settings.cameraDistance);
      camera.updateProjectionMatrix();
    }
  }, [camera, settings.cameraHeight, settings.cameraDistance]);

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
  const startDelay = useRef<number>(Math.random() * 5); // Reduced delay for smoother start
  const gridPosition = useRef<[number, number]>([
    Math.floor(index % Math.sqrt(photos.length)),
    Math.floor(index / Math.sqrt(photos.length))
  ]);
  const orbitRadius = useRef<number>(Math.random() * 3 + 5); // Random orbit radius between 5-8
  const randomOffset = useRef<[number, number, number]>([
    (Math.random() - 0.5) * 2,
    Math.random() * 0.5,
    (Math.random() - 0.5) * 2
  ]);
  const elapsedTime = useRef<number>(0);
  const time = useRef<number>(0);
  const heightOffset = useRef<number>(Math.random() * 5); // Add random initial offset
  const { camera, size: canvasSize } = useThree();
  
  // Wave pattern specific refs
  const waveGridPosition = useRef<{x: number, z: number}>({x: 0, z: 0});
  const waveAmplitude = useRef<number>(Math.random() * 1.2 + 0.3); // Random amplitude between 0.3 and 1.5
  const waveFrequency = useRef<number>(Math.random() * 0.5 + 0.2); // Random frequency between 0.2 and 0.7
  const wavePhaseOffset = useRef<number>(Math.random() * Math.PI * 2); // Random phase offset
  
  // Force recalculation of position when settings that affect distribution change
  useEffect(() => {
    // Reset grid positions when spacing or floor size changes
    waveGridPosition.current = {x: 0, z: 0};
  }, [settings.photoSpacing, settings.floorSize, settings.photoSize]);
  
  const texture = useMemo(() => {
    if (!url) return null;
    return loadTexture(url);
  }, [url]);
  
  useEffect(() => {
    return () => {
      if (url) cleanupTexture(url);
    };
  }, [url]);
  
  useFrame((state, delta) => {
    if (!meshRef.current || !animationEnabled || !camera) return;
    
    // Use consistent time steps for animations
    const timeStep = Math.fround(delta * speed);
    elapsedTime.current = Math.fround(elapsedTime.current + timeStep);
    time.current = Math.fround(time.current + timeStep);
    
    // Wait for start delay before beginning animation
    if (elapsedTime.current < startDelay.current) {
      return;
    }
    
    const mesh = meshRef.current;
    // Ensure position updates use consistent precision
    const updatePosition = (x: number, y: number, z: number) => {
      mesh.position.set(
        Math.fround(x),
        Math.fround(y),
        Math.fround(z)
      );
    };

    // Use spacing setting consistently across all patterns
    const spacing = settings.photoSize * (1 + settings.photoSpacing);
    
    // Calculate optimal floor dimensions based on photo count
    const { size: optimalFloorSize, cols, rows, cellSize } = calculateOptimalFloorDimensions(
      photos.length,
      spacing,
      canvasSize.width / canvasSize.height
    );
    
    // Use the larger of user-defined floor size or calculated optimal size
    const effectiveFloorSize = Math.max(settings.floorSize, optimalFloorSize);
    
    // Recalculate cell size based on the effective floor size to ensure full coverage
    const effectiveCellSize = effectiveFloorSize / Math.max(cols, rows);
    
    switch (pattern) {
      case 'grid':
        // Calculate position in the grid
        const gridRow = Math.floor(index / cols);
        const gridCol = index % cols;
        
        // Center the grid on the floor
        const halfFloorSize = effectiveFloorSize / 2;
        const xOffset = -halfFloorSize + effectiveCellSize / 2;
        const zOffset = -halfFloorSize + effectiveCellSize / 2;
        
        // Set position in grid
        updatePosition(
          xOffset + (gridCol * effectiveCellSize),
          2, // Position photos above the floor at a fixed height
          zOffset + (gridRow * effectiveCellSize)
        );
        
        // Keep photos facing forward
        mesh.rotation.set(0, 0, 0);
        break;
        
      case 'float':
        // Calculate base position in the grid
        const floatRow = Math.floor(index / cols);
        const floatCol = index % cols;
        
        // Center the grid on the floor
        const halfFloatFloorSize = effectiveFloorSize / 2;
        const floatXOffset = -halfFloatFloorSize + effectiveCellSize / 2;
        const floatZOffset = -halfFloatFloorSize + effectiveCellSize / 2;
        
        // Base position
        const floatBaseX = floatXOffset + (floatCol * effectiveCellSize);
        const floatBaseZ = floatZOffset + (floatRow * effectiveCellSize);
        
        // Add some randomness for natural distribution
        const floatOffsetX = (Math.sin(time.current * 0.5 + index) * 0.5) * effectiveCellSize * 0.3;
        const floatOffsetZ = (Math.cos(time.current * 0.5 + index * 1.5) * 0.5) * effectiveCellSize * 0.3;
        
        // Calculate floating motion with random height
        const floatHeight = 15;
        const floatY = Math.max(2, 
          2 + (Math.sin(time.current * speed + startDelay.current + index * 0.2) * 0.5 + 0.5) * floatHeight * (0.5 + Math.random() * 0.5)
        );
        
        updatePosition(
          floatBaseX + floatOffsetX,
          floatY,
          floatBaseZ + floatOffsetZ
        );
        
        // Always face the camera
        mesh.lookAt(camera.position);
        break;
        
      case 'wave':
        // Calculate or use cached wave grid position
        if (waveGridPosition.current.x === 0 && waveGridPosition.current.z === 0) {
          // Calculate row and column for this photo
          const waveRow = Math.floor(index / cols);
          const waveCol = index % cols;
          
          // Center the grid on the floor
          const halfWaveFloorSize = effectiveFloorSize / 2;
          const waveXOffset = -halfWaveFloorSize + effectiveCellSize / 2;
          const waveZOffset = -halfWaveFloorSize + effectiveCellSize / 2;
          
          // Calculate position to distribute evenly across floor
          const x = waveXOffset + (waveCol * effectiveCellSize);
          const z = waveZOffset + (waveRow * effectiveCellSize);
          
          // Store calculated grid position
          waveGridPosition.current = {x, z};
        }
        
        // Get the base grid position
        const {x: baseX, z: baseZ} = waveGridPosition.current;
        
        // Wave animation calculation with varying amplitudes and frequencies
        const waveY = 2 + // Base height above floor
          Math.sin(time.current * speed * waveFrequency.current + wavePhaseOffset.current + 
                  (Math.sin(baseX * 0.1) + Math.cos(baseZ * 0.1)) * 2) * 
          waveAmplitude.current;
        
        // Set final position
        updatePosition(
          baseX,
          waveY,
          baseZ
        );
        
        // Always face the camera
        mesh.lookAt(camera.position);
        break;
        
      case 'spiral':
        // Spiral parameters
        const maxHeight = 15;
        const spiralRadius = Math.sqrt(photos.length) * (1 + settings.photoSpacing * 0.5); // Apply spacing to spiral radius
        const verticalSpeed = speed * 0.5;
        const rotationSpeed = speed * 2;
        
        // Calculate time-based position
        const t = ((time.current * verticalSpeed + (index / photos.length)) % 1) * Math.PI * 2;
        const spiralAngle = t + time.current * rotationSpeed;
        
        // Calculate spiral position
        const progress = t / (Math.PI * 2);
        const currentRadius = spiralRadius * (1 - progress) * (effectiveFloorSize / 20); // Scale radius by floor size
        const spiralX = Math.cos(spiralAngle) * currentRadius;
        const spiralY = maxHeight * (1 - progress);
        const spiralZ = Math.sin(spiralAngle) * currentRadius;
        
        updatePosition(
          spiralX,
          Math.max(2, spiralY), // Keep above floor
          spiralZ
        );
        
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
    // Calculate optimal floor dimensions based on photo count and spacing
    const spacing = settings.photoSize * (1 + settings.photoSpacing);
    const aspectRatio = canvasSize.width / canvasSize.height;
    const { cols, rows, cellSize, size: optimalSize } = calculateOptimalFloorDimensions(
      photos.length, 
      spacing, 
      aspectRatio
    );
    
    // Calculate the effective floor size (either user setting or calculated optimal)
    const effectiveFloorSize = Math.max(settings.floorSize, optimalSize);
    
    // Recalculate cell size based on effective floor size to ensure full coverage
    const effectiveCellSize = effectiveFloorSize / Math.max(cols, rows);
    
    // Generate props for photos distributed within floor boundaries
    return photos.map((photo, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // Calculate base position to evenly distribute across entire floor
      const halfFloorSize = effectiveFloorSize / 2;
      const x = -halfFloorSize + effectiveCellSize / 2 + (col * effectiveCellSize);
      const z = -halfFloorSize + effectiveCellSize / 2 + (row * effectiveCellSize);
      
      return {
        key: photo.id,
        url: photo.url,
        position: [x, 2, z] as [number, number, number], // Position above floor
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
const CameraSetup: React.FC<{ settings: any }> = ({ settings }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (camera) {
      camera.position.set(0, settings.cameraHeight, settings.cameraDistance);
      camera.updateProjectionMatrix();
    }
  }, [camera, settings.cameraHeight, settings.cameraDistance]);

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
          position: [0, settings.cameraHeight, settings.cameraDistance]
        }}
        style={{ visibility: isSceneReady ? 'visible' : 'hidden' }}
      >
        <React.Suspense fallback={null}>
          {isSceneReady && (
            <>
            <CameraSetup settings={settings} />
            <SceneSetup settings={settings} />
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