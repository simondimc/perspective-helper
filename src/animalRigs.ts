import { QuadSpec, makeBiped, makeFish, makeQuad, makeSnake, makeSpider } from './animals';
import { Pose, Rig } from './figure';

/** Poza iz seznama kotov (števila se pretvorijo v trojke kotov). */
const P = (o: Record<string, number[]>): Pose => o as unknown as Pose;

export const ANIMAL_TYPES = ['cat', 'wolf', 'cow', 'sheep', 'pig', 'deer', 'bear', 'lion', 'camel', 'giraffe', 'rabbit', 'chicken', 'duck', 'eagle', 'penguin', 'kangaroo', 'snake', 'fish', 'spider'] as const;
export type AnimalType = (typeof ANIMAL_TYPES)[number];

const quad = (id: string, s: Partial<QuadSpec> & Pick<QuadSpec, 'legH' | 'legR' | 'bw' | 'bh' | 'bl' | 'neckL' | 'neckA' | 'neckR' | 'hw' | 'hh' | 'hl' | 'headDown' | 'snout' | 'ears' | 'earS' | 'tail' | 'tailL'>) => makeQuad(id, s);

const OPEN_WINGS: Record<string, Pose> = { 'Krila razprta': P({ wingL: [0, 85, 0], wingR: [0, 85, 0] }) };
const FLAP: Record<string, Pose> = { Mahanje: P({ wingL: [-40, 70, 0], wingR: [-40, 70, 0], tail: [20, 0, 0] }) };

const bipedPoses = (): Record<string, Pose> => ({ Hodi: P({ hipL: [30, 0, 0], kneeL: [10, 0, 0], hipR: [-20, 0, 0], kneeR: [30, 0, 0] }), 'Glava dol': P({ neck: [50, 0, 0], head: [20, 0, 0] }) });

