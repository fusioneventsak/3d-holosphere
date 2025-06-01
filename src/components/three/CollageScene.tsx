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

// PhotoMesh component with improved transition handling and camera facing
const PhotoMesh: React.FC<{
  photo: PhotoWithPosition;
  size: number;
  emptySlotColor: string;
  pattern: string;
  shouldFaceCamera: boolean;
}> = ({ photo, size, emptySlotColor, pattern, shouldFaceCamera }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
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

  // Animation with improved pattern-specific handling and camera facing
  useFrame(() => {
    if (!meshRef.current) return;

    const currentPos = meshRef.current.position;
    const targetPos = photo.targetPosition;

    // Detect large position changes (like in float pattern) to prevent jarring transitions
    const yDistance = Math.abs(targetPos[1] - currentPos.y);
    const xDistance = Math.abs(targetPos[0] - currentPos.x);
    const zDistance = Math.abs(targetPos[2] - currentPos.z);
    const maxTeleportDistance = 20;
    
    // If large jump detected, teleport instead of interpolate
    if (yDistance > maxTeleportDistance || xDistance > maxTeleportDistance || zDistance > maxTeleportDistance) {
      meshRef.current.position.set(targetPos[0], targetPos[1], targetPos[2]);
      prevPositionRef.current = [...targetPos];
    } else {
      // Normal smooth interpolation for smaller movements
      meshRef.current.position.x += (targetPos[0] - currentPos.x) * POSITION_SMOOTHING;
      meshRef.current.position.y += (targetPos[1] - currentPos.y) * POSITION_SMOOTHING;
      meshRef.current.position.z += (targetPos[2] - currentPos.z) * POSITION_SMOOTHING;
    }

    // Rotation handling - face camera if enabled
    if (shouldFaceCamera) {
      // Calculate direction from photo to camera
      const photoPos = meshRef.current.position;
      const cameraPos = camera.position;
      
      const directionX = cameraPos.x - photoPos.x;
      const directionZ = cameraPos.z - photoPos.z;
      
      // Calculate rotation to face camera
      const targetRotationY = Math.atan2(directionX, directionZ);
      
      // Smooth rotation transition
      const currentRotY = meshRef.current.rotation.y;
      let rotationDiff = targetRotationY - currentRotY;
      
      // Handle rotation wrap-around (shortest path)
      if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
      if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
      
      meshRef.current.rotation.y += rotationDiff * ROTATION_SMOOTHING;
      
      // Apply any pattern-specific rotation offsets
      const patternRot = photo.targetRotation;
      meshRef.current.rotation.x += (patternRot[0] - meshRef.current.rotation.x) * ROTATION_SMOOTHING;
      meshRef.current.rotation.z += (patternRot[2] - meshRef.current.rotation.z) * ROTATION_SMOOTHING;
    } else {
      // Use pattern-defined rotation
      const targetRot = photo.targetRotation;
      meshRef.current.rotation.x += (targetRot[0] - meshRef.current.rotation.x) * ROTATION_SMOOTHING;
      meshRef.current.rotation.y += (targetRot[1] - meshRef.current.rotation.y) * ROTATION_SMOOTHING;
      meshRef.current.rotation.z += (targetRot[2] - meshRef.current.rotation.z) * ROTATION_SMOOTHING;
    }
    
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
      <planeGeometry args={[size * (9/16), size]} /> {/* Portrait orientation */}
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

// Fixed camera controller with improved auto-rotation
const CameraController: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>();
  const lastInteractionTimeRef = useRef(0);
  const isUserInteractingRef = useRef(false);
  const autoRotationTimeRef = useRef(0);
  const autoRotationActiveRef = useRef(false);

  // Set up event listeners to track user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      lastInteractionTimeRef.current = Date.now();
      isUserInteractingRef.current = true;
      autoRotationActiveRef.current = false;
    };

    const handleInteractionEnd = () => {
      isUserInteractingRef.current = false;
    };

    // Get the canvas element
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', handleUserInteraction);
      canvas.addEventListener('mouseup', handleInteractionEnd);
      canvas.addEventListener('mousemove', handleUserInteraction);
      canvas.addEventListener('wheel', handleUserInteraction);
      canvas.addEventListener('touchstart', handleUserInteraction);
      canvas.addEventListener('touchmove', handleUserInteraction);
      canvas.addEventListener('touchend', handleInteractionEnd);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('mousedown', handleUserInteraction);
        canvas.removeEventListener('mouseup', handleInteractionEnd);
        canvas.removeEventListener('mousemove', handleUserInteraction);
        canvas.removeEventListener('wheel', handleUserInteraction);
        canvas.removeEventListener('touchstart', handleUserInteraction);
        canvas.removeEventListener('touchmove', handleUserInteraction);
        canvas.removeEventListener('touchend', handleInteractionEnd);
      }
    };
  }, []);

  // Update camera position when settings change
  useEffect(() => {
    if (camera) {
      // Initial position setup
      if (!settings.cameraRotationEnabled) {
        camera.position.set(
          settings.cameraDistance,
          settings.cameraHeight,
          settings.cameraDistance
        );
        camera.lookAt(0, settings.cameraHeight * 0.3, 0);
      }
    }
  }, [
    settings.cameraDistance,
    settings.cameraHeight,
    settings.cameraRotationEnabled,
    camera
  ]);

  useFrame((state) => {
    if (!settings.cameraEnabled) return;

    // Update orbit controls target
    if (controlsRef.current) {
      controlsRef.current.target.set(0, settings.cameraHeight * 0.3, 0);
    }

    // Only auto-rotate if enabled and user isn't interacting
    if (settings.cameraRotationEnabled) {
      const inactiveTime = Date.now() - lastInteractionTimeRef.current;
      
      // Resume auto rotation after 1.5 seconds of no interaction
      if ((!isUserInteractingRef.current && inactiveTime > 1500) || lastInteractionTimeRef.current === 0) {
        // If we're just starting auto rotation, capture current angle
        if (!autoRotationActiveRef.current) {
          // Get current angle from camera position
          const currentAngle = Math.atan2(camera.position.z, camera.position.x);
          // Set rotation time to match current position for smooth transition
          autoRotationTimeRef.current = currentAngle / settings.cameraRotationSpeed;
          autoRotationActiveRef.current = true;
        } else {
          // Increment rotation time
          autoRotationTimeRef.current += state.clock.elapsedTime - state.clock.oldTime;
        }
        
        const time = autoRotationTimeRef.current;
        const radius = settings.cameraDistance;
        const height = settings.cameraHeight;
        
        // Calculate target position based on rotation speed and time
        const targetX = Math.cos(time * settings.cameraRotationSpeed) * radius;
        const targetZ = Math.sin(time * settings.cameraRotationSpeed) * radius;
        const targetY = height;
        
        // Smooth camera movement with reduced interpolation factor for stability
        camera.position.x += (targetX - camera.position.x) * 0.01;
        camera.position.y += (targetY - camera.position.y) * 0.01;
        camera.position.z += (targetZ - camera.position.z) * 0.01;
        
        // Look at the center with slight elevation
        camera.lookAt(0, height * 0.3, 0);
        
        // Update controls to match new camera position
        if (controlsRef.current) {
          controlsRef.current.update();
        }
      }
    }
  });

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[settings.cameraDistance, settings.cameraHeight, settings.cameraDistance]}
        fov={75}
      />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        target={[0, settings.cameraHeight * 0.3, 0]}
        maxPolarAngle={Math.PI / 1.5}
        minDistance={5}
        maxDistance={100}
        enabled={true}
        enableDamping={true}
        dampingFactor={0.05}
      />
    </>
  );
};