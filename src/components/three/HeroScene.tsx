import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';

// Fun party and event photos - groups celebrating, dancing, parties, events (vertical format)
const DEMO_PHOTOS = [
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=600&fit=crop&crop=center', // concert crowd
  'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1574391884720-bbc049ec09ad?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=600&fit=crop&crop=center', // nightlife party
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=600&fit=crop&crop=center', // concert audience
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=600&fit=crop&crop=center', // party fun
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1520637836862-4d197d17c13a?w=400&h=600&fit=crop&crop=center', // nightclub party
  'https://images.unsplash.com/photo-1492447166138-50c3889fccb1?w=400&h=600&fit=crop&crop=center', // friends celebrating
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400&h=600&fit=crop&crop=center', // group party
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=600&fit=crop&crop=center', // celebration cheers
  'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1516307365426-bea591f05011?w=400&h=600&fit=crop&crop=center', // concert party
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=600&fit=crop&crop=center', // party crowd
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=600&fit=crop&crop=center', // celebration event
  'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&h=600&fit=crop&crop=center', // birthday party
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1485872299829-c673f5194813?w=400&h=600&fit=crop&crop=center', // group fun
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400&h=600&fit=crop&crop=center', // celebration party
  'https://images.unsplash.com/photo-1551818255-e6e10975bc17?w=400&h=600&fit=crop&crop=center', // nightlife party
];

// Fun comments that might appear on photos in a real collage
const PHOTO_COMMENTS = [
  "This is so much fun! 🎉",
  "Best night ever! ✨",
  "Squad goals! 💖",
  "Making memories! 📸",
  "Party vibes! 🕺",
  "Love this moment! ❤️",
  "Can't stop laughing! 😂",
  "Epic celebration! 🎊",
  "Good times! 🌟",
  "So happy right now! 😊",
  "Unforgettable! 🙌",
  "Living our best life! 💃"
];

interface PhotoProps {
  position: [number, number, number];
  rotation: [number, number, number];
  imageUrl: string;
  index: number;
}

