import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';
import { PatternFactory } from './patterns/PatternFactory';
import { addCacheBustToUrl } from '../../lib/supabase';

type Photo = {
  id: string;
  url: string;
  collage_id?: string;
};

type CollageSceneProps = {
  photos: Photo[];
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
};

type PhotoWithPosition = Photo & {
  targetPosition: [number, number, number];
  targetRotation: [number, number, number];
};

// Simplified PhotoMesh component without teleport detection
const PhotoMesh: React.FC<{
  photo: PhotoWithPosition;
  size: number;
  emptySlotColor: string;
}> = ({ photo, size, emptySlotColor }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Load texture
  useEffect(() => {
    if (!photo.url) {
      setIsLoading(false);
      return;
    }

    const loader = new THREE.TextureLoader();
    setIsLoading(true);
    setHasError(false);

    const handleLoad = (loadedTexture: THREE.Texture) => {
      loadedTexture.minFilter = THREE.LinearFilter;
      loadedTexture.magFilter = THREE.LinearFilter;
      loadedTexture.format = THREE.RGBAFormat;
      setTexture(loadedTexture);
      setIsLoading(false);
    };

    const handleError = () => {
      setHasError(true);
      setIsLoading(false);
    };

    loader.load(addCacheBustToUrl(photo.url), handleLoad, undefined, handleError);

    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [photo.url]);

  // Smooth animation with consistent smoothing
  useFrame(() => {
    if (!meshRef.current) return;

    const currentPos = meshRef.current.position;
    const targetPos = photo.targetPosition;
    const targetRot = photo.targetRotation;

    // Consistent smooth interpolation for all patterns
    const POSITION_SMOOTHING = 0.1;
    const ROTATION_SMOOTHING = 0.08;

    meshRef.current.position.x += (targetPos[0] - currentPos.x) * POSITION_SMOOTHING;
    meshRef.current.position.y += (targetPos[1] - currentPos.y) * POSITION_SMOOTHING;
    meshRef.current.position.z += (targetPos[2] - currentPos.z) * POSITION_SMOOTHING;

    meshRef.current.rotation.x += (targetRot[0] - meshRef.current.rotation.x) * ROTATION_SMOOTHING;
    meshRef.current.rotation.y += (targetRot[1] - meshRef.current.rotation.y) * ROTATION_SMOOTHING;
    meshRef.current.rotation.z += (targetRot[2] - meshRef.current.rotation.z) * ROTATION_SMOOTHING;
  });

  // Create material based on state
  const material = useMemo(() => {
    if (hasError) {
      return new THREE.MeshStandardMaterial({ color: '#ff4444' });
    }
    if (isLoading || !texture) {
      return new THREE.MeshStandardMaterial({ color: emptySlotColor });
    }
    return new THREE.MeshStandardMaterial({ map: texture });
  }, [texture, isLoading, hasError, emptySlotColor]);

  return (
    <mesh ref={meshRef} material={material} castShadow>
      <planeGeometry args={[size, size * (9/16)]} />
    </mesh>
  );
};

// Lighting component
const SceneLighting: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const spotlightRefs = useRef<THREE.SpotLight[]>([]);

  // Create spotlights based on settings
  const spotlights = useMemo(() => {
    const lights = [];
    for (let i = 0; i < settings.spotlightCount; i++) {
      const angle = (i / settings.spotlightCount) * Math.PI * 2;
      const x = Math.cos(angle) * settings.spotlightDistance;
      const z = Math.sin(angle) * settings.spotlightDistance;
      
      lights.push({
        key: i,
        position: [x, settings.spotlightHeight, z] as [number, number, number],
      });
    }
    return lights;
  }, [settings.spotlightCount, settings.spotlightDistance, settings.spotlightHeight]);

  return (
    <>
      <ambientLight intensity={settings.ambientLightIntensity} />
      {spotlights.map((light, index) => (
        <spotLight
          key={light.key}
          ref={(el) => {
            if (el) spotlightRefs.current[index] = el;
          }}
          position={light.position}
          angle={settings.spotlightAngle}
          penumbra={settings.spotlightPenumbra}
          intensity={settings.spotlightIntensity}
          color={settings.spotlightColor}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
      ))}
    </>
  );
};

// Floor component
const Floor: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  if (!settings.floorEnabled) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[settings.floorSize, settings.floorSize]} />
      <meshStandardMaterial
        color={settings.floorColor}
        transparent
        opacity={settings.floorOpacity}
        metalness={settings.floorMetalness}
        roughness={settings.floorRoughness}
      />
    </mesh>
  );
};

