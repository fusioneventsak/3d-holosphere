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
  slotIndex: number;
};

// Adjusted smoothing values for float pattern
const POSITION_SMOOTHING = 0.1;
const ROTATION_SMOOTHING = 0.1;
const TELEPORT_THRESHOLD = 30;

// FIXED: Enhanced SlotManager with immediate cleanup and better tracking
class SlotManager {
  private slotAssignments = new Map<string, number>();
  private occupiedSlots = new Set<number>();
  private availableSlots: number[] = [];
  private totalSlots = 0;
  private lastPhotoIds: Set<string> = new Set(); // Track previous photo IDs

  constructor(totalSlots: number) {
    this.updateSlotCount(totalSlots);
  }

  updateSlotCount(newTotal: number) {
    if (newTotal === this.totalSlots) return;
    
    this.totalSlots = newTotal;
    
    // Clear slots that are beyond the new limit
    for (const [photoId, slotIndex] of this.slotAssignments.entries()) {
      if (slotIndex >= newTotal) {
        this.slotAssignments.delete(photoId);
        this.occupiedSlots.delete(slotIndex);
      }
    }
    
    this.rebuildAvailableSlots();
  }

  private rebuildAvailableSlots() {
    this.availableSlots = [];
    for (let i = 0; i < this.totalSlots; i++) {
      if (!this.occupiedSlots.has(i)) {
        this.availableSlots.push(i);
      }
    }
    this.shuffleArray(this.availableSlots);
  }

  private shuffleArray(array: number[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // FIXED: Immediate cleanup of deleted photos with logging
  assignSlots(photos: Photo[]): Map<string, number> {
    const currentPhotoIds = new Set(photos.map(p => p.id));
    
    // CRITICAL: Detect and log deleted photos
    const deletedPhotos = Array.from(this.lastPhotoIds).filter(id => !currentPhotoIds.has(id));
    if (deletedPhotos.length > 0) {
      console.log('🎬 SLOT MANAGER: Detected deleted photos:', deletedPhotos);
      
      // Immediately remove assignments for deleted photos
      for (const deletedId of deletedPhotos) {
        const slotIndex = this.slotAssignments.get(deletedId);
        if (slotIndex !== undefined) {
          console.log(`🎬 SLOT MANAGER: Removing slot ${slotIndex} for deleted photo ${deletedId.slice(-4)}`);
          this.slotAssignments.delete(deletedId);
          this.occupiedSlots.delete(slotIndex);
        }
      }
    }

    // Update last known photo IDs
    this.lastPhotoIds = new Set(currentPhotoIds);

    // Remove assignments for photos that no longer exist (redundant safety check)
    for (const [photoId, slotIndex] of this.slotAssignments.entries()) {
      if (!currentPhotoIds.has(photoId)) {
        console.log(`🎬 SLOT MANAGER: Safety cleanup - removing ${photoId.slice(-4)}`);
        this.slotAssignments.delete(photoId);
        this.occupiedSlots.delete(slotIndex);
      }
    }

    // Rebuild available slots after cleanup
    this.rebuildAvailableSlots();

    // Assign slots to new photos in order of creation
    const sortedPhotos = [...photos].sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return a.id.localeCompare(b.id);
    });

    // Assign slots to photos that don't have one
    for (const photo of sortedPhotos) {
      if (!this.slotAssignments.has(photo.id) && this.availableSlots.length > 0) {
        const slotIndex = this.availableSlots.shift()!;
        console.log(`🎬 SLOT MANAGER: Assigning slot ${slotIndex} to photo ${photo.id.slice(-4)}`);
        this.slotAssignments.set(photo.id, slotIndex);
        this.occupiedSlots.add(slotIndex);
      }
    }

    console.log(`🎬 SLOT MANAGER: Final assignments - ${this.slotAssignments.size} photos, ${this.availableSlots.length} available slots`);
    return new Map(this.slotAssignments);
  }

  // ADDED: Force cleanup method for debugging
  forceCleanup() {
    console.log('🎬 SLOT MANAGER: Force cleanup triggered');
    this.slotAssignments.clear();
    this.occupiedSlots.clear();
    this.lastPhotoIds.clear();
    this.rebuildAvailableSlots();
  }
}

