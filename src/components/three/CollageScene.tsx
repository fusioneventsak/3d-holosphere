import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { SpotLight, OrbitControls, Environment } from '@react-three/drei';
import { type SceneSettings } from '../../store/sceneStore';
import { type Photo, type Position } from './patterns/BasePattern';
import { PatternFactory } from './patterns/PatternFactory';

interface CollageSceneProps {
  photos: Photo[];
  settings: SceneSettings;
}

const Spotlights: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const spotlightPositions = useMemo(() => {
    const radius = settings.spotlightDistance;
    const height = settings.spotlightHeight;
    
    // Calculate positions for 4 corners
    return [
      [-radius, height, -radius], // Back Left
      [radius, height, -radius],  // Back Right
      [-radius, height, radius],  // Front Left
      [radius, height, radius],   // Front Right
    ];
  }, [settings.spotlightDistance, settings.spotlightHeight]);

  return (
    <>
      {spotlightPositions.map((position, index) => (
        <SpotLight
          key={index}
          position={position}
          angle={settings.spotlightAngle}
          penumbra={settings.spotlightPenumbra}
          intensity={settings.spotlightIntensity}
          color={settings.spotlightColor}
          distance={settings.spotlightDistance * 2}
          attenuation={2}
          anglePower={8}
          target-position={[0, -2, 0]} // Target center of floor
        />
      ))}
    </>
  );
};

const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings }) => {
  return (
    <Canvas
      camera={{ position: [0, 5, 10], fov: 75 }}
      style={{ width: '100%', height: '100vh' }}
    >
      <color attach="background" args={[settings.backgroundColor]} />
      
      <OrbitControls
        enablePan={settings.enablePan}
        enableZoom={settings.enableZoom}
        enableRotate={settings.enableRotate}
        minDistance={settings.minDistance}
        maxDistance={settings.maxDistance}
      />

      <Environment preset={settings.environmentPreset} />
      
      <Spotlights settings={settings} />

      <PatternFactory
        pattern={settings.pattern}
        photos={photos}
        settings={settings}
      />
    </Canvas>
  );
};

export default CollageScene;