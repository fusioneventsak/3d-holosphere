// src/components/three/CollageScene.tsx
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
  displayIndex: number;
  slotIndex: number;
};

// Constants for smooth animation
const POSITION_SMOOTHING = 0.1;
const ROTATION_SMOOTHING = 0.1;
const TELEPORT_THRESHOLD = 10;

// Slot management for stable photo positioning
class SlotManager {
  private slotAssignments = new Map<string, number>();
  private occupiedSlots = new Set<number>();
  private maxSlots: number;

  constructor(maxSlots: number) {
    this.maxSlots = maxSlots;
  }

  updateSlotCount(newMaxSlots: number) {
    this.maxSlots = newMaxSlots;
    
    // Remove assignments that exceed new slot count
    for (const [photoId, slotIndex] of this.slotAssignments.entries()) {
      if (slotIndex >= newMaxSlots) {
        this.slotAssignments.delete(photoId);
        this.occupiedSlots.delete(slotIndex);
      }
    }
  }

  assignSlots(photos: Photo[]): Map<string, number> {
    // Remove assignments for photos that no longer exist
    const currentPhotoIds = new Set(photos.map(p => p.id));
    for (const [photoId, slotIndex] of this.slotAssignments.entries()) {
      if (!currentPhotoIds.has(photoId)) {
        this.slotAssignments.delete(photoId);
        this.occupiedSlots.delete(slotIndex);
      }
    }

    // Assign slots to new photos
    for (const photo of photos) {
      if (!this.slotAssignments.has(photo.id)) {
        // Find the first available slot
        let slotIndex = 0;
        while (slotIndex < this.maxSlots && this.occupiedSlots.has(slotIndex)) {
          slotIndex++;
        }
        
        if (slotIndex < this.maxSlots) {
          this.slotAssignments.set(photo.id, slotIndex);
          this.occupiedSlots.add(slotIndex);
        }
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
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [color, intensity, penumbra]);

  useEffect(() => {
    if (meshRef.current) {
      const mesh = meshRef.current;
      mesh.position.set(...position);
      mesh.lookAt(...target);
    }
  }, [position, target]);

  return (
    <mesh ref={meshRef} geometry={coneGeometry} material={material} />
  );
};

// Floor component
const Floor: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (meshRef.current) {
      const mesh = meshRef.current;
      mesh.receiveShadow = true;
      mesh.position.y = -0.1;
    }
  }, []);

  const floorMaterial = useMemo(() => {
    return new THREE.MeshLambertMaterial({
      color: new THREE.Color(settings.floorColor || '#111111'),
      transparent: true,
      opacity: 0.8,
    });
  }, [settings.floorColor]);

  if (!settings.showFloor) return null;

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} material={floorMaterial}>
      <planeGeometry args={[200, 200]} />
    </mesh>
  );
};

// Grid component
const Grid: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const gridRef = useRef<THREE.GridHelper>(null);

  useEffect(() => {
    if (gridRef.current) {
      const grid = gridRef.current;
      grid.position.y = 0;
      grid.material.transparent = true;
      grid.material.opacity = 0.3;
    }
  }, []);

  if (!settings.showGrid) return null;

  return <gridHelper ref={gridRef} args={[200, 50, '#333333', '#222222']} />;
};

