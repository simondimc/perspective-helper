import { BoxGeometry, BufferGeometry, CylinderGeometry, Euler, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Skelet (rig) za figure in živali. Poza so koti sklepov v stopinjah [a0, a1, a2]; pomen kotov določa vrsta sklepa:
//  spine:      [nagib naprej, zasuk, nagib vstran]            (trup, vrat, glava, rep, rilec)
//  limb:       [zamah naprej, zasuk, odmik vstran]            (rama, bok; pozitivno = stran od telesa)
//  hinge-fwd:  [upogib]  podlaket se upogne naprej            (komolec človeka)
//  hinge-back: [upogib]  spodnji del se upogne nazaj          (koleno)
// Predmeti gledajo v +Z; "L" je na strani +X.

export type JointName = string;
export type Angles = [number, number, number];
export type Pose = Record<string, Angles>;
export type Kind = 'spine' | 'limb' | 'hinge-fwd' | 'hinge-back';

export interface JointDef {
  parent: string | null;
  pivot: [number, number, number];
  side: 1 | -1 | 0;
  kind: Kind;
  label: string;
  /** Imena osi za drsnike (privzeta po vrsti sklepa). */
  axes?: string[];
  /** Omejitve kotov; privzete po vrsti sklepa. */
  limits?: Array<[number, number]>;
}

export interface Part {
  joint: string | null;
  make: (seg: number) => BufferGeometry;
  at?: [number, number, number];
}

export interface Rig {
  id: string;
  joints: string[];
  def: Record<string, JointDef>;
  parts: () => Part[];
  groups: Array<{ title: string; joints: string[] }>;
  poses: Record<string, Pose>;
}

const DEFAULT_AXES: Record<Kind, string[]> = {
  spine: ['Nagib naprej', 'Zasuk', 'Nagib vstran'],
  limb: ['Zamah naprej', 'Zasuk', 'Odmik vstran'],
  'hinge-fwd': ['Upogib'],
  'hinge-back': ['Upogib'],
};
const DEFAULT_LIMITS: Record<Kind, Array<[number, number]>> = {
  spine: [[-50, 70], [-70, 70], [-35, 35]],
  limb: [[-50, 140], [-60, 60], [-30, 90]],
  'hinge-fwd': [[0, 150], [0, 0], [0, 0]],
  'hinge-back': [[0, 150], [0, 0], [0, 0]],
};

export const axesOf = (rig: Rig, j: string): string[] => rig.def[j].axes ?? DEFAULT_AXES[rig.def[j].kind];
export const limitsOf = (rig: Rig, j: string): Array<[number, number]> => {
  const l = rig.def[j].limits ?? DEFAULT_LIMITS[rig.def[j].kind];
  return [l[0] ?? [0, 0], l[1] ?? [0, 0], l[2] ?? [0, 0]];
};

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function eulerFor(rig: Rig, joint: string, a: Angles): Euler {
  const d = rig.def[joint];
  const s = d.side;
  switch (d.kind) {
    case 'spine':
      return new Euler(rad(a[0]), rad(a[1]), rad(a[2]), 'ZXY');
    case 'limb':
      return new Euler(rad(-a[0]), rad(s * a[1]), rad(s * a[2]), 'ZYX');
    case 'hinge-fwd':
      return new Euler(rad(-a[0]), 0, 0, 'ZYX');
    case 'hinge-back':
      return new Euler(rad(a[0]), 0, 0, 'ZYX');
  }
}

/** Lokalna rotacija sklepa iz kotov. */
export function jointQuaternion(rig: Rig, joint: string, a: Angles): Quaternion {
  return new Quaternion().setFromEuler(eulerFor(rig, joint, a));
}

/** Obratno: koti iz rotacije (omejeni na dovoljen razpon). */
export function anglesFromQuaternion(rig: Rig, joint: string, q: Quaternion): Angles {
  const d = rig.def[joint];
  const s = d.side;
  // zamah (x) je lahko večji od 90°, zato pri udih x ne sme biti srednja os
  const e = new Euler().setFromQuaternion(q, d.kind === 'spine' ? 'ZXY' : 'ZYX');
  let a: Angles;
  switch (d.kind) {
    case 'spine':
      a = [deg(e.x), deg(e.y), deg(e.z)];
      break;
    case 'limb':
      a = [-deg(e.x), s * deg(e.y), s * deg(e.z)];
      break;
    case 'hinge-fwd':
      a = [-deg(e.x), 0, 0];
      break;
    default:
      a = [deg(e.x), 0, 0];
  }
  const lim = limitsOf(rig, joint);
  return a.map((v, i) => Math.min(lim[i][1], Math.max(lim[i][0], v))) as Angles;
}

export interface JointFrame {
  /** Prostor staršev (po vrtenju staršev), prestavljen v pivot tega sklepa, pred vrtenjem sklepa. */
  parent: Matrix4;
  /** Celotna transformacija sklepa (prostor sklepa -> prostor figure). */
  world: Matrix4;
}

/** Premik naprej po verigi sklepov (FK); enote so metri. */
export function jointFrames(pose: Pose, rig: Rig): Record<string, JointFrame> {
  const out: Record<string, JointFrame> = {};
  const calc = (j: string): JointFrame => {
    if (out[j]) return out[j];
    const d = rig.def[j];
    const piv = new Vector3(...d.pivot);
    let parentWorld = new Matrix4();
    let parentPivot = new Vector3();
    if (d.parent) {
      parentWorld = calc(d.parent).world;
      parentPivot = new Vector3(...rig.def[d.parent].pivot);
    }
    const parent = parentWorld.clone().multiply(new Matrix4().makeTranslation(piv.x - parentPivot.x, piv.y - parentPivot.y, piv.z - parentPivot.z));
    const rot = new Matrix4().makeRotationFromQuaternion(jointQuaternion(rig, j, pose[j] ?? [0, 0, 0]));
    out[j] = { parent, world: parent.clone().multiply(rot) };
    return out[j];
  };
  rig.joints.forEach(calc);
  return out;
}

/** Položaj pivota sklepa v prostoru predmeta (metri, brez centriranja). */
export function jointPosition(frames: Record<string, JointFrame>, j: string): Vector3 {
  return new Vector3().setFromMatrixPosition(frames[j].parent);
}

function rawGeometry(rig: Rig, pose: Pose, seg: number): BufferGeometry {
  const frames = jointFrames(pose, rig);
  const geoms = rig.parts().map((p) => {
    const g = p.make(seg);
    if (p.at) g.translate(...p.at);
    if (p.joint) {
      const pivot = new Vector3(...rig.def[p.joint].pivot);
      g.applyMatrix4(frames[p.joint].world.clone().multiply(new Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z)));
    }
    return g;
  });
  return mergeGeometries(geoms)!;
}

