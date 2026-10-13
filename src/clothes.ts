import { BoxGeometry, BufferGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { Part, Rig } from './figure';
import { rigOf } from './rigs';

// Obleke in lasje za človeške figure (moški, ženska). Deli so dodani skeletu kot dodatni deli sklepov, zato se premikajo s pozo.
// Velikost figure (višina, širina) določa osnovni skelet, obleka ga le prekrije.

export const OUTFITS: Record<string, string> = {
  none: 'Brez',
  robe: 'Dolga halja',
  robeHood: 'Halja s kapuco',
  cloak: 'Plašč',
  dress: 'Obleka',
  jacket: 'Jakna',
  coat: 'Dolga suknja (do kolen)',
  armor: 'Oklep',
  stillsuit: 'Stillsuit (kapuca, nahrbtnik)',
};

export const HAIRS: Record<string, string> = {
  none: 'Brez (plešast)',
  short: 'Kratki',
  long: 'Dolgi',
};

interface Dims {
  sh: number; // vodoravni položaj rame
  hip: number; // vodoravni položaj kolka
  head: [number, number, number]; // središče glave (y) in polmeri
  hy: number;
}

const DIMS: Record<string, Dims> = {
  man: { sh: 0.235, hip: 0.09, head: [0.095, 0.12, 0.11], hy: 1.64 },
  woman: { sh: 0.2, hip: 0.1, head: [0.088, 0.11, 0.1], hy: 1.62 },
};

type MakeFn = (seg: number) => BufferGeometry;
const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, zScale = 1): MakeFn => () => new CylinderGeometry(rt, rb, h, 20).scale(1, 1, zScale).translate(x, y, z);
const box = (w: number, h: number, d: number, x: number, y: number, z: number): MakeFn => () => new BoxGeometry(w, h, d).translate(x, y, z);
const ell = (rx: number, ry: number, rz: number, x: number, y: number, z: number): MakeFn => () => new SphereGeometry(1, 20, 14).scale(rx, ry, rz).translate(x, y, z);

function limbs(d: Dims, thick: number): Part[] {
  const p: Part[] = [];
  for (const [s, sh, el, hp, kn] of [
    [1, 'shoulderL', 'elbowL', 'hipL', 'kneeL'],
    [-1, 'shoulderR', 'elbowR', 'hipR', 'kneeR'],
  ] as const) {
    p.push({ joint: sh, make: cyl(0.048 + thick, 0.04 + thick, 0.3, s * d.sh, 1.27, 0) });
    p.push({ joint: el, make: cyl(0.04 + thick, 0.032 + thick, 0.28, s * d.sh, 0.98, 0) });
    void hp;
    void kn;
  }
  return p;
}

function legs(d: Dims, thick: number): Part[] {
  const p: Part[] = [];
  for (const [s, hp, kn] of [
    [1, 'hipL', 'kneeL'],
    [-1, 'hipR', 'kneeR'],
  ] as const) {
    p.push({ joint: hp, make: cyl(0.07 + thick, 0.055 + thick, 0.4, s * d.hip, 0.6, 0) });
    p.push({ joint: kn, make: cyl(0.05 + thick, 0.036 + thick, 0.38, s * d.hip, 0.21, 0) });
  }
  return p;
}

/** Krilo/poli, ki sledijo nogam: stegno je pripeto na kolk, golen na koleno, zato se pri sedeči pozi obleka prilagodi. */
function legSkirt(d: Dims, thigh: [number, number], thighY: [number, number], shin?: { r: [number, number]; y: [number, number] }): Part[] {
  const p: Part[] = [];
  for (const [s, hp, kn] of [[1, 'hipL', 'kneeL'], [-1, 'hipR', 'kneeR']] as const) {
    p.push({ joint: hp, make: cyl(thigh[0], thigh[1], thighY[0] - thighY[1], s * d.hip, (thighY[0] + thighY[1]) / 2, 0, 0.9) });
    if (shin) p.push({ joint: kn, make: cyl(shin.r[0], shin.r[1], shin.y[0] - shin.y[1], s * d.hip, (shin.y[0] + shin.y[1]) / 2, 0, 0.9) });
  }
  return p;
}

