import { BufferGeometry, ConeGeometry, Quaternion, Vector3 } from 'three';
import { JointDef, Part, Pose, Rig, boxG, cylG, ellG, joint } from './figure';

// Tovarne za živali iz primitivov (elipsoidi, valji) s sklepi: štirinožci, dvonožci/ptice, kača, riba, pajek.
// Vsi gledajo v +Z, stojijo na tleh (y = 0), širina po X.

type L = Array<[number, number]>;
const lim = (...a: Array<[number, number]>): { limits: L } => ({ limits: a });

// ------------------------------------------------------------------ štirinožci

export interface QuadSpec {
  /** Dolžina nog (tla → spodnja stran trupa). */
  legH: number;
  legR: number;
  hoof?: boolean;
  /** Polmeri trupa (x, y, z). */
  bw: number;
  bh: number;
  bl: number;
  neckL: number;
  /** Naklon vratu naprej od navpičnice (rad). */
  neckA: number;
  neckR: number;
  hw: number;
  hh: number;
  hl: number;
  /** Nagib glave navzdol (rad). */
  headDown: number;
  snout: number;
  snoutR?: number;
  ears: 'point' | 'long' | 'floppy' | 'round' | 'none';
  earS: number;
  earJoints?: boolean;
  horns?: 'horns' | 'antlers';
  tail: 'long' | 'short' | 'tuft' | 'curl';
  tailL: number;
  hump?: number;
  /** Povečava zadnjih nog (zajec). */
  hindMul?: number;
}

