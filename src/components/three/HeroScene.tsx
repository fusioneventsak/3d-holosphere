import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense } from 'react';
import * as THREE from 'three';

// 100 Curated event and party photos - focus on celebrations, gatherings, events where people would use a photobooth app
const DEMO_PHOTOS = [
  // Wedding celebrations and receptions
  'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=400&h=600&fit=crop&crop=center', // wedding reception dancing
  'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=600&fit=crop&crop=center', // wedding party celebration
  'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400&h=600&fit=crop&crop=center', // wedding guests cheering
  'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&h=600&fit=crop&crop=center', // wedding celebration
  'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=600&fit=crop&crop=center', // wedding reception
  
  // Birthday parties and celebrations
  'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=600&fit=crop&crop=center', // birthday party celebration
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400&h=600&fit=crop&crop=center', // birthday party fun
  'https://images.unsplash.com/photo-1647006580781-2b0e9c5bb493?w=400&h=600&fit=crop&crop=center', // birthday celebration
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop&crop=center', // birthday party
  'https://images.unsplash.com/photo-1504196606672-aef5c9cefc92?w=400&h=600&fit=crop&crop=center', // birthday celebration
  
  // Corporate events and office parties
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=600&fit=crop&crop=center', // corporate celebration
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=600&fit=crop&crop=center', // office party
  'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400&h=600&fit=crop&crop=center', // business celebration
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400&h=600&fit=crop&crop=center', // corporate event
  'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=600&fit=crop&crop=center', // office celebration
  
  // Graduation parties
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=600&fit=crop&crop=center', // graduation celebration
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=600&fit=crop&crop=center', // graduation party
  'https://images.unsplash.com/photo-1524159179951-0145ebc03e42?w=400&h=600&fit=crop&crop=center', // graduation fun
  'https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=400&h=600&fit=crop&crop=center', // graduation celebration
  'https://images.unsplash.com/photo-1633113090971-0dd1b7ac37c3?w=400&h=600&fit=crop&crop=center', // graduation party
  
  // Holiday parties and seasonal celebrations
  'https://images.unsplash.com/photo-1512389142860-9c449e58a543?w=400&h=600&fit=crop&crop=center', // holiday party
  'https://images.unsplash.com/photo-1576354302919-96748cb5299e?w=400&h=600&fit=crop&crop=center', // christmas party
  'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=400&h=600&fit=crop&crop=center', // new year celebration
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=600&fit=crop&crop=center', // holiday gathering
  'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=400&h=600&fit=crop&crop=center', // holiday celebration
  
  // House parties and casual gatherings
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=600&fit=crop&crop=center', // house party celebration
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&h=600&fit=crop&crop=center', // house party fun
  'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=400&h=600&fit=crop&crop=center', // friend gathering
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=600&fit=crop&crop=center', // house party
  'https://images.unsplash.com/photo-1564865878688-9a244444042a?w=400&h=600&fit=crop&crop=center', // casual party
  
  // Concerts and music events
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=600&fit=crop&crop=center', // concert crowd
  'https://images.unsplash.com/photo-1516307365426-bea591f05011?w=400&h=600&fit=crop&crop=center', // music festival
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&h=600&fit=crop&crop=center', // concert lights
  'https://images.unsplash.com/photo-1496843916299-590492c751f4?w=400&h=600&fit=crop&crop=center', // festival crowd
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=600&fit=crop&crop=center', // concert party
  
  // Nightclub and nightlife events
  'https://images.unsplash.com/photo-1574391884720-bbc049ec09ad?w=400&h=600&fit=crop&crop=center', // nightclub party
  'https://images.unsplash.com/photo-1520637836862-4d197d17c13a?w=400&h=600&fit=crop&crop=center', // nightlife celebration
  'https://images.unsplash.com/photo-1551818255-e6e10975bc17?w=400&h=600&fit=crop&crop=center', // club party
  'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=400&h=600&fit=crop&crop=center', // nightlife dancing
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=600&fit=crop&crop=center', // club celebration
  
  // Dinner parties and social gatherings
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=600&fit=crop&crop=center', // dinner party
  'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=600&fit=crop&crop=center', // social gathering
  'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=600&fit=crop&crop=center', // dinner celebration
  'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=400&h=600&fit=crop&crop=center', // social event
  'https://images.unsplash.com/photo-1471967183320-ee018f6e114a?w=400&h=600&fit=crop&crop=center', // dinner party
  
  // Baby showers and family celebrations
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=600&fit=crop&crop=center', // baby shower
  'https://images.unsplash.com/photo-1567446537708-ac4aa75c9c28?w=400&h=600&fit=crop&crop=center', // family celebration
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=600&fit=crop&crop=center', // family gathering
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400&h=600&fit=crop&crop=center', // family party
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=600&fit=crop&crop=center', // family event
  
  // Anniversary and milestone celebrations
  'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&h=600&fit=crop&crop=center', // anniversary party
  'https://images.unsplash.com/photo-1485872299829-c673f5194813?w=400&h=600&fit=crop&crop=center', // milestone celebration
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=600&fit=crop&crop=center', // anniversary event
  'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=600&fit=crop&crop=center', // celebration party
  'https://images.unsplash.com/photo-1492447166138-50c3889fccb1?w=400&h=600&fit=crop&crop=center', // milestone event
  
  // Sports celebrations and team events
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=600&fit=crop&crop=center', // sports celebration
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=600&fit=crop&crop=center', // team celebration
  'https://images.unsplash.com/photo-1584646098378-0874589d76b1?w=400&h=600&fit=crop&crop=center', // victory celebration
  'https://images.unsplash.com/photo-1588392382834-a891154bca4d?w=400&h=600&fit=crop&crop=center', // team party
  'https://images.unsplash.com/photo-1589652717406-1c69efaf1ff8?w=400&h=600&fit=crop&crop=center', // sports event
  
  // Fundraising and charity events
  'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?w=400&h=600&fit=crop&crop=center', // charity event
  'https://images.unsplash.com/photo-1594736797933-d0401ba5f9e4?w=400&h=600&fit=crop&crop=center', // fundraising party
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=400&h=600&fit=crop&crop=center', // charity celebration
  'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=400&h=600&fit=crop&crop=center', // fundraising event
  'https://images.unsplash.com/photo-1592650450938-4d8b4b8c7c3b?w=400&h=600&fit=crop&crop=center', // charity gathering
  
  // Group selfies and photo moments
  'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1564865878688-9a244444042a?w=400&h=600&fit=crop&crop=center', // friend selfie
  'https://images.unsplash.com/photo-1584646098378-0874589d76b1?w=400&h=600&fit=crop&crop=center', // group photo
  'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=400&h=600&fit=crop&crop=center', // group selfie
  'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=400&h=600&fit=crop&crop=center', // photo moment
  
  // Festival and outdoor events
  'https://images.unsplash.com/photo-1496843916299-590492c751f4?w=400&h=600&fit=crop&crop=center', // outdoor festival
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=600&fit=crop&crop=center', // festival crowd
  'https://images.unsplash.com/photo-1516307365426-bea591f05011?w=400&h=600&fit=crop&crop=center', // outdoor event
  'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?w=400&h=600&fit=crop&crop=center', // festival celebration
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=600&fit=crop&crop=center', // outdoor party
  
  // Product launches and corporate celebrations
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=600&fit=crop&crop=center', // product launch
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=600&fit=crop&crop=center', // corporate celebration
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400&h=600&fit=crop&crop=center', // business event
  'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=600&fit=crop&crop=center', // company party
  'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400&h=600&fit=crop&crop=center', // corporate fun
  
  // Art galleries and cultural events
  'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=600&fit=crop&crop=center', // art opening
  'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=600&fit=crop&crop=center', // gallery event
  'https://images.unsplash.com/photo-1567446537708-ac4aa75c9c28?w=400&h=600&fit=crop&crop=center', // cultural celebration
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=600&fit=crop&crop=center', // art party
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&h=600&fit=crop&crop=center', // cultural event
  
  // Youth and college parties
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=600&fit=crop&crop=center', // college party
  'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=400&h=600&fit=crop&crop=center', // youth celebration
  'https://images.unsplash.com/photo-1564865878688-9a244444042a?w=400&h=600&fit=crop&crop=center', // student party
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=600&fit=crop&crop=center', // college celebration
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&h=600&fit=crop&crop=center', // youth gathering
  
  // Community events and local celebrations
  'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?w=400&h=600&fit=crop&crop=center', // community event
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=600&fit=crop&crop=center', // local celebration
  'https://images.unsplash.com/photo-1496843916299-590492c751f4?w=400&h=600&fit=crop&crop=center', // community gathering
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=600&fit=crop&crop=center', // local festival
  'https://images.unsplash.com/photo-1516307365426-bea591f05011?w=400&h=600&fit=crop&crop=center', // community party
  
  // Networking events and professional gatherings
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400&h=600&fit=crop&crop=center', // networking event
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=600&fit=crop&crop=center', // professional gathering
  'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=600&fit=crop&crop=center', // business networking
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=600&fit=crop&crop=center', // professional event
  'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400&h=600&fit=crop&crop=center', // business celebration
];