// Camera controller with auto-rotation
const CameraController: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const userInteractingRef = useRef(false);
  const lastInteractionTimeRef = useRef(0);

  // Position camera based on settings
  useEffect(() => {
    if (!camera || !controlsRef.current) return;

    const distance = settings.cameraDistance || 15;
    const height = settings.cameraHeight || 8;
    
    const initialPosition = new THREE.Vector3(
      distance * 0.8,
      height,
      distance * 0.8
    );
    
    camera.position.copy(initialPosition);
    
    // Set target based on camera height
    const target = new THREE.Vector3(0, height * 0.3, 0);
    controlsRef.current.target.copy(target);
    controlsRef.current.update();
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

// FIXED AnimationController - Now properly reactive to photos array changes
const AnimationController: React.FC<{
  settings: SceneSettings;
  photos: Photo[];
  onPositionsUpdate: (photos: PhotoWithPosition[]) => void;
}> = ({ settings, photos, onPositionsUpdate }) => {
  const slotManagerRef = useRef(new SlotManager(settings.photoCount));
  const lastPhotoCount = useRef(settings.photoCount);
  const lastPhotoIds = useRef<string>('');
  const cachedPositions = useRef<PhotoWithPosition[]>([]);
  
  // Update slot manager when photo count changes
  useEffect(() => {
    if (settings.photoCount !== lastPhotoCount.current) {
      slotManagerRef.current.updateSlotCount(settings.photoCount);
      lastPhotoCount.current = settings.photoCount;
    }
  }, [settings.photoCount]);

  // CRITICAL: Recalculate positions when photos array changes
  const updatePositions = useCallback(() => {
    console.log('🔄 Updating photo positions for', photos.length, 'photos');
    
    // Get stable slot assignments
    const slotAssignments = slotManagerRef.current.assignSlots(photos);
    
    // Generate pattern positions for all slots
    const pattern = PatternFactory.createPattern(settings.animationPattern, settings, photos);
    const patternState = pattern.generatePositions(0); // Start with time 0 for initial positions
    
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
    
    cachedPositions.current = photosWithPositions;
    onPositionsUpdate(photosWithPositions);
  }, [photos, settings.photoCount, settings.animationPattern, onPositionsUpdate]);

  // CRITICAL: Update positions when photos array changes
  useEffect(() => {
    const currentPhotoIds = photos.map(p => p.id).sort().join(',');
    if (currentPhotoIds !== lastPhotoIds.current) {
      console.log('📸 Photos array changed, recalculating positions');
      lastPhotoIds.current = currentPhotoIds;
      updatePositions();
    }
  }, [photos, updatePositions]);

  // CRITICAL: Update positions when settings change
  useEffect(() => {
    updatePositions();
  }, [settings.animationPattern, settings.photoCount, updatePositions]);

  // Animation frame - only updates animation time, not photo assignment
  useFrame((state) => {
    if (!settings.animationEnabled || cachedPositions.current.length === 0) return;

    const time = state.clock.elapsedTime * (settings.animationSpeed / 50);
    
    // Generate updated positions with animation time
    const pattern = PatternFactory.createPattern(settings.animationPattern, settings, photos);
    const patternState = pattern.generatePositions(time);
    
    // Update target positions for existing photos without reassigning slots
    const updatedPositions = cachedPositions.current.map(photo => {
      if (photo.slotIndex < patternState.positions.length) {
        return {
          ...photo,
          targetPosition: patternState.positions[photo.slotIndex] || [0, 0, 0],
          targetRotation: patternState.rotations?.[photo.slotIndex] || [0, 0, 0],
        };
      }
      return photo;
    });
    
    onPositionsUpdate(updatedPositions);
  });

  return null;
};

// Scene lighting with dynamic spotlights
const SceneLighting: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const spotlights = useMemo(() => {
    const lights = [];
    const lightCount = 4;
    const radius = 30;
    
    for (let i = 0; i < lightCount; i++) {
      const angle = (i / lightCount) * Math.PI * 2;
      const height = 15 + Math.sin(i * 1.3) * 5;
      
      lights.push({
        key: `spotlight-${i}`,
        position: [
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius
        ] as [number, number, number],
        target: [0, 5, 0] as [number, number, number],
        intensityVariation: 0.8 + Math.sin(i * 0.7) * 0.4,
        angleVariation: 0.8 + Math.cos(i * 0.9) * 0.3,
      });
    }
    
    return lights;
  }, []);

  return (
    <group>
      {/* Enhanced Ambient light */}
      <ambientLight 
        intensity={(settings.ambientLightIntensity || 0.4) * 0.8} 
        color="#ffffff" 
      />
      
      {/* Fog for depth */}
      <fog attach="fog" args={['#000000', 30, 250]} />
      
      {/* Soft directional light */}
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
      
      {/* Dynamic spotlights */}
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

// PhotoMesh component with enhanced texture loading
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

  // Load texture when photo URL changes
  useEffect(() => {
    if (!photo.url) {
      setIsLoading(false);
      setTexture(null);
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
      console.log('✅ Photo texture loaded:', photo.id);
    };

    const handleError = () => {
      console.warn('❌ Failed to load photo texture:', photo.url);
      setHasError(true);
      setIsLoading(false);
    };

    // Add cache busting for realtime updates
    const imageUrl = photo.url.includes('?') 
      ? `${photo.url}&t=${Date.now()}`
      : `${photo.url}?t=${Date.now()}`;

    loader.load(imageUrl, handleLoad, undefined, handleError);

    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [photo.url, photo.id]);

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
      
      // Apply brightness by modifying the material color
      brightnessMaterial.color.setScalar(brightness);
      
      return brightnessMaterial;
    } else {
      // Empty slot material
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      
      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, 512, 512);
      gradient.addColorStop(0, emptySlotColor);
      gradient.addColorStop(1, '#333333');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);
      
      // Add subtle pattern
      ctx.strokeStyle = '#444444';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.strokeRect(50, 50, 412, 412);
      
      const emptyTexture = new THREE.CanvasTexture(canvas);
      return new THREE.MeshStandardMaterial({
        map: emptyTexture,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
    }
  }, [texture, emptySlotColor, brightness]);

  return (
    <mesh
      ref={meshRef}
      material={material}
      castShadow
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
    </mesh>
  );
};

// Background renderer
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

  // Debug logging for photo changes
  useEffect(() => {
    console.log('🔄 CollageScene received photos update:', photos.length, 'photos');
    console.log('📸 Photo IDs:', photos.map(p => p.id));
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
            key={`${photo.id}-${photo.slotIndex}`}
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