const FloatingPhoto: React.FC<PhotoProps> = ({ position, rotation, imageUrl, index }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = React.useState<THREE.Texture | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  
  // Randomly decide if this photo should have a comment (about 40% chance)
  const hasComment = React.useMemo(() => Math.random() < 0.4, []);
  const comment = React.useMemo(() => 
    hasComment ? PHOTO_COMMENTS[index % PHOTO_COMMENTS.length] : null, 
    [hasComment, index]
  );
  
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
        setLoadFailed(false);
      },
      undefined,
      (error) => {
        console.warn('Failed to load texture:', imageUrl, error);
        setLoadFailed(true);
        setIsLoaded(true);
      }
    );
  }, [imageUrl]);

  // Create text texture for comments
  const textTexture = React.useMemo(() => {
    if (!comment) return null;
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;
    
    canvas.width = 512;
    canvas.height = 128;
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw rounded rectangle background
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.beginPath();
    context.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 15);
    context.fill();
    
    // Draw text
    context.fillStyle = 'white';
    context.font = 'bold 28px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(comment, canvas.width / 2, canvas.height / 2);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [comment]);

  useFrame((state) => {
    if (!groupRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Floating animation with different frequencies for each photo
    const floatOffset = Math.sin(time * 0.5 + index * 0.5) * 0.3;
    
    // Make the entire group (photo + text) face the camera
    groupRef.current.lookAt(state.camera.position);
    
    // Add subtle rotation variation while still facing camera
    const rotationOffset = Math.sin(time * 0.3 + index * 0.3) * 0.05;
    groupRef.current.rotation.z += rotationOffset;
    
    groupRef.current.position.y = position[1] + floatOffset;
  });

  if (!isLoaded) {
    return null; // Don't render until loaded or failed
  }

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Main photo - vertical format */}
      <mesh castShadow receiveShadow>
        <planeGeometry args={[1, 1.5]} />
        <meshStandardMaterial 
          map={loadFailed ? null : texture}
          transparent
          side={THREE.DoubleSide}
          metalness={0.05}
          roughness={0.8}
          color={loadFailed ? "#ff1493" : "#ffffff"} // Bright fuchsia fallback
        />
      </mesh>
      
      {/* Comment text overlay - attached to photo */}
      {comment && textTexture && (
        <mesh position={[0, -0.9, 0.01]}>
          <planeGeometry args={[1.8, 0.4]} />
          <meshBasicMaterial 
            map={textTexture} 
            transparent 
            alphaTest={0.1}
          />
        </mesh>
      )}
    </group>
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

// Grid component - neon green
const Grid: React.FC = () => {
  const gridHelper = useMemo(() => {
    const helper = new THREE.GridHelper(30, 30, '#00ff41', '#00cc33');
    helper.position.y = -2.99;
    
    const material = helper.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.opacity = 0.8;
    
    return helper;
  }, []);

  return <primitive object={gridHelper} />;
};

// Background gradient component
const GradientBackground: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const gradientMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorTop: { value: new THREE.Color('#4c1d95') }, // Purple
        colorBottom: { value: new THREE.Color('#000000') }, // Black
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 colorTop;
        uniform vec3 colorBottom;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(mix(colorBottom, colorTop, vUv.y), 1.0);
        }
      `,
      side: THREE.BackSide,
    });
  }, []);

  return (
    <mesh ref={meshRef} material={gradientMaterial}>
      <sphereGeometry args={[50, 32, 32]} />
    </mesh>
  );
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
      {/* Gradient Background Sphere */}
      <GradientBackground />
      
      {/* Lighting Setup - Even Brighter with Dramatic Spotlight */}
      <ambientLight intensity={0.8} color="#2d1b69" />
      
      {/* MAIN DRAMATIC SPOTLIGHT from directly above */}
      <spotLight
        position={[0, 20, 0]}
        angle={Math.PI / 2}
        penumbra={0.2}
        intensity={15}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={25}
      />
      
      {/* Secondary spotlight for extra brightness */}
      <spotLight
        position={[0, 15, 5]}
        angle={Math.PI / 3}
        penumbra={0.4}
        intensity={10}
        color="#f8fafc"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      
      {/* Fill lights for overall illumination */}
      <directionalLight 
        position={[8, 12, 8]} 
        intensity={4}
        color="#ffffff"
      />
      
      <directionalLight 
        position={[-8, 10, -8]} 
        intensity={3.5}
        color="#f1f5f9"
      />
      
      {/* Purple accent lights - enhanced */}
      <spotLight
        position={[-10, 10, -10]}
        angle={Math.PI / 3}
        penumbra={0.6}
        intensity={6}
        color="#8b5cf6"
        castShadow
        shadow-mapSize={[512, 512]}
      />
      
      <spotLight
        position={[10, 8, 10]}
        angle={Math.PI / 4}
        penumbra={0.5}
        intensity={5}
        color="#a855f7"
        shadow-mapSize={[512, 512]}
      />
      
      {/* Front fill light to eliminate shadows on photos */}
      <pointLight 
        position={[0, 5, 12]} 
        intensity={6} 
        color="#ffffff" 
        distance={20}
        decay={1.5}
      />
      
      {/* Additional overhead fill lights */}
      <pointLight 
        position={[5, 18, 0]} 
        intensity={4} 
        color="#ffffff" 
        distance={15}
        decay={2}
      />
      
      <pointLight 
        position={[-5, 18, 0]} 
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
      
      {/* Purple gradient fog for depth and atmosphere */}
      <fog attach="fog" args={['#2d1b69', 18, 40]} />
    </>
  );
};

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

const LoadingFallback: React.FC = () => (
  <mesh>
    <sphereGeometry args={[0.1, 8, 8]} />
    <meshBasicMaterial color="#8b5cf6" />
  </mesh>
);

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
            gl.toneMappingExposure = 2.2; // Increased for dramatic brightness
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