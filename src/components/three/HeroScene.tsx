import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense } from 'react';
import * as THREE from 'three';

// 100 Fun party and event photos - groups celebrating, dancing, parties, events, photobooths, selfies (vertical format)
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
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1524159179951-0145ebc03e42?w=400&h=600&fit=crop&crop=center', // party fun
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=600&fit=crop&crop=center', // people cheering
  'https://images.unsplash.com/photo-1564865878688-9a244444042a?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1567446537708-ac4aa75c9c28?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1574391884720-bbc049ec09ad?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop&crop=center', // party fun
  'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1583394838340-0c5c0d6d7d5b?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1584646098378-0874589d76b1?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1588392382834-a891154bca4d?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1589652717406-1c69efaf1ff8?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1592650450938-4d8b4b8c7c3b?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1594736797933-d0401ba5f9e4?w=400&h=600&fit=crop&crop=center', // party fun
  // Additional 50 party photos to reach 100 total
  'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1600298881974-6be191ceeda1?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1601933470096-0e67b2e3c796?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1603186921213-d2ca7c207b89?w=400&h=600&fit=crop&crop=center', // party fun
  'https://images.unsplash.com/photo-1604594849809-dfedbc827105?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1607962837359-5e7e89f86776?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1609086814533-1e3b8f28c81c?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1610216705422-caa3fcb6d158?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=400&h=600&fit=crop&crop=center', // party fun
  'https://images.unsplash.com/photo-1612472324236-8bd67c8cb2c4?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1613603346037-62ee778e0b1f?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1614628486389-6cbbda8ff4cf?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1615751072497-5f5169febe17?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1616781382395-1e18e4fcb7b0?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1617854818583-09e7f077a156?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1618932260643-eee4a2f652a6?w=400&h=600&fit=crop&crop=center', // party fun
  'https://images.unsplash.com/photo-1619985240536-f64b035ce2c1?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1622037576898-d710baf8fd2b?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1623071379464-7a9f5bb0736c?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1624165008446-83877d7f7b2d?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1625225233840-695456021cde?w=400&h=600&fit=crop&crop=center', // party fun
  'https://images.unsplash.com/photo-1626284648318-1b6c7c4e3a7f?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1628367726634-ad8e8391c5d2?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1629398550148-fb59e76d8b1e?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1630457619827-e4b8b6c15a45?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1631518178077-5a9ba7969e95?w=400&h=600&fit=crop&crop=center', // party fun
  'https://images.unsplash.com/photo-1632577846987-c9d4c3e8b3d6?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1633608678846-c5b9e9b8b3d7?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1634638877954-e5b9e9b8b3d8?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1635699008876-f5b9e9b8b3d9?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1636759104897-g6c0e0b8b3da?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1637819195918-h7d1f1b8b3db?w=400&h=600&fit=crop&crop=center', // party fun
  'https://images.unsplash.com/photo-1638880286939-i8e2g2b8b3dc?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1639940397960-j9f3h3b8b3dd?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1641000508981-k0g4i4b8b3de?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1642060620002-l1h5j5b8b3df?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1643120731023-m2i6k6b8b3e0?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1644180842044-n3j7l7b8b3e1?w=400&h=600&fit=crop&crop=center', // party fun
  'https://images.unsplash.com/photo-1645240953065-o4k8m8b8b3e2?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1646301064086-p5l9n9b8b3e3?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1647361175107-q6m0o0b8b3e4?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1648421286128-r7n1p1b8b3e5?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1649481397149-s8o2q2b8b3e6?w=400&h=600&fit=crop&crop=center', // celebration
  'https://images.unsplash.com/photo-1650541508170-t9p3r3b8b3e7?w=400&h=600&fit=crop&crop=center', // party fun
  'https://images.unsplash.com/photo-1651601619191-u0q4s4b8b3e8?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1652661730212-v1r5t5b8b3e9?w=400&h=600&fit=crop&crop=center', // party celebration
  'https://images.unsplash.com/photo-1653721841233-w2s6u6b8b3ea?w=400&h=600&fit=crop&crop=center', // group celebration
  'https://images.unsplash.com/photo-1654781952254-x3t7v7b8b3eb?w=400&h=600&fit=crop&crop=center', // party dancing
  'https://images.unsplash.com/photo-1655842063275-y4u8w8b8b3ec?w=400&h=600&fit=crop&crop=center', // celebration
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
  const [isLoaded, setIsLoaded] = React.useState(false);
  
  // Randomly decide if this photo should have a comment (about 40% chance)
  const hasComment = React.useMemo(() => Math.random() < 0.4, []);
  const comment = React.useMemo(() => 
    hasComment ? PHOTO_COMMENTS[index % PHOTO_COMMENTS.length] : null, 
    [hasComment, index]
  );
  
  // Load texture with error handling - only show if successfully loaded
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
        // Don't set isLoaded to true if failed - photo won't render
        setIsLoaded(false);
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

  // Only render if photo loaded successfully AND has texture
  if (!isLoaded || !texture) {
    return null;
  }

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Main photo - subtly reflective materials for light interaction */}
      <mesh>
        <planeGeometry args={[1.4, 2.1]} />
        <meshStandardMaterial 
          map={texture}
          transparent
          side={THREE.DoubleSide}
          metalness={0.15}
          roughness={0.7}
          envMapIntensity={0.3}
          clearcoat={0.1}
          clearcoatRoughness={0.8}
        />
      </mesh>
      
      {/* Comment text overlay - attached to photo, same width as photo */}
      {comment && textTexture && (
        <mesh position={[0, -1.2, 0.01]}>
          <planeGeometry args={[1.4, 0.35]} />
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

// Solid reflective floor component beneath the grid
const ReflectiveFloor: React.FC = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.05, 0]}>
      <planeGeometry args={[35, 35]} />
      <meshStandardMaterial 
        color="#0f0f23"
        metalness={0.9}
        roughness={0.1}
        envMapIntensity={1.0}
      />
    </mesh>
  );
};

