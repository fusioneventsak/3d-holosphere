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

// Improve smoothing values for better animation
const POSITION_SMOOTHING = 0.1;
const ROTATION_SMOOTHING = 0.1;

// PhotoMesh component with improved transition handling
const PhotoMesh: React.FC<{
  photo: PhotoWithPosition;
  size: number;
  emptySlotColor: string;
  pattern: string;
}> = ({ photo, size, emptySlotColor, pattern }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const prevPositionRef = useRef<[number, number, number]>([0, 0, 0]);

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

  // Animation with improved pattern-specific handling
  useFrame(() => {
    if (!meshRef.current) return;

    const currentPos = meshRef.current.position;
    const targetPos = photo.targetPosition;
    const targetRot = photo.targetRotation;

    // Detect large position changes (like in float pattern) to prevent jarring transitions
    const yDistance = Math.abs(targetPos[1] - currentPos.y);
    const xDistance = Math.abs(targetPos[0] - currentPos.x);
    const zDistance = Math.abs(targetPos[2] - currentPos.z);
    const maxTeleportDistance = 20;
    
    // If large jump detected, teleport instead of interpolate
    if (yDistance > maxTeleportDistance || xDistance > maxTeleportDistance || zDistance > maxTeleportDistance) {
      meshRef.current.position.set(targetPos[0], targetPos[1], targetPos[2]);
      meshRef.current.rotation.set(targetRot[0], targetRot[1], targetRot[2]);
      prevPositionRef.current = [...targetPos];
      return;
    }

    // Normal smooth interpolation for smaller movements
    meshRef.current.position.x += (targetPos[0] - currentPos.x) * POSITION_SMOOTHING;
    meshRef.current.position.y += (targetPos[1] - currentPos.y) * POSITION_SMOOTHING;
    meshRef.current.position.z += (targetPos[2] - currentPos.z) * POSITION_SMOOTHING;

    meshRef.current.rotation.x += (targetRot[0] - meshRef.current.rotation.x) * ROTATION_SMOOTHING;
    meshRef.current.rotation.y += (targetRot[1] - meshRef.current.rotation.y) * ROTATION_SMOOTHING;
    meshRef.current.rotation.z += (targetRot[2] - meshRef.current.rotation.z) * ROTATION_SMOOTHING;
    
    prevPositionRef.current = [currentPos.x, currentPos.y, currentPos.z];
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
    <mesh ref={meshRef} material={material} castShadow receiveShadow position={photo.targetPosition}>
      <planeGeometry args={[size, size * (9/16)]} />
    </mesh>
  );
};

// Improved lighting component
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

  // Update spotlight properties when settings change
  useEffect(() => {
    spotlightRefs.current.forEach(spotlight => {
      if (spotlight) {
        spotlight.intensity = settings.spotlightIntensity;
        spotlight.angle = settings.spotlightAngle;
        spotlight.penumbra = settings.spotlightPenumbra;
        spotlight.color.set(settings.spotlightColor);
      }
    });
  }, [
    settings.spotlightIntensity,
    settings.spotlightAngle,
    settings.spotlightPenumbra,
    settings.spotlightColor
  ]);

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
          shadow-bias={-0.0001}
        />
      ))}
    </>
  );
};

// Floor component with improved material
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
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// Grid component with better visuals
const Grid: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  if (!settings.gridEnabled) return null;

  const gridRef = useRef<THREE.Object3D>();
  
  useEffect(() => {
    if (gridRef.current) {
      const gridHelper = gridRef.current as THREE.GridHelper;
      const material = gridHelper.material as THREE.LineBasicMaterial;
      material.transparent = true;
      material.opacity = settings.gridOpacity;
      material.color = new THREE.Color(settings.gridColor);
    }
  }, [settings.gridOpacity, settings.gridColor]);

  return (
    <gridHelper
      ref={gridRef}
      args={[
        settings.gridSize,
        settings.gridDivisions,
        settings.gridColor,
        settings.gridColor
      ]}
      position={[0, 0.01, 0]} // Slightly above floor to prevent z-fighting
    />
  );
};

