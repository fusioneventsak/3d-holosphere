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

// VolumetricSpotlight component (as provided)
const VolumetricSpotlight: React.FC<{
  position: [number, number, number];
  target: [number, number, number];
  angle: number;
  color: string;
  intensity: number;
  distance: number;
}> = ({ position, target, angle, color, intensity, distance }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Calculate cone geometry based on spotlight parameters
  const coneGeometry = useMemo(() => {
    const height = distance * 1.5;
    const radius = Math.tan(angle) * height;
    return new THREE.ConeGeometry(radius, height, 32, 1, true);
  }, [angle, distance]);

  // Create volumetric material with transparency
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(color) },
        intensity: { value: intensity * 0.001 },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float intensity;
        varying vec3 vPosition;
        
        void main() {
          // Create gradient from tip to base
          float gradient = 1.0 - (vPosition.y + 0.5);
          gradient = pow(gradient, 2.0);
          
          // Create radial fade
          float radialFade = 1.0 - length(vPosition.xz) * 2.0;
          radialFade = clamp(radialFade, 0.0, 1.0);
          
          float alpha = gradient * radialFade * intensity;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [color, intensity]);

  useFrame(() => {
    if (!meshRef.current) return;
    
    // Position cone at spotlight position
    meshRef.current.position.set(...position);
    
    // Point cone towards target
    const direction = new THREE.Vector3(...target).sub(new THREE.Vector3(...position));
    meshRef.current.lookAt(new THREE.Vector3(...position).add(direction));
    meshRef.current.rotateX(-Math.PI / 2);
  });

  return <mesh ref={meshRef} geometry={coneGeometry} material={material} />;
};

// New SceneLighting component with volumetric spotlights (as provided)
const SceneLighting: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Create spotlights based on settings
  const spotlights = useMemo(() => {
    const lights = [];
    const count = Math.min(settings.spotlightCount, 4); // Max 4 spotlights
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * settings.spotlightDistance;
      const z = Math.sin(angle) * settings.spotlightDistance;
      
      lights.push({
        key: `spotlight-${i}`,
        position: [x, settings.spotlightHeight, z] as [number, number, number],
        target: [0, settings.wallHeight, 0] as [number, number, number],
      });
    }
    return lights;
  }, [settings.spotlightCount, settings.spotlightDistance, settings.spotlightHeight, settings.wallHeight]);

  return (
    <group ref={groupRef}>
      {/* Ambient light for general scene illumination */}
      <ambientLight intensity={settings.ambientLightIntensity} color="#ffffff" />
      
      {/* Fog for haze effect */}
      <fog attach="fog" args={['#000000', 10, 200]} />
      
      {/* Main directional light */}
      <directionalLight
        position={[20, 30, 20]}
        intensity={0.5}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0001}
      />
      
      {/* Spotlights with proper setup */}
      {spotlights.map((light) => (
        <group key={light.key}>
          <spotLight
            position={light.position}
            target-position={light.target}
            angle={settings.spotlightWidth}
            penumbra={settings.spotlightPenumbra}
            intensity={settings.spotlightIntensity * 0.02} // Increased intensity
            color={settings.spotlightColor}
            distance={settings.spotlightDistance * 2}
            decay={2}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-near={0.5}
            shadow-camera-far={settings.spotlightDistance * 3}
            shadow-bias={-0.0001}
          />
          {/* Volumetric cone for visible beam */}
          <VolumetricSpotlight
            position={light.position}
            target={light.target}
            angle={settings.spotlightWidth}
            color={settings.spotlightColor}
            intensity={settings.spotlightIntensity}
            distance={settings.spotlightDistance}
          />
        </group>
      ))}
    </group>
  );
};

// PhotoMesh component (unchanged from original)
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

// Floor component (unchanged)
const Floor: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  if (!settings.floorEnabled) return null;

  const floorMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: settings.floorColor,
      transparent: settings.floorOpacity < 1,
      opacity: settings.floorOpacity,
      metalness: settings.floorMetalness,
      roughness: settings.floorRoughness,
      side: THREE.DoubleSide,
    });
  }, [settings.floorColor, settings.floorOpacity, settings.floorMetalness, settings.floorRoughness]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={floorMaterial}>
      <planeGeometry args={[settings.floorSize, settings.floorSize]} />
    </mesh>
  );
};

