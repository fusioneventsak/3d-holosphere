import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Grid, Plane, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';
import { getStockPhotos } from '../../lib/stockPhotos';

type Photo = {
  id: string;
  url: string;
  wall?: 'front' | 'back';
};

const generatePhotoList = (userPhotos: Photo[], maxCount: number, useStockPhotos: boolean, stockPhotos: string[]): Photo[] => {
  console.log(`Generating photo list with ${userPhotos.length} user photos, ${stockPhotos.length} stock photos available`);
  console.log(`useStockPhotos setting: ${useStockPhotos}, photoCount: ${maxCount}`);
  
  // Create a new array with all available user photos (up to maxCount)
  const result = [...userPhotos.slice(0, maxCount)];
  
  // Calculate how many more photos we need
  const photosNeeded = maxCount - result.length;
  console.log(`Need ${photosNeeded} more photos to reach requested count of ${maxCount}`);
  
  // Add stock photos or empty slots based on settings
  if (photosNeeded > 0) {
    if (useStockPhotos && stockPhotos.length > 0) {
      console.log(`Adding ${photosNeeded} stock photos`);
      
      for (let i = 0; i < photosNeeded; i++) {
        const stockIndex = Math.floor(Math.random() * stockPhotos.length);
        const stockUrl = stockPhotos[stockIndex];
        
        result.push({
          id: `stock-${Date.now()}-${i}-${stockIndex}`, // Ensure truly unique IDs
          url: stockUrl
        });
      }
    } else {
      console.log(`Adding ${photosNeeded} empty slots (stock photos disabled or unavailable)`);
      
      for (let i = 0; i < photosNeeded; i++) {
        result.push({
          id: `empty-${Date.now()}-${i}`,
          url: ''
        });
      }
    }
  }
  
  console.log(`Final photo list contains ${result.length} items`);
  return result;
};

