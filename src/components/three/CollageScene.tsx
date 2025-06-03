import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';
import { PatternFactory } from './patterns/PatternFactory';
import { addCacheBustToUrl } from '../../lib/supabase';
import SceneCamera from './SceneCamera';
import SceneLighting from './SceneLighting';
import SceneBackground from './SceneBackground';
import { Floor, Grid } from './SceneEnvironment';

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

// Create a static camera icon texture that's reused across all instances
const staticCameraIconTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Clear canvas
    ctx.clearRect(0, 0, 256, 256);
    
    // Set up styles with fixed color
    const iconColor = '#888888';
    ctx.fillStyle = iconColor;
    ctx.strokeStyle = iconColor;
    ctx.lineWidth = 8;
    
    // Draw camera body
    const bodyWidth = 140;
    const bodyHeight = 100;
    const bodyX = (256 - bodyWidth) / 2;
    const bodyY = (256 - bodyHeight) / 2 + 20;
    ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
    
    // Draw lens
    const lensRadius = 35;
    const lensX = 128;
    const lensY = bodyY + bodyHeight / 2;
    ctx.beginPath();
    ctx.arc(lensX, lensY, lensRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw lens inner circle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(lensX, lensY, lensRadius - 10, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw viewfinder
    ctx.fillStyle = iconColor;
    const viewfinderWidth = 40;
    const viewfinderHeight = 20;
    const viewfinderX = (256 - viewfinderWidth) / 2;
    const viewfinderY = bodyY - viewfinderHeight + 5;
    ctx.fillRect(viewfinderX, viewfinderY, viewfinderWidth, viewfinderHeight);
    
    // Draw flash
    const flashWidth = 30;
    const flashHeight = 15;
    const flashX = bodyX + bodyWidth - flashWidth - 10;
    const flashY = bodyY + 10;
    ctx.fillRect(flashX, flashY, flashWidth, flashHeight);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.format = THREE.RGBAFormat;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
})();

// Optimized Camera Icon Component
const CameraIcon = React.memo<{ size: number }>(({ size }) => {
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null);

  if (!materialRef.current) {
    materialRef.current = new THREE.MeshBasicMaterial({
      map: staticCameraIconTexture,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true
    });
  }

  return (
    <mesh>
      <planeGeometry args={[size * 0.4, size * 0.4]} />
      <primitive object={materialRef.current} attach="material" />
    </mesh>
  );
}, () => true); // Prevent all re-renders

// PhotoMesh component with brightness control
const PhotoMesh = React.memo<{
  photo: PhotoWithPosition;
  size: number;
  emptySlotColor: string;
  pattern: string;
  shouldFaceCamera: boolean;
  brightness: number;
}>(({ photo, size, emptySlotColor, pattern, shouldFaceCamera, brightness }) => {
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
      console.error('Failed to load image:', photo.url);
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

  // Materials with brightness control
  const material = useMemo(() => {
    const clampedBrightness = Math.max(0.1, Math.min(3, brightness));
    
    if (hasError) {
      return new THREE.MeshStandardMaterial({ 
        color: new THREE.Color('#ff4444'),
        transparent: false,
        roughness: 0.4,
        metalness: 0.0,
        emissive: new THREE.Color('#400000'),
        emissiveIntensity: 0.1
      });
    }
    
    if (isLoading || !texture) {
      // Simple empty slot material
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(emptySlotColor),
        transparent: false,
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide
      });
    }
    
    // Photo material with brightness control
    return new THREE.MeshStandardMaterial({ 
      map: texture,
      transparent: true,
      roughness: 0,
      metalness: 0,
      emissive: new THREE.Color(1, 1, 1),
      emissiveMap: texture,
      emissiveIntensity: clampedBrightness,
      toneMapped: false,
      side: THREE.DoubleSide
    });
  }, [texture, isLoading, hasError, emptySlotColor, brightness]);

  const isEmptySlot = !photo.url || isLoading || hasError;

  return (
    <group ref={meshRef} matrixAutoUpdate={true}>
      <mesh castShadow receiveShadow material={material}>
        <planeGeometry args={[size * (9/16), size]} />
      </mesh>
      {isEmptySlot && !hasError && (
        <CameraIcon size={size} />
      )}
    </group>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.photo.id === nextProps.photo.id &&
    prevProps.size === nextProps.size &&
    prevProps.pattern === nextProps.pattern &&
    prevProps.shouldFaceCamera === nextProps.shouldFaceCamera &&
    prevProps.brightness === nextProps.brightness
  );
});

// AnimationController - handles photo positioning
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
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.LinearSRGBColorSpace
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.shadowMap.autoUpdate = true;
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }}
        performance={{ min: 0.8 }}
        linear={true}
      >
        <SceneBackground settings={settings} />
        <SceneCamera settings={settings} />
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
            brightness={settings.photoBrightness}
          />
        ))}
      </Canvas>
    </div>
  );
};

export default CollageScene;