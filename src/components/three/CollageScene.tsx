import React, { useEffect } from 'react';
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
  url,
  scale,
  emptySlotColor
}: PhotoFrameProps) => {
  // Use 9:16 aspect ratio for the photo frame
  const width = scale;
  const height = scale * (16/9);

  return (
    <animated.mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial 
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
  const baseSpacing = settings.photoSize;
  const baseHeight = 0; // Base height for all patterns

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
      const spacing = baseSpacing * (1 + patternSettings.spacing);
      const { spread, density, yOffset } = patternSettings;
      
      for (let i = 0; i < totalPhotos; i++) {
        const col = i % gridSize;
        const row = Math.floor(i / gridSize);
        
        // Calculate base position in grid
        const x = (col - gridSize/2) * cellSize + (Math.random() - 0.5) * cellSize;
        const z = (row - gridSize/2) * cellSize + (Math.random() - 0.5) * cellSize;
        
        // Start at different heights
        const y = yOffset + Math.random() * patternSettings.height;
        
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

// Custom hook for floating animation
const useFloatingAnimation = (
  initialPosition: [number, number, number],
  settings: SceneSettings,
  index: number
) => {
  const { current: offset } = React.useRef({
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 0.5
  });
  
  const [spring, api] = useSpring(() => ({
    position: initialPosition,
    rotation: [0, 0, 0],
    config: { mass: 1, tension: 50, friction: 20 }
  }));

  useFrame((state) => {
    if (settings.animationPattern !== 'float') return;
    
    const patternSettings = settings.patterns.float;
    const time = state.clock.getElapsedTime();
    
    // Calculate vertical position with smooth looping
    const height = patternSettings.height;
    const loopProgress = ((time * patternSettings.animationSpeed + offset.phase) % patternSettings.loopDuration) / patternSettings.loopDuration;
    const y = patternSettings.yOffset + height + (loopProgress * height * 2);
    
    // Add subtle horizontal movement
    const wobble = Math.sin(time * offset.speed + offset.phase) * 0.3;
    
    api.start({
      position: [
        initialPosition[0] + wobble,
        y,
        initialPosition[2] + wobble
      ],
      rotation: [
        Math.sin(time * 0.5 + offset.phase) * 0.1,
        time * 0.2 + offset.phase,
        Math.cos(time * 0.5 + offset.phase) * 0.1
      ]
    });
  });

  return spring;
};

// Photo wall component
const PhotoWall: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = ({ photos, settings }) => {
  const positions = generatePhotoPositions(settings);

  // Create springs for each photo position
  const springs = positions.map((position, index) => {
  // Use pattern-specific animations
  const animatedProps = positions.map((position, index) => {
    if (settings.animationPattern === 'float') {
      return useFloatingAnimation(position, settings, index);
    } 

    // Default spring animation for other patterns
    const rotation: [number, number, number] = [0, 0, 0];
    return useSpring(() => ({
      position,
      rotation,
      config: { mass: 1, tension: 120, friction: 14 },
    }));
  });
  
  return (
    <group>
      {animatedProps.map((spring, index) => {
        const photo = photos[index];
        
        return (
          <PhotoFrame
            key={index}
            {...spring}
            url={photo?.url}
            scale={settings.photoSize}
            emptySlotColor={settings.emptySlotColor}
          />
        );
      })}
    </group>
  );
};

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