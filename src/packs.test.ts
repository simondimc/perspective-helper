import { describe, expect, it } from 'vitest';
import { PACK_KIND, parsePack, splitRef } from './packs';

describe('paketi figur', () => {
  it('prebere veljaven paket z obleko, lasmi in pozo', () => {
    const raw = { kind: PACK_KIND, version: 1, id: 'test', name: 'Test', figures: [{ id: 'ana', name: 'Ana', type: 'woman', size: [0.5, 1.7, 0.3], outfit: 'dress', hair: 'long', pose: { torso: [5, 0, 0] } }, { id: 'brez', name: 'Brez', type: 'figure', size: [0.5, 1.8, 0.3], outfit: 'neznano' }] };
    const pack = parsePack(JSON.parse(JSON.stringify(raw)));
    expect(pack.figures[0]).toMatchObject({ type: 'woman', outfit: 'dress', hair: 'long', pose: { torso: [5, 0, 0] } });
    expect(pack.figures[1].outfit).toBeUndefined(); // neznana obleka se ne prenese
  });

  it('zavrne neveljavne datoteke', () => {
    expect(() => parsePack({})).toThrow();
    expect(() => parsePack({ kind: PACK_KIND, version: 99, id: 'x', name: 'x', figures: [] })).toThrow(/novejše/);
    expect(() => parsePack({ kind: PACK_KIND, version: 1, id: 'x', name: 'x', figures: [{ id: 'a', name: 'a', type: 'dog', size: [1, 1, 1] }] })).toThrow(/Neveljavna/);
    expect(() => parsePack({ kind: PACK_KIND, version: 1, id: 'x', name: 'x', figures: [{ id: 'a', name: 'a', type: 'figure', size: [1, 1, 1] }, { id: 'a', name: 'b', type: 'figure', size: [1, 1, 1] }] })).toThrow(/Podvojena/);
  });

  it('razdeli sklic na paket in figuro', () => {
    expect(splitRef('paket/ana')).toEqual(['paket', 'ana']);
    expect(splitRef('brez')).toBeNull();
  });
});
