import { type SceneSettings } from '../../../store/sceneStore';

export type Photo = {
  id: string;
  url: string;
  collage_id?: string;
};

export type Position = [number, number, number];

export interface PatternProps {
  photos: Photo[];
  settings: SceneSettings;
}

export interface PatternState {
  positions: Position[];
  rotations?: [number, number, number][];
}

// Base class for pattern implementations
export abstract class BasePattern {
  protected settings: SceneSettings;
  protected photos: Photo[];

  constructor(settings: SceneSettings, photos: Photo[]) {
    this.settings = settings;
    this.photos = photos;
  }

  abstract generatePositions(time: number): PatternState;
}