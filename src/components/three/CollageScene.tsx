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
  slotIndex: number; // Added for stable slot assignment
};

// Adjusted smoothing values for float pattern
const POSITION_SMOOTHING = 0.1;
const ROTATION_SMOOTHING = 0.1;
const TELEPORT_THRESHOLD = 30; // Distance threshold to detect teleportation

// Stable slot assignment system
class SlotManager {
  private slotAssignments = new Map<string, number>(); // photoId -> slotIndex
  private occupiedSlots = new Set<number>();
  private availableSlots: number[] = [];
  private totalSlots = 0;

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
    
    // Rebuild available slots
    this.rebuildAvailableSlots();
  }

  private rebuildAvailableSlots() {
    this.availableSlots = [];
    for (let i = 0; i < this.totalSlots; i++) {
      if (!this.occupiedSlots.has(i)) {
        this.availableSlots.push(i);
      }
    }
    // Shuffle for better distribution
    this.shuffleArray(this.availableSlots);
  }

  private shuffleArray(array: number[]) {
    // Fisher-Yates shuffle for even distribution
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  assignSlots(photos: Photo[]): Map<string, number> {
    // Safety check for photos array - but allow empty array
    if (!Array.isArray(photos)) {
      console.warn('🎬 SLOT MANAGER: Photos is not an array, using empty array');
      photos = [];
    }

    // Remove assignments for photos that no longer exist
    const currentPhotoIds = new Set(photos.map(p => p.id));
    const beforeCount = this.slotAssignments.size;
    
    for (const [photoId, slotIndex] of this.slotAssignments.entries()) {
      if (!currentPhotoIds.has(photoId)) {
        console.log(`🎬 SLOT: Removing deleted photo ${photoId.slice(-4)} from slot ${slotIndex}`);
        this.slotAssignments.delete(photoId);
        this.occupiedSlots.delete(slotIndex);
      }
    }

    const afterCleanup = this.slotAssignments.size;
    if (beforeCount !== afterCleanup) {
      console.log(`🎬 SLOT: Cleaned up ${beforeCount - afterCleanup} deleted photos`);
    }

    // Rebuild available slots after cleanup
    this.rebuildAvailableSlots();

    // Assign slots to new photos in order of creation (oldest first for stability)
    const sortedPhotos = [...photos].sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return a.id.localeCompare(b.id);
    });

    for (const photo of sortedPhotos) {
      if (!this.slotAssignments.has(photo.id) && this.availableSlots.length > 0) {
        const slotIndex = this.availableSlots.shift()!;
        this.slotAssignments.set(photo.id, slotIndex);
        this.occupiedSlots.add(slotIndex);
      }
    }

    return new Map(this.slotAssignments);
  }
}

// VolumetricSpotlight component
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
    const scaledIntensity = intensity * 0.0002; // Volumetric fog intensity
    
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
          // Gradient calculation with penumbra control
          float gradient = 1.0 - (vPosition.y + 0.5);
          gradient = pow(gradient, 1.5 + penumbra);
          
          // Radial fade with penumbra influence
          float radialFade = 1.0 - length(vPosition.xz) * (1.8 + penumbra * 0.4);
          radialFade = clamp(radialFade, 0.0, 1.0);
          radialFade = pow(radialFade, 1.0 + penumbra);
          
          float alpha = gradient * radialFade * intensity;
          
          // Cap alpha to prevent overexposure
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

