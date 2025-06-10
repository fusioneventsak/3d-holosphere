// src/components/three/CollageScene.tsx - SMOOTH REAL-TIME UPDATES
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Photo, useCollageStore } from '../../store/collageStore';

interface CollageSceneProps {
  settings: any;
  onSettingsChange?: (settings: any) => void;
}

interface PhotoWithPosition extends Photo {
  position: [number, number, number];
  rotation: [number, number, number];
  slotIndex: number;
  isVisible: boolean;
}

// Smooth PhotoMesh component that handles appearing/disappearing
const PhotoMesh: React.FC<{
  photo: PhotoWithPosition;
  size: number;
  emptySlotColor: string;
  brightness: number;
}> = ({ photo, size, emptySlotColor, brightness }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [opacity, setOpacity] = useState(photo.url ? 0 : 0.3); // Start invisible for real photos
  const textureRef = useRef<THREE.Texture | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Smooth fade in/out based on visibility
  useFrame(() => {
    if (meshRef.current && materialRef.current) {
      const targetOpacity = photo.isVisible ? (photo.url ? 1 : 0.3) : 0;
      const currentOpacity = materialRef.current.opacity;
      
      if (Math.abs(currentOpacity - targetOpacity) > 0.01) {
        const newOpacity = THREE.MathUtils.lerp(currentOpacity, targetOpacity, 0.1);
        setOpacity(newOpacity);
        materialRef.current.opacity = newOpacity;
      }

      // Smooth position animation
      const targetPos = new THREE.Vector3(...photo.position);
      const targetRot = new THREE.Euler(...photo.rotation);
      
      meshRef.current.position.lerp(targetPos, 0.05);
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRot.x, 0.05);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRot.y, 0.05);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRot.z, 0.05);
    }
  });

  // Clean up textures when component unmounts
  useEffect(() => {
    return () => {
      if (textureRef.current) {
        console.log('🧹 Disposing texture for photo:', photo.id);
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, [photo.id]);

  // Load texture when photo URL changes
  useEffect(() => {
    // Clean up previous texture
    if (textureRef.current) {
      textureRef.current.dispose();
      textureRef.current = null;
    }

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
      
      textureRef.current = loadedTexture;
      setTexture(loadedTexture);
      setIsLoading(false);
      console.log('✅ Photo texture loaded for:', photo.id);
    };

    const handleError = () => {
      console.warn('❌ Failed to load photo texture:', photo.url);
      setHasError(true);
      setIsLoading(false);
    };

    // Don't add cache busting for smoother loading
    loader.load(photo.url, handleLoad, undefined, handleError);
  }, [photo.url, photo.id]);

  // Material based on loading state
  const material = useMemo(() => {
    if (hasError || (!texture && !isLoading && photo.url)) {
      // Error material
      const mat = new THREE.MeshStandardMaterial({
        color: '#ff6b6b',
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
      });
      materialRef.current = mat;
      return mat;
    }

    if (!photo.url) {
      // Empty slot material
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      
      const gradient = ctx.createLinearGradient(0, 0, 256, 256);
      gradient.addColorStop(0, emptySlotColor);
      gradient.addColorStop(1, '#333333');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
      
      ctx.strokeStyle = '#444444';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(10, 10, 236, 236);
      
      const emptyTexture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshStandardMaterial({
        map: emptyTexture,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
      });
      materialRef.current = mat;
      return mat;
    }

    if (isLoading) {
      // Loading material
      const mat = new THREE.MeshStandardMaterial({
        color: '#666666',
        transparent: true,
        opacity: opacity * 0.5,
      });
      materialRef.current = mat;
      return mat;
    }

    // Photo material
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
      color: new THREE.Color(brightness, brightness, brightness),
    });
    materialRef.current = mat;
    return mat;
  }, [texture, emptySlotColor, brightness, isLoading, hasError, photo.url, opacity]);

  return (
    <mesh
      ref={meshRef}
      material={material}
      castShadow
      receiveShadow
      position={photo.position}
      rotation={photo.rotation}
      visible={opacity > 0.01} // Hide completely invisible meshes
    >
      <planeGeometry args={[size, size]} />
    </mesh>
  );
};

