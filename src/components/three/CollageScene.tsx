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
  created_at?: string;
};

type CollageSceneProps = {
  photos: Photo[];
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
};

type PhotoWithPosition = Photo & {
  targetPosition: [number, number, number];
  targetRotation: [number, number, number];
  displayIndex?: number;
};

// Adjusted smoothing values for float pattern
const POSITION_SMOOTHING = 0.1;
const ROTATION_SMOOTHING = 0.1;
const TELEPORT_THRESHOLD = 30; // Distance threshold to detect teleportation

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
  
  const coneGeometry = useMemo(() => {
    const height = distance * 1.5;
    const radius = Math.tan(angle) * height;
    return new THREE.ConeGeometry(radius, height, 32, 1, true);
  }, [angle, distance]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(color) },
        intensity: { value: intensity * 0.0005 },
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
          float gradient = 1.0 - (vPosition.y + 0.5);
          gradient = pow(gradient, 2.0);
          
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
    
    meshRef.current.position.set(...position);
    
    const direction = new THREE.Vector3(...target).sub(new THREE.Vector3(...position));
    meshRef.current.lookAt(new THREE.Vector3(...position).add(direction));
    meshRef.current.rotateX(-Math.PI / 2);
  });

  return <mesh ref={meshRef} geometry={coneGeometry} material={material} />;
};