export function makeQuad(id: string, s: QuadSpec): Rig {
  const P = s.legH + s.bh * 0.25; // pivot nog (v trupu)
  const bodyY = s.legH + s.bh * 0.7;
  const lx = s.bw * 0.6;
  const fz = s.bl * 0.55;
  const hz = -s.bl * 0.6;
  const B = new Vector3(0, bodyY + s.bh * 0.55, s.bl * 0.7); // vrat: začetek
  const nd = new Vector3(0, Math.cos(s.neckA), Math.sin(s.neckA));
  const E = B.clone().addScaledVector(nd, s.neckL); // vrat: konec = glava
  const Hc = E.clone().add(new Vector3(0, s.hh * 0.2, s.hl * 0.5));
  const T = new Vector3(0, bodyY + s.bh * 0.2, -s.bl * 0.95);
  const hm = s.hindMul ?? 1;
  const arr = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];

  const FRONT = lim([-50, 70], [-20, 20], [-20, 50]);
  const HIND = lim([-40, 100], [-20, 20], [-20, 40]);
  const def: Record<string, JointDef> = {
    neck: joint(null, arr(B), 0, 'spine', 'Vrat', lim([-40, 60], [-50, 50], [-30, 30])),
    head: joint('neck', arr(E), 0, 'spine', 'Glava', lim([-40, 50], [-60, 60], [-30, 30])),
    tail: joint(null, arr(T), 0, 'spine', 'Rep', lim([-60, 70], [-60, 60], [-60, 60])),
    shoulderFL: joint(null, [lx, P, fz], 1, 'limb', 'Prednja noga L', FRONT),
    shoulderFR: joint(null, [-lx, P, fz], -1, 'limb', 'Prednja noga D', FRONT),
    elbowFL: joint('shoulderFL', [lx, P / 2, fz], 1, 'hinge-back', 'Prednji komolec L'),
    elbowFR: joint('shoulderFR', [-lx, P / 2, fz], -1, 'hinge-back', 'Prednji komolec D'),
    hipBL: joint(null, [lx, P, hz], 1, 'limb', 'Zadnja noga L', HIND),
    hipBR: joint(null, [-lx, P, hz], -1, 'limb', 'Zadnja noga D', HIND),
    kneeBL: joint('hipBL', [lx, P / 2, hz], 1, 'hinge-back', 'Zadnje koleno L'),
    kneeBR: joint('hipBR', [-lx, P / 2, hz], -1, 'hinge-back', 'Zadnje koleno D'),
  };
  if (s.earJoints) {
    const ear = { axes: ['Zamah naprej', '(ni)', 'Odmik vstran'], limits: [[-40, 60], [0, 0], [-20, 40]] as Array<[number, number]> };
    def.earL = joint('head', [s.hw * 0.5, Hc.y + s.hh * 0.8, Hc.z - s.hl * 0.2], 1, 'limb', 'Uho L', ear);
    def.earR = joint('head', [-s.hw * 0.5, Hc.y + s.hh * 0.8, Hc.z - s.hl * 0.2], -1, 'limb', 'Uho D', ear);
  }

  const parts = (): Part[] => {
    const p: Part[] = [
      { joint: null, make: (g) => ellG(g, s.bw, s.bh, s.bl).translate(0, bodyY, 0) },
      { joint: null, make: (g) => ellG(g, s.bw * 1.05, s.bh * 1.1, s.bl * 0.5).translate(0, bodyY + s.bh * 0.1, s.bl * 0.5) },
      { joint: null, make: (g) => ellG(g, s.bw, s.bh * 0.95, s.bl * 0.5).translate(0, bodyY - s.bh * 0.05, -s.bl * 0.5) },
      { joint: 'neck', make: (g) => cylG(g, s.neckR * 0.8, s.neckR * 1.1, s.neckL).rotateX(s.neckA).translate(B.x + nd.x * s.neckL * 0.5, B.y + nd.y * s.neckL * 0.5, B.z + nd.z * s.neckL * 0.5) },
      { joint: 'head', make: (g) => ellG(g, s.hw, s.hh, s.hl).rotateX(s.headDown).translate(Hc.x, Hc.y, Hc.z) },
    ];
    if (s.snout > 0) p.push({ joint: 'head', make: (g) => ellG(g, s.snoutR ?? s.hw * 0.6, (s.snoutR ?? s.hw * 0.6) * 0.85, s.snout).rotateX(s.headDown * 1.1).translate(Hc.x, Hc.y - s.hh * 0.25, Hc.z + s.hl * 0.8 + s.snout * 0.35) });
    if (s.hump) p.push({ joint: null, make: (g) => ellG(g, s.bw * 0.9, s.hump!, s.bl * 0.3).translate(0, bodyY + s.bh + s.hump! * 0.3, 0) });

    // ušesa
    const ej = (side: 1 | -1) => (s.earJoints ? (side === 1 ? 'earL' : 'earR') : 'head');
    for (const sd of [1, -1] as const) {
      const x = sd * s.hw * 0.7;
      if (s.ears === 'point') p.push({ joint: ej(sd), make: (g) => ellG(g, s.earS * 0.45, s.earS, s.earS * 0.35).translate(x, Hc.y + s.hh + s.earS * 0.5, Hc.z - s.hl * 0.1) });
      else if (s.ears === 'long') p.push({ joint: ej(sd), make: (g) => ellG(g, s.earS * 0.28, s.earS * 1.6, s.earS * 0.22).rotateZ(-sd * 0.25).translate(sd * s.hw * 0.5, Hc.y + s.hh + s.earS * 1.1, Hc.z - s.hl * 0.2) });
      else if (s.ears === 'floppy') p.push({ joint: ej(sd), make: (g) => ellG(g, s.earS * 0.15, s.earS * 0.8, s.earS * 0.5).translate(sd * s.hw * 1.05, Hc.y + s.hh * 0.1, Hc.z - s.hl * 0.1) });
      else if (s.ears === 'round') p.push({ joint: ej(sd), make: (g) => ellG(g, s.earS, s.earS, s.earS * 0.4).translate(x, Hc.y + s.hh * 0.9, Hc.z - s.hl * 0.2) });
      if (s.horns === 'horns') p.push({ joint: 'head', make: (g) => cylG(g, s.hw * 0.1, s.hw * 0.05, s.hh * 1.6).rotateZ(-sd * 0.5).translate(sd * s.hw * 0.7, Hc.y + s.hh * 1.1, Hc.z - s.hl * 0.1) });
      if (s.horns === 'antlers') {
        p.push({ joint: 'head', make: (g) => cylG(g, s.hw * 0.07, s.hw * 0.04, s.hh * 2.4).rotateZ(-sd * 0.35).translate(sd * s.hw * 0.7, Hc.y + s.hh * 1.5, Hc.z - s.hl * 0.2) });
        p.push({ joint: 'head', make: (g) => cylG(g, s.hw * 0.05, s.hw * 0.03, s.hh * 1.2).rotateZ(-sd * 0.9).translate(sd * s.hw * 1.1, Hc.y + s.hh * 2.0, Hc.z - s.hl * 0.2) });
      }
    }

    // rep
    if (s.tail === 'long') p.push({ joint: 'tail', make: (g) => cylG(g, s.neckR * 0.35, s.neckR * 0.2, s.tailL).rotateX(0.7).translate(T.x, T.y - s.tailL * 0.1, T.z - s.tailL * 0.3) });
    else if (s.tail === 'short') p.push({ joint: 'tail', make: (g) => ellG(g, s.neckR * 0.35, s.neckR * 0.35, s.tailL * 0.5).translate(T.x, T.y, T.z - s.tailL * 0.3) });
    else if (s.tail === 'tuft') {
      const tl = Math.min(s.tailL, T.y - s.neckR * 0.9 - 0.03); // šop ne sme segati pod tla
      p.push({ joint: 'tail', make: (g) => cylG(g, s.neckR * 0.2, s.neckR * 0.15, tl).translate(T.x, T.y - tl * 0.45, T.z - tl * 0.05) });
      p.push({ joint: 'tail', make: (g) => ellG(g, s.neckR * 0.4, s.neckR * 0.9, s.neckR * 0.4).translate(T.x, T.y - tl * 1.0, T.z - tl * 0.05) });
    } else p.push({ joint: 'tail', make: (g) => cylG(g, s.neckR * 0.15, s.neckR * 0.1, s.tailL).rotateZ(1.0).rotateX(0.3).translate(T.x + 0.02, T.y + s.tailL * 0.2, T.z - s.tailL * 0.2) });

    // noge
    const legs: Array<[string, string, number, number, number]> = [
      ['shoulderFL', 'elbowFL', lx, fz, 1],
      ['shoulderFR', 'elbowFR', -lx, fz, 1],
      ['hipBL', 'kneeBL', lx, hz, hm],
      ['hipBR', 'kneeBR', -lx, hz, hm],
    ];
    for (const [up, low, x, z, m] of legs) {
      const r = s.legR * m;
      p.push({ joint: up, make: (g) => cylG(g, r, r * 0.8, P / 2).translate(x, P * 0.75, z) });
      p.push({ joint: low, make: (g) => cylG(g, r * 0.75, r * 0.55, P / 2).translate(x, P * 0.25, z) });
      if (s.hoof) p.push({ joint: low, make: () => boxG(r * 1.5, r * 1.1, r * 1.7).translate(x, r * 0.55, z + r * 0.1) });
      else p.push({ joint: low, make: (g) => ellG(g, r * 0.9, r * 0.5, r * 1.3).translate(x, r * 0.5, z + r * 0.4) });
    }
    return p;
  };

  const groups = [
    { title: 'Vrat in glava', joints: ['neck', 'head'] },
    { title: 'Rep', joints: ['tail'] },
    ...(s.earJoints ? [{ title: 'Ušesa', joints: ['earL', 'earR'] }] : []),
    { title: 'Leva prednja noga', joints: ['shoulderFL', 'elbowFL'] },
    { title: 'Desna prednja noga', joints: ['shoulderFR', 'elbowFR'] },
    { title: 'Leva zadnja noga', joints: ['hipBL', 'kneeBL'] },
    { title: 'Desna zadnja noga', joints: ['hipBR', 'kneeBR'] },
  ];
  return {
    id,
    joints: Object.keys(def),
    def,
    parts,
    groups,
    poses: {
      Stoji: {},
      'Glava dol': { neck: [35, 0, 0], head: [25, 0, 0] },
      'Glava gor': { neck: [-25, 0, 0], head: [-15, 0, 0] },
      Hodi: { shoulderFL: [25, 0, 0], elbowFL: [20, 0, 0], shoulderFR: [-20, 0, 0], hipBL: [-20, 0, 0], kneeBL: [30, 0, 0], hipBR: [25, 0, 0] },
    },
  };
}

