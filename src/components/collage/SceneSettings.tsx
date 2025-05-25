import React from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { Grid, Palette, CameraIcon, ImageIcon, Square } from 'lucide-react';

const SceneSettings: React.FC = () => {
  const { settings, updateSettings, resetSettings } = useSceneStore();

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 sticky top-20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Scene Settings</h3>
        <button
          onClick={resetSettings}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="space-y-6">
        {/* Camera Controls */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-300 mb-3">
            <CameraIcon className="h-4 w-4 mr-2" />
            Camera
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.cameraEnabled}
                onChange={(e) => updateSettings({ 
                  cameraEnabled: e.target.checked 
                })}
                className="mr-2"
              />
              <label className="text-sm text-gray-400">
                Enable Camera Movement
              </label>
            </div>

            {settings.cameraEnabled && (
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.cameraRotationEnabled}
                    onChange={(e) => updateSettings({ 
                      cameraRotationEnabled: e.target.checked 
                    })}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-400">
                    Auto-Rotate Camera
                  </label>
                </div>

                {settings.cameraRotationEnabled && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Rotation Speed
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="2"
                      step="0.1"
                      value={settings.cameraRotationSpeed}
                      onChange={(e) => updateSettings({ 
                        cameraRotationSpeed: parseFloat(e.target.value) 
                      })}
                      className="w-full"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Camera Distance
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    step="0.5"
                    value={settings.cameraDistance}
                    onChange={(e) => updateSettings({ 
                      cameraDistance: parseFloat(e.target.value) 
                    })}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Camera Height
                  </label>
                  <input
                    type="range"
                    min="-2"
                    max="8"
                    step="0.5"
                    value={settings.cameraHeight}
                    onChange={(e) => updateSettings({ 
                      cameraHeight: parseFloat(e.target.value) 
                    })}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Photo Animation Settings */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-300 mb-3">
            <ImageIcon className="h-4 w-4 mr-2" />
            Photo Animations
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.animationEnabled}
                onChange={(e) => updateSettings({ 
                  animationEnabled: e.target.checked 
                })}
                className="mr-2"
              />
              <label className="text-sm text-gray-400">
                Enable Photo Animations
              </label>
            </div>

            {settings.animationEnabled && (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Animation Pattern
                  </label>
                  <select
                    value={settings.animationPattern}
                    onChange={(e) => updateSettings({ 
                      animationPattern: e.target.value as 'float' | 'wave' | 'spiral' 
                    })}
                    className="w-full bg-black/30 border border-gray-700 rounded-md py-2 px-3 text-white"
                  >
                    <option value="float">Float</option>
                    <option value="wave">Wave</option>
                    <option value="spiral">Spiral</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Animation Speed
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2"
                    step="0.1"
                    value={settings.animationSpeed}
                    onChange={(e) => updateSettings({ 
                      animationSpeed: parseFloat(e.target.value) 
                    })}
                    className="w-full"
                  />
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Photo Size and Spacing */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-300 mb-3">
            <ImageIcon className="h-4 w-4 mr-2" />
            Photo Layout
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Photo Size
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.photoSize}
                onChange={(e) => updateSettings({ 
                  photoSize: parseFloat(e.target.value) 
                })}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Photo Spacing
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.photoSpacing}
                onChange={(e) => updateSettings({ 
                  photoSpacing: parseFloat(e.target.value) 
                })}
                className="w-full"
              />
            </div>
          </div>
        </div>
        
        {/* Photo Count Control */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-300 mb-3">
            <ImageIcon className="h-4 w-4 mr-2" />
            Photos
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.useStockPhotos}
                onChange={(e) => updateSettings({ 
                  useStockPhotos: e.target.checked 
                })}
                className="mr-2"
              />
              <label className="text-sm text-gray-400">
                Fill Empty Slots with Stock Photos
              </label>
            </div>

            <label className="block text-sm text-gray-400 mb-2">
              Number of Photos: {settings.photoCount}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="5"
                max="500"
                step="10"
                value={settings.photoCount}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  console.log('Slider change:', {
                    rawValue: e.target.value,
                    parsedValue: newValue,
                    currentValue: settings.photoCount
                  });
                  updateSettings({ 
                    photoCount: Math.min(500, Math.max(5, newValue || 5))
                  });
                }}
                className="flex-1"
              />
              <input
                type="number"
                min="5"
                max="500"
                value={settings.photoCount}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  console.log('Number input change:', {
                    rawValue: e.target.value,
                    parsedValue: newValue,
                    currentValue: settings.photoCount
                  });
                  updateSettings({
                    photoCount: Math.min(500, Math.max(5, newValue || 5))
                  });
                }}
                className="w-16 bg-black/30 border border-gray-700 rounded-md py-1 px-2 text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Visual Settings */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-300 mb-3">
            <Palette className="h-4 w-4 mr-2" />
            Visuals
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Background
              </label>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.backgroundGradient}
                    onChange={(e) => updateSettings({
                      backgroundGradient: e.target.checked
                    })}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-400">
                    Use Gradient
                  </label>
                </div>
                
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => updateSettings({ 
                    backgroundColor: e.target.value 
                  })}
                  className="w-full h-8 rounded cursor-pointer"
                />
                
                {settings.backgroundGradient && (
                  <>
                    <input
                      type="color"
                      value={settings.backgroundColorSecondary}
                      onChange={(e) => updateSettings({ 
                        backgroundColorSecondary: e.target.value 
                      })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                    
                    <div>
                      <label className="block text-xs text-gray-500">Gradient Angle</label>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="15"
                        value={settings.backgroundGradientAngle}
                        onChange={(e) => updateSettings({
                          backgroundGradientAngle: parseInt(e.target.value)
                        })}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Empty Slot Color
              </label>
              <input
                type="color"
                value={settings.emptySlotColor}
                onChange={(e) => updateSettings({ 
                  emptySlotColor: e.target.value 
                })}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Spotlight Color
              </label>
              <div className="space-y-4">
                <input
                  type="color"
                  value={settings.spotlightColor}
                  onChange={(e) => updateSettings({ 
                    spotlightColor: e.target.value 
                  })}
                  className="w-full h-8 rounded cursor-pointer"
                />
                
                <div>
                  <label className="block text-xs text-gray-500">Number of Spotlights</label>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={settings.spotlightCount}
                    onChange={(e) => updateSettings({ 
                      spotlightCount: parseInt(e.target.value) 
                    })}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500">Height</label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={settings.spotlightHeight}
                    onChange={(e) => updateSettings({ 
                      spotlightHeight: parseFloat(e.target.value) 
                    })}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500">Distance</label>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    step="5"
                    value={settings.spotlightDistance}
                    onChange={(e) => updateSettings({ 
                      spotlightDistance: parseFloat(e.target.value) 
                    })}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500">Angle</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={settings.spotlightAngle}
                    onChange={(e) => updateSettings({ 
                      spotlightAngle: parseFloat(e.target.value) 
                    })}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500">Softness</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.spotlightPenumbra}
                    onChange={(e) => updateSettings({ 
                      spotlightPenumbra: parseFloat(e.target.value) 
                    })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Spotlight Intensity
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.spotlightIntensity}
                onChange={(e) => updateSettings({ 
                  spotlightIntensity: parseFloat(e.target.value) 
                })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Ambient Light
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.ambientLightIntensity}
                onChange={(e) => updateSettings({ 
                  ambientLightIntensity: parseFloat(e.target.value) 
                })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Floor Settings */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-300 mb-3">
            <Square className="h-4 w-4 mr-2" />
            Floor
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.floorEnabled}
                onChange={(e) => updateSettings({ 
                  floorEnabled: e.target.checked 
                })}
                className="mr-2"
              />
              <label className="text-sm text-gray-400">
                Show Floor
              </label>
            </div>

            {settings.floorEnabled && (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Floor Color
                  </label>
                  <input
                    type="color"
                    value={settings.floorColor}
                    onChange={(e) => updateSettings({ 
                      floorColor: e.target.value 
                    })}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Floor Opacity
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={settings.floorOpacity}
                    onChange={(e) => updateSettings({ 
                      floorOpacity: parseFloat(e.target.value) 
                    })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Floor Properties
                  </label>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-500">Size</label>
                      <input
                        type="range"
                        min="10"
                        max="50"
                        step="5"
                        value={settings.floorSize}
                        onChange={(e) => updateSettings({ 
                          floorSize: parseFloat(e.target.value) 
                        })}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500">Reflectivity</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.floorReflectivity}
                        onChange={(e) => updateSettings({ 
                          floorReflectivity: parseFloat(e.target.value) 
                        })}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500">Metalness</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.floorMetalness}
                        onChange={(e) => updateSettings({ 
                          floorMetalness: parseFloat(e.target.value) 
                        })}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500">Roughness</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.floorRoughness}
                        onChange={(e) => updateSettings({ 
                          floorRoughness: parseFloat(e.target.value) 
                        })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Grid Settings */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-300 mb-3">
            <Grid className="h-4 w-4 mr-2" />
            Grid
          </h4>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox" 
                checked={settings.gridEnabled}
                onChange={(e) => updateSettings({
                  gridEnabled: e.target.checked
                })} 
                className="mr-2"
              />
              <label className="text-sm text-gray-400">
                Show Grid
              </label>
            </div>

            {settings.gridEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Grid Color</label>
                  <input
                    type="color"
                    value={settings.gridColor}
                    onChange={(e) => updateSettings({
                      gridColor: e.target.value
                    })}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500">Grid Size</label>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    step="5"
                    value={settings.gridSize}
                    onChange={(e) => updateSettings({
                      gridSize: parseFloat(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500">Grid Divisions</label>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    step="5"
                    value={settings.gridDivisions}
                    onChange={(e) => updateSettings({
                      gridDivisions: parseFloat(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500">Grid Opacity</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.gridOpacity}
                    onChange={(e) => updateSettings({
                      gridOpacity: parseFloat(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneSettings;