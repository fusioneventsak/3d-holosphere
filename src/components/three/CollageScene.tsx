import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SpotLight, OrbitControls, Grid } from '@react-three/drei';
import { type SceneSettings } from '../../store/sceneStore';
import { type Photo } from './patterns/BasePattern';
import { PatternFactory } from './patterns/PatternFactory';
import * as THREE from 'three';

// Create a shared texture loader with memory management
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = new Map<string, { texture: THREE.Texture; lastUsed: number }>();

// Constants
const TEXTURE_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const TEXTURE_CLEANUP_INTERVAL = 30000; // 30 seconds

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
  canvas.width = 256;
  canvas.height = 456;
  const ctx = canvas.getContext('2d')!;
  
  // Fill background
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add a subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  
  // Add a "+" symbol in the center
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 3;
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
  canvas.width = 256;
  canvas.height = 456;
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
  rotation?: [number, number, number];
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
  const texture = useMemo(() => {
    if (photo.isEmpty) {
      return createEmptySlotTexture(settings.emptySlotColor);
    }
    return loadTexture(photo.url, settings.emptySlotColor);
  }, [photo.url, photo.isEmpty, settings.emptySlotColor]);

  return (
    <mesh
      position={photo.position}
      rotation={photo.rotation || [0, 0, 0]}
    >
      <planeGeometry args={[settings.photoSize, settings.photoSize * (16/9)]} />
      <meshStandardMaterial
        map={texture}
        transparent
        opacity={photo.isEmpty ? 0.3 : 1}
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

  useEffect(() => {
    patternRef.current = PatternFactory.createPattern(
      settings.animationPattern,
      settings,
      photos
    );
  }, [settings.animationPattern, settings, photos]);

  useFrame((state) => {
    if (!patternRef.current) return;

    if (settings.animationEnabled) {
      timeRef.current += state.clock.getDelta() * (settings.animationSpeed / 50);
    }

    const { positions, rotations } = patternRef.current.generatePositions(timeRef.current);

    // Create array with both real photos and empty slots
    const newPhotos3D: Photo3D[] = [];
    
    // Add actual photos
    photos.slice(0, settings.photoCount).forEach((photo, i) => {
      newPhotos3D.push({
        ...photo,
        position: positions[i] || [0, 0, 0],
        rotation: rotations?.[i] || [0, 0, 0],
        isEmpty: false
      });
    });
    
    // Add empty slots to fill up to photoCount
    const emptySlots = Math.max(0, settings.photoCount - photos.length);
    for (let i = 0; i < emptySlots; i++) {
      const index = photos.length + i;
      newPhotos3D.push({
        id: `empty-${i}`,
        url: '',
        position: positions[index] || [0, 0, 0],
        rotation: rotations?.[index] || [0, 0, 0],
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
        fov: 75
      }}
      style={{
        background: settings.backgroundGradient
          ? `linear-gradient(${settings.backgroundGradientAngle}deg, ${settings.backgroundGradientStart}, ${settings.backgroundGradientEnd})`
          : settings.backgroundColor
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