const RIGS: Record<AnimalType, Rig> = {
  cat: quad('cat', { legH: 0.2, legR: 0.025, bw: 0.075, bh: 0.09, bl: 0.22, neckL: 0.08, neckA: 0.5, neckR: 0.045, hw: 0.06, hh: 0.055, hl: 0.06, headDown: 0.15, snout: 0.02, snoutR: 0.025, ears: 'point', earS: 0.035, tail: 'long', tailL: 0.35 }),
  wolf: quad('wolf', { legH: 0.45, legR: 0.04, bw: 0.12, bh: 0.17, bl: 0.4, neckL: 0.2, neckA: 0.7, neckR: 0.08, hw: 0.08, hh: 0.08, hl: 0.12, headDown: 0.3, snout: 0.1, snoutR: 0.045, ears: 'point', earS: 0.07, tail: 'long', tailL: 0.5 }),
  cow: quad('cow', { legH: 0.6, legR: 0.06, hoof: true, bw: 0.35, bh: 0.4, bl: 0.8, neckL: 0.35, neckA: 1.0, neckR: 0.17, hw: 0.13, hh: 0.15, hl: 0.22, headDown: 0.5, snout: 0.08, snoutR: 0.09, ears: 'point', earS: 0.08, horns: 'horns', tail: 'tuft', tailL: 0.8 }),
  sheep: quad('sheep', { legH: 0.35, legR: 0.035, hoof: true, bw: 0.28, bh: 0.3, bl: 0.5, neckL: 0.2, neckA: 0.9, neckR: 0.09, hw: 0.07, hh: 0.09, hl: 0.13, headDown: 0.6, snout: 0.05, snoutR: 0.045, ears: 'floppy', earS: 0.09, tail: 'short', tailL: 0.12 }),
  pig: quad('pig', { legH: 0.22, legR: 0.04, hoof: true, bw: 0.3, bh: 0.3, bl: 0.6, neckL: 0.1, neckA: 1.2, neckR: 0.16, hw: 0.12, hh: 0.12, hl: 0.18, headDown: 0.3, snout: 0.1, snoutR: 0.07, ears: 'floppy', earS: 0.1, tail: 'curl', tailL: 0.15 }),
  deer: quad('deer', { legH: 0.7, legR: 0.035, hoof: true, bw: 0.17, bh: 0.25, bl: 0.5, neckL: 0.45, neckA: 0.6, neckR: 0.08, hw: 0.07, hh: 0.08, hl: 0.15, headDown: 0.4, snout: 0.08, snoutR: 0.04, ears: 'point', earS: 0.09, horns: 'antlers', tail: 'short', tailL: 0.12 }),
  bear: quad('bear', { legH: 0.3, legR: 0.08, bw: 0.35, bh: 0.4, bl: 0.7, neckL: 0.2, neckA: 0.9, neckR: 0.22, hw: 0.15, hh: 0.15, hl: 0.22, headDown: 0.3, snout: 0.1, snoutR: 0.08, ears: 'round', earS: 0.06, tail: 'short', tailL: 0.1 }),
  lion: quad('lion', { legH: 0.45, legR: 0.075, bw: 0.25, bh: 0.3, bl: 0.65, neckL: 0.25, neckA: 0.8, neckR: 0.17, hw: 0.13, hh: 0.14, hl: 0.18, headDown: 0.3, snout: 0.08, snoutR: 0.08, ears: 'round', earS: 0.05, tail: 'tuft', tailL: 0.8 }),
  camel: quad('camel', { legH: 1.0, legR: 0.06, bw: 0.35, bh: 0.45, bl: 0.8, neckL: 0.9, neckA: 0.5, neckR: 0.1, hw: 0.1, hh: 0.12, hl: 0.25, headDown: 0.5, snout: 0.1, snoutR: 0.07, ears: 'round', earS: 0.04, tail: 'tuft', tailL: 0.6, hump: 0.35 }),
  giraffe: quad('giraffe', { legH: 1.5, legR: 0.06, hoof: true, bw: 0.3, bh: 0.5, bl: 0.7, neckL: 1.8, neckA: 0.25, neckR: 0.1, hw: 0.08, hh: 0.1, hl: 0.22, headDown: 0.4, snout: 0.08, snoutR: 0.05, ears: 'point', earS: 0.08, horns: 'horns', tail: 'tuft', tailL: 0.8 }),
  rabbit: quad('rabbit', { legH: 0.1, legR: 0.025, bw: 0.08, bh: 0.1, bl: 0.18, neckL: 0.05, neckA: 0.6, neckR: 0.06, hw: 0.05, hh: 0.055, hl: 0.07, headDown: 0.2, snout: 0.03, snoutR: 0.03, ears: 'long', earS: 0.06, earJoints: true, tail: 'short', tailL: 0.06, hindMul: 1.6 }),
  chicken: makeBiped('chicken', { body: [0.12, 0.14, 0.2], tilt: 0.35, legL: 0.18, legR: 0.01, thigh: 0.05, foot: [0.025, 0.01, 0.05], neckL: 0.14, neckR: 0.035, neckA: 0.15, headR: 0.035, beak: 0.035, beakR: 0.015, wingL: 0.22, wingW: 0.08, wing: 'back', tailL: 0.2, tailW: 0.07 }, { ...OPEN_WINGS, ...FLAP, ...bipedPoses() }),
  duck: makeBiped('duck', { body: [0.1, 0.1, 0.2], tilt: 0.25, legL: 0.08, legR: 0.01, thigh: 0.04, foot: [0.04, 0.008, 0.06], neckL: 0.15, neckR: 0.03, neckA: 0.35, headR: 0.04, beak: 0.06, beakR: 0.02, wingL: 0.24, wingW: 0.07, wing: 'back', tailL: 0.1, tailW: 0.05 }, { ...OPEN_WINGS, ...FLAP, ...bipedPoses() }),
  eagle: makeBiped('eagle', { body: [0.1, 0.12, 0.25], tilt: 0.5, legL: 0.15, legR: 0.015, thigh: 0.05, foot: [0.03, 0.012, 0.06], neckL: 0.06, neckR: 0.04, neckA: 0.2, headR: 0.045, beak: 0.05, beakR: 0.02, wingL: 0.45, wingW: 0.12, wing: 'back', tailL: 0.22, tailW: 0.09 }, { ...OPEN_WINGS, ...FLAP, ...bipedPoses() }),
  penguin: makeBiped('penguin', { body: [0.13, 0.14, 0.32], tilt: 1.4, legL: 0.06, legR: 0.015, thigh: 0.05, foot: [0.04, 0.012, 0.07], neckL: 0.05, neckR: 0.06, neckA: 0.1, headR: 0.05, beak: 0.06, beakR: 0.02, wingL: 0.3, wingW: 0.03, wing: 'down', tailL: 0.08, tailW: 0.04 }, { 'Peruti odpre': P({ wingL: [0, 0, 70], wingR: [0, 0, 70] }), ...bipedPoses() }),
  kangaroo: makeBiped('kangaroo', { body: [0.17, 0.2, 0.4], tilt: 1.0, legL: 0.5, legR: 0.07, thigh: 0.16, foot: [0.08, 0.03, 0.2], neckL: 0.15, neckR: 0.07, neckA: 0.3, headR: 0.07, beak: 0.12, beakR: 0.04, snout: true, wingL: 0.3, wingW: 0.03, wing: 'down', tailL: 0.8, tailW: 0.08, earS: 0.09 }, { Skok: P({ hipL: [45, 0, 0], kneeL: [60, 0, 0], hipR: [45, 0, 0], kneeR: [60, 0, 0] }), ...bipedPoses() }),
  snake: makeSnake(),
  fish: makeFish(),
  spider: makeSpider(),
};

export const ANIMAL_LABELS: Record<AnimalType, string> = {
  cat: 'Mačka',
  wolf: 'Volk',
  cow: 'Krava',
  sheep: 'Ovca',
  pig: 'Prašič',
  deer: 'Jelen',
  bear: 'Medved',
  lion: 'Lev',
  camel: 'Kamela',
  giraffe: 'Žirafa',
  rabbit: 'Zajec',
  chicken: 'Kokoš',
  duck: 'Raca',
  eagle: 'Orel',
  penguin: 'Pingvin',
  kangaroo: 'Kenguru',
  snake: 'Kača',
  fish: 'Riba',
  spider: 'Pajek',
};

export const isAnimalType = (t: string | undefined): t is AnimalType => (ANIMAL_TYPES as readonly string[]).includes(t ?? '');
export const animalRig = (t: AnimalType): Rig => RIGS[t];
