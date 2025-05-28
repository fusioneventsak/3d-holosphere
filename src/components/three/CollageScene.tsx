import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Grid, Plane } from '@react-three/drei';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';
import { getStockPhotos } from '../../lib/stockPhotos';

type Photo = {
  id: string;
  url: string;
};

const generatePhotoList = (photos: Photo[], maxCount: number, useStockPhotos: boolean, stockPhotos: string[]): (Photo & { wall?: 'front' | 'back' })[] => {
  const result: Photo[] = [];
  const userPhotos = photos.slice(0, maxCount);
  
  if (useStockPhotos && stockPhotos.length > 0) {
    // Fill all slots with either user photos or stock photos
    for (let i = 0; i < maxCount; i++) {
      if (i < userPhotos.length) {
        result.push(userPhotos[i]);
      } else {
        // Ensure even distribution of stock photos
        const stockIndex = Math.floor(Math.random() * stockPhotos.length);
        result.push({
          id: `stock-${i}`,
          url: stockPhotos[stockIndex]
        });
      }
    }
  } else {
    // Split photos between front and back walls
    const photosPerWall = Math.ceil(maxCount / 2);
    
    // Add empty slots and photos to front wall
    for (let i = 0; i < photosPerWall; i++) {
      if (i < userPhotos.length) {
        result.push({ ...userPhotos[i], wall: 'front' });
      } else {
        result.push({
          id: `empty-front-${i}`,
          url: '',
          wall: 'front'
        });
      }
    }
    
    // Add empty slots and remaining photos to back wall
    for (let i = photosPerWall; i < maxCount; i++) {
      if (i < userPhotos.length) {
        result.push({ ...userPhotos[i], wall: 'back' });
      } else {
        result.push({
          id: `empty-back-${i - photosPerWall}`,
          url: '',
          wall: 'back'
        });
      }
    }
  }
  
  // Ensure we have exactly maxCount photos
  if (result.length > maxCount) {
    result.length = maxCount;
  }
  
  return result;
};

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

type PhotoPlaneProps = {
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  pattern: 'float' | 'wave' | 'spiral' | 'grid';
  speed: number;
  animationEnabled: boolean;
  size: number;
  settings: SceneSettings;
  photos: Photo[];
  index: number;
  wall?: 'front' | 'back';
};