// ------------------------------------------------------------------ dvonožci in ptice

export interface BipedSpec {
  /** Polmeri trupa (x, y, z), nagib trupa (rad; 0 = vodoraven, ~1.3 = pokončen) in višina središča. */
  body: [number, number, number];
  tilt: number;
  legL: number;
  legR: number;
  /** Debelina stegna in velikost stopala. */
  thigh: number;
  foot: [number, number, number];
  neckL: number;
  neckR: number;
  neckA: number;
  headR: number;
  /** Kljun (stožec) ali gobec (elipsoid). */
  beak: number;
  beakR: number;
  snout?: boolean;
  /** Krila ali roke. */
  wingL: number;
  wingW: number;
  /** 'back': krilo leži ob telesu proti zadaju; 'down': visi navzdol. */
  wing: 'back' | 'down' | 'none';
  tailL: number;
  tailW: number;
  earS?: number;
}

export function makeBiped(id: string, s: BipedSpec, poses: Record<string, Pose> = {}): Rig {
  const [rx, ry, rz] = s.body;
  const bodyY = s.legL + ry * 0.6;
  const F = new Vector3(0, bodyY + Math.sin(s.tilt) * rz * 0.8, Math.cos(s.tilt) * rz * 0.8 * (s.tilt > 1 ? 0.3 : 1)); // sprednji del trupa
  const nd = new Vector3(0, Math.cos(s.neckA), Math.sin(s.neckA));
  const N = F.clone().add(new Vector3(0, ry * 0.3, 0));
  const E = N.clone().addScaledVector(nd, s.neckL);
  const lx = rx * 0.55;
  const hipY = s.legL;
  const arr = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];
  const wy = bodyY + ry * 0.5;
  const def: Record<string, JointDef> = {
    neck: joint(null, arr(N), 0, 'spine', 'Vrat', lim([-40, 60], [-60, 60], [-30, 30])),
    head: joint('neck', arr(E), 0, 'spine', 'Glava', lim([-40, 50], [-70, 70], [-30, 30])),
    tail: joint(null, [0, bodyY + ry * 0.2, -rz * 0.8], 0, 'spine', 'Rep', lim([-40, 50], [-40, 40], [-30, 30])),
    hipL: joint(null, [lx, hipY, 0], 1, 'limb', 'Noga L', lim([-40, 90], [-30, 30], [-10, 40])),
    hipR: joint(null, [-lx, hipY, 0], -1, 'limb', 'Noga D', lim([-40, 90], [-30, 30], [-10, 40])),
    kneeL: joint('hipL', [lx, hipY / 2, 0], 1, 'hinge-back', 'Koleno L'),
    kneeR: joint('hipR', [-lx, hipY / 2, 0], -1, 'hinge-back', 'Koleno D'),
  };
  if (s.wing === 'back') {
    // side obrnjen, da pozitiven kot "odpri" pomeni stran od telesa
    def.wingL = joint(null, [rx * 0.9, wy, rz * 0.2], -1, 'limb', 'Krilo L', { axes: ['Dvig/spust', 'Odpri', 'Nagib'], limits: [[-60, 70], [0, 100], [-40, 40]] });
    def.wingR = joint(null, [-rx * 0.9, wy, rz * 0.2], 1, 'limb', 'Krilo D', { axes: ['Dvig/spust', 'Odpri', 'Nagib'], limits: [[-60, 70], [0, 100], [-40, 40]] });
  } else if (s.wing === 'down') {
    def.wingL = joint(null, [rx * 0.95, wy, rz * 0.1], 1, 'limb', 'Roka L', { axes: ['Zamah naprej', 'Zasuk', 'Odpri'], limits: [[-60, 120], [-40, 40], [0, 100]] });
    def.wingR = joint(null, [-rx * 0.95, wy, rz * 0.1], -1, 'limb', 'Roka D', { axes: ['Zamah naprej', 'Zasuk', 'Odpri'], limits: [[-60, 120], [-40, 40], [0, 100]] });
  }

  const parts = (): Part[] => {
    const p: Part[] = [
      { joint: null, make: (g) => ellG(g, rx, ry, rz).rotateX(-s.tilt).translate(0, bodyY, 0) },
      { joint: 'neck', make: (g) => cylG(g, s.neckR * 0.85, s.neckR, s.neckL).rotateX(s.neckA).translate(N.x + nd.x * s.neckL / 2, N.y + nd.y * s.neckL / 2, N.z + nd.z * s.neckL / 2) },
      { joint: 'head', make: (g) => ellG(g, s.headR, s.headR, s.headR * 1.15).translate(E.x, E.y + s.headR * 0.5, E.z + s.headR * 0.2) },
      { joint: 'tail', make: (g) => ellG(g, s.tailW, s.tailW * 0.25, s.tailL / 2).rotateX(-0.35).translate(0, bodyY + ry * 0.3, -rz * 0.8 - s.tailL * 0.35) },
    ];
    if (s.beak > 0) {
      if (s.snout) p.push({ joint: 'head', make: (g) => ellG(g, s.beakR, s.beakR * 0.8, s.beak).translate(E.x, E.y + s.headR * 0.3, E.z + s.headR * 1.1 + s.beak * 0.6) });
      else p.push({ joint: 'head', make: () => new ConeGeometry(s.beakR, s.beak, 12).rotateX(Math.PI / 2).translate(E.x, E.y + s.headR * 0.35, E.z + s.headR * 1.2 + s.beak * 0.5) });
    }
    if (s.earS) for (const sd of [1, -1]) p.push({ joint: 'head', make: (g) => ellG(g, s.earS! * 0.3, s.earS! * 1.5, s.earS! * 0.2).rotateZ(-sd * 0.2).translate(E.x + sd * s.headR * 0.5, E.y + s.headR * 1.6 + s.earS! * 0.8, E.z) });
    for (const [h, k, x] of [['hipL', 'kneeL', lx], ['hipR', 'kneeR', -lx]] as Array<[string, string, number]>) {
      p.push({ joint: h, make: (g) => ellG(g, s.thigh, hipY * 0.3, s.thigh * 1.1).translate(x, hipY * 0.8, 0) });
      p.push({ joint: k, make: (g) => cylG(g, s.legR, s.legR * 0.8, hipY * 0.55).translate(x, hipY * 0.3, 0) });
      p.push({ joint: k, make: (g) => ellG(g, s.foot[0], s.foot[1], s.foot[2]).translate(x, s.foot[1], s.foot[2] * 0.5) });
    }
    if (s.wing === 'back') {
      for (const sd of [1, -1]) {
        const j = sd === 1 ? 'wingL' : 'wingR';
        p.push({ joint: j, make: (g) => ellG(g, 0.012 + s.wingW * 0.1, s.wingW, s.wingL / 2).translate(sd * rx * 0.9, wy - s.wingW * 0.4, rz * 0.2 - s.wingL / 2) });
      }
    } else if (s.wing === 'down') {
      for (const sd of [1, -1]) {
        const j = sd === 1 ? 'wingL' : 'wingR';
        p.push({ joint: j, make: (g) => ellG(g, s.wingW, s.wingL / 2, s.wingW * 0.8).translate(sd * rx * 0.95, wy - s.wingL / 2, rz * 0.1) });
      }
    }
    return p;
  };

  const groups = [
    { title: 'Vrat in glava', joints: ['neck', 'head'] },
    { title: 'Rep', joints: ['tail'] },
    ...(s.wing !== 'none' ? [{ title: s.wing === 'back' ? 'Krila' : 'Roke', joints: ['wingL', 'wingR'] }] : []),
    { title: 'Leva noga', joints: ['hipL', 'kneeL'] },
    { title: 'Desna noga', joints: ['hipR', 'kneeR'] },
  ];
  return { id, joints: Object.keys(def), def, parts, groups, poses: { Stoji: {}, ...poses } };
}

