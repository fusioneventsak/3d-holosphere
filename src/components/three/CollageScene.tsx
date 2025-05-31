import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, SpotLight } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = new Map<string, { texture: THREE.Texture; lastUsed: number }>();

const FLOAT_MAX_HEIGHT = 50;
const TEXTURE_CACHE_MAX_AGE = 5 * 60 * 1000;
const TEXTURE_CLEANUP_INTERVAL = 30000;
const FLOAT_MIN_HEIGHT = -20;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of textureCache.entries()) {
    if (now - entry.lastUsed > TEXTURE_CACHE_MAX_AGE) {
      entry.texture.dispose();
      textureCache.delete(key);
    }
  }
}, TEXTURE_CLEANUP_INTERVAL);

type Photo = {
  id: string;
  url: string;
  collage_id?: string;
};

const createEmptySlotTexture = (color: string = '#1A1A1A'): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 456;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

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

const loadTexture = (url: string, emptySlotColor: string = '#1A1A1A'): THREE.Texture => {
  if (!url) {
    return createEmptySlotTexture(emptySlotColor);
  }
  
  const cacheBustedUrl = `${url}?_t=${Date.now()}`;
  
  if (textureCache.has(cacheBustedUrl)) {
    const entry = textureCache.get(cacheBustedUrl)!;
    entry.lastUsed = Date.now();
    return entry.texture;
  }
  
  const placeholderTexture = createEmptySlotTexture(emptySlotColor);
  textureCache.set(cacheBustedUrl, {
    texture: placeholderTexture,
    lastUsed: Date.now()
  });
  
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

interface PhotoFrameProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  url?: string;
  scale: number;
  emptySlotColor: string;
  settings: SceneSettings;
}

const PhotoFrame = React.memo(({
  position,
  rotation,
  url,
  scale,
  emptySlotColor,
  settings
}: PhotoFrameProps) => {
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => loadTexture(url, emptySlotColor), [url, emptySlotColor]);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const targetQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const meshPosition = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(() => {
    if (meshRef.current && settings.photoRotation) {
      const mesh = meshRef.current;
      
      mesh.getWorldPosition(meshPosition);
      direction.subVectors(camera.position, meshPosition).normalize();
      
      const matrix = new THREE.Matrix4();
      matrix.lookAt(meshPosition, camera.position, up);
      targetQuaternion.setFromRotationMatrix(matrix);
      
      quaternion.slerpQuaternions(mesh.quaternion, targetQuaternion, 0.1);
      mesh.quaternion.copy(quaternion);
    }
  });

  const width = scale;
  const height = scale * (16/9);
  
  const dynamicScale = settings.animationPattern === 'float' 
    ? Math.min(1, settings.floorSize / (Math.sqrt(settings.photoCount) * 20))
    : 1;
  
  const springs = useSpring({
    position,
    config: { 
      mass: 1,
      tension: 280,
      friction: 60,
      precision: 0.001
    }
  });

  return (
    <animated.mesh 
      ref={meshRef}
      position={springs.position}
      rotation={!settings.photoRotation ? (rotation || [0, 0, 0]) : undefined}
    >
      <planeGeometry args={[width * dynamicScale, height * dynamicScale]} />
      <meshStandardMaterial
        map={texture}
        transparent
        side={THREE.DoubleSide}
      />
    </animated.mesh>
  );
}, (prev, next) => {
  return prev.url === next.url && 
         prev.scale === next.scale && 
         prev.emptySlotColor === next.emptySlotColor &&
         prev.position[0] === next.position[0] &&
         prev.position[1] === next.position[1] &&
         prev.position[2] === next.position[2] &&
         prev.settings.photoRotation === next.settings.photoRotation &&
         prev.settings.animationPattern === next.settings.animationPattern &&
         prev.settings.floorSize === next.settings.floorSize &&
         prev.settings.photoCount === next.settings.photoCount;
});