const restCache = new Map<string, { center: Vector3; size: Vector3 }>();
function rest(rig: Rig): { center: Vector3; size: Vector3 } {
  let r = restCache.get(rig.id);
  if (!r) {
    const g = rawGeometry(rig, {}, 24);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    r = { center: b.getCenter(new Vector3()), size: b.getSize(new Vector3()) };
    g.dispose();
    restCache.set(rig.id, r);
  }
  return r;
}

/** Naravna velikost predmeta v mirovanju (m). */
export const restSize = (rig: Rig): [number, number, number] => {
  const s = rest(rig).size;
  return [s.x, s.y, s.z];
};

/** Geometrija v pozi; središče in razmerja iz mirovanja, nato skalirana na `size`. `lowPoly`: groba različica za robove. */
export function rigGeometry(rig: Rig, pose: Pose, size: [number, number, number], lowPoly = false): BufferGeometry {
  const { center, size: rs } = rest(rig);
  const g = rawGeometry(rig, pose, lowPoly ? 10 : 24);
  g.translate(-center.x, -center.y, -center.z);
  return g.scale(size[0] / rs.x, size[1] / rs.y, size[2] / rs.z);
}

/** Pretvori položaj iz prostora predmeta (metri) v lokalni prostor mesha. */
export function toMeshSpace(rig: Rig, v: Vector3, size: [number, number, number]): Vector3 {
  const { center, size: rs } = rest(rig);
  return new Vector3((v.x - center.x) * (size[0] / rs.x), (v.y - center.y) * (size[1] / rs.y), (v.z - center.z) * (size[2] / rs.z));
}

// ---------------------------------------------------------------- človek

type HDef = Pick<JointDef, 'parent' | 'pivot' | 'side' | 'kind' | 'label' | 'limits'>;

