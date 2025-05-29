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
  // Create a new array with all available user photos (up to maxCount)
  const result = [...userPhotos.slice(0, maxCount)];
  
  // Calculate how many more photos we need
  const photosNeeded = maxCount - result.length;
  
  // Add stock photos or empty slots based on settings
  if (photosNeeded > 0) {
    if (useStockPhotos && stockPhotos.length > 0) {
      for (let i = 0; i < photosNeeded; i++) {
        const stockIndex = Math.floor(Math.random() * stockPhotos.length);
        const stockUrl = stockPhotos[stockIndex];
        
        result.push({
          id: `stock-${Date.now()}-${i}-${stockIndex}`,
          url: stockUrl
        });
      }
    } else {
      for (let i = 0; i < photosNeeded; i++) {
        result.push({
          id: `empty-${Date.now()}-${i}`,
          url: ''
        });
      }
    }
  }
  
  return result;
};

// Create a shared texture loader with memory management
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = new Map<string, { texture: THREE.Texture; lastUsed: number }>();

// Create a fallback texture for failed loads
const createFallbackTexture = (color: string = '#ff4444'): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.font = 'bold 32px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('!', canvas.width / 2, canvas.height / 2 - 40);
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
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#ffffff33';
    context.lineWidth = 3;
    context.beginPath();
    context.rect(30, 30, canvas.width - 60, canvas.height - 60);
    context.stroke();
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

// Function to remove cache-busting parameters from URLs
const stripCacheBustingParams = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    params.delete('t');
    urlObj.search = params.toString();
    return urlObj.toString();
  } catch (e) {
    return url;
  }
};

// Function to add a cache-busting parameter to a URL
const addCacheBustToUrl = (url: string): string => {
  if (!url) return '';
  try {
    const cleanUrl = stripCacheBustingParams(url);
    const urlObj = new URL(cleanUrl);
    urlObj.searchParams.append('t', Date.now().toString());
    return urlObj.toString();
  } catch (e) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
  }
};

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
  }
  
  textureLoader.load(
    loadUrl,
    (loadedTexture) => {
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
      console.error(`Error loading texture: ${cleanUrl}`, error);
      placeholderTexture.image = fallbackTexture.image;
      placeholderTexture.needsUpdate = true;
    }
  );
  
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
  const maxAge = 60000;
  
  for (const [url, entry] of textureCache.entries()) {
    if (now - entry.lastUsed > maxAge) {
      cleanupTexture(url);
    }
  }
};

setInterval(cleanupOldTextures, 30000);

const FLOOR_HEIGHT = -2;

