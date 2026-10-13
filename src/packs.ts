import { Pose } from './figure';
import { HAIRS, OUTFITS } from './clothes';
import { Triple } from './objects';

// Paketi figur: datoteka z imenovanimi figurami (velikost, obleka, lasje, poza), ki jo uvoziš v knjižnico; figure nato dodajaš v scene.
// Paketov ni mogoče izvoziti: pripravi jih avtor paketa (datoteka JSON), uporabnik jih samo uvozi.
// Scena, ki uporablja figuro iz paketa, si zapomni (figureRef) iz katerega paketa je; pri uvozu take scene mora biti paket
// že v knjižnici (glej checkRequirements v io.ts).

export const PACK_KIND = 'perspective-helper-figure-pack';
export const PACK_VERSION = 1;
const STORAGE_KEY = 'perspective-helper:figure-packs';

export interface FigureDef {
  /** Enolična oznaka v paketu. */
  id: string;
  name: string;
  type: 'figure' | 'woman';
  /** Velikost objekta (širina, višina, globina) v metrih. */
  size: Triple;
  outfit?: string;
  hair?: string;
  pose?: Pose;
}

export interface FigurePack {
  kind: typeof PACK_KIND;
  version: number;
  /** Oznaka paketa (npr. »moj-paket«); po njej scene najdejo paket. */
  id: string;
  name: string;
  figures: FigureDef[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTriple = (v: unknown): v is Triple => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && isFinite(n) && n > 0);

/** Preveri uvoženo datoteko paketa; nevljavno zavrne z razumljivim sporočilom. */
export function parsePack(raw: unknown): FigurePack {
  if (!isObj(raw) || raw.kind !== PACK_KIND) throw new Error('To ni paket figur (datoteka nima oznake paketa).');
  if (typeof raw.version !== 'number' || raw.version > PACK_VERSION) throw new Error('Paket je iz novejše različice orodja.');
  if (typeof raw.id !== 'string' || !raw.id.trim() || typeof raw.name !== 'string' || !Array.isArray(raw.figures)) throw new Error('Paket figur je nepopoln (manjka oznaka, ime ali figure).');
  const seen = new Set<string>();
  const figures: FigureDef[] = raw.figures.map((f, i) => {
    if (!isObj(f) || typeof f.id !== 'string' || !f.id || typeof f.name !== 'string' || (f.type !== 'figure' && f.type !== 'woman') || !isTriple(f.size)) {
      throw new Error(`Neveljavna figura #${i + 1} v paketu.`);
    }
    if (seen.has(f.id)) throw new Error(`Podvojena oznaka figure »${f.id}« v paketu.`);
    seen.add(f.id);
    const pose: Pose = {};
    if (isObj(f.pose)) for (const [j, a] of Object.entries(f.pose)) if (isTriple([1, 1, 1]) && Array.isArray(a) && a.length === 3 && a.every((n) => typeof n === 'number' && isFinite(n))) pose[j] = [a[0], a[1], a[2]];
    return {
      id: f.id,
      name: f.name,
      type: f.type,
      size: [...f.size] as Triple,
      ...(typeof f.outfit === 'string' && f.outfit in OUTFITS && f.outfit !== 'none' ? { outfit: f.outfit } : {}),
      ...(typeof f.hair === 'string' && f.hair in HAIRS && f.hair !== 'none' ? { hair: f.hair } : {}),
      ...(Object.keys(pose).length ? { pose } : {}),
    };
  });
  return { kind: PACK_KIND, version: raw.version, id: raw.id.trim(), name: raw.name.trim() || raw.id, figures };
}

// ---------------------------------------------------------------- knjižnica v brskalniku

export function listPacks(): FigurePack[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.map((p) => parsePack(p)) : [];
  } catch {
    return [];
  }
}

function writePacks(packs: FigurePack[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
    return true;
  } catch {
    return false;
  }
}

/** Doda paket v knjižnico; paket z isto oznako se nadomesti. Vrne false, če shranjevanje ni uspelo. */
export function savePack(pack: FigurePack): boolean {
  return writePacks([...listPacks().filter((p) => p.id !== pack.id), pack]);
}

export function removePack(id: string): void {
  writePacks(listPacks().filter((p) => p.id !== id));
}

export const findFigure = (pack: FigurePack, id: string): FigureDef | undefined => pack.figures.find((f) => f.id === id);

/** Sklic na figuro iz paketa v sceni: »paket/figura«. */
export const figureRef = (packId: string, figId: string): string => `${packId}/${figId}`;
export function splitRef(ref: string): [string, string] | null {
  const i = ref.indexOf('/');
  return i > 0 ? [ref.slice(0, i), ref.slice(i + 1)] : null;
}
