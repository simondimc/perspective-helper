import { BoxGeometry, BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Pohištvo iz kvadrov. Središče geometrije je v sredini omejevalnega okvirja (kot pri ostalih objektih),
// stol je obrnjen proti +Z (naslonjalo na strani −Z).

type Size = [number, number, number];

const box = (w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry => new BoxGeometry(w, h, d).translate(x, y, z);

/** Miza: plošča in štiri noge (W × H × D). */
export function tableGeometry(size: Size): BufferGeometry {
  const [W, H, D] = size;
  const top = Math.min(0.05, H * 0.1);
  const leg = Math.min(0.07, W * 0.08, D * 0.1);
  const inset = leg * 0.6;
  const legH = H - top;
  const parts: BufferGeometry[] = [box(W, top, D, 0, H / 2 - top / 2, 0)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(leg, legH, leg, sx * (W / 2 - inset - leg / 2), -H / 2 + legH / 2, sz * (D / 2 - inset - leg / 2)));
  return mergeGeometries(parts)!;
}

/** Stol: sedež, štiri noge in naslonjalo (W × H × D); sedež je na polovici višine. */
export function chairGeometry(size: Size): BufferGeometry {
  const [W, H, D] = size;
  const seatY = H * 0.5;
  const seatT = Math.min(0.04, H * 0.05);
  const leg = Math.min(0.04, W * 0.1);
  const legH = seatY - seatT;
  const parts: BufferGeometry[] = [box(W, seatT, D, 0, -H / 2 + seatY - seatT / 2, 0)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(leg, legH, leg, sx * (W / 2 - leg / 2), -H / 2 + legH / 2, sz * (D / 2 - leg / 2)));
  const backH = H - seatY;
  parts.push(box(W, backH, leg, 0, -H / 2 + seatY + backH / 2, -D / 2 + leg / 2));
  return mergeGeometries(parts)!;
}
