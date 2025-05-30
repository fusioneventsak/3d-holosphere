import React, { useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, SpotLight, Text } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';

type Photo = {
  id: string;
  url: string;
  collage_id?: string;
};

interface PhotoFrameProps {
  position: [number, number, number],
  rotation?: [number, number, number],
  url?: string,
  scale: number,
  emptySlotColor: string
}

// Photo frame component with 9:16 aspect ratio
const PhotoFrame = animated(({ 
  position,
  rotation,
  scale,
  url,
  baseScale,
  emptySlotColor
}: PhotoFrameProps) => {
  const { camera } = useThree();

  // Only apply billboarding if no rotation is provided (for non-float patterns)
  useFrame(() => {
    if (!rotation && ref.current) {
      const dx = camera.position.x - ref.current.position.x;
      const dz = camera.position.z - ref.current.position.z;
      const rawAngle = Math.atan2(dx, dz);
      
      // Calculate distance from camera to photo
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      // Smoothly reduce rotation as distance increases
      const maxDist = 50; // Distance at which rotation starts reducing
      const distFactor = Math.min(dist / maxDist, 1);
      const rotationLimit = (Math.PI / 3) * (1 - distFactor * 0.5); // Limit to ±60° with distance falloff
      
      // Apply smooth rotation limits
      let angle = rawAngle;
      if (Math.abs(angle) > rotationLimit) {
        angle = Math.sign(angle) * rotationLimit;
      }
      
      ref.current.rotation.y = angle;
    }
  });

  const ref = useRef<THREE.Mesh>(null);

  // Use 9:16 aspect ratio for the photo frame
  const width = baseScale;
  const height = baseScale * (16/9);

  return (
    <animated.mesh ref={ref} position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial 
        scale={scale}
        color={url ? undefined : emptySlotColor} 
        transparent={!!url}
        opacity={1}
      /> 
    </animated.mesh>
  );
});

