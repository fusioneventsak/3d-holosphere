import { type SceneSettings } from '../../../store/sceneStore';
import { type Photo } from './BasePattern';
import { FloatPattern } from './FloatPattern';
import { GridPattern } from './GridPattern';
import { SpiralPattern } from './SpiralPattern';
import { WavePattern } from './WavePattern';

export class PatternFactory {
  static createPattern(type: string, settings: SceneSettings, photos: Photo[]) {
    switch (type) {
      case 'float':
        return new FloatPattern(settings, photos);
      case 'grid':
        return new GridPattern(settings, photos);
      case 'spiral':
        return new SpiralPattern(settings, photos);
      case 'wave':
        return new WavePattern(settings, photos);
      default:
        return new GridPattern(settings, photos);
    }
  }
}