// Grid component
const Grid: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  if (!settings.gridEnabled) return null;

  const gridHelper = useMemo(() => {
    return new THREE.GridHelper(
      settings.gridSize,
      settings.gridDivisions,
      settings.gridColor,
      settings.gridColor
    );
  }, [settings.gridSize, settings.gridDivisions, settings.gridColor]);

  useEffect(() => {
    const material = gridHelper.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.opacity = settings.gridOpacity;
  }, [settings.gridOpacity, gridHelper]);

  return <primitive object={gridHelper} />;
};

// Camera controller
const CameraController: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>();

  useFrame((state) => {
    if (!settings.cameraEnabled) return;

    if (settings.cameraRotationEnabled) {
      const time = state.clock.getElapsedTime();
      const radius = settings.cameraDistance;
      const height = settings.cameraHeight;
      
      camera.position.x = Math.cos(time * settings.cameraRotationSpeed) * radius;
      camera.position.z = Math.sin(time * settings.cameraRotationSpeed) * radius;
      camera.position.y = height;
      
      camera.lookAt(0, height * 0.5, 0);
    }
  });

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[settings.cameraDistance, settings.cameraHeight, settings.cameraDistance]}
        fov={75}
      />
      {!settings.cameraRotationEnabled && (
        <OrbitControls
          ref={controlsRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          target={[0, settings.cameraHeight * 0.5, 0]}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={5}
          maxDistance={100}
        />
      )}
    </>
  );
};

// Background component
const Background: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { scene } = useThree();

  useEffect(() => {
    if (settings.backgroundGradient) {
      // Create gradient background
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, settings.backgroundGradientStart);
        gradient.addColorStop(1, settings.backgroundGradientEnd);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
        
        const texture = new THREE.CanvasTexture(canvas);
        scene.background = texture;
        
        return () => {
          texture.dispose();
        };
      }
    } else {
      scene.background = new THREE.Color(settings.backgroundColor);
    }
  }, [
    scene,
    settings.backgroundColor,
    settings.backgroundGradient,
    settings.backgroundGradientStart,
    settings.backgroundGradientEnd,
  ]);

  return null;
};

// Main scene component
const Scene: React.FC<{
  photosWithPositions: PhotoWithPosition[];
  settings: SceneSettings;
  animationTime: number;
}> = ({ photosWithPositions, settings, animationTime }) => {
  return (
    <>
      <Background settings={settings} />
      <CameraController settings={settings} />
      <SceneLighting settings={settings} />
      <Floor settings={settings} />
      <Grid settings={settings} />
      
      {photosWithPositions.map((photo) => (
        <PhotoMesh
          key={photo.id}
          photo={photo}
          size={settings.photoSize}
          emptySlotColor={settings.emptySlotColor}
        />
      ))}
    </>
  );
};

// Main CollageScene component
const CollageScene: React.FC<CollageSceneProps> = ({
  photos,
  settings,
  onSettingsChange,
}) => {
  const [animationTime, setAnimationTime] = useState(0);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Create pattern and generate positions
  const photosWithPositions = useMemo(() => {
    const pattern = PatternFactory.createPattern(settings.animationPattern, settings, photos);
    const patternState = pattern.generatePositions(animationTime);
    
    const result: PhotoWithPosition[] = [];
    
    for (let i = 0; i < settings.photoCount; i++) {
      if (i < photos.length) {
        // Real photo
        result.push({
          ...photos[i],
          targetPosition: patternState.positions[i] || [0, -100, 0],
          targetRotation: patternState.rotations?.[i] || [0, 0, 0],
        });
      } else {
        // Empty slot
        result.push({
          id: `empty-${i}`,
          url: '',
          targetPosition: patternState.positions[i] || [0, -100, 0],
          targetRotation: patternState.rotations?.[i] || [0, 0, 0],
        });
      }
    }
    
    return result;
  }, [photos, settings, animationTime]);

  // Stable animation loop
  useEffect(() => {
    if (!settings.animationEnabled) {
      setAnimationTime(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      return;
    }

    const animate = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }
      
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;
      
      setAnimationTime(prev => prev + deltaTime);
      animationRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [settings.animationEnabled]);

  // Reset animation time when pattern changes
  useEffect(() => {
    setAnimationTime(0);
    lastTimeRef.current = 0;
  }, [settings.animationPattern]);

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ position: [25, 10, 25], fov: 75 }}
        gl={{ 
          antialias: true, 
          alpha: false,
          powerPreference: "high-performance"
        }}
        onCreated={(state) => {
          state.gl.shadowMap.enabled = true;
          state.gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Scene 
          photosWithPositions={photosWithPositions}
          settings={settings}
          animationTime={animationTime}
        />
      </Canvas>
    </div>
  );
};

export default CollageScene;