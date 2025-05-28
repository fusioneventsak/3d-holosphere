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
  spacing: number; // Add spacing prop
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
const randomPosition = (index: number, total: number, settings: any, isUserPhoto: boolean, spacing: number): [number, number, number] => {
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
        // Target the center point at floor level
        target.position.set(0, 0, 0);

        return (
          <group key={i}>
            <primitive object={target} />
            <spotLight
              position={[x, settings.spotlightHeight, z]}
              intensity={settings.spotlightIntensity}
              power={40}
              color={settings.spotlightColor}
              angle={Math.PI / 4}
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
const PhotoPlane: React.FC<PhotoPlaneProps> = ({ url, position, rotation, pattern, speed, animationEnabled, size, settings, photos, index, wall, spacing }) => {
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
      case 'grid': {
        // Define minimum height for all patterns
        const minHeight = 4; // Ensure grid starts above floor
        
        // Calculate grid dimensions
        const baseAspectRatio = settings.gridAspectRatio || 1;
        let gridWidth, gridHeight;
        if (baseAspectRatio >= 1) {
          // Wider grid
          gridWidth = Math.ceil(Math.sqrt(totalPhotos * baseAspectRatio));
          gridHeight = Math.ceil(totalPhotos / gridWidth);
        } else {
          // Taller grid
          gridHeight = Math.ceil(Math.sqrt(totalPhotos / baseAspectRatio));
          gridWidth = Math.ceil(totalPhotos / gridHeight);
        }
        
        // Create tight spacing for a solid wall effect
        // Use photo dimensions - width and 1.5x height for portrait orientation
        const baseWidth = settings.photoSize;
        const baseHeight = settings.photoSize * 1.5;
        
        // Calculate spacing based on photo size and spacing factor
        const horizontalSpacing = baseWidth * (1 + settings.photoSpacing);
        const verticalSpacing = baseHeight * (1 + settings.photoSpacing);
        
        // Calculate position in the wall grid
        const row = Math.floor(index / gridWidth);
        const col = index % gridWidth;
        
        // Center the grid
        const xOffset = ((gridWidth - 1) * horizontalSpacing) * -0.5;
        const yOffset = settings.wallHeight + ((gridHeight - 1) * verticalSpacing) * -0.5;
        
        // Set position in grid - ensure both walls are positioned above the floor
        updatePosition(
          Math.fround(xOffset + (col * horizontalSpacing)),
          Math.fround(minHeight + yOffset + (row * verticalSpacing) + settings.wallHeight),
          2 // All photos on same wall
        );
        
        // Set rotation based on wall
        mesh.rotation.set(0, Math.PI, 0); // Back wall faces outward
        // Keep photos facing forward
        mesh.rotation.set(0, 0, 0);
        break;
      }
        
      case 'float': {
        // Calculate distribution area based on floor size
        const distributionArea = settings.floorSize * 0.8; // Use 80% of floor size
        const gridSize = Math.ceil(Math.sqrt(photos.length));
        const baseSpacing = (distributionArea / gridSize) * (1 + settings.photoSpacing);
        
        // Calculate fixed base position
        const col = index % gridSize;
        const row = Math.floor(index / gridSize);
        
        // Create stable base positions
        const baseX = (col - gridSize/2) * baseSpacing;
        const baseZ = (row - gridSize/2) * baseSpacing;
        
        // Animation parameters
        const cycleHeight = 30;
        const cycleDuration = 15;
        const phaseOffset = (Math.sin(index * 2.37) + Math.cos(index * 1.73)) * Math.PI;
        
        // Calculate smooth vertical motion
        const normalizedTime = (time.current * speed + phaseOffset) % cycleDuration;
        const progress = normalizedTime / cycleDuration;
        const y = -2 + progress * cycleHeight;
        
        // Add subtle, stable drift
        const driftScale = spacing * 0.2;
        const driftX = Math.sin(time.current * 0.3 + phaseOffset) * driftScale;
        const driftZ = Math.cos(time.current * 0.3 + phaseOffset) * driftScale;
        
        updatePosition(
          baseX + driftX,
          y,
          baseZ + driftZ
        );
        
        // Always face the camera
        mesh.lookAt(camera.position);
        break;
      }
        
      case 'wave': {
        const distributionArea = settings.floorSize * 0.6; // Use 60% of floor size
        const photosPerRow = Math.ceil(Math.sqrt(photos.length));
        const baseSpacing = (distributionArea / photosPerRow) * (1 + settings.photoSpacing);
        
        // Create unique phase offset for each photo using prime numbers
        const phaseOffset = (
          Math.sin(index * 2.37) +
          Math.cos(index * 1.73) +
          Math.sin(index * 3.17)
        ) * Math.PI;
        
        const waveGridX = index % photosPerRow;
        const waveGridZ = Math.floor(index / photosPerRow);
        
        // Base position in the grid
        const xPos = (waveGridX * baseSpacing) - (distributionArea * 0.5) + (baseSpacing * 0.5);
        const zPos = (waveGridZ * baseSpacing) - (distributionArea * 0.5) + (baseSpacing * 0.5);
        
        // Calculate vertical position with continuous motion
        const baseHeight = 4; // Minimum height above floor
        const waveHeight = 8; // Total height of wave motion
        const normalizedTime = (time.current * speed + phaseOffset) % (Math.PI * 2);
        const waveY = baseHeight + (Math.sin(normalizedTime) + 1) * (waveHeight * 0.5);
        
        // Add subtle horizontal drift
        const driftScale = baseSpacing * 0.2;
        const xDrift = Math.sin(normalizedTime * 0.5) * driftScale;
        const zDrift = Math.cos(normalizedTime * 0.7) * driftScale;
        
        updatePosition(
          xPos + xDrift,
          waveY,
          zPos + zDrift
        );
        
        mesh.lookAt(camera.position);
        break;
      }
        
      case 'spiral': {
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
          Math.max(4, spiralY), // Ensure minimum height above floor
          (wall === 'back' ? -1 : 1) * spiralZ // Flip Z for back wall
        );
        
        mesh.lookAt(camera.position);
        break;
      }
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
    const totalPhotos = photos.length;
    const baseAspectRatio = settings.gridAspectRatio || 1;
    
    // Calculate grid dimensions based on aspect ratio
    let gridWidth, gridHeight;
    if (baseAspectRatio >= 1) {
      // Wider grid
      gridWidth = Math.ceil(Math.sqrt(totalPhotos * baseAspectRatio));
      gridHeight = Math.ceil(totalPhotos / gridWidth);
    } else {
      // Taller grid
      gridHeight = Math.ceil(Math.sqrt(totalPhotos / baseAspectRatio));
      gridWidth = Math.ceil(totalPhotos / gridHeight);
    }
    
    // Calculate spacing
    const photoHeight = settings.photoSize * 1.5;
    const spacing = settings.photoSize * (1 + settings.photoSpacing);
    const verticalSpacing = photoHeight * (1 + settings.photoSpacing);
    const horizontalSpacing = settings.photoSize * (1 + settings.photoSpacing);
    
    return photos.map((photo, index) => {
      const col = index % gridWidth;
      const row = Math.floor(index / gridWidth);
      
      // Center the grid horizontally and vertically
      const gridXOffset = ((gridWidth - 1) * horizontalSpacing) * -0.5;
      const gridYOffset = settings.wallHeight + ((gridHeight - 1) * verticalSpacing) * -0.5;
      const x = gridXOffset + (col * horizontalSpacing);
      const y = gridYOffset + (row * verticalSpacing);
      
      // All photos on the same wall
      const z = 2;
      
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
        spacing: spacing // Pass spacing as a prop
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
          position={[0, 0, 0]}
          args={[settings.gridSize, settings.gridDivisions]}
          cellSize={1}
          cellThickness={0.5}
          cellColor={settings.gridColor}
          sectionSize={3}
          fadeDistance={settings.gridSize}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid={false}
        />
      )}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[settings.floorSize, settings.floorSize]} />
        <meshStandardMaterial
          color={new THREE.Color(settings.floorColor)}
          transparent
          opacity={settings.floorOpacity}
          metalness={settings.floorMetalness}
          roughness={settings.floorRoughness}
          side={THREE.DoubleSide}
          depthWrite={false}
          polygonOffset={true}
          polygonOffsetFactor={-1}
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
              enablePan={true}
              autoRotate={settings.cameraEnabled && settings.cameraRotationEnabled}
              autoRotateSpeed={settings.cameraRotationSpeed}
              minDistance={5}
              maxDistance={100}
              minPolarAngle={0}
              maxPolarAngle={Math.PI * 0.85}
              dampingFactor={0.1}
              enableDamping={true}
              rotateSpeed={0.8}
              zoomSpeed={0.8}
              panSpeed={1.2}
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