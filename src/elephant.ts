import { Vector3 } from 'three';
import { JointDef, Part, Rig, cylG, ellG, joint } from './figure';

// Slon iz primitivov (elipsoidi, valji) s sklepi. Gleda v +Z, stoji na tleh (y = 0), širina po X.

// rilec: veriga šestih valjev; sklepi so na začetku 1., 3. in 5. odseka
const TRUNK_N = 6;
const trunk: Array<{ start: Vector3; phi: number; r0: number; r1: number; len: number }> = [];
{
  let pos = new Vector3(0, 2.4, 2.45);
  for (let i = 0; i < TRUNK_N; i++) {
    const phi = 0.1 + (0.95 * i) / (TRUNK_N - 1);
    const d = new Vector3(0, -Math.cos(phi), Math.sin(phi));
    const len = 0.4;
    trunk.push({ start: pos.clone(), phi, r0: 0.22 - (0.14 * i) / TRUNK_N, r1: 0.22 - (0.14 * (i + 1)) / TRUNK_N, len });
    pos = pos.addScaledVector(d, len * 0.95);
  }
}
const tp = (i: number): [number, number, number] => [trunk[i].start.x, trunk[i].start.y, trunk[i].start.z];
const TR = { limits: [[-90, 50], [-60, 60], [-60, 60]] as Array<[number, number]> };
const LEG = { limits: [[-40, 50], [-15, 15], [-15, 35]] as Array<[number, number]> };

const def: Record<string, JointDef> = {
  head: joint(null, [0, 2.4, 1.7], 0, 'spine', 'Glava', { limits: [[-30, 40], [-60, 60], [-20, 20]] }),
  trunk1: joint('head', tp(0), 0, 'spine', 'Rilec 1', TR),
  trunk2: joint('trunk1', tp(2), 0, 'spine', 'Rilec 2', TR),
  trunk3: joint('trunk2', tp(4), 0, 'spine', 'Rilec 3', TR),
  earL: joint('head', [0.55, 2.75, 1.5], 1, 'limb', 'Uho L', { axes: ['(ni)', 'Zamah naprej/nazaj', '(ni)'], limits: [[0, 0], [-55, 55], [0, 0]] }),
  earR: joint('head', [-0.55, 2.75, 1.5], -1, 'limb', 'Uho D', { axes: ['(ni)', 'Zamah naprej/nazaj', '(ni)'], limits: [[0, 0], [-55, 55], [0, 0]] }),
  tail: joint(null, [0, 1.8, -2.0], 0, 'spine', 'Rep', { limits: [[-40, 50], [-50, 50], [-40, 40]] }),
  shoulderFL: joint(null, [0.5, 1.5, 0.95], 1, 'limb', 'Prednja noga L', LEG),
  shoulderFR: joint(null, [-0.5, 1.5, 0.95], -1, 'limb', 'Prednja noga D', LEG),
  kneeFL: joint('shoulderFL', [0.5, 0.75, 0.95], 1, 'hinge-back', 'Prednje koleno L', { limits: [[0, 80], [0, 0], [0, 0]] }),
  kneeFR: joint('shoulderFR', [-0.5, 0.75, 0.95], -1, 'hinge-back', 'Prednje koleno D', { limits: [[0, 80], [0, 0], [0, 0]] }),
  hipBL: joint(null, [0.5, 1.5, -1.1], 1, 'limb', 'Zadnja noga L', LEG),
  hipBR: joint(null, [-0.5, 1.5, -1.1], -1, 'limb', 'Zadnja noga D', LEG),
  kneeBL: joint('hipBL', [0.5, 0.75, -1.1], 1, 'hinge-back', 'Zadnje koleno L', { limits: [[0, 80], [0, 0], [0, 0]] }),
  kneeBR: joint('hipBR', [-0.5, 0.75, -1.1], -1, 'hinge-back', 'Zadnje koleno D', { limits: [[0, 80], [0, 0], [0, 0]] }),
};

