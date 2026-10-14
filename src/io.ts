import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { ANIMAL_TYPES } from './animalRigs';
import { HAIRS, OUTFITS, WEAPONS } from './clothes';
import { findFigure, listPacks, splitRef } from './packs';
import { Pose } from './figure';
import { ASPECTS, constrain, PerspectiveMode } from './camera';
import { GuideSettings } from './guides';
import { ObjectParams, ObjectStore, ObjectType, Triple } from './objects';
import { AppState, defaultObjects, defaultState } from './state';

export const FILE_VERSION = 1;
const STORAGE_KEY = 'perspective-helper:scene';

// velike scene (mesta) so stisnjene, da gre več scen v omejen pomnilnik brskalnika (~5 MB); stare nestisnjene zapise še beremo
const pack = (json: string): string => `z:${compressToUTF16(json)}`;
const unpack = (raw: string): string => (raw.startsWith('z:') ? (decompressFromUTF16(raw.slice(2)) ?? '') : raw);

export interface SceneFile extends AppState {
  version: number;
  /** Ime scene; ob uvozu se nastavi kot ime trenutne scene. */
  name?: string;
  /** Paketi figur, ki jih scena potrebuje (figure iz paketov); ob uvozu morajo biti paketi že v knjižnici. */
  requires?: Array<{ pack: string; name: string; figures: string[] }>;
  objects: ObjectParams[];
}

/** Seznam paketov figur, ki jih objekti uporabljajo (iz sklicev figureRef). */
export function requiredPacks(objects: Array<{ figureRef?: string }>): NonNullable<SceneFile['requires']> {
  const byPack = new Map<string, Set<string>>();
  for (const o of objects) {
    const r = o.figureRef ? splitRef(o.figureRef) : null;
    if (!r) continue;
    if (!byPack.has(r[0])) byPack.set(r[0], new Set());
    byPack.get(r[0])!.add(r[1]);
  }
  const lib = new Map(listPacks().map((p) => [p.id, p]));
  return [...byPack].map(([pack, figs]) => ({ pack, name: lib.get(pack)?.name ?? pack, figures: [...figs] }));
}

/** Pred uvozom scene: vsi paketi figur, ki jih scena potrebuje, in njihove figure morajo biti že uvoženi. */
export function checkRequirements(data: unknown): void {
  if (!isObj(data)) return;
  const refs = Array.isArray(data.objects) ? (data.objects as unknown[]).filter(isObj).map((o) => ({ figureRef: typeof o.figureRef === 'string' ? o.figureRef : undefined })) : [];
  const need = requiredPacks(refs);
  if (Array.isArray(data.requires)) {
    for (const r of data.requires) {
      if (isObj(r) && typeof r.pack === 'string' && !need.some((n) => n.pack === r.pack)) need.push({ pack: r.pack, name: typeof r.name === 'string' ? r.name : r.pack, figures: [] });
    }
  }
  const lib = new Map(listPacks().map((p) => [p.id, p]));
  const names = new Map(Array.isArray(data.requires) ? (data.requires as unknown[]).filter(isObj).map((r) => [String(r.pack), String(r.name ?? r.pack)] as const) : []);
  const missingPacks: string[] = [];
  const missingFigs: string[] = [];
  for (const n of need) {
    const pack = lib.get(n.pack);
    const label = names.get(n.pack) ?? n.name;
    if (!pack) missingPacks.push(label);
    else for (const f of n.figures) if (!findFigure(pack, f)) missingFigs.push(`${label}: ${f}`);
  }
  if (missingPacks.length) throw new Error(`Scena potrebuje pakete figur, ki jih še nimaš: ${missingPacks.join(', ')}.\n\nNajprej jih uvozi (Datoteka → Uvozi paket figur), nato znova odpri sceno.`);
  if (missingFigs.length) throw new Error(`Uvoženi paketi nimajo vseh figur, ki jih scena potrebuje: ${missingFigs.join(', ')}.\n\nUvozi novejšo različico paketa.`);
}

export function serialize(state: AppState, store: ObjectStore): SceneFile {
  const requires = requiredPacks(store.list());
  return { version: FILE_VERSION, name: currentSceneName(), ...(requires.length ? { requires } : {}), objects: structuredClone(store.list()), camera: { ...state.camera }, light: { ...state.light }, guides: { ...state.guides }, view: { ...state.view } };
}

