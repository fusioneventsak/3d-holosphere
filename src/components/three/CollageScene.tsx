import React, { useRef, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';  // for TextureLoader and constants
import { useCollageStore } from '../../store/collageStore';
import { type SceneSettings } from '../../store/sceneStore';
import { PatternFactory } from './patterns/PatternFactory';
import { addCacheBustToUrl } from '../../lib/supabase';

type CollageSceneProps = {
  photos: Photo[];
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
};

const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Optional: base configuration
  const radius = 50;      // base radius for arrangements
  const baseSize = 8;     // base height of each photo plane (adjust for your scene)
  const waveAmplitude = 10;   // height of wave oscillation
  const waveSpeed = 2;        // speed of wave motion
  const floatSpeed = 2;       // upward floating speed
  const spiralTurns = 2;      // number of twists in the spiral pattern
  const floatSpawnY = -radius;              // y-position where float photos (bubbles) spawn
  const floatDespawnY = radius + 5;         // y-position beyond which bubbles reset

  // Prepare data for float pattern (random positions and speeds for each photo)
  const floatData = useRef<{ x: number, y: number, z: number }[]>([]);
  useEffect(() => {
    if (pattern === 'float') {
      // Initialize random start positions for each photo (within a horizontal circle of "radius")
      floatData.current = photos.map(() => {
        const angle = Math.random() * 2 * Math.PI;
        const r = Math.random() * radius * 0.8;  // random radius (0.8 to keep inside sphere)
        return {
          x: r * Math.cos(angle),
          y: THREE.MathUtils.lerp(floatSpawnY, floatSpawnY * 0.5, Math.random()),  // between bottom and a bit above
          z: r * Math.sin(angle)
        };
      });
    }
  }, [pattern, photos]);

  // Set static positions for grid and spiral patterns whenever pattern or photos change
  useEffect(() => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    if (pattern === 'grid') {
      // Arrange photos in a grid (plane) facing the camera
      const N = photos.length;
      const cols = Math.ceil(Math.sqrt(N));           // number of columns in grid
      const rows = Math.ceil(N / cols);               // number of rows (enough to fit all photos)
      const xSpacing = baseSize * 1.2;
      const ySpacing = baseSize * 1.2;
      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (i >= N) break;
          const child = group.children[i];
          // Center the grid at (0,0), and place each photo
          const xOffset = (cols - 1) / 2;
          const yOffset = (rows - 1) / 2;
          child.position.x = (c - xOffset) * xSpacing;
          child.position.y = (yOffset - r) * ySpacing;
          child.position.z = -radius * 0.5;  // place the grid slightly in front of the center
          i++;
        }
      }
    } else if (pattern === 'spiral') {
      // Arrange photos in a vertical spiral (helix) around the Y-axis
      const N = photos.length;
      for (let i = 0; i < N; i++) {
        const child = group.children[i];
        const t = i / Math.max(N - 1, 1);         // normalized [0,1] along the list
        const angle = 2 * Math.PI * spiralTurns * t;
        child.position.x = radius * 0.6 * Math.cos(angle);
        child.position.z = radius * 0.6 * Math.sin(angle);
        // vertical position from -radius/2 to +radius/2
        child.position.y = THREE.MathUtils.lerp(-radius / 2, radius / 2, t);
      }
    }
  }, [pattern, photos, radius, baseSize, spiralTurns]);

  // Animate wave and float patterns each frame
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    const N = photos.length;
    if (pattern === 'wave') {
      // Photos on a horizontal circle, moving up and down in a wave
      for (let i = 0; i < N; i++) {
        const child = group.children[i];
        // Determine base position on a circle (evenly spaced)
        const angle = (2 * Math.PI * i) / N;
        child.position.x = radius * Math.cos(angle);
        child.position.z = radius * Math.sin(angle);
        child.position.y = Math.sin(state.clock.elapsedTime * waveSpeed + angle) * waveAmplitude;
      }
    } else if (pattern === 'float') {
      // Photos drifting upward like bubbles
      for (let i = 0; i < N; i++) {
        const child = group.children[i];
        if (pattern === 'float') {
          let data = floatData.current[i];
          // Update position
          data.y += floatSpeed * delta;
          if (data.y > floatDespawnY) {
            // If a photo floats above the threshold, reset it to bottom with new random horizontal position
            data.y = floatSpawnY;
            const angle = Math.random() * 2 * Math.PI;
            const r = Math.random() * radius * 0.8;
            data.x = r * Math.cos(angle);
            data.z = r * Math.sin(angle);
          }
          // Apply updated coordinates
          child.position.set(data.x, data.y, data.z);
        }
      }
    }

    // Orient all photos to face the camera each frame for proper viewing
    const cameraPos = state.camera.position;
    group.children.forEach(child => {
      child.lookAt(cameraPos);
    });
  });

  return (
    <group ref={groupRef}>
      {photos.map((photo) => (
        <PhotoMesh key={photo.id} photo={photo} size={baseSize} />
      ))}
    </group>
  );
};

const PhotoMesh: React.FC<{ photo: Photo; size: number }> = React.memo(({ photo, size }) => {
  // Load the photo texture
  const texture = useLoader(THREE.TextureLoader, photo.url);
  // Optionally, ensure correct color space for the texture (if needed in your setup)
  // texture.colorSpace = THREE.SRGBColorSpace;  // uncomment if colors appear off

  return (
    <group>
      <mesh castShadow receiveShadow>
        <planeGeometry args={[size * (9 / 16), size]} /> {/* 9:16 aspect ratio plane */}
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
});

export default CollageScene;