function outfitParts(id: string, outfit: string): Part[] {
  const d = DIMS[id];
  if (!d || outfit === 'none') return [];
  const woman = id === 'woman';
  switch (outfit) {
    case 'robe':
    case 'robeHood': {
      const p: Part[] = [
        { joint: 'torso', make: cyl(d.sh * 0.95, woman ? 0.2 : 0.23, 0.62, 0, 1.11, 0, 0.72) },
        { joint: 'torso', make: cyl(0.075, 0.085, 0.07, 0, 1.47, 0) },
        // spodnji del halje sledi nogam (stegno na kolku, golen na kolenu)
        ...legSkirt(d, woman ? [0.125, 0.14] : [0.135, 0.15], [0.8, 0.4], { r: woman ? [0.15, 0.19] : [0.16, 0.2], y: [0.4, 0.03] }),
      ];
      for (const [s, sh, el] of [[1, 'shoulderL', 'elbowL'], [-1, 'shoulderR', 'elbowR']] as const) {
        p.push({ joint: sh, make: cyl(0.075, 0.095, 0.32, s * d.sh, 1.26, 0) });
        p.push({ joint: el, make: cyl(0.095, 0.125, 0.3, s * d.sh, 0.97, 0) });
      }
      if (outfit === 'robeHood') {
        p.push({ joint: 'neck', make: ell(d.head[0] * 1.42, d.head[1] * 1.26, d.head[2] * 1.32, 0, d.hy - 0.01, -0.012) });
        p.push({ joint: 'torso', make: cyl(0.13, 0.24, 0.22, 0, 1.4, -0.01, 0.85) });
      }
      return p;
    }
    case 'cloak': {
      const w = d.sh * 2 + 0.04;
      return [
        { joint: 'torso', make: box(w, 1.05, 0.04, 0, 0.93, -0.125) },
        { joint: 'torso', make: box(w + 0.08, 0.09, 0.3, 0, 1.43, -0.01) },
        { joint: 'torso', make: cyl(0.08, 0.1, 0.07, 0, 1.49, 0) },
      ];
    }
    case 'dress': {
      return [
        { joint: 'torso', make: cyl(woman ? 0.14 : 0.19, woman ? 0.17 : 0.22, 0.22, 0, 0.9, 0, 0.82) },
        { joint: 'torso', make: cyl(woman ? 0.15 : 0.2, woman ? 0.15 : 0.2, 0.05, 0, 0.97, 0, 0.8) },
        ...legSkirt(d, woman ? [0.165, 0.19] : [0.18, 0.2], [0.8, 0.4], { r: woman ? [0.2, 0.26] : [0.21, 0.27], y: [0.4, 0.05] }),
      ];
    }
    case 'jacket': {
      return [
        { joint: 'torso', make: box(0.38, 0.6, 0.23, 0, 1.17, 0) },
        { joint: 'torso', make: cyl(0.22, 0.24, 0.24, 0, 0.9, 0, 0.78) },
        ...legSkirt(d, [0.105, 0.1], [0.8, 0.58]),
        { joint: 'torso', make: cyl(0.075, 0.09, 0.06, 0, 1.5, 0) },
        ...limbs(d, 0.014),
      ];
    }
    case 'coat': {
      return [
        { joint: 'torso', make: box(0.38, 0.6, 0.23, 0, 1.17, 0) },
        { joint: 'torso', make: cyl(0.23, 0.245, 0.24, 0, 0.9, 0, 0.78) },
        { joint: 'torso', make: cyl(0.22, 0.22, 0.05, 0, 0.99, 0, 0.78) },
        ...legSkirt(d, [0.12, 0.115], [0.8, 0.43]),
        { joint: 'torso', make: cyl(0.075, 0.09, 0.06, 0, 1.5, 0) },
        ...limbs(d, 0.016),
      ];
    }
    case 'armor': {
      const p: Part[] = [
        { joint: 'torso', make: box(0.4, 0.34, 0.25, 0, 1.28, 0) },
        { joint: 'torso', make: cyl(0.19, 0.19, 0.07, 0, 0.93, 0, 0.76) },
      ];
      for (const [s, sh, el, hp, kn] of [[1, 'shoulderL', 'elbowL', 'hipL', 'kneeL'], [-1, 'shoulderR', 'elbowR', 'hipR', 'kneeR']] as const) {
        p.push({ joint: sh, make: ell(0.09, 0.07, 0.09, s * d.sh, 1.44, 0) });
        p.push({ joint: el, make: cyl(0.052, 0.046, 0.2, s * d.sh, 0.89, 0) });
        p.push({ joint: hp, make: cyl(0.085, 0.075, 0.28, s * d.hip, 0.64, 0) });
        p.push({ joint: kn, make: cyl(0.06, 0.047, 0.24, s * d.hip, 0.21, 0) });
      }
      return p;
    }
    case 'stillsuit': {
      return [
        { joint: 'torso', make: box(0.35, 0.56, 0.21, 0, 1.2, 0) },
        { joint: 'torso', make: box(0.2, 0.17, 0.07, 0, 1.18, 0.13) },
        { joint: 'torso', make: cyl(0.075, 0.095, 0.08, 0, 1.49, 0) },
        { joint: 'neck', make: ell(d.head[0] * 1.3, d.head[1] * 1.18, d.head[2] * 1.22, 0, d.hy - 0.005, -0.01) },
        ...limbs(d, 0.012),
        ...legs(d, 0.012),
      ];
    }
    default:
      return [];
  }
}

function hairParts(id: string, hair: string): Part[] {
  const d = DIMS[id];
  if (!d || hair === 'none') return [];
  const cap: MakeFn = () => new SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56).scale(d.head[0] * 1.07, d.head[1] * 1.05, d.head[2] * 1.1).translate(0, d.hy + 0.004, -0.004);
  const p: Part[] = [{ joint: 'neck', make: cap }];
  if (hair === 'long') p.push({ joint: 'neck', make: box(d.head[0] * 1.8, 0.4, 0.06, 0, d.hy - 0.2, -d.head[2] * 0.95) });
  return p;
}

const cache = new Map<string, Rig>();

/** Skelet figure z obleko in lasmi (isti sklepi in poze; samo dodatni deli). Ostali predmeti in »brez« vrnejo osnovni skelet. */
export function rigFor(type: string | undefined, outfit?: string, hair?: string): Rig | null {
  const base = rigOf(type);
  if (!base) return null;
  const o = outfit && outfit in OUTFITS ? outfit : 'none';
  const h = hair && hair in HAIRS ? hair : 'none';
  if ((base.id !== 'man' && base.id !== 'woman') || (o === 'none' && h === 'none')) return base;
  const key = `${base.id}+${o}+${h}`;
  let r = cache.get(key);
  if (!r) {
    r = { ...base, id: key, base, parts: () => [...base.parts(), ...outfitParts(base.id, o), ...hairParts(base.id, h)] };
    cache.set(key, r);
  }
  return r;
}
