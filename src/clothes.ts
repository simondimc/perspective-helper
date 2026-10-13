import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Matrix4, Quaternion, Shape, SphereGeometry, Vector3 } from 'three';
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
  military: 'Uniforma: vojak',
  police: 'Uniforma: policist',
  firefighter: 'Uniforma: gasilec',
  doctor: 'Uniforma: zdravnik (bela halja)',
  chef: 'Uniforma: kuhar',
  knight: 'Viteški oklep (čelada)',
  musketeer: 'Mušketir (klobuk s perjem, plašč)',
};

export const HAIRS: Record<string, string> = {
  none: 'Brez (plešast)',
  short: 'Kratki',
  long: 'Dolgi',
};

export const WEAPONS: Record<string, string> = {
  none: 'Brez',
  sabre: 'Sablja',
  sword: 'Meč',
  rapier: 'Rapir',
  dagger: 'Bodalo',
  spear: 'Sulica',
  staff: 'Palica',
  axe: 'Sekira',
  battleAxe: 'Bojna sekira (dvojna)',
  mace: 'Buzdovan',
  warhammer: 'Bojno kladivo',
  club: 'Gorjača',
  bow: 'Lok',
  buckler: 'Ščit: majhen (buckler)',
  roundShield: 'Ščit: okrogel',
  kiteShield: 'Ščit: trikoten',
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
        ...legSkirt(d, woman ? [0.14, 0.15] : [0.15, 0.16], [0.8, 0.4], { r: woman ? [0.16, 0.2] : [0.17, 0.21], y: [0.4, 0.05] }),
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
    case 'military':
    case 'police': {
      const p: Part[] = [
        { joint: 'torso', make: box(0.37, 0.58, 0.22, 0, 1.18, 0) },
        { joint: 'torso', make: cyl(0.2, 0.2, 0.06, 0, 0.93, 0, 0.8) }, // pas
        { joint: 'torso', make: box(0.05, 0.05, 0.03, 0, 0.93, 0.155) }, // zaponka
        { joint: 'torso', make: cyl(0.075, 0.09, 0.05, 0, 1.49, 0) },
        { joint: 'torso', make: cyl(0.215, 0.23, 0.12, 0, 0.86, 0, 0.8) }, // spodnji rob jopiča
        ...limbs(d, 0.013),
        ...legs(d, 0.011),
      ];
      for (const [s2, sh] of [[1, 'shoulderL'], [-1, 'shoulderR']] as const) p.push({ joint: sh, make: box(0.1, 0.014, 0.075, s2 * d.sh, 1.455, 0) }); // naramnice
      if (outfit === 'police') {
        p.push({ joint: 'torso', make: box(0.07, 0.14, 0.05, -0.17, 0.88, 0.1) }); // toka z opremo
        p.push({ joint: 'torso', make: box(0.12, 0.08, 0.02, 0.07, 1.3, 0.115) }); // oznaka na prsih
      }
      p.push({ joint: 'neck', make: cyl(d.head[0] * 1.18, d.head[0] * 1.24, 0.07, 0, d.hy + d.head[1] * 0.78, 0) });
      p.push({ joint: 'neck', make: cyl(d.head[0] * 1.08, d.head[0] * 1.12, 0.045, 0, d.hy + d.head[1] * 0.98, -0.005) });
      p.push({ joint: 'neck', make: box(d.head[0] * 2.0, 0.012, 0.09, 0, d.hy + d.head[1] * 0.55, d.head[2] * 1.05) }); // šilt
      return p;
    }
    case 'firefighter': {
      return [
        { joint: 'torso', make: box(0.4, 0.6, 0.25, 0, 1.17, 0) },
        { joint: 'torso', make: cyl(0.24, 0.26, 0.48, 0, 0.78, 0, 0.8) },
        { joint: 'torso', make: box(0.42, 0.03, 0.26, 0, 1.0, 0) },
        { joint: 'torso', make: box(0.42, 0.03, 0.26, 0, 0.62, 0) }, // odsevni pasovi
        { joint: 'torso', make: cyl(0.075, 0.095, 0.06, 0, 1.5, 0) },
        ...limbs(d, 0.02),
        ...legs(d, 0.02),
        { joint: 'neck', make: () => new SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(d.head[0] * 1.3, d.head[1] * 1.15, d.head[2] * 1.3).translate(0, d.hy + 0.01, 0) },
        { joint: 'neck', make: box(d.head[0] * 2.7, 0.012, d.head[2] * 2.1, 0, d.hy - d.head[1] * 0.2, -0.02) }, // zadnji rob čelade
        { joint: 'neck', make: box(0.03, 0.05, 0.17, 0, d.hy + d.head[1] * 1.1, 0) }, // greben
      ];
    }
    case 'doctor': {
      return [
        { joint: 'torso', make: box(0.38, 0.6, 0.23, 0, 1.17, 0) },
        { joint: 'torso', make: cyl(0.23, 0.245, 0.24, 0, 0.9, 0, 0.78) },
        ...legSkirt(d, [0.12, 0.115], [0.8, 0.45]),
        { joint: 'torso', make: box(0.1, 0.22, 0.02, -0.08, 1.33, 0.12) }, // ovratnik (reverji)
        { joint: 'torso', make: box(0.1, 0.22, 0.02, 0.08, 1.33, 0.12) },
        { joint: 'torso', make: box(0.08, 0.07, 0.02, 0.12, 0.95, 0.125) }, // žep
        { joint: 'torso', make: cyl(0.075, 0.09, 0.06, 0, 1.5, 0) },
        ...limbs(d, 0.016),
      ];
    }
    case 'chef': {
      return [
        { joint: 'torso', make: box(0.41, 0.6, 0.25, 0, 1.17, 0) },
        { joint: 'torso', make: cyl(0.23, 0.25, 0.2, 0, 0.88, 0, 0.78) },
        { joint: 'torso', make: box(0.3, 0.52, 0.02, 0, 0.78, 0.135) }, // predpasnik
        { joint: 'torso', make: box(0.34, 0.03, 0.02, 0, 1.05, 0.14) },
        { joint: 'torso', make: cyl(0.075, 0.09, 0.06, 0, 1.5, 0) },
        ...limbs(d, 0.02),
        { joint: 'neck', make: cyl(d.head[0] * 1.06, d.head[0] * 1.14, 0.18, 0, d.hy + d.head[1] * 0.85, 0) }, // kuharska kapa
        { joint: 'neck', make: ell(d.head[0] * 1.5, 0.1, d.head[2] * 1.5, 0, d.hy + d.head[1] * 0.85 + 0.17, 0) },
      ];
    }
    case 'knight': {
      const p: Part[] = [
        { joint: 'torso', make: box(0.42, 0.38, 0.27, 0, 1.25, 0) },
        { joint: 'torso', make: box(0.4, 0.2, 0.25, 0, 0.98, 0) },
        { joint: 'torso', make: cyl(0.23, 0.27, 0.2, 0, 0.82, 0, 0.8) }, // krilo iz ploščic
        { joint: 'torso', make: cyl(0.095, 0.115, 0.07, 0, 1.5, 0) },
      ];
      for (const [s2, sh, el, wr, hp, kn] of [[1, 'shoulderL', 'elbowL', 'wristL', 'hipL', 'kneeL'], [-1, 'shoulderR', 'elbowR', 'wristR', 'hipR', 'kneeR']] as const) {
        p.push({ joint: sh, make: ell(0.1, 0.085, 0.1, s2 * d.sh, 1.44, 0) });
        p.push({ joint: sh, make: cyl(0.062, 0.056, 0.3, s2 * d.sh, 1.27, 0) });
        p.push({ joint: el, make: cyl(0.058, 0.05, 0.28, s2 * d.sh, 0.98, 0) });
        p.push({ joint: el, make: ell(0.06, 0.05, 0.06, s2 * d.sh, 1.12, 0) });
        p.push({ joint: wr, make: box(0.075, 0.1, 0.05, s2 * d.sh, 0.79, 0) }); // rokavica
        p.push({ joint: hp, make: cyl(0.085, 0.07, 0.4, s2 * d.hip, 0.6, 0) });
        p.push({ joint: kn, make: cyl(0.062, 0.05, 0.38, s2 * d.hip, 0.21, 0) });
        p.push({ joint: kn, make: ell(0.065, 0.06, 0.07, s2 * d.hip, 0.41, 0.02) });
      }
      const [hx, hy, hz] = d.head;
      p.push({ joint: 'neck', make: ell(hx * 1.22, hy * 1.2, hz * 1.22, 0, d.hy + hy * 0.1, 0) }); // lobanja čelade
      p.push({ joint: 'neck', make: cyl(hx * 1.0, hx * 1.2, hy * 0.7, 0, d.hy - hy * 0.95, 0, hz / hx) }); // ščitnik za vrat
      p.push({ joint: 'neck', make: box(hx * 1.6, 0.016, 0.02, 0, d.hy + hy * 0.1, hz * 1.2) }); // reža za vid
      p.push({ joint: 'neck', make: box(0.02, hy * 0.9, 0.02, 0, d.hy - hy * 0.35, hz * 1.2) }); // nosni ščitnik
      return p;
    }
    case 'musketeer': {
      const p: Part[] = [
        { joint: 'torso', make: box(0.38, 0.52, 0.23, 0, 1.2, 0) },
        { joint: 'torso', make: cyl(0.21, 0.26, 0.2, 0, 0.9, 0, 0.8) }, // krilce telovnika
        { joint: 'torso', make: box(d.sh * 2 + 0.02, 0.9, 0.035, 0, 0.98, -0.13) }, // plašč na hrbtu
        { joint: 'torso', make: box(d.sh * 2 + 0.1, 0.07, 0.3, 0, 1.43, -0.01) },
        { joint: 'torso', make: box(0.2, 0.025, 0.02, 0, 1.44, 0.135) }, // čipkast ovratnik
        ...limbs(d, 0.012),
      ];
      for (const [s2, hp, kn] of [[1, 'hipL', 'kneeL'], [-1, 'hipR', 'kneeR']] as const) {
        p.push({ joint: hp, make: cyl(0.085, 0.07, 0.4, s2 * d.hip, 0.6, 0) }); // bridž hlače
        p.push({ joint: kn, make: cyl(0.075, 0.048, 0.2, s2 * d.hip, 0.17, 0.03) }); // škornji z zavihkom
        p.push({ joint: kn, make: cyl(0.07, 0.07, 0.02, s2 * d.hip, 0.3, 0.03, 1) });
      }
      p.push({ joint: 'neck', make: cyl(d.head[0] * 2.1, d.head[0] * 2.1, 0.012, 0, d.hy + d.head[1] * 0.62, -0.01) }); // krajec klobuka
      p.push({ joint: 'neck', make: cyl(d.head[0] * 1.15, d.head[0] * 1.25, 0.11, 0, d.hy + d.head[1] * 0.62 + 0.05, -0.01) });
      p.push({ joint: 'neck', make: () => new BoxGeometry(0.02, 0.04, 0.26).rotateX(-0.35).translate(d.head[0] * 1.15, d.hy + d.head[1] * 0.62 + 0.13, -0.1) }); // perje
      return p;
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

// ---------------------------------------------------------------- orožje v roki
// Orožje je pripeto na zapestje. V mirovanju kaže ostrina pod 45° naprej-navzdol (da ne seže pod tla); zapestje s kotom −45° (poze za
// sabljanje) jo poravna z podlaktjo, tako da je orožje podaljšek iztegnjene roke.

/** Kvader dolžine L vzdolž d, širine ww vzdolž w, debeline wt, z začetkom v točki A. */
function bar(A: Vector3, d: Vector3, w: Vector3, L: number, ww: number, wt: number): BufferGeometry {
  const t = new Vector3().crossVectors(d, w).normalize();
  const m = new Matrix4().makeBasis(t, w, d).setPosition(A.clone().addScaledVector(d, L / 2));
  return new BoxGeometry(wt, ww, L).applyMatrix4(m);
}

/** Ščit je pripet na podlaket (na zunanji strani), ploskev gleda vstran od telesa; z zasukom zapestja ga obrneš naprej. */
function shieldParts(id: string, kind: string, side: 1 | -1): Part[] {
  const d = DIMS[id];
  if (!d) return [];
  const joint = side === 1 ? 'wristL' : 'wristR';
  const cx = side * (d.sh + 0.075);
  const cy = 0.92;
  const disc = (r: number, t: number): BufferGeometry => new CylinderGeometry(r, r, t, 32).rotateZ(Math.PI / 2).translate(cx, cy, 0);
  const boss = (r: number): BufferGeometry => new SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-side * Math.PI / 2).translate(cx + side * 0.012, cy, 0);
  const geoms: BufferGeometry[] = [];
  if (kind === 'buckler') {
    geoms.push(disc(0.15, 0.02), boss(0.06), new CylinderGeometry(0.155, 0.155, 0.032, 32).rotateZ(Math.PI / 2).translate(cx - side * 0.004, cy, 0));
  } else if (kind === 'roundShield') {
    geoms.push(disc(0.32, 0.026), boss(0.075), new CylinderGeometry(0.325, 0.325, 0.036, 36).rotateZ(Math.PI / 2).translate(cx - side * 0.005, cy, 0));
    geoms.push(new BoxGeometry(0.02, 0.5, 0.05).translate(cx + side * 0.013, cy, 0)); // navpična ojačitev
  } else if (kind === 'kiteShield') {
    // trikoten ščit: zgoraj zaokrožen, spodaj špičast; dolga os vzdolž podlakti
    const shp = new Shape();
    const w = 0.22;
    shp.moveTo(0, 0.34);
    shp.quadraticCurveTo(w, 0.36, w, 0.2);
    shp.lineTo(w * 0.85, -0.05);
    shp.lineTo(0, -0.42);
    shp.lineTo(-w * 0.85, -0.05);
    shp.lineTo(-w, 0.2);
    shp.quadraticCurveTo(-w, 0.36, 0, 0.34);
    const body = new ExtrudeGeometry(shp, { depth: 0.028, bevelEnabled: false, curveSegments: 14 }).rotateY(-Math.PI / 2).translate(0.014 + cx, cy, 0);
    geoms.push(body, boss(0.06));
  } else return [];
  return geoms.map((g) => ({ joint, make: () => g }));
}

function weaponParts(id: string, weapon: string, side: 1 | -1): Part[] {
  const d = DIMS[id];
  if (!d || weapon === 'none') return [];
  if (weapon === 'buckler' || weapon === 'roundShield' || weapon === 'kiteShield') return shieldParts(id, weapon, side);
  const joint = side === 1 ? 'wristL' : 'wristR';
  const G = new Vector3(side * d.sh, 0.8, 0);
  const u = new Vector3(0, -Math.SQRT1_2, Math.SQRT1_2); // smer rezila
  const w0 = new Vector3(0, Math.SQRT1_2, Math.SQRT1_2); // širina rezila (ostrina)
  const at = (k: number) => G.clone().addScaledVector(u, k);
  const X = new Vector3(side, 0, 0);
  const geoms: BufferGeometry[] = [];
  const grip = (len: number, r: number) => geoms.push(bar(at(-len / 2 - 0.02), u, w0, len, r * 1.6, r * 1.6));
  const rod = (k0: number, len: number, r: number): BufferGeometry =>
    new CylinderGeometry(r, r, len, 10).applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), u)).translate(...at(k0 + len / 2).toArray());
  const pommel = (k: number, r: number) => geoms.push(new SphereGeometry(r, 12, 8).translate(...at(k).toArray()));
  const crossGuard = (k: number, width: number) => geoms.push(bar(at(k).addScaledVector(X, -width / 2), X, w0, width, 0.013, 0.013));
  if (weapon === 'sabre') {
    grip(0.11, 0.015);
    pommel(-0.085, 0.02);
    crossGuard(0.065, 0.1);
    // branik za členke (D-obroč) od glavice do križa
    const P0 = at(-0.07).addScaledVector(w0, -0.032);
    const P1 = at(0.065).addScaledVector(w0, -0.045);
    geoms.push(bar(P0, new Vector3().subVectors(P1, P0).normalize(), X, P1.distanceTo(P0), 0.008, 0.008));
    // ukrivljeno rezilo iz odsekov, zožuje se proti konici
    let A = at(0.075);
    const seg = 0.15;
    for (let k = 0; k < 6; k++) {
      const a = (k * 4.5 * Math.PI) / 180;
      const dir = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(w0, -Math.sin(a)).normalize();
      const wd = w0.clone().multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a)).normalize();
      geoms.push(bar(A, dir, wd, seg, 0.034 - k * 0.0035, 0.006));
      A = A.clone().addScaledVector(dir, seg);
    }
  } else if (weapon === 'sword') {
    // meč: ravno dvorezno rezilo, široka glavica in križ
    grip(0.12, 0.016);
    pommel(-0.1, 0.025);
    crossGuard(0.07, 0.21);
    geoms.push(bar(at(0.08), u, w0, 0.55, 0.048, 0.008));
    geoms.push(bar(at(0.63), u, w0, 0.2, 0.03, 0.007));
    geoms.push(bar(at(0.83), u, w0, 0.06, 0.012, 0.005));
  } else if (weapon === 'rapier') {
    grip(0.1, 0.0125);
    pommel(-0.08, 0.018);
    crossGuard(0.06, 0.26);
    // košara: krogla pri križu in obroč ob straneh
    const dome = new SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), u));
    geoms.push(dome.translate(...at(0.04).toArray()));
    geoms.push(bar(at(0.075), u, w0, 0.95, 0.013, 0.01));
  } else if (weapon === 'dagger') {
    grip(0.09, 0.0135);
    pommel(-0.075, 0.019);
    crossGuard(0.05, 0.17);
    geoms.push(bar(at(0.06), u, w0, 0.19, 0.032, 0.007));
    geoms.push(bar(at(0.25), u, w0, 0.11, 0.016, 0.006));
  } else if (weapon === 'staff' || weapon === 'spear') {
    const top = weapon === 'staff' ? 1.1 : 1.35;
    geoms.push(rod(-0.55, top + 0.55, weapon === 'staff' ? 0.018 : 0.014));
    if (weapon === 'staff') geoms.push(new SphereGeometry(0.04, 12, 8).translate(...at(top + 0.03).toArray()));
    else {
      geoms.push(bar(at(top), u, w0, 0.16, 0.05, 0.008));
      geoms.push(bar(at(top + 0.16), u, w0, 0.09, 0.022, 0.006));
    }
  } else if (weapon === 'axe' || weapon === 'battleAxe') {
    const len = weapon === 'axe' ? 0.7 : 1.05;
    geoms.push(rod(-0.12, len + 0.12, 0.017));
    const head = (sgn: number) => {
      geoms.push(bar(at(len - 0.2).addScaledVector(w0, sgn * 0.07), u, w0, 0.2, 0.12, 0.012));
    };
    geoms.push(bar(at(len - 0.15), u, w0, 0.12, 0.05, 0.04));
    head(1);
    if (weapon === 'battleAxe') head(-1);
    else geoms.push(bar(at(len - 0.1).addScaledVector(w0, -0.045), u, w0, 0.07, 0.03, 0.03));
  } else if (weapon === 'mace') {
    geoms.push(rod(-0.1, 0.7, 0.017));
    geoms.push(new SphereGeometry(0.065, 14, 10).translate(...at(0.77).toArray()));
    for (const a of [0, 60, 120]) {
      const wd = w0.clone().applyAxisAngle(u, (a * Math.PI) / 180);
      geoms.push(bar(at(0.77 - 0.09), u, wd, 0.18, 0.15, 0.012));
    }
  } else if (weapon === 'warhammer') {
    geoms.push(rod(-0.12, 0.85, 0.017));
    geoms.push(bar(at(0.62), u, w0, 0.12, 0.04, 0.05).translate(0, 0, 0));
    geoms.push(bar(at(0.62).addScaledVector(w0, 0.07), u, w0, 0.12, 0.09, 0.06));
    geoms.push(bar(at(0.665).addScaledVector(w0, -0.05), u, w0, 0.03, 0.12, 0.012));
  } else if (weapon === 'club') {
    geoms.push(new CylinderGeometry(0.05, 0.016, 0.6, 12).applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), u.clone().negate())).translate(...at(0.28).toArray()));
  } else if (weapon === 'bow') {
    // lok: lok iz odsekov v ravnini roke, tetiva ravna; držaj je v roki
    const pt = (t: number) => G.clone().addScaledVector(w0, t * 0.75).addScaledVector(u, 0.09 * (1 - t * t));
    const N = 8;
    for (let i = 0; i < N; i++) {
      const A = pt(-1 + (2 * i) / N);
      const B = pt(-1 + (2 * (i + 1)) / N);
      geoms.push(bar(A, new Vector3().subVectors(B, A).normalize(), X, A.distanceTo(B), 0.02 - Math.abs(i - N / 2 + 0.5) * 0.002, 0.016));
    }
    geoms.push(bar(pt(-1), w0, X, 1.5, 0.004, 0.004));
  }
  return geoms.filter((g) => g.attributes.position.count > 0).map((g) => ({ joint, make: () => g }));
}

const cache = new Map<string, Rig>();

/** Skelet figure z obleko in lasmi (isti sklepi in poze; samo dodatni deli). Ostali predmeti in »brez« vrnejo osnovni skelet. */
export function rigFor(type: string | undefined, outfit?: string, hair?: string, weaponR?: string, weaponL?: string): Rig | null {
  const base = rigOf(type);
  if (!base) return null;
  const o = outfit && outfit in OUTFITS ? outfit : 'none';
  const h = hair && hair in HAIRS ? hair : 'none';
  const wr = weaponR && weaponR in WEAPONS ? weaponR : 'none';
  const wl = weaponL && weaponL in WEAPONS ? weaponL : 'none';
  if ((base.id !== 'man' && base.id !== 'woman') || (o === 'none' && h === 'none' && wr === 'none' && wl === 'none')) return base;
  const key = `${base.id}+${o}+${h}+${wr}+${wl}`;
  let r = cache.get(key);
  if (!r) {
    r = { ...base, id: key, base, parts: () => [...base.parts(), ...outfitParts(base.id, o), ...hairParts(base.id, h), ...weaponParts(base.id, wr, -1), ...weaponParts(base.id, wl, 1)] };
    cache.set(key, r);
  }
  return r;
}