// VolumetricSpotlight component (unchanged)
const VolumetricSpotlight: React.FC<{
  position: [number, number, number];
  target: [number, number, number];
  angle: number;
  color: string;
  intensity: number;
  distance: number;
  penumbra: number;
}> = ({ position, target, angle, color, intensity, distance, penumbra }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const coneGeometry = useMemo(() => {
    const height = distance * 1.5;
    const radius = Math.tan(angle) * height;
    return new THREE.ConeGeometry(radius, height, 32, 1, true);
  }, [angle, distance]);

  const material = useMemo(() => {
    const scaledIntensity = intensity * 0.0002;
    
    return new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(color) },
        intensity: { value: scaledIntensity },
        penumbra: { value: penumbra },
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
        uniform float penumbra;
        varying vec3 vPosition;
        
        void main() {
          float gradient = 1.0 - (vPosition.y + 0.5);
          gradient = pow(gradient, 1.5 + penumbra);
          
          float radialFade = 1.0 - length(vPosition.xz) * (1.8 + penumbra * 0.4);
          radialFade = clamp(radialFade, 0.0, 1.0);
          radialFade = pow(radialFade, 1.0 + penumbra);
          
          float alpha = gradient * radialFade * intensity;
          alpha = clamp(alpha, 0.0, 0.4);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [color, intensity, penumbra]);

  useFrame(() => {
    if (!meshRef.current) return;
    
    meshRef.current.position.set(...position);
    
    const direction = new THREE.Vector3(...target).sub(new THREE.Vector3(...position));
    meshRef.current.lookAt(new THREE.Vector3(...position).add(direction));
    meshRef.current.rotateX(-Math.PI / 2);
  });

  return <mesh ref={meshRef} geometry={coneGeometry} material={material} />;
};

// SceneLighting component (unchanged)
const SceneLighting: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const groupRef = useRef<THREE.Group>(null);

  const spotlights = useMemo(() => {
    const lights = [];
    const count = Math.min(settings.spotlightCount || 3, 4);
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      
      const distanceVariation = 0.9 + Math.random() * 0.2;
      const heightVariation = 0.95 + Math.random() * 0.1;
      
      const x = Math.cos(angle) * (settings.spotlightDistance || 50) * distanceVariation;
      const z = Math.sin(angle) * (settings.spotlightDistance || 50) * distanceVariation;
      const y = (settings.spotlightHeight || 30) * heightVariation;
      
      lights.push({
        key: `spotlight-${i}`,
        position: [x, y, z] as [number, number, number],
        target: [0, (settings.wallHeight || 0) / 2, 0] as [number, number, number],
        angleVariation: 0.95 + Math.random() * 0.1,
        intensityVariation: 0.9 + Math.random() * 0.2,
      });
    }
    return lights;
  }, [settings.spotlightCount, settings.spotlightDistance, settings.spotlightHeight, settings.wallHeight]);

  return (
    <group ref={groupRef}>
      <ambientLight 
        intensity={(settings.ambientLightIntensity || 0.4) * 0.8} 
        color="#ffffff" 
      />
      
      <fog attach="fog" args={['#000000', 30, 250]} />
      
      <directionalLight
        position={[20, 30, 20]}
        intensity={0.2}
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
        
        const adjustedAngle = (settings.spotlightWidth || 0.3) * light.angleVariation;
        const baseIntensity = (settings.spotlightIntensity || 1) * 0.2;
        const adjustedIntensity = baseIntensity * light.intensityVariation;
        
        return (
          <group key={light.key}>
            <spotLight
              position={light.position}
              target={targetRef.current}
              angle={Math.max(0.1, adjustedAngle)}
              penumbra={settings.spotlightPenumbra || 0.5}
              intensity={adjustedIntensity * 5}
              color={settings.spotlightColor || '#ffffff'}
              distance={(settings.spotlightDistance || 50) * 2}
              decay={1.5}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-camera-near={0.5}
              shadow-camera-far={(settings.spotlightDistance || 50) * 4}
              shadow-bias={-0.0001}
              power={100}
              shadow-camera-fov={Math.max(30, Math.min(120, adjustedAngle * 180 / Math.PI * 2))}
            />
            <VolumetricSpotlight
              position={light.position}
              target={light.target}
              angle={adjustedAngle}
              color={settings.spotlightColor || '#ffffff'}
              intensity={(settings.spotlightIntensity || 1) * light.intensityVariation}
              distance={settings.spotlightDistance || 50}
              penumbra={settings.spotlightPenumbra || 0.5}
            />
            <primitive object={targetRef.current} />
          </group>
        );
      })}
    </group>
  );
};

