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

// Helper function to generate random rotation
const randomRotation = (): [number, number, number] => {
  return [0, 0, 0]; // Keep photos straight
};

// Helper function to generate photo list
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

// PhotoPlane component
const PhotoPlane: React.FC<PhotoPlaneProps> = ({ 
  url, 
  position, 
  rotation, 
  pattern, 
  speed, 
  animationEnabled, 
  size,
  settings,
  photos,
  index
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const initialPosition = useRef<[number, number, number]>(position);
  const startDelay = useRef<number>(Math.random() * 5);
  const gridPosition = useRef<[number, number]>([
    Math.floor(index % Math.sqrt(photos.length)),
    Math.floor(index / Math.sqrt(photos.length))
  ]);
  const orbitRadius = useRef<number>(Math.random() * 3 + 5);
  const randomOffset = useRef<[number, number, number]>([
    (Math.random() - 0.5) * 2,
    Math.random() * 0.5,
    (Math.random() - 0.5) * 2
  ]);
  const elapsedTime = useRef<number>(0);
  const time = useRef<number>(0);
  const heightOffset = useRef<number>(Math.random() * 5);
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
    
    const timeStep = Math.fround(delta * speed);
    elapsedTime.current = Math.fround(elapsedTime.current + timeStep);
    time.current = Math.fround(time.current + timeStep);
    
    if (elapsedTime.current < startDelay.current) return;
    
    const mesh = meshRef.current;
    const updatePosition = (x: number, y: number, z: number) => {
      mesh.position.set(
        Math.fround(x),
        Math.fround(y),
        Math.fround(z)
      );
    };

    const spacing = settings.photoSize * (1 + settings.photoSpacing);
    const totalPhotos = photos?.length || 1;
    const aspectRatio = window.innerWidth / window.innerHeight;
    const gridWidth = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
    const gridHeight = Math.ceil(totalPhotos / gridWidth);
    
    switch (pattern) {
      case 'grid': {
        const gridIndex = index;
        const row = Math.floor(gridIndex / gridWidth);
        const col = gridIndex % gridWidth;
        
        const xOffset = ((gridWidth - 1) * spacing) * -0.5;
        const yOffset = ((gridHeight - 1) * spacing) * -0.5;
        
        updatePosition(
          xOffset + (col * spacing),
          yOffset + ((gridHeight - 1 - row) * spacing),
          2
        );
        
        mesh.rotation.set(0, 0, 0);
        break;
      }
      
      case 'float': {
        const gridX = (gridPosition.current[0] - Math.sqrt(photos.length) / 2) * spacing;
        const gridZ = (gridPosition.current[1] - Math.sqrt(photos.length) / 2) * spacing;
        
        const offsetX = randomOffset.current[0] * spacing;
        const offsetZ = randomOffset.current[2] * spacing;
        
        const floatHeight = 15;
        const floatY = Math.max(0, 
          -2 + (Math.sin(time.current * speed + startDelay.current) * 0.5 + 0.5) * floatHeight
        );
        
        updatePosition(
          gridX + offsetX,
          floatY,
          gridZ + offsetZ
        );
        
        mesh.lookAt(camera.position);
        break;
      }
      
      case 'wave': {
        const gridSize = Math.ceil(Math.sqrt(totalPhotos));
        const waveCol = index % gridSize;
        
        const xOffset = ((gridSize - 1) * spacing) * -0.5;
        const zOffset = ((gridSize - 1) * spacing) * -0.5;
        
        const baseX = xOffset + (waveCol * spacing);
        const row = Math.floor(index / gridSize);
        const baseZ = zOffset + (row * spacing);
        
        const baseY = 2;
        const waveAmplitude = 1.5;
        const waveFrequency = 1;
        
        const phaseOffset = (waveCol + row) * Math.PI / 2;
        
        const waveY = baseY + (
          Math.sin(time.current * speed * waveFrequency + phaseOffset) * waveAmplitude
        );
        
        updatePosition(
          baseX,
          waveY,
          baseZ
        );
        
        mesh.lookAt(camera.position);
        break;
      }
      
      case 'spiral': {
        const maxHeight = 15;
        const spiralRadius = Math.sqrt(photos.length);
        const verticalSpeed = speed * 0.5;
        const rotationSpeed = speed * 2;
        
        const t = ((time.current * verticalSpeed + (index / photos.length)) % 1) * Math.PI * 2;
        const spiralAngle = t + time.current * rotationSpeed;
        
        const progress = t / (Math.PI * 2);
        const currentRadius = spiralRadius * (1 - progress);
        const spiralX = Math.cos(spiralAngle) * currentRadius * 2;
        const spiralY = maxHeight * (1 - progress);
        const spiralZ = Math.sin(spiralAngle) * currentRadius * 2;
        
        updatePosition(
          spiralX,
          Math.max(2, spiralY),
          spiralZ
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

// PhotosContainer component
const PhotosContainer: React.FC<{ photos: Photo[], settings: any }> = ({ photos, settings }) => {
  const photoProps = useMemo(() => {
    const totalPhotos = photos.length;
    const photosPerWall = Math.ceil(totalPhotos / 2);
    const aspectRatio = window.innerWidth / window.innerHeight;
    const gridWidth = Math.ceil(Math.sqrt(photosPerWall * aspectRatio));
    const gridHeight = Math.ceil(photosPerWall / gridWidth);
    
    const frontProps = photos.slice(0, photosPerWall).map((photo, index) => {
      const isUserPhoto = !photo.id.startsWith('stock-') && !photo.id.startsWith('empty-');
      const col = index % gridWidth;
      const row = Math.floor(index / gridWidth);
      const spacing = settings.photoSize * (1 + settings.photoSpacing);
      const gridXOffset = ((gridWidth - 1) * spacing) * -0.5;
      const gridYOffset = ((gridHeight - 1) * spacing) * -0.5;
      const x = gridXOffset + (col * spacing) + (Math.random() - 0.5) * 0.2;
      const y = Math.max(0, gridYOffset + ((gridHeight - 1 - row) * spacing) + (Math.random() - 0.5) * 0.2);
      
      return {
        key: photo.id,
        url: photo.url,
        position: [x, y + 2, 2] as [number, number, number],
        rotation: randomRotation(),
        pattern: settings.animationPattern,
        speed: settings.animationSpeed,
        animationEnabled: settings.animationEnabled,
        settings: settings,
        size: settings.photoSize,
        photos: photos,
        index: index,
        wall: 'front' as const
      };
    });
    
    const backProps = photos.slice(photosPerWall).map((photo, index) => {
      const isUserPhoto = !photo.id.startsWith('stock-') && !photo.id.startsWith('empty-');
      const col = index % gridWidth;
      const row = Math.floor(index / gridWidth);
      const spacing = settings.photoSize * (1 + settings.photoSpacing);
      const backGridXOffset = ((gridWidth - 1) * spacing) * -0.5;
      const backGridYOffset = ((gridHeight - 1) * spacing) * -0.5;
      const x = backGridXOffset + (col * spacing) + (Math.random() - 0.5) * 0.2;
      const y = Math.max(0, backGridYOffset + ((gridHeight - 1 - row) * spacing) + (Math.random() - 0.5) * 0.2);
      
      return {
        key: `back-${photo.id}`,
        url: photo.url,
        position: [x, y + 2, -2] as [number, number, number],
        rotation: [0, Math.PI, 0] as [number, number, number],
        pattern: settings.animationPattern,
        speed: settings.animationSpeed,
        animationEnabled: settings.animationEnabled,
        settings: settings,
        size: settings.photoSize,
        photos: photos,
        index: index,
        wall: 'back' as const
      };
    });
    
    return [...frontProps, ...backProps];
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
    if (scene) {
      const timeout = setTimeout(() => setIsGridReady(true), 100);
      return () => clearTimeout(timeout);
    }
  }, [scene]);

  if (!settings.floorEnabled) return null;

  return (
    <>
      {/* First render the floor with a lower renderOrder */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -2.01, 0]}
        receiveShadow
        renderOrder={0}
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
          depthWrite={true}
        />
      </mesh>
      
      {/* Then render the grid with a higher position and renderOrder */}
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
          renderOrder={1}
        />
      )}
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

// Scene setup component
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