// Grid pattern generator
const generateGridPattern = (photos: Photo[], settings: any): PhotoWithPosition[] => {
  const { photoCount, photoSize = 1 } = settings;
  const cols = Math.ceil(Math.sqrt(photoCount));
  const rows = Math.ceil(photoCount / cols);
  const spacing = photoSize * 1.2;
  
  const photosWithPositions: PhotoWithPosition[] = [];
  const activePhotoIds = new Set(photos.map(p => p.id));
  
  // Create positions for all slots
  for (let i = 0; i < photoCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols - 1) / 2) * spacing;
    const z = (row - (rows - 1) / 2) * spacing;
    
    const assignedPhoto = i < photos.length ? photos[i] : null;
    
    if (assignedPhoto) {
      photosWithPositions.push({
        ...assignedPhoto,
        position: [x, 0, z],
        rotation: [0, 0, 0],
        slotIndex: i,
        isVisible: true,
      });
    } else {
      // Empty slot
      photosWithPositions.push({
        id: `placeholder-${i}`,
        collage_id: '',
        url: '',
        created_at: '',
        position: [x, 0, z],
        rotation: [0, 0, 0],
        slotIndex: i,
        isVisible: true,
      });
    }
  }
  
  return photosWithPositions;
};

// Float pattern generator
const generateFloatPattern = (photos: Photo[], settings: any): PhotoWithPosition[] => {
  const { photoCount, photoSize = 1 } = settings;
  const photosWithPositions: PhotoWithPosition[] = [];
  const time = Date.now() * 0.001; // Use current time for animation
  
  for (let i = 0; i < photoCount; i++) {
    const angle = (i / photoCount) * Math.PI * 2;
    const radius = 5 + (i % 3) * 2;
    const height = Math.sin(time + i * 0.5) * 3;
    
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    const assignedPhoto = i < photos.length ? photos[i] : null;
    
    if (assignedPhoto) {
      photosWithPositions.push({
        ...assignedPhoto,
        position: [x, height, z],
        rotation: [0, angle, 0],
        slotIndex: i,
        isVisible: true,
      });
    } else {
      // Empty slot
      photosWithPositions.push({
        id: `placeholder-${i}`,
        collage_id: '',
        url: '',
        created_at: '',
        position: [x, height, z],
        rotation: [0, angle, 0],
        slotIndex: i,
        isVisible: true,
      });
    }
  }
  
  return photosWithPositions;
};

// Stable PhotoController that doesn't cause flickering
const PhotoController: React.FC<{
  photos: Photo[];
  settings: any;
  onPhotosWithPositions: (photos: PhotoWithPosition[]) => void;
}> = ({ photos, settings, onPhotosWithPositions }) => {
  const [photosWithPositions, setPhotosWithPositions] = useState<PhotoWithPosition[]>([]);
  const lastPhotoIdsRef = useRef<string>('');
  const lastSettingsRef = useRef<string>('');

  // SMOOTH: Only recalculate when photos actually change (not on every render)
  const updatePositions = useCallback(() => {
    console.log('🔄 Smoothly updating photo positions - Photos:', photos.length, 'Pattern:', settings.animationPattern);
    
    let newPhotosWithPositions: PhotoWithPosition[] = [];
    
    switch (settings.animationPattern) {
      case 'float':
        newPhotosWithPositions = generateFloatPattern(photos, settings);
        break;
      case 'grid_wall':
      default:
        newPhotosWithPositions = generateGridPattern(photos, settings);
        break;
    }
    
    setPhotosWithPositions(newPhotosWithPositions);
    onPhotosWithPositions(newPhotosWithPositions);
  }, [photos, settings, onPhotosWithPositions]);

  // SMOOTH: Only update when photos or settings actually change
  useEffect(() => {
    const currentPhotoIds = photos.map(p => p.id).sort().join(',');
    const currentSettings = JSON.stringify({ 
      pattern: settings.animationPattern, 
      count: settings.photoCount, 
      size: settings.photoSize 
    });
    
    const photoIdsChanged = currentPhotoIds !== lastPhotoIdsRef.current;
    const settingsChanged = currentSettings !== lastSettingsRef.current;
    
    if (photoIdsChanged || settingsChanged) {
      console.log('📸 SMOOTH UPDATE - Photos changed:', photoIdsChanged, 'Settings changed:', settingsChanged);
      lastPhotoIdsRef.current = currentPhotoIds;
      lastSettingsRef.current = currentSettings;
      updatePositions();
    }
  }, [photos, settings.animationPattern, settings.photoCount, settings.photoSize, updatePositions]);

  return null;
};

