import { BoxGeometry, BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Pohištvo iz kvadrov. Središče geometrije je v sredini omejevalnega okvirja (kot pri ostalih objektih),
// stol je obrnjen proti +Z (naslonjalo na strani −Z), posteljna vzglavnica je na strani −Z.

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

/** Postelja: okvir z nogami, vzglavnica (−Z) in vznožje (+Z), vzmetnica, blazini in odeja (W × H × D). */
export function bedGeometry(size: Size): BufferGeometry {
  const [W, H, D] = size;
  const y0 = -H / 2;
  const leg = Math.min(0.07, W * 0.05);
  const legH = Math.min(0.2, H * 0.22);
  const rail = Math.min(0.14, H * 0.16);
  const mat = Math.min(0.22, H * 0.25);
  const post = Math.min(0.06, W * 0.04);
  const parts: BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(leg, legH, leg, sx * (W / 2 - leg / 2), y0 + legH / 2, sz * (D / 2 - leg / 2)));
  parts.push(box(W, rail, D, 0, y0 + legH + rail / 2, 0)); // okvir
  const mTop = y0 + legH + rail + mat;
  parts.push(box(W - 2 * post, mat, D - 2 * post, 0, y0 + legH + rail + mat / 2, 0)); // vzmetnica
  parts.push(box(W, H - legH, post, 0, y0 + legH + (H - legH) / 2, -D / 2 + post / 2)); // vzglavnica
  const footH = (H - legH) * 0.55;
  parts.push(box(W, footH, post, 0, y0 + legH + footH / 2, D / 2 - post / 2)); // vznožje
  const pw = (W - 2 * post) * 0.42;
  const pd = Math.min(0.35, D * 0.17);
  const ph = Math.min(0.14, H * 0.15);
  const pillows = W > 1.1 ? [-1, 1] : [0];
  for (const k of pillows) parts.push(box(pw, ph, pd, k * (W / 2 - post - pw / 2 - (W > 1.1 ? 0.04 : 0)), mTop + ph / 2, -D / 2 + post + pd / 2 + 0.03)); // blazine
  const bd = (D - 2 * post) * 0.66;
  const bh = Math.min(0.08, H * 0.09);
  parts.push(box(W - 2 * post + 0.04, bh, bd, 0, mTop + bh / 2, D / 2 - post - bd / 2)); // odeja
  return mergeGeometries(parts)!;
}
