import React, { useMemo } from 'react';

const Spotlights: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const spotlightPositions = useMemo(() => {
    const radius = settings.spotlightDistance;
    const height = settings.spotlightHeight;
    
    // Calculate positions for 4 corners
    return [
      [-radius, height, -radius], // Back Left
      [radius, height, -radius],  // Back Right
      [-radius, height, radius],  // Front Left
      [radius, height, radius],   // Front Right
    ];
  }, [settings.spotlightDistance, settings.spotlightHeight]);

  return (
    <>
      {spotlightPositions.map((position, index) => (
        <SpotLight
          key={index}
          position={position}
          angle={settings.spotlightAngle}
          penumbra={settings.spotlightPenumbra}
          intensity={settings.spotlightIntensity}
          color={settings.spotlightColor}
          distance={settings.spotlightDistance * 2}
          attenuation={2}
          anglePower={8}
          target-position={[0, -2, 0]} // Target center of floor
        />
      ))}
    </>
  );
};

export default Spotlights