const TYPES: ObjectType[] = ['box', 'sphere', 'cylinder', 'cone', 'figure', 'woman', 'dog', 'horse', 'elephant', 'wall', 'wallDoor', 'wallWindow', 'table', 'chair', 'bed', 'house', 'houseHip', 'houseTwo', 'cottage', 'barn', 'church', 'shell', 'roads', 'water', 'townhouse', 'block', 'tower', 'car', 'hatch', 'suv', 'van', 'bus', 'eiffel', 'ferris', 'boat', 'colosseum', 'road', 'tree', 'pine', 'bush', 'yard', 'terrain', 'river', 'bridge', 'hill', 'hayrack', ...ANIMAL_TYPES];
const isTriple = (v: unknown): v is Triple => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && isFinite(n));
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseObjects(raw: unknown): ObjectParams[] {
  if (!Array.isArray(raw)) throw new Error('Manjkajo objekti');
  return raw.map((o, i) => {
    if (!isObj(o) || !TYPES.includes(o.type as ObjectType) || !isTriple(o.position) || !isTriple(o.rotation) || !isTriple(o.size)) {
      throw new Error(`Neveljaven objekt #${i + 1}`);
    }
    const pose: Pose = {};
    if (isObj(o.pose)) for (const [j, a] of Object.entries(o.pose)) if (isTriple(a)) pose[j] = [...(a as Triple)];
    const opening = isObj(o.opening) && ['w', 'h', 'x', 'y'].every((k) => typeof (o.opening as Record<string, unknown>)[k] === 'number') ? (o.opening as { w: number; h: number; x: number; y: number }) : undefined;
    return {
      pose,
      ...(opening ? { opening: { w: opening.w, h: opening.h, x: opening.x, y: opening.y } } : {}),
      ...(Array.isArray(o.heights) && typeof o.hn === 'number' && o.heights.length === (o.hn + 1) ** 2 && o.heights.every((n) => typeof n === 'number' && isFinite(n)) ? { heights: o.heights as number[], hn: o.hn } : {}),
      ...(Array.isArray(o.paths) ? { paths: (o.paths as unknown[]).filter((q): q is { w: number; p: number[] } => isObj(q) && typeof q.w === 'number' && Array.isArray(q.p) && q.p.every((n) => typeof n === 'number' && isFinite(n))) } : {}),
      ...(typeof o.figureRef === 'string' && o.figureRef.includes('/') ? { figureRef: o.figureRef } : {}),
      ...(typeof o.outfit === 'string' && o.outfit in OUTFITS && o.outfit !== 'none' ? { outfit: o.outfit } : {}),
      ...(typeof o.weaponR === 'string' && o.weaponR in WEAPONS && o.weaponR !== 'none' ? { weaponR: o.weaponR } : {}),
      ...(typeof o.weaponL === 'string' && o.weaponL in WEAPONS && o.weaponL !== 'none' ? { weaponL: o.weaponL } : {}),
      ...(typeof o.hair === 'string' && o.hair in HAIRS && o.hair !== 'none' ? { hair: o.hair } : {}),
      ...(typeof o.seed === 'number' && isFinite(o.seed) ? { seed: o.seed } : {}),
      ...(typeof o.flat === 'number' && isFinite(o.flat) ? { flat: Math.min(0.9, Math.max(0, o.flat)) } : {}),
      id: typeof o.id === 'string' && o.id ? o.id : `o${i}`,
      type: o.type as ObjectType,
      // preimenovanje: moška figura se je prej imenovala »Figura«
      name: o.type === 'figure' && o.name === 'Figura' ? 'Moški' : typeof o.name === 'string' ? o.name : String(o.type),
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
  if (!['1pt', '2pt', '3pt'].includes(fresh.camera.mode as PerspectiveMode)) fresh.camera.mode = '3pt';
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

// ---------------------------------------------------------------- več scen v brskalniku

export interface SceneMeta {
  id: string;
  name: string;
  updated: number;
}

export interface SceneIndex {
  current: string;
  items: SceneMeta[];
}

const INDEX_KEY = 'perspective-helper:scenes';
const sceneKey = (id: string) => `${STORAGE_KEY}:${id}`;
const newSceneId = () => `s${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

let indexCache: SceneIndex | null = null;

/** Kazalo scen; ob prvem zagonu prenese starejšo (enojno) sceno kot »Scena 1«. */
export function getIndex(): SceneIndex {
  if (indexCache) return indexCache;
  let idx: SceneIndex | null = null;
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.items) && d.items.length && typeof d.current === 'string') idx = d;
    }
  } catch {
    /* neveljavno kazalo */
  }
  if (!idx) {
    const id = newSceneId();
    idx = { current: id, items: [{ id, name: 'Scena 1', updated: Date.now() }] };
    try {
      const old = localStorage.getItem(STORAGE_KEY);
      if (old) {
        localStorage.setItem(sceneKey(id), old);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* brez shranjevanja */
    }
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
    } catch {
      /* brez shranjevanja */
    }
  }
  if (!idx.items.some((m) => m.id === idx!.current)) idx.current = idx.items[0].id;
  indexCache = idx;
  return idx;
}

function writeIndex(): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(getIndex()));
  } catch {
    /* brez shranjevanja */
  }
}

export const currentSceneId = (): string => getIndex().current;

export const currentSceneName = (): string => getIndex().items.find((m) => m.id === getIndex().current)?.name ?? 'scena';

/** Ime scene, primerno za ime datoteke (brez posebnih znakov). */
export function fileSafeName(name: string = currentSceneName()): string {
  const base = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'scena';
}

export function saveLocal(state: AppState, store: ObjectStore): boolean {
  const idx = getIndex();
  try {
    localStorage.setItem(sceneKey(idx.current), pack(JSON.stringify(serialize(state, store))));
    const m = idx.items.find((x) => x.id === idx.current);
    if (m) m.updated = Date.now();
    writeIndex();
    return true;
  } catch {
    return false;
  }
}

/** Naloži trenutno sceno; false, če zanjo ni shranjenih podatkov (uporabi se privzeta). */
export function loadLocal(state: AppState, store: ObjectStore): boolean {
  try {
    const raw = localStorage.getItem(sceneKey(getIndex().current));
    if (!raw) return false;
    applyScene(JSON.parse(unpack(raw)), state, store);
    return true;
  } catch (err) {
    console.warn('Scene ni mogoče naložiti:', err);
    return false;
  }
}

/** Nova scena v kazalu; `data` so začetni podatki (null = privzeta scena). Ne preklopi nanjo. */
export function createScene(name: string, data: SceneFile | null): string {
  const id = newSceneId();
  getIndex().items.push({ id, name, updated: Date.now() });
  if (data) {
    try {
      localStorage.setItem(sceneKey(id), pack(JSON.stringify(data)));
    } catch {
      /* brez shranjevanja */
    }
  }
  writeIndex();
  return id;
}

export function setCurrentScene(id: string): void {
  const idx = getIndex();
  if (idx.items.some((m) => m.id === id)) idx.current = id;
  writeIndex();
}

export function renameScene(id: string, name: string): void {
  const m = getIndex().items.find((x) => x.id === id);
  if (m && name.trim()) m.name = name.trim();
  writeIndex();
}

/** Izbriše sceno; vrne id scene, ki je zdaj trenutna. Zadnje scene ne izbriše, ampak jo nadomesti z novo privzeto. */
export function deleteScene(id: string): string {
  const idx = getIndex();
  try {
    localStorage.removeItem(sceneKey(id));
  } catch {
    /* brez shranjevanja */
  }
  idx.items = idx.items.filter((m) => m.id !== id);
  if (!idx.items.length) {
    const nid = newSceneId();
    idx.items.push({ id: nid, name: 'Scena 1', updated: Date.now() });
  }
  if (!idx.items.some((m) => m.id === idx.current)) idx.current = idx.items[0].id;
  writeIndex();
  return idx.current;
}

/** Podatki prazne scene (brez predmetov, privzeta kamera in luč). */
export function blankSceneFile(): SceneFile {
  const d = defaultState();
  return { version: FILE_VERSION, objects: [], camera: d.camera, light: d.light, guides: d.guides, view: d.view };
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
  downloadBlob(new Blob([json], { type: 'application/json' }), `${fileSafeName()}.json`);
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

/** Ime scene iz uvožene datoteke (ali null, če ga ni). */
export function sceneNameOf(data: unknown): string | null {
  const n = isObj(data) && typeof data.name === 'string' ? data.name.trim() : '';
  return n || null;
}
