import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';

// Fun event and nightlife photos - people together having fun, photobooths, selfies
const DEMO_PHOTOS = [
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1506629905607-64af794ab61c?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1492447166138-50c3889fccb1?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1574391884720-bbc049ec09ad?w=400&h=400&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400&h=400&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=400&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1545167622-3a6ac756afa4?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1554727242-741c14fa561c?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=400&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1520637836862-4d197d17c13a?w=400&h=400&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=400&h=400&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=400&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&h=400&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop&crop=center',
];

interface PhotoProps {
  position: [number, number, number];
  rotation: [number, number, number];
  imageUrl: string;
  index: number;
}

const FloatingPhoto: React.FC<PhotoProps> = ({ position, rotation, imageUrl, index }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = React.useState<THREE.Texture | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  
  // Load texture with error handling
  React.useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (loadedTexture) => {
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        setTexture(loadedTexture);
        setIsLoaded(true);
      },
      undefined,
      (error) => {
        console.warn('Failed to load texture:', imageUrl, error);
        setIsLoaded(true); // Still show the frame even if image fails
      }
    );
  }, [imageUrl]);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Floating animation with different frequencies for each photo
    const floatOffset = Math.sin(time * 0.5 + index * 0.5) * 0.3;
    
    // Make photos face the camera
    meshRef.current.lookAt(state.camera.position);
    
    // Add subtle rotation variation while still facing camera
    const rotationOffset = Math.sin(time * 0.3 + index * 0.3) * 0.05;
    meshRef.current.rotation.z += rotationOffset;
    
    meshRef.current.position.y = position[1] + floatOffset;
  });

  if (!isLoaded) {
    return null; // Don't render until loaded or failed
  }

  return (
    <mesh ref={meshRef} position={position} rotation={rotation} castShadow receiveShadow>
      {/* Main photo - no border, clean look */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshStandardMaterial 
          map={texture} 
          transparent
          side={THREE.DoubleSide}
          metalness={0.05}
          roughness={0.8}
          color={texture ? "#ffffff" : "#333333"}
        />
      </mesh>
    </mesh>
  );
};

const ParticleSystem: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const count = 150;
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 25;
      positions[i * 3 + 1] = Math.random() * 15 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    
    return positions;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    
    const time = state.clock.getElapsedTime();
    pointsRef.current.rotation.y = time * 0.03;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={particles}
          count={particles.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#8b5cf6"
        size={0.015}
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
};

// Floor component with reflective material - lighter
const Floor: React.FC = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial 
        color="#1a1a2e"
        metalness={0.7}
        roughness={0.3}
        envMapIntensity={0.8}
      />
    </mesh>
  );
};

// Grid component - brighter
const Grid: React.FC = () => {
  const gridHelper = useMemo(() => {
    const helper = new THREE.GridHelper(30, 30, '#a855f7', '#6b46c1');
    helper.position.y = -2.99;
    
    const material = helper.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.opacity = 0.6;
    
    return helper;
  }, []);

  return <primitive object={gridHelper} />;
};

const CameraController: React.FC = () => {
  const { camera } = useThree();
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    // Smooth camera orbit
    const radius = 8;
    const x = Math.sin(time * 0.1) * radius;
    const z = Math.cos(time * 0.1) * radius;
    
    camera.position.x = x;
    camera.position.z = z;
    camera.position.y = 2;
    camera.lookAt(0, 0, 0);
  });
  
  return null;
};

