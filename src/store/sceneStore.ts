import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SceneSettings = {
  animationPattern: 'float' | 'wave' | 'spiral' | 'grid';
  animationSpeed: number;
  animationEnabled: boolean;
  useStockPhotos: boolean;
  photoCount: number;
  wallHeight: number;
  backgroundColor: string;
  backgroundGradient: boolean;
  backgroundGradientStart: string;
  backgroundGradientEnd: string;
  backgroundGradientAngle: number;
  emptySlotColor: string;
  cameraDistance: number;
  cameraRotationEnabled: boolean;
  cameraRotationSpeed: number;
  cameraHeight: number;
  cameraEnabled: boolean;
  spotlightCount: number;
  spotlightHeight: number;
  spotlightDistance: number;
  spotlightAngle: number;
  spotlightWidth: number;
  spotlightPenumbra: number;
  ambientLightIntensity: number;
  spotlightIntensity: number;
  spotlightColor: string;
  floorEnabled: boolean;
  floorColor: string;
  floorOpacity: number;
  floorSize: number;
  floorReflectivity: number;
  floorMetalness: number;
  floorRoughness: number;
  gridEnabled: boolean;
  gridColor: string;
  gridSize: number;
  gridDivisions: number;
  gridOpacity: number;
  photoSize: number;
  photoSpacing: number;
};

type SceneState = {
  settings: SceneSettings;
  updateSettings: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
  resetSettings: () => void;
};

// Debounce helper
const debounce = (fn: Function, ms = 300) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

const defaultSettings: SceneSettings = {
  animationPattern: 'grid',
  animationSpeed: 0.5,
  animationEnabled: false,
  useStockPhotos: true,
  photoCount: 50,
  wallHeight: 8, // Increased default wall height above floor
  backgroundColor: '#000000',
  backgroundGradient: false,
  backgroundGradientStart: '#000000',
  backgroundGradientEnd: '#1a1a1a',
  backgroundGradientAngle: 180,
  emptySlotColor: '#1A1A1A',
  cameraDistance: 25,
  cameraRotationEnabled: true,
  cameraRotationSpeed: 0.2,
  cameraHeight: 10,
  cameraEnabled: true,
  spotlightCount: 2,
  spotlightHeight: 15,
  spotlightDistance: 30,
  spotlightAngle: Math.PI / 6, // 30 degrees default
  spotlightWidth: 0.5,
  spotlightPenumbra: 0.8,
  ambientLightIntensity: 0.5,
  spotlightIntensity: 20.0,
  spotlightColor: '#ffffff',
  floorEnabled: true,
  floorColor: '#1A1A1A',
  floorOpacity: 0.8,
  floorSize: 20,
  floorReflectivity: 0.6,
  floorMetalness: 0.2,
  floorRoughness: 0.7,
  gridEnabled: true,
  gridColor: '#444444',
  gridSize: 30,
  gridDivisions: 30,
  gridOpacity: 1.0,
  photoSize: 0.8,
  photoSpacing: 0.05, // Reduced to almost zero for solid wall effect
};

export const useSceneStore = create<SceneState>()(
  persist(
    (set) => ({
  settings: defaultSettings,
  updateSettings: (() => {
    const immediateUpdate = (newSettings: Partial<SceneSettings>) => {
      // Ensure photoCount stays within bounds
      if (newSettings.photoCount) {
        console.log('Updating photoCount:', {
          raw: newSettings.photoCount,
          type: typeof newSettings.photoCount
        });
        const count = Math.min(Math.max(5, Math.floor(Number(newSettings.photoCount))), 500);
        if (isNaN(count)) {
          console.warn('Invalid photoCount value, skipping update');
          delete newSettings.photoCount;
        } else {
          console.log('Setting new photoCount:', count);
          newSettings.photoCount = count;
        }
      }

      set((state) => ({
        ...console.log('Current settings:', state.settings),
        ...console.log('New settings:', newSettings),
        settings: { ...state.settings, ...newSettings },
      }));
    };
    
    const debouncedUpdate = debounce(immediateUpdate, 100);
    
    return (newSettings: Partial<SceneSettings>, debounce = false) => {
      if (debounce) {
        debouncedUpdate(newSettings);
      } else {
        immediateUpdate(newSettings);
      }
    };
  })(),
  resetSettings: () => set({ settings: defaultSettings }),
}), {
    name: 'scene-settings',
    version: 1,
    partialize: (state) => ({ settings: state.settings }),
    onRehydrateStorage: () => (state) => {
      if (state) {
        // Validate and fix any invalid settings after rehydration
        const validatedSettings = { ...defaultSettings };
        for (const key in state.settings) {
          const value = state.settings[key];
          if (value !== undefined && value !== null) {
            validatedSettings[key] = value;
          }
        }
        state.settings = validatedSettings;
      }
    }
  })
);