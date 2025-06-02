import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';

const SceneBackground: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { scene, gl } = useThree();
  
  useEffect(() => {
    if (settings.backgroundGradient) {
      scene.background = null;
      gl.setClearColor('#000000', 0);
    } else {
      scene.background = new THREE.Color(settings.backgroundColor);
      gl.setClearColor(settings.backgroundColor, 1);
    }
  }, [
    scene, 
    gl, 
    settings.backgroundColor, 
    settings.backgroundGradient,
    settings.backgroundGradientStart,
    settings.backgroundGradientEnd,
    settings.backgroundGradientAngle
  ]);

  return null;
};

export default SceneBackground;