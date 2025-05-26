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
  const startDelay = useRef<number>(Math.fround(Math.random() * 10)); // Use fround for consistent float precision
  const orbitRadius = useRef<number>(Math.fround(Math.random() * 8 + 4));
  const orbitSpeed = useRef<number>(Math.fround(Math.random() * 0.5 + 0.5));
  const heightOffset = useRef<number>(Math.fround(Math.random() * 15));
  const spiralTightness = useRef<number>(Math.fround(Math.random() * 0.3 + 0.7));
  const elapsedTime = useRef<number>(0);
  const time = useRef<number>(0);
  const randomOffset = useRef(Math.random() * Math.PI * 2);
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
    
    switch (pattern) {
      case 'grid':
        // Calculate grid dimensions
        const totalPhotos = photos?.length || 1;
        const aspectRatio = window.innerWidth / window.innerHeight;
        const gridWidth = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
        const gridHeight = Math.ceil(totalPhotos / gridWidth);
        
        // Calculate position in the wall grid
        const gridIndex = index;
        const row = Math.floor(gridIndex / gridWidth);
        const col = gridIndex % gridWidth;
        
        // Center the grid
        const xOffset = ((gridWidth - 1) * settings.photoSpacing) * -0.5;
        const yOffset = ((gridHeight - 1) * settings.photoSpacing) * -0.5;
        
        // Set position in grid
        updatePosition(
          Math.fround(xOffset + (col * settings.photoSpacing)),
          Math.fround(yOffset + ((gridHeight - 1 - row) * settings.photoSpacing)),
          0 // All photos on the same Z plane
        );
        
        // Keep photos facing forward
        mesh.rotation.set(0, 0, 0);
        break;
        
      case 'float':
        // Calculate total animation duration (time to float from bottom to top)
        const animationDuration = Math.fround(12 / speed);
        
        // Calculate current position in animation cycle
        const cycleTime = Math.fround((elapsedTime.current - startDelay.current) % animationDuration);
        const progress = Math.fround(cycleTime / animationDuration);
        
        // Move from -2 to 10 (12 units total height)
        updatePosition(
          mesh.position.x,
          Math.fround(-2 + (progress * 12)),
          mesh.position.z
        );
        
        // Always face the camera
        mesh.lookAt(camera.position);
        break;
        
      case 'wave':
        // Wave motion with consistent precision
        const baseHeight = Math.fround(1.5);
        const amplitude = Math.fround(0.75);
        const frequency = Math.fround(0.5);
        
        // Single wave calculation with position-based offset
        const positionOffset = Math.fround((initialPosition.current[0] + initialPosition.current[2]) * 0.2);
        const waveAngle = Math.fround(time.current * frequency + positionOffset + randomOffset.current);
        const wave = Math.fround(Math.sin(waveAngle));
        
        // Apply smooth wave motion with clamped height
        updatePosition(
          initialPosition.current[0],
          Math.fround(Math.max(0.5, baseHeight + (wave * amplitude))),
          initialPosition.current[2]
        );
        
        // Always face camera
        mesh.lookAt(camera.position);
        break;
        
      case 'spiral':
        // Funnel spiral parameters
        const maxHeight = Math.fround(15);
        const minRadius = Math.fround(2);
        const maxRadius = Math.fround(8);
        const verticalSpeed = Math.fround(speed * 0.5);
        
        // Calculate funnel spiral angle
        const spiralAngle = Math.fround(time.current * speed * 2 + randomOffset.current);
        
        // Update position over time and calculate progress
        const t = Math.fround((time.current * verticalSpeed + heightOffset.current) % maxHeight);
        const heightProgress = Math.fround(t / maxHeight);
        const radius = Math.fround(maxRadius - (heightProgress * (maxRadius - minRadius)));
        
        // Set position in spiral pattern
        updatePosition(
          Math.fround(Math.cos(spiralAngle) * radius),
          t,
          Math.fround(Math.sin(spiralAngle) * radius)
        );
        
        // Reset when reaching the top
        if (mesh.position.y >= maxHeight - 0.1) {
          time.current = -heightOffset.current / verticalSpeed;
        }
        
        // Make photos face outward from the center of the funnel
        const center = new THREE.Vector3(0, t, 0);
        const direction = mesh.position.clone().sub(center);
        mesh.lookAt(mesh.position.clone().add(direction));
        mesh.rotation.z = 0;
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
        side={THREE.FrontSide}
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
    return photos.map((photo, index) => {
      const isUserPhoto = !photo.id.startsWith('stock-') && !photo.id.startsWith('empty-');
      const props = {
        key: photo.id,
        url: photo.url,
        position: randomPosition(index, photos.length, settings, isUserPhoto),
        rotation: randomRotation(),
        pattern: settings.animationPattern,
        speed: settings.animationSpeed,
        animationEnabled: settings.animationEnabled,
        settings: settings,
        size: settings.photoSize,
        photos: photos,
        index: index
      };
      
      return props;
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
          far: 1000,
          position: [0, settings.cameraHeight, settings.cameraDistance]
        }}
        style={{ transition: 'all 0.3s ease-out' }}
      >
        <React.Suspense fallback={<LoadingFallback />}>
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
        </React.Suspense>
      </Canvas>
    </div>
  );
};

export default CollageScene;