// Generate positions for different animation patterns
const generatePhotoPositions = (settings: SceneSettings): [number, number, number][] => {
  const positions: [number, number, number][] = [];
  const totalPhotos = Math.min(settings.photoCount, 500);
  const baseSpacing = settings.photoSize * (1 + settings.photoSpacing);

  switch (settings.animationPattern) {
    case 'grid': {
      const patternSettings = settings.patterns.grid;
      const spacing = baseSpacing * (1 + patternSettings.spacing);
      // Calculate grid dimensions based on aspect ratio
      const aspectRatio = patternSettings.aspectRatio;
      const columns = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
      const rows = Math.ceil(totalPhotos / columns);
      
      for (let i = 0; i < totalPhotos; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = (col - columns / 2) * spacing;
        const y = baseHeight + patternSettings.wallHeight + (rows / 2 - row) * spacing * (16/9);
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
      const angleStep = (Math.PI * 2) / (totalPhotos / 3);
      
      for (let i = 0; i < totalPhotos; i++) {
        const angle = i * angleStep;
        const spiralRadius = radius * (1 - i / totalPhotos);
        const x = Math.cos(angle) * spiralRadius;
        const y = baseHeight + (i * heightStep);
        const z = Math.sin(angle) * spiralRadius;
        positions.push([x, y, z]);
      }
      break;
    }
    
    case 'float': {
      const patternSettings = settings.patterns.float;
      const maxRadius = settings.floorSize * 0.4; // 80% of floor size for better visibility
      
      for (let i = 0; i < totalPhotos; i++) {
        // Fibonacci spiral distribution for even spacing
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        const angle = i * goldenRatio * Math.PI * 2;
        const r = maxRadius * Math.sqrt(i / totalPhotos);
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = -settings.floorSize * 0.25; // Start below floor
        positions.push([x, y, z]);
      }
      break;
    }
    
    case 'wave': {
      const patternSettings = settings.patterns.wave;
      const spacing = baseSpacing * (1 + patternSettings.spacing);
      const columns = Math.ceil(Math.sqrt(totalPhotos));
      const rows = Math.ceil(totalPhotos / columns);
      
      for (let i = 0; i < totalPhotos; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = (col - columns / 2) * spacing;
        const z = (row - rows / 2) * spacing;
        const angle = x * patternSettings.frequency;
        const y = baseHeight + Math.sin(angle) * patternSettings.amplitude;
        positions.push([x, y, z]);
      }
      break;
    }
  }

  return positions;
};

// Individual animated photo component
const AnimatedPhoto: React.FC<{
  position: [number, number, number];
  photo?: Photo;
  settings: SceneSettings;
  index: number;
  duplicate?: boolean;
}> = React.memo(({ position: initialPosition, photo, settings, index, duplicate }) => {
  const { camera } = useThree();
  const resetHeight = -settings.floorSize * 0.4; // Lower starting point
  const maxHeight = settings.floorSize * 0.6; // Higher maximum
  const totalDistance = maxHeight - resetHeight;
  const startOffset = React.useRef(
    duplicate ? totalDistance * 0.5 : Math.random() * (totalDistance * 0.5)
  ).current;

  // Keep original X and Z positions
  const basePosition = React.useRef([initialPosition[0], resetHeight, initialPosition[2]]).current;

  const [spring, api] = useSpring(() => ({
    position: basePosition,
    rotation: [0, 0, 0],
    scale: 1,
    config: { 
      mass: 1,
      tension: 170,
      friction: 26,
      clamp: false
    }
  }));

  useFrame((state) => {
    if (settings.animationPattern !== 'float') return;
    
    const speed = settings.patterns.float.animationSpeed;
    const time = state.clock.getElapsedTime() * speed;
    
    // Calculate position in the loop
    const cyclePosition = (time + startOffset) % totalDistance;
    const y = cyclePosition + resetHeight;
    
    // Calculate angle to camera but limit rotation
    const dx = camera.position.x - initialPosition[0];
    const dz = camera.position.z - initialPosition[2];
    let angle = Math.atan2(dx, dz);
    
    // Normalize angle to -π to π range
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    
    // Limit rotation to ±90 degrees (π/2)
    angle = Math.max(Math.min(angle, Math.PI / 2), -Math.PI / 2);
    
    api.start({
      position: [basePosition[0], y, basePosition[2]],
      rotation: [0, angle, 0],
      scale: 1,
      config: { 
        tension: 170,
        friction: 26,
        clamp: false
      }
    });
  });

  return (
    <PhotoFrame
      {...spring}
      scale={spring.scale}
      url={photo?.url}
      baseScale={settings.photoSize}
      emptySlotColor={settings.emptySlotColor}
    />
  );
});

// Photo wall component
const PhotoWall: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = React.memo(({ photos, settings }) => {
  const positions = React.useMemo(() => {
    const basePositions = generatePhotoPositions(settings);
    // For float pattern, create duplicate set with offset positions
    if (settings.animationPattern === 'float') {
      const duplicatePositions = basePositions.map(([x, y, z]) => [
        x * 0.8 + (Math.random() - 0.5) * 5,
        y,
        z * 0.8 + (Math.random() - 0.5) * 5
      ] as [number, number, number]);
      return [...basePositions, ...duplicatePositions];
    }
    return basePositions;
  }, [
    settings.photoCount,
    settings.photoSize,
    settings.animationPattern,
    settings.patterns
  ]);
  
  return (
    <group>
      {positions.map((position, index) => {
        const isInDuplicateSet = index >= positions.length / 2;
        const originalIndex = isInDuplicateSet ? index - positions.length / 2 : index;
        const photo = photos[originalIndex % photos.length];
        
        return (
          <AnimatedPhoto
            key={`${index}-${isInDuplicateSet ? 'dup' : 'orig'}`}
            position={position}
            photo={photo}
            settings={settings}
            index={index}
            duplicate={isInDuplicateSet}
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
  const { camera } = useThree();

  useEffect(() => {
    if (camera && !settings.cameraEnabled) {
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