// SceneLighting component
const SceneLighting: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const groupRef = useRef<THREE.Group>(null);

  const spotlights = useMemo(() => {
    const lights = [];
    const count = Math.min(settings.spotlightCount, 4);
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * settings.spotlightDistance;
      const z = Math.sin(angle) * settings.spotlightDistance;
      
      lights.push({
        key: `spotlight-${i}`,
        position: [x, settings.spotlightHeight, z] as [number, number, number],
        target: [0, settings.wallHeight / 2, 0] as [number, number, number],
      });
    }
    return lights;
  }, [settings.spotlightCount, settings.spotlightDistance, settings.spotlightHeight, settings.wallHeight]);

  return (
    <group ref={groupRef}>
      <ambientLight intensity={settings.ambientLightIntensity} color="#ffffff" />
      <fog attach="fog" args={['#000000', 20, 300]} />
      
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
              intensity={settings.spotlightIntensity * 0.1}
              color={settings.spotlightColor}
              distance={settings.spotlightDistance * 2}
              decay={1}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-camera-near={0.5}
              shadow-camera-far={settings.spotlightDistance * 3}
              shadow-bias={-0.0001}
            />
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

// PhotoMesh component - Updated to handle teleportation for float pattern
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
  const isInitializedRef = useRef(false);
  const lastPositionRef = useRef<[number, number, number]>([0, 0, 0]);

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
      loadedTexture.generateMipmaps = false;
      setTexture(loadedTexture);
      setIsLoading(false);
    };

    const handleError = () => {
      setHasError(true);
      setIsLoading(false);
    };

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

  useFrame(() => {
    if (!meshRef.current) return;

    // Initialize position on first frame
    if (!isInitializedRef.current && photo.targetPosition) {
      meshRef.current.position.set(...photo.targetPosition);
      meshRef.current.rotation.set(...(photo.targetRotation || [0, 0, 0]));
      lastPositionRef.current = [...photo.targetPosition];
      isInitializedRef.current = true;
      return;
    }

    const currentPos = meshRef.current.position;
    const targetPos = photo.targetPosition;

    // Detect teleportation for float pattern
    if (pattern === 'float') {
      const yDistance = Math.abs(targetPos[1] - lastPositionRef.current[1]);
      
      // If the Y distance is too large, it's a teleport
      if (yDistance > TELEPORT_THRESHOLD) {
        // Instant teleport without interpolation
        meshRef.current.position.set(...targetPos);
        lastPositionRef.current = [...targetPos];
      } else {
        // Normal smooth interpolation
        meshRef.current.position.x += (targetPos[0] - currentPos.x) * POSITION_SMOOTHING;
        meshRef.current.position.y += (targetPos[1] - currentPos.y) * POSITION_SMOOTHING;
        meshRef.current.position.z += (targetPos[2] - currentPos.z) * POSITION_SMOOTHING;
        lastPositionRef.current = [
          meshRef.current.position.x,
          meshRef.current.position.y,
          meshRef.current.position.z
        ];
      }
    } else {
      // For other patterns, use normal interpolation
      meshRef.current.position.x += (targetPos[0] - currentPos.x) * POSITION_SMOOTHING;
      meshRef.current.position.y += (targetPos[1] - currentPos.y) * POSITION_SMOOTHING;
      meshRef.current.position.z += (targetPos[2] - currentPos.z) * POSITION_SMOOTHING;
    }

    // Handle rotation
    if (shouldFaceCamera) {
      const photoPos = meshRef.current.position;
      const cameraPos = camera.position;
      
      const directionX = cameraPos.x - photoPos.x;
      const directionZ = cameraPos.z - photoPos.z;
      
      const targetRotationY = Math.atan2(directionX, directionZ);
      
      const currentRotY = meshRef.current.rotation.y;
      let rotationDiff = targetRotationY - currentRotY;
      
      if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
      if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
      
      meshRef.current.rotation.y += rotationDiff * ROTATION_SMOOTHING;
      
      const patternRot = photo.targetRotation;
      meshRef.current.rotation.x += (patternRot[0] - meshRef.current.rotation.x) * ROTATION_SMOOTHING;
      meshRef.current.rotation.z += (patternRot[2] - meshRef.current.rotation.z) * ROTATION_SMOOTHING;
    } else {
      const targetRot = photo.targetRotation;
      meshRef.current.rotation.x += (targetRot[0] - meshRef.current.rotation.x) * ROTATION_SMOOTHING;
      meshRef.current.rotation.y += (targetRot[1] - meshRef.current.rotation.y) * ROTATION_SMOOTHING;
      meshRef.current.rotation.z += (targetRot[2] - meshRef.current.rotation.z) * ROTATION_SMOOTHING;
    }
  });

  const material = useMemo(() => {
    if (hasError) {
      return new THREE.MeshStandardMaterial({ 
        color: '#ff4444',
        transparent: false
      });
    }
    if (isLoading || !texture) {
      return new THREE.MeshStandardMaterial({ 
        color: emptySlotColor,
        transparent: false
      });
    }
    return new THREE.MeshStandardMaterial({ 
      map: texture,
      transparent: false
    });
  }, [texture, isLoading, hasError, emptySlotColor]);

  return (
    <mesh ref={meshRef} material={material} castShadow receiveShadow>
      <planeGeometry args={[size * (9/16), size]} />
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
    
    helper.position.y = 0.01;
    
    return helper;
  }, [settings.gridSize, settings.gridDivisions, settings.gridColor, settings.gridOpacity]);

  return <primitive object={gridHelper} />;
};

