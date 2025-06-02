import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
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
  displayIndex?: number; // Track which slot this photo is displayed in
};

// Improve smoothing values for better animation
const POSITION_SMOOTHING = 0.1;
const ROTATION_SMOOTHING = 0.1;

// VolumetricSpotlight component with adjusted intensity
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

  // Create volumetric material with transparency, reduced intensity for subtler effect
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(color) },
        intensity: { value: intensity * 0.0005 }, // Reduced from 0.001 to make volumetric effect subtler
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

// SceneLighting component with enhanced light casting
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
        target: [0, settings.wallHeight / 2, 0] as [number, number, number], // Adjusted to hit photos/floor
      });
    }
    return lights;
  }, [settings.spotlightCount, settings.spotlightDistance, settings.spotlightHeight, settings.wallHeight]);

  return (
    <group ref={groupRef}>
      {/* Ambient light for general scene illumination */}
      <ambientLight intensity={settings.ambientLightIntensity} color="#ffffff" />
      
      {/* Fog adjusted for better light visibility */}
      <fog attach="fog" args={['#000000', 20, 300]} /> {/* Increased near/far for less haze */}
      
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
      
      {/* Spotlights with proper setup and increased intensity */}
      {spotlights.map((light) => {
        const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());
        targetRef.current.position.set(...light.target);
        
        return (
          <group key={light.key}>
            <spotLight
              position={light.position}
              target={targetRef.current}
              angle={settings.spotlightWidth}
              penumbra={settings.spotlightPenumbra}
              intensity={settings.spotlightIntensity * 0.1} // Increased from 0.02 for stronger light
              color={settings.spotlightColor} // Ensure color affects scene
              distance={settings.spotlightDistance * 2}
              decay={1} // Reduced decay for stronger light reach
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
            <primitive object={targetRef.current} />
          </group>
        );
      })}
    </group>
  );
};

// PhotoMesh component with optimized loading
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

  // Load texture with improved caching and error handling
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
      loadedTexture.generateMipmaps = false; // Optimize for performance
      setTexture(loadedTexture);
      setIsLoading(false);
    };

    const handleError = () => {
      setHasError(true);
      setIsLoading(false);
    };

    // Add cache-busting but with a longer cache duration for better performance
    const imageUrl = photo.url.includes('?') 
      ? photo.url 
      : addCacheBustToUrl(photo.url);

    loader.load(imageUrl, handleLoad, undefined, handleError);

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

  // Create material based on state with optimized settings - REMOVED TRANSPARENCY FROM EMPTY SLOTS
  const material = useMemo(() => {
    if (hasError) {
      return new THREE.MeshStandardMaterial({ 
        color: '#ff4444',
        transparent: false // Removed transparency
      });
    }
    if (isLoading || !texture) {
      return new THREE.MeshStandardMaterial({ 
        color: emptySlotColor,
        transparent: false // Removed transparency - empty slots are now solid
      });
    }
    return new THREE.MeshStandardMaterial({ 
      map: texture,
      transparent: false
    });
  }, [texture, isLoading, hasError, emptySlotColor]);

  return (
    <mesh ref={meshRef} material={material} castShadow receiveShadow position={photo.targetPosition}>
      <planeGeometry args={[size * (9/16), size]} /> {/* Portrait orientation */}
    </mesh>
  );
};

// Floor component
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

// Grid component
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

