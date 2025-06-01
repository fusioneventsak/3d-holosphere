import React, { useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SpotLight, OrbitControls } from '@react-three/drei';
import { type SceneSettings } from '../../store/sceneStore';
import { type Photo } from './patterns/BasePattern';
import { PatternFactory } from './patterns/PatternFactory';

type Photo3D = {
  id: string;
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
};

interface CollageSceneProps {
  photos: Photo[];
  settings: SceneSettings;
}

const Spotlights: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const spotlightPositions = useMemo(() => {
    const radius = settings.floorSize / 2;
    const height = settings.spotlightHeight;
    
    // Calculate positions for 4 corners
    return [
      [-radius, height, -radius], // Back Left
      [radius, height, -radius],  // Back Right
      [-radius, height, radius],  // Front Left
      [radius, height, radius],   // Front Right
    ];
  }, [settings.floorSize, settings.spotlightHeight]);

  return (
    <group>
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
          target-position={[0, 0, 0]}
        />
      ))}
    </group>
  );
};

const PhotoMesh: React.FC<{
  photo: Photo3D;
  settings: SceneSettings;
}> = React.memo(({ photo, settings }) => {
  const textureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    const texture = new THREE.TextureLoader().load(photo.url);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    textureRef.current = texture;

    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
      }
    };
  }, [photo.url]);

  return (
    <mesh
      position={photo.position}
      rotation={photo.rotation || [0, 0, 0]}
    >
      <planeGeometry args={[settings.photoSize, settings.photoSize * (16/9)]} />
      <meshStandardMaterial
        map={textureRef.current}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
});

const Scene: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = ({ photos, settings }) => {
  const patternRef = useRef<any>(null);
  const photosRef = useRef<Photo3D[]>([]);
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
      timeRef.current += state.clock.getDelta() * settings.animationSpeed;
    }

    const { positions, rotations } = patternRef.current.generatePositions(timeRef.current);

    photosRef.current = photos.slice(0, settings.photoCount).map((photo, i) => ({
      ...photo,
      position: positions[i] || [0, 0, 0],
      rotation: rotations?.[i] || [0, 0, 0]
    }));
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

      {/* Photos */}
      {photosRef.current.map((photo) => (
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