// ------------------------------------------------------------------ kača

export function makeSnake(): Rig {
  const N = 9;
  const seg = 0.2;
  const def: Record<string, JointDef> = {};
  const names: string[] = [];
  for (let i = 1; i < N; i++) {
    const nm = `s${i}`;
    names.push(nm);
    def[nm] = joint(i === 1 ? null : `s${i - 1}`, [0, 0.05, i * seg - 0.9], 0, 'spine', `Člen ${i}`, { axes: ['Gor/dol', 'Zavij levo/desno', 'Nagib'], limits: [[-35, 35], [-55, 55], [-30, 30]] });
  }
  const parts = (): Part[] => {
    const p: Part[] = [];
    for (let i = 0; i < N; i++) {
      const rr = i === N - 1 ? 0.05 : 0.02 + (0.03 * i) / (N - 1);
      p.push({ joint: i === 0 ? null : `s${i}`, make: (g) => ellG(g, rr, rr, seg * 0.85).translate(0, 0.05, i * seg - 0.9 + seg / 2) });
    }
    p.push({ joint: `s${N - 1}`, make: (g) => ellG(g, 0.055, 0.04, 0.09).translate(0, 0.05, (N - 1) * seg - 0.9 + seg + 0.05) });
    return p;
  };
  const wave = (a: number): Pose => Object.fromEntries(names.map((n, i) => [n, [0, i % 2 === 0 ? a : -a, 0] as [number, number, number]]));
  return { id: 'snake', joints: names, def, parts, groups: [{ title: 'Telo', joints: names }], poses: { Stoji: {}, 'Val': wave(30), 'Zvita': Object.fromEntries(names.map((n) => [n, [0, 45, 0] as [number, number, number]])) } };
}

