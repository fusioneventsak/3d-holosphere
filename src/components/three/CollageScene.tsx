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
  const xOffset = ((gridWidth - 1) * spacing) * 0.5; // Reversed from -0.5
  const yOffset = ((gridHeight - 1) * spacing) * 0.5; // Reversed from -0.5
  
  // Calculate position with random offset
  const x = xOffset - (col * spacing) + randomOffset(); // Reversed direction
  const y = yOffset - ((gridHeight - 1 - row) * spacing) + randomOffset(); // Reversed direction
  const z = -2; // Reversed from 2

  return [x, y, z];
};

// Helper to generate random rotation for photos
const randomRotation = (): [number, number, number] => {
  return [0, Math.PI, 0]; // Rotated 180 degrees around Y axis
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
      camera.position.set(0, settings.cameraHeight, -settings.cameraDistance); // Reversed Z position
      camera.updateProjectionMatrix();
    }
  }, [camera, settings.cameraHeight, settings.cameraDistance]);

  return (
    <>
      {settings.backgroundGradient ? (
        <mesh position={[0, 0, 1]}> {/* Reversed Z position */}
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
        const z = -Math.sin(angle) * settings.spotlightDistance; // Reversed Z position
        const target = new THREE.Object3D();
        target.position.set(0, 2, 0); // Reversed Y position

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
      <mesh
        rotation={[Math.PI / 2, 0, 0]} // Reversed rotation
        position={[0, 2.001, 0]} // Reversed Y position
        receiveShadow
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
      
      {settings.gridEnabled && isGridReady && (
        <Grid
          position={[0, 2, 0]} // Reversed Y position
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
      camera.position.set(0, settings.cameraHeight, -settings.cameraDistance); // Reversed Z position
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
          position: [0, settings.cameraHeight, -settings.cameraDistance] // Reversed Z position
        }}
        style={{ visibility: isSceneReady ? 'visible' : 'hidden' }}
      >
        <React.Suspense fallback={null}>
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
                autoRotateSpeed={-settings.cameraRotationSpeed} // Reversed rotation speed
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