// Improved CameraController with persistent position and better zoom handling
const CameraController: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>();
  const rotationTimeRef = useRef(0);
  
  // Store camera state persistently
  const cameraStateRef = useRef({
    position: new THREE.Vector3(settings.cameraDistance, settings.cameraHeight, settings.cameraDistance),
    target: new THREE.Vector3(0, settings.cameraHeight * 0.3, 0),
    distance: settings.cameraDistance,
    spherical: new THREE.Spherical(settings.cameraDistance, Math.PI / 3, Math.PI / 4)
  });

  // Initialize camera position only once
  useEffect(() => {
    if (camera && controlsRef.current) {
      // Set initial position from stored state
      camera.position.copy(cameraStateRef.current.position);
      controlsRef.current.target.copy(cameraStateRef.current.target);
      controlsRef.current.update();
    }
  }, [camera]);

  // Update target height when settings change, but preserve position
  useEffect(() => {
    if (controlsRef.current) {
      const newTarget = new THREE.Vector3(0, settings.cameraHeight * 0.3, 0);
      cameraStateRef.current.target.copy(newTarget);
      controlsRef.current.target.copy(newTarget);
      controlsRef.current.update();
    }
  }, [settings.cameraHeight]);

  useFrame((state, delta) => {
    if (!settings.cameraEnabled || !controlsRef.current) return;

    // Store current camera state for persistence
    cameraStateRef.current.position.copy(camera.position);
    cameraStateRef.current.target.copy(controlsRef.current.target);
    
    // Calculate current distance from target
    const currentDistance = camera.position.distanceTo(controlsRef.current.target);
    cameraStateRef.current.distance = currentDistance;

    // Handle auto-rotation if enabled
    if (settings.cameraRotationEnabled) {
      // Increment rotation time continuously
      rotationTimeRef.current += delta * settings.cameraRotationSpeed;
      
      // Get current spherical coordinates relative to target
      const offset = new THREE.Vector3().copy(camera.position).sub(controlsRef.current.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      
      // Apply auto-rotation to the azimuth angle only
      spherical.theta = rotationTimeRef.current;
      
      // Keep current distance (zoom level) and polar angle
      spherical.radius = currentDistance;
      // Don't modify spherical.phi (polar angle) to preserve user's vertical position
      
      // Convert back to position
      const newPosition = new THREE.Vector3().setFromSpherical(spherical).add(controlsRef.current.target);
      
      // Smoothly interpolate to auto-rotation position
      const autoRotationInfluence = 0.02; // How strongly auto-rotation affects manual control
      camera.position.lerp(newPosition, autoRotationInfluence);
      
      // Store updated spherical coordinates
      cameraStateRef.current.spherical = spherical;
    }

    // Always update controls
    controlsRef.current.update();
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
        enableZoom={true} // Always allow zoom
        enableRotate={true}
        target={[0, settings.cameraHeight * 0.3, 0]}
        maxPolarAngle={Math.PI / 1.5}
        minDistance={3} // Reduced minimum distance for closer inspection
        maxDistance={200} // Increased maximum distance for wide views
        enableDamping={true}
        dampingFactor={0.05}
        zoomSpeed={1.0} // Normal zoom speed
        rotateSpeed={0.5} // Slightly slower rotation for better control
        panSpeed={0.8}
        // Ensure mouse wheel always controls zoom
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        }}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN
        }}
      />
    </>
  );
};

// PhotoCycler component to handle photo cycling when slots are full
const PhotoCycler: React.FC<{
  photos: Photo[];
  slots: number;
  cycleInterval?: number;
}> = ({ photos, slots, cycleInterval = 5000 }) => {
  const [displayPhotos, setDisplayPhotos] = useState<Photo[]>([]);
  const cycleIndexRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    if (photos.length <= slots) {
      // If we have fewer photos than slots, just display all photos
      setDisplayPhotos(photos);
      return;
    }

    // Initialize display with newest photos first
    const sortedPhotos = [...photos].sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    
    // Take the newest photos to fill all slots
    setDisplayPhotos(sortedPhotos.slice(0, slots));

    // Set up cycling interval
    const interval = setInterval(() => {
      setDisplayPhotos(prev => {
        const currentTime = Date.now();
        
        // Don't cycle if we just updated (prevents rapid cycling on new photo uploads)
        if (currentTime - lastUpdateRef.current < 1000) {
          return prev;
        }

        // Create a new display array by cycling through all photos
        const newDisplay = [...prev];
        
        // Replace the oldest displayed photo with the next one in the cycle
        const oldestIndex = 0; // Always replace the first slot for consistent cycling
        cycleIndexRef.current = (cycleIndexRef.current + 1) % photos.length;
        
        // Find a photo that's not currently displayed
        let attempts = 0;
        while (attempts < photos.length) {
          const candidatePhoto = photos[cycleIndexRef.current];
          if (!newDisplay.some(p => p.id === candidatePhoto.id)) {
            newDisplay[oldestIndex] = candidatePhoto;
            break;
          }
          cycleIndexRef.current = (cycleIndexRef.current + 1) % photos.length;
          attempts++;
        }
        
        lastUpdateRef.current = currentTime;
        return newDisplay;
      });
    }, cycleInterval);

    return () => clearInterval(interval);
  }, [photos, slots, cycleInterval]);

  // When new photos are added, prioritize showing them
  useEffect(() => {
    if (photos.length > displayPhotos.length && photos.length > slots) {
      const sortedPhotos = [...photos].sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      
      // Show the newest photos
      setDisplayPhotos(sortedPhotos.slice(0, slots));
      lastUpdateRef.current = Date.now();
    }
  }, [photos.length]);

  return <>{displayPhotos}</>;
};