const PhotoWall: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = React.memo(({ photos, settings }) => {
  const [positions, setPositions] = useState<[number, number, number][]>([]);
  const timeRef = useRef(0);

  const floatParams = useMemo(() => {
    if (settings.animationPattern !== 'float') return [];
    
    const floorSize = settings.floorSize * 0.8;
    
    return Array(settings.photoCount).fill(0).map(() => ({
      x: (Math.random() - 0.5) * floorSize,
      z: (Math.random() - 0.5) * floorSize,
      startY: FLOAT_MIN_HEIGHT + Math.random() * Math.abs(FLOAT_MIN_HEIGHT),
      speed: 0.8 + Math.random() * 0.4
    }));
    
  }, [settings.animationPattern, settings.photoCount, settings.floorSize]);

  const generatePositions = useCallback((
    currentSettings: SceneSettings,
    currentFloatParams: typeof floatParams,
    currentTime: number
  ): [number, number, number][] => {
    const positions: [number, number, number][] = [];
    const totalPhotos = Math.min(currentSettings.photoCount, 500);
    const spacing = currentSettings.photoSize * (1 + currentSettings.photoSpacing);

    switch (currentSettings.animationPattern) {
      case 'grid': {
        const patternSettings = currentSettings.patterns.grid;
        const aspectRatio = patternSettings.aspectRatio;
        const columns = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
        const rows = Math.ceil(totalPhotos / columns);
        
        for (let i = 0; i < totalPhotos; i++) {
          const col = i % columns;
          const row = Math.floor(i / columns);
          const x = (col - columns / 2) * spacing;
          let y = currentSettings.wallHeight + (rows / 2 - row) * spacing * (16/9);
          
          if (currentSettings.animationEnabled) {
            const waveX = Math.sin(currentTime + col * 0.5) * 0.2;
            const waveY = Math.cos(currentTime + row * 0.5) * 0.2;
            y += waveX + waveY;
          }
          
          const z = 0;
          positions.push([x, y, z]);
        }
        break;
      }
      
      case 'spiral': {
        const patternSettings = currentSettings.patterns.spiral;
        const radius = patternSettings.radius;
        const heightStep = patternSettings.heightStep;
        const angleStep = (Math.PI * 2) / Math.max(1, totalPhotos / 3);
        
        for (let i = 0; i < totalPhotos; i++) {
          const angle = currentSettings.animationEnabled ? 
            i * angleStep + currentTime : 
            i * angleStep;
          const spiralRadius = radius * (1 - i / totalPhotos);
          const x = Math.cos(angle) * spiralRadius;
          const y = currentSettings.wallHeight + (i * heightStep);
          const z = Math.sin(angle) * spiralRadius;
          positions.push([x, y, z]);
        }
        break;
      }
      
      case 'float': {
        const floorSize = currentSettings.floorSize * 0.8;
        const baseSpeed = currentSettings.animationSpeed * 20;
        
        for (let i = 0; i < totalPhotos; i++) {
          const param = currentFloatParams[i];
          let x = param.x;
          let z = param.z;
          
          const speed = param.speed * baseSpeed;
          const time = currentTime * speed;
          
          // Calculate vertical position with continuous movement
          let y = param.startY + time;
          
          // Reset position when reaching max height
          if (y > FLOAT_MAX_HEIGHT) {
            param.startY = FLOAT_MIN_HEIGHT;
            param.x = (Math.random() - 0.5) * floorSize;
            param.z = (Math.random() - 0.5) * floorSize;
            y = FLOAT_MIN_HEIGHT;
            x = param.x;
            z = param.z;
          }
          
          // Add slight horizontal movement
          x += Math.sin(currentTime * 0.5 + param.startY) * 2;
          z += Math.cos(currentTime * 0.5 + param.startY) * 2;
          
          positions.push([x, y, z]);
        }
        break;
      }
      
      case 'wave': {
        const patternSettings = currentSettings.patterns.wave;
        const columns = Math.ceil(Math.sqrt(totalPhotos));
        const rows = Math.ceil(totalPhotos / columns);
        const frequency = patternSettings.frequency;
        const amplitude = patternSettings.amplitude;
        
        for (let i = 0; i < totalPhotos; i++) {
          const col = i % columns;
          const row = Math.floor(i / columns);
          const x = (col - columns / 2) * spacing;
          const z = (row - rows / 2) * spacing;
          let y = currentSettings.wallHeight;
          
          if (currentSettings.animationEnabled) {
            const wavePhase = currentTime * patternSettings.animationSpeed;
            const distanceFromCenter = Math.sqrt(x * x + z * z);
            y += Math.sin(distanceFromCenter * frequency - wavePhase) * amplitude;
          }
          
          positions.push([x, y, z]);
        }
        break;
      }
    }

    return positions;
  }, []);

  useEffect(() => {
    setPositions(generatePositions(settings, floatParams, 0));
  }, [settings.photoCount, settings.photoSize, settings.photoSpacing, settings.gridAspectRatio, settings.animationPattern, generatePositions, floatParams]);

  useFrame((state) => {
    if (settings.animationEnabled) {
      timeRef.current += state.clock.getDelta();
      setPositions(generatePositions(settings, floatParams, timeRef.current));
    }
  });
  
  return (
    <group>
      {positions.slice(0, settings.photoCount).map((position, index) => (
        <PhotoFrame
          key={`photo-${index}-${photos[index]?.id || 'empty'}`}
          position={position}
          url={photos[index]?.url}
          emptySlotColor={settings.emptySlotColor}
          scale={settings.photoSize}
          settings={settings}
        />
      ))}
    </group>
  );
});

const getBackgroundStyle = (settings: SceneSettings): string => {
  if (settings.backgroundGradient) {
    return `linear-gradient(${settings.backgroundGradientAngle}deg, ${settings.backgroundGradientStart}, ${settings.backgroundGradientEnd})`;
  }
  return settings.backgroundColor;
};

const Floor: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  if (!settings.floorEnabled) return null;

  return (
    <group position={[0, -2, 0]}>
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

const Scene: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = ({ photos, settings }) => {
  const { camera, clock } = useThree();
  const time = useRef(0);

  useFrame(() => {
    if (settings.animationEnabled) {
      time.current = clock.getElapsedTime() * settings.animationSpeed;
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

const CollageScene: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
}> = ({ photos, settings, onSettingsChange }) => {
  return (
    <div className="w-full h-full">
      <Canvas
        frameloop="demand"
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