function parts(): Part[] {
  const p: Part[] = [
    { joint: null, make: (s) => ellG(s, 0.9, 1.0, 1.5).translate(0, 2.0, 0) }, // trup
    { joint: null, make: (s) => ellG(s, 0.85, 0.95, 0.9).translate(0, 2.0, -1.1) }, // zadnji del
    { joint: null, make: (s) => ellG(s, 0.85, 1.0, 0.8).translate(0, 2.1, 0.9) }, // ramena
    { joint: 'head', make: (s) => ellG(s, 0.5, 0.65, 0.6).translate(0, 2.5, 2.0) },
    { joint: 'head', make: (s) => ellG(s, 0.42, 0.42, 0.36).translate(0, 3.0, 1.85) }, // čelo
    { joint: 'head', make: (s) => cylG(s, 0.04, 0.015, 0.9).rotateX(1.3).translate(0.32, 2.2, 2.7) }, // levi okel
    { joint: 'head', make: (s) => cylG(s, 0.04, 0.015, 0.9).rotateX(1.3).translate(-0.32, 2.2, 2.7) },
    { joint: 'earL', make: (s) => ellG(s, 0.05, 0.5, 0.45).rotateY(0.35).translate(0.65, 2.75, 1.65) },
    { joint: 'earR', make: (s) => ellG(s, 0.05, 0.5, 0.45).rotateY(-0.35).translate(-0.65, 2.75, 1.65) },
    { joint: 'tail', make: (s) => cylG(s, 0.04, 0.02, 0.9).rotateX(0.15).translate(0, 1.55, -2.0) },
  ];
  trunk.forEach((t, i) => {
    const d = new Vector3(0, -Math.cos(t.phi), Math.sin(t.phi));
    const mid = t.start.clone().addScaledVector(d, t.len / 2);
    p.push({ joint: i < 2 ? 'trunk1' : i < 4 ? 'trunk2' : 'trunk3', make: (s) => cylG(s, t.r0, t.r1, t.len).rotateX(-t.phi).translate(mid.x, mid.y, mid.z) });
  });
  for (const [up, low, x, z] of [['shoulderFL', 'kneeFL', 0.5, 0.95], ['shoulderFR', 'kneeFR', -0.5, 0.95], ['hipBL', 'kneeBL', 0.5, -1.1], ['hipBR', 'kneeBR', -0.5, -1.1]] as Array<[string, string, number, number]>) {
    p.push({ joint: up, make: (s) => cylG(s, 0.3, 0.28, 0.75).translate(x, 1.125, z) });
    p.push({ joint: low, make: (s) => cylG(s, 0.28, 0.26, 0.75).translate(x, 0.375, z) });
    p.push({ joint: low, make: (s) => cylG(s, 0.31, 0.31, 0.15).translate(x, 0.075, z) });
  }
  return p;
}

export const ELEPHANT_RIG: Rig = {
  id: 'elephant',
  joints: Object.keys(def),
  def,
  parts,
  groups: [
    { title: 'Glava in rilec', joints: ['head', 'trunk1', 'trunk2', 'trunk3'] },
    { title: 'Ušesa in rep', joints: ['earL', 'earR', 'tail'] },
    { title: 'Leva prednja noga', joints: ['shoulderFL', 'kneeFL'] },
    { title: 'Desna prednja noga', joints: ['shoulderFR', 'kneeFR'] },
    { title: 'Leva zadnja noga', joints: ['hipBL', 'kneeBL'] },
    { title: 'Desna zadnja noga', joints: ['hipBR', 'kneeBR'] },
  ],
  poses: {
    Stoji: {},
    'Rilec gor': { trunk1: [-50, 0, 0], trunk2: [-40, 0, 0], trunk3: [-30, 0, 0] },
    'Ušesa široko': { earL: [0, 40, 0], earR: [0, 40, 0] },
    Hodi: { shoulderFL: [25, 0, 0], kneeFL: [20, 0, 0], shoulderFR: [-20, 0, 0], hipBL: [-20, 0, 0], kneeBL: [25, 0, 0], hipBR: [25, 0, 0] },
  },
};
