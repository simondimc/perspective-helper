import { BoxGeometry, BufferGeometry, CylinderGeometry, Euler, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Lutka s sklepi. Poza so koti sklepov v stopinjah [a0, a1, a2]:
//  trup/vrat: [nagib naprej, zasuk, nagib vstran]
//  rama/bok:  [zamah naprej, zasuk, odmik vstran (pozitivno = stran od telesa)]
//  komolec/koleno: [upogib]
// Figura gleda v +Z; "L" je na strani +X.

export type JointName = 'torso' | 'neck' | 'shoulderL' | 'shoulderR' | 'elbowL' | 'elbowR' | 'hipL' | 'hipR' | 'kneeL' | 'kneeR';
export const JOINTS: JointName[] = ['torso', 'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR'];
export type Angles = [number, number, number];
export type Pose = Partial<Record<JointName, Angles>>;

interface JointDef {
  parent: JointName | null;
  pivot: [number, number, number];
  side: 1 | -1 | 0;
  kind: 'spine' | 'limb' | 'hinge-fwd' | 'hinge-back';
}

const DEF: Record<JointName, JointDef> = {
  torso: { parent: null, pivot: [0, 0.93, 0], side: 0, kind: 'spine' },
  neck: { parent: 'torso', pivot: [0, 1.47, 0], side: 0, kind: 'spine' },
  shoulderL: { parent: 'torso', pivot: [0.235, 1.42, 0], side: 1, kind: 'limb' },
  shoulderR: { parent: 'torso', pivot: [-0.235, 1.42, 0], side: -1, kind: 'limb' },
  elbowL: { parent: 'shoulderL', pivot: [0.235, 1.12, 0], side: 1, kind: 'hinge-fwd' },
  elbowR: { parent: 'shoulderR', pivot: [-0.235, 1.12, 0], side: -1, kind: 'hinge-fwd' },
  hipL: { parent: null, pivot: [0.09, 0.8, 0], side: 1, kind: 'limb' },
  hipR: { parent: null, pivot: [-0.09, 0.8, 0], side: -1, kind: 'limb' },
  kneeL: { parent: 'hipL', pivot: [0.09, 0.4, 0], side: 1, kind: 'hinge-back' },
  kneeR: { parent: 'hipR', pivot: [-0.09, 0.4, 0], side: -1, kind: 'hinge-back' },
};

/** Omejitve [min, max] posameznih kotov (stopinje). */
export const LIMITS: Record<JointName, Array<[number, number]>> = {
  torso: [[-35, 90], [-70, 70], [-35, 35]],
  neck: [[-50, 60], [-80, 80], [-35, 35]],
  shoulderL: [[-60, 180], [-90, 90], [-20, 180]],
  shoulderR: [[-60, 180], [-90, 90], [-20, 180]],
  elbowL: [[0, 150], [0, 0], [0, 0]],
  elbowR: [[0, 150], [0, 0], [0, 0]],
  hipL: [[-45, 120], [-45, 45], [-20, 80]],
  hipR: [[-45, 120], [-45, 45], [-20, 80]],
  kneeL: [[0, 150], [0, 0], [0, 0]],
  kneeR: [[0, 150], [0, 0], [0, 0]],
};

export const JOINT_LABELS: Record<JointName, string> = {
  torso: 'Trup',
  neck: 'Vrat',
  shoulderL: 'Rama L',
  shoulderR: 'Rama D',
  elbowL: 'Komolec L',
  elbowR: 'Komolec D',
  hipL: 'Bok L',
  hipR: 'Bok D',
  kneeL: 'Koleno L',
  kneeR: 'Koleno D',
};

export const POSES: Record<string, Pose> = {
  Stoji: {},
  Hodi: { hipL: [28, 0, 3], kneeL: [5, 0, 0], hipR: [-22, 0, 3], kneeR: [30, 0, 0], shoulderL: [-25, 0, 8], shoulderR: [25, 0, 8], elbowL: [12, 0, 0], elbowR: [25, 0, 0] },
  Sedi: { hipL: [90, 0, 6], hipR: [90, 0, 6], kneeL: [90, 0, 0], kneeR: [90, 0, 0], shoulderL: [20, 0, 8], shoulderR: [20, 0, 8], elbowL: [60, 0, 0], elbowR: [60, 0, 0], torso: [5, 0, 0] },
  'Roke gor': { shoulderL: [0, 0, 165], shoulderR: [0, 0, 165] },
  Tek: { hipL: [50, 0, 2], kneeL: [20, 0, 0], hipR: [-30, 0, 2], kneeR: [95, 0, 0], shoulderL: [-45, 0, 10], shoulderR: [50, 0, 10], elbowL: [90, 0, 0], elbowR: [90, 0, 0], torso: [15, 0, 0] },
};

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function eulerFor(joint: JointName, a: Angles): Euler {
  const d = DEF[joint];
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
export function jointQuaternion(joint: JointName, a: Angles): Quaternion {
  return new Quaternion().setFromEuler(eulerFor(joint, a));
}

/** Obratno: koti iz rotacije (omejeni na dovoljen razpon). */
export function anglesFromQuaternion(joint: JointName, q: Quaternion): Angles {
  const d = DEF[joint];
  // zamah (x) je lahko večji od 90°, zato pri udih x ne sme biti srednja os
  const e = new Euler().setFromQuaternion(q, d.kind === 'spine' ? 'ZXY' : 'ZYX');
  const s = d.side;
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
  return a.map((v, i) => Math.min(LIMITS[joint][i][1], Math.max(LIMITS[joint][i][0], v))) as Angles;
}

export interface JointFrame {
  /** Svetovni prostor staršev (po vrtenju staršev), prestavljen v pivot tega sklepa, pred vrtenjem sklepa. */
  parent: Matrix4;
  /** Celotna transformacija sklepa (prostor sklepa -> prostor figure). */
  world: Matrix4;
}

/** Premik naprej po verigi sklepov (FK); enote so metri, izhodišče v tleh pod medenico. */
export function jointFrames(pose: Pose): Record<JointName, JointFrame> {
  const out = {} as Record<JointName, JointFrame>;
  const calc = (j: JointName): JointFrame => {
    if (out[j]) return out[j];
    const d = DEF[j];
    const piv = new Vector3(...d.pivot);
    let parentWorld = new Matrix4();
    let parentPivot = new Vector3();
    if (d.parent) {
      parentWorld = calc(d.parent).world;
      parentPivot = new Vector3(...DEF[d.parent].pivot);
    }
    const parent = parentWorld.clone().multiply(new Matrix4().makeTranslation(piv.x - parentPivot.x, piv.y - parentPivot.y, piv.z - parentPivot.z));
    const rot = new Matrix4().makeRotationFromQuaternion(jointQuaternion(j, pose[j] ?? [0, 0, 0]));
    out[j] = { parent, world: parent.clone().multiply(rot) };
    return out[j];
  };
  JOINTS.forEach(calc);
  return out;
}

/** Položaj pivota sklepa v prostoru figure (metri, brez centriranja). */
export function jointPosition(frames: Record<JointName, JointFrame>, j: JointName): Vector3 {
  return new Vector3().setFromMatrixPosition(frames[j].parent);
}

type Part = { joint: JointName | null; make: () => BufferGeometry; at: [number, number, number] };

const cyl = (rt: number, rb: number, h: number) => () => new CylinderGeometry(rt, rb, h, 16);
const box = (w: number, h: number, d: number) => () => new BoxGeometry(w, h, d);

function parts(): Part[] {
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

/** Geometrija v metrih (višina 1,76 m v mirovanju), izhodišče v tleh pod medenico. */
function rawGeometry(pose: Pose): BufferGeometry {
  const frames = jointFrames(pose);
  const geoms = parts().map((p) => {
    const g = p.make().translate(...p.at);
    if (p.joint) {
      const pivot = new Vector3(...DEF[p.joint].pivot);
      g.applyMatrix4(frames[p.joint].world.clone().multiply(new Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z)));
    }
    return g;
  });
  return mergeGeometries(geoms)!;
}

const restGeom = rawGeometry({});
restGeom.computeBoundingBox();
/** Okvir figure v mirovanju: središče in velikost, na katera se pri `size` normalizira. */
export const REST_CENTER = restGeom.boundingBox!.getCenter(new Vector3());
export const REST_SIZE = restGeom.boundingBox!.getSize(new Vector3());
restGeom.dispose();

/** Geometrija figure v pozi; središče in razmerja iz mirovanja, nato skalirana na `size`. */
export function figureGeometry(pose: Pose, size: [number, number, number]): BufferGeometry {
  const g = rawGeometry(pose);
  g.translate(-REST_CENTER.x, -REST_CENTER.y, -REST_CENTER.z);
  return g.scale(size[0] / REST_SIZE.x, size[1] / REST_SIZE.y, size[2] / REST_SIZE.z);
}

/** Pretvori položaj iz prostora figure (metri) v lokalni prostor mesha. */
export function toMeshSpace(v: Vector3, size: [number, number, number]): Vector3 {
  return new Vector3((v.x - REST_CENTER.x) * (size[0] / REST_SIZE.x), (v.y - REST_CENTER.y) * (size[1] / REST_SIZE.y), (v.z - REST_CENTER.z) * (size[2] / REST_SIZE.z));
}

export const hasParent = (j: JointName): JointName | null => DEF[j].parent;
