import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
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
  pattern: 'float' | 'wave' | 'spiral';
  speed: number;
  animationEnabled: boolean;
  size: number;
  settings: any;
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
  // Create an even distribution across the floor
  const gridSize = Math.ceil(Math.sqrt(total));
  const spacing = (settings.floorSize / gridSize) * settings.photoSpacing;

  // Get position in grid
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;

  // Calculate base position
  const halfSize = ((settings.floorSize * settings.photoSpacing) / 2) - (spacing / 2);
  let x = (col * spacing) - halfSize;
  let z = (row * spacing) - halfSize;
  
  // If it's a user photo and stock photos are disabled, position in foreground
  if (isUserPhoto && !settings.useStockPhotos) {
    z = Math.min(z, 0); // Keep in front half of grid
  }

  // Start photos below the floor
  const y = -2;
  
  return [x, y, z];
};

// Helper to generate random rotation for photos
const randomRotation = (): [number, number, number] => {
  return [0, 0, 0]; // Keep photos straight
};

// Scene setup component with camera initialization
const SceneSetup: React.FC<{ settings: any }> = ({ settings }) => {
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
        <>
          <color attach="background" args={[settings.backgroundColor]} />
          <mesh position={[0, 0, -20]} scale={[40, 40, 1]}>
            <planeGeometry />
            <meshBasicMaterial>
              <gradientTexture
                attach="map"
                stops={[0, 1]} 
                colors={[settings.backgroundColor, settings.backgroundColorSecondary]}
                rotation={settings.backgroundGradientAngle * (Math.PI / 180)}
              />
            </meshBasicMaterial>
          </mesh>
        </>
      ) : (
        <color attach="background" args={[settings.backgroundColor]} />
      {settings.backgroundGradient ? (
        <mesh position={[0, 0, -20]} scale={[40, 40, 1]}>
          <planeGeometry />
          <meshBasicMaterial>
            <gradientTexture
              attach="map"
              stops={[0, 1]}
              colors={[settings.backgroundGradientStart, settings.backgroundGradientEnd]}
              rotation={settings.backgroundGradientAngle * (Math.PI / 180)}
            />
          </meshBasicMaterial>
        </mesh>
      ) : (
        <color attach="background" args={[settings.backgroundColor]} />
      )}
      <ambientLight intensity={settings.ambientLightIntensity} />
      {Array.from({ length: settings.spotlightCount }).map((_, i) => {
        const angle = (i / settings.spotlightCount) * Math.PI * 2;
        const x = Math.cos(angle) * settings.spotlightDistance;
        const z = Math.sin(angle) * settings.spotlightDistance;
        return (
          <spotLight
            key={i}
            position={[x, settings.spotlightHeight, z]}
            intensity={settings.spotlightIntensity}
            color={settings.spotlightColor}
            angle={settings.spotlightAngle}
            penumbra={settings.spotlightPenumbra}
            distance={50}
            decay={2}
          />
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
const PhotoPlane: React.FC<PhotoPlaneProps> = ({ url, position, rotation, pattern, speed, animationEnabled, size, settings }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const initialPosition = useRef<[number, number, number]>(position);
  const startDelay = useRef<number>(Math.random() * 10); // Random start delay between 0-10 seconds
  const elapsedTime = useRef<number>(0);
  const time = useRef<number>(0);
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
    
    elapsedTime.current += delta;
    time.current += delta;
    
    // Wait for start delay before beginning animation
    if (elapsedTime.current < startDelay.current) {
      return;
    }
    
    const mesh = meshRef.current;
    
    switch (pattern) {
      case 'float':
        // Calculate total animation duration (time to float from bottom to top)
        const animationDuration = 12 / speed; // 12 units of height / speed
        
        // Calculate current position in animation cycle
        const cycleTime = (elapsedTime.current - startDelay.current) % animationDuration;
        const progress = cycleTime / animationDuration;
        
        // Move from -2 to 10 (12 units total height)
        mesh.position.y = -2 + (progress * 12);
        
        // Always face the camera
        mesh.lookAt(camera.position);
        break;
        
      case 'wave':
        // Sine wave motion
        mesh.position.y = initialPosition.current[1] + Math.sin(time.current + (initialPosition.current[0] * 0.5)) * 2;
        break;
        
      case 'spiral':
        // Tornado spiral motion
        const spiralRadius = 8 + (time.current * 0.2);
        const height = time.current * 2;
        mesh.position.x = Math.cos(time.current * 2) * spiralRadius;
        mesh.position.z = Math.sin(time.current * 2) * spiralRadius;
        mesh.position.y = height;
        
        // Reset when reaching top
        if (height > 15) {
          time.current = 0;
        }
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
          transparent={true}
          opacity={0.8}
        />
      </mesh>
    );
  }

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[size, size * 1.5]} />
      <meshStandardMaterial 
        map={texture || null}
        side={THREE.FrontSide}
        transparent={false}
        toneMapped={true}
      />
    </mesh>
  );
};

// Photos container component
const PhotosContainer: React.FC<{ photos: Photo[], settings: any }> = ({ photos, settings }) => {
  const photoProps = useMemo(() => {
    return photos.map((photo, index) => {
      const isUserPhoto = !photo.id.startsWith('stock-') && !photo.id.startsWith('empty-');
      return {
        key: photo.id,
        url: photo.url,
        position: randomPosition(index, photos.length, settings, isUserPhoto),
        rotation: randomRotation(),
        pattern: settings.animationPattern,
        speed: settings.animationSpeed,
        animationEnabled: settings.animationEnabled,
        settings: settings,
        size: settings.photoSize,
      };
    });
  }, [photos, settings]);

  return (
    <>
      {photoProps.map((props) => (
        <PhotoPlane key={props.key} {...props} />
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
  const [isSceneReady, setIsSceneReady] = React.useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    getStockPhotos().then(setStockPhotos);
  }, []);

  // Reset scene ready state when critical settings change
  useEffect(() => {
    setIsSceneReady(false);
    // Small delay to ensure clean re-initialization
    const timer = setTimeout(() => setIsSceneReady(true), 300);
    return () => clearTimeout(timer);
  }, [settings.cameraDistance, settings.cameraHeight]);

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
    setIsSceneReady(true);
  };

  return (
    <div className="w-full h-full">
      <Canvas
        ref={canvasRef}
        gl={{ antialias: false }}
        dpr={[1, 1.5]}
        performance={{ min: 0.3 }}
        frameloop="demand"
        onCreated={handleCreated}
        camera={{
          fov: 60,
          near: 0.1,
          far: 50,
          position: [0, settings.cameraHeight, settings.cameraDistance]
        }}
      >
        <React.Suspense fallback={<LoadingFallback />}>
          {isSceneReady && (
            <>
              <CameraSetup settings={settings} />
              <SceneSetup settings={settings} />
              
              <Floor settings={settings} />
              
              <OrbitControls 
                makeDefault
                enableZoom={true}
                enablePan={false}
                autoRotate={settings.cameraEnabled && settings.cameraRotationEnabled}
                autoRotateSpeed={settings.cameraRotationSpeed}
                minDistance={3}
                maxDistance={15}
                maxPolarAngle={Math.PI * 0.65}
                dampingFactor={0.05}
                enableDamping={true}
                rotateSpeed={0.5}
                zoomSpeed={0.5}
              />
              
              <PhotosContainer photos={displayedPhotos} settings={settings} />
            </>
          )}
        </React.Suspense>
      </Canvas>
    </div>
  );
};

export default CollageScene