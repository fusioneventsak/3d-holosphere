import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';
import { getFileUrl } from '../../lib/supabase';

type Photo = {
  id: string;
  url: string;
  collage_id?: string;
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
    console.log('URL structure analysis:', {
      fullUrl: url,
      host: urlObj.host,
      pathname: urlObj.pathname,
      pathSegments: pathParts,
      searchParams: Object.fromEntries(urlObj.searchParams.entries())
    });
  } catch (e) {
    console.warn('Failed to parse URL for structure logging:', url, e);
  }
};

// Helper function to create an empty slot texture
const createEmptySlotTexture = (color: string = '#1A1A1A'): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 456; // Using 9:16 aspect ratio
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

// Helper function to create an error texture
const createErrorTexture = (): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 456; // Using 9:16 aspect ratio
  const ctx = canvas.getContext('2d')!;
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#222222');
  gradient.addColorStop(1, '#111111');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Error icon (simple X)
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 6;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const iconSize = 40;
  
  ctx.beginPath();
  ctx.moveTo(centerX - iconSize, centerY - iconSize);
  ctx.lineTo(centerX + iconSize, centerY + iconSize);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX + iconSize, centerY - iconSize);
  ctx.lineTo(centerX - iconSize, centerY + iconSize);
  ctx.stroke();
  
  // Error text
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Image Error', centerX, centerY + 70);
  
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
    console.warn('Failed to add cache bust to URL:', url, e);
    // Fallback: append the cache-bust parameter directly
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
  }
};

// Check if URL is a Supabase storage URL
const isSupabaseStorageUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.includes('/storage/v1/object/public/');
  } catch (e) {
    return false;
  }
};

// Extract collage ID and file path from Supabase URL
const extractSupabaseInfo = (url: string): { collageId: string | null; filePath: string | null } => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const publicIndex = pathParts.indexOf('public');
    
    if (publicIndex !== -1 && publicIndex + 2 < pathParts.length) {
      const bucket = pathParts[publicIndex + 1];
      const collageId = pathParts[publicIndex + 2];
      const filePath = pathParts.slice(publicIndex + 2).join('/');
      return { collageId, filePath };
    }
    
    return { collageId: null, filePath: null };
  } catch (e) {
    console.warn('Failed to extract Supabase info from URL:', url);
    return { collageId: null, filePath: null };
  }
};

// Helper function to normalize file extensions in URLs
const normalizeFileExtension = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    
    // Check if this is a path that might have an extension
    const pathname = urlObj.pathname;
    const lastDotIndex = pathname.lastIndexOf('.');
    
    if (lastDotIndex !== -1) {
      // Extract the extension
      const extension = pathname.substring(lastDotIndex);
      // Create a lowercase version
      const lowercaseExt = extension.toLowerCase();
      
      // If the extension is not already lowercase, replace it
      if (extension !== lowercaseExt) {
        const newPathname = pathname.substring(0, lastDotIndex) + lowercaseExt;
        urlObj.pathname = newPathname;
        console.log(`Normalized file extension: ${extension} -> ${lowercaseExt}`);
        return urlObj.toString();
      }
    }
    
    return url;
  } catch (e) {
    console.warn('Failed to normalize file extension:', url, e);
    return url;
  }
};

// Extract filename from URL
const extractFilename = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    return pathParts[pathParts.length - 1].split('?')[0];
  } catch (e) {
    console.warn('Failed to extract filename from URL:', url, e);
    return '';
  }
};

