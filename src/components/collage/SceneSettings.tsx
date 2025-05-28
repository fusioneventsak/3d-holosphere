import React from 'react';
import { useSceneStore } from '../../store/sceneStore';

type SettingsGroupProps = {
  title: string;
  children: React.ReactNode;
};

const SettingsGroup: React.FC<SettingsGroupProps> = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-lg font-semibold mb-3 text-gray-700">{title}</h3>
    <div className="space-y-4">{children}</div>
  </div>
);

const SceneSettings: React.FC = () => {
  const { settings, updateSettings } = useSceneStore();

  const handleChange = (key: string, value: any) => {
    updateSettings({ [key]: value });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Scene Settings</h2>

      <SettingsGroup title="Animation">
        <div className="flex items-center justify-between">
          <label className="text-gray-700">Enable Animation</label>
          <input
            type="checkbox"
            checked={settings.animationEnabled}
            onChange={(e) => handleChange('animationEnabled', e.target.checked)}
            className="toggle toggle-primary"
          />
        </div>
        
        <div>
          <label className="text-gray-700 block mb-2">Pattern</label>
          <select
            value={settings.animationPattern}
            onChange={(e) => handleChange('animationPattern', e.target.value)}
            className="select select-bordered w-full"
          >
            <option value="float">Float</option>
            <option value="wave">Wave</option>
            <option value="spiral">Spiral</option>
            <option value="grid">Grid</option>
          </select>
        </div>

        <div>
          <label className="text-gray-700 block mb-2">Speed</label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={settings.animationSpeed}
            onChange={(e) => handleChange('animationSpeed', parseFloat(e.target.value))}
            className="range range-primary"
          />
        </div>
      </SettingsGroup>

      <SettingsGroup title="Camera">
        <div className="flex items-center justify-between">
          <label className="text-gray-700">Auto Rotate</label>
          <input
            type="checkbox"
            checked={settings.cameraRotationEnabled}
            onChange={(e) => handleChange('cameraRotationEnabled', e.target.checked)}
            className="toggle toggle-primary"
          />
        </div>

        <div>
          <label className="text-gray-700 block mb-2">Rotation Speed</label>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={settings.cameraRotationSpeed}
            onChange={(e) => handleChange('cameraRotationSpeed', parseFloat(e.target.value))}
            className="range range-primary"
          />
        </div>

        <div>
          <label className="text-gray-700 block mb-2">Height</label>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={settings.cameraHeight}
            onChange={(e) => handleChange('cameraHeight', parseFloat(e.target.value))}
            className="range range-primary"
          />
        </div>

        <div>
          <label className="text-gray-700 block mb-2">Distance</label>
          <input
            type="range"
            min="5"
            max="50"
            step="1"
            value={settings.cameraDistance}
            onChange={(e) => handleChange('cameraDistance', parseFloat(e.target.value))}
            className="range range-primary"
          />
        </div>
      </SettingsGroup>

      <SettingsGroup title="Lighting">
        <div>
          <label className="text-gray-700 block mb-2">Ambient Light Intensity</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.ambientLightIntensity}
            onChange={(e) => handleChange('ambientLightIntensity', parseFloat(e.target.value))}
            className="range range-primary"
          />
        </div>

        <div>
          <label className="text-gray-700 block mb-2">Spotlight Intensity</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.spotlightIntensity}
            onChange={(e) => handleChange('spotlightIntensity', parseFloat(e.target.value))}
            className="range range-primary"
          />
        </div>

        <div>
          <label className="text-gray-700 block mb-2">Spotlight Color</label>
          <input
            type="color"
            value={settings.spotlightColor}
            onChange={(e) => handleChange('spotlightColor', e.target.value)}
            className="w-full h-10 rounded cursor-pointer"
          />
        </div>
      </SettingsGroup>

      <SettingsGroup title="Floor">
        <div className="flex items-center justify-between">
          <label className="text-gray-700">Show Floor</label>
          <input
            type="checkbox"
            checked={settings.floorEnabled}
            onChange={(e) => handleChange('floorEnabled', e.target.checked)}
            className="toggle toggle-primary"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-gray-700">Show Grid</label>
          <input
            type="checkbox"
            checked={settings.gridEnabled}
            onChange={(e) => handleChange('gridEnabled', e.target.checked)}
            className="toggle toggle-primary"
          />
        </div>

        <div>
          <label className="text-gray-700 block mb-2">Floor Color</label>
          <input
            type="color"
            value={settings.floorColor}
            onChange={(e) => handleChange('floorColor', e.target.value)}
            className="w-full h-10 rounded cursor-pointer"
          />
        </div>

        <div>
          <label className="text-gray-700 block mb-2">Grid Color</label>
          <input
            type="color"
            value={settings.gridColor}
            onChange={(e) => handleChange('gridColor', e.target.value)}
            className="w-full h-10 rounded cursor-pointer"
          />
        </div>
      </SettingsGroup>

      <SettingsGroup title="Background">
        <div className="flex items-center justify-between">
          <label className="text-gray-700">Use Gradient</label>
          <input
            type="checkbox"
            checked={settings.backgroundGradient}
            onChange={(e) => handleChange('backgroundGradient', e.target.checked)}
            className="toggle toggle-primary"
          />
        </div>

        {settings.backgroundGradient ? (
          <>
            <div>
              <label className="text-gray-700 block mb-2">Gradient Start</label>
              <input
                type="color"
                value={settings.backgroundGradientStart}
                onChange={(e) => handleChange('backgroundGradientStart', e.target.value)}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-gray-700 block mb-2">Gradient End</label>
              <input
                type="color"
                value={settings.backgroundGradientEnd}
                onChange={(e) => handleChange('backgroundGradientEnd', e.target.value)}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="text-gray-700 block mb-2">Background Color</label>
            <input
              type="color"
              value={settings.backgroundColor}
              onChange={(e) => handleChange('backgroundColor', e.target.value)}
              className="w-full h-10 rounded cursor-pointer"
            />
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup title="Photos">
        <div>
          <label className="text-gray-700 block mb-2">Photo Count</label>
          <input
            type="range"
            min="1"
            max="500"
            step="1"
            value={settings.photoCount}
            onChange={(e) => handleChange('photoCount', parseInt(e.target.value))}
            className="range range-primary"
          />
          <div className="text-sm text-gray-500 mt-1">{settings.photoCount} photos</div>
        </div>

        <div>
          <label className="text-gray-700 block mb-2">Photo Size</label>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.1"
            value={settings.photoSize}
            onChange={(e) => handleChange('photoSize', parseFloat(e.target.value))}
            className="range range-primary"
          />
        </div>

        <div>
          <label className="text-gray-700 block mb-2">Photo Spacing</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.photoSpacing}
            onChange={(e) => handleChange('photoSpacing', parseFloat(e.target.value))}
            className="range range-primary"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-gray-700">Use Stock Photos</label>
          <input
            type="checkbox"
            checked={settings.useStockPhotos}
            onChange={(e) => handleChange('useStockPhotos', e.target.checked)}
            className="toggle toggle-primary"
          />
        </div>
      </SettingsGroup>
    </div>
  );
};

export default SceneSettings;