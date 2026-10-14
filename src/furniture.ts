import { BoxGeometry, BufferGeometry, CylinderGeometry, LatheGeometry, SphereGeometry, Vector2 } from 'three';
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

/** List: podolgovat elipsoid, ki izhaja iz (0, 0, 0) navzgor, nagnjen za `tilt` in zavrten za `az`, nato premaknjen v (x, y, z). */
function leaf(len: number, wid: number, tilt: number, az: number, x: number, y: number, z: number): BufferGeometry {
  return new SphereGeometry(0.5, 10, 8).scale(wid, len, wid * 0.25).translate(0, len / 2, 0).rotateZ(-tilt).rotateY(az).translate(x, y, z);
}

export type PlantKind = 'plant' | 'plantBig' | 'cactus' | 'palm' | 'fern' | 'flowers' | 'bamboo' | 'monstera' | 'fig';

/** Rastlina v vazi (W × H × D); vrsta določa obliko lista, debla in cvetov. */
export function plantGeometry(size: Size, kind: PlantKind): BufferGeometry {
  const [W, H, D] = size;
  const R = Math.min(W, D) / 2;
  const y0 = -H / 2;
  const big = kind === 'plantBig' || kind === 'palm' || kind === 'bamboo' || kind === 'monstera' || kind === 'fig';
  const vaseH = H * (kind === 'cactus' ? 0.3 : kind === 'plantBig' ? 0.3 : kind === 'palm' ? 0.22 : kind === 'bamboo' ? 0.16 : kind === 'monstera' ? 0.2 : kind === 'fig' ? 0.14 : kind === 'fern' ? 0.34 : 0.38);
  const rB = R * (big ? 0.55 : 0.5);
  const rM = R * (big ? 0.75 : 0.85);
  const rT = R * 0.6;
  const profile = [
    new Vector2(0.001, 0),
    new Vector2(rB, 0),
    new Vector2(rM, vaseH * 0.45),
    new Vector2(rT, vaseH * 0.9),
    new Vector2(rT * 1.08, vaseH),
    new Vector2(rT * 0.9, vaseH),
    new Vector2(rT * 0.8, vaseH * 0.92),
    new Vector2(0.001, vaseH * 0.92),
  ];
  const parts: BufferGeometry[] = [new LatheGeometry(profile, 24).translate(0, y0, 0)];
  const top = y0 + vaseH * 0.92;
  const rest = H - vaseH * 0.92;
  const ring = (n: number, f: (i: number, az: number) => BufferGeometry) => {
    for (let i = 0; i < n; i++) parts.push(f(i, (i / n) * Math.PI * 2 + (i % 2) * 0.3));
  };
  if (kind === 'plantBig') {
    const trunkH = rest * 0.45;
    parts.push(new CylinderGeometry(R * 0.06, R * 0.09, trunkH, 8).translate(0, top + trunkH / 2, 0));
    ring(9, (i, az) => {
      const len = rest * (0.55 + (i % 3) * 0.08);
      return leaf(len, Math.min(R * 0.9, len * 0.32), 0.35 + (i % 3) * 0.3, az, 0, top + trunkH * 0.85, 0);
    });
  } else if (kind === 'plant') {
    ring(7, (i, az) => {
      const len = rest * (0.75 + (i % 2) * 0.25);
      return leaf(len, Math.min(R * 0.7, len * 0.3), 0.2 + (i % 3) * 0.3, az, 0, top, 0);
    });
  } else if (kind === 'cactus') {
    // steber z dvema rokama
    const bodyR = R * 0.38;
    const bodyH = rest * 0.95;
    parts.push(new CylinderGeometry(bodyR, bodyR, bodyH - bodyR, 16).translate(0, top + (bodyH - bodyR) / 2, 0));
    parts.push(new SphereGeometry(bodyR, 16, 10).translate(0, top + bodyH - bodyR, 0));
    for (const [sd, h, up] of [[1, 0.42, 0.28], [-1, 0.6, 0.2]] as const) {
      const ar = bodyR * 0.55;
      const reach = R * 0.62;
      const y = top + bodyH * h;
      parts.push(new CylinderGeometry(ar, ar, reach, 12).rotateZ(Math.PI / 2).translate(sd * (bodyR * 0.5 + reach / 2), y, 0));
      const upH = bodyH * up;
      parts.push(new CylinderGeometry(ar, ar, upH, 12).translate(sd * (bodyR * 0.5 + reach), y + upH / 2, 0));
      parts.push(new SphereGeometry(ar, 12, 8).translate(sd * (bodyR * 0.5 + reach), y + upH, 0));
    }
  } else if (kind === 'palm') {
    const trunkH = rest * 0.72;
    parts.push(new CylinderGeometry(R * 0.07, R * 0.12, trunkH, 10).translate(0, top + trunkH / 2, 0));
    ring(10, (i, az) => {
      const len = Math.min(rest * 0.4, R * 1.6) * (0.85 + (i % 3) * 0.12);
      return leaf(len, len * 0.2, 0.9 + (i % 3) * 0.25, az, 0, top + trunkH, 0);
    });
  } else if (kind === 'fern') {
    ring(14, (i, az) => {
      const len = rest * (0.7 + (i % 3) * 0.15);
      return leaf(len, Math.min(R * 0.4, len * 0.2), 0.5 + (i % 4) * 0.22, az, 0, top, 0);
    });
  } else if (kind === 'bamboo') {
    // šop navpičnih stebel z listnatimi šopi pri vrhu
    const n = 8;
    for (let i = 0; i < n; i++) {
      const az = (i / n) * Math.PI * 2 + i * 0.4;
      const tilt = 0.04 + (i % 3) * 0.04;
      const r0 = R * 0.35 * (i % 2 ? 0.5 : 1);
      const len = rest * (0.7 + (i % 3) * 0.15);
      const sr = Math.max(0.008, R * 0.045);
      parts.push(new CylinderGeometry(sr * 0.8, sr, len, 8).translate(0, len / 2, 0).rotateZ(-tilt).rotateY(az).translate(Math.cos(az) * r0, top, Math.sin(az) * r0));
      const tx = Math.sin(tilt) * len;
      const tipX = Math.cos(az) * r0 + tx * Math.cos(az);
      const tipZ = Math.sin(az) * r0 - tx * Math.sin(az);
      for (let k = 0; k < 3; k++) parts.push(leaf(rest * 0.14, rest * 0.03, 1.0 + k * 0.1, az + k * 2.1, tipX, top + Math.cos(tilt) * len * 0.97, tipZ));
    }
  } else if (kind === 'monstera') {
    // široki listi na poševnih steblih
    ring(9, (i, az) => {
      const stemL = rest * (0.45 + (i % 3) * 0.2);
      const tilt = 0.25 + (i % 3) * 0.2;
      const sr = Math.max(0.006, R * 0.03);
      const g = new CylinderGeometry(sr, sr, stemL, 6).translate(0, stemL / 2, 0).rotateZ(-tilt);
      const tipX = Math.sin(tilt) * stemL;
      const tipY = Math.cos(tilt) * stemL;
      const lw = Math.min(R * 0.9, rest * 0.3);
      const lf = new SphereGeometry(0.5, 12, 8).scale(lw, lw * 0.15, lw * 0.8).translate(0, 0, 0).translate(tipX + lw * 0.2, tipY, 0);
      return mergeGeometries([g, lf])!.rotateY(az).translate(0, top, 0);
    });
  } else if (kind === 'fig') {
    // tanko deblo in gosta krošnja velikih listov
    const trunkH = rest * 0.6;
    parts.push(new CylinderGeometry(R * 0.05, R * 0.09, trunkH, 10).translate(0, top + trunkH / 2, 0));
    ring(14, (i, az) => {
      const h = trunkH * (0.55 + (i % 4) * 0.2);
      const len = Math.min(rest * 0.3, R * 1.3);
      return leaf(len, len * 0.55, 0.9 + (i % 3) * 0.3, az, 0, top + h, 0);
    });
    parts.push(leaf(rest * 0.3, rest * 0.12, 0.1, 0, 0, top + trunkH, 0));
  } else {
    // šopek cvetov: tanki stebli in okrogle glavice na različnih višinah
    const n = 7;
    for (let i = 0; i < n; i++) {
      const az = (i / n) * Math.PI * 2;
      const tilt = i === 0 ? 0 : 0.25 + (i % 3) * 0.1;
      const len = rest * (i === 0 ? 0.85 : 0.6 + (i % 3) * 0.12);
      const sr = Math.max(0.004, R * 0.03);
      const stem = new CylinderGeometry(sr, sr, len, 6).translate(0, len / 2, 0).rotateZ(-tilt).rotateY(az).translate(0, top, 0);
      parts.push(stem);
      const hr = Math.min(R * 0.3, rest * 0.12);
      parts.push(new SphereGeometry(hr, 10, 8).scale(1, 0.7, 1).translate(0, len, 0).rotateZ(-tilt).rotateY(az).translate(0, top, 0));
    }
    const lr = R * 0.5;
    ring(4, (_i, az) => leaf(rest * 0.3, lr * 0.5, 0.9, az, 0, top, 0));
  }
  return mergeGeometries(parts)!;
}

