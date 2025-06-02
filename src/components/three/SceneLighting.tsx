import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { type SceneSettings } from '../../store/sceneStore';

type VolumetricSpotlightProps = {
  position: [number, number, number];
  target: [number, number, number];
  angle: number;
  color: string;
  intensity: number;
  distance: number;
  penumbra: number;
};

const VolumetricSpotlight: React.FC<VolumetricSpotlightProps> = ({
  position,
  target,
  angle,
  color,
  intensity,
  distance,
  penumbra
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const coneGeometry = useMemo(() => {
    const height = distance * 1.5;
    const radius = Math.tan(angle) * height;
    return new THREE.ConeGeometry(radius, height, 32, 1, true);
  }, [angle, distance]);

  const material = useMemo(() => {
    const scaledIntensity = intensity * 0.0002;
    
    return new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(color) },
        intensity: { value: scaledIntensity },
        penumbra: { value: penumbra },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float intensity;
        uniform float penumbra;
        varying vec3 vPosition;
        
        void main() {
          float gradient = 1.0 - (vPosition.y + 0.5);
          gradient = pow(gradient, 1.5 + penumbra);
          
          float radialFade = 1.0 - length(vPosition.xz) * (1.8 + penumbra * 0.4);
          radialFade = clamp(radialFade, 0.0, 1.0);
          radialFade = pow(radialFade, 1.0 + penumbra);
          
          float alpha = gradient * radialFade * intensity;
          alpha = clamp(alpha, 0.0, 0.4);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [color, intensity, penumbra]);

  useFrame(() => {
    if (!meshRef.current) return;
    
    meshRef.current.position.set(...position);
    
    const direction = new THREE.Vector3(...target).sub(new THREE.Vector3(...position));
    meshRef.current.lookAt(new THREE.Vector3(...position).add(direction));
    meshRef.current.rotateX(-Math.PI / 2);
  });

  return <mesh ref={meshRef} geometry={coneGeometry} material={material} />;
};

const SceneLighting: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useThree();

  const spotlights = useMemo(() => {
    const lights = [];
    const count = Math.min(settings.spotlightCount, 4);
    const angleStep = (Math.PI * 2) / count;
    
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      
      const distanceVariation = 0.9 + Math.random() * 0.2;
      const heightVariation = 0.95 + Math.random() * 0.1;
      
      const x = Math.cos(angle) * settings.spotlightDistance * distanceVariation;
      const z = Math.sin(angle) * settings.spotlightDistance * distanceVariation;
      const y = settings.spotlightHeight * heightVariation;
      
      lights.push({
        key: `spotlight-${i}`,
        position: [x, y, z] as [number, number, number],
        target: [0, settings.wallHeight / 2, 0] as [number, number, number],
        angleVariation: 0.95 + Math.random() * 0.1,
        intensityVariation: 0.9 + Math.random() * 0.2,
      });
    }
    return lights;
  }, [settings.spotlightCount, settings.spotlightDistance, settings.spotlightHeight, settings.wallHeight]);

  return (
    <group ref={groupRef}>
      <ambientLight 
        intensity={settings.ambientLightIntensity} 
        color="#ffffff" 
      />
      
      <fog attach="fog" args={['#000000', 30, 250]} />
      
      <directionalLight
        position={[20, 30, 20]}
        intensity={0.4}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0001}
      />
      
      {spotlights.map((light) => {
        const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());
        targetRef.current.position.set(...light.target);
        
        const adjustedAngle = settings.spotlightWidth * light.angleVariation;
        const baseIntensity = settings.spotlightIntensity * 0.2;
        const adjustedIntensity = baseIntensity * light.intensityVariation;
        
        return (
          <group key={light.key}>
            <spotLight
              position={light.position}
              target={targetRef.current}
              angle={Math.max(0.1, adjustedAngle)}
              penumbra={settings.spotlightPenumbra}
              intensity={adjustedIntensity * 5}
              color={settings.spotlightColor}
              distance={settings.spotlightDistance * 2}
              decay={1.5}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-camera-near={0.5}
              shadow-camera-far={settings.spotlightDistance * 4}
              shadow-bias={-0.0001}
              power={100}
              shadow-camera-fov={Math.max(30, Math.min(120, adjustedAngle * 180 / Math.PI * 2))}
            />
            <VolumetricSpotlight
              position={light.position}
              target={light.target}
              angle={adjustedAngle}
              color={settings.spotlightColor}
              intensity={settings.spotlightIntensity * light.intensityVariation}
              distance={settings.spotlightDistance}
              penumbra={settings.spotlightPenumbra}
            />
            <primitive object={targetRef.current} />
          </group>
        );
      })}
    </group>
  );
};

export default SceneLighting;