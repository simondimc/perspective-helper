import { Part, Rig, boxG, cylG, ellG, joint } from './figure';

// Konj iz primitivov (elipsoidi, valji) s sklepi. Gleda v +Z, stoji na tleh (y = 0), širina po X.

const FRONT = { limits: [[-40, 70], [-20, 20], [-20, 50]] as Array<[number, number]> };
const HIND = { limits: [[-40, 70], [-20, 20], [-20, 40]] as Array<[number, number]> };

const def = {
  neck: joint(null, [0, 1.45, 0.75], 0, 'spine', 'Vrat', { limits: [[-50, 70], [-50, 50], [-30, 30]] }),
  head: joint('neck', [0, 1.9, 1.1], 0, 'spine', 'Glava', { limits: [[-50, 60], [-50, 50], [-30, 30]] }),
  tail: joint(null, [0, 1.5, -0.85], 0, 'spine', 'Rep', { limits: [[-60, 70], [-60, 60], [-60, 60]] }),
  shoulderFL: joint(null, [0.14, 1.2, 0.45], 1, 'limb', 'Prednja noga L', FRONT),
  shoulderFR: joint(null, [-0.14, 1.2, 0.45], -1, 'limb', 'Prednja noga D', FRONT),
  kneeFL: joint('shoulderFL', [0.14, 0.7, 0.45], 1, 'hinge-back', 'Prednje koleno L'),
  kneeFR: joint('shoulderFR', [-0.14, 0.7, 0.45], -1, 'hinge-back', 'Prednje koleno D'),
  hipBL: joint(null, [0.17, 1.25, -0.55], 1, 'limb', 'Zadnja noga L', HIND),
  hipBR: joint(null, [-0.17, 1.25, -0.55], -1, 'limb', 'Zadnja noga D', HIND),
  kneeBL: joint('hipBL', [0.17, 0.72, -0.55], 1, 'hinge-back', 'Zadnje koleno L'),
  kneeBR: joint('hipBR', [-0.17, 0.72, -0.55], -1, 'hinge-back', 'Zadnje koleno D'),
};

function parts(): Part[] {
  const p: Part[] = [
    { joint: null, make: (s) => ellG(s, 0.3, 0.36, 0.62).translate(0, 1.2, 0) }, // trup
    { joint: null, make: (s) => ellG(s, 0.28, 0.4, 0.3).translate(0, 1.2, 0.45) }, // prsi
    { joint: null, make: (s) => ellG(s, 0.3, 0.38, 0.35).translate(0, 1.2, -0.5) }, // zadnjica
    { joint: 'neck', make: (s) => cylG(s, 0.1, 0.17, 0.85).rotateX(0.7).translate(0, 1.68, 0.92) }, // vrat
    { joint: 'head', make: (s) => ellG(s, 0.09, 0.12, 0.3).rotateX(0.6).translate(0, 1.98, 1.2) }, // glava
    { joint: 'head', make: (s) => ellG(s, 0.07, 0.08, 0.12).rotateX(0.7).translate(0, 1.8, 1.42) }, // gobec
    { joint: 'head', make: (s) => ellG(s, 0.03, 0.08, 0.03).translate(0.06, 2.12, 1.03) },
    { joint: 'head', make: (s) => ellG(s, 0.03, 0.08, 0.03).translate(-0.06, 2.12, 1.03) },
    { joint: 'tail', make: (s) => cylG(s, 0.04, 0.02, 0.7).rotateX(0.2).translate(0, 1.15, -0.93) },
  ];
  for (const [sh, kn, x] of [['shoulderFL', 'kneeFL', 0.14], ['shoulderFR', 'kneeFR', -0.14]] as Array<[string, string, number]>) {
    p.push({ joint: sh, make: (s) => cylG(s, 0.075, 0.05, 0.5).translate(x, 0.95, 0.45) });
    p.push({ joint: kn, make: (s) => cylG(s, 0.045, 0.04, 0.7).translate(x, 0.35, 0.45) });
    p.push({ joint: kn, make: () => boxG(0.1, 0.1, 0.12).translate(x, 0.05, 0.46) });
  }
  for (const [hp, kn, x] of [['hipBL', 'kneeBL', 0.17], ['hipBR', 'kneeBR', -0.17]] as Array<[string, string, number]>) {
    p.push({ joint: hp, make: (s) => ellG(s, 0.12, 0.3, 0.2).translate(x, 1.0, -0.55) });
    p.push({ joint: kn, make: (s) => cylG(s, 0.05, 0.04, 0.72).translate(x, 0.36, -0.55) });
    p.push({ joint: kn, make: () => boxG(0.1, 0.1, 0.12).translate(x, 0.05, -0.54) });
  }
  return p;
}

export const HORSE_RIG: Rig = {
  id: 'horse',
  joints: Object.keys(def),
  def,
  parts,
  groups: [
    { title: 'Vrat in glava', joints: ['neck', 'head'] },
    { title: 'Rep', joints: ['tail'] },
    { title: 'Leva prednja noga', joints: ['shoulderFL', 'kneeFL'] },
    { title: 'Desna prednja noga', joints: ['shoulderFR', 'kneeFR'] },
    { title: 'Leva zadnja noga', joints: ['hipBL', 'kneeBL'] },
    { title: 'Desna zadnja noga', joints: ['hipBR', 'kneeBR'] },
  ],
  poses: {
    Stoji: {},
    Pase: { neck: [55, 0, 0], head: [25, 0, 0] },
    'Glava gor': { neck: [-25, 0, 0], head: [-15, 0, 0] },
    Hodi: { shoulderFL: [30, 0, 0], kneeFL: [30, 0, 0], shoulderFR: [-20, 0, 0], hipBL: [-25, 0, 0], kneeBL: [35, 0, 0], hipBR: [30, 0, 0] },
  },
};