// Enhanced loadTexture function with better error handling and optimizations
const loadTexture = (url: string, collageId?: string, emptySlotColor: string = '#1A1A1A'): THREE.Texture => {
  if (!url) {
    return createEmptySlotTexture(emptySlotColor);
  }
  
  // Handle Supabase URLs specifically
  if (isSupabaseStorageUrl(url)) {
    // Normalize file extensions to lowercase to prevent case sensitivity issues
    url = normalizeFileExtension(url);
    
    const info = extractSupabaseInfo(url);
    
    // If we have a collage ID but it doesn't match the URL's collage ID, regenerate the URL
    if (collageId && info.collageId && collageId !== info.collageId) {
      console.warn(`URL has incorrect collage ID: ${info.collageId}, should be: ${collageId}`);
      
      // Try to extract the file name
      const fileName = extractFilename(url);
      
      if (fileName) {
        // Regenerate URL through Supabase's getFileUrl function
        const bucket = 'photos';
        const newPath = `${collageId}/${fileName}`;
        url = getFileUrl(bucket, newPath);
        
        // Also normalize this URL's file extension
        url = normalizeFileExtension(url);
        
        console.log(`Regenerated URL: ${url}`);
      }
    }
  }
  
  // Add cache busting for storage URLs
  const loadUrl = isSupabaseStorageUrl(url) ? addCacheBustToUrl(url) : url;
  
  // Use the URL without cache busting as the cache key
  const cacheKey = url;
  
  // Check texture cache
  if (textureCache.has(cacheKey)) {
    const entry = textureCache.get(cacheKey)!;
    entry.lastUsed = Date.now();
    return entry.texture;
  }
  
  // Create placeholder texture and add it to cache immediately
  const placeholderTexture = createEmptySlotTexture('#333333');
  textureCache.set(cacheKey, {
    texture: placeholderTexture,
    lastUsed: Date.now()
  });
  
  // Create a texture object
  const texture = new THREE.Texture();
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  
  // Create a temporary Image for loading
  const tempImage = new Image();
  tempImage.crossOrigin = 'anonymous';
  
  // Try different case variations of the extension if it's a Supabase URL
  const tryVariations = (originalUrl: string, retryCount: number = 0) => {
    if (isSupabaseStorageUrl(originalUrl) && retryCount > 0) {
      try {
        const urlObj = new URL(originalUrl);
        const pathname = urlObj.pathname;
        const lastDotIndex = pathname.lastIndexOf('.');
        
        if (lastDotIndex !== -1) {
          // Get the extension and filename
          const extension = pathname.substring(lastDotIndex + 1).split('?')[0];
          const filenameWithoutExt = pathname.substring(0, lastDotIndex);
          
          // Try different case variations
          let newExt;
          if (extension === extension.toLowerCase()) {
            // If current is lowercase, try uppercase
            newExt = extension.toUpperCase();
          } else {
            // If current is uppercase, try lowercase
            newExt = extension.toLowerCase();
          }
          
          // Create new URL with different extension case
          urlObj.pathname = `${filenameWithoutExt}.${newExt}`;
          return urlObj.toString();
        }
      } catch (e) {
        console.warn('Failed to create URL variation:', originalUrl, e);
      }
    }
    return originalUrl;
  };
  
  // Handle successful image load
  tempImage.onload = () => {
    console.log(`Successfully loaded image: ${loadUrl}`);
    texture.image = tempImage;
    texture.needsUpdate = true;
    
    // Update the cached texture
    if (textureCache.has(cacheKey)) {
      const entry = textureCache.get(cacheKey)!;
      entry.texture = texture;
      entry.lastUsed = Date.now();
    } else {
      textureCache.set(cacheKey, {
        texture: texture,
        lastUsed: Date.now()
      });
    }
    
    // Update the placeholder texture to show the loaded image
    placeholderTexture.image = tempImage;
    placeholderTexture.needsUpdate = true;
  };
  
  // Handle image load errors with retries
  let retryCount = 0;
  const maxRetries = 3;
  
  const attemptLoad = () => {
    tempImage.onerror = (error) => {
      console.error(`Error loading image (attempt ${retryCount + 1}/${maxRetries}):`, loadUrl, error);
      
      // Log additional diagnostics
      logUrlStructure(loadUrl);
      
      if (retryCount < maxRetries - 1) {
        retryCount++;
        
        // Try a different URL variation based on file extension case
        const variationUrl = tryVariations(loadUrl, retryCount);
        const retryWithVariation = variationUrl !== loadUrl;
        
        setTimeout(() => {
          console.log(`Retrying load (${retryCount}/${maxRetries}) ${retryWithVariation ? 'with extension case variation' : 'with new URL'}...`);
          
          // Generate a fresh URL with cache busting
          let retryUrl;
          if (retryWithVariation) {
            retryUrl = addCacheBustToUrl(variationUrl);
          } else {
            retryUrl = isSupabaseStorageUrl(url) ? addCacheBustToUrl(normalizeFileExtension(url)) : url;
          }
          
          tempImage.src = retryUrl;
        }, 1000 * retryCount); // Increase delay with each retry
      } else {
        console.error(`Failed to load image after ${maxRetries} attempts:`, loadUrl);
        
        // Replace with error texture
        const errorTexture = createErrorTexture();
        texture.image = errorTexture.image;
        texture.needsUpdate = true;
        
        // Update placeholder
        placeholderTexture.image = errorTexture.image;
        placeholderTexture.needsUpdate = true;
      }
    };
    
    tempImage.src = loadUrl;
  };
  
  // Start the loading process
  attemptLoad();
  
  // Cleanup old textures from cache (ones not used for over 5 minutes)
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  Array.from(textureCache.entries())
    .filter(([key, entry]) => now - entry.lastUsed > maxAge)
    .forEach(([key, entry]) => {
      entry.texture.dispose();
      textureCache.delete(key);
    });
  
  return placeholderTexture;
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