const HUMAN_BASE: Record<string, HDef> = {
  torso: { parent: null, pivot: [0, 0.93, 0], side: 0, kind: 'spine', label: 'Trup', limits: [[-35, 90], [-70, 70], [-35, 35]] },
  neck: { parent: 'torso', pivot: [0, 1.47, 0], side: 0, kind: 'spine', label: 'Vrat', limits: [[-50, 60], [-80, 80], [-35, 35]] },
  shoulderL: { parent: 'torso', pivot: [0.235, 1.42, 0], side: 1, kind: 'limb', label: 'Rama L', limits: [[-60, 180], [-90, 90], [-20, 180]] },
  shoulderR: { parent: 'torso', pivot: [-0.235, 1.42, 0], side: -1, kind: 'limb', label: 'Rama D', limits: [[-60, 180], [-90, 90], [-20, 180]] },
  elbowL: { parent: 'shoulderL', pivot: [0.235, 1.12, 0], side: 1, kind: 'hinge-fwd', label: 'Komolec L' },
  elbowR: { parent: 'shoulderR', pivot: [-0.235, 1.12, 0], side: -1, kind: 'hinge-fwd', label: 'Komolec D' },
  hipL: { parent: null, pivot: [0.09, 0.8, 0], side: 1, kind: 'limb', label: 'Bok L', limits: [[-45, 120], [-45, 45], [-20, 80]] },
  hipR: { parent: null, pivot: [-0.09, 0.8, 0], side: -1, kind: 'limb', label: 'Bok D', limits: [[-45, 120], [-45, 45], [-20, 80]] },
  kneeL: { parent: 'hipL', pivot: [0.09, 0.4, 0], side: 1, kind: 'hinge-back', label: 'Koleno L' },
  kneeR: { parent: 'hipR', pivot: [-0.09, 0.4, 0], side: -1, kind: 'hinge-back', label: 'Koleno D' },
};

const HUMAN_GROUPS = [
  { title: 'Trup in vrat', joints: ['torso', 'neck'] },
  { title: 'Leva roka', joints: ['shoulderL', 'elbowL'] },
  { title: 'Desna roka', joints: ['shoulderR', 'elbowR'] },
  { title: 'Leva noga', joints: ['hipL', 'kneeL'] },
  { title: 'Desna noga', joints: ['hipR', 'kneeR'] },
];

export const HUMAN_POSES: Record<string, Pose> = {
  Stoji: {},
  Hodi: { hipL: [28, 0, 3], kneeL: [5, 0, 0], hipR: [-22, 0, 3], kneeR: [30, 0, 0], shoulderL: [-25, 0, 8], shoulderR: [25, 0, 8], elbowL: [12, 0, 0], elbowR: [25, 0, 0] },
  Sedi: { hipL: [90, 0, 6], hipR: [90, 0, 6], kneeL: [90, 0, 0], kneeR: [90, 0, 0], shoulderL: [20, 0, 8], shoulderR: [20, 0, 8], elbowL: [60, 0, 0], elbowR: [60, 0, 0], torso: [5, 0, 0] },
  'Roke gor': { shoulderL: [0, 0, 165], shoulderR: [0, 0, 165] },
  Tek: { hipL: [50, 0, 2], kneeL: [20, 0, 0], hipR: [-30, 0, 2], kneeR: [95, 0, 0], shoulderL: [-45, 0, 10], shoulderR: [50, 0, 10], elbowL: [90, 0, 0], elbowR: [90, 0, 0], torso: [15, 0, 0] },
};

const cyl = (rt: number, rb: number, h: number) => (): BufferGeometry => new CylinderGeometry(rt, rb, h, 16);
const box = (w: number, h: number, d: number) => (): BufferGeometry => new BoxGeometry(w, h, d);

function manParts(): Part[] {
  const p: Part[] = [
    { joint: null, make: box(0.3, 0.18, 0.19), at: [0, 0.84, 0] },
    { joint: 'torso', make: box(0.34, 0.54, 0.2), at: [0, 1.2, 0] },
    { joint: 'neck', make: cyl(0.045, 0.05, 0.1), at: [0, 1.51, 0] },
    { joint: 'neck', make: () => new SphereGeometry(1, 24, 16).scale(0.095, 0.12, 0.11), at: [0, 1.64, 0] },
  ];
  for (const s of [1, -1]) {
    const sh = s === 1 ? 'shoulderL' : 'shoulderR';
    const el = s === 1 ? 'elbowL' : 'elbowR';
    const hp = s === 1 ? 'hipL' : 'hipR';
    const kn = s === 1 ? 'kneeL' : 'kneeR';
    p.push(
      { joint: sh, make: cyl(0.048, 0.04, 0.3), at: [s * 0.235, 1.27, 0] },
      { joint: el, make: cyl(0.04, 0.032, 0.28), at: [s * 0.235, 0.98, 0] },
      { joint: el, make: box(0.05, 0.09, 0.035), at: [s * 0.235, 0.795, 0] },
      { joint: hp, make: cyl(0.075, 0.06, 0.4), at: [s * 0.09, 0.6, 0] },
      { joint: kn, make: cyl(0.055, 0.04, 0.38), at: [s * 0.09, 0.21, 0] },
      { joint: kn, make: box(0.09, 0.06, 0.24), at: [s * 0.09, 0.03, 0.06] },
    );
  }
  return p;
}

