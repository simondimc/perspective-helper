import { JOINTS, Pose } from './figure';
import { ASPECTS, constrain, PerspectiveMode } from './camera';
import { GuideSettings } from './guides';
import { ObjectParams, ObjectStore, ObjectType, Triple } from './objects';
import { AppState, defaultObjects, defaultState } from './state';

export const FILE_VERSION = 1;
const STORAGE_KEY = 'perspective-helper:scene';

export interface SceneFile extends AppState {
  version: number;
  objects: ObjectParams[];
}

export function serialize(state: AppState, store: ObjectStore): SceneFile {
  return { version: FILE_VERSION, objects: structuredClone(store.list()), camera: { ...state.camera }, light: { ...state.light }, guides: { ...state.guides }, view: { ...state.view } };
}

const TYPES: ObjectType[] = ['box', 'sphere', 'cylinder', 'cone', 'figure', 'woman', 'dog', 'horse', 'elephant', 'wall', 'wallDoor', 'wallWindow', 'table', 'chair'];
const isTriple = (v: unknown): v is Triple => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && isFinite(n));
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseObjects(raw: unknown): ObjectParams[] {
  if (!Array.isArray(raw)) throw new Error('Manjkajo objekti');
  return raw.map((o, i) => {
    if (!isObj(o) || !TYPES.includes(o.type as ObjectType) || !isTriple(o.position) || !isTriple(o.rotation) || !isTriple(o.size)) {
      throw new Error(`Neveljaven objekt #${i + 1}`);
    }
    const pose: Pose = {};
    if (isObj(o.pose)) for (const j of JOINTS) if (isTriple(o.pose[j])) pose[j] = [...(o.pose[j] as Triple)];
    const opening = isObj(o.opening) && ['w', 'h', 'x', 'y'].every((k) => typeof (o.opening as Record<string, unknown>)[k] === 'number') ? (o.opening as { w: number; h: number; x: number; y: number }) : undefined;
    return {
      pose,
      ...(opening ? { opening: { w: opening.w, h: opening.h, x: opening.x, y: opening.y } } : {}),
      id: typeof o.id === 'string' && o.id ? o.id : `o${i}`,
      type: o.type as ObjectType,
      name: typeof o.name === 'string' ? o.name : String(o.type),
      position: [...o.position] as Triple,
      rotation: [...o.rotation] as Triple,
      size: o.size.map((n) => Math.max(0.01, n)) as Triple,
    };
  });
}

/** Prepiše samo znane ključe z veljavnimi vrednostmi istega tipa; ostalo ostane privzeto. */
function mergeKnown<T extends object>(target: T, src: unknown): void {
  if (!isObj(src)) return;
  for (const key of Object.keys(target) as Array<keyof T>) {
    const v = src[key as string];
    if (typeof v === typeof target[key] && (typeof v !== 'number' || isFinite(v))) target[key] = v as T[keyof T];
  }
}

/** Naloži sceno iz razčlenjenega JSON-a v obstoječe objekte stanja (reference ostanejo enake). */
export function applyScene(data: unknown, state: AppState, store: ObjectStore): void {
  if (!isObj(data) || typeof data.version !== 'number') throw new Error('Neveljavna datoteka scene');
  if (data.version > FILE_VERSION) throw new Error('Datoteka je iz novejše različice orodja');
  const objects = parseObjects(data.objects);
  const fresh = defaultState();
  mergeKnown(fresh.camera, data.camera);
  mergeKnown(fresh.light, data.light);
  mergeKnown(fresh.guides as GuideSettings, data.guides);
  mergeKnown(fresh.view, data.view);
  if (!['1pt', '2pt', '3pt'].includes(fresh.camera.mode as PerspectiveMode)) fresh.camera.mode = '2pt';
  if (!(fresh.camera.aspect in ASPECTS)) fresh.camera.aspect = '3:2';
  Object.assign(state.camera, constrain(fresh.camera));
  Object.assign(state.light, fresh.light);
  Object.assign(state.guides, fresh.guides);
  Object.assign(state.view, fresh.view);
  if (!['solid', 'edges', 'both'].includes(state.view.objectStyle)) state.view.objectStyle = 'solid';
  store.setStyle(state.view.objectStyle);
  store.load(objects);
}

export function resetScene(state: AppState, store: ObjectStore): void {
  const f = defaultState();
  Object.assign(state.camera, f.camera);
  Object.assign(state.light, f.light);
  Object.assign(state.guides, f.guides);
  Object.assign(state.view, f.view);
  store.setStyle(state.view.objectStyle);
  store.load(defaultObjects());
}

export function saveLocal(state: AppState, store: ObjectStore): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(state, store)));
    return true;
  } catch {
    return false;
  }
}

export function loadLocal(state: AppState, store: ObjectStore): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    applyScene(JSON.parse(raw), state, store);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadScene(state: AppState, store: ObjectStore): void {
  const json = JSON.stringify(serialize(state, store), null, 2);
  downloadBlob(new Blob([json], { type: 'application/json' }), 'perspektiva-scena.json');
}

export function pickSceneFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('Ni izbrane datoteke'));
      try {
        resolve(JSON.parse(await file.text()));
      } catch {
        reject(new Error('Datoteke ni mogoče prebrati kot JSON'));
      }
    };
    input.click();
  });
}