const Scene: React.FC = () => {
  // Generate photo positions in multiple layers and patterns
  const photoPositions = useMemo(() => {
    return DEMO_PHOTOS.map((photo, index) => {
      // Create multiple layers and patterns
      const layer = Math.floor(index / 8);
      const indexInLayer = index % 8;
      
      let x, y, z;
      
      if (layer === 0) {
        // Inner circle
        const angle = (indexInLayer / 8) * Math.PI * 2;
        const radius = 2.5;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        y = Math.sin(index * 0.8) * 1.5;
      } else if (layer === 1) {
        // Outer circle
        const angle = (indexInLayer / 8) * Math.PI * 2 + Math.PI / 8;
        const radius = 4.5;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        y = Math.sin(index * 0.6) * 2 + 1;
      } else {
        // Additional scattered photos
        const angle = (index / DEMO_PHOTOS.length) * Math.PI * 6;
        const radius = 3 + Math.sin(index * 0.5) * 2;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        y = Math.sin(index * 0.4) * 2.5 + 0.5;
      }
      
      const rotationX = (Math.random() - 0.5) * 0.4;
      const rotationY = (Math.random() - 0.5) * 0.6;
      const rotationZ = (Math.random() - 0.5) * 0.3;
      
      return {
        position: [x, y, z] as [number, number, number],
        rotation: [rotationX, rotationY, rotationZ] as [number, number, number],
        imageUrl: photo,
      };
    });
  }, []);

  return (
    <>
      {/* Background */}
      <color attach="background" args={['#000000']} />
      
      {/* Lighting Setup - Much Brighter */}
      <ambientLight intensity={0.6} color="#4c1d95" />
      
      {/* Main spotlight from above - Much brighter */}
      <spotLight
        position={[0, 12, 0]}
        angle={Math.PI / 2.5}
        penumbra={0.3}
        intensity={8}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={20}
      />
      
      {/* Additional fill lights for better illumination */}
      <directionalLight 
        position={[5, 8, 5]} 
        intensity={3}
        color="#ffffff"
      />
      
      <directionalLight 
        position={[-5, 6, -5]} 
        intensity={2.5}
        color="#f8fafc"
      />
      
      {/* Purple accent lights - brighter */}
      <spotLight
        position={[-8, 8, -8]}
        angle={Math.PI / 3}
        penumbra={0.6}
        intensity={4}
        color="#8b5cf6"
        castShadow
        shadow-mapSize={[512, 512]}
      />
      
      <spotLight
        position={[8, 6, 8]}
        angle={Math.PI / 4}
        penumbra={0.5}
        intensity={3.5}
        color="#a855f7"
        shadow-mapSize={[512, 512]}
      />
      
      {/* Front fill light to illuminate photos */}
      <pointLight 
        position={[0, 3, 8]} 
        intensity={4} 
        color="#ffffff" 
        distance={15}
        decay={2}
      />
      
      {/* Camera Controller */}
      <CameraController />
      
      {/* Floor and Grid */}
      <Floor />
      <Grid />
      
      {/* Particle System */}
      <ParticleSystem />
      
      {/* Floating Photos */}
      {photoPositions.map((photo, index) => (
        <FloatingPhoto
          key={index}
          position={photo.position}
          rotation={photo.rotation}
          imageUrl={photo.imageUrl}
          index={index}
        />
      ))}
      
      {/* Fog for depth - lighter */}
      <fog attach="fog" args={['#1a1a2e', 12, 30]} />
    </>
  );
};

const LoadingFallback: React.FC = () => (
  <mesh>
    <sphereGeometry args={[0.1, 8, 8]} />
    <meshBasicMaterial color="#8b5cf6" />
  </mesh>
);

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/20 to-black/40">
        <div className="text-center text-white/60">
          <div className="w-16 h-16 border-2 border-purple-500/30 rounded-full mx-auto mb-4"></div>
          <p>3D Scene Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const HeroScene: React.FC = () => {
  return (
    <ErrorBoundary>
      <div className="absolute inset-0 w-full h-full">
        <Canvas
          camera={{ position: [10, 4, 10], fov: 50 }}
          shadows
          gl={{ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance"
          }}
          style={{ background: 'transparent' }}
          onCreated={({ gl }) => {
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.8; // Increased exposure for brightness
          }}
        >
          <Suspense fallback={<LoadingFallback />}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>
    </ErrorBoundary>
  );
};

export default HeroScene;