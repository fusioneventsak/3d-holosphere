import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';

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

// Scene components that use R3F hooks
const Scene: React.FC<{
  settings: SceneSettings;
}> = ({ settings }) => {
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
      <Floor settings={settings} />
    </>
  );
};

// Main CollageScene component that provides the Canvas
const CollageScene: React.FC<{
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
}> = ({ settings, onSettingsChange }) => {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{
          fov: 60,
          near: 0.1,
          far: 2000,
          position: [0, settings.cameraHeight, settings.cameraDistance]
        }}
      >
        <Scene settings={settings} />
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