import { type SceneSettings } from '../../../store/sceneStore';
import { type Photo } from './BasePattern';
import { FloatPattern } from './FloatPattern';
import { GridPattern } from './GridPattern';
import { SpiralPattern } from './SpiralPattern';
import { WavePattern } from './WavePattern';

export class PatternFactory {
  static createPattern(type: string, settings: SceneSettings, photos: Photo[]) {
    // Ensure we're using the correct pattern based on settings
    const pattern = settings.animationPattern;
    
    switch (pattern) {
      case 'float': {
        const floatSettings = { ...settings };
        return new FloatPattern(settings, photos);
      }
      case 'grid': {
        const gridSettings = { ...settings };
        return new GridPattern(settings, photos);
      }
      case 'spiral': {
        const spiralSettings = { ...settings };
        return new SpiralPattern(settings, photos);
      }
      case 'wave': {
        const waveSettings = { ...settings };
        return new WavePattern(settings, photos);
      }
      default:
        // Default to grid pattern
        return new GridPattern(settings, photos);
    }
  }
}