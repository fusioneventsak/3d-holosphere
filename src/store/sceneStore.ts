import { create } from 'zustand';

export type SceneSettings = {
  animationPattern: 'float' | 'wave' | 'spiral' | 'grid';
  gridAspectRatioPreset: '1:1' | '4:3' | '16:9' | '21:9' | 'custom';
  animationSpeed: number;
  animationEnabled: boolean;
  photoCount: number;
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
  photoRotation: boolean;
  photoSpacing: number;
  wallHeight: number;
  gridAspectRatio: number;
  photoBrightness: number;
  patterns: {
    grid: {
      enabled: boolean;
      spacing: number;
      aspectRatio: number;
      wallHeight: number;
    };
    float: {
      enabled: boolean;
      spacing: number;
      height: number;
      spread: number;
    };
    wave: {
      enabled: boolean;
      spacing: number;
      amplitude: number;
      frequency: number;
    };
    spiral: {
      enabled: boolean;
      spacing: number;
      radius: number;
      heightStep: number;
    };
  };
};

const defaultSettings: SceneSettings = {
  animationPattern: 'grid',
  gridAspectRatioPreset: '16:9',
  animationSpeed: 50,
  animationEnabled: true,
  photoCount: 50,
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
  spotlightCount: 4,
  spotlightHeight: 30,
  spotlightDistance: 40,
  spotlightAngle: Math.PI / 4,
  spotlightWidth: 0.6,
  spotlightPenumbra: 0.4,
  ambientLightIntensity: 0.8,
  spotlightIntensity: 150.0,
  spotlightColor: '#ffffff',
  floorEnabled: true,
  floorColor: '#1A1A1A',
  floorOpacity: 0.8,
  floorSize: 200,
  floorReflectivity: 0.8,
  floorMetalness: 0.7,
  floorRoughness: 0.2,
  gridEnabled: true,
  gridColor: '#444444',
  gridSize: 200,
  gridDivisions: 30,
  gridOpacity: 1.0,
  photoSize: 4.0,
  photoRotation: true,
  photoSpacing: 0,
  wallHeight: 0,
  gridAspectRatio: 1.77778,
  photoBrightness: 1.0, // 1.0 = natural photo brightness (100%)
  patterns: {
    grid: {
      enabled: true,
      spacing: 0.1,
      aspectRatio: 1.77778,
      wallHeight: 0
    },
    float: {
      enabled: false,
      spacing: 0.1,
      height: 30,
      spread: 25
    },
    wave: {
      enabled: false,
      spacing: 0.15,
      amplitude: 5,
      frequency: 0.5
    },
    spiral: {
      enabled: false,
      spacing: 0.1,
      radius: 15,
      heightStep: 0.5
    }
  }
};

type SceneState = {
  settings: SceneSettings;
  updateSettings: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
  resetSettings: () => void;
};

const debounce = (fn: Function, ms = 300) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

export const useSceneStore = create<SceneState>()((set, get) => {
  const immediateUpdate = (newSettings: Partial<SceneSettings>) => {
    const currentSettings = get().settings;

    // Handle pattern changes
    if (newSettings.animationPattern && newSettings.animationPattern !== currentSettings.animationPattern) {
      // Update enabled states for patterns
      Object.keys(currentSettings.patterns).forEach(pattern => {
        currentSettings.patterns[pattern as keyof typeof currentSettings.patterns].enabled = 
          pattern === newSettings.animationPattern;
      });
    }

    // Handle photo count validation
    if (newSettings.photoCount !== undefined) {
      const count = Math.min(Math.max(5, Math.floor(Number(newSettings.photoCount))), 500);
      if (!isNaN(count)) {
        newSettings.photoCount = count;
      } else {
        delete newSettings.photoCount;
      }
    }

    // Handle photo brightness validation
    if (newSettings.photoBrightness !== undefined) {
      const brightness = Math.min(Math.max(0.1, Number(newSettings.photoBrightness)), 3);
      if (!isNaN(brightness)) {
        newSettings.photoBrightness = brightness;
      } else {
        delete newSettings.photoBrightness;
      }
    }

    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
  };

  const debouncedUpdate = debounce(immediateUpdate, 100);

  return {
    settings: defaultSettings,
    updateSettings: (newSettings: Partial<SceneSettings>, debounce = false) => {
      if (debounce) {
        debouncedUpdate(newSettings);
      } else {
        immediateUpdate(newSettings);
      }
    },
    resetSettings: () => set({ settings: defaultSettings }),
  };
});

export { defaultSettings };