// ------------------------------------------------------------------ riba

export function makeFish(): Rig {
  const def: Record<string, JointDef> = {
    body2: joint(null, [0, 0.2, -0.05], 0, 'spine', 'Sredina', { axes: ['Gor/dol', 'Zavij', 'Nagib'], limits: [[-25, 25], [-40, 40], [-20, 20]] }),
    body3: joint('body2', [0, 0.2, -0.3], 0, 'spine', 'Zadek', { axes: ['Gor/dol', 'Zavij', 'Nagib'], limits: [[-25, 25], [-45, 45], [-20, 20]] }),
    tailFin: joint('body3', [0, 0.2, -0.5], 0, 'spine', 'Repna plavut', { axes: ['Gor/dol', 'Zavij', 'Nagib'], limits: [[-30, 30], [-50, 50], [-30, 30]] }),
    finL: joint(null, [0.1, 0.16, 0.15], 1, 'limb', 'Plavut L', { axes: ['Zamah', 'Zasuk', 'Odpri'], limits: [[-40, 40], [-30, 30], [0, 60]] }),
    finR: joint(null, [-0.1, 0.16, 0.15], -1, 'limb', 'Plavut D', { axes: ['Zamah', 'Zasuk', 'Odpri'], limits: [[-40, 40], [-30, 30], [0, 60]] }),
  };
  const parts = (): Part[] => [
    { joint: null, make: (g) => ellG(g, 0.07, 0.13, 0.2).translate(0, 0.2, 0.1) },
    { joint: null, make: (g) => ellG(g, 0.015, 0.1, 0.1).translate(0, 0.33, 0.05) }, // hrbtna plavut
    { joint: 'body2', make: (g) => ellG(g, 0.065, 0.12, 0.22).translate(0, 0.2, -0.17) },
    { joint: 'body3', make: (g) => ellG(g, 0.04, 0.07, 0.18).translate(0, 0.2, -0.42) },
    { joint: 'tailFin', make: (g) => ellG(g, 0.01, 0.13, 0.09).translate(0, 0.2, -0.6) },
    { joint: 'finL', make: (g) => ellG(g, 0.01, 0.04, 0.07).translate(0.1, 0.15, 0.12) },
    { joint: 'finR', make: (g) => ellG(g, 0.01, 0.04, 0.07).translate(-0.1, 0.15, 0.12) },
  ];
  return {
    id: 'fish', joints: Object.keys(def), def, parts,
    groups: [{ title: 'Telo in rep', joints: ['body2', 'body3', 'tailFin'] }, { title: 'Plavuti', joints: ['finL', 'finR'] }],
    poses: { Stoji: {}, Zavij: { body2: [0, 20, 0], body3: [0, 30, 0], tailFin: [0, 35, 0] } },
  };
}

