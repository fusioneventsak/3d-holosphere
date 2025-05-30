import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, SpotLight, Text } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';

type Photo = {
  id: string;
  url: string;
  collage_id?: string;
};

// Photo frame component with 9:16 aspect ratio
const PhotoFrame = animated(({ 
  position: [number, number, number];
  rotation?: [number, number, number];
  url?: string;
  scale: number;
  emptySlotColor: string;
}) => {
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
      const spread = patternSettings.spread;
      const height = patternSettings.height;
      
      for (let i = 0; i < totalPhotos; i++) {
        const x = (Math.random() - 0.5) * spread * 2;
        const y = baseHeight + height + Math.random() * height * 0.5;
        const z = (Math.random() - 0.5) * spread * 2;
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

// Photo wall component
const PhotoWall: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = ({ photos, settings }) => {
  const positions = generatePhotoPositions(settings);

  // Create springs for each photo position
  const springs = positions.map((position, index) => {
    let rotation: [number, number, number] = [0, 0, 0];
    
    // Handle rotations based on pattern
    if (settings.animationPattern === 'spiral') {
      const angle = Math.atan2(position[2], position[0]);
      rotation = [0, -angle + Math.PI / 2, 0];
    } else if (settings.animationPattern !== 'grid') {
      const angle = Math.atan2(position[2], position[0]);
      rotation = [0, -angle + Math.PI / 2, 0];
    }

    return useSpring({
      position,
      rotation,
      config: { mass: 1, tension: 120, friction: 14 },
    });
  });
  
  return (
    <group>
      {springs.map((spring, index) => {
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