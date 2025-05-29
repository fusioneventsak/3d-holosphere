import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Grid, Plane, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';
import { getStockPhotos } from '../../lib/stockPhotos';

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
  
  // Create a gradient background
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#ff0000');
  gradient.addColorStop(1, '#550000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add error text
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

// Helper function to strip cache busting parameters from URLs
const stripCacheBustingParams = (url: string): string => {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('t');
    return urlObj.toString();
  } catch (e) {
    return url;
  }
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
  
  // Create a retry function
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
  
  // Start loading with retries
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

// Loading indicator component
const LoadingIndicator = () => {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="text-white text-lg">
        Loading... {progress.toFixed(0)}%
      </div>
    </Html>
  );
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

// Scene content component that uses R3F hooks
const SceneContent: React.FC<{
  photos: Array<{ url: string; id: string }>;
  settings: SceneSettings;
}> = ({ photos, settings }) => {
  const controlsRef = useRef<any>();
  const frameCount = useRef(0);

  // Calculate grid positions
  const positions = useMemo(() => {
    const pos: [number, number, number][] = [];
    const cols = Math.ceil(Math.sqrt(settings.photoCount) * settings.gridAspectRatio);
    const rows = Math.ceil(settings.photoCount / cols);
    const spacing = settings.photoSize + settings.photoSpacing;
    
    for (let i = 0; i < settings.photoCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * spacing;
      const z = (row - (rows - 1) / 2) * spacing;
      const y = settings.wallHeight;
      pos.push([x, y, z]);
    }
    
    return pos;
  }, [settings]);

  // Camera animation
  useFrame((state) => {
    if (settings.cameraEnabled && controlsRef.current) {
      if (settings.animationEnabled) {
        frameCount.current += settings.animationSpeed;
        
        switch (settings.animationPattern) {
          case 'orbit':
            controlsRef.current.setAzimuthalAngle(
              frameCount.current * 0.01 * settings.cameraRotationSpeed
            );
            break;
          case 'wave':
            controlsRef.current.setAzimuthalAngle(
              Math.sin(frameCount.current * 0.01) * settings.cameraRotationSpeed
            );
            break;
          default:
            controlsRef.current.setAzimuthalAngle(
              Math.sin(frameCount.current * 0.005) * settings.cameraRotationSpeed
            );
        }
      }
    }
  });

  return (
    <>
      <LoadingIndicator />
      
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2}
      />
      
      <ambientLight intensity={settings.ambientLightIntensity} />
      
      {Array.from({ length: settings.spotlightCount }).map((_, i) => {
        const angle = (i / settings.spotlightCount) * Math.PI * 2;
        const x = Math.cos(angle) * settings.spotlightDistance;
        const z = Math.sin(angle) * settings.spotlightDistance;
        
        return (
          <spotLight
            key={i}
            position={[x, settings.spotlightHeight, z]}
            angle={settings.spotlightAngle}
            penumbra={settings.spotlightPenumbra}
            intensity={settings.spotlightIntensity}
            color={settings.spotlightColor}
            distance={settings.spotlightDistance * 2}
          />
        );
      })}
      
      {settings.floorEnabled && (
        <Plane
          args={[settings.floorSize, settings.floorSize]}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
        >
          <meshStandardMaterial
            color={settings.floorColor}
            transparent
            opacity={settings.floorOpacity}
            metalness={settings.floorMetalness}
            roughness={settings.floorRoughness}
          />
        </Plane>
      )}
      
      {settings.gridEnabled && (
        <Grid
          args={[settings.gridSize, settings.gridSize, settings.gridDivisions, settings.gridDivisions]}
          position={[0, 0.01, 0]}
          cellColor={settings.gridColor}
          sectionColor={settings.gridColor}
          fadeDistance={settings.cameraDistance * 2}
          fadeStrength={1}
          transparent
          opacity={settings.gridOpacity}
        />
      )}
      
      {positions.map((position, index) => {
        const photo = photos[index];
        const rotation: [number, number, number] = [0, 0, 0];
        
        if (settings.animationEnabled) {
          switch (settings.animationPattern) {
            case 'wave':
              rotation[0] = Math.sin(frameCount.current * 0.02 + index * 0.1) * 0.1;
              break;
            case 'spiral':
              rotation[1] = (index / positions.length) * Math.PI * 2;
              break;
          }
        }
        
        return (
          <PhotoFrame
            key={index}
            position={position}
            rotation={rotation}
            url={photo?.url || ''}
            scale={settings.photoSize}
            emptySlotColor={settings.emptySlotColor}
          />
        );
      })}
    </>
  );
};

// Main CollageScene component
interface CollageSceneProps {
  photos: Array<{ url: string; id: string }>;
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>) => void;
}

const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
  return (
    <Canvas
      style={{ background: settings.backgroundColor }}
      camera={{ position: [0, settings.cameraHeight, settings.cameraDistance], fov: 75 }}
    >
      <SceneContent photos={photos} settings={settings} />
    </Canvas>
  );
};

export default CollageScene;