// Fun comments that might appear on photos in a real photobooth collage
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
    hasComment ? 
    PHOTO_COMMENTS[index % PHOTO_COMMENTS.length] : null, 
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
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.anisotropy = 16;
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
    
    // Enhanced floating animation with MORE variance in heights
    // Each photo gets a unique frequency and amplitude
    const baseFreq = 0.5;
    const freqVariance = (index % 17) * 0.1; // More unique frequencies
    const frequency = baseFreq + freqVariance;
    
    const baseAmp = 0.8; // Increased base amplitude
    const ampVariance = (index % 19) * 0.4; // More height variance
    const amplitude = baseAmp + ampVariance;
    
    // Additional wave component for more complex movement
    const secondaryWave = Math.sin(time * (frequency * 1.3) + index * 0.7) * (amplitude * 0.3);
    const primaryWave = Math.sin(time * frequency + index * 0.5) * amplitude;
    
    const floatOffset = primaryWave + secondaryWave;
    
    // Make the entire group (photo + text) face the camera
    groupRef.current.lookAt(state.camera.position);
    
    // Add subtle rotation variation while still facing camera
    const rotationOffset = Math.sin(time * 0.3 + index * 0.3) * 0.05;
    groupRef.current.rotation.z += rotationOffset;
    
    groupRef.current.position.y = position[1] + floatOffset;
  });

  // Only render if texture loaded successfully
  if (!isLoaded || !texture) return null;

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Photo mesh */}
      <mesh>
        <planeGeometry args={[1.2, 1.6]} />
        <meshLambertMaterial map={texture} />
      </mesh>
      
      {/* Comment text if available */}
      {textTexture && (
        <mesh position={[0, 1.2, 0.01]}>
          <planeGeometry args={[2, 0.5]} />
          <meshBasicMaterial map={textTexture} transparent />
        </mesh>
      )}
    </group>
  );
};