// CameraController component - Updated to persist camera position during auto-rotation
const CameraController: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>();
  const rotationTimeRef = useRef(0);
  const userInteractingRef = useRef(false);
  const lastInteractionTimeRef = useRef(0);
  
  // Initialize camera position
  useEffect(() => {
    if (camera && controlsRef.current) {
      const initialDistance = settings.cameraDistance;
      const initialHeight = settings.cameraHeight;
      const initialPosition = new THREE.Vector3(
        initialDistance,
        initialHeight,
        initialDistance
      );
      camera.position.copy(initialPosition);
      
      // Set target based on camera height
      const target = new THREE.Vector3(0, settings.cameraHeight * 0.3, 0);
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
  }, [camera, settings.cameraDistance, settings.cameraHeight]);

  useFrame((state, delta) => {
    if (!settings.cameraEnabled || !controlsRef.current) return;

    // Check if user is interacting
    const isInteracting = controlsRef.current.getAzimuthalAngle !== undefined && 
                        (controlsRef.current.getAzimuthalAngle() !== 0 || 
                         controlsRef.current.getPolarAngle() !== Math.PI / 2);
    
    if (isInteracting) {
      userInteractingRef.current = true;
      lastInteractionTimeRef.current = Date.now();
    } else if (Date.now() - lastInteractionTimeRef.current > 100) {
      userInteractingRef.current = false;
    }

    if (settings.cameraRotationEnabled && !userInteractingRef.current) {
      // Get current camera position relative to target
      const offset = new THREE.Vector3().copy(camera.position).sub(controlsRef.current.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      
      // Increment rotation
      rotationTimeRef.current += delta * settings.cameraRotationSpeed;
      
      // Apply rotation while maintaining current radius and polar angle
      spherical.theta += delta * settings.cameraRotationSpeed;
      
      // Convert back to cartesian coordinates
      const newPosition = new THREE.Vector3().setFromSpherical(spherical).add(controlsRef.current.target);
      camera.position.copy(newPosition);
    }

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
        enableZoom={true}
        enableRotate={true}
        target={[0, settings.cameraHeight * 0.3, 0]}
        maxPolarAngle={Math.PI / 1.5}
        minDistance={3}
        maxDistance={200}
        enableDamping={true}
        dampingFactor={0.05}
        zoomSpeed={1.0}
        rotateSpeed={0.5}
        panSpeed={0.8}
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

// AnimationController - Updated with new photo placement logic
const AnimationController: React.FC<{
  settings: SceneSettings;
  photos: Photo[];
  onPositionsUpdate: (photosWithPositions: PhotoWithPosition[]) => void;
}> = ({ settings, photos, onPositionsUpdate }) => {
  const [displayPhotos, setDisplayPhotos] = useState<Photo[]>([]);
  const [photoSlotMap, setPhotoSlotMap] = useState<Map<number, Photo>>(new Map());
  const cycleIndexRef = useRef(0);
  const lastCycleTimeRef = useRef(Date.now());
  const photoCycleInterval = 5000;
  const previousPhotosRef = useRef<Photo[]>([]);

  // Handle photo updates with random slot placement
  useEffect(() => {
    if (photos.length <= settings.photoCount) {
      // When we have fewer photos than slots
      const newPhotos = photos.filter(p => !previousPhotosRef.current.some(prev => prev.id === p.id));
      
      if (newPhotos.length > 0) {
        setPhotoSlotMap(prevMap => {
          const newMap = new Map(prevMap);
          
          // Remove photos that are no longer in the photos array
          for (const [slot, photo] of prevMap) {
            if (!photos.some(p => p.id === photo.id)) {
              newMap.delete(slot);
            }
          }
          
          // Add new photos to random empty slots
          for (const newPhoto of newPhotos) {
            // Find all empty slots
            const emptySlots: number[] = [];
            for (let i = 0; i < settings.photoCount; i++) {
              if (!newMap.has(i)) {
                emptySlots.push(i);
              }
            }
            
            if (emptySlots.length > 0) {
              // Choose a random empty slot
              const randomIndex = Math.floor(Math.random() * emptySlots.length);
              const chosenSlot = emptySlots[randomIndex];
              newMap.set(chosenSlot, newPhoto);
            }
          }
          
          return newMap;
        });
      } else {
        // Just update the map to reflect removed photos
        setPhotoSlotMap(prevMap => {
          const newMap = new Map(prevMap);
          for (const [slot, photo] of prevMap) {
            if (!photos.some(p => p.id === photo.id)) {
              newMap.delete(slot);
            }
          }
          return newMap;
        });
      }
      
      setDisplayPhotos(photos);
    } else {
      // When there are more photos than slots, prioritize newest
      const sortedPhotos = [...photos].sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      
      // Check if new photos were added
      const newPhotos = photos.filter(p => !previousPhotosRef.current.some(prev => prev.id === p.id));
      
      if (newPhotos.length > 0) {
        // Seamlessly integrate new photos
        setDisplayPhotos(prev => {
          const updated = [...prev];
          
          for (const newPhoto of newPhotos) {
            // Replace oldest photos with new ones
            const oldestIndex = updated.findIndex(p => 
              !newPhotos.some(np => np.id === p.id)
            );
            if (oldestIndex !== -1) {
              updated[oldestIndex] = newPhoto;
            }
          }
          
          return updated.slice(0, settings.photoCount);
        });
      } else {
        // No new photos, just ensure we have the right count
        setDisplayPhotos(sortedPhotos.slice(0, settings.photoCount));
      }
    }
    
    previousPhotosRef.current = photos;
  }, [photos, settings.photoCount]);

  useFrame((state) => {
    const currentTime = Date.now();
    
    // Handle photo cycling for excess photos
    if (photos.length > settings.photoCount && currentTime - lastCycleTimeRef.current > photoCycleInterval) {
      lastCycleTimeRef.current = currentTime;
      
      setDisplayPhotos(prev => {
        const newDisplay = [...prev];
        const slotToReplace = cycleIndexRef.current % settings.photoCount;
        cycleIndexRef.current++;
        
        // Find a photo that's not currently displayed
        const candidatePhotos = photos.filter(p => !newDisplay.some(d => d.id === p.id));
        if (candidatePhotos.length > 0) {
          const randomIndex = Math.floor(Math.random() * candidatePhotos.length);
          newDisplay[slotToReplace] = candidatePhotos[randomIndex];
        }
        
        return newDisplay;
      });
    }

    // Update positions based on current animation time
    const time = settings.animationEnabled ? state.clock.elapsedTime : 0;
    
    const pattern = PatternFactory.createPattern(settings.animationPattern, settings, displayPhotos);
    const patternState = pattern.generatePositions(time);
    
    const photosWithPositions: PhotoWithPosition[] = [];
    
    if (photos.length <= settings.photoCount) {
      // Use the slot map for positioning when we have fewer photos than slots
      for (let i = 0; i < settings.photoCount; i++) {
        const photo = photoSlotMap.get(i);
        if (photo) {
          photosWithPositions.push({
            ...photo,
            targetPosition: patternState.positions[i] || [0, 0, 0],
            targetRotation: patternState.rotations?.[i] || [0, 0, 0],
            displayIndex: i,
          });
        } else {
          // Add placeholder for empty slot
          photosWithPositions.push({
            id: `placeholder-${i}`,
            url: '',
            targetPosition: patternState.positions[i] || [0, 0, 0],
            targetRotation: patternState.rotations?.[i] || [0, 0, 0],
            displayIndex: i,
          });
        }
      }
    } else {
      // When cycling through more photos than slots
      for (let i = 0; i < displayPhotos.length && i < settings.photoCount; i++) {
        photosWithPositions.push({
          ...displayPhotos[i],
          targetPosition: patternState.positions[i] || [0, 0, 0],
          targetRotation: patternState.rotations?.[i] || [0, 0, 0],
          displayIndex: i,
        });
      }
      
      // Add placeholders for any remaining empty slots
      for (let i = displayPhotos.length; i < settings.photoCount; i++) {
        photosWithPositions.push({
          id: `placeholder-${i}`,
          url: '',
          targetPosition: patternState.positions[i] || [0, 0, 0],
          targetRotation: patternState.rotations?.[i] || [0, 0, 0],
          displayIndex: i,
        });
      }
    }
    
    onPositionsUpdate(photosWithPositions);
  });

  return null;
};

// BackgroundRenderer component
const BackgroundRenderer: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { scene, gl } = useThree();
  
  useEffect(() => {
    if (settings.backgroundGradient) {
      scene.background = null;
      gl.setClearColor('#000000', 0);
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
          alpha: true,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.shadowMap.autoUpdate = true;
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }}
        performance={{ min: 0.8 }}
      >
        <BackgroundRenderer settings={settings} />
        <CameraController settings={settings} />
        <SceneLighting settings={settings} />
        <Floor settings={settings} />
        <Grid settings={settings} />
        
        <AnimationController
          settings={settings}
          photos={photos}
          onPositionsUpdate={setPhotosWithPositions}
        />
        
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