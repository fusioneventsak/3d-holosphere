import React from 'react';
import { useSceneStore } from '../../store/sceneStore';

interface SceneSettingsProps {
  className?: string;
}

const SceneSettings: React.FC<SceneSettingsProps> = ({ className = '' }) => {
  const settings = useSceneStore((state) => state.settings);
  const updateSettings = useSceneStore((state) => state.updateSettings);

  const handleChange = (key: string, value: any) => {
    updateSettings({ [key]: value });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Animation</h3>
        <div className="grid gap-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.animationEnabled}
              onChange={(e) => handleChange('animationEnabled', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Enable Animation</span>
          </label>
          
          <div className="space-y-1">
            <label className="block text-sm">Pattern</label>
            <select
              value={settings.animationPattern}
              onChange={(e) => handleChange('animationPattern', e.target.value)}
              className="w-full rounded border-gray-300"
            >
              <option value="float">Float</option>
              <option value="wave">Wave</option>
              <option value="spiral">Spiral</option>
              <option value="grid">Grid</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm">Speed</label>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={settings.animationSpeed}
              onChange={(e) => handleChange('animationSpeed', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Camera</h3>
        <div className="grid gap-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.cameraEnabled}
              onChange={(e) => handleChange('cameraEnabled', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Enable Camera Controls</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.cameraRotationEnabled}
              onChange={(e) => handleChange('cameraRotationEnabled', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Auto Rotate</span>
          </label>
          
          <div className="space-y-1">
            <label className="block text-sm">Rotation Speed</label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={settings.cameraRotationSpeed}
              onChange={(e) => handleChange('cameraRotationSpeed', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Lighting</h3>
        <div className="grid gap-2">
          <div className="space-y-1">
            <label className="block text-sm">Ambient Light Intensity</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.ambientLightIntensity}
              onChange={(e) => handleChange('ambientLightIntensity', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm">Spotlight Intensity</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.spotlightIntensity}
              onChange={(e) => handleChange('spotlightIntensity', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm">Spotlight Color</label>
            <input
              type="color"
              value={settings.spotlightColor}
              onChange={(e) => handleChange('spotlightColor', e.target.value)}
              className="w-full h-8 rounded"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Background</h3>
        <div className="grid gap-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.backgroundGradient}
              onChange={(e) => handleChange('backgroundGradient', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Use Gradient Background</span>
          </label>
          
          {settings.backgroundGradient ? (
            <>
              <div className="space-y-1">
                <label className="block text-sm">Gradient Start Color</label>
                <input
                  type="color"
                  value={settings.backgroundGradientStart}
                  onChange={(e) => handleChange('backgroundGradientStart', e.target.value)}
                  className="w-full h-8 rounded"
                />
              </div>
              
              <div className="space-y-1">
                <label className="block text-sm">Gradient End Color</label>
                <input
                  type="color"
                  value={settings.backgroundGradientEnd}
                  onChange={(e) => handleChange('backgroundGradientEnd', e.target.value)}
                  className="w-full h-8 rounded"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="block text-sm">Background Color</label>
              <input
                type="color"
                value={settings.backgroundColor}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="w-full h-8 rounded"
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Floor</h3>
        <div className="grid gap-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.floorEnabled}
              onChange={(e) => handleChange('floorEnabled', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Show Floor</span>
          </label>
          
          {settings.floorEnabled && (
            <>
              <div className="space-y-1">
                <label className="block text-sm">Floor Color</label>
                <input
                  type="color"
                  value={settings.floorColor}
                  onChange={(e) => handleChange('floorColor', e.target.value)}
                  className="w-full h-8 rounded"
                />
              </div>
              
              <div className="space-y-1">
                <label className="block text-sm">Floor Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.floorOpacity}
                  onChange={(e) => handleChange('floorOpacity', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.gridEnabled}
                  onChange={(e) => handleChange('gridEnabled', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Show Grid</span>
              </label>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Photos</h3>
        <div className="grid gap-2">
          <div className="space-y-1">
            <label className="block text-sm">Photo Count</label>
            <input
              type="range"
              min="1"
              max="500"
              step="1"
              value={settings.photoCount}
              onChange={(e) => handleChange('photoCount', parseInt(e.target.value))}
              className="w-full"
            />
            <span className="text-sm text-gray-500">{settings.photoCount} photos</span>
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm">Photo Size</label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={settings.photoSize}
              onChange={(e) => handleChange('photoSize', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.useStockPhotos}
              onChange={(e) => handleChange('useStockPhotos', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Fill Empty Slots with Stock Photos</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default SceneSettings;