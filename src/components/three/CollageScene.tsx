import React, { useRef, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';  // for TextureLoader and constants
import { useCollageStore } from '../../store/collageStore';
import { type SceneSettings } from '../../store/sceneStore';
import { PatternFactory } from './patterns/PatternFactory';
import { addCacheBustToUrl } from '../../lib/supabase'; 

type Photo = {
  id: string;
  url: string;
  collage_id?: string;
};

type CollageSceneProps = {
  photos: Photo[];
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
};

const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings }) => {
  const [photosWithPositions, setPhotosWithPositions] = useState<PhotoWithPosition[]>([]);

  useFrame((state) => {
    const time = settings.animationEnabled ? state.clock.elapsedTime : 0;
    const pattern = PatternFactory.createPattern(settings.animationPattern, settings, photos);
    const patternState = pattern.generatePositions(time);

    const updatedPhotos = photos.map((photo, i) => ({
      ...photo,
      targetPosition: patternState.positions[i] || [0, 0, 0],
      targetRotation: patternState.rotations?.[i] || [0, 0, 0],
      displayIndex: i,
    }));

    setPhotosWithPositions(updatedPhotos);
  });

  return (
    <>
      {photosWithPositions.map((photo) => (
        <PhotoMesh
          key={photo.id}
          photo={photo}
          size={settings.photoSize}
          pattern={settings.animationPattern}
          shouldFaceCamera={settings.photoRotation}
          brightness={settings.photoBrightness}
        />
      ))}
    </>
  );
};

const PhotoMesh: React.FC<{
  photo: PhotoWithPosition;
  size: number;
  pattern: string;
  shouldFaceCamera: boolean;
  brightness: number;
}> = React.memo(({ photo, size, pattern, shouldFaceCamera, brightness }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isInitializedRef = useRef(false);
  const lastPositionRef = useRef<[number, number, number]>([0, 0, 0]);

  useEffect(() => {
    if (!photo.url) {
      setIsLoading(false);
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
      setTexture(loadedTexture);
      setIsLoading(false);
    };

    const handleError = () => {
      console.error('Failed to load image:', photo.url);
      setHasError(true);
      setIsLoading(false);
    };

    const imageUrl = photo.url.includes('?') 
      ? photo.url 
      : addCacheBustToUrl(photo.url);

    loader.load(imageUrl, handleLoad, undefined, handleError);

    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [photo.url]);

  useFrame(() => {
    if (!meshRef.current) return;

    // Initialize position on first frame
    if (!isInitializedRef.current && photo.targetPosition) {
      meshRef.current.position.set(...photo.targetPosition);
      meshRef.current.rotation.set(...(photo.targetRotation || [0, 0, 0]));
      lastPositionRef.current = [...photo.targetPosition];
      isInitializedRef.current = true;
      return;
    }

    const currentPos = meshRef.current.position;
    const targetPos = photo.targetPosition;

    // Handle rotation
    if (shouldFaceCamera) {
      const photoPos = meshRef.current.position;
      const cameraPos = camera.position;
      
      const directionX = cameraPos.x - photoPos.x;
      const directionZ = cameraPos.z - photoPos.z;
      
      const targetRotationY = Math.atan2(directionX, directionZ);
      
      const currentRotY = meshRef.current.rotation.y;
      let rotationDiff = targetRotationY - currentRotY;
      
      if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
      if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
      
      meshRef.current.rotation.y += rotationDiff * 0.1;
      
      const patternRot = photo.targetRotation;
      meshRef.current.rotation.x += (patternRot[0] - meshRef.current.rotation.x) * 0.1;
      meshRef.current.rotation.z += (patternRot[2] - meshRef.current.rotation.z) * 0.1;
    } else {
      const targetRot = photo.targetRotation;
      meshRef.current.rotation.x += (targetRot[0] - meshRef.current.rotation.x) * 0.1;
      meshRef.current.rotation.y += (targetRot[1] - meshRef.current.rotation.y) * 0.1;
      meshRef.current.rotation.z += (targetRot[2] - meshRef.current.rotation.z) * 0.1;
    }
  });

  const material = useMemo(() => {
    const clampedBrightness = Math.max(0.1, Math.min(3, brightness));
    
    if (hasError) {
      return new THREE.MeshStandardMaterial({ 
        color: new THREE.Color('#ff4444'),
        transparent: false,
        roughness: 0.4,
        metalness: 0.0,
        emissive: new THREE.Color('#400000'),
        emissiveIntensity: 0.1
      });
    }
    
    if (isLoading || !texture) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1A1A1A'),
        transparent: false,
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide
      });
    }
    
    return new THREE.MeshStandardMaterial({ 
      map: texture,
      transparent: true,
      roughness: 0,
      metalness: 0,
      emissive: new THREE.Color(1, 1, 1),
      emissiveMap: texture,
      emissiveIntensity: clampedBrightness,
      toneMapped: false,
      side: THREE.DoubleSide
    });
  }, [texture, isLoading, hasError, brightness]);

  return (
    <group ref={meshRef}>
      <mesh castShadow receiveShadow material={material}>
        <planeGeometry args={[size * (9/16), size]} />
      </mesh>
    </group>
  );
});

export default CollageScene;
