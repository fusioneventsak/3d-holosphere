import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCollageStore } from '../store/collageStore';
import SceneSettings from '../components/collage/SceneSettings';
import CollageScene from '../components/three/CollageScene';
import { useSceneStore } from '../store/sceneStore';

const CollageEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentCollage, fetchCollageById } = useCollageStore();
  const { settings, updateSettings } = useSceneStore();

  useEffect(() => {
    if (id) {
      fetchCollageById(id);
    }
  }, [id, fetchCollageById]);

  const handleSettingsChange = async (newSettings: Partial<typeof settings>) => {
    if (!currentCollage?.id) return;
    
    // Update local state
    updateSettings(newSettings);
    
    // Persist to database
    await useCollageStore.getState().updateCollageSettings(
      currentCollage.id,
      { ...settings, ...newSettings }
    );
  };

  const handleReset = () => {
    if (!currentCollage?.id) return;
    updateSettings(useSceneStore.getState().defaultSettings);
  };

  if (!currentCollage || !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* 3D Scene */}
      <div className="flex-1 relative">
        <CollageScene />
      </div>

      {/* Settings Panel */}
      <div className="w-96 h-screen overflow-y-auto p-6 bg-gray-900/50 backdrop-blur-lg border-l border-gray-800">
        <SceneSettings
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onReset={handleReset}
        />
      </div>
    </div>
  );
};

export default CollageEditorPage;