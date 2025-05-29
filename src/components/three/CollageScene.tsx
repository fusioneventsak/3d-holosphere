import React, { useRef, useMemo, useEffect, useState } from 'react';
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

// Debug function to log URL structure
const logUrlStructure = (url: string) => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    console.log('URL structure:', {
      fullUrl: url,
      host: urlObj.host,
      pathname: urlObj.pathname,
      pathParts: pathParts,
      collageId: pathParts.length >= 7 ? pathParts[6] : 'not-found',
      fileName: pathParts.length >= 8 ? pathParts[7] : 'not-found'
    });
  } catch (e) {
    console.warn('Failed to parse URL for structure logging:', url);
  }
};

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

// Function to verify and fix Supabase URLs if needed
const ensureCorrectSupabaseUrl = (url: string, collageId?: string): string => {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    
    // Check if this is a Supabase storage URL
    if (urlObj.pathname.includes('/storage/v1/object/public/photos/')) {
      // Log the URL structure for debugging
      logUrlStructure(url);
      
      // Path should be like: /storage/v1/object/public/photos/[collage-id]/[filename]
      const pathParts = urlObj.pathname.split('/');
      const bucketIndex = pathParts.indexOf('photos');
      
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        // The folder after "photos" should be the collage ID
        const urlCollageId = pathParts[bucketIndex + 1];
        
        // If we have a collage ID and it doesn't match the URL, fix it
        if (collageId && urlCollageId !== collageId) {
          console.warn(`URL has incorrect collage ID: ${urlCollageId}, should be: ${collageId}`);
          
          // Replace the collage ID in the path
          pathParts[bucketIndex + 1] = collageId;
          urlObj.pathname = pathParts.join('/');
          return urlObj.toString();
        }
      }
    }
    
    // URL is fine, return as-is
    return url;
  } catch (e) {
    console.warn('Failed to process Supabase URL:', url);
    return url;
  }
};

// Updated loadTexture function with improved error handling
const loadTexture = (url: string, collageId?: string, emptySlotColor: string = '#1A1A1A'): THREE.Texture => {
  if (!url) {
    return createEmptySlotTexture(emptySlotColor);
  }

  // Ensure URL has the correct collage ID folder
  const correctedUrl = ensureCorrectSupabaseUrl(url, collageId);
  
  // Remove cache busting parameter for caching purposes
  const cleanUrl = stripCacheBustingParams(correctedUrl);
  
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

  // Load the image with cache busting
  const loadUrl = correctedUrl.includes('supabase.co/storage/v1/object/public') 
    ? addCacheBustToUrl(cleanUrl)
    : cleanUrl;

  console.log(`Loading texture from: ${loadUrl}`);

  // Create a temporary image to test loading
  const tempImage = new Image();
  tempImage.crossOrigin = 'anonymous';
  
  let retryCount = 0;
  const maxRetries = 3;
  
  const loadImage = () => {
    tempImage.onload = () => {
      console.log(`Successfully loaded image: ${loadUrl}`);
      texture.image = tempImage;
      texture.needsUpdate = true;
      
      // Update cache timestamp
      const entry = textureCache.get(cleanUrl);
      if (entry) {
        entry.lastUsed = Date.now();
      }
    };
    
    tempImage.onerror = (error) => {
      console.error(`Error loading image (attempt ${retryCount + 1}/${maxRetries}):`, loadUrl, error);
      
      if (retryCount < maxRetries) {
        retryCount++;
        console.warn(`Retrying image load (${retryCount}/${maxRetries}):`, loadUrl);
        
        // Add a small delay before retrying with a fresh cache-busting URL
        setTimeout(() => {
          const retryUrl = addCacheBustToUrl(cleanUrl);
          console.log(`Retry #${retryCount} with URL: ${retryUrl}`);
          tempImage.src = retryUrl;
        }, 1000 * retryCount);
      } else {
        console.error(`Failed to load image after ${maxRetries} attempts:`, loadUrl);
        const fallbackTexture = createFallbackTexture();
        texture.image = fallbackTexture.image;
        texture.needsUpdate = true;
        
        // Remove the failed image from the cache to allow future load attempts
        textureCache.delete(cleanUrl);
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
  url: string;
  collageId?: string;
  scale: number;
  emptySlotColor: string;
}> = ({ position, url, collageId, scale, emptySlotColor }) => {
  const texture = useMemo(() => loadTexture(url, collageId, emptySlotColor), [url, collageId, emptySlotColor]);
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
    <mesh position={position} rotation={[0, 0, 0]}>
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

// Floor component with grid
const Floor: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  if (!settings.floorEnabled) return null;

  return (
    <group position={[0, -2, 0]}>
      {/* Floor material */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[settings.floorSize, settings.floorSize]} />
        <meshStandardMaterial
          color={settings.floorColor}
          transparent
          opacity={settings.floorOpacity}
          metalness={settings.floorMetalness}
          roughness={settings.floorRoughness}
        />
      </mesh>
      
      {/* Grid overlay - positioned slightly above the floor */}
      {settings.gridEnabled && (
        <Grid
          position={[0, 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
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
    </group>
  );
};

// Photo wall component
const PhotoWall: React.FC<{
  photos: Photo[];
  settings: SceneSettings;
}> = ({ photos, settings }) => {
  const positions = useMemo(() => {
    const totalPhotos = Math.min(settings.photoCount, 500);
    const aspectRatio = settings.gridAspectRatio;
    const columns = Math.ceil(Math.sqrt(totalPhotos * aspectRatio));
    const rows = Math.ceil(totalPhotos / columns);
    const spacing = settings.photoSize * (1 + settings.photoSpacing);
    
    return Array.from({ length: totalPhotos }).map((_, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = (col - columns / 2) * spacing;
      const y = (rows / 2 - row) * spacing * (16/9); // Adjust for photo aspect ratio
      const z = 0;
      
      return [x, y, z] as [number, number, number];
    });
  }, [settings.photoCount, settings.photoSize, settings.photoSpacing, settings.gridAspectRatio]);

  // Extract collage ID from the first photo
  const collageId = photos.length > 0 ? photos[0].collage_id : undefined;
  
  // Log photo info for debugging
  useEffect(() => {
    if (photos.length > 0) {
      console.log(`Displaying ${photos.length} photos for collage ID: ${collageId}`);
      
      // Log the first few photo URLs for debugging
      photos.slice(0, 3).forEach((photo, index) => {
        console.log(`Photo ${index} URL: ${photo.url}`);
      });
    }
  }, [photos, collageId]);

  return (
    <group position={[0, settings.wallHeight, 0]}>
      {positions.map((position, index) => {
        const photo = index < photos.length ? photos[index] : null;
        return (
          <PhotoFrame
            key={index}
            position={position}
            url={photo?.url || ''}
            collageId={collageId}
            scale={settings.photoSize}
            emptySlotColor={settings.emptySlotColor}
          />
        );
      })}
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
      <PhotoWall photos={photos} settings={settings} />
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
  // Monitor photo loading status
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    if (photos.length > 0 && !loaded) {
      console.log(`CollageScene received ${photos.length} photos`);
      setLoaded(true);
    }
  }, [photos, loaded]);

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