// Gradient background sphere for ambient environment
const GradientBackground: React.FC = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime() * 0.1;
    }
  });

  const shaderMaterial = React.useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        colorA: { value: new THREE.Color('#1a0a2e') },
        colorB: { value: new THREE.Color('#16213e') },
        colorC: { value: new THREE.Color('#0f1419') },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 colorA;
        uniform vec3 colorB;
        uniform vec3 colorC;
        varying vec3 vPosition;
        
        void main() {
          float mixer = sin(vPosition.y * 0.5 + time) * 0.5 + 0.5;
          vec3 color = mix(colorA, colorB, mixer);
          color = mix(color, colorC, sin(vPosition.x * 0.3 + time * 0.5) * 0.3 + 0.3);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
  }, []);

  return (
    <mesh>
      <sphereGeometry args={[50, 32, 32]} />
      <primitive object={shaderMaterial} ref={materialRef} />
    </mesh>
  );
};

// Reflective floor component
const ReflectiveFloor: React.FC = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[35, 35]} />
      <meshStandardMaterial
        color="#1a1a2e"
        metalness={0.1}
        roughness={0.7}
        transparent
        opacity={0.3}
      />
    </mesh>
  );
};

// Floor grid for reference
const Floor: React.FC = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[35, 35]} />
      <meshLambertMaterial color="#0a0a0a" transparent opacity={0.1} />
    </mesh>
  );
};