// Improved camera controller
const CameraController: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>();
  const lastPositionRef = useRef({ x: 0, y: 0, z: 0 });

  useFrame((state) => {
    if (!settings.cameraEnabled) return;

    if (settings.cameraRotationEnabled) {
      const time = state.clock.getElapsedTime();
      const radius = settings.cameraDistance;
      const height = settings.cameraHeight;
      
      // Target position
      const targetX = Math.cos(time * settings.cameraRotationSpeed) * radius;
      const targetZ = Math.sin(time * settings.cameraRotationSpeed) * radius;
      const targetY = height;
      
      // Smooth camera movement
      camera.position.x += (targetX - camera.position.x) * 0.05;
      camera.position.y += (targetY - camera.position.y) * 0.05;
      camera.position.z += (targetZ - camera.position.z) * 0.05;
      
      // Look at the center with slight elevation
      camera.lookAt(0, height * 0.3, 0);
      
      lastPositionRef.current = { 
        x: camera.position.x, 
        y: camera.position.y, 
        z: camera.position.z 
      };
    } else if (controlsRef.current) {
      // Update orbit controls target when camera height changes
      controlsRef.current.target.set(0, settings.cameraHeight * 0.3, 0);
    }
  });

  // Update camera position when settings change
  useEffect(() => {
    if (!settings.cameraRotationEnabled && camera) {
      camera.position.set(
        settings.cameraDistance,
        settings.cameraHeight,
        settings.cameraDistance
      );
      camera.lookAt(0, settings.cameraHeight * 0.3, 0);
    }
  }, [
    settings.cameraDistance,
    settings.cameraHeight,
    settings.cameraRotationEnabled,
    camera
  ]);

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
          target={[0, settings.cameraHeight * 0.3, 0]}
          maxPolarAngle={Math.PI / 1.5}
          minDistance={5}
          maxDistance={100}
        />
      )}
    </>
  );
};

// Improved background component
const Background: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { scene } = useThree();

  useEffect(() => {
    if (settings.backgroundGradient) {
      // Create gradient background
      const canvas = document.createElement('canvas');
      canvas.width = 512; // Higher resolution for better quality
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Create gradient at specified angle
        const angleInRadians = (settings.backgroundGradientAngle * Math.PI) / 180;
        const x0 = 256 + Math.cos(angleInRadians) * 256;
        const y0 = 256 + Math.sin(angleInRadians) * 256;
        const x1 = 256 - Math.cos(angleInRadians) * 256;
        const y1 = 256 - Math.sin(angleInRadians) * 256;
        
        const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
        gradient.addColorStop(0, settings.backgroundGradientStart);
        gradient.addColorStop(1, settings.backgroundGradientEnd);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
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
    settings.backgroundGradientAngle
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
          pattern={settings.animationPattern}
        />
      ))}
    </>
  );
};

// Main CollageScene component with improved animation handling
const CollageScene: React.FC<CollageSceneProps> = ({
  photos,
  settings,
  onSettingsChange,
}) => {
  const [animationTime, setAnimationTime] = useState(0);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const frameRateRef = useRef<number[]>([]);

  // Create pattern and generate positions with improved stability
  const photosWithPositions = useMemo(() => {
    const pattern = PatternFactory.createPattern(settings.animationPattern, settings, photos);
    const patternState = pattern.generatePositions(animationTime);
    
    const result: PhotoWithPosition[] = [];
    
    // Generate positions for both real photos and empty slots
    for (let i = 0; i < settings.photoCount; i++) {
      const position = patternState.positions[i] || [0, -100, 0];
      const rotation = patternState.rotations?.[i] || [0, 0, 0];
      
      if (i < photos.length) {
        // Real photo
        result.push({
          ...photos[i],
          targetPosition: position,
          targetRotation: rotation,
        });
      } else {
        // Empty slot
        result.push({
          id: `empty-${i}`,
          url: '',
          targetPosition: position,
          targetRotation: rotation,
        });
      }
    }
    
    return result;
  }, [photos, settings, animationTime]);

  // Improved stable animation loop with frame rate monitoring
  useEffect(() => {
    if (!settings.animationEnabled) {
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
      
      // Frame rate monitoring
      const fps = 1 / deltaTime;
      frameRateRef.current.push(fps);
      if (frameRateRef.current.length > 60) {
        frameRateRef.current.shift();
      }
      
      // Smooth animation with frame rate consideration
      // Use a fixed delta time if frame rate drops too low
      const effectiveDelta = Math.min(deltaTime, 1/20); 
      
      setAnimationTime(prev => prev + effectiveDelta);
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
    frameRateRef.current = [];
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
          state.gl.pixelRatio = Math.min(window.devicePixelRatio, 2); // Limit for better performance
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