// Scene setup component with camera initialization
const SceneSetup: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
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
  }, [settings]);
  
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
              power={20}
              color={settings.spotlightColor}
              angle={Math.min(settings.spotlightAngle * Math.pow(settings.spotlightWidth, 3), Math.PI)}
              decay={1.5}
              penumbra={settings.spotlightPenumbra}
              distance={300}
              target={target}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-bias={0}
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
  const startDelay = useRef<number>(Math.random() * 2 * Math.PI);
  const time = useRef<number>(0);
  const lastPattern = useRef<string>(pattern);
  const initialPosition = useRef({
    x: (Math.random() - 0.5) * settings.floorSize * 0.5,
    y: Math.random() * settings.cameraHeight * 0.5,
    z: (Math.random() - 0.5) * settings.floorSize * 0.5
  });
  const { camera, scene } = useThree();
  
  // Reset animation when pattern changes
  useEffect(() => {
    if (lastPattern.current !== pattern) {
      time.current = 0;
      startDelay.current = Math.random() * 2 * Math.PI;
      lastPattern.current = pattern;
      
      // Reset initial position for new pattern
      initialPosition.current = {
        x: (Math.random() - 0.5) * settings.floorSize * 0.5,
        y: Math.random() * settings.cameraHeight * 0.5,
        z: (Math.random() - 0.5) * settings.floorSize * 0.5
      };
    }
  }, [pattern]);
  
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
    
    const baseHeight = 4; // Minimum height above floor
    
    // Use consistent time steps for animations
    const timeStep = Math.fround(delta * speed);
    time.current = Math.fround(time.current + timeStep);
    
    const mesh = meshRef.current;
    const phase = time.current + startDelay.current;

    const totalPhotos = settings.photoCount;
    const { x: baseX, y: baseY, z: baseZ } = initialPosition.current;

    switch (pattern) {
      case 'grid': {
        // Grid case scope
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
        const horizontalSpacing = settings.photoSize * (1 + settings.photoSpacing);
        const verticalSpacing = settings.photoSize * 1.5 * (1 + settings.photoSpacing);
        
        // Calculate position in the wall grid
        const row = Math.floor(index / gridWidth);
        const col = index % gridWidth;
        
        // Center the grid
        const xOffset = ((gridWidth - 1) * horizontalSpacing) * -0.5;
        const yOffset = settings.wallHeight + ((gridHeight - 1) * verticalSpacing) * -0.5;
        
        // Set position in grid - ensure both walls are positioned above the floor
        mesh.position.set(
          Math.fround(xOffset + (col * horizontalSpacing)),
          Math.fround(baseHeight + yOffset + (row * verticalSpacing) + settings.wallHeight),
          wall === 'back' ? -2 : 2 // Position photos on front or back wall
        );
        
        // Set rotation based on wall
        mesh.rotation.set(0, wall === 'back' ? Math.PI : 0, 0);
        break;
      }

      case 'float': {
        const maxSpread = settings.floorSize * 0.4;
        const verticalRange = settings.cameraHeight * 0.4;
        const floatY = baseHeight + baseY + Math.sin(phase * 0.5) * verticalRange;
        
        // Calculate drift motion using baseX and baseZ from initialPosition
        const driftX = baseX + Math.sin(phase * 0.5) * (maxSpread * 0.2);
        const driftZ = baseZ + Math.cos(phase * 0.5) * (maxSpread * 0.2);
        
        mesh.position.set(
          driftX,
          Math.max(baseHeight, floatY),
          driftZ
        );
        
        // Look at camera but maintain vertical orientation
        mesh.lookAt(camera.position);
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
        break;
      }

      case 'wave': {
        const waveAmplitude = settings.cameraHeight * 0.3;
        const gridSize = Math.ceil(Math.sqrt(totalPhotos));
        const gridSpacing = Math.min(settings.floorSize / gridSize, settings.photoSize * 3);
        
        // Calculate grid position
        const col = index % gridSize;
        const row = Math.floor(index / gridSize);
        
        // Center the grid
        const xPos = Math.fround((col - gridSize / 2) * gridSpacing + baseX * 0.2);
        const zPos = Math.fround((row - gridSize / 2) * gridSpacing + baseZ * 0.2);
        
        // Calculate wave motion
        const distance = Math.sqrt(xPos * xPos + zPos * zPos);
        const wavePhase = phase * 0.8 + distance * 0.1;
        const waveY = baseHeight + Math.sin(wavePhase) * waveAmplitude + baseY * 0.3;
        
        // Add slight circular motion
        const circleX = Math.sin(phase * 0.2) * gridSpacing * 0.1;
        const circleZ = Math.cos(phase * 0.2) * gridSpacing * 0.1;
        
        mesh.position.set(
          xPos + circleX,
          Math.max(baseHeight, waveY),
          zPos + circleZ
        );
        
        // Look at camera but maintain vertical orientation
        mesh.lookAt(camera.position);
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
        break;
      }

      case 'spiral': {
        const maxRadius = Math.min(settings.floorSize * 0.25, totalPhotos * settings.photoSize * 0.5);
        const maxHeight = settings.cameraHeight;
        const angleStep = (Math.PI * 2) / totalPhotos;
        const heightStep = maxHeight / totalPhotos;
        
        const angle = (index * angleStep) + (phase * settings.animationSpeed);
        const height = maxHeight - (index * heightStep);
        const radius = maxRadius * (1 - (index / totalPhotos));
        
        const spiralX = Math.fround(Math.cos(angle) * radius + baseX * 0.1);
        const spiralZ = Math.fround(Math.sin(angle) * radius + baseZ * 0.1);
        
        // Add vertical oscillation
        const oscillation = Math.sin(phase * 2 + index * 0.1) * 2;
        
        mesh.position.set(
          spiralX,
          Math.max(baseHeight, height + baseHeight + oscillation),
          spiralZ
        );
        
        // Look at camera but maintain vertical orientation
        mesh.lookAt(camera.position);
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
        break;
      }
    }
  });

  if (!url) {
    return (
      <mesh ref={meshRef} position={position} rotation={rotation}>
        <planeGeometry args={[size, size * 1.5]} />
        <meshStandardMaterial 
          color={new THREE.Color(settings.emptySlotColor)}
          metalness={0.2}
          roughness={0.8}
          side={THREE.DoubleSide}
          transparent={false}
          opacity={1}
          depthWrite={true}
          castShadow
          receiveShadow
          renderOrder={1}
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
        transparent={false}
        opacity={1}
        toneMapped={true}
        depthWrite={false}
        depthTest={true}
        metalness={0.1}
        roughness={0.9}
        castShadow
        receiveShadow
        renderOrder={2}
      />
    </mesh>
  );
};

// Photos container component
const PhotosContainer: React.FC<{ photos: Photo[], settings: SceneSettings }> = ({ photos, settings }) => {
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
      
      // Position photos on front or back wall
      const z = photo.wall === 'back' ? -2 : 2;
      
      const position: [number, number, number] = [x, y, z];
      const rotation: [number, number, number] = [0, photo.wall === 'back' ? Math.PI : 0, 0];
      
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
        wall: photo.wall
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
const Floor: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
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
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -2, 0]} 
        receiveShadow={true}
        renderOrder={0}
      >
        <planeGeometry args={[settings.floorSize, settings.floorSize]} />
        <meshStandardMaterial
          color={new THREE.Color(settings.floorColor)}
          transparent
          envMapIntensity={1.0}
          opacity={settings.floorOpacity}
          metalness={settings.floorMetalness}
          roughness={settings.floorRoughness}
          side={THREE.DoubleSide}
          depthWrite={true}
          reflectivity={0.5}
          polygonOffset={true}
          polygonOffsetFactor={-1}
          receiveShadow
        />
      </mesh>
      
      {settings.gridEnabled && isGridReady && (
        <Grid
          position={[0, -1.999, 0]}
          args={[settings.floorSize, settings.floorSize, settings.gridDivisions, settings.gridDivisions]}
          cellSize={1}
          cellThickness={0.6}
          cellColor={settings.gridColor}
          sectionSize={Math.ceil(settings.gridDivisions / 10)}
          fadeDistance={30}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid={false}
          renderOrder={1}
          material-opacity={settings.gridOpacity}
          material-transparent={true}
          material-depthWrite={false}
        />
      )}
    </group>
  );
};

// Camera setup component
const CameraSetup: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
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
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>) => void;
};

// Main scene component
const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
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
                enableDamping={true}
                dampingFactor={0.05}
                rotateSpeed={0.8}
                zoomSpeed={0.8}
                screenSpacePanning={true}
                target={[0, Math.max(2, settings.wallHeight / 2), 0]}
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