/** Manjši vodnjak (W × H × D): okrogel bazen z robom, stebriček, zgornja skleda in curek; vzdolž višine je razporejen po polovici. */
export function fountainGeometry(size: Size): BufferGeometry {
  const [W, H, D] = size;
  const R = Math.min(W, D) / 2;
  const y0 = -H / 2;
  const rim = H * 0.28;
  const wall = R * 0.08;
  const basin = [
    new Vector2(0.001, 0),
    new Vector2(R, 0),
    new Vector2(R, rim),
    new Vector2(R - wall, rim),
    new Vector2(R - wall, rim * 0.85),
    new Vector2(0.001, rim * 0.85),
  ];
  const parts: BufferGeometry[] = [new LatheGeometry(basin, 40).translate(0, y0, 0)];
  const postH = H * 0.4;
  parts.push(new CylinderGeometry(R * 0.1, R * 0.16, postH, 16).translate(0, y0 + rim * 0.85 + postH / 2, 0));
  const bowlY = y0 + rim * 0.85 + postH;
  const bowlR = R * 0.5;
  const bowlH = H * 0.1;
  const bowl = [
    new Vector2(0.001, 0),
    new Vector2(bowlR * 0.35, 0),
    new Vector2(bowlR, bowlH),
    new Vector2(bowlR - wall * 0.6, bowlH),
    new Vector2(bowlR * 0.35, bowlH * 0.25),
    new Vector2(0.001, bowlH * 0.25),
  ];
  parts.push(new LatheGeometry(bowl, 32).translate(0, bowlY, 0));
  const jetH = y0 + H - (bowlY + bowlH * 0.25);
  parts.push(new CylinderGeometry(R * 0.025, R * 0.05, jetH, 8).translate(0, bowlY + bowlH * 0.25 + jetH / 2, 0));
  return mergeGeometries(parts)!;
}
