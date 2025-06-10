// src/components/three/CollageScene.tsx - ENHANCED WITH REAL-TIME REMOVAL
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Photo, useCollageStore } from '../../store/collageStore';

interface CollageSceneProps {
  photos: Photo[];
  settings: any;
  onSettingsChange?: (settings: any) => void;
}

interface PhotoWithPosition extends Photo {
  position: [number, number, number];
  rotation: [number, number, number];
  slotIndex: number;
}

// Enhanced PhotoMesh component with proper cleanup and keying
const PhotoMesh: React.FC<{
  photo: PhotoWithPosition;
  size: number;
  emptySlotColor: string;
  brightness: number;
  key: string; // Explicit key prop for React reconciliation
}> = ({ photo, size, emptySlotColor, brightness }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const textureRef = useRef<THREE.Texture | null>(null);

  // CRITICAL: Clean up textures when component unmounts or photo changes
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

    // Add cache busting for realtime updates
    const imageUrl = photo.url.includes('?') 
      ? `${photo.url}&cb=${Date.now()}` 
      : `${photo.url}?cb=${Date.now()}`;

    loader.load(imageUrl, handleLoad, undefined, handleError);
  }, [photo.url, photo.id]);

  // Animate to target position
  useFrame(() => {
    if (meshRef.current) {
      const targetPos = new THREE.Vector3(...photo.position);
      const targetRot = new THREE.Euler(...photo.rotation);
      
      meshRef.current.position.lerp(targetPos, 0.05);
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRot.x, 0.05);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRot.y, 0.05);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRot.z, 0.05);
    }
  });

  // Material based on loading state
  const material = useMemo(() => {
    if (hasError || (!texture && !isLoading)) {
      // Empty slot material
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      
      const gradient = ctx.createLinearGradient(0, 0, 512, 512);
      gradient.addColorStop(0, emptySlotColor);
      gradient.addColorStop(1, '#333333');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);
      
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

    if (isLoading) {
      // Loading material
      return new THREE.MeshStandardMaterial({
        color: '#666666',
        transparent: true,
        opacity: 0.5,
      });
    }

    // Photo material
    return new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      color: new THREE.Color(brightness, brightness, brightness),
    });
  }, [texture, emptySlotColor, brightness, isLoading, hasError]);

  return (
    <mesh
      ref={meshRef}
      material={material}
      castShadow
      receiveShadow
      position={photo.position}
      rotation={photo.rotation}
    >
      <planeGeometry args={[size, size]} />
    </mesh>
  );
};

// Grid pattern generator
const generateGridPattern = (photos: Photo[], settings: any) => {
  const { photoCount, photoSize = 1 } = settings;
  const cols = Math.ceil(Math.sqrt(photoCount));
  const rows = Math.ceil(photoCount / cols);
  const spacing = photoSize * 1.2;
  
  const photosWithPositions: PhotoWithPosition[] = [];
  
  // First, add all actual photos
  photos.forEach((photo, index) => {
    if (index < photoCount) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = (col - (cols - 1) / 2) * spacing;
      const z = (row - (rows - 1) / 2) * spacing;
      
      photosWithPositions.push({
        ...photo,
        position: [x, 0, z],
        rotation: [0, 0, 0],
        slotIndex: index,
      });
    }
  });
  
  // Then add empty slots for remaining positions
  for (let i = photos.length; i < photoCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols - 1) / 2) * spacing;
    const z = (row - (rows - 1) / 2) * spacing;
    
    photosWithPositions.push({
      id: `placeholder-${i}`,
      collage_id: '',
      url: '',
      created_at: '',
      position: [x, 0, z],
      rotation: [0, 0, 0],
      slotIndex: i,
    });
  }
  
  return photosWithPositions;
};

// Float pattern generator
const generateFloatPattern = (photos: Photo[], settings: any) => {
  const { photoCount, photoSize = 1 } = settings;
  const photosWithPositions: PhotoWithPosition[] = [];
  
  photos.forEach((photo, index) => {
    if (index < photoCount) {
      const angle = (index / photoCount) * Math.PI * 2;
      const radius = 5 + (index % 3) * 2;
      const height = Math.sin(index * 0.5) * 3;
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      photosWithPositions.push({
        ...photo,
        position: [x, height, z],
        rotation: [0, angle, 0],
        slotIndex: index,
      });
    }
  });
  
  // Add empty slots
  for (let i = photos.length; i < photoCount; i++) {
    const angle = (i / photoCount) * Math.PI * 2;
    const radius = 5 + (i % 3) * 2;
    const height = Math.sin(i * 0.5) * 3;
    
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    photosWithPositions.push({
      id: `placeholder-${i}`,
      collage_id: '',
      url: '',
      created_at: '',
      position: [x, height, z],
      rotation: [0, angle, 0],
      slotIndex: i,
    });
  }
  
  return photosWithPositions;
};

// PhotoController component that manages photo positioning
const PhotoController: React.FC<{
  photos: Photo[];
  settings: any;
  onPhotosWithPositions: (photos: PhotoWithPosition[]) => void;
}> = ({ photos, settings, onPhotosWithPositions }) => {
  const [photosWithPositions, setPhotosWithPositions] = useState<PhotoWithPosition[]>([]);
  const lastPhotoCount = useRef(0);
  const lastPhotoIds = useRef<string>('');

  // CRITICAL: Recalculate positions when photos change
  const updatePositions = useCallback(() => {
    console.log('🔄 Updating photo positions - Photos:', photos.length, 'Pattern:', settings.animationPattern);
    
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
    
    console.log('✅ Generated positions for', newPhotosWithPositions.length, 'photos');
    setPhotosWithPositions(newPhotosWithPositions);
    onPhotosWithPositions(newPhotosWithPositions);
  }, [photos, settings, onPhotosWithPositions]);

  // Update when photos array changes (including deletions)
  useEffect(() => {
    const currentPhotoIds = photos.map(p => p.id).sort().join(',');
    const photoCountChanged = photos.length !== lastPhotoCount.current;
    const photoIdsChanged = currentPhotoIds !== lastPhotoIds.current;
    
    if (photoCountChanged || photoIdsChanged) {
      console.log('📸 Photos changed - Count:', photos.length, 'IDs changed:', photoIdsChanged);
      lastPhotoCount.current = photos.length;
      lastPhotoIds.current = currentPhotoIds;
      updatePositions();
    }
  }, [photos, updatePositions]);

  // Update when settings change
  useEffect(() => {
    updatePositions();
  }, [settings.animationPattern, settings.photoCount, settings.photoSize, updatePositions]);

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

// Main CollageScene component
const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
  const [photosWithPositions, setPhotosWithPositions] = useState<PhotoWithPosition[]>([]);
  const sceneKey = useRef(0);

  // CRITICAL: Force re-render when photos change significantly
  useEffect(() => {
    console.log('🔄 CollageScene received photos update:', photos.length, 'photos');
    console.log('📸 Current photo IDs:', photos.map(p => p.id.slice(-4)));
    
    // Increment scene key to force React to recreate photo meshes
    sceneKey.current += 1;
  }, [photos]);

  // CRITICAL: Also listen to lastRefreshTime for forced updates
  const { lastRefreshTime } = useCollageStore();
  useEffect(() => {
    console.log('🔄 Scene force refresh triggered:', lastRefreshTime);
    sceneKey.current += 1;
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
          photos={photos}
          settings={settings}
          onPhotosWithPositions={setPhotosWithPositions}
        />
        
        {/* CRITICAL: Use unique keys and force re-render with sceneKey */}
        <group key={`scene-${sceneKey.current}`}>
          {photosWithPositions.map((photo, index) => (
            <PhotoMesh
              key={`${photo.id}-${sceneKey.current}`} // Unique key that changes when scene updates
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