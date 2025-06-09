import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';

// Generate 100 party and event photos
const generatePartyPhotos = () => {
  const partyKeywords = [
    'party-celebration', 'birthday-party', 'wedding-party', 'festival-crowd',
    'concert-crowd', 'dance-party', 'new-year-party', 'celebration-event',
    'party-lights', 'nightclub-party', 'outdoor-festival', 'music-festival',
    'party-decorations', 'celebration-confetti', 'party-balloons', 'disco-party',
    'beach-party', 'house-party', 'graduation-party', 'christmas-party'
  ];
  
  const photos = [];
  for (let i = 0; i < 100; i++) {
    const keyword = partyKeywords[i % partyKeywords.length];
    const seed = Math.floor(Math.random() * 10000);
    photos.push(`https://source.unsplash.com/400x600/?${keyword},${seed}`);
  }
  return photos;
};

const DEMO_PHOTOS = generatePartyPhotos();

// Fun comments that might appear on photos
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
  
  // Load texture with error handling and retry mechanism
  React.useEffect(() => {
    const loader = new THREE.TextureLoader();
    let attempts = 0;
    const maxAttempts = 3;
    
    const loadImage = () => {
      // Add timestamp to prevent caching issues
      const urlWithTimestamp = `${imageUrl}&t=${Date.now()}_${attempts}`;
      
      loader.load(
        urlWithTimestamp,
        (loadedTexture) => {
          loadedTexture.minFilter = THREE.LinearFilter;
          loadedTexture.magFilter = THREE.LinearFilter;
          setTexture(loadedTexture);
          setIsLoaded(true);
          setLoadFailed(false);
        },
        undefined,
        (error) => {
          attempts++;
          if (attempts < maxAttempts) {
            // Retry with a different photo
            const newIndex = Math.floor(Math.random() * DEMO_PHOTOS.length);
            imageUrl = DEMO_PHOTOS[newIndex];
            setTimeout(loadImage, 100); // Small delay before retry
          } else {
            console.warn('Failed to load texture after retries:', imageUrl);
            setLoadFailed(true);
            setIsLoaded(true);
          }
        }
      );
    };
    
    loadImage();
    
    return () => {
      if (texture) {
        texture.dispose();
      }
    };
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
    
    // Add subtle rotation variation
    const rotationOffset = Math.sin(time * 0.3 + index * 0.3) * 0.05;
    groupRef.current.rotation.z = rotation[2] + rotationOffset;
    
    groupRef.current.position.y = position[1] + floatOffset;
  });

  // Don't render if failed to load
  if (loadFailed || !isLoaded) {
    return null;
  }

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Main photo - vertical format */}
      <mesh castShadow receiveShadow>
        <planeGeometry args={[1, 1.5]} />
        <meshStandardMaterial 
          map={texture}
          transparent
          side={THREE.DoubleSide}
          metalness={0.05}
          roughness={0.8}
        />
      </mesh>
      
      {/* Comment below photo if exists */}
      {comment && textTexture && (
        <mesh position={[0, -1, 0.01]}>
          <planeGeometry args={[1.2, 0.3]} />
          <meshBasicMaterial 
            map={textTexture} 
            transparent 
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
};

// More prominent gradient background
const GradientBackground: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const gradientMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorTop: { value: new THREE.Color('#9333EA') }, // Bright purple
        colorMid: { value: new THREE.Color('#6B46C1') }, // Medium purple
        colorBottom: { value: new THREE.Color('#000000') }, // Black
        midPoint: { value: 0.5 } // Gradient starts halfway
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
        uniform vec3 colorMid;
        uniform vec3 colorBottom;
        uniform float midPoint;
        varying vec2 vUv;
        void main() {
          vec3 color;
          if (vUv.y < midPoint) {
            // Bottom half - pure black
            color = colorBottom;
          } else {
            // Top half - gradient from purple to bright purple
            float t = (vUv.y - midPoint) / (1.0 - midPoint);
            color = mix(colorMid, colorTop, t);
          }
          gl_FragColor = vec4(color, 1.0);
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

// Interactive controls component
const InteractiveControls: React.FC = () => {
  return (
    <OrbitControls 
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      zoomSpeed={1}
      panSpeed={0.8}
      rotateSpeed={0.5}
      minDistance={3}
      maxDistance={30}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
    />
  );
};

const Scene: React.FC = () => {
  // Generate 100 photo positions with better distribution
  const photoPositions = useMemo(() => {
    return DEMO_PHOTOS.map((photo, index) => {
      // Create a more dynamic distribution for 100 photos
      const layer = Math.floor(index / 20); // 5 layers
      const indexInLayer = index % 20;
      
      let x, y, z;
      
      // Distribute photos in expanding spherical patterns
      const baseAngle = (indexInLayer / 20) * Math.PI * 2;
      const verticalSpread = (Math.random() - 0.5) * Math.PI * 0.6;
      
      if (layer === 0) {
        // Inner sphere
        const radius = 3 + Math.random() * 1;
        x = Math.cos(baseAngle) * Math.cos(verticalSpread) * radius;
        z = Math.sin(baseAngle) * Math.cos(verticalSpread) * radius;
        y = Math.sin(verticalSpread) * radius + 1;
      } else if (layer === 1) {
        // Second layer
        const radius = 5 + Math.random() * 1.5;
        x = Math.cos(baseAngle + 0.2) * Math.cos(verticalSpread) * radius;
        z = Math.sin(baseAngle + 0.2) * Math.cos(verticalSpread) * radius;
        y = Math.sin(verticalSpread) * radius + 1.5;
      } else if (layer === 2) {
        // Third layer
        const radius = 7 + Math.random() * 2;
        x = Math.cos(baseAngle - 0.1) * Math.cos(verticalSpread) * radius;
        z = Math.sin(baseAngle - 0.1) * Math.cos(verticalSpread) * radius;
        y = Math.sin(verticalSpread) * radius + 0.5;
      } else if (layer === 3) {
        // Fourth layer
        const radius = 9 + Math.random() * 2.5;
        x = Math.cos(baseAngle + 0.3) * Math.cos(verticalSpread) * radius;
        z = Math.sin(baseAngle + 0.3) * Math.cos(verticalSpread) * radius;
        y = Math.sin(verticalSpread) * radius + 2;
      } else {
        // Outer scattered photos
        const radius = 11 + Math.random() * 4;
        const randomAngle = baseAngle + (Math.random() - 0.5) * 0.5;
        x = Math.cos(randomAngle) * Math.cos(verticalSpread) * radius;
        z = Math.sin(randomAngle) * Math.cos(verticalSpread) * radius;
        y = Math.sin(verticalSpread) * radius + (Math.random() - 0.5) * 3;
      }
      
      // Add some height variation
      y += Math.sin(index * 0.3) * 1.5;
      
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
      {/* Gradient Background with more prominent purple */}
      <GradientBackground />
      
      {/* Interactive Controls */}
      <InteractiveControls />
      
      {/* Enhanced Lighting */}
      <ambientLight intensity={0.8} color="#6B46C1" />
      
      {/* Main spotlight */}
      <spotLight
        position={[0, 20, 0]}
        angle={Math.PI / 2}
        penumbra={0.2}
        intensity={15}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      
      {/* Purple accent lights */}
      <spotLight
        position={[-10, 10, -10]}
        angle={Math.PI / 3}
        penumbra={0.6}
        intensity={8}
        color="#9333EA"
        castShadow
      />
      
      <spotLight
        position={[10, 8, 10]}
        angle={Math.PI / 4}
        penumbra={0.5}
        intensity={7}
        color="#a855f7"
      />
      
      {/* Fill lights */}
      <directionalLight position={[8, 12, 8]} intensity={4} color="#ffffff" />
      <directionalLight position={[-8, 10, -8]} intensity={3.5} color="#f1f5f9" />
      
      {/* Floating Photos - 100 of them */}
      {photoPositions.map((photo, index) => (
        <FloatingPhoto
          key={index}
          position={photo.position}
          rotation={photo.rotation}
          imageUrl={photo.imageUrl}
          index={index}
        />
      ))}
      
      {/* Purple fog for atmosphere */}
      <fog attach="fog" args={['#6B46C1', 15, 35]} />
    </>
  );
};

// Loading component
const LoadingFallback: React.FC = () => (
  <mesh>
    <sphereGeometry args={[0.1, 8, 8]} />
    <meshBasicMaterial color="#9333EA" />
  </mesh>
);

// Error boundary
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
            gl.toneMappingExposure = 2.2;
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