function womanParts(): Part[] {
  const ell = (rx: number, ry: number, rz: number) => (): BufferGeometry => new SphereGeometry(1, 16, 12).scale(rx, ry, rz);
  const p: Part[] = [
    { joint: null, make: box(0.34, 0.2, 0.2), at: [0, 0.85, 0] },
    { joint: 'torso', make: box(0.25, 0.22, 0.17), at: [0, 1.05, 0] },
    { joint: 'torso', make: box(0.3, 0.3, 0.19), at: [0, 1.3, 0] },
    { joint: 'torso', make: ell(0.07, 0.065, 0.06), at: [0.075, 1.28, 0.09] },
    { joint: 'torso', make: ell(0.07, 0.065, 0.06), at: [-0.075, 1.28, 0.09] },
    { joint: 'neck', make: cyl(0.04, 0.045, 0.1), at: [0, 1.5, 0] },
    { joint: 'neck', make: () => new SphereGeometry(1, 24, 16).scale(0.088, 0.11, 0.1), at: [0, 1.62, 0] },
  ];
  for (const s of [1, -1]) {
    const sh = s === 1 ? 'shoulderL' : 'shoulderR';
    const el = s === 1 ? 'elbowL' : 'elbowR';
    const hp = s === 1 ? 'hipL' : 'hipR';
    const kn = s === 1 ? 'kneeL' : 'kneeR';
    p.push(
      { joint: sh, make: cyl(0.04, 0.034, 0.3), at: [s * 0.2, 1.27, 0] },
      { joint: el, make: cyl(0.034, 0.028, 0.28), at: [s * 0.2, 0.98, 0] },
      { joint: el, make: box(0.045, 0.085, 0.03), at: [s * 0.2, 0.795, 0] },
      { joint: hp, make: cyl(0.07, 0.052, 0.4), at: [s * 0.1, 0.6, 0] },
      { joint: kn, make: cyl(0.05, 0.034, 0.38), at: [s * 0.1, 0.21, 0] },
      { joint: kn, make: box(0.08, 0.055, 0.22), at: [s * 0.1, 0.03, 0.055] },
    );
  }
  return p;
}

function toDef(base: Record<string, HDef>, over: Record<string, [number, number, number]> = {}): Record<string, JointDef> {
  const out: Record<string, JointDef> = {};
  for (const [k, v] of Object.entries(base)) out[k] = { ...v, pivot: over[k] ?? v.pivot };
  return out;
}

export const MAN_RIG: Rig = { id: 'man', joints: Object.keys(HUMAN_BASE), def: toDef(HUMAN_BASE), parts: manParts, groups: HUMAN_GROUPS, poses: HUMAN_POSES };

/** Ženska: ožja ramena in širši boki, zato so pivoti ramen in bokov drugje. */
export const WOMAN_RIG: Rig = {
  id: 'woman',
  joints: Object.keys(HUMAN_BASE),
  def: toDef(HUMAN_BASE, { shoulderL: [0.2, 1.42, 0], shoulderR: [-0.2, 1.42, 0], elbowL: [0.2, 1.12, 0], elbowR: [-0.2, 1.12, 0], hipL: [0.1, 0.8, 0], hipR: [-0.1, 0.8, 0], kneeL: [0.1, 0.4, 0], kneeR: [-0.1, 0.4, 0] }),
  parts: womanParts,
  groups: HUMAN_GROUPS,
  poses: HUMAN_POSES,
};

// ---------------------------------------------------------------- pomožne za živali

/** Elipsoid (polmeri rx, ry, rz) z gostoto glede na `seg`. */
export const ellG = (seg: number, rx: number, ry: number, rz: number): BufferGeometry => new SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7))).scale(rx, ry, rz);
export const cylG = (seg: number, rt: number, rb: number, h: number): BufferGeometry => new CylinderGeometry(rt, rb, h, Math.max(8, seg));
export const boxG = (w: number, h: number, d: number): BufferGeometry => new BoxGeometry(w, h, d);

type JD = Omit<JointDef, 'parent' | 'pivot' | 'side' | 'kind' | 'label'>;
/** Hitra definicija sklepa. */
export const joint = (parent: string | null, pivot: [number, number, number], side: 1 | -1 | 0, kind: Kind, label: string, extra: JD = {}): JointDef => ({ parent, pivot, side, kind, label, ...extra });