// Grid helper for visual reference
const Grid: React.FC = () => {
  return <gridHelper args={[35, 35, '#333333', '#222222']} position={[0, 0, 0]} />;
};

// Particle system for ambient atmosphere
const ParticleSystem: React.FC = () => {
  const particlesRef = useRef<THREE.Points>(null);
  
  const { positions, colors } = useMemo(() => {
    const count = 500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      // Spread particles across a wider area
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      
      // Purple/blue particle colors
      colors[i * 3] = Math.random() * 0.5 + 0.5;     // R
      colors[i * 3 + 1] = Math.random() * 0.3 + 0.2; // G  
      colors[i * 3 + 2] = Math.random() * 0.8 + 0.7; // B
    }
    
    return { positions, colors };
  }, []);

  useFrame((state) => {
    if (!particlesRef.current) return;
    
    const time = state.clock.getElapsedTime();
    particlesRef.current.rotation.y = time * 0.05;
    
    // Gentle floating motion for particles
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += Math.sin(time + positions[i]) * 0.001;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// Enhanced auto-rotating camera controller with user interaction preservation
const AutoRotatingCamera: React.FC = () => {
  const controlsRef = useRef<any>();
  const { camera } = useThree();
  const isUserInteracting = useRef(false);
  const lastInteractionTime = useRef(0);
  const autoRotationEnabled = useRef(true);
  const savedCameraState = useRef({
    position: new THREE.Vector3(15, 5, 15),
    target: new THREE.Vector3(0, 0, 0)
  });

  // Initialize camera position
  useEffect(() => {
    camera.position.copy(savedCameraState.current.position);
    if (controlsRef.current) {
      controlsRef.current.target.copy(savedCameraState.current.target);
      controlsRef.current.update();
    }
  }, [camera]);

  useFrame((state) => {
    if (!controlsRef.current) return;
    
    const currentTime = Date.now();
    const time = currentTime * 0.0001;
    
    // Check if enough time has passed since last interaction to resume auto-rotation
    const timeSinceInteraction = currentTime - lastInteractionTime.current;
    const shouldAutoRotate = !isUserInteracting.current && timeSinceInteraction > 3000; // 3 seconds delay
    
    if (shouldAutoRotate && autoRotationEnabled.current) {
      // Save current state when starting auto-rotation
      if (timeSinceInteraction === 3000) {
        savedCameraState.current.position.copy(camera.position);
        savedCameraState.current.target.copy(controlsRef.current.target);
      }
      
      // Apply smooth rotation from current position
      const radius = savedCameraState.current.position.distanceTo(savedCameraState.current.target);
      const heightBase = savedCameraState.current.position.y;
      const heightVariation = 1;
      
      // Get current spherical coordinates relative to target
      const offset = new THREE.Vector3().copy(camera.position).sub(controlsRef.current.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      
      // Smooth rotation
      spherical.theta += 0.002; // Slow rotation speed
      spherical.phi += Math.sin(time * 2) * 0.0005; // Subtle vertical variation
      spherical.radius = Math.max(12, Math.min(18, spherical.radius)); // Keep distance in bounds
      
      const newPosition = new THREE.Vector3().setFromSpherical(spherical).add(controlsRef.current.target);
      camera.position.copy(newPosition);
    } else {
      // Update saved state when user is interacting
      savedCameraState.current.position.copy(camera.position);
      savedCameraState.current.target.copy(controlsRef.current.target);
    }
    
    controlsRef.current.update();
  });

  useEffect(() => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    
    const handleStart = () => {
      isUserInteracting.current = true;
      lastInteractionTime.current = Date.now();
      autoRotationEnabled.current = false; // Disable auto-rotation immediately
    };

    const handleEnd = () => {
      isUserInteracting.current = false;
      lastInteractionTime.current = Date.now();
      // Don't re-enable auto-rotation immediately - let the useFrame handle the delay
      setTimeout(() => {
        autoRotationEnabled.current = true;
      }, 1000); // 1 second buffer
    };

    const handleChange = () => {
      // Update saved state during interaction
      savedCameraState.current.position.copy(camera.position);
      savedCameraState.current.target.copy(controls.target);
    };

    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);
    controls.addEventListener('change', handleChange);

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
      controls.removeEventListener('change', handleChange);
    };
  }, [camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
      panSpeed={0.8}
      minDistance={8}
      maxDistance={25}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI - Math.PI / 6}
      enableDamping={true}
      dampingFactor={0.05}
      autoRotate={false} // We're handling rotation manually for better control
    />
  );
};