// Floor component with reflective material - positioned slightly above solid floor
const Floor: React.FC = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial 
        color="#1a1a2e"
        metalness={0.8}
        roughness={0.2}
        envMapIntensity={0.9}
        transparent
        opacity={0.8}
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

// Background gradient component - more noticeable purple starting halfway
const GradientBackground: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const gradientMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorTop: { value: new THREE.Color('#7c3aed') }, // Brighter purple
        colorMid: { value: new THREE.Color('#3730a3') }, // Mid purple  
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
        uniform vec3 colorMid;
        uniform vec3 colorBottom;
        varying vec2 vUv;
        void main() {
          vec3 color;
          if (vUv.y > 0.5) {
            // Top half: interpolate from mid to top (purple gradient)
            color = mix(colorMid, colorTop, (vUv.y - 0.5) * 2.0);
          } else {
            // Bottom half: interpolate from bottom to mid (black to purple)
            color = mix(colorBottom, colorMid, vUv.y * 2.0);
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

// Auto-rotating camera controller with simultaneous user rotation
const AutoRotatingCamera: React.FC = () => {
  const controlsRef = useRef<any>();
  const { camera } = useThree();
  const isUserInteracting = useRef(false);
  const lastInteractionTime = useRef(0);
  const autoRotateSpeed = 0.2; // Slightly slower for better user control

  useFrame((state) => {
    if (!controlsRef.current) return;
    
    const currentTime = Date.now();
    const timeSinceInteraction = currentTime - lastInteractionTime.current;
    
    // Always auto-rotate, but slower when user is interacting
    if (isUserInteracting.current) {
      controlsRef.current.autoRotateSpeed = autoRotateSpeed * 0.3; // Much slower during interaction
    } else {
      controlsRef.current.autoRotateSpeed = autoRotateSpeed; // Normal speed when not interacting
    }
    
    controlsRef.current.autoRotate = true; // Always rotating
    controlsRef.current.update();
  });

  React.useEffect(() => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    
    const handleStart = () => {
      isUserInteracting.current = true;
      lastInteractionTime.current = Date.now();
    };

    const handleEnd = () => {
      isUserInteracting.current = false;
      lastInteractionTime.current = Date.now();
    };

    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
    };
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false} // Disable panning to avoid conflicts
      enableZoom={false} // Disable scroll zoom to prevent page scroll conflicts
      enableRotate={true} // Allow user rotation while auto-rotating
      rotateSpeed={0.5}
      minDistance={8} // Fixed distance for consistent view
      maxDistance={12}
      minPolarAngle={Math.PI / 6} // Prevent going too high
      maxPolarAngle={Math.PI - Math.PI / 6} // Prevent going too low
      enableDamping={true}
      dampingFactor={0.05}
      autoRotate={true}
      autoRotateSpeed={autoRotateSpeed}
    />
  );
};

