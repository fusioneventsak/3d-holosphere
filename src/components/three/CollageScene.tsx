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

// Camera icon shape creation function
const createCameraIconGeometry = (size: number) => {
  const shape = new THREE.Shape();
  const scale = size * 0.3; // Scale the icon to 30% of photo size
  
  // Camera body (rectangle)
  const bodyWidth = scale * 0.6;
  const bodyHeight = scale * 0.4;
  const bodyX = -bodyWidth / 2;
  const bodyY = -bodyHeight / 2;
  
  shape.moveTo(bodyX, bodyY);
  shape.lineTo(bodyX + bodyWidth, bodyY);
  shape.lineTo(bodyX + bodyWidth, bodyY + bodyHeight);
  shape.lineTo(bodyX, bodyY + bodyHeight);
  shape.closePath();
  
  // Lens (circle in center)
  const lensRadius = scale * 0.15;
  const lensX = 0;
  const lensY = 0;
  shape.moveTo(lensX + lensRadius, lensY);
  shape.absarc(lensX, lensY, lensRadius, 0, Math.PI * 2, false);
  
  // Viewfinder (small rectangle on top)
  const viewfinderWidth = scale * 0.15;
  const viewfinderHeight = scale * 0.08;
  const viewfinderX = -viewfinderWidth / 2;
  const viewfinderY = bodyY + bodyHeight;
  
  shape.moveTo(viewfinderX, viewfinderY);
  shape.lineTo(viewfinderX + viewfinderWidth, viewfinderY);
  shape.lineTo(viewfinderX + viewfinderWidth, viewfinderY + viewfinderHeight);
  shape.lineTo(viewfinderX, viewfinderY + viewfinderHeight);
  shape.closePath();
  
  // Flash (small rectangle on the side)
  const flashWidth = scale * 0.06;
  const flashHeight = scale * 0.1;
  const flashX = bodyX + bodyWidth;
  const flashY = bodyY + bodyHeight - flashHeight - scale * 0.05;
  
  shape.moveTo(flashX, flashY);
  shape.lineTo(flashX + flashWidth, flashY);
  shape.lineTo(flashX + flashWidth, flashY + flashHeight);
  shape.lineTo(flashX, flashY + flashHeight);
  shape.closePath();
  
  return new THREE.ShapeGeometry(shape);
};

// PhotoMesh component with brightness control and camera icon for empty slots
const PhotoMesh: React.FC<{
  photo: PhotoWithPosition;
  size: number;
  emptySlotColor: string;
  pattern: string;
  shouldFaceCamera: boolean;
  brightness: number;
}> = ({ photo, size, emptySlotColor, pattern, shouldFaceCamera, brightness }) => {
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

  // Materials with brightness control
  const materials = useMemo(() => {
    const clampedBrightness = Math.max(0.1, Math.min(3, brightness));
    
    if (hasError) {
      return {
        photo: new THREE.MeshStandardMaterial({ 
          color: new THREE.Color('#ff4444'),
          transparent: false,
          roughness: 0.4,
          metalness: 0.0,
          emissive: new THREE.Color('#400000'),
          emissiveIntensity: 0.1
        })
      };
    }
    
    if (isLoading || !texture) {
      // Create materials for empty slot
      const slotColor = new THREE.Color(emptySlotColor);
      const hsl = { h: 0, s: 0, l: 0 };
      slotColor.getHSL(hsl);
      
      // Create a lighter shade for the icon (20% lighter)
      const iconColor = new THREE.Color();
      iconColor.setHSL(hsl.h, hsl.s * 0.7, Math.min(hsl.l + 0.2, 0.8));

      return {
        slot: new THREE.MeshStandardMaterial({
          color: slotColor,
          transparent: false,
          roughness: 0.9,
          metalness: 0.1,
          side: THREE.DoubleSide
        }),
        icon: new THREE.MeshStandardMaterial({
          color: iconColor,
          transparent: true,
          opacity: 0.3,
          roughness: 0.9,
          metalness: 0.1,
          side: THREE.DoubleSide
        })
      };
    }
    
    // Create a material optimized for photo display
    return {
      photo: new THREE.MeshStandardMaterial({ 
        map: texture,
        transparent: true,
        roughness: 0,
        metalness: 0,
        emissive: new THREE.Color(1, 1, 1),
        emissiveMap: texture,
        emissiveIntensity: clampedBrightness,
        toneMapped: false
      })
    };
  }, [texture, isLoading, hasError, emptySlotColor, brightness]);

  // Create camera icon geometry
  const cameraIconGeometry = useMemo(() => {
    return createCameraIconGeometry(size);
  }, [size]);

  if (isLoading || !texture) {
    // Render empty slot with camera icon
    return (
      <group ref={meshRef} castShadow receiveShadow>
        {/* Background slot */}
        <mesh material={materials.slot}>
          <planeGeometry args={[size * (9/16), size]} />
        </mesh>
        {/* Camera icon */}
        <mesh 
          material={materials.icon} 
          geometry={cameraIconGeometry}
          position={[0, 0, 0.01]}
        />
      </group>
    );
  }

  // Render photo
  return (
    <mesh ref={meshRef} castShadow receiveShadow material={materials.photo}>
      <planeGeometry args={[size * (9/16), size]} />
    </mesh>
  );
};

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
          toneMapping: THREE.NoToneMapping, // Disable tone mapping globally
          outputColorSpace: THREE.LinearSRGBColorSpace // Use linear color space for better color accuracy
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