// FIXED: PhotoMesh with better cleanup and disposal
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
  const currentPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentRotation = useRef<THREE.Euler>(new THREE.Euler());
  const previousPhotoId = useRef(photo.id);

  // CRITICAL: Reset state when photo ID changes (for slot reuse)
  useEffect(() => {
    if (previousPhotoId.current !== photo.id) {
      console.log(`🎬 PHOTO MESH: Photo ID changed from ${previousPhotoId.current.slice(-4)} to ${photo.id.slice(-4)}`);
      previousPhotoId.current = photo.id;
      setTexture(null);
      setIsLoading(true);
      setHasError(false);
      isInitializedRef.current = false;
    }
  }, [photo.id]);

  // FIXED: Texture loading with proper cleanup
  useEffect(() => {
    // Clear previous texture
    if (texture) {
      texture.dispose();
      setTexture(null);
    }

    if (!photo.url || photo.id.startsWith('placeholder-')) {
      setIsLoading(false);
      return;
    }

    const loader = new THREE.TextureLoader();
    setIsLoading(true);
    setHasError(false);

    const handleLoad = (loadedTexture: THREE.Texture) => {
      // Check if this is still the current photo
      if (photo.id === previousPhotoId.current) {
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.format = THREE.RGBAFormat;
        loadedTexture.generateMipmaps = false;
        setTexture(loadedTexture);
        setIsLoading(false);
        console.log(`🎬 PHOTO MESH: Loaded texture for ${photo.id.slice(-4)}`);
      } else {
        // Dispose if photo changed while loading
        loadedTexture.dispose();
      }
    };

    const handleError = () => {
      if (photo.id === previousPhotoId.current) {
        setHasError(true);
        setIsLoading(false);
        console.warn(`🎬 PHOTO MESH: Failed to load texture for ${photo.id.slice(-4)}`);
      }
    };

    const imageUrl = photo.url.includes('?') 
      ? `${photo.url}&t=${Date.now()}`
      : `${photo.url}?t=${Date.now()}`;

    loader.load(imageUrl, handleLoad, undefined, handleError);

    return () => {
      // Cleanup on unmount or photo change
      if (texture) {
        texture.dispose();
      }
    };
  }, [photo.url, photo.id]);

  // Camera facing logic (unchanged)
  useFrame(() => {
    if (!meshRef.current || !shouldFaceCamera) return;

    const mesh = meshRef.current;
    const currentPositionArray = mesh.position.toArray() as [number, number, number];
    
    const positionChanged = currentPositionArray.some((coord, index) => 
      Math.abs(coord - lastPositionRef.current[index]) > 0.01
    );

    if (positionChanged || !isInitializedRef.current) {
      mesh.lookAt(camera.position);
      lastPositionRef.current = currentPositionArray;
      isInitializedRef.current = true;
    }
  });

  // Smooth animation frame (unchanged)
  useFrame(() => {
    if (!meshRef.current) return;

    const targetPosition = new THREE.Vector3(...photo.targetPosition);
    const targetRotation = new THREE.Euler(...photo.targetRotation);

    const distance = currentPosition.current.distanceTo(targetPosition);
    const isTeleport = distance > TELEPORT_THRESHOLD;

    if (isTeleport) {
      currentPosition.current.copy(targetPosition);
      currentRotation.current.copy(targetRotation);
    } else {
      currentPosition.current.lerp(targetPosition, POSITION_SMOOTHING);
      currentRotation.current.x += (targetRotation.x - currentRotation.current.x) * ROTATION_SMOOTHING;
      currentRotation.current.y += (targetRotation.y - currentRotation.current.y) * ROTATION_SMOOTHING;
      currentRotation.current.z += (targetRotation.z - currentRotation.current.z) * ROTATION_SMOOTHING;
    }

    meshRef.current.position.copy(currentPosition.current);
    if (!shouldFaceCamera) {
      meshRef.current.rotation.copy(currentRotation.current);
    }
  });

  // Create material (unchanged)
  const material = useMemo(() => {
    if (texture) {
      const brightnessMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      
      brightnessMaterial.color.setScalar(brightness);
      return brightnessMaterial;
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      
      ctx.fillStyle = emptySlotColor;
      ctx.fillRect(0, 0, 512, 512);
      
      if (pattern === 'grid') {
        ctx.strokeStyle = '#ffffff20';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 512; i += 64) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, 512);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(512, i);
          ctx.stroke();
        }
      }
      
      const emptyTexture = new THREE.CanvasTexture(canvas);
      return new THREE.MeshStandardMaterial({
        map: emptyTexture,
        transparent: false,
        opacity: 1.0,
        side: THREE.DoubleSide,
        color: 0xffffff,
      });
    }
  }, [texture, emptySlotColor, pattern, brightness]);

  return (
    <mesh
      ref={meshRef}
      material={material}
      castShadow
      receiveShadow
    >
      <planeGeometry args={[size * (9/16), size]} />
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
      metalness: Math.min(settings.floorMetalness || 0.5, 0.9),
      roughness: Math.max(settings.floorRoughness || 0.5, 0.1),
      side: THREE.DoubleSide,
      envMapIntensity: 0.5,
    });
  }, [settings.floorColor, settings.floorOpacity, settings.floorMetalness, settings.floorRoughness]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={floorMaterial}>
      <planeGeometry args={[settings.floorSize, settings.floorSize, 32, 32]} />
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
    material.opacity = Math.min(settings.gridOpacity, 0.8);
    material.color = new THREE.Color(settings.gridColor);
    
    helper.position.y = 0.01;
    
    return helper;
  }, [settings.gridSize, settings.gridDivisions, settings.gridColor, settings.gridOpacity]);

  return <primitive object={gridHelper} />;
};