// Grid component (unchanged)
const Grid: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  if (!settings.gridEnabled) return null;

  const gridHelper = useMemo(() => {
    const helper = new THREE.GridHelper(
      settings.gridSize,
      settings.gridDivisions,
      settings.gridColor,
      settings.gridColor
    );
    
    const material = helper.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.opacity = settings.gridOpacity;
    material.color = new THREE.Color(settings.gridColor);
    
    helper.position.y = 0.01; // Slightly above floor to prevent z-fighting
    
    return helper;
  }, [settings.gridSize, settings.gridDivisions, settings.gridColor, settings.gridOpacity]);

  return <primitive object={gridHelper} />;
};

// CameraController component (unchanged)
const CameraController: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>();
  const rotationTimeRef = useRef(0);
  const currentRadiusRef = useRef(settings.cameraDistance);

  // Update camera position when settings change
  useEffect(() => {
    if (camera && !settings.cameraRotationEnabled) {
      camera.position.set(
        settings.cameraDistance,
        settings.cameraHeight,
        settings.cameraDistance
      );
      camera.lookAt(0, settings.cameraHeight * 0.3, 0);
      currentRadiusRef.current = settings.cameraDistance;
    }
  }, [
    settings.cameraDistance,
    settings.cameraHeight,
    settings.cameraRotationEnabled,
    camera
  ]);

  useFrame((state, delta) => {
    if (!settings.cameraEnabled) return;

    // Update orbit controls target
    if (controlsRef.current) {
      controlsRef.current.target.set(0, settings.cameraHeight * 0.3, 0);
      controlsRef.current.update();
    }

    // Handle auto-rotation - runs continuously when enabled
    if (settings.cameraRotationEnabled) {
      // Always increment rotation time for continuous rotation
      rotationTimeRef.current += delta * settings.cameraRotationSpeed;
      
      // Calculate current distance from center (accounting for user zoom)
      const currentPos = camera.position;
      const centerTarget = new THREE.Vector3(0, settings.cameraHeight * 0.3, 0);
      const currentDistance = currentPos.distanceTo(centerTarget);
      
      // Update our tracked radius to match current zoom level
      currentRadiusRef.current = currentDistance;
      
      const height = settings.cameraHeight;
      
      // Calculate the auto-rotation target position using current zoom distance
      const autoRotationX = Math.cos(rotationTimeRef.current) * currentRadiusRef.current;
      const autoRotationZ = Math.sin(rotationTimeRef.current) * currentRadiusRef.current;
      
      // Apply auto-rotation as a gentle influence on the camera position
      // This allows manual control while maintaining the rotation
      const influenceStrength = 0.015; // How strong the auto-rotation influence is
      
      camera.position.x += (autoRotationX - camera.position.x) * influenceStrength;
      camera.position.y += (height - camera.position.y) * influenceStrength;
      camera.position.z += (autoRotationZ - camera.position.z) * influenceStrength;
      
      // Maintain the look-at behavior
      camera.lookAt(0, height * 0.3, 0);
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
        enableDamping={true}
        dampingFactor={0.05}
      />
    </>
  );
};

// AnimationController component (unchanged)
const AnimationController: React.FC<{
  settings: SceneSettings;
  photos: Photo[];
  onPositionsUpdate: (photosWithPositions: PhotoWithPosition[]) => void;
}> = ({ settings, photos, onPositionsUpdate }) => {
  useFrame((state) => {
    // Always update positions, but only use time for animation if enabled
    const time = settings.animationEnabled ? state.clock.elapsedTime : 0;
    
    // Create pattern and generate positions
    const pattern = PatternFactory.createPattern(settings.animationPattern, settings, photos);
    const patternState = pattern.generatePositions(time);
    
    // Create array with the correct number of photos based on settings
    const photosToShow = photos.slice(0, settings.photoCount);
    const photosWithPositions: PhotoWithPosition[] = [];
    
    // Fill with actual photos first
    for (let i = 0; i < photosToShow.length; i++) {
      photosWithPositions.push({
        ...photosToShow[i],
        targetPosition: patternState.positions[i] || [0, 0, 0],
        targetRotation: patternState.rotations?.[i] || [0, 0, 0],
      });
    }
    
    // Fill remaining slots with placeholder photos if we need more
    for (let i = photosToShow.length; i < settings.photoCount; i++) {
      photosWithPositions.push({
        id: `placeholder-${i}`,
        url: '', // Empty URL will show as colored placeholder
        targetPosition: patternState.positions[i] || [0, 0, 0],
        targetRotation: patternState.rotations?.[i] || [0, 0, 0],
      });
    }

    onPositionsUpdate(photosWithPositions);
  });

  return null;
};

// BackgroundRenderer component (unchanged)
const BackgroundRenderer: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { scene, gl } = useThree();
  
  useEffect(() => {
    // Always set scene background to null when using gradients
    // This prevents Three.js from overriding the CSS background
    if (settings.backgroundGradient) {
      scene.background = null;
      gl.setClearColor('#000000', 0); // Transparent clear color
    } else {
      scene.background = new THREE.Color(settings.backgroundColor);
      gl.setClearColor(settings.backgroundColor, 1);
    }
  }, [
    scene, 
    gl, 
    settings.backgroundColor, 
    settings.backgroundGradient,
    settings.backgroundGradientStart,
    settings.backgroundGradientEnd,
    settings.backgroundGradientAngle
  ]);

  return null;
};

