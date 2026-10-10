import { Part, Rig, cylG, ellG, joint } from './figure';

// Pes iz primitivov (elipsoidi in valji) s sklepi. Gleda v +Z, stoji na tleh (y = 0), širina po X.

const FRONT = { limits: [[-50, 70], [-20, 20], [-20, 50]] as Array<[number, number]> };
const HIND = { limits: [[-40, 100], [-20, 20], [-20, 40]] as Array<[number, number]> };

const def = {
  neck: joint(null, [0, 0.52, 0.3], 0, 'spine', 'Vrat', { limits: [[-40, 60], [-50, 50], [-30, 30]] }),
  head: joint('neck', [0, 0.6, 0.42], 0, 'spine', 'Glava', { limits: [[-40, 50], [-60, 60], [-30, 30]] }),
  tail: joint(null, [0, 0.52, -0.3], 0, 'spine', 'Rep', { limits: [[-60, 70], [-60, 60], [-60, 60]] }),
  shoulderFL: joint(null, [0.075, 0.4, 0.2], 1, 'limb', 'Prednja noga L', FRONT),
  shoulderFR: joint(null, [-0.075, 0.4, 0.2], -1, 'limb', 'Prednja noga D', FRONT),
  elbowFL: joint('shoulderFL', [0.075, 0.2, 0.2], 1, 'hinge-back', 'Prednji komolec L'),
  elbowFR: joint('shoulderFR', [-0.075, 0.2, 0.2], -1, 'hinge-back', 'Prednji komolec D'),
  hipBL: joint(null, [0.075, 0.4, -0.2], 1, 'limb', 'Zadnja noga L', HIND),
  hipBR: joint(null, [-0.075, 0.4, -0.2], -1, 'limb', 'Zadnja noga D', HIND),
  kneeBL: joint('hipBL', [0.075, 0.2, -0.2], 1, 'hinge-back', 'Zadnje koleno L'),
  kneeBR: joint('hipBR', [-0.075, 0.2, -0.2], -1, 'hinge-back', 'Zadnje koleno D'),
};

function parts(): Part[] {
  const p: Part[] = [
    { joint: null, make: (s) => ellG(s, 0.12, 0.15, 0.3).translate(0, 0.42, 0) }, // trup
    { joint: null, make: (s) => ellG(s, 0.13, 0.17, 0.14).translate(0, 0.45, 0.2) }, // prsni koš
    { joint: null, make: (s) => ellG(s, 0.12, 0.15, 0.14).translate(0, 0.41, -0.2) }, // zadnji del
    { joint: 'neck', make: (s) => ellG(s, 0.075, 0.1, 0.11).translate(0, 0.56, 0.34) },
    { joint: 'head', make: (s) => ellG(s, 0.085, 0.085, 0.1).translate(0, 0.64, 0.45) },
    { joint: 'head', make: (s) => ellG(s, 0.045, 0.04, 0.085).translate(0, 0.6, 0.56) }, // gobec
    { joint: 'head', make: (s) => ellG(s, 0.022, 0.06, 0.04).translate(0.065, 0.67, 0.42) },
    { joint: 'head', make: (s) => ellG(s, 0.022, 0.06, 0.04).translate(-0.065, 0.67, 0.42) },
    { joint: 'tail', make: (s) => cylG(s, 0.016, 0.022, 0.32).rotateX(-0.9).translate(0, 0.55, -0.36) },
  ];
  const legs: Array<[string, string, number, number]> = [
    ['shoulderFL', 'elbowFL', 0.075, 0.2],
    ['shoulderFR', 'elbowFR', -0.075, 0.2],
    ['hipBL', 'kneeBL', 0.075, -0.2],
    ['hipBR', 'kneeBR', -0.075, -0.2],
  ];
  for (const [up, low, x, z] of legs) {
    p.push({ joint: up, make: (s) => cylG(s, 0.035, 0.03, 0.19).translate(x, 0.295, z) });
    p.push({ joint: low, make: (s) => cylG(s, 0.03, 0.026, 0.19).translate(x, 0.105, z) });
    p.push({ joint: low, make: (s) => ellG(s, 0.035, 0.025, 0.05).translate(x, 0.025, z + 0.02) });
  }
  return p;
}

export const DOG_RIG: Rig = {
  id: 'dog',
  joints: Object.keys(def),
  def,
  parts,
  groups: [
    { title: 'Vrat in glava', joints: ['neck', 'head'] },
    { title: 'Rep', joints: ['tail'] },
    { title: 'Leva prednja noga', joints: ['shoulderFL', 'elbowFL'] },
    { title: 'Desna prednja noga', joints: ['shoulderFR', 'elbowFR'] },
    { title: 'Leva zadnja noga', joints: ['hipBL', 'kneeBL'] },
    { title: 'Desna zadnja noga', joints: ['hipBR', 'kneeBR'] },
  ],
  poses: {
    Stoji: {},
    'Glava dol': { neck: [35, 0, 0], head: [25, 0, 0] },
    Hodi: { shoulderFL: [25, 0, 0], elbowFL: [20, 0, 0], shoulderFR: [-20, 0, 0], hipBL: [-20, 0, 0], kneeBL: [30, 0, 0], hipBR: [25, 0, 0] },
    'Rep gor': { tail: [-50, 0, 0] },
  },
};

