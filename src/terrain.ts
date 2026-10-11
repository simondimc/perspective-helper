import { BufferGeometry, PlaneGeometry } from 'three';

// Pokrajina: nepravilen teren (višinsko polje) s ploščatim središčem in robom, ki se zliva s tlemi.
// Središče geometrije je v sredini omejevalnega okvirja (W × H × D); H je največja višina terena.

type Size = [number, number, number];

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fraktalni šum v [0, 1]. */
function fbm(x: number, z: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    sum += amp * valueNoise(x * f, z * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export const DEFAULT_TERRAIN_FLAT = 0.2;

/** Višina terena (m) v lokalni točki (x, z) glede na središče; `flat` je delež polmera, ki ostane raven. */
export function terrainHeight(size: Size, x: number, z: number, seed = 1, flat = DEFAULT_TERRAIN_FLAT): number {
  const [W, H, D] = size;
  const r = Math.hypot((2 * x) / W, (2 * z) / D);
  const mask = smooth(flat, flat + 0.4, r) * (1 - smooth(0.82, 1, r));
  if (mask <= 0) return 0;
  const n = fbm((x / W) * 5 + 3.1, (z / D) * 5 + 7.7, seed);
  // razširi razpon šuma, da so vrhovi res visoki (šum je ob srednji vrednosti ~0,5)
  const t = Math.min(1, Math.max(0, (n - 0.25) / 0.5));
  return H * mask * (0.15 + 0.85 * t) * 1;
}

/** Višina iz podane mreže višin (hn × hn celic, vrstice od severa (−Z) proti jugu), bilinearno; (x, z) glede na središče. */
export function sampleHeights(size: Size, heights: number[], hn: number, x: number, z: number): number {
  const u = Math.min(hn, Math.max(0, (x / size[0] + 0.5) * hn));
  const v = Math.min(hn, Math.max(0, (z / size[2] + 0.5) * hn));
  const i = Math.min(hn - 1, Math.floor(u));
  const j = Math.min(hn - 1, Math.floor(v));
  const fu = u - i;
  const fv = v - j;
  const w = hn + 1;
  const a = heights[j * w + i];
  const b = heights[j * w + i + 1];
  const c = heights[(j + 1) * w + i];
  const d = heights[(j + 1) * w + i + 1];
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
}

export function terrainGeometry(size: Size, seed = 1, flat = DEFAULT_TERRAIN_FLAT, heights?: number[], hn?: number): BufferGeometry {
  const [W, H, D] = size;
  if (heights && hn && heights.length === (hn + 1) * (hn + 1)) {
    // teren iz podatkov: rob se spusti na tla, da je ob robu območja gladek prehod
    const g = new PlaneGeometry(W, D, hn, hn).rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const i = k % (hn + 1);
      const j = Math.floor(k / (hn + 1));
      const edge = i === 0 || j === 0 || i === hn || j === hn;
      pos.setY(k, (edge ? 0 : heights[k]) - H / 2 + 0.01);
    }
    g.computeVertexNormals();
    return g;
  }
  const seg = 120;
  const g = new PlaneGeometry(W, D, seg, seg).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(size, p.getX(i), p.getZ(i), seed, flat) - H / 2 + 0.01);
  g.computeVertexNormals();
  return g;
}
