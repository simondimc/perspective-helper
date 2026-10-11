import { BoxGeometry, BufferGeometry, ConeGeometry, ExtrudeGeometry, Shape } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Hiše iz osnovnih teles: telo, streha, vrata, okna, dimnik. Središče geometrije je v sredini omejevalnega okvirja
// (W × H × D); pročelje z vrati je obrnjeno proti +Z, slemena dvokapnih streh so vzdolž X.

type Size = [number, number, number];
export type HouseKind = 'house' | 'houseHip' | 'houseTwo' | 'cottage' | 'barn' | 'church';
export const HOUSE_KINDS: HouseKind[] = ['house', 'houseHip', 'houseTwo', 'cottage', 'barn', 'church'];

const box = (w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry => new BoxGeometry(w, h, d).translate(x, y, z);

/** Streha z dvema kapoma: trikotni prerez (Z–Y) iztisnjen vzdolž X, od `eave` do `ridge`. */
function gable(W: number, D: number, eave: number, ridge: number, x = 0, z = 0): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-D / 2, eave);
  shape.lineTo(D / 2, eave);
  shape.lineTo(0, ridge);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth: W, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(W / 2 + x, 0, z);
}

/** Štirikapna streha (piramida s pravokotno osnovo). */
function pyramid(W: number, D: number, eave: number, ridge: number, x = 0, z = 0): BufferGeometry {
  return new ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4).scale(W / Math.SQRT2, ridge - eave, D / Math.SQRT2).translate(x, eave + (ridge - eave) / 2, z);
}

const finish = (parts: BufferGeometry[], H: number): BufferGeometry => mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!.translate(0, -H / 2, 0);

export function houseGeometry(kind: HouseKind, size: Size): BufferGeometry {
  if (kind === 'church') return churchGeometry(size);
  const [W, H, D] = size;
  const over = Math.min(0.3, W * 0.04, D * 0.04); // napušč strehe
  const bw = W - 2 * over;
  const bd = D - 2 * over;
  const t = 0.06; // izstop vrat in oken iz stene
  const floors = kind === 'houseTwo' ? 2 : 1;
  const wallFrac = kind === 'cottage' ? 0.5 : kind === 'barn' ? 0.5 : kind === 'houseTwo' ? 0.68 : 0.55;
  const wallH = H * wallFrac;
  const ridgeY = H * (kind === 'houseHip' ? 1 : kind === 'cottage' || kind === 'barn' ? 1 : 0.88);
  const parts: BufferGeometry[] = [box(bw, wallH, bd, 0, wallH / 2, 0)];

  parts.push(kind === 'houseHip' ? pyramid(W, D, wallH, ridgeY) : gable(W, D, wallH, ridgeY));
  if (kind === 'house' || kind === 'houseTwo') {
    const cw = Math.min(0.5, W * 0.07);
    parts.push(box(cw, H - wallH, cw, W * 0.25, wallH + (H - wallH) / 2, -D * 0.12));
  }

  const frontZ = bd / 2 + t / 2;
  const fl = wallH / floors;
  if (kind === 'barn') {
    // velika dvokrilna vrata, brez oken
    const gw = Math.min(3, bw * 0.4);
    const gh = Math.min(3.2, wallH * 0.85);
    parts.push(box(gw, gh, t, 0, gh / 2, frontZ));
    parts.push(box(0.08, gh, t * 2, 0, gh / 2, frontZ));
    parts.push(box(gw * 0.5, 0.9, t, 0, wallH + (ridgeY - wallH) * 0.3, frontZ - 0.02));
  } else {
    const doorH = Math.min(2.1, fl * 0.8);
    const doorW = Math.min(1, bw * 0.15);
    const winH = Math.min(1.2, fl * 0.4);
    const winW = Math.min(1.1, bw * 0.15);
    const doorX = kind === 'cottage' ? -bw * 0.18 : 0;
    parts.push(box(doorW, doorH, t, doorX, doorH / 2, frontZ));
    parts.push(box(doorW * 1.4, 0.12, 0.4, doorX, 0.06, bd / 2 + 0.2));
    const xs = kind === 'cottage' ? [bw * 0.25] : [-bw * 0.3, bw * 0.3];
    for (let f = 0; f < floors; f++) {
      const wy = f * fl + fl * 0.55;
      for (const x of xs) parts.push(box(winW, winH, t, x, wy, frontZ));
      if (f > 0) parts.push(box(winW, winH, t, 0, wy, frontZ));
      for (const sx of [-1, 1]) parts.push(box(t, winH, winW, sx * (bw / 2 + t / 2), wy, 0));
    }
    // okno v čelu strehe
    if (kind !== 'houseHip' && kind !== 'cottage') parts.push(box(winW * 0.8, winH * 0.7, t, 0, wallH + (ridgeY - wallH) * 0.3, frontZ - 0.02));
  }
  return finish(parts, H);
}

/** Cerkev: ladja z dvokapno streho in zvonik s piramidasto streho na pročelju (+Z). */
function churchGeometry(size: Size): BufferGeometry {
  const [W, H, D] = size;
  const t = 0.06;
  const tw = Math.min(W * 0.4, D * 0.4); // stranica zvonika
  const naveD = D - tw * 0.5; // ladja sega do zvonika
  const naveW = W;
  const naveZ = -D / 2 + naveD / 2;
  const wallH = H * 0.32;
  const naveRidge = H * 0.5;
  const towerX = 0;
  const towerZ = D / 2 - tw / 2;
  const towerH = H * 0.7;
  const parts: BufferGeometry[] = [
    box(naveW * 0.9, wallH, naveD, 0, wallH / 2, naveZ),
    gable(naveW, naveD, wallH, naveRidge, 0, naveZ),
    box(tw, towerH, tw, towerX, towerH / 2, towerZ),
    pyramid(tw * 1.1, tw * 1.1, towerH, H, towerX, towerZ),
  ];
  const doorH = Math.min(2.6, towerH * 0.4);
  parts.push(box(Math.min(1.4, tw * 0.45), doorH, t, 0, doorH / 2, D / 2 + t / 2));
  parts.push(box(Math.min(0.7, tw * 0.25), 1.1, t, 0, towerH * 0.72, D / 2 + t / 2));
  for (const sx of [-1, 1]) {
    for (const z of [naveZ - naveD * 0.22, naveZ + naveD * 0.18]) parts.push(box(t, Math.min(1.8, wallH * 0.5), 0.7, sx * (naveW * 0.45 + t / 2), wallH * 0.55, z));
  }
  return finish(parts, H);
}
