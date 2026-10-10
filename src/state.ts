import { CameraParams, DEFAULT_CAMERA } from './camera';
import { DEFAULT_GUIDES, GuideSettings } from './guides';
import { DEFAULT_LIGHT, LightParams } from './lighting';
import preset from './default-scene.json';
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

/** Začetni pogled (privzeta scena): vrednosti iz `default-scene.json`, manjkajoče dopolnijo privzete. */
const BASE_VIEW: ViewSettings = { gridInFrame: true, snap: false, paper: 0.6, lockFocal: false, objectStyle: 'solid', ao: 0.6, layout: 'stacked', whiteBg: true, floorColor: '', edgeWidth: 2 };

export function defaultState(): AppState {
  return {
    camera: { ...DEFAULT_CAMERA, ...(preset.camera as Partial<CameraParams>) },
    light: { ...DEFAULT_LIGHT, ...(preset.light as Partial<LightParams>) },
    guides: { ...DEFAULT_GUIDES, ...(preset.guides as Partial<GuideSettings>) },
    view: { ...BASE_VIEW, ...(preset.view as Partial<ViewSettings>) },
  };
}

export function defaultObjects(): ObjectParams[] {
  return structuredClone(preset.objects) as unknown as ObjectParams[];
}