// Main CollageScene component
const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
  const [photosWithPositions, setPhotosWithPositions] = useState<PhotoWithPosition[]>([]);

  // Create initial pattern positions for photos
  const initialPhotosWithPositions = useMemo(() => {
    const pattern = PatternFactory.createPattern(settings.animationPattern, settings, photos);
    const patternState = pattern.generatePositions(0); // Start at time 0
    
    const photosToShow = photos.slice(0, settings.photoCount);
    const result: PhotoWithPosition[] = [];
    
    // Fill with actual photos first
    for (let i = 0; i < photosToShow.length; i++) {
      result.push({
        ...photosToShow[i],
        targetPosition: patternState.positions[i] || [0, 0, 0] as [number, number, number],
        targetRotation: patternState.rotations?.[i] || [0, 0, 0] as [number, number, number],
      });
    }
    
    // Fill remaining slots with placeholder photos if we need more
    for (let i = photosToShow.length; i < settings.photoCount; i++) {
      result.push({
        id: `placeholder-${i}`,
        url: '', // Empty URL will show as colored placeholder
        targetPosition: patternState.positions[i] || [0, 0, 0] as [number, number, number],
        targetRotation: patternState.rotations?.[i] || [0, 0, 0] as [number, number, number],
      });
    }
    
    return result;
  }, [photos, settings.animationPattern, settings.photoCount]);

  // Update photos with positions when initial data changes
  useEffect(() => {
    setPhotosWithPositions(initialPhotosWithPositions);
  }, [initialPhotosWithPositions]);

  // Create background style for gradient support
  const backgroundStyle = useMemo(() => {
    if (settings.backgroundGradient) {
      return {
        background: `linear-gradient(${settings.backgroundGradientAngle}deg, ${settings.backgroundGradientStart}, ${settings.backgroundGradientEnd})`
      };
    }
    return {
      background: settings.backgroundColor
    };
  }, [
    settings.backgroundGradient,
    settings.backgroundColor,
    settings.backgroundGradientStart,
    settings.backgroundGradientEnd,
    settings.backgroundGradientAngle
  ]);

  return (
    <div style={backgroundStyle} className="w-full h-full">
      <Canvas 
        shadows
        gl={{ 
          antialias: true, 
          alpha: true, // Always enable alpha for transparency
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.shadowMap.autoUpdate = true;
          // Don't set clear color here - let BackgroundRenderer handle it
        }}
      >
        <BackgroundRenderer settings={settings} />
        <CameraController settings={settings} />
        <SceneLighting settings={settings} /> {/* Using the new SceneLighting with volumetric effects */}
        <Floor settings={settings} />
        <Grid settings={settings} />
        
        {/* Animation controller for dynamic updates */}
        <AnimationController
          settings={settings}
          photos={photos}
          onPositionsUpdate={setPhotosWithPositions}
        />
        
        {/* Render photos */}
        {photosWithPositions.map((photo) => (
          <PhotoMesh
            key={photo.id}
            photo={photo}
            size={settings.photoSize}
            emptySlotColor={settings.emptySlotColor}
            pattern={settings.animationPattern}
            shouldFaceCamera={settings.photoRotation}
          />
        ))}
      </Canvas>
    </div>
  );
};

export default CollageScene;