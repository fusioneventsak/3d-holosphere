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

interface CollageSceneProps {
  photos: Array<{ url: string; id: string }>;
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>) => void;
}

const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
  const {
    gridSize = 200,
    floorSize = 200,
    gridColor = '#444444',
    photoSize = 0.8,
    floorColor = '#1A1A1A',
    photoCount = 50,
    wallHeight = 0,
    gridEnabled = true,
    gridOpacity = 1.0,
    cameraHeight = 10,
    floorEnabled = true,
    floorOpacity = 0.8,
    photoSpacing = 0,
    cameraEnabled = true,
    gridDivisions = 30,
    animationSpeed = 0.5,
    cameraDistance = 25,
    emptySlotColor = '#1A1A1A',
    floorMetalness = 0.4,
    floorRoughness = 0.5,
    spotlightAngle = Math.PI / 4,
    spotlightColor = '#ffffff',
    spotlightCount = 2,
    spotlightWidth = 0.8,
    useStockPhotos = true,
    backgroundColor = '#000000',
    gridAspectRatio = 1.5,
    spotlightHeight = 15,
    animationEnabled = false,
    animationPattern = 'grid',
    floorReflectivity = 0.6,
    spotlightDistance = 30,
    spotlightPenumbra = 0.8,
    backgroundGradient = false,
    spotlightIntensity = 100.0,
    cameraRotationSpeed = 0.2,
    ambientLightIntensity = 0.5
  } = settings;

  // Camera controls setup
  const controlsRef = useRef<any>();
  
  // Animation frame counter
  const frameCount = useRef(0);

  // Calculate grid positions
  const positions = useMemo(() => {
    const pos: [number, number, number][] = [];
    const cols = Math.ceil(Math.sqrt(photoCount) * gridAspectRatio);
    const rows = Math.ceil(photoCount / cols);
    const spacing = photoSize + photoSpacing;
    
    for (let i = 0; i < photoCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * spacing;
      const z = (row - (rows - 1) / 2) * spacing;
      const y = wallHeight;
      pos.push([x, y, z]);
    }
    
    return pos;
  }, [photoCount, photoSize, photoSpacing, wallHeight, gridAspectRatio]);

  // Camera animation
  useFrame((state) => {
    if (cameraEnabled && controlsRef.current) {
      if (animationEnabled) {
        frameCount.current += animationSpeed;
        
        // Different animation patterns
        switch (animationPattern) {
          case 'orbit':
            controlsRef.current.setAzimuthalAngle(
              frameCount.current * 0.01 * cameraRotationSpeed
            );
            break;
          case 'wave':
            controlsRef.current.setAzimuthalAngle(
              Math.sin(frameCount.current * 0.01) * cameraRotationSpeed
            );
            break;
          default:
            // Default grid pattern
            controlsRef.current.setAzimuthalAngle(
              Math.sin(frameCount.current * 0.005) * cameraRotationSpeed
            );
        }
      }
    }
  });

  return (
    <Canvas
      style={{ background: backgroundColor }}
      camera={{ position: [0, cameraHeight, cameraDistance], fov: 75 }}
    >
      <LoadingIndicator />
      
      {/* Camera Controls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2}
      />
      
      {/* Lighting */}
      <ambientLight intensity={ambientLightIntensity} />
      
      {Array.from({ length: spotlightCount }).map((_, i) => {
        const angle = (i / spotlightCount) * Math.PI * 2;
        const x = Math.cos(angle) * spotlightDistance;
        const z = Math.sin(angle) * spotlightDistance;
        
        return (
          <spotLight
            key={i}
            position={[x, spotlightHeight, z]}
            angle={spotlightAngle}
            penumbra={spotlightPenumbra}
            intensity={spotlightIntensity}
            color={spotlightColor}
            distance={spotlightDistance * 2}
          />
        );
      })}
      
      {/* Floor */}
      {floorEnabled && (
        <Plane
          args={[floorSize, floorSize]}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
        >
          <meshStandardMaterial
            color={floorColor}
            transparent
            opacity={floorOpacity}
            metalness={floorMetalness}
            roughness={floorRoughness}
          />
        </Plane>
      )}
      
      {/* Grid */}
      {gridEnabled && (
        <Grid
          args={[gridSize, gridSize, gridDivisions, gridDivisions]}
          position={[0, 0.01, 0]}
          cellColor={gridColor}
          sectionColor={gridColor}
          fadeDistance={cameraDistance * 2}
          fadeStrength={1}
          transparent
          opacity={gridOpacity}
        />
      )}
      
      {/* Photos */}
      {positions.map((position, index) => {
        const photo = photos[index];
        const rotation: [number, number, number] = [0, 0, 0];
        
        if (animationEnabled) {
          switch (animationPattern) {
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
            scale={photoSize}
            emptySlotColor={emptySlotColor}
          />
        );
      })}
    </Canvas>
  );
};

export default CollageScene;