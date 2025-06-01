import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CollageSettings } from '../../types/supabase';
import { Photo } from '../../types/supabase';

interface CollageSceneProps {
  photos: Photo[];
  settings: CollageSettings;
  onSettingsChange?: (settings: CollageSettings) => void;
}

const CollageScene: React.FC<CollageSceneProps> = ({ photos, settings, onSettingsChange }) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 75 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      {/* Scene content will be implemented in subsequent updates */}
      
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
      />
    </Canvas>
  );
};

export default CollageScene;