// Optimized AnimationController with stable photo management
const AnimationController: React.FC<{
  settings: SceneSettings;
  photos: Photo[];
  onPositionsUpdate: (photosWithPositions: PhotoWithPosition[]) => void;
}> = ({ settings, photos, onPositionsUpdate }) => {
  const [displayPhotos, setDisplayPhotos] = useState<Photo[]>([]);
  const cycleIndexRef = useRef(0);
  const lastCycleTimeRef = useRef(Date.now());
  const photoCycleInterval = 5000; // 5 seconds per cycle

  // Update display photos based on available photos and slots
  useEffect(() => {
    if (photos.length <= settings.photoCount) {
      // If we have fewer photos than slots, just display all photos
      setDisplayPhotos(photos);
    } else {
      // If we have more photos than slots, prioritize newest ones initially
      const sortedPhotos = [...photos].sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setDisplayPhotos(sortedPhotos.slice(0, settings.photoCount));
    }
  }, [photos, settings.photoCount]);

  useFrame((state) => {
    const currentTime = Date.now();
    
    // Handle photo cycling if we have more photos than slots
    if (photos.length > settings.photoCount && currentTime - lastCycleTimeRef.current > photoCycleInterval) {
      lastCycleTimeRef.current = currentTime;
      
      // Cycle through photos
      setDisplayPhotos(prev => {
        const newDisplay = [...prev];
        
        // Replace one photo at a time for smooth transitions
        const slotToReplace = cycleIndexRef.current % settings.photoCount;
        cycleIndexRef.current++;
        
        // Find next photo that's not currently displayed
        let nextPhotoIndex = cycleIndexRef.current % photos.length;
        let attempts = 0;
        
        while (attempts < photos.length) {
          const candidatePhoto = photos[nextPhotoIndex];
          if (!newDisplay.some(p => p.id === candidatePhoto.id)) {
            newDisplay[slotToReplace] = candidatePhoto;
            break;
          }
          nextPhotoIndex = (nextPhotoIndex + 1) % photos.length;
          attempts++;
        }
        
        return newDisplay;
      });
    }

    // Always update positions
    const time = settings.animationEnabled ? state.clock.elapsedTime : 0;
    
    // Create pattern and generate positions
    const pattern = PatternFactory.createPattern(settings.animationPattern, settings, displayPhotos);
    const patternState = pattern.generatePositions(time);
    
    // Create photos with positions array
    const photosWithPositions: PhotoWithPosition[] = [];
    
    // Fill with actual display photos first
    for (let i = 0; i < displayPhotos.length && i < settings.photoCount; i++) {
      photosWithPositions.push({
        ...displayPhotos[i],
        targetPosition: patternState.positions[i] || [0, 0, 0],
        targetRotation: patternState.rotations?.[i] || [0, 0, 0],
        displayIndex: i,
      });
    }
    
    // Fill remaining slots with placeholder photos if needed
    for (let i = displayPhotos.length; i < settings.photoCount; i++) {
      photosWithPositions.push({
        id: `placeholder-${i}`,
        url: '', // Empty URL will show as colored placeholder
        targetPosition: patternState.positions[i] || [0, 0, 0],
        targetRotation: patternState.rotations?.[i] || [0, 0, 0],
        displayIndex: i,
      });
    }
    
    onPositionsUpdate(photosWithPositions);
  });

  return null;
};

// BackgroundRenderer component
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

// Main CollageScene component with optimized photo handling
const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
  const [photosWithPositions, setPhotosWithPositions] = useState<PhotoWithPosition[]>([]);

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
          powerPreference: "high-performance", // Optimize for performance
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.shadowMap.autoUpdate = true;
          // Enable optimizations
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
        }}
        performance={{ min: 0.8 }} // Lower performance threshold to maintain 60fps
      >
        <BackgroundRenderer settings={settings} />
        <CameraController settings={settings} />
        <SceneLighting settings={settings} />
        <Floor settings={settings} />
        <Grid settings={settings} />
        
        {/* Animation controller for dynamic updates */}
        <AnimationController
          settings={settings}
          photos={photos}
          onPositionsUpdate={setPhotosWithPositions}
        />
        
        {/* Render photos with stable keys */}
        {photosWithPositions.map((photo) => (
          <PhotoMesh
            key={`${photo.id}-${photo.displayIndex}`} // Use displayIndex for stable keys
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