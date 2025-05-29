import React from 'react';
import { type SceneSettings } from '../../store/sceneStore';
import { Grid, Palette, CameraIcon, ImageIcon, Square } from 'lucide-react';

type SceneSettingsProps = {
  settings: SceneSettings;
  onSettingsChange: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
  onReset: () => void;
};

const SceneSettings: React.FC<SceneSettingsProps> = ({ 
  settings, 
  onSettingsChange,
  onReset
}) => {

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-lg p-4 sticky top-20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">Scene Settings</h3>
        <button
          onClick={onReset}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="space-y-6">
        {/* Camera Controls */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-200 mb-3">
            <CameraIcon className="h-4 w-4 mr-2" />
            Camera
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.cameraEnabled}
                onChange={(e) => onSettingsChange({ 
                  cameraEnabled: e.target.checked 
                })}
                className="mr-2 bg-gray-800 border-gray-700"
              />
              <label className="text-sm text-gray-300">
                Enable Camera Movement
              </label>
            </div>

            {settings.cameraEnabled && (
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.cameraRotationEnabled}
                    onChange={(e) => onSettingsChange({ 
                      cameraRotationEnabled: e.target.checked 
                    })}
                    className="mr-2 bg-gray-800 border-gray-700"
                  />
                  <label className="text-sm text-gray-300">
                    Auto-Rotate Camera
                  </label>
                </div>

                {settings.cameraRotationEnabled && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      Rotation Speed
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="2"
                      step="0.1"
                      value={settings.cameraRotationSpeed}
                      onChange={(e) => onSettingsChange({ 
                        cameraRotationSpeed: parseFloat(e.target.value) 
                      }, true)}
                      className="w-full bg-gray-800"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Camera Distance
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="50"
                    step="0.5"
                    value={settings.cameraDistance}
                    onChange={(e) => onSettingsChange({ 
                      cameraDistance: parseFloat(e.target.value) 
                    }, true)}
                    className="w-full bg-gray-800"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Camera Height
                  </label>
                  <input
                    type="range"
                    min="-2"
                    max="60"
                    step="0.5"
                    value={settings.cameraHeight}
                    onChange={(e) => onSettingsChange({ 
                      cameraHeight: parseFloat(e.target.value) 
                    }, true)}
                    className="w-full bg-gray-800"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Photo Animation Settings */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-200 mb-3">
            <ImageIcon className="h-4 w-4 mr-2" />
            Photo Animations
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.animationEnabled}
                onChange={(e) => onSettingsChange({ 
                  animationEnabled: e.target.checked 
                })}
                className="mr-2 bg-gray-800 border-gray-700"
              />
              <label className="text-sm text-gray-300">
                Enable Photo Animations
              </label>
            </div>

            {settings.animationEnabled && (
              <>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Animation Pattern
                  </label>
                  <select
                    value={settings.animationPattern}
                    onChange={(e) => onSettingsChange({ 
                      animationPattern: e.target.value as 'float' | 'wave' | 'spiral' | 'grid' 
                    })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white"
                  >
                    <option value="grid">Grid Wall</option>
                    <option value="float">Float</option>
                    <option value="wave">Wave</option>
                    <option value="spiral">Spiral</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Animation Speed
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2"
                    step="0.1"
                    value={settings.animationSpeed}
                    onChange={(e) => onSettingsChange({ 
                      animationSpeed: parseFloat(e.target.value) 
                    }, true)}
                    className="w-full bg-gray-800"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Wall Height Control */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-200 mb-3">
            <Square className="h-4 w-4 mr-2" />
            Wall Height
          </h4>
          
          <div>
            <input
              type="range"
              min="0"
              max="30"
              step="0.5"
              value={settings.wallHeight}
              onChange={(e) => onSettingsChange({ 
                wallHeight: parseFloat(e.target.value) 
              }, true)}
              className="w-full bg-gray-800"
            />
          </div>
        </div>
        
        {/* Photo Size and Spacing */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-200 mb-3">
            <ImageIcon className="h-4 w-4 mr-2" />
            Photo Layout
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Grid Aspect Ratio
              </label>
              <select
                value={settings.gridAspectRatioPreset}
                onChange={(e) => {
                  const preset = e.target.value as SceneSettings['gridAspectRatioPreset'];
                  let ratio = settings.gridAspectRatio;
                  
                  switch (preset) {
                    case '1:1': ratio = 1; break;
                    case '4:3': ratio = 1.333333; break;
                    case '16:9': ratio = 1.777778; break;
                    case '21:9': ratio = 2.333333; break;
                    case 'custom': break; // Keep current ratio
                  }
                  
                  onSettingsChange({
                    gridAspectRatioPreset: preset,
                    gridAspectRatio: ratio
                  });
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white"
              >
                <option value="1:1">Square (1:1)</option>
                <option value="4:3">Standard (4:3)</option>
                <option value="16:9">Widescreen (16:9)</option>
                <option value="21:9">Ultrawide (21:9)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            
            {settings.gridAspectRatioPreset === 'custom' && (
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Custom Ratio
                  <span className="ml-2 text-xs text-gray-400">
                    {settings.gridAspectRatio.toFixed(2)}:1
                  </span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={settings.gridAspectRatio}
                  onChange={(e) => onSettingsChange({
                    gridAspectRatio: parseFloat(e.target.value)
                  }, true)}
                  className="w-full bg-gray-800"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Photo Size
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={settings.photoSize}
                onChange={(e) => onSettingsChange({ 
                  photoSize: parseFloat(e.target.value) 
                }, true)}
                className="w-full bg-gray-800"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Photo Spacing
                <span className="ml-2 text-xs text-gray-400">{(settings.photoSpacing * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.photoSpacing}
                onChange={(e) => onSettingsChange({ 
                  photoSpacing: parseFloat(e.target.value) 
                }, true)}
                className="w-full bg-gray-800"
              />
              <p className="mt-1 text-xs text-gray-400">
                Adjust gap between photos (0% = no gap, 100% = one photo width)
              </p>
            </div>
          </div>
        </div>
        
        {/* Photo Count Control */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-200 mb-3">
            <ImageIcon className="h-4 w-4 mr-2" />
            Photos
          </h4>
          
          <div className="space-y-4">
            <label className="block text-sm text-gray-300 mb-2">
              Number of Photos: {settings.photoCount}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="5"
                max="500"
                step="10"
                value={settings.photoCount}
                onChange={(e) => onSettingsChange({ 
                  photoCount: parseInt(e.target.value)
                }, true)}
                className="flex-1 bg-gray-800"
              />
              <input
                type="number"
                min="5"
                max="500"
                value={settings.photoCount}
                onChange={(e) => onSettingsChange({
                  photoCount: parseInt(e.target.value)
                }, true)}
                className="w-16 bg-gray-800 border border-gray-700 rounded-md py-1 px-2 text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Visual Settings */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-200 mb-3">
            <Palette className="h-4 w-4 mr-2" />
            Visuals
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2 flex items-center justify-between">
                Background
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">Gradient</span>
                  <input
                    type="checkbox"
                    checked={settings.backgroundGradient}
                    onChange={(e) => onSettingsChange({
                      backgroundGradient: e.target.checked
                    })}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              </label>
              
              {settings.backgroundGradient ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400">Start Color</label>
                    <input
                      type="color"
                      value={settings.backgroundGradientStart}
                      onChange={(e) => onSettingsChange({
                        backgroundGradientStart: e.target.value
                      }, true)}
                      className="w-full h-8 rounded cursor-pointer bg-gray-800"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400">End Color</label>
                    <input
                      type="color"
                      value={settings.backgroundGradientEnd}
                      onChange={(e) => onSettingsChange({
                        backgroundGradientEnd: e.target.value
                      }, true)}
                
                      className="w-full h-8 rounded cursor-pointer bg-gray-800"
                    />
                  </div>
                </div>
              ) : (
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => onSettingsChange({
                    backgroundColor: e.target.value
                  }, true)}
                  className="w-full h-8 rounded cursor-pointer bg-gray-800"
                />
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Empty Slot Color
              </label>
              <input
                type="color"
                value={settings.emptySlotColor}
                onChange={(e) => onSettingsChange({ 
                  emptySlotColor: e.target.value 
                }, true)}
                className="w-full h-8 rounded cursor-pointer bg-gray-800"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Spotlight Color
              </label>
              <div className="space-y-4">
                <input
                  type="color"
                  value={settings.spotlightColor}
                  onChange={(e) => onSettingsChange({ 
                    spotlightColor: e.target.value 
                  }, true)}
                  className="w-full h-8 rounded cursor-pointer bg-gray-800"
                />
                
                <div>
                  <label className="block text-xs text-gray-400">Number of Spotlights</label>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={settings.spotlightCount}
                    onChange={(e) => onSettingsChange({ 
                      spotlightCount: parseInt(e.target.value) 
                    }, true)}
                    className="w-full bg-gray-800"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Ambient Light
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.ambientLightIntensity}
                onChange={(e) => onSettingsChange({ 
                  ambientLightIntensity: parseFloat(e.target.value) 
                }, true)}
                className="w-full bg-gray-800"
              />
            </div>
          </div>
        </div>

        {/* Spotlight Settings */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-200 mb-3">
            <ImageIcon className="h-4 w-4 mr-2" />
            Spotlights
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Spotlight Height
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={settings.spotlightHeight}
                onChange={(e) => onSettingsChange({ 
                  spotlightHeight: parseFloat(e.target.value) 
                }, true)}
                className="w-full bg-gray-800"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Spotlight Distance
              </label>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={settings.spotlightDistance}
                onChange={(e) => onSettingsChange({ 
                  spotlightDistance: parseFloat(e.target.value) 
                }, true)}
                className="w-full bg-gray-800"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Spotlight Width
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={settings.spotlightWidth}
                onChange={(e) => onSettingsChange({ 
                  spotlightWidth: parseFloat(e.target.value) 
                }, true)}
                className="w-full bg-gray-800"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Spotlight Intensity
              </label>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={settings.spotlightIntensity}
                onChange={(e) => onSettingsChange({ 
                  spotlightIntensity: parseFloat(e.target.value) 
                }, true)}
                className="w-full bg-gray-800"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Spotlight Tilt
              </label>
              <input
                type="range"
                min="-1.5"
                max="1.5"
                step="0.1"
                value={settings.spotlightAngle}
                onChange={(e) => onSettingsChange({ 
                  spotlightAngle: parseFloat(e.target.value) 
                }, true)}
                className="w-full bg-gray-800"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Spotlight Softness
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.spotlightPenumbra}
                onChange={(e) => onSettingsChange({ 
                  spotlightPenumbra: parseFloat(e.target.value) 
                }, true)}
                className="w-full bg-gray-800"
              />
            </div>
          </div>
        </div>

        {/* Floor Settings */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-200 mb-3">
            <Square className="h-4 w-4 mr-2" />
            Floor
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.floorEnabled}
                onChange={(e) => onSettingsChange({ 
                  floorEnabled: e.target.checked 
                })}
                className="mr-2 bg-gray-800 border-gray-700"
              />
              <label className="text-sm text-gray-300">
                Show Floor
              </label>
            </div>

            {settings.floorEnabled && (
              <>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Floor Size
                    <span className="ml-2 text-xs text-gray-400">{Math.round(settings.floorSize)} units</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="300"
                    step="10"
                    value={settings.floorSize}
                    onChange={(e) => onSettingsChange({ floorSize: parseFloat(e.target.value) }, true)}
                    className="w-full bg-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Floor Color
                  </label>
                  <input
                    type="color"
                    value={settings.floorColor}
                    onChange={(e) => onSettingsChange({ 
                      floorColor: e.target.value 
                    }, true)}
                    className="w-full h-8 rounded cursor-pointer bg-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Floor Opacity
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={settings.floorOpacity}
                    onChange={(e) => onSettingsChange({ 
                      floorOpacity: parseFloat(e.target.value) 
                    }, true)}
                    className="w-full bg-gray-800"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Grid Settings */}
        <div>
          <h4 className="flex items-center text-sm font-medium text-gray-200 mb-3">
            <Grid className="h-4 w-4 mr-2" />
            Grid
          </h4>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox" 
                checked={settings.gridEnabled}
                onChange={(e) => onSettingsChange({
                  gridEnabled: e.target.checked
                })} 
                className="mr-2 bg-gray-800 border-gray-700"
              />
              <label className="text-sm text-gray-300">
                Show Grid
              </label>
            </div>

            {settings.gridEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Grid Color</label>
                  <input
                    type="color"
                    value={settings.gridColor}
                    onChange={(e) => onSettingsChange({
                      gridColor: e.target.value
                    }, true)}
                    className="w-full h-8 rounded cursor-pointer bg-gray-800"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400">
                    Grid Size
                    <span className="ml-2 text-xs text-gray-400">{Math.round(settings.gridSize)} units</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="300"
                    step="10"
                    value={settings.gridSize}
                    onChange={(e) => onSettingsChange({ gridSize: parseFloat(e.target.value) }, true)}
                    className="w-full bg-gray-800"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400">Grid Divisions</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={settings.gridDivisions}
                    onChange={(e) => onSettingsChange({
                      gridDivisions: parseFloat(e.target.value)
                    }, true)}
                    className="w-full bg-gray-800"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400">Grid Opacity</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.gridOpacity}
                    onChange={(e) => onSettingsChange({
                      gridOpacity: parseFloat(e.target.value)
                    }, true)}
                    className="w-full bg-gray-800"
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