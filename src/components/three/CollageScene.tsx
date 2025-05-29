import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';

type Photo = {
  id: string;
  url: string;
  collage_id?: string;
};

// Function to strip cache-busting parameters from URLs
const stripCacheBustingParams = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    // Only remove the 't' parameter if it exists
    const params = new URLSearchParams(urlObj.search);
    if (params.has('t')) {
      params.delete('t');
      urlObj.search = params.toString();
    }
    return urlObj.toString();
  } catch (e) {
    console.warn('Failed to parse URL:', url);
    // Return the original URL if parsing fails
    return url;
  }
};

// Create a shared texture loader with memory management
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = new Map<string, { texture: THREE.Texture; lastUsed: number }>();

// Helper function to create an empty slot texture
const createEmptySlotTexture = (color: string = '#1A1A1A'): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 456; // Adjusted for 9:16 aspect ratio
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

// Helper function to create a fallback texture
const createFallbackTexture = (): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 456; // Adjusted for 9:16 aspect ratio
  const ctx = canvas.getContext('2d')!;
  
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#550000');
  gradient.addColorStop(1, '#330000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = 'white';
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Error', canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

// Helper function to add cache busting to URLs
const addCacheBustToUrl = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    const timestamp = Date.now();
    urlObj.searchParams.set('t', timestamp.toString());
    return urlObj.toString();
  } catch (e) {
    console.warn('Failed to add cache bust to URL:', url);
    // If URL parsing fails, append the cache-bust parameter directly
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
  }
};

// Updated loadTexture function with improved error handling
const loadTexture = (url: string, emptySlotColor: string = '#1A1A1A'): THREE.Texture => {
  if (!url) {
    return createEmptySlotTexture(emptySlotColor);
  }

  const cleanUrl = stripCacheBustingParams(url);
  
  // Check cache first
  if (textureCache.has(cleanUrl)) {
    const entry = textureCache.get(cleanUrl)!;
    entry.lastUsed = Date.now();
    return entry.texture;
  }

  // Create initial placeholder texture
  const placeholderTexture = createEmptySlotTexture(emptySlotColor);
  
  // Add to cache immediately with placeholder
  textureCache.set(cleanUrl, {
    texture: placeholderTexture,
    lastUsed: Date.now()
  });

  // Load the image
  const loadUrl = url.includes('supabase.co/storage/v1/object/public') 
    ? addCacheBustToUrl(cleanUrl)
    : cleanUrl;

  // Create a temporary image to test loading
  const tempImage = new Image();
  tempImage.crossOrigin = 'anonymous';
  
  let retryCount = 0;
  const maxRetries = 3;
  
  const loadImage = () => {
    tempImage.onload = () => {
      texture.image = tempImage;
      texture.needsUpdate = true;
      
      // Update cache timestamp
      const entry = textureCache.get(cleanUrl);
      if (entry) {
        entry.lastUsed = Date.now();
      }
    };
    
    tempImage.onerror = () => {
      if (retryCount < maxRetries) {
        retryCount++;
        console.warn(`Retrying image load (${retryCount}/${maxRetries}):`, loadUrl);
        // Add a small delay before retrying
        setTimeout(() => {
          tempImage.src = addCacheBustToUrl(cleanUrl);
        }, 1000 * retryCount);
      } else {
        console.error(`Failed to load image after ${maxRetries} attempts:`, loadUrl);
        const fallbackTexture = createFallbackTexture();
        texture.image = fallbackTexture.image;
        texture.needsUpdate = true;
      }
    };

    tempImage.src = loadUrl;
  };

  // Create and configure the texture
  const texture = new THREE.Texture();
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = 4;

  // Start loading
  loadImage();

  // Clean up old textures from cache
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  for (const [url, entry] of textureCache.entries()) {
    if (now - entry.lastUsed > maxAge) {
      entry.texture.dispose();
      textureCache.delete(url);
    }
  }

  return texture;
};

// Photo frame component with 9:16 aspect ratio
const PhotoFrame: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
  url: string;
  scale: number;
  emptySlotColor: string;
}> = ({ position, rotation, url, scale, emptySlotColor }) => {
  const texture = useMemo(() => loadTexture(url, emptySlotColor), [url, emptySlotColor]);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.map = texture;
      materialRef.current.needsUpdate = true;
    }
  }, [texture]);

  // Use 9:16 aspect ratio for the photo frame
  const width = scale;
  const height = scale * (16/9);

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        ref={materialRef}
        map={texture}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// Floor component
const Floor: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  if (!settings.floorEnabled) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
      <planeGeometry args={[settings.floorSize, settings.floorSize]} />
      <meshStandardMaterial
        color={settings.floorColor}
        transparent
        opacity={settings.floorOpacity}
        metalness={settings.floorMetalness}
        roughness={settings.floorRoughness}
      />
      {settings.gridEnabled && (
        <Grid
          args={[settings.floorSize, settings.floorSize]}
          cellSize={1}
          cellThickness={0.5}
          cellColor={settings.gridColor}
          sectionSize={Math.ceil(settings.gridDivisions / 10)}
          fadeDistance={30}
          fadeStrength={1}
          infiniteGrid={false}
        />
      )}
    </mesh>
  );
};

// PhotosContainer component
const PhotosContainer: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = ({ photos, settings }) => {
  const positions = useMemo(() => {
    const totalPhotos = Math.min(settings.photoCount, 500);
    const gridSize = Math.ceil(Math.sqrt(totalPhotos));
    const spacing = settings.photoSize * (1 + settings.photoSpacing);
    
    return Array.from({ length: totalPhotos }).map((_, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      const x = (col - gridSize / 2) * spacing;
      const y = (row - gridSize / 2) * spacing + settings.wallHeight;
      const z = 0;
      
      return [x, y, z] as [number, number, number];
    });
  }, [settings.photoCount, settings.photoSize, settings.photoSpacing, settings.wallHeight]);

  return (
    <group>
      {positions.map((position, index) => (
        <PhotoFrame
          key={index}
          position={position}
          rotation={[0, 0, 0]}
          url={photos[index]?.url || ''}
          scale={settings.photoSize}
          emptySlotColor={settings.emptySlotColor}
        />
      ))}
    </group>
  );
};

// Scene components that use R3F hooks
const Scene: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = ({ photos, settings }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (camera) {
      camera.position.set(0, settings.cameraHeight, settings.cameraDistance);
      camera.updateProjectionMatrix();
    }
  }, [camera, settings.cameraHeight, settings.cameraDistance]);

  return (
    <>
      <ambientLight intensity={settings.ambientLightIntensity} />
      <PhotosContainer photos={photos} settings={settings} />
      <Floor settings={settings} />
    </>
  );
};

// Main CollageScene component that provides the Canvas
const CollageScene: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
}> = ({ photos, settings, onSettingsChange }) => {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{
          fov: 60,
          near: 0.1,
          far: 2000,
          position: [0, settings.cameraHeight, settings.cameraDistance]
        }}
      >
        <Scene photos={photos} settings={settings} />
        <OrbitControls
          enableZoom={true}
          enablePan={true}
          autoRotate={settings.cameraEnabled && settings.cameraRotationEnabled}
          autoRotateSpeed={settings.cameraRotationSpeed}
        />
      </Canvas>
    </div>
  );
};

export default CollageScene;