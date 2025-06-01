import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SpotLight, OrbitControls, Grid } from '@react-three/drei';
import { type SceneSettings } from '../../store/sceneStore';
import { type Photo } from './patterns/BasePattern';
import { PatternFactory } from './patterns/PatternFactory';
import * as THREE from 'three';

// Constants for animation and texture management
const TEXTURE_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const TEXTURE_CLEANUP_INTERVAL = 30000; // 30 seconds
const ROTATION_SMOOTHING = 0.3; // Increased from 0.1 for more responsive rotation
const POSITION_SMOOTHING = 0.25; // Increased from 0.08 for more responsive movement

// Power of 2 texture dimensions to avoid WebGL warnings
const TEXTURE_WIDTH = 512; // 2^9
const TEXTURE_HEIGHT = 512; // 2^9

// Create a shared texture loader with memory management
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = new Map<string, { texture: THREE.Texture; lastUsed: number }>();

// Cleanup unused textures periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of textureCache.entries()) {
    if (now - entry.lastUsed > TEXTURE_CACHE_MAX_AGE) {
      entry.texture.dispose();
      textureCache.delete(key);
    }
  }
}, TEXTURE_CLEANUP_INTERVAL);

// Helper function to create an empty slot texture
const createEmptySlotTexture = (color: string = '#1A1A1A'): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  
  // Fill background
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add a subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  
  // Add a "+" symbol in the center
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 6;
  const size = 40;
  ctx.beginPath();
  ctx.moveTo(canvas.width/2 - size, canvas.height/2);
  ctx.lineTo(canvas.width/2 + size, canvas.height/2);
  ctx.moveTo(canvas.width/2, canvas.height/2 - size);
  ctx.lineTo(canvas.width/2, canvas.height/2 + size);
  ctx.stroke();
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

// Helper function to create an error texture
const createErrorTexture = (): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = '#222222';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#ff4444';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Error Loading Image', canvas.width/2, canvas.height/2);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

// Enhanced loadTexture function with better error handling
const loadTexture = (url: string, emptySlotColor: string = '#1A1A1A'): THREE.Texture => {
  if (!url) {
    return createEmptySlotTexture(emptySlotColor);
  }
  
  // Add cache busting to URL to prevent stale images
  const cacheBustedUrl = `${url}?_t=${Date.now()}`;
  
  // Check texture cache
  if (textureCache.has(cacheBustedUrl)) {
    const entry = textureCache.get(cacheBustedUrl)!;
    entry.lastUsed = Date.now();
    return entry.texture;
  }
  
  // Create placeholder texture
  const placeholderTexture = createEmptySlotTexture(emptySlotColor);
  textureCache.set(cacheBustedUrl, {
    texture: placeholderTexture,
    lastUsed: Date.now()
  });
  
  // Load actual texture
  textureLoader.load(
    cacheBustedUrl,
    (loadedTexture) => {
      loadedTexture.minFilter = THREE.LinearFilter;
      loadedTexture.magFilter = THREE.LinearFilter;
      loadedTexture.generateMipmaps = false;
      
      if (textureCache.has(cacheBustedUrl)) {
        const entry = textureCache.get(cacheBustedUrl)!;
        entry.texture = loadedTexture;
        entry.lastUsed = Date.now();
      }
      
      placeholderTexture.image = loadedTexture.image;
      placeholderTexture.needsUpdate = true;
    },
    undefined,
    () => {
      const errorTexture = createErrorTexture();
      placeholderTexture.image = errorTexture.image;
      placeholderTexture.needsUpdate = true;
    }
  );
  
  return placeholderTexture;
};

type Photo3D = {
  id: string;
  url: string;
  position: [number, number, number];
  targetPosition: [number, number, number];
  rotation: [number, number, number];
  targetRotation: [number, number, number];
  isEmpty?: boolean;
};

interface CollageSceneProps {
  photos: Photo[];
  settings: SceneSettings;
}

const Spotlights: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const spotlightCount = settings.spotlightCount;
  const radius = settings.spotlightDistance;
  const height = settings.spotlightHeight;
  
  return (
    <>
      {Array.from({ length: spotlightCount }).map((_, index) => {
        const angle = (index / spotlightCount) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        return (
          <SpotLight
            key={index}
            position={[x, height, z]}
            angle={settings.spotlightAngle}
            penumbra={settings.spotlightPenumbra}
            intensity={settings.spotlightIntensity}
            color={settings.spotlightColor}
            distance={radius * 2}
            attenuation={5}
            anglePower={5}
            target-position={[0, 0, 0]}
          />
        );
      })}
    </>
  );
};