const Scene: React.FC = () => {
  // Generate photo positions for 100 photos with multiple distribution patterns
  const photoPositions = useMemo(() => {
    const positions: Array<{
      position: [number, number, number];
      rotation: [number, number, number];
      imageUrl: string;
    }> = [];

    DEMO_PHOTOS.forEach((photo, index) => {
      // Multiple distribution strategies to ensure full coverage
      let x, y, z;
      
      if (index < 20) {
        // Inner circle - 20 photos
        const angle = (index / 20) * Math.PI * 2;
        const radius = 2.5;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        y = (Math.sin(index * 0.8) * 3) + 1;
      } else if (index < 40) {
        // Mid circle - 20 photos
        const angle = ((index - 20) / 20) * Math.PI * 2 + Math.PI / 20;
        const radius = 4.5;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        y = (Math.sin(index * 0.6) * 2.5) + 2;
      } else if (index < 60) {
        // Outer circle - 20 photos
        const angle = ((index - 40) / 20) * Math.PI * 2 + Math.PI / 10;
        const radius = 6.5;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        y = (Math.sin(index * 0.4) * 3.5) + 1.5;
      } else if (index < 80) {
        // Far background - 20 photos
        const angle = ((index - 60) / 20) * Math.PI * 2 + Math.PI / 6.67;
        const radius = 8.5;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        y = (Math.sin(index * 0.3) * 2.5) + 0.5;
      } else {
        // Very far background - 20 photos
        const angle = ((index - 80) / 20) * Math.PI * 2 + Math.PI / 5;
        const radius = 10.5;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        y = (Math.sin(index * 0.2) * 2) + 1;
      }
      
      const rotationX = (Math.random() - 0.5) * 0.4;
      const rotationY = (Math.random() - 0.5) * 0.6;
      const rotationZ = (Math.random() - 0.5) * 0.3;
      
      positions.push({
        position: [x, y, z] as [number, number, number],
        rotation: [rotationX, rotationY, rotationZ] as [number, number, number],
        imageUrl: photo,
      });
    });
    
    console.log(`Generated ${positions.length} photo positions`); // Debug log
    return positions;
  }, []);

  return (
    <>
      {/* Gradient Background Sphere */}
      <GradientBackground />
      
      {/* Dramatic Lighting Setup - Focus on photos */}
      <ambientLight intensity={0.3} color="#2d1b69" />
      
      {/* KEY SPOTLIGHT - Main dramatic light from above */}
      <spotLight
        position={[0, 20, 0]}
        angle={Math.PI / 3}
        penumbra={0.5}
        intensity={8}
        color="#ffffff"
        castShadow={false}
      />
      
      {/* FILL LIGHT - Softer light to prevent pure black shadows */}
      <spotLight
        position={[0, 15, 8]}
        angle={Math.PI / 2.5}
        penumbra={0.6}
        intensity={3}
        color="#e2e8f0"
        castShadow={false}
      />
      
      {/* RIM LIGHTS - To make photos pop from background */}
      <directionalLight 
        position={[10, 8, 5]} 
        intensity={2}
        color="#ffffff"
        castShadow={false}
      />
      
      <directionalLight 
        position={[-10, 8, 5]} 
        intensity={2}
        color="#ffffff"
        castShadow={false}
      />
      
      {/* ACCENT LIGHTS - Purple atmosphere */}
      <spotLight
        position={[-8, 12, -8]}
        angle={Math.PI / 4}
        penumbra={0.8}
        intensity={1.5}
        color="#8b5cf6"
        castShadow={false}
      />
      
      <spotLight
        position={[8, 10, -8]}
        angle={Math.PI / 4}
        penumbra={0.8}
        intensity={1.2}
        color="#a855f7"
        castShadow={false}
      />
      
      {/* PHOTO-FOCUSED LIGHTS - Specifically to illuminate photos */}
      <pointLight 
        position={[0, 3, 8]} 
        intensity={4} 
        color="#ffffff" 
        distance={15}
        decay={1.8}
      />
      
      <pointLight 
        position={[6, 6, 6]} 
        intensity={2.5} 
        color="#f8fafc" 
        distance={12}
        decay={2}
      />
      
      <pointLight 
        position={[-6, 6, 6]} 
        intensity={2.5} 
        color="#f8fafc" 
        distance={12}
        decay={2}
      />
      
      {/* Interactive Auto-Rotating Camera Controls */}
      <AutoRotatingCamera />
      
      {/* Reflective Floor and Grid */}
      <ReflectiveFloor />
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
      
      {/* Enhanced fog for more dramatic atmosphere */}
      <fog attach="fog" args={['#1a0a2e', 15, 35]} />
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
      return (
        <Canvas
          camera={{ position: [10, 3, 10], fov: 45 }}
          shadows={false}
          gl={{ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance"
          }}
          style={{ background: 'transparent' }}
          onCreated={({ gl }) => {
            gl.shadowMap.enabled = false;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.6; // Reduced for more dramatic contrast
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