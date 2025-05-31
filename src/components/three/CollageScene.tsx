import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, SpotLight } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';
import { PatternFactory } from './patterns/PatternFactory';
import { type Photo } from './patterns/BasePattern';

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = new Map<string, { texture: THREE.Texture; lastUsed: number }>();

const TEXTURE_CACHE_MAX_AGE = 5 * 60 * 1000;
const TEXTURE_CLEANUP_INTERVAL = 30000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of textureCache.entries()) {
    if (now - entry.lastUsed > TEXTURE_CACHE_MAX_AGE) {
      entry.texture.dispose();
      textureCache.delete(key);
    }
  }
}, TEXTURE_CLEANUP_INTERVAL);

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
  const targetRotation = useRef(new THREE.Euler());
  const currentRotation = useRef(new THREE.Euler());
  const meshPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (meshRef.current && settings.photoRotation) {
      const mesh = meshRef.current;
      
      // Get world position
      mesh.getWorldPosition(meshPosition);
      
      // Calculate direction to camera
      const directionToCamera = camera.position.clone().sub(meshPosition).normalize();
      
      // Calculate target rotation (only Y-axis)
      const angle = Math.atan2(directionToCamera.x, directionToCamera.z);
      targetRotation.current.y = angle;
      
      // Smooth interpolation
      currentRotation.current.y += (targetRotation.current.y - currentRotation.current.y) * 0.1;
      
      // Apply rotation
      mesh.rotation.y = currentRotation.current.y;
    }
  });

  const width = scale;
  const height = scale * (16/9);
  
  const dynamicScale = settings.animationPattern === 'float' 
    ? Math.min(1, settings.floorSize / (Math.sqrt(settings.photoCount) * 20))
    : 1;
  
  const springs = useSpring({
    position,
    immediate: settings.animationPattern === 'float',
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
  const lastFrameTimeRef = useRef(Date.now());
  const patternRef = useRef(PatternFactory.createPattern(settings.animationPattern, settings, photos));

  useEffect(() => {
    patternRef.current = PatternFactory.createPattern(settings.animationPattern, settings, photos);
    const { positions: initialPositions } = patternRef.current.generatePositions(0);
    setPositions(initialPositions);
    timeRef.current = 0;
    lastFrameTimeRef.current = Date.now();
  }, [settings.animationPattern, settings.photoCount, settings.photoSize, settings.photoSpacing, photos]);

  useFrame(() => {
    if (settings.animationEnabled) {
      const now = Date.now();
      const deltaTime = (now - lastFrameTimeRef.current) / 1000; // Convert to seconds
      timeRef.current += deltaTime;
      lastFrameTimeRef.current = now;
      
      const { positions: newPositions } = patternRef.current.generatePositions(timeRef.current);
      setPositions(newPositions);
    }
  });

  return (
    <group>
      {positions.map((position, index) => {
        const photoIndex = index % photos.length;
        return (
          <PhotoFrame
            key={`photo-${index}-${photos[photoIndex]?.id || 'empty'}`}
            position={position}
            url={photos[photoIndex]?.url}
            emptySlotColor={settings.emptySlotColor}
            scale={settings.photoSize}
            settings={settings}
          />
        );
      })}
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
  const { camera } = useThree();

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