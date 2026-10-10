import { CameraParams, DEFAULT_CAMERA } from './camera';
import { DEFAULT_GUIDES, GuideSettings } from './guides';
import { DEFAULT_LIGHT, LightParams } from './lighting';
import { ObjectParams, ObjectStyle } from './objects';

export interface ViewSettings {
  /** Mreža v pogledu kompozicijske kamere. */
  gridInFrame: boolean;
  snap: boolean;
  /** Papir okoli kadra v kadru kompozicije (delež velikosti kadra na vsaki strani), da so vidna tudi bežišča zunaj kadra. */
  paper: number;
  /** Pri vlečenju bežišč ohrani goriščno razdaljo (sicer jo vlečenje spreminja; Alt ima enak učinek). */
  lockFocal: boolean;
  /** Prikaz objektov: mavec, samo robovi ali oboje. */
  objectStyle: ObjectStyle;
  /** Moč ambientne okluzije (0 = izklopljena); ne velja za ribje oko. */
  ao: number;
  /** Razporeditev pogleda »Scena + kader«: eno pod drugim ali eno ob drugem. */
  layout: 'stacked' | 'side';
  /** Bela ozadja (nebo, tla) v kadru; ostanejo robovi, sence in vodila. */
  whiteBg: boolean;
  /** Barva tal v kadru (hex); prazno = brez barve (papir, vidne le sence). */
  floorColor: string;
  /** Debelina robov objektov v kadru (px) pri prikazu »samo robovi«. */
  edgeWidth: number;
}

/** Vse, kar se shrani v JSON (objekti so v ObjectStore). */
export interface AppState {
  camera: CameraParams;
  light: LightParams;
  guides: GuideSettings;
  view: ViewSettings;
}

export function defaultState(): AppState {
  return {
    camera: { ...DEFAULT_CAMERA },
    light: { ...DEFAULT_LIGHT },
    guides: { ...DEFAULT_GUIDES },
    view: { gridInFrame: true, snap: false, paper: 0.6, lockFocal: false, objectStyle: 'solid', ao: 0.6, layout: 'stacked', whiteBg: true, floorColor: '', edgeWidth: 2 },
  };
}

export function defaultObjects(): ObjectParams[] {
  return [
    { id: 'box1', type: 'box', name: 'Škatla', position: [-1.5, 0.6, 0], rotation: [0, 0, 0], size: [1.2, 1.2, 1.2] },
    { id: 'box2', type: 'box', name: 'Škatla', position: [1.2, 0.5, -0.5], rotation: [0, -20, 0], size: [1.6, 1, 1] },
    { id: 'fig1', type: 'figure', name: 'Figura', position: [-0.3, 0.875, 1], rotation: [0, 20, 0], size: [0.55, 1.75, 0.3] },
    { id: 'cyl1', type: 'cylinder', name: 'Valj', position: [0.2, 0.75, 2.2], rotation: [0, 0, 0], size: [0.7, 1.5, 0.7] },
  ];
}
