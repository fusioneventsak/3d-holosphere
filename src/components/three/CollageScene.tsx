import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, SpotLight, Text } from '@react-three/drei';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';

type Photo = {
  id: string;
  url: string;
  collage_id?: string;
};

// Photo frame component with 9:16 aspect ratio
const PhotoFrame: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  url?: string;
  scale: number;
  emptySlotColor: string;
}> = ({ position, rotation = [0, 0, 0], url, scale, emptySlotColor }) => {
  // Use 9:16 aspect ratio for the photo frame
  const width = scale;
  const height = scale * (16/9);

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        color={url ? undefined : emptySlotColor}
        transparent
        opacity={url ? 1 : 0.5}
      />
    </mesh>
  );
};

// Generate positions for different animation patterns
const generatePhotoPositions = (settings: SceneSettings): [number, number, number][] => {
  const positions: [number, number, number][] = [];
  const totalPhotos = Math.min(settings.photoCount, 500);
  const spacing = settings.photoSize * (1 + settings.photoSpacing);

  switch (settings.animationPattern) {
    case 'grid': {
      // Calculate grid dimensions based on aspect ratio
      const aspectRatio = settings.gridAspectRatio;
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
      const radius = settings.floorSize * 0.25;
      const heightStep = spacing * 0.5;
      const angleStep = (Math.PI * 2) / (totalPhotos / 3);
      
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
      const area = settings.floorSize * 0.5;
      for (let i = 0; i < totalPhotos; i++) {
        const x = (Math.random() - 0.5) * area;
        const y = settings.wallHeight + Math.random() * area * 0.5;
        const z = (Math.random() - 0.5) * area;
        positions.push([x, y, z]);
      }
      break;
    }
    
    case 'wave': {
      const waveWidth = settings.floorSize * 0.5;
      const waveDepth = settings.floorSize * 0.3;
      const columns = Math.ceil(Math.sqrt(totalPhotos));
      const rows = Math.ceil(totalPhotos / columns);
      
      for (let i = 0; i < totalPhotos; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = (col - columns / 2) * spacing;
        const z = (row - rows / 2) * spacing;
        const angle = (x / waveWidth) * Math.PI * 2;
        const y = settings.wallHeight + Math.sin(angle) * waveDepth * 0.2;
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
  
  return (
    <group>
      {positions.map((position, index) => {
        const photo = photos[index];
        let rotation: [number, number, number] = [0, 0, 0];
        
        // Add variations to rotation based on pattern
        if (settings.animationPattern === 'spiral') {
          const angle = Math.atan2(position[2], position[0]);
          rotation = [0, -angle + Math.PI / 2, 0];
        } else if (settings.animationPattern === 'float') {
          rotation = [
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
          ];
        }
        
        return (
          <PhotoFrame
            key={index}
            position={position}
            rotation={rotation}
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
    if (camera) {
      camera.position.set(0, settings.cameraHeight, settings.cameraDistance);
      camera.updateProjectionMatrix();
    }
  }, [camera, settings.cameraHeight, settings.cameraDistance]);

  return (
    <>
      <ambientLight intensity={settings.ambientLightIntensity} />
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