const Scene: React.FC = () => {
  // Generate photo positions for 100 photos with enhanced wave variance in heights
  const photoPositions = useMemo(() => {
    const positions: Array<{
      position: [number, number, number];
      rotation: [number, number, number];
      imageUrl: string;
    }> = [];

    // Floor is 35x35 units, we want to cover it evenly
    // Let's create a 10x10 grid to get exactly 100 photos
    const gridSize = 10;
    const floorSize = 30; // Slightly smaller than floor to have margin
    const spacing = floorSize / (gridSize - 1); // Even spacing
    
    let photoIndex = 0;
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // Calculate position to center the grid on the floor
        const x = (col - (gridSize - 1) / 2) * spacing;
        const z = (row - (gridSize - 1) / 2) * spacing;
        
        // Add small random offset for organic feel
        const xOffset = (Math.random() - 0.5) * 0.8;
        const zOffset = (Math.random() - 0.5) * 0.8;
        
        // ENHANCED height variance - much more dramatic waves and randomness
        const baseHeight = 1.5;
        
        // Multiple wave layers for complex height patterns
        const primaryWave = Math.sin(row * 0.4) * Math.cos(col * 0.4) * 2.5; // Larger amplitude
        const secondaryWave = Math.sin(row * 0.8 + Math.PI/3) * Math.cos(col * 0.6) * 1.2;
        const tertiaryWave = Math.sin(row * 1.2 + Math.PI/2) * Math.sin(col * 1.1) * 0.8;
        
        // Individual random height for each photo (much more variance)
        const randomHeight = (Math.random() - 0.5) * 3; // Increased from 0.8 to 3
        
        // Distance-based height variation (photos further from center are higher/lower)
        const distanceFromCenter = Math.sqrt((x * x) + (z * z));
        const distanceHeight = Math.sin(distanceFromCenter * 0.3) * 1.5;
        
        const y = baseHeight + primaryWave + secondaryWave + tertiaryWave + randomHeight + distanceHeight;
        
        // Random rotations for natural look
        const rotationX = (Math.random() - 0.5) * 0.4;
        const rotationY = (Math.random() - 0.5) * 0.8;
        const rotationZ = (Math.random() - 0.5) * 0.3;
        
        // Cycle through our curated event photos
        const imageUrl = DEMO_PHOTOS[photoIndex % DEMO_PHOTOS.length];
        photoIndex++;
        
        positions.push({
          position: [x + xOffset, y, z + zOffset] as [number, number, number],
          rotation: [rotationX, rotationY, rotationZ] as [number, number, number],
          imageUrl: imageUrl,
        });
      }
    }
    
    console.log(`Generated ${positions.length} photo positions with enhanced height variance`);
    return positions;
  }, []);

  return (
    <>
      {/* Gradient Background Sphere */}
      <GradientBackground />
      
      {/* ENHANCED LIGHTING SETUP - Complete coverage with no dark spots */}
      
      {/* Strong ambient light base - ensures minimum brightness everywhere */}
      <ambientLight intensity={0.4} color="#ffffff" />
      
      {/* Key Light - Main directional light from above */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.5}
        color="#ffffff"
        castShadow={false}
      />
      
      {/* Fill Light - Opposite side to eliminate shadows */}
      <directionalLight
        position={[-5, 8, -5]}
        intensity={0.3}
        color="#a855f7"
        castShadow={false}
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
        <Canvas
          camera={{ position: [15, 5, 15], fov: 45 }}
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
            gl.toneMappingExposure = 1.2; // Reduced to prevent overexposure
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