// SceneLighting component - Fixed to not be affected by photo brightness
const SceneLighting: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Calculate proper spotlight positions with better spread
  const spotlights = useMemo(() => {
    const lights = [];
    const count = Math.min(settings.spotlightCount || 3, 4);
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      
      // Add slight variation to spotlight positions for more natural lighting
      const distanceVariation = 0.9 + Math.random() * 0.2; // 0.9-1.1 variation
      const heightVariation = 0.95 + Math.random() * 0.1; // 0.95-1.05 variation
      
      const x = Math.cos(angle) * (settings.spotlightDistance || 50) * distanceVariation;
      const z = Math.sin(angle) * (settings.spotlightDistance || 50) * distanceVariation;
      const y = (settings.spotlightHeight || 30) * heightVariation;
      
      lights.push({
        key: `spotlight-${i}`,
        position: [x, y, z] as [number, number, number],
        target: [0, (settings.wallHeight || 0) / 2, 0] as [number, number, number],
        // Add slight variations in angle and intensity for realism
        angleVariation: 0.95 + Math.random() * 0.1,
        intensityVariation: 0.9 + Math.random() * 0.2,
      });
    }
    return lights;
  }, [settings.spotlightCount, settings.spotlightDistance, settings.spotlightHeight, settings.wallHeight]);

  return (
    <group ref={groupRef}>
      {/* Enhanced Ambient light with increased intensity range */}
      <ambientLight 
        intensity={(settings.ambientLightIntensity || 0.4) * 0.8} 
        color="#ffffff" 
      />
      
      {/* Fog for depth */}
      <fog attach="fog" args={['#000000', 30, 250]} />
      
      {/* Soft directional light for subtle fill */}
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
      
      {/* Spotlights with proper intensity */}
      {spotlights.map((light) => {
        const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());
        targetRef.current.position.set(...light.target);
        
        // Calculate spotlight parameters
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

// PhotoMesh component with brightness control
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
      ? `${photo.url}&t=${Date.now()}`
      : `${photo.url}?t=${Date.now()}`;

    loader.load(imageUrl, handleLoad, undefined, handleError);

    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [photo.url]);

  // Camera facing logic
  useFrame(() => {
    if (!meshRef.current || !shouldFaceCamera) return;

    const mesh = meshRef.current;
    const currentPositionArray = mesh.position.toArray() as [number, number, number];
    
    // Only update if position changed significantly
    const positionChanged = currentPositionArray.some((coord, index) => 
      Math.abs(coord - lastPositionRef.current[index]) > 0.01
    );

    if (positionChanged || !isInitializedRef.current) {
      mesh.lookAt(camera.position);
      lastPositionRef.current = currentPositionArray;
      isInitializedRef.current = true;
    }
  });

  // Smooth animation frame
  useFrame(() => {
    if (!meshRef.current) return;

    const targetPosition = new THREE.Vector3(...photo.targetPosition);
    const targetRotation = new THREE.Euler(...photo.targetRotation);

    // Check if this is a teleport (large distance change)
    const distance = currentPosition.current.distanceTo(targetPosition);
    const isTeleport = distance > TELEPORT_THRESHOLD;

    if (isTeleport) {
      // Instantly teleport to new position
      currentPosition.current.copy(targetPosition);
      currentRotation.current.copy(targetRotation);
    } else {
      // Smooth interpolation for normal movement
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

  // Create material with brightness control
  const material = useMemo(() => {
    if (texture) {
      const brightnessMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      
      // Apply brightness by modifying the material color - only for photos with textures
      brightnessMaterial.color.setScalar(brightness || 1.0);
      
      return brightnessMaterial;
    } else {
      // Empty slot material - NOT affected by brightness setting
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      
      // Fill with background color
      ctx.fillStyle = emptySlotColor || '#1A1A1A';
      ctx.fillRect(0, 0, 512, 512);
      
      // Add pattern
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
        opacity: 1.0, // Fully opaque empty slots
        side: THREE.DoubleSide,
        color: 0xffffff, // Fixed white color for empty slots, not affected by brightness
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
      {/* Add a very slight bevel to the plane for better light response */}
      <planeGeometry args={[(size || 4.0) * (9/16), size || 4.0]} />
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
    material.opacity = Math.min(settings.gridOpacity, 0.8);
    material.color = new THREE.Color(settings.gridColor);
    
    helper.position.y = 0.01;
    
    return helper;
  }, [settings.gridSize, settings.gridDivisions, settings.gridColor, settings.gridOpacity]);

  return <primitive object={gridHelper} />;
};

// CameraController component
const CameraController: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>();
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

  // Handle user interaction tracking
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

    // Auto-rotate only when enabled and user is not interacting
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

// FIXED: AnimationController with immediate updates on photo changes
const AnimationController: React.FC<{
  settings: SceneSettings;
  photos: Photo[];
  onPositionsUpdate: (photos: PhotoWithPosition[]) => void;
}> = ({ settings, photos, onPositionsUpdate }) => {
  const slotManagerRef = useRef(new SlotManager(settings.photoCount));
  const lastPhotoCount = useRef(settings.photoCount);
  
  // CRITICAL FIX: Immediately update positions when photos array changes
  const currentPhotoIds = useMemo(() => 
    (photos || []).map(p => p.id).sort().join(','), 
    [photos]
  );
  
  const lastPhotoIds = useRef(currentPhotoIds);
  
  const updatePositions = useCallback((time: number = 0) => {
    // Safety check for photos - but allow empty array
    if (!Array.isArray(photos)) {
      console.warn('🎬 Photos is not an array, using empty array');
      // Use empty array instead of returning early
      photos = [];
    }

    // Get slot assignments with the current photo array
    const slotAssignments = slotManagerRef.current.assignSlots(photos);
    
    // Generate pattern positions
    const pattern = PatternFactory.createPattern(settings.animationPattern || 'grid', settings, photos);
    const patternState = pattern.generatePositions(time);
    
    const photosWithPositions: PhotoWithPosition[] = [];
    
    // Create photos with assigned slots
    for (const photo of photos) {
      const slotIndex = slotAssignments.get(photo.id);
      if (slotIndex !== undefined && slotIndex < (settings.photoCount || 50)) {
        photosWithPositions.push({
          ...photo,
          targetPosition: patternState.positions[slotIndex] || [0, 0, 0],
          targetRotation: patternState.rotations?.[slotIndex] || [0, 0, 0],
          displayIndex: slotIndex,
          slotIndex,
        });
      }
    }
    
    // Add empty slots for remaining positions - ALWAYS CREATE THESE
    for (let i = 0; i < (settings.photoCount || 50); i++) {
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
    
    // Sort by slot index and update
    photosWithPositions.sort((a, b) => a.slotIndex - b.slotIndex);
    onPositionsUpdate(photosWithPositions);
  }, [photos, settings, onPositionsUpdate]);

  // CRITICAL: Immediate update when photos change
  useEffect(() => {
    if (currentPhotoIds !== lastPhotoIds.current) {
      console.log('🎬 PHOTOS CHANGED: Immediately updating positions');
      console.log('🎬 Old:', lastPhotoIds.current);
      console.log('🎬 New:', currentPhotoIds);
      
      // Force immediate position update
      updatePositions(0);
      
      lastPhotoIds.current = currentPhotoIds;
    }
  }, [currentPhotoIds, updatePositions]);

  // Update slot manager when photo count changes
  useEffect(() => {
    if (settings.photoCount !== lastPhotoCount.current) {
      slotManagerRef.current.updateSlotCount(settings.photoCount);
      lastPhotoCount.current = settings.photoCount;
    }
  }, [settings.photoCount]);

  // Regular animation updates
  useFrame((state) => {
    const time = settings.animationEnabled ? 
      state.clock.elapsedTime * (settings.animationSpeed / 50) : 0;
    
    updatePositions(time);
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

// Debug component to track photo changes
const PhotoDebugger: React.FC<{ photos: Photo[] }> = ({ photos }) => {
  useEffect(() => {
    console.log('🔍 PHOTO DEBUGGER: Photos updated in scene');
    console.log('🔍 Count:', photos?.length || 0);
    console.log('🔍 IDs:', (photos || []).map(p => p.id.slice(-4)));
  }, [photos]);
  
  return null;
};

// Main CollageScene component
const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
  const [photosWithPositions, setPhotosWithPositions] = useState<PhotoWithPosition[]>([]);

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
          toneMappingExposure: 1.0, // Standard exposure
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
        
        <PhotoDebugger photos={photos} />
        
        {photosWithPositions.map((photo) => (
          <PhotoMesh
            key={`${photo.id}-${photo.slotIndex}-${photos.length}-v3`}
            photo={photo}
            size={settings.photoSize || 4.0}
            emptySlotColor={settings.emptySlotColor || '#1A1A1A'}
            pattern={settings.animationPattern || 'grid'}
            shouldFaceCamera={settings.photoRotation || false}
            brightness={settings.photoBrightness || 1.0}
          />
        ))}
      </Canvas>
    </div>
  );
};

export default CollageScene;