// ------------------------------------------------------------------ pajek

/** Valj med dvema točkama. */
function between(g: number, a: Vector3, b: Vector3, r0: number, r1: number): BufferGeometry {
  const d = b.clone().sub(a);
  const geo = cylG(g, r0, r1, d.length());
  geo.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return geo.translate(mid.x, mid.y, mid.z);
}

export function makeSpider(): Rig {
  const def: Record<string, JointDef> = {};
  const parts: Part[] = [
    { joint: null, make: (g) => ellG(g, 0.07, 0.06, 0.09).translate(0, 0.18, 0.06) },
    { joint: null, make: (g) => ellG(g, 0.09, 0.08, 0.12).translate(0, 0.2, -0.1) },
    { joint: null, make: (g) => ellG(g, 0.035, 0.03, 0.035).translate(0, 0.19, 0.15) },
  ];
  const groups: Rig['groups'] = [];
  const zs = [0.08, 0.02, -0.04, -0.1];
  zs.forEach((z, i) => {
    for (const sd of [1, -1] as const) {
      const lr = sd === 1 ? 'L' : 'R';
      const h = `hip${lr}${i}`;
      const k = `knee${lr}${i}`;
      const yaw = (1.5 - i) * 0.5; // sprednje noge naprej, zadnje nazaj
      const hip = new Vector3(sd * 0.06, 0.18, z);
      const knee = new Vector3(sd * 0.2, 0.3, z + yaw * 0.1);
      const foot = new Vector3(sd * 0.3, 0.0, z + yaw * 0.2);
      def[h] = joint(null, [hip.x, hip.y, hip.z], sd, 'limb', `Kolk ${lr}${i + 1}`, { axes: ['Zamah naprej', '(ni)', 'Dvig/spust'], limits: [[-40, 40], [0, 0], [-40, 50]] });
      def[k] = joint(h, [knee.x, knee.y, knee.z], sd, 'limb', `Koleno ${lr}${i + 1}`, { axes: ['(ni)', '(ni)', 'Upogib'], limits: [[0, 0], [0, 0], [-60, 60]] });
      parts.push({ joint: h, make: (g) => between(g, hip, knee, 0.012, 0.01) });
      parts.push({ joint: k, make: (g) => between(g, knee, foot, 0.01, 0.006) });
    }
    groups.push({ title: `Noge ${i + 1}`, joints: [`hipL${i}`, `kneeL${i}`, `hipR${i}`, `kneeR${i}`] });
  });
  return { id: 'spider', joints: Object.keys(def), def, parts: () => parts, groups, poses: { Stoji: {}, 'Dvignjene noge': Object.fromEntries(Object.keys(def).filter((k) => k.startsWith('hip')).map((k) => [k, [0, 0, 30] as [number, number, number]])) } };
}
