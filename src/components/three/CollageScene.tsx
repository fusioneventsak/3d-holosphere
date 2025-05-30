import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, SpotLight } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';

// Create a shared texture loader with memory management
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = new Map<string, { texture: THREE.Texture; lastUsed: number }>();

// Cleanup unused textures periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  for (const [key, entry] of textureCache.entries()) {
    if (now - entry.lastUsed > maxAge) {
      entry.texture.dispose();
      textureCache.delete(key);
    }
  }
}, 30000); // Check every 30 seconds

type Photo = {
  id: string;
  url: string;
  collage_id?: string;
};

// Helper function to create an empty slot texture
const createEmptySlotTexture = (color: string = '#1A1A1A'): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 456; // Using 9:16 aspect ratio
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
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
  
  // Check texture cache
  if (textureCache.has(url)) {
    const entry = textureCache.get(url)!;
    entry.lastUsed = Date.now();
    return entry.texture;
  }
  
  // Create placeholder texture
  const placeholderTexture = createEmptySlotTexture(emptySlotColor);
  textureCache.set(url, {
    texture: placeholderTexture,
    lastUsed: Date.now()
  });
  
  // Load actual texture
  textureLoader.load(
    url,
    (loadedTexture) => {
      loadedTexture.minFilter = THREE.LinearFilter;
      loadedTexture.magFilter = THREE.LinearFilter;
      loadedTexture.generateMipmaps = false;
      
      if (textureCache.has(url)) {
        const entry = textureCache.get(url)!;
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

interface PhotoFrameProps {
  position: [number, number, number],
  rotation?: [number, number, number],
  url?: string,
  scale: number,
  emptySlotColor: string
}

// Photo frame component with 9:16 aspect ratio
const PhotoFrame = React.memo(({
  position,
  rotation,
  url,
  scale = 1,
  emptySlotColor
}: PhotoFrameProps & { emptySlotColor: string }) => {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const { position: springPosition } = useSpring({
    position,
    config: { mass: 1, tension: 170, friction: 26 }
  });
  const texture = useMemo(() => loadTexture(url, emptySlotColor), [url, emptySlotColor]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.map = texture;
      materialRef.current.needsUpdate = true;
    }
  }, [texture]);

  // Use 9:16 aspect ratio for the photo frame
  const width = scale;
  const height = scale * (16/9);

  return (
    <animated.mesh position={springPosition} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <primitive object={useMemo(() => new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      }), [])} ref={materialRef} />
    </animated.mesh>
  );
}, (prev, next) => {
  return prev.url === next.url && 
         prev.scale === next.scale && 
         prev.emptySlotColor === next.emptySlotColor &&
         prev.position[0] === next.position[0] &&
         prev.position[1] === next.position[1] &&
         prev.position[2] === next.position[2];
});

// Generate positions for different animation patterns
const generatePhotoPositions = (settings: SceneSettings): [number, number, number][] => {
  const positions: [number, number, number][] = [];
  const totalPhotos = Math.min(settings.photoCount, 500);
  const baseSpacing = settings.photoSize * (1 + settings.photoSpacing); 
  const baseHeight = -settings.floorSize * 0.25; // Base height for animations

  switch (settings.animationPattern) {
    case 'grid': {
      const patternSettings = settings.patterns.grid;
      const spacing = baseSpacing * (1 + patternSettings.spacing);
      const aspectRatio = patternSettings.aspectRatio;
      const columns = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
      const rows = Math.ceil(totalPhotos / columns);
      
      for (let i = 0; i < totalPhotos; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = (col - columns / 2) * spacing;
        const y = settings.wallHeight + (rows / 2 - row) * spacing * (16/9);
        const z = 0;
        positions.push([x, y, z]);
      }
      break;
    }
    
    case 'spiral': {
      const patternSettings = settings.patterns.spiral;
      const spacing = baseSpacing * (1 + patternSettings.spacing);
      const radius = patternSettings.radius;
      const heightStep = patternSettings.heightStep;
      const angleStep = (Math.PI * 2) / Math.max(1, totalPhotos / 3);
      
      for (let i = 0; i < totalPhotos; i++) {
        const angle = i * angleStep;
        const spiralRadius = radius * (1 - i / totalPhotos);
        const x = Math.cos(angle) * spiralRadius;
        const y = settings.wallHeight + (i * heightStep);
        const z = Math.sin(angle) * spiralRadius;
        positions.push([x, y, z]);
      }
      break;
    }
    
    case 'float': {
      const patternSettings = settings.patterns.float;
      const maxRadius = settings.floorSize * 0.4; // 80% of floor size for better visibility
      
      for (let i = 0; i < totalPhotos; i++) {
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        const angle = i * goldenRatio * Math.PI * 2;
        const r = maxRadius * Math.sqrt(i / totalPhotos);
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = baseHeight + Math.random() * settings.floorSize * 0.5; // Random height variation
        positions.push([x, y, z]);
      }
      break;
    }
    
    case 'wave': {
      const patternSettings = settings.patterns.wave;
      const spacing = baseSpacing * (1 + patternSettings.spacing);
      const columns = Math.ceil(Math.sqrt(totalPhotos));
      const rows = Math.ceil(totalPhotos / columns);
      const frequency = 0.1; // Wave frequency
      const amplitude = settings.floorSize * 0.1; // Wave amplitude
      
      for (let i = 0; i < totalPhotos; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = (col - columns / 2) * spacing;
        const z = (row - rows / 2) * spacing;
        const angle = (x + z) * frequency;
        const y = settings.wallHeight + Math.sin(angle) * amplitude;
        positions.push([x, y, z]);
      }
      break;
    }
  }

  return positions;
};