const PhotoMesh: React.FC<{
  photo: Photo3D;
  settings: SceneSettings;
}> = React.memo(({ photo, settings }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => {
    if (photo.isEmpty) {
      return createEmptySlotTexture(settings.emptySlotColor);
    }
    return loadTexture(photo.url, settings.emptySlotColor);
  }, [photo.url, photo.isEmpty, settings.emptySlotColor]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Smooth position interpolation
    meshRef.current.position.x += (photo.targetPosition[0] - meshRef.current.position.x) * POSITION_SMOOTHING;
    meshRef.current.position.y += (photo.targetPosition[1] - meshRef.current.position.y) * POSITION_SMOOTHING;
    meshRef.current.position.z += (photo.targetPosition[2] - meshRef.current.position.z) * POSITION_SMOOTHING;

    // Smooth rotation interpolation
    meshRef.current.rotation.x += (photo.targetRotation[0] - meshRef.current.rotation.x) * ROTATION_SMOOTHING;
    meshRef.current.rotation.y += (photo.targetRotation[1] - meshRef.current.rotation.y) * ROTATION_SMOOTHING;
    meshRef.current.rotation.z += (photo.targetRotation[2] - meshRef.current.rotation.z) * ROTATION_SMOOTHING;
  });

  return (
    <mesh
      ref={meshRef}
      position={photo.position}
      rotation={photo.rotation}
    >
      <planeGeometry args={[settings.photoSize, settings.photoSize * (16/9)]} />
      <meshStandardMaterial
        map={texture}
        transparent={true}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
});

const Scene: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = ({ photos, settings }) => {
  const [photos3D, setPhotos3D] = useState<Photo3D[]>([]);
  const patternRef = useRef<any>(null);
  const timeRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    patternRef.current = PatternFactory.createPattern(
      settings.animationPattern,
      settings,
      photos
    );
  }, [settings.animationPattern, settings, photos]);

  useFrame((state) => {
    if (!patternRef.current) return;

    const now = Date.now();
    const deltaTime = (now - lastUpdateRef.current) / 1000; // Convert to seconds
    lastUpdateRef.current = now;

    if (settings.animationEnabled) {
      timeRef.current += deltaTime;
    }

    const { positions, rotations } = patternRef.current.generatePositions(timeRef.current);

    // Create array with both real photos and empty slots
    const newPhotos3D: Photo3D[] = [];
    
    // Add actual photos
    photos.slice(0, settings.photoCount).forEach((photo, i) => {
      const targetPosition = positions[i] || [0, 0, 0];
      const targetRotation = rotations?.[i] || [0, 0, 0];
      
      // Find existing photo to maintain animation state
      const existingPhoto = photos3D.find(p => p.id === photo.id);
      
      newPhotos3D.push({
        ...photo,
        position: existingPhoto?.position || targetPosition,
        targetPosition,
        rotation: existingPhoto?.rotation || targetRotation,
        targetRotation,
        isEmpty: false
      });
    });
    
    // Add empty slots to fill up to photoCount
    const emptySlots = Math.max(0, settings.photoCount - photos.length);
    for (let i = 0; i < emptySlots; i++) {
      const index = photos.length + i;
      const targetPosition = positions[index] || [0, 0, 0];
      const targetRotation = rotations?.[index] || [0, 0, 0];
      
      // Find existing empty slot to maintain animation state
      const existingSlot = photos3D.find(p => p.id === `empty-${i}`);
      
      newPhotos3D.push({
        id: `empty-${i}`,
        url: '',
        position: existingSlot?.position || targetPosition,
        targetPosition,
        rotation: existingSlot?.rotation || targetRotation,
        targetRotation,
        isEmpty: true
      });
    }

    setPhotos3D(newPhotos3D);
  });

  return (
    <>
      <Spotlights settings={settings} />
      
      {/* Floor */}
      {settings.floorEnabled && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
          <planeGeometry args={[settings.floorSize, settings.floorSize]} />
          <meshStandardMaterial
            color={settings.floorColor}
            transparent
            opacity={settings.floorOpacity}
            metalness={settings.floorMetalness}
            roughness={settings.floorRoughness}
          />
        </mesh>
      )}

      {/* Grid */}
      {settings.gridEnabled && (
        <Grid
          position={[0, -1.99, 0]}
          args={[settings.gridSize, settings.gridSize]}
          cellSize={settings.gridSize / settings.gridDivisions}
          cellThickness={0.5}
          cellColor={settings.gridColor}
          sectionSize={Math.ceil(settings.gridDivisions / 10)}
          fadeDistance={30}
          fadeStrength={1}
          infiniteGrid={false}
        />
      )}

      {/* Photos */}
      {photos3D.map((photo) => (
        <PhotoMesh
          key={photo.id}
          photo={photo}
          settings={settings}
        />
      ))}

      {/* Ambient Light */}
      <ambientLight intensity={settings.ambientLightIntensity} />
    </>
  );
};

const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings }) => {
  return (
    <Canvas
      camera={{
        position: [0, settings.cameraHeight, settings.cameraDistance], 
        fov: 75,
        near: 0.1,
        far: 1000
      }}
      style={{
        background: settings.backgroundGradient
          ? `linear-gradient(${settings.backgroundGradientAngle}deg, ${settings.backgroundGradientStart}, ${settings.backgroundGradientEnd})`
          : settings.backgroundColor
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      }}
    >
      <Scene photos={photos} settings={settings} />
      <OrbitControls
        enableZoom={true}
        enablePan={true}
        autoRotate={settings.cameraEnabled && settings.cameraRotationEnabled}
        autoRotateSpeed={settings.cameraRotationSpeed}
      />
    </Canvas>
  );
};

export default CollageScene;