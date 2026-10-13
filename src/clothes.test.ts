import { describe, expect, it } from 'vitest';
import { HAIRS, OUTFITS, WEAPONS, rigFor } from './clothes';
import { rigGeometry } from './figure';

// Vsaka obleka, frizura in orožje/ščit mora dati veljavno geometrijo (združevanje delov ne sme odpovedati).
describe('obleke, lasje in orožje', () => {
  for (const type of ['figure', 'woman']) {
    it(`vse možnosti za ${type}`, () => {
      const size: [number, number, number] = type === 'figure' ? [0.57, 1.8, 0.31] : [0.5, 1.7, 0.28];
      for (const outfit of Object.keys(OUTFITS)) {
        const g = rigGeometry(rigFor(type, outfit, undefined, undefined, undefined)!, {}, size);
        expect(g.attributes.position.count, `obleka ${outfit}`).toBeGreaterThan(0);
      }
      for (const hair of Object.keys(HAIRS)) expect(rigGeometry(rigFor(type, undefined, hair)!, {}, size).attributes.position.count, `lasje ${hair}`).toBeGreaterThan(0);
      for (const w of Object.keys(WEAPONS)) {
        expect(rigGeometry(rigFor(type, undefined, undefined, w, undefined)!, {}, size).attributes.position.count, `desna ${w}`).toBeGreaterThan(0);
        expect(rigGeometry(rigFor(type, undefined, undefined, undefined, w)!, {}, size).attributes.position.count, `leva ${w}`).toBeGreaterThan(0);
      }
    });
  }
});