// Photo wall component
const PhotoWall: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = React.memo(({ photos, settings }) => {
  const positions = React.useMemo(() => {
    const basePositions = generatePhotoPositions(settings);
    return basePositions.slice(0, settings.photoCount);
  }, [
    settings.photoCount,
    settings.photoSize,
    settings.photoSpacing,
    settings.animationPattern,
    settings.patterns,
    settings.wallHeight,
    settings.floorSize,
    settings.animationSpeed,
    settings.animationEnabled
  ]);
  
  return (
    <group>
      {positions.slice(0, settings.photoCount).map((position, index) => {
        const photo = index < photos.length ? photos[index] : null;
        return (
          <PhotoFrame
            key={`photo-${index}`}
            position={position}
            url={photo?.url || ''}
            scale={settings.photoSize}
            emptySlotColor={settings.emptySlotColor}
          />
        );
      })}
    </group>
  );
});

// Create background color CSS based on settings
const getBackgroundStyle = (settings: SceneSettings): string => {
  if (settings.backgroundGradient) {
    return `linear-gradient(${settings.backgroundGradientAngle}deg, ${settings.backgroundGradientStart}, ${settings.backgroundGradientEnd})`;
  }
  return settings.backgroundColor;
};

// Floor component with grid
const Floor: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  if (!settings.floorEnabled) return null;

  return (
    <group position={[0, -2, 0]}>
      {/* Floor material */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[settings.floorSize, settings.floorSize]} />
        <meshStandardMaterial
          color={settings.floorColor}
          transparent
          opacity={settings.floorOpacity}
          metalness={settings.floorMetalness}
          roughness={settings.floorRoughness}
        />
      </mesh>
      
      {/* Grid overlay - positioned slightly above the floor */}
      {settings.gridEnabled && (
        <Grid
          position={[0, 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          args={[settings.floorSize, settings.floorSize]}
          cellSize={1}
          cellThickness={0.5}
          cellColor={settings.gridColor}
          sectionSize={Math.ceil(settings.gridDivisions / 10)}
          fadeDistance={30}
          fadeStrength={1}
          infiniteGrid={false}
        />
      )}
    </group>
  );
};

// Spotlights component
const Spotlights: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const spotlightCount = settings.spotlightCount;
  const radius = settings.spotlightDistance;
  
  return (
    <>
      {Array.from({ length: spotlightCount }).map((_, index) => {
        const angle = (index / spotlightCount) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        return (
          <SpotLight
            key={index}
            position={[x, settings.spotlightHeight, z]}
            angle={settings.spotlightAngle}
            penumbra={settings.spotlightPenumbra}
            intensity={settings.spotlightIntensity}
            color={settings.spotlightColor}
            distance={radius * 2}
            attenuation={5}
            anglePower={5}
            lookAt={[0, 0, 0]}
          />
        );
      })}
    </>
  );
};

// Scene components that use R3F hooks
const Scene: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = ({ photos, settings }) => {
  const { camera, clock } = useThree();
  const time = useRef(0);

  useFrame(() => {
    if (settings.animationEnabled) {
      time.current = clock.getElapsedTime() * settings.animationSpeed;
      // Update animation state here if needed
    }
  });

  useEffect(() => {
    if (camera) {
      camera.position.set(0, settings.cameraHeight, settings.cameraDistance);
      camera.updateProjectionMatrix();
    }
  }, [camera, settings.cameraHeight, settings.cameraDistance]);

  return (
    <>
      <animated.ambientLight intensity={settings.ambientLightIntensity} />
      <Spotlights settings={settings} />
      <PhotoWall photos={photos} settings={settings} />
      <Floor settings={settings} />
    </>
  );
};

// Main CollageScene component that provides the Canvas
const CollageScene: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
}> = ({ photos, settings, onSettingsChange }) => {
  return (
    <div className="w-full h-full">
      <Canvas
        style={{ background: getBackgroundStyle(settings) }}
        camera={{
          fov: 60,
          near: 0.1,
          far: 2000,
          position: [0, settings.cameraHeight, settings.cameraDistance]
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
    </div>
  );
};

export default CollageScene;