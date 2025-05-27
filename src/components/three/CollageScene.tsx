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

// Helper to generate random positions for photos
const randomPosition = (index: number, total: number, settings: any, isUserPhoto: boolean): [number, number, number] => {
  // Calculate spacing between photos first
  const spacing = settings.photoSize * (1 + settings.photoSpacing);
  
  const aspectRatio = window.innerWidth / window.innerHeight;
  const gridWidth = Math.ceil(Math.sqrt(total * aspectRatio));
  const gridHeight = Math.ceil(total / gridWidth);
  
  // Add some randomness to the grid position
  const randomOffset = () => (Math.random() - 0.5) * settings.photoSpacing;
  
  // Calculate base grid position
  const col = index % gridWidth;
  const row = Math.floor(index / gridWidth);
  
  // Center the grid
  const xOffset = ((gridWidth - 1) * spacing) * -0.5;
  const yOffset = ((gridHeight - 1) * spacing) * -0.5;
  
  // Calculate position with random offset
  const x = xOffset + (col * spacing) + randomOffset();
  const y = yOffset + ((gridHeight - 1 - row) * spacing) + randomOffset();
  const z = 2; // Keep photos above floor

  return [x, y, z];
};

// Helper to generate random rotation for photos
const randomRotation = (): [number, number, number] => {
  return [0, 0, 0]; // Keep photos straight
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
const PhotoPlane: React.FC<PhotoPlaneProps> = ({ url, position, rotation, pattern, speed, animationEnabled, size, settings, photos, index, wall }) => {
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
  const { camera } = useThree();
  
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

    // Get total photos to display
    const totalPhotos = photos?.length || 1;
    
    switch (pattern) {
      case 'grid':
        // Calculate grid dimensions
        const aspectRatio = window.innerWidth / window.innerHeight;
        const gridWidth = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
        const gridHeight = Math.ceil(totalPhotos / gridWidth);
        
        // Create tight spacing for a solid wall effect
        // Use photo dimensions - width and 1.5x height for portrait orientation
        const horizontalSpacing = settings.photoSize * 1.05; // Just a bit wider than photo width
        const verticalSpacing = settings.photoSize * 1.55; // Just a bit taller than photo height
        
        // Calculate position in the wall grid
        const gridIndex = index;
        const row = Math.floor(gridIndex / gridWidth);
        const col = gridIndex % gridWidth;
        
        // Center the grid
        const xOffset = ((gridWidth - 1) * horizontalSpacing) * -0.5;
        const yOffset = ((gridHeight - 1) * verticalSpacing) * -0.5;
        
        // Set position in grid - ensure both walls are positioned above the floor
        updatePosition(
          Math.fround(xOffset + (col * horizontalSpacing)),
          Math.fround(yOffset + ((gridHeight - 1 - row) * verticalSpacing) + 2), // Add +2 to ensure above floor
          wall === 'back' ? -2 : 2 // Position photos on front or back wall
        );
        
        // Set rotation based on wall
        if (wall === 'back') {
          mesh.rotation.set(0, Math.PI, 0); // Back wall faces outward
        } else {
          mesh.rotation.set(0, 0, 0); // Front wall faces forward
        }
        break;
        
      case 'float':
        // Calculate grid-based starting position
        const gridX = (gridPosition.current[0] - Math.sqrt(photos.length) / 2) * settings.photoSize * 1.2;
        const gridZ = (gridPosition.current[1] - Math.sqrt(photos.length) / 2) * settings.photoSize * 1.2;
        
        // Add random offset for natural distribution
        const offsetX = randomOffset.current[0] * settings.photoSize;
        const offsetZ = randomOffset.current[2] * settings.photoSize;
        
        // Calculate floating motion
        const floatHeight = 15;
        const floatY = Math.max(2, // Ensure minimum height of 2 above floor
          (Math.sin(time.current * speed + startDelay.current) * 0.5 + 0.5) * floatHeight
        );
        
        updatePosition(
          gridX + offsetX,
          floatY,
          (wall === 'back' ? -1 : 1) * (gridZ + offsetZ) // Flip Z for back wall
        );
        
        // Always face the camera
        mesh.lookAt(camera.position);
        break;
        
      case 'wave':
        // Calculate grid-based position for even distribution
        const waveGridSize = Math.ceil(Math.sqrt(photos.length));
        const waveCol = index % waveGridSize;
        const waveSpacing = settings.photoSize * 1.2; // Use tighter spacing for wave pattern
        
        // Center the grid
        const waveXOffset = ((waveGridSize - 1) * waveSpacing) * -0.5;
        const waveZOffset = ((waveGridSize - 1) * waveSpacing) * -0.5;
        
        // Base position in grid
        const baseX = waveXOffset + (waveCol * waveSpacing);
        const waveRow = Math.floor(index / waveGridSize);
        const baseZ = waveZOffset + (waveRow * waveSpacing);
        
        // Wave parameters
        const baseY = 2; // Base height above floor
        const waveAmplitude = 1.5;
        const waveFrequency = 1;
        
        // Create unique wave phase for each photo based on position
        const phaseOffset = (waveCol + waveRow) * Math.PI / 2;
        
        // Calculate wave height
        const waveY = baseY + (
          Math.sin(time.current * speed * waveFrequency + phaseOffset) * waveAmplitude
        );
        
        updatePosition(
          baseX,
          Math.max(2, waveY), // Ensure minimum height of 2 above floor
          (wall === 'back' ? -1 : 1) * baseZ // Flip Z for back wall
        );
        
        mesh.lookAt(camera.position);
        break;
        
      case 'spiral':
        // Spiral parameters
        const maxHeight = 15;
        const spiralRadius = Math.sqrt(photos.length);
        const verticalSpeed = speed * 0.5;
        const rotationSpeed = speed * 2;
        
        // Calculate time-based position
        const t = ((time.current * verticalSpeed + (index / photos.length)) % 1) * Math.PI * 2;
        const spiralAngle = t + time.current * rotationSpeed;
        
        // Calculate spiral position
        const progress = t / (Math.PI * 2);
        const currentRadius = spiralRadius * (1 - progress);
        const spiralX = Math.cos(spiralAngle) * currentRadius * 2;
        const spiralY = maxHeight * (1 - progress);
        const spiralZ = Math.sin(spiralAngle) * currentRadius * 2;
        
        updatePosition(
          spiralX,
          Math.max(2, spiralY), // Ensure minimum height of 2 above floor
          (wall === 'back' ? -1 : 1) * spiralZ // Flip Z for back wall
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
  const photoProps = useMemo(() => {
    // Calculate total number of photos to display
    const totalPhotos = Math.min(photos.length, settings.photoCount);
    
    // Calculate grid dimensions based on aspect ratio
    const aspectRatio = window.innerWidth / window.innerHeight;
    const gridWidth = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
    const gridHeight = Math.ceil(totalPhotos / gridWidth);
    
    // Calculate photo dimensions and spacing
    const photoHeight = settings.photoSize * 1.5;
    const verticalSpacing = photoHeight * 1.05; // Slight gap between rows
    const horizontalSpacing = settings.photoSize * 1.05; 
    
    // Position entire wall at specified height
    const totalWallHeight = verticalSpacing * gridHeight;
    const baseHeight = settings.wallHeight;
    // Adjust starting Y position to ensure bottom row is above floor
    const startY = baseHeight + (totalWallHeight / 2);
    
    // Generate props for all photos in a single wall
    return photos.map((photo, index) => {
      const col = index % gridWidth;
      const row = Math.floor(index / gridWidth);
      
      // Center the grid
      const gridXOffset = ((gridWidth - 1) * horizontalSpacing) * -0.5;
      
      // Calculate position
      const x = gridXOffset + (col * horizontalSpacing);
      const y = startY - (row * verticalSpacing);
      const z = 0;
      
      const position: [number, number, number] = [x, y, z];
      const rotation: [number, number, number] = [0, 0, 0];
      
      return {
        key: photo.id,
        url: photo.url,
        position,
        rotation,
        pattern: settings.animationPattern,
        speed: settings.animationSpeed,
        animationEnabled: settings.animationEnabled,
        settings: settings,
        size: settings.photoSize,
        photos: photos,
        index: index,
        wall: 'front' as const // Keep single wall designation
      };
    });
  }, [photos, settings]);

  return (
    <>
      {photoProps.map((props) => (
        <PhotoPlane 
          key={props.key} 
          {...props} 
        />
      ))}
    </>
  );
};

// Floor component with Grid
const Floor: React.FC<{ settings: any }> = ({ settings }) => {
  const { scene } = useThree();
  const [isGridReady, setIsGridReady] = React.useState(false);

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
      {settings.gridEnabled && isGridReady && (
        <Grid
          position={[0, -2, 0]}
          args={[settings.gridSize, settings.gridDivisions]}
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
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -2.001, 0]}
      >
        <planeGeometry args={[settings.floorSize, settings.floorSize]} />
        <meshStandardMaterial
          color={new THREE.Color(settings.floorColor)}
          receiveShadow
          transparent
          opacity={settings.floorOpacity}
          metalness={settings.floorMetalness}
          roughness={settings.floorRoughness}
          side={THREE.DoubleSide}
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
        <React.Suspense fallback={<LoadingFallback />}>
          {isSceneReady && (
            <>
            <CameraSetup settings={settings} />
            <Floor settings={settings} />
            <SceneSetup settings={settings} />
            
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