// Background component
const BackgroundRenderer: React.FC<{ settings: any }> = ({ settings }) => {
  const { scene, gl } = useThree();
  
  useEffect(() => {
    if (settings.backgroundGradient) {
      scene.background = null;
      gl.setClearColor('#000000', 0);
    } else {
      scene.background = new THREE.Color(settings.backgroundColor || '#000000');
      gl.setClearColor(settings.backgroundColor || '#000000', 1);
    }
  }, [scene, gl, settings.backgroundColor, settings.backgroundGradient]);

  return null;
};

// Main CollageScene component - DIRECTLY CONNECTED TO STORE
const CollageScene: React.FC<CollageSceneProps> = ({ settings, onSettingsChange }) => {
  // CRITICAL: Get photos directly from store, not from props
  const { photos, lastRefreshTime } = useCollageStore();
  const [photosWithPositions, setPhotosWithPositions] = useState<PhotoWithPosition[]>([]);
  const stablePhotosRef = useRef<Photo[]>([]);
  const forceUpdateRef = useRef(0);
  
  // CRITICAL: Stable scene that doesn't recreate on photo changes
  const sceneKey = useMemo(() => {
    // Only change key when settings change, NOT when photos change
    return `stable-scene-${settings.animationPattern}-${settings.photoCount}`;
  }, [settings.animationPattern, settings.photoCount]);

  // SMOOTH: Update internal photos without triggering re-render
  useEffect(() => {
    const photoIds = photos.map(p => p.id).sort().join(',');
    const stablePhotoIds = stablePhotosRef.current.map(p => p.id).sort().join(',');
    
    if (photoIds !== stablePhotoIds) {
      console.log('🔄 SCENE: Photos changed directly from store!');
      console.log('📸 Old count:', stablePhotosRef.current.length, 'New count:', photos.length);
      console.log('📸 New photo IDs:', photos.map(p => p.id.slice(-4)));
      
      stablePhotosRef.current = [...photos];
      forceUpdateRef.current += 1;
      
      // Trigger smooth position update without scene recreation
      setPhotosWithPositions(prev => {
        // Return new array to trigger PhotoController update
        return [...prev];
      });
    }
  }, [photos]);

  // Listen to deletion signals
  useEffect(() => {
    if (lastRefreshTime) {
      console.log('🔄 SCENE: Refresh signal received:', lastRefreshTime);
      forceUpdateRef.current += 1;
      setPhotosWithPositions(prev => [...prev]);
    }
  }, [lastRefreshTime]);

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
          premultipliedAlpha: false
        }}
        dpr={[1, 2]}
        frameloop="always" // Keep animating smoothly
      >
        <BackgroundRenderer settings={settings} />
        
        <PerspectiveCamera
          makeDefault
          position={[
            0,
            settings.cameraHeight || 8,
            settings.cameraDistance || 15
          ]}
          fov={75}
        />
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2}
          minDistance={5}
          maxDistance={50}
        />
        
        <ambientLight intensity={settings.ambientLightIntensity || 0.4} />
        <spotLight
          position={[10, 10, 10]}
          intensity={settings.spotlightIntensity || 0.8}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        
        <PhotoController
          photos={stablePhotosRef.current} // Use stable reference
          settings={settings}
          onPhotosWithPositions={setPhotosWithPositions}
          key={`controller-${forceUpdateRef.current}`} // Force controller updates
        />
        
        {/* STABLE: Group that only recreates when settings change */}
        <group key={sceneKey}>
          {photosWithPositions.map((photo) => (
            <PhotoMesh
              key={`${photo.id}-stable`} // Stable key
              photo={photo}
              size={settings.photoSize || 1}
              emptySlotColor={settings.emptySlotColor || '#1A1A1A'}
              brightness={settings.photoBrightness || 1}
            />
          ))}
        </group>
        
        {settings.showFloor && (
          <mesh 
            rotation={[-Math.PI / 2, 0, 0]} 
            position={[0, -2, 0]} 
            receiveShadow
          >
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial 
              color={settings.floorColor || '#111111'} 
              transparent 
              opacity={0.8} 
            />
          </mesh>
        )}
      </Canvas>
    </div>
  );
};

export default CollageScene;