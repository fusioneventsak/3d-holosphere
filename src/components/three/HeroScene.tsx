import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';

// Stock photo URLs of smiling people (using Unsplash for demo)
const DEMO_PHOTOS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1519648023493-d82b5f8d7b8a?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop&crop=face',
];

interface PhotoProps {
  position: [number, number, number];
  rotation: [number, number, number];
  imageUrl: string;
  index: number;
}

const FloatingPhoto: React.FC<PhotoProps> = ({ position, rotation, imageUrl, index }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.Texture>();
  
  // Load texture
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(imageUrl);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    textureRef.current = tex;
    return tex;
  }, [imageUrl]);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Floating animation with different frequencies for each photo
    const floatOffset = Math.sin(time * 0.5 + index * 0.5) * 0.3;
    const rotationOffset = Math.sin(time * 0.3 + index * 0.3) * 0.1;
    
    meshRef.current.position.y = position[1] + floatOffset;
    meshRef.current.rotation.z = rotation[2] + rotationOffset;
    meshRef.current.rotation.x = rotation[0] + Math.sin(time * 0.2 + index * 0.2) * 0.05;
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation} castShadow receiveShadow>
      {/* Photo frame effect - slightly larger and behind */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[1.4, 1.4]} />
        <meshStandardMaterial 
          color="#1a1a1a" 
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
      {/* Main photo */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[1.2, 1.2]} />
        <meshStandardMaterial 
          map={texture} 
          transparent
          side={THREE.DoubleSide}
          metalness={0.1}
          roughness={0.7}
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

// Floor component with reflective material
const Floor: React.FC = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial 
        color="#0a0a0a"
        metalness={0.8}
        roughness={0.2}
        envMapIntensity={0.5}
      />
    </mesh>
  );
};

// Grid component
const Grid: React.FC = () => {
  const gridHelper = useMemo(() => {
    const helper = new THREE.GridHelper(30, 30, '#8b5cf6', '#4c1d95');
    helper.position.y = -2.99;
    
    const material = helper.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.opacity = 0.3;
    
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
      
      {/* Lighting Setup */}
      <ambientLight intensity={0.15} color="#1a0a2e" />
      
      {/* Main spotlight from above */}
      <spotLight
        position={[0, 12, 0]}
        angle={Math.PI / 3}
        penumbra={0.5}
        intensity={3}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={20}
        target-position={[0, 0, 0]}
      />
      
      {/* Purple accent lights */}
      <spotLight
        position={[-8, 8, -8]}
        angle={Math.PI / 4}
        penumbra={0.8}
        intensity={2}
        color="#8b5cf6"
        castShadow
      />
      
      <spotLight
        position={[8, 6, 8]}
        angle={Math.PI / 5}
        penumbra={0.7}
        intensity={1.5}
        color="#a855f7"
      />
      
      {/* Rim lighting */}
      <directionalLight 
        position={[10, 5, -10]} 
        intensity={0.8}
        color="#6366f1"
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
      
      {/* Fog for depth */}
      <fog attach="fog" args={['#0a0a0a', 8, 25]} />
    </>
  );
};

const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      <p className="mt-2 text-sm text-gray-400">Loading 3D experience...</p>
    </div>
  </div>
);

const HeroScene: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas
        camera={{ position: [10, 4, 10], fov: 50 }}
        shadows
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance",
          shadowMap: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2
        }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default HeroScene;