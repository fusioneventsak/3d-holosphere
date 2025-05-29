import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Grid, Plane, Html } from '@react-three/drei';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';
import { getStockPhotos } from '../../lib/stockPhotos';

// Function to strip cache-busting parameters from URLs
const stripCacheBustingParams = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    const cleanParams = new URLSearchParams();
    Array.from(params.entries()).forEach(([key, value]) => {
      if (key !== 't') cleanParams.append(key, value);
    });
    urlObj.search = cleanParams.toString();
    return urlObj.toString();
  } catch (e) {
    console.warn('Failed to parse URL:', url, e);
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
  canvas.height = 256;
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
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#ff0000');
  gradient.addColorStop(1, '#550000');
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
  const timestamp = Date.now();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${timestamp}`;
};

// Update the loadTexture function with improved error handling and retries
const loadTexture = (url: string, emptySlotColor: string = '#1A1A1A'): THREE.Texture => {
  if (!url) {
    return createEmptySlotTexture(emptySlotColor);
  }
  
  const cleanUrl = stripCacheBustingParams(url);
  
  if (textureCache.has(cleanUrl)) {
    const entry = textureCache.get(cleanUrl)!;
    entry.lastUsed = Date.now();
    return entry.texture;
  }
  
  const fallbackTexture = createFallbackTexture();
  const placeholderTexture = createEmptySlotTexture('#333333');
  
  let loadUrl = cleanUrl;
  if (cleanUrl.includes('supabase.co/storage/v1/object/public')) {
    loadUrl = addCacheBustToUrl(cleanUrl);
    textureLoader.setCrossOrigin('anonymous');
  }
  
  const loadWithRetry = (attempts = 3) => {
    textureLoader.load(
      loadUrl,
      (loadedTexture) => {
        console.log(`Successfully loaded texture: ${cleanUrl}`);
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.generateMipmaps = false;
        loadedTexture.anisotropy = 1;
        loadedTexture.needsUpdate = true;
        
        placeholderTexture.image = loadedTexture.image;
        placeholderTexture.needsUpdate = true;
      },
      undefined,
      (error) => {
        console.error(`Error loading texture (attempt ${4 - attempts}): ${cleanUrl}`, error);
        
        if (attempts > 1) {
          console.log(`Retrying texture load for: ${cleanUrl}`);
          setTimeout(() => loadWithRetry(attempts - 1), 1000);
        } else {
          console.error(`Failed to load texture after retries: ${cleanUrl}`);
          placeholderTexture.image = fallbackTexture.image;
          placeholderTexture.needsUpdate = true;
        }
      }
    );
  };
  
  loadWithRetry();
  
  placeholderTexture.minFilter = THREE.LinearFilter;
  placeholderTexture.magFilter = THREE.LinearFilter;
  placeholderTexture.generateMipmaps = false;
  placeholderTexture.anisotropy = 1;
  
  textureCache.set(cleanUrl, {
    texture: placeholderTexture,
    lastUsed: Date.now()
  });
  
  return placeholderTexture;
};

// Photo frame component
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

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[1 * scale, 1 * scale]} />
      <meshStandardMaterial
        ref={materialRef}
        map={texture}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
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