// CameraController component (unchanged)
const CameraController: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>();
  const userInteractingRef = useRef(false);
  const lastInteractionTimeRef = useRef(0);
  
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
      
      const target = new THREE.Vector3(0, settings.cameraHeight * 0.3, 0);
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
  }, [camera, settings.cameraDistance, settings.cameraHeight]);

  useEffect(() => {
    if (!controlsRef.current) return;

    const handleStart = () => {
      userInteractingRef.current = true;
      lastInteractionTimeRef.current = Date.now();
    };

    const handleEnd = () => {
      lastInteractionTimeRef.current = Date.now();
      setTimeout(() => {
        userInteractingRef.current = false;
      }, 500);
    };

    const controls = controlsRef.current;
    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
    };
  }, []);

  useFrame((state, delta) => {
    if (!settings.cameraEnabled || !controlsRef.current) return;

    if (settings.cameraRotationEnabled && !userInteractingRef.current) {
      const offset = new THREE.Vector3().copy(camera.position).sub(controlsRef.current.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      
      spherical.theta += (settings.cameraRotationSpeed || 0.5) * delta;
      
      const newPosition = new THREE.Vector3().setFromSpherical(spherical).add(controlsRef.current.target);
      camera.position.copy(newPosition);
      controlsRef.current.update();
    }
  });

  return settings.cameraEnabled ? (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={5}
      maxDistance={200}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI - Math.PI / 6}
      enableDamping={true}
      dampingFactor={0.05}
    />
  ) : null;
};

// FIXED: AnimationController with force updates and better logging
const AnimationController: React.FC<{
  settings: SceneSettings;
  photos: Photo[];
  onPositionsUpdate: (photos: PhotoWithPosition[]) => void;
}> = ({ settings, photos, onPositionsUpdate }) => {
  const slotManagerRef = useRef(new SlotManager(settings.photoCount));
  const lastPhotoCount = useRef(settings.photoCount);
  const lastPhotoIdsRef = useRef<string>('');
  
  // Create a stable key from photo IDs for change detection
  const photoIdsKey = useMemo(() => 
    photos.map(p => p.id).sort().join(','), 
    [photos]
  );

  // CRITICAL: Force update when photos change
  useEffect(() => {
    if (photoIdsKey !== lastPhotoIdsRef.current) {
      console.log('🎬 ANIMATION CONTROLLER: Photos changed, forcing update');
      console.log('🎬 Previous:', lastPhotoIdsRef.current);
      console.log('🎬 Current:', photoIdsKey);
      lastPhotoIdsRef.current = photoIdsKey;
      
      // Force immediate slot reassignment
      const slotAssignments = slotManagerRef.current.assignSlots(photos);
      console.log('🎬 ANIMATION CONTROLLER: Slot assignments updated');
    }
  }, [photoIdsKey, photos]);

  // Update slot manager when photo count changes
  useEffect(() => {
    if (settings.photoCount !== lastPhotoCount.current) {
      slotManagerRef.current.updateSlotCount(settings.photoCount);
      lastPhotoCount.current = settings.photoCount;
    }
  }, [settings.photoCount]);

  useFrame((state) => {
    const time = settings.animationEnabled ? 
      state.clock.elapsedTime * (settings.animationSpeed / 50) : 0;
    
    // Get stable slot assignments
    const slotAssignments = slotManagerRef.current.assignSlots(photos);
    
    // Generate pattern positions for all slots
    const pattern = PatternFactory.createPattern(settings.animationPattern, settings, photos);
    const patternState = pattern.generatePositions(time);
    
    const photosWithPositions: PhotoWithPosition[] = [];
    
    // Create photos with assigned slots
    for (const photo of photos) {
      const slotIndex = slotAssignments.get(photo.id);
      if (slotIndex !== undefined && slotIndex < settings.photoCount) {
        photosWithPositions.push({
          ...photo,
          targetPosition: patternState.positions[slotIndex] || [0, 0, 0],
          targetRotation: patternState.rotations?.[slotIndex] || [0, 0, 0],
          displayIndex: slotIndex,
          slotIndex,
        });
      }
    }
    
    // Add empty slots for remaining positions
    for (let i = 0; i < settings.photoCount; i++) {
      const hasPhoto = photosWithPositions.some(p => p.slotIndex === i);
      if (!hasPhoto) {
        photosWithPositions.push({
          id: `placeholder-${i}`,
          url: '',
          targetPosition: patternState.positions[i] || [0, 0, 0],
          targetRotation: patternState.rotations?.[i] || [0, 0, 0],
          displayIndex: i,
          slotIndex: i,
        });
      }
    }
    
    // Sort by slot index for consistent rendering order
    photosWithPositions.sort((a, b) => a.slotIndex - b.slotIndex);
    
    onPositionsUpdate(photosWithPositions);
  });

  return null;
};

// BackgroundRenderer component (unchanged)
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

// FIXED: Main CollageScene component with better photo change handling
const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
  const [photosWithPositions, setPhotosWithPositions] = useState<PhotoWithPosition[]>([]);
  
  // CRITICAL: Add logging for photo prop changes
  useEffect(() => {
    console.log('🎬 COLLAGE SCENE: Photos prop updated');
    console.log('🎬 Photo count:', photos.length);
    console.log('🎬 Photo IDs:', photos.map(p => `${p.id.slice(-4)}`));
  }, [photos]);

  const backgroundStyle = useMemo(() => {
    if (settings.backgroundGradient) {
      return {
        background: `linear-gradient(${settings.backgroundGradientAngle || 45}deg, ${settings.backgroundGradientStart || '#000000'}, ${settings.backgroundGradientEnd || '#000000'})`
      };
    }
    return {
      background: settings.backgroundColor || '#000000'
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
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.shadowMap.autoUpdate = true;
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }}
        performance={{ min: 0.8 }}
        linear={true}
        key={`scene-${photos.length}-${photos.map(p => p.id).join(',')}`} // Force re-render on photo changes
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
            key={`${photo.id}-${photo.slotIndex}-${photos.length}`}
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