const LoadingOverlay = () => {
  const { active, progress, errors, item, loaded, total } = useProgress();
  
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

const SceneSetup: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const gradientMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorA: { value: new THREE.Color(settings.backgroundGradientStart) },
        colorB: { value: new THREE.Color(settings.backgroundGradientEnd) }
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
      `,
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
        target.position.set(0, -2, 0);

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
  const { camera } = useThree();
  
  useEffect(() => {
    if (animationState.current.currentPattern !== pattern) {
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
  
  const texture = useMemo(() => {
    return loadTexture(url, settings.emptySlotColor);
  }, [url, settings.emptySlotColor]);
  
  useEffect(() => {
    return () => {
      if (url) cleanupTexture(url);
    };
  }, [url]);
  
  useFrame((state, delta) => {
    if (!meshRef.current || !animationEnabled || !camera) return;
    
    const timeStep = delta * speed;
    animationState.current.time = Math.fround(animationState.current.time + timeStep);
    
    if (animationState.current.transitionProgress < 1) {
      animationState.current.transitionProgress = Math.min(1, animationState.current.transitionProgress + delta * 2);
    }
    
    const mesh = meshRef.current;
    const phase = animationState.current.time + animationState.current.startDelay;

    const totalPhotos = settings.photoCount;
    const { x: baseX, y: baseY, z: baseZ } = animationState.current.initialPosition;

    const minHeightAboveFloor = 3;

    switch (pattern) {
      case 'grid': {
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
        
        const heightAboveFloor = minHeightAboveFloor + settings.wallHeight;
        
        mesh.position.set(
          Math.fround(xOffset + (col * horizontalSpacing)),
          Math.fround(FLOOR_HEIGHT + heightAboveFloor + yOffset + (row * verticalSpacing)),
          0
        );
        
        mesh.rotation.set(0, 0, 0);
        break;
      }

      case 'float': {
        const maxSpread = settings.floorSize * 0.4;
        const verticalRange = settings.cameraHeight * 0.3;
        
        const heightAboveFloor = minHeightAboveFloor + Math.sin(phase * 0.5) * verticalRange * animationState.current.transitionProgress;
        
        const maxPosition = settings.floorSize * 0.4;
        const driftX = Math.max(-maxPosition, Math.min(maxPosition, baseX + Math.sin(phase * 0.5) * (maxSpread * 0.2) * animationState.current.transitionProgress));
        const driftZ = Math.max(-maxPosition, Math.min(maxPosition, baseZ + Math.cos(phase * 0.5) * (maxSpread * 0.2) * animationState.current.transitionProgress));
        
        mesh.position.set(
          driftX,
          FLOOR_HEIGHT + heightAboveFloor,
          driftZ
        );
        
        mesh.lookAt(camera.position);
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
        break;
      }

      case 'wave': {
        const waveAmplitude = settings.cameraHeight * 0.2;
        const gridSize = Math.ceil(Math.sqrt(totalPhotos));
        const gridSpacing = Math.min(settings.floorSize / gridSize, settings.photoSize * 3);
        
        const col = index % gridSize;
        const row = Math.floor(index / gridSize);
        
        const maxPosition = settings.floorSize * 0.4;
        const xPos = Math.max(-maxPosition, Math.min(maxPosition, 
          Math.fround((col - gridSize / 2) * gridSpacing + baseX * 0.2)
        ));
        const zPos = Math.max(-maxPosition, Math.min(maxPosition, 
          Math.fround((row - gridSize / 2) * gridSpacing + baseZ * 0.2)
        ));
        
        const distance = Math.sqrt(xPos * xPos + zPos * zPos);
        const wavePhase = phase * 0.8 + distance * 0.1;
        const waveY = minHeightAboveFloor + Math.sin(wavePhase) * waveAmplitude * animationState.current.transitionProgress;
        
        const circleX = Math.sin(phase * 0.2) * gridSpacing * 0.1 * animationState.current.transitionProgress;
        const circleZ = Math.cos(phase * 0.2) * gridSpacing * 0.1 * animationState.current.transitionProgress;
        
        mesh.position.set(
          xPos + circleX,
          FLOOR_HEIGHT + waveY,
          zPos + circleZ
        );
        
        mesh.lookAt(camera.position);
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
        break;
      }

      case 'spiral': {
        const maxRadius = Math.min(settings.floorSize * 0.4, totalPhotos * settings.photoSize * 0.3);
        const maxHeight = settings.cameraHeight * 0.7;
        const angleStep = (Math.PI * 2) / totalPhotos;
        const heightStep = maxHeight / totalPhotos;
        
        const angle = (index * angleStep) + (phase * settings.animationSpeed * animationState.current.transitionProgress);
        const height = (maxHeight * 0.5) - (index * heightStep);
        const radius = maxRadius * (1 - (index / totalPhotos)) * 0.8;
        
        const spiralX = Math.fround(Math.cos(angle) * radius * animationState.current.transitionProgress);
        const spiralZ = Math.fround(Math.sin(angle) * radius * animationState.current.transitionProgress);
        
        const oscillation = Math.sin(phase * 2 + index * 0.1) * 1.5 * animationState.current.transitionProgress;
        
        mesh.position.set(
          spiralX,
          FLOOR_HEIGHT + minHeightAboveFloor + height + oscillation,
          spiralZ
        );
        
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
        transparent={true}
        opacity={1}
        toneMapped={true}
        depthWrite={true}
        depthTest={true}
        metalness={0.1}
        roughness={0.9}
        castShadow
        receiveShadow
      />
    </mesh>
  );
};

const PhotosContainer: React.FC<{ photos: Photo[], settings: SceneSettings }> = ({ photos, settings }) => {
  const photoProps = useMemo(() => {
    const totalPhotos = photos.length;
    const baseAspectRatio = settings.gridAspectRatio || 1;
    
    let gridWidth, gridHeight;
    if (baseAspectRatio >= 1) {
      gridWidth = Math.ceil(Math.sqrt(totalPhotos * baseAspectRatio));
      gridHeight = Math.ceil(totalPhotos / gridWidth);
    } else {
      gridHeight = Math.ceil(Math.sqrt(totalPhotos / baseAspectRatio));
      gridWidth = Math.ceil(totalPhotos / gridHeight);
    }
    
    const photoHeight = settings.photoSize * 1.5;
    const verticalSpacing = photoHeight * (1 + settings.photoSpacing);
    const horizontalSpacing = settings.photoSize * (1 + settings.photoSpacing);
    
    const minHeightAboveFloor = 3;
    
    return photos.map((photo, index) => {
      const col = index % gridWidth;
      const row = Math.floor(index / gridWidth);
      
      const gridXOffset = ((gridWidth - 1) * horizontalSpacing) * -0.5;
      const gridYOffset = ((gridHeight - 1) * verticalSpacing) * -0.5;
      const x = gridXOffset + (col * horizontalSpacing);
      const y = FLOOR_HEIGHT + minHeightAboveFloor + gridYOffset + (row * verticalSpacing);
      
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

const Floor: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { scene } = useThree();
  const [isGridReady, setIsGridReady] = React.useState(false);
  const floorRef = useRef<THREE.Group>(null);

  useEffect(() => {
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

const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
  const [stockPhotos, setStockPhotos] = useState<string[]>([]);
  const [displayedPhotos, setDisplayedPhotos] = useState<Photo[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStockPhotosFetched, setIsStockPhotosFetched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    
    getStockPhotos()
      .then(photos => {
        setStockPhotos(photos);
        setIsStockPhotosFetched(true);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to load stock photos:', error);
        setLoadError(`Failed to load stock photos: ${error.message}`);
        setStockPhotos([]);
        setIsStockPhotosFetched(true);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!isStockPhotosFetched) return;
    
    try {
      const processedUserPhotos = photos.map(photo => ({
        ...photo,
        url: stripCacheBustingParams(photo.url)
      }));
      
      const userPhotos = Array.isArray(processedUserPhotos) ? processedUserPhotos : [];
      const generatedPhotos = generatePhotoList(
        userPhotos, 
        settings.photoCount, 
        settings.useStockPhotos && stockPhotos.length > 0,
        stockPhotos
      );
      
      setDisplayedPhotos(generatedPhotos);
    } catch (error: any) {
      console.error('Error generating photo list:', error);
      setDisplayedPhotos(Array.isArray(photos) ? photos : []);
    }
  }, [photos, settings.photoCount, settings.useStockPhotos, stockPhotos, isStockPhotosFetched]);

  const handleCreated = ({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.setClearColor(0x000000, 0);
    gl.info.autoReset = true;
    gl.physicallyCorrectLights = true;
  };

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