// Create gradient background shader
const gradientShader = {
  uniforms: {
    colorA: { value: new THREE.Color() },
    colorB: { value: new THREE.Color() },
    gradientAngle: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 colorA;
    uniform vec3 colorB;
    varying vec2 vUv;
    
    void main() {
      gl_FragColor = vec4(mix(colorA, colorB, 1.0 - vUv.y), 1.0);
    }
  `
};

// Create a shared texture loader with memory management
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = new Map<string, { texture: THREE.Texture; lastUsed: number }>();

// Create a fallback texture for failed loads
const createFallbackTexture = (color: string = '#ff4444'): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384; // 1.5 aspect ratio to match photo dimensions
  const context = canvas.getContext('2d');
  if (context) {
    // Fill with error color
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add a warning icon or text
    context.fillStyle = '#ffffff';
    context.font = 'bold 32px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('!', canvas.width / 2, canvas.height / 2 - 40);
    
    // Add error text
    context.font = '16px sans-serif';
    context.fillText('Image', canvas.width / 2, canvas.height / 2);
    context.fillText('Error', canvas.width / 2, canvas.height / 2 + 24);
  }
  return new THREE.CanvasTexture(canvas);
};

// Create an empty slot texture
const createEmptySlotTexture = (color: string = '#1A1A1A'): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  if (context) {
    // Fill with background color
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add a placeholder icon
    context.strokeStyle = '#ffffff33';
    context.lineWidth = 3;
    context.beginPath();
    context.rect(30, 30, canvas.width - 60, canvas.height - 60);
    context.stroke();
    
    // Add placeholder camera icon
    context.beginPath();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    context.arc(centerX, centerY, 40, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(centerX, centerY, 20, 0, Math.PI * 2);
    context.stroke();
  }
  return new THREE.CanvasTexture(canvas);
};

// Function to remove cache-busting parameters from URLs to prevent duplicates
const stripCacheBustingParams = (url: string): string => {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    
    // Create a new URLSearchParams object from the original search params
    const params = new URLSearchParams(urlObj.search);
    
    // Remove all 't' parameters (cache busting timestamps)
    const paramEntries = Array.from(params.entries());
    const cleanParams = new URLSearchParams();
    
    paramEntries.forEach(([key, value]) => {
      if (key !== 't') {
        cleanParams.append(key, value);
      }
    });
    
    // Rebuild URL without the 't' parameters
    urlObj.search = cleanParams.toString();
    return urlObj.toString();
  } catch (e) {
    // If URL parsing fails, return the original URL
    console.warn('Failed to parse URL:', url, e);
    return url;
  }
};

// Function to add a cache-busting parameter to a URL
const addCacheBustToUrl = (url: string): string => {
  if (!url) return '';
  try {
    // First clean the URL of any existing cache-busting params
    const cleanUrl = stripCacheBustingParams(url);
    const urlObj = new URL(cleanUrl);
    const timestamp = Date.now();
    urlObj.searchParams.append('t', timestamp.toString());
    return urlObj.toString();
  } catch (e) {
    // If URL parsing fails, add the parameter manually
    console.warn('Failed to parse URL for cache busting:', url, e);
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
  }
};

const loadTexture = (url: string, emptySlotColor: string = '#1A1A1A'): THREE.Texture => {
  // For empty slots, create a simple colored texture
  if (!url) {
    return createEmptySlotTexture(emptySlotColor);
  }
  
  // Clean the URL to remove multiple cache-busting parameters
  const cleanUrl = stripCacheBustingParams(url);
  
  // Check if texture is already cached
  if (textureCache.has(cleanUrl)) {
    const entry = textureCache.get(cleanUrl)!;
    entry.lastUsed = Date.now();
    return entry.texture;
  }
  
  // Create new texture
  console.log(`Loading new texture: ${cleanUrl}`);
  
  // Create a fallback texture that will be used if loading fails
  const fallbackTexture = createFallbackTexture();
  
  // Create a placeholder texture to return immediately while loading happens
  const placeholderTexture = createEmptySlotTexture('#333333');
  
  // Add cache-busting parameter for Supabase storage URLs
  let loadUrl = cleanUrl;
  if (cleanUrl.includes('supabase.co/storage/v1/object/public')) {
    loadUrl = addCacheBustToUrl(cleanUrl);
    console.log(`Using cache-busted URL: ${loadUrl}`);
  }
  
  // Load the actual texture
  const texture = textureLoader.load(
    loadUrl,
    (loadedTexture) => {
      console.log(`Successfully loaded texture: ${cleanUrl}`);
      loadedTexture.needsUpdate = true;
      // Update placeholder with loaded texture
      placeholderTexture.image = loadedTexture.image;
      placeholderTexture.needsUpdate = true;
    },
    undefined,
    (error) => {
      console.error(`Error loading texture: ${cleanUrl}`, error);
      
      // Apply the fallback's image to the failed texture
      placeholderTexture.image = fallbackTexture.image;
      placeholderTexture.needsUpdate = true;
    }
  );
  
  // Configure texture settings
  placeholderTexture.minFilter = THREE.LinearFilter;
  placeholderTexture.magFilter = THREE.LinearFilter;
  placeholderTexture.generateMipmaps = false;
  placeholderTexture.anisotropy = 1;
  
  // Cache the placeholder texture
  textureCache.set(cleanUrl, {
    texture: placeholderTexture,
    lastUsed: Date.now()
  });
  
  return placeholderTexture;
};

const cleanupTexture = (url: string) => {
  const cleanUrl = stripCacheBustingParams(url);
  if (textureCache.has(cleanUrl)) {
    const entry = textureCache.get(cleanUrl)!;
    entry.texture.dispose();
    textureCache.delete(cleanUrl);
  }
};

// Cleanup old textures periodically
const cleanupOldTextures = () => {
  const now = Date.now();
  const maxAge = 60000; // 1 minute
  
  for (const [url, entry] of textureCache.entries()) {
    if (now - entry.lastUsed > maxAge) {
      cleanupTexture(url);
    }
  }
};

setInterval(cleanupOldTextures, 30000); // Run cleanup every 30 seconds

// Define floor height as a constant since it's used in multiple components
const FLOOR_HEIGHT = -2;

// Loading overlay component using drei's useProgress
const LoadingOverlay = () => {
  const { active, progress, errors, item, loaded, total } = useProgress();
  
  // Only show while actively loading and if there are items to load
  if (!active && loaded > 0) return null;
  
  return (
    <Html fullscreen>
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
          <p className="text-lg text-white font-medium">Loading scene</p>
          <p className="text-sm text-gray-300 mt-2">
            {loaded} of {Math.max(loaded, total)} items loaded ({Math.round(progress)}%)
          </p>
          {item && (
            <p className="text-xs text-gray-400 mt-1 max-w-md truncate">
              Loading: {item}
            </p>
          )}
          {errors.length > 0 && (
            <p className="text-xs text-red-400 mt-2">
              {errors.length} error{errors.length > 1 ? 's' : ''} occurred
            </p>
          )}
        </div>
      </div>
    </Html>
  );
};

type PhotoPlaneProps = {
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  pattern: 'float' | 'wave' | 'spiral' | 'grid';
  speed: number;
  animationEnabled: boolean;
  size: number;
  settings: SceneSettings;
  photos: Photo[];
  index: number;
  wall?: 'front' | 'back';
};

// Scene setup component with camera initialization
const SceneSetup: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const gradientMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorA: { value: new THREE.Color(settings.backgroundGradientStart) },
        colorB: { value: new THREE.Color(settings.backgroundGradientEnd) }
      },
      vertexShader: gradientShader.vertexShader,
      fragmentShader: gradientShader.fragmentShader,
      depthWrite: false
    });
  }, [settings]);
  
  useEffect(() => {
    gradientMaterial.uniforms.colorA.value.set(settings.backgroundGradientStart);
    gradientMaterial.uniforms.colorB.value.set(settings.backgroundGradientEnd);
  }, [gradientMaterial, settings.backgroundGradientStart, settings.backgroundGradientEnd]);

  const { camera } = useThree();

  useEffect(() => {
    if (camera) {
      camera.position.set(0, settings.cameraHeight, settings.cameraDistance);
      camera.updateProjectionMatrix();
    }
  }, [camera, settings.cameraHeight, settings.cameraDistance]);

  return (
    <>
      {settings.backgroundGradient ? (
        <mesh position={[0, 0, -1]}>
          <planeGeometry args={[2, 2]} />
          <primitive object={gradientMaterial} attach="material" />
        </mesh>
      ) : (
        <color attach="background" args={[settings.backgroundColor]} />
      )}
      <ambientLight intensity={settings.ambientLightIntensity} />
      {Array.from({ length: settings.spotlightCount }).map((_, i) => {
        const angle = (i / settings.spotlightCount) * Math.PI * 2;
        const x = Math.cos(angle) * settings.spotlightDistance;
        const z = Math.sin(angle) * settings.spotlightDistance;
        const target = new THREE.Object3D();
        target.position.set(0, -2, 0); // Target the floor

        return (
          <group key={i}>
            <primitive object={target} />
            <spotLight
              position={[x, settings.spotlightHeight, z]}
              intensity={settings.spotlightIntensity}
              power={20}
              color={settings.spotlightColor}
              angle={Math.min(settings.spotlightAngle * Math.pow(settings.spotlightWidth, 3), Math.PI)}
              decay={1.5}
              penumbra={settings.spotlightPenumbra}
              distance={300}
              target={target}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-bias={0}
            />
          </group>
        );
      })}
    </>
  );
};

// Component for individual photo planes
const PhotoPlane: React.FC<PhotoPlaneProps> = ({ 
  url, 
  position, 
  rotation, 
  pattern, 
  speed, 
  animationEnabled, 
  size, 
  settings, 
  photos, 
  index, 
  wall 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const animationState = useRef({
    time: 0,
    startDelay: Math.random() * Math.PI,
    currentPattern: pattern,
    transitionProgress: 0,
    initialPosition: {
      x: (Math.random() - 0.5) * settings.floorSize * 0.5,
      y: Math.random() * settings.cameraHeight * 0.5,
      z: (Math.random() - 0.5) * settings.floorSize * 0.5
    }
  });
  const { camera, scene } = useThree();
  
  // Reset animation when pattern changes
  useEffect(() => {
    if (animationState.current.currentPattern !== pattern) {
      // Reset animation state for new pattern
      animationState.current = {
        time: 0,
        startDelay: Math.random() * Math.PI,
        currentPattern: pattern,
        transitionProgress: 0,
        initialPosition: {
          x: (Math.random() - 0.5) * settings.floorSize * 0.5,
          y: Math.random() * settings.cameraHeight * 0.5,
          z: (Math.random() - 0.5) * settings.floorSize * 0.5
        }
      };
    }
  }, [pattern, settings.floorSize, settings.cameraHeight]);
  
  // Load texture for this photo - pass emptySlotColor from settings
  const texture = useMemo(() => {
    return loadTexture(url, settings.emptySlotColor);
  }, [url, settings.emptySlotColor]);
  
  // Cleanup texture when component unmounts or URL changes
  useEffect(() => {
    return () => {
      if (url) cleanupTexture(url);
    };
  }, [url]);
  
  useFrame((state, delta) => {
    if (!meshRef.current || !animationEnabled || !camera) return;
    
    // Use consistent time steps for animations
    const timeStep = delta * speed;
    animationState.current.time = Math.fround(animationState.current.time + timeStep);
    
    // Update transition progress
    if (animationState.current.transitionProgress < 1) {
      animationState.current.transitionProgress = Math.min(1, animationState.current.transitionProgress + delta * 2);
    }
    
    const mesh = meshRef.current;
    const phase = animationState.current.time + animationState.current.startDelay;

    const totalPhotos = settings.photoCount;
    const { x: baseX, y: baseY, z: baseZ } = animationState.current.initialPosition;

    // Calculate a minimum height for all patterns to ensure they're above the floor
    // FLOOR_HEIGHT is -2, so adding a minimum of 3 units will position everything at least 1 unit above the floor
    const minHeightAboveFloor = 3;

    switch (pattern) {
      case 'grid': {
        // Grid case scope
        // Calculate grid dimensions
        const baseAspectRatio = settings.gridAspectRatio || 1;
        let gridWidth, gridHeight;
        if (baseAspectRatio >= 1) {
          gridWidth = Math.ceil(Math.sqrt(totalPhotos * baseAspectRatio));
          gridHeight = Math.ceil(totalPhotos / gridWidth);
        } else {
          gridHeight = Math.ceil(Math.sqrt(totalPhotos / baseAspectRatio));
          gridWidth = Math.ceil(totalPhotos / gridHeight);
        }
        
        const horizontalSpacing = settings.photoSize * (1 + settings.photoSpacing);
        const verticalSpacing = settings.photoSize * 1.5 * (1 + settings.photoSpacing);
        
        const row = Math.floor(index / gridWidth);
        const col = index % gridWidth;
        
        const xOffset = ((gridWidth - 1) * horizontalSpacing) * -0.5;
        const yOffset = ((gridHeight - 1) * verticalSpacing) * -0.5;
        
        // Position photos above the floor by minHeightAboveFloor + settings.wallHeight
        const heightAboveFloor = minHeightAboveFloor + settings.wallHeight;
        
        mesh.position.set(
          Math.fround(xOffset + (col * horizontalSpacing)),
          Math.fround(FLOOR_HEIGHT + heightAboveFloor + yOffset + (row * verticalSpacing)),
          0 // Center over the floor
        );
        
        // Keep rotation facing forward
        mesh.rotation.set(0, 0, 0);
        break;
      }

      case 'float': {
        const maxSpread = settings.floorSize * 0.4; // Constrain to floor size
        const verticalRange = settings.cameraHeight * 0.3;
        
        // Calculate height above floor with animation
        const heightAboveFloor = minHeightAboveFloor + Math.sin(phase * 0.5) * verticalRange * animationState.current.transitionProgress;
        
        // Calculate drift motion using baseX and baseZ, constrained to floor bounds
        const maxPosition = settings.floorSize * 0.4;
        const driftX = Math.max(-maxPosition, Math.min(maxPosition, baseX + Math.sin(phase * 0.5) * (maxSpread * 0.2) * animationState.current.transitionProgress));
        const driftZ = Math.max(-maxPosition, Math.min(maxPosition, baseZ + Math.cos(phase * 0.5) * (maxSpread * 0.2) * animationState.current.transitionProgress));
        
        mesh.position.set(
          driftX,
          FLOOR_HEIGHT + heightAboveFloor,
          driftZ
        );
        
        // Look at camera but maintain vertical orientation
        mesh.lookAt(camera.position);
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
        break;
      }

      case 'wave': {
        const waveAmplitude = settings.cameraHeight * 0.2;
        const gridSize = Math.ceil(Math.sqrt(totalPhotos));
        const gridSpacing = Math.min(settings.floorSize / gridSize, settings.photoSize * 3);
        
        // Calculate grid position to distribute over floor
        const col = index % gridSize;
        const row = Math.floor(index / gridSize);
        
        // Center the grid on the floor
        const maxPosition = settings.floorSize * 0.4;
        const xPos = Math.max(-maxPosition, Math.min(maxPosition, 
          Math.fround((col - gridSize / 2) * gridSpacing + baseX * 0.2)
        ));
        const zPos = Math.max(-maxPosition, Math.min(maxPosition, 
          Math.fround((row - gridSize / 2) * gridSpacing + baseZ * 0.2)
        ));
        
        // Calculate wave motion above the floor
        const distance = Math.sqrt(xPos * xPos + zPos * zPos);
        const wavePhase = phase * 0.8 + distance * 0.1;
        const waveY = minHeightAboveFloor + Math.sin(wavePhase) * waveAmplitude * animationState.current.transitionProgress;
        
        // Add slight circular motion
        const circleX = Math.sin(phase * 0.2) * gridSpacing * 0.1 * animationState.current.transitionProgress;
        const circleZ = Math.cos(phase * 0.2) * gridSpacing * 0.1 * animationState.current.transitionProgress;
        
        mesh.position.set(
          xPos + circleX,
          FLOOR_HEIGHT + waveY,
          zPos + circleZ
        );
        
        // Look at camera but maintain vertical orientation
        mesh.lookAt(camera.position);
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
        break;
      }

      case 'spiral': {
        // Constrain spiral to floor size
        const maxRadius = Math.min(settings.floorSize * 0.4, totalPhotos * settings.photoSize * 0.3);
        const maxHeight = settings.cameraHeight * 0.7;
        const angleStep = (Math.PI * 2) / totalPhotos;
        const heightStep = maxHeight / totalPhotos;
        
        const angle = (index * angleStep) + (phase * settings.animationSpeed * animationState.current.transitionProgress);
        const height = (maxHeight * 0.5) - (index * heightStep); // Centered height
        const radius = maxRadius * (1 - (index / totalPhotos)) * 0.8;
        
        const spiralX = Math.fround(Math.cos(angle) * radius * animationState.current.transitionProgress);
        const spiralZ = Math.fround(Math.sin(angle) * radius * animationState.current.transitionProgress);
        
        // Add vertical oscillation, always staying above floor
        const oscillation = Math.sin(phase * 2 + index * 0.1) * 1.5 * animationState.current.transitionProgress;
        
        mesh.position.set(
          spiralX,
          FLOOR_HEIGHT + minHeightAboveFloor + height + oscillation,
          spiralZ
        );
        
        // Look at camera but maintain vertical orientation
        mesh.lookAt(camera.position);
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
        break;
      }
    }
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[size, size * 1.5]} />
      <meshStandardMaterial 
        map={texture}
        side={THREE.DoubleSide}
        transparent={false}
        opacity={1}
        toneMapped={true}
        depthWrite={!url ? true : false}
        depthTest={true}
        metalness={0.1}
        roughness={0.9}
        castShadow
        receiveShadow
        renderOrder={url ? 2 : 1}
      />
    </mesh>
  );
};

// Photos container component
const PhotosContainer: React.FC<{ photos: Photo[], settings: SceneSettings }> = ({ photos, settings }) => {
  const photoProps = useMemo(() => {
    const totalPhotos = photos.length;
    const baseAspectRatio = settings.gridAspectRatio || 1;
    
    // Calculate grid dimensions based on aspect ratio
    let gridWidth, gridHeight;
    if (baseAspectRatio >= 1) {
      // Wider grid
      gridWidth = Math.ceil(Math.sqrt(totalPhotos * baseAspectRatio));
      gridHeight = Math.ceil(totalPhotos / gridWidth);
    } else {
      // Taller grid
      gridHeight = Math.ceil(Math.sqrt(totalPhotos / baseAspectRatio));
      gridWidth = Math.ceil(totalPhotos / gridHeight);
    }
    
    // Calculate spacing
    const photoHeight = settings.photoSize * 1.5;
    const verticalSpacing = photoHeight * (1 + settings.photoSpacing);
    const horizontalSpacing = settings.photoSize * (1 + settings.photoSpacing);
    
    // Initial positions above the floor for the grid pattern
    // These will be overridden by animation logic but provide reasonable starting points
    const minHeightAboveFloor = 3; // At least 3 units above floor
    
    return photos.map((photo, index) => {
      const col = index % gridWidth;
      const row = Math.floor(index / gridWidth);
      
      // Center the grid horizontally and vertically
      const gridXOffset = ((gridWidth - 1) * horizontalSpacing) * -0.5;
      const gridYOffset = ((gridHeight - 1) * verticalSpacing) * -0.5;
      const x = gridXOffset + (col * horizontalSpacing);
      const y = FLOOR_HEIGHT + minHeightAboveFloor + gridYOffset + (row * verticalSpacing);
      
      // Initial position centered over floor
      const position: [number, number, number] = [x, y, 0];
      const rotation: [number, number, number] = [0, 0, 0];
      
      return {
        key: photo.id,
        url: photo.url,
        position,
        rotation,
        pattern: settings.animationPattern,
        speed: settings.animationSpeed,
        animationEnabled: settings.animationEnabled,
        settings: settings,
        size: settings.photoSize,
        photos: photos,
        index: index,
        wall: photo.wall
      };
    });
  }, [photos, settings]);

  return (
    <>
      {photoProps.map((props) => (
        <PhotoPlane 
          key={props.key} 
          {...props} 
        />
      ))}
    </>
  );
};

// Floor component with Grid
const Floor: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { scene } = useThree();
  const [isGridReady, setIsGridReady] = React.useState(false);
  const floorRef = useRef<THREE.Group>(null);

  useEffect(() => {
    // Wait for scene to be ready before enabling grid
    if (scene) {
      const timeout = setTimeout(() => setIsGridReady(true), 100);
      return () => clearTimeout(timeout);
    }
  }, [scene]);

  if (!settings.floorEnabled) return null;

  return (
    <group ref={floorRef} position={[0, FLOOR_HEIGHT, 0]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow={true}
        renderOrder={0}
      >
        <planeGeometry args={[settings.floorSize, settings.floorSize]} />
        <meshStandardMaterial
          color={new THREE.Color(settings.floorColor)}
          transparent
          envMapIntensity={1.0}
          opacity={settings.floorOpacity}
          metalness={settings.floorMetalness}
          roughness={settings.floorRoughness}
          side={THREE.DoubleSide}
          depthWrite={true}
          reflectivity={0.5}
          polygonOffset={true}
          polygonOffsetFactor={-1}
          receiveShadow
        />
      </mesh>
      
      {settings.gridEnabled && isGridReady && (
        <Grid
          position={[0, 0.001, 0]}
          args={[settings.floorSize, settings.floorSize, settings.gridDivisions, settings.gridDivisions]}
          cellSize={1}
          cellThickness={0.6}
          cellColor={settings.gridColor}
          sectionSize={Math.ceil(settings.gridDivisions / 10)}
          fadeDistance={30}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid={false}
          renderOrder={1}
          material-opacity={settings.gridOpacity}
          material-transparent={true}
          material-depthWrite={false}
        />
      )}
    </group>
  );
};

// Camera setup component
const CameraSetup: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (camera) {
      camera.position.set(0, settings.cameraHeight, settings.cameraDistance);
      camera.updateProjectionMatrix();
    }
  }, [camera, settings.cameraHeight, settings.cameraDistance]);

  return null;
};

type CollageSceneProps = {
  photos: Photo[];
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
};

// Main scene component
const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
  const [stockPhotos, setStockPhotos] = useState<string[]>([]);
  const [displayedPhotos, setDisplayedPhotos] = useState<Photo[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStockPhotosFetched, setIsStockPhotosFetched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch stock photos on first render
  useEffect(() => {
    console.log('Fetching stock photos...');
    setIsLoading(true);
    
    getStockPhotos()
      .then(photos => {
        console.log(`Loaded ${photos.length} stock photos`);
        setStockPhotos(photos);
        setIsStockPhotosFetched(true);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to load stock photos:', error);
        setLoadError(`Failed to load stock photos: ${error.message}`);
        setStockPhotos([]); // Use empty array instead of crashing
        setIsStockPhotosFetched(true); // Still mark as fetched even on error
        setIsLoading(false);
      });
  }, []);

  // Generate displayed photo list whenever photos, settings, or stock photos change
  useEffect(() => {
    if (!isStockPhotosFetched) return; // Wait until stock photos are fetched
    
    try {
      console.log('Regenerating displayed photos list...');
      console.log(`Current settings - useStockPhotos: ${settings.useStockPhotos}, photoCount: ${settings.photoCount}`);
      console.log('Available user photos:', photos.length > 0 ? photos : 'None');
      
      // If stock photos are enabled but none were found, automatically disable the option
      if (settings.useStockPhotos && stockPhotos.length === 0) {
        console.warn('Stock photos enabled but none available - using empty slots instead');
        
        // If we have a callback to update settings, use it to disable stock photos
        if (onSettingsChange) {
          onSettingsChange({ useStockPhotos: false });
        }
      }
      
      // Process user photos - don't add any additional cache-busting parameters
      const processedUserPhotos = photos.map(photo => ({
        ...photo,
        url: stripCacheBustingParams(photo.url) // Clean URL before using
      }));
      
      // Create photo list with user photos and stock photos or empty slots
      const userPhotos = Array.isArray(processedUserPhotos) ? processedUserPhotos : [];
      const generatedPhotos = generatePhotoList(
        userPhotos, 
        settings.photoCount, 
        settings.useStockPhotos && stockPhotos.length > 0, // Only use stock photos if available
        stockPhotos
      );
      
      console.log(`Generated ${generatedPhotos.length} photos for display`);
      setDisplayedPhotos(generatedPhotos);
    } catch (error) {
      console.error('Error generating photo list:', error);
      // In case of error, just use the user photos without filling with stock photos
      setDisplayedPhotos(Array.isArray(photos) ? photos : []);
    }
  }, [photos, settings.photoCount, settings.useStockPhotos, stockPhotos, isStockPhotosFetched, onSettingsChange]);

  const handleCreated = ({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.setClearColor(0x000000, 0);
    gl.info.autoReset = true;
    gl.physicallyCorrectLights = true;
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
          <p className="text-lg text-white font-medium">Loading scene</p>
          <p className="text-sm text-gray-300 mt-2">Preparing photo collage...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-900/30 backdrop-blur-sm">
        <div className="text-center max-w-md p-6">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-white mb-2">Failed to load scene</h3>
          <p className="text-red-200 mb-4">{loadError}</p>
          <p className="text-gray-400 text-sm">
            Try disabling stock photos in the settings or reducing the photo count if the issue persists.
          </p>
        </div>
      </div>
    );
  }

  // Log user photos for debugging
  console.log('User photos available for display:', photos.length);
  if (photos.length > 0) {
    console.log('Sample photo URLs:', photos.slice(0, 3).map(p => p.url));
  }

  return (
    <div className="w-full h-full">
      <Canvas
        ref={canvasRef}
        gl={{ 
          antialias: true,
          powerPreference: "high-performance",
          precision: "highp",
          logarithmicDepthBuffer: true
        }}
        dpr={[1, 1.5]}
        frameloop="always"
        performance={{ min: 0.8 }}
        onCreated={handleCreated}
        camera={{
          fov: 60,
          near: 0.1,
          far: 2000,
          position: [0, settings.cameraHeight, settings.cameraDistance]
        }}
      >
        <React.Suspense fallback={null}>
          <LoadingOverlay />
          <CameraSetup settings={settings} />
          <Floor settings={settings} />
          <SceneSetup settings={settings} />
          
          <OrbitControls 
            makeDefault
            enableZoom={true}
            enablePan={true}
            target={[0, 0, 0]}
            autoRotate={settings.cameraEnabled && settings.cameraRotationEnabled}
            autoRotateSpeed={settings.cameraRotationSpeed}
            minDistance={5}
            maxDistance={100}
            minPolarAngle={0}
            maxPolarAngle={Math.PI * 0.85}
            enableDamping={true}
            dampingFactor={0.05}
            rotateSpeed={0.8}
            zoomSpeed={0.8}
            screenSpacePanning={false}
          />
          
          {displayedPhotos.length > 0 && (
            <PhotosContainer photos={displayedPhotos} settings={settings} />
          )}
        </React.Suspense>
      </Canvas>
    </div>
  );
};

export default CollageScene;