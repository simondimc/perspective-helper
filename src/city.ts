import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Matrix4, Path, Shape, SphereGeometry, TorusGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Mestne stavbe: mestna hiša, blok in stolpnica. Središče geometrije je v sredini omejevalnega okvirja (W × H × D);
// pročelje je obrnjeno proti +Z. Okna so plošče, ki rahlo štrlijo iz stene.

type Size = [number, number, number];
export type CityKind = 'townhouse' | 'block' | 'tower' | 'car' | 'hatch' | 'suv' | 'van' | 'bus' | 'eiffel' | 'ferris' | 'boat' | 'colosseum';
export const CITY_KINDS: CityKind[] = ['townhouse', 'block', 'tower', 'car', 'hatch', 'suv', 'van', 'bus', 'eiffel', 'ferris', 'boat', 'colosseum'];

const box = (w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry => new BoxGeometry(w, h, d).translate(x, y, z);
const finish = (parts: BufferGeometry[], H: number): BufferGeometry => mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!.translate(0, -H / 2, 0);

/** Mreža oken na pročelju (+Z) ali zadnji strani (−Z). */
function windows(parts: BufferGeometry[], W: number, D: number, floors: number, fl: number, cols: number, skipGround: boolean, back: boolean): void {
  const t = 0.06;
  if (floors * cols > 90) {
    // veliko oken: namesto mreže po ena trakasta okna na etažo
    const z = (back ? -1 : 1) * (D / 2 + t / 2);
    for (let f = skipGround ? 1 : 0; f < floors; f++) parts.push(box(W * 0.92, Math.min(1.5, fl * 0.5), t, 0, f * fl + fl * 0.55, z));
    return;
  }
  const ww = Math.min(1.3, (W / cols) * 0.55);
  const wh = Math.min(1.5, fl * 0.5);
  const z = (back ? -1 : 1) * (D / 2 + t / 2);
  for (let f = skipGround ? 1 : 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) parts.push(box(ww, wh, t, -W / 2 + (W / cols) * (c + 0.5), f * fl + fl * 0.55, z));
  }
}

function townhouse([W, H, D]: Size): BufferGeometry {
  const floors = Math.max(2, Math.round(H / 3.3));
  const fl = (H - 0.5) / floors;
  const bw = W - 0.3;
  const bd = D - 0.3;
  const cols = Math.max(1, Math.floor(bw / 2.6));
  const parts: BufferGeometry[] = [box(bw, H - 0.5, bd, 0, (H - 0.5) / 2, 0), box(W, 0.5, D, 0, H - 0.25, 0)];
  windows(parts, bw, bd, floors, fl, cols, true, false);
  // pritličje: vrata in eno okno
  const dh = Math.min(2.2, fl * 0.75);
  parts.push(box(1.1, dh, 0.06, -bw / 2 + (bw / cols) * 0.5, dh / 2, bd / 2 + 0.03));
  for (let c = 1; c < cols; c++) parts.push(box(Math.min(1.3, (bw / cols) * 0.55), Math.min(1.5, fl * 0.5), 0.06, -bw / 2 + (bw / cols) * (c + 0.5), fl * 0.55, bd / 2 + 0.03));
  return finish(parts, H);
}

function block([W, H, D]: Size): BufferGeometry {
  const floors = Math.min(40, Math.max(2, Math.round(H / 3.2)));
  const fl = (H - 1) / floors;
  const cols = Math.min(14, Math.max(2, Math.floor(W / 3)));
  const parts: BufferGeometry[] = [box(W, H - 1, D, 0, (H - 1) / 2, 0), box(W * 0.3, 1, D * 0.4, W * 0.15, H - 0.5, 0)];
  windows(parts, W, D, floors, fl, cols, true, false);
  windows(parts, W, D, floors, fl, cols, true, true);
  const dh = Math.min(2.6, fl * 0.8);
  parts.push(box(Math.min(3, W * 0.15), dh, 0.06, 0, dh / 2, D / 2 + 0.03));
  return finish(parts, H);
}

function tower([W, H, D]: Size): BufferGeometry {
  const podium = H * 0.12;
  const shaftTop = H * 0.86;
  const crownTop = H * 0.95;
  const sw = W * 0.82;
  const sd = D * 0.82;
  const parts: BufferGeometry[] = [
    box(W, podium, D, 0, podium / 2, 0),
    box(sw, shaftTop - podium, sd, 0, (podium + shaftTop) / 2, 0),
    box(sw * 0.6, crownTop - shaftTop, sd * 0.6, 0, (shaftTop + crownTop) / 2, 0),
    new CylinderGeometry(Math.min(0.4, W * 0.02), Math.min(0.4, W * 0.02), H - crownTop, 8).translate(0, (crownTop + H) / 2, 0),
  ];
  const n = Math.min(40, Math.floor((shaftTop - podium) / 3.6));
  for (let i = 1; i <= n; i++) parts.push(box(sw + 0.3, 0.25, sd + 0.3, 0, podium + ((shaftTop - podium) / (n + 1)) * i, 0));
  const dh = Math.min(4, podium * 0.7);
  parts.push(box(Math.min(5, W * 0.3), dh, 0.06, 0, dh / 2, D / 2 + 0.03));
  return finish(parts, H);
}

interface VehicleSpec {
  lo: number; // spodnji rob telesa (delež višine)
  hi: number; // zgornji rob telesa
  cabin: Array<[number, number]>; // stranski profil kabine: [z (delež dolžine), y (delež višine)]
  wheelR: number; // polmer kolesa (delež višine)
  axles: number[]; // položaji osi (delež dolžine)
}

const VEHICLES: Record<'car' | 'hatch' | 'suv' | 'van' | 'bus', VehicleSpec> = {
  car: { lo: 0.26, hi: 0.54, cabin: [[-0.27, 0.54], [0.14, 0.54], [0.02, 1], [-0.2, 1]], wheelR: 0.2, axles: [-0.31, 0.31] },
  hatch: { lo: 0.26, hi: 0.55, cabin: [[-0.45, 0.55], [0.15, 0.55], [0.03, 1], [-0.36, 1]], wheelR: 0.2, axles: [-0.3, 0.3] },
  suv: { lo: 0.3, hi: 0.58, cabin: [[-0.45, 0.58], [0.2, 0.58], [0.1, 1], [-0.42, 1]], wheelR: 0.22, axles: [-0.3, 0.3] },
  van: { lo: 0.22, hi: 0.52, cabin: [[-0.5, 0.52], [0.32, 0.52], [0.2, 1], [-0.5, 1]], wheelR: 0.15, axles: [-0.3, 0.32] },
  bus: { lo: 0.17, hi: 0.93, cabin: [[-0.5, 0.93], [0.5, 0.93], [0.5, 1], [-0.5, 1]], wheelR: 0.12, axles: [-0.3, 0.33] },
};

/** Vozilo (limuzina, hatchback, SUV, kombi, avtobus): telo, kabina s poševnim steklom in kolesa. Sprednji del je proti +Z. */
function vehicle([W, H, D]: Size, v: VehicleSpec): BufferGeometry {
  const r = H * v.wheelR;
  const bodyLo = H * v.lo;
  const bodyHi = H * v.hi;
  const wheelW = Math.min(0.26, W * 0.14);
  const cabinW = W * 0.8;
  const shape = new Shape();
  v.cabin.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z * D, y * H) : shape.lineTo(z * D, y * H)));
  shape.closePath();
  const parts: BufferGeometry[] = [
    box(W * 0.9, bodyHi - bodyLo, D, 0, (bodyLo + bodyHi) / 2, 0),
    new ExtrudeGeometry(shape, { depth: cabinW, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(cabinW / 2, 0, 0),
  ];
  for (const sx of [-1, 1]) for (const az of v.axles) parts.push(new CylinderGeometry(r, r, wheelW, 20).rotateZ(Math.PI / 2).translate(sx * (W / 2 - wheelW / 2), r, az * D));
  return finish(parts, H);
}

/** Noga rešetkastega stolpa: nagnjen kvader od (x0, z0) na višini y0 do (x1, z1) na višini y1, debeline t. */
function leg(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, t: number): BufferGeometry {
  const h = y1 - y0;
  const g = new BoxGeometry(t, h, t).translate(0, h / 2, 0);
  // striženje: premik x in z linearno z višino, tako da se noga nagne od spodnjega proti zgornjemu položaju
  g.applyMatrix4(new Matrix4().set(1, (x1 - x0) / h, 0, 0, 0, 1, 0, 0, 0, (z1 - z0) / h, 1, 0, 0, 0, 0, 1));
  return g.translate(x0, y0, z0);
}

/** Eifflov stolp (poenostavljen): štiri nagnjene noge, tri ploščadi in špica. Središče okvirja je pod stolpom. */
function eiffel([W, H, D]: Size): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const levels = [
    { y: 0, hw: 0.47, t: 0.1 },
    { y: 0.173, hw: 0.31, t: 0.07 },
    { y: 0.35, hw: 0.2, t: 0.05 },
    { y: 0.84, hw: 0.045, t: 0.025 },
  ];
  for (let k = 0; k < levels.length - 1; k++) {
    const a = levels[k];
    const b = levels[k + 1];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(leg(sx * a.hw * W, sz * a.hw * D, sx * b.hw * W, sz * b.hw * D, a.y * H, b.y * H, a.t * W));
  }
  // loki med nogami ob vznožju in ploščadi
  for (const [y, hw, th] of [[0.06, 0.4, 0.012], [0.173, 0.32, 0.02], [0.35, 0.21, 0.02], [0.84, 0.06, 0.02]]) {
    parts.push(box(2 * hw * W, th * H, 2 * hw * D, 0, y * H, 0));
    for (const sz of [-1, 1]) parts.push(box(2 * hw * W, th * H * 2, 0.012 * D, 0, y * H, sz * hw * D));
    for (const sx of [-1, 1]) parts.push(box(0.012 * W, th * H * 2, 2 * hw * D, sx * hw * W, y * H, 0));
  }
  parts.push(new CylinderGeometry(0.004 * W, 0.02 * W, H * 0.16, 8).translate(0, H * 0.92, 0));
  return finish(parts, H);
}

/** Panoramsko kolo (London Eye): ravnina kolesa je XY, širina W = premer, globina D vključuje oporo. Kapsule so na +Z strani. */
function ferris([W, H, D]: Size): BufferGeometry {
  const R = W / 2;
  const hubY = H - R;
  const zs = D * 0.12; // razmik med obema obročema
  const parts: BufferGeometry[] = [];
  for (const sz of [-1, 1]) {
    parts.push(new TorusGeometry(R, 0.012 * W, 8, 72).translate(0, hubY, sz * zs));
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      parts.push(new BoxGeometry(R, 0.006 * W, 0.006 * W).translate(R / 2, 0, 0).rotateZ(a).translate(0, hubY, sz * zs));
    }
  }
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    // vezi med obročema in kapsula na zunanji strani
    parts.push(new BoxGeometry(0.006 * W, 0.006 * W, 2 * zs).translate(R * Math.cos(a), hubY + R * Math.sin(a), 0));
    parts.push(new SphereGeometry(1, 12, 8).scale(0.028 * W, 0.028 * W, 0.04 * W).translate(R * Math.cos(a), hubY + R * Math.sin(a) - 0.01 * W, zs + 0.045 * W));
  }
  parts.push(new CylinderGeometry(0.03 * W, 0.03 * W, D * 0.5, 16).rotateX(Math.PI / 2).translate(0, hubY, 0));
  // A-okvir: dve nogi od pesta do tal, nagnjeni proti +Z
  for (const sx of [-1, 1]) parts.push(leg(sx * 0.15 * W, D * 0.46, sx * 0.012 * W, zs * 0.4, 0, hubY, 0.03 * W));
  return finish(parts, H);
}

/** Ladja: trup z ošiljenim premcem (+Z), kabina in nizek ograjni rob. Dno trupa je pri y = 0. */
function boat([W, H, D]: Size): BufferGeometry {
  const hullH = H * 0.4;
  const plan = new Shape();
  plan.moveTo(-W / 2, D / 2); // shape y = −z po zasuku
  plan.lineTo(W / 2, D / 2);
  plan.lineTo(W / 2, -D * 0.2);
  plan.lineTo(0, -D / 2);
  plan.lineTo(-W / 2, -D * 0.2);
  plan.closePath();
  const hull = new ExtrudeGeometry(plan, { depth: hullH, bevelEnabled: false }).rotateX(-Math.PI / 2);
  const parts: BufferGeometry[] = [hull, box(W * 0.7, H * 0.38, D * 0.4, 0, hullH + H * 0.19, -D * 0.12), box(W * 0.5, H * 0.1, D * 0.22, 0, hullH + H * 0.43, -D * 0.12)];
  return finish(parts, H);
}

/** Koloseum (poenostavljen): eliptični obroč v štirih stopnjah z navpičnimi stebri na zunanji steni. Dno pri y = 0. */
function colosseum([W, H, D]: Size): BufferGeometry {
  const rx = W / 2;
  const rz = D / 2;
  const thick = Math.min(rx, rz) * 0.22;
  const tiers: Array<[number, number, number]> = [
    [0, 0.34, 0],
    [0.34, 0.68, 0.012],
    [0.68, 0.88, 0.024],
    [0.88, 1, 0.036],
  ];
  const parts: BufferGeometry[] = [];
  for (const [y0, y1, inset] of tiers) {
    const ox = rx * (1 - inset);
    const oz = rz * (1 - inset);
    const ring = new Shape();
    ring.absellipse(0, 0, ox, oz, 0, Math.PI * 2, false, 0);
    const hole = new Path();
    hole.absellipse(0, 0, ox - thick, oz - thick, 0, Math.PI * 2, true, 0);
    ring.holes.push(hole);
    parts.push(new ExtrudeGeometry(ring, { depth: (y1 - y0) * H, bevelEnabled: false, curveSegments: 48 }).rotateX(-Math.PI / 2).translate(0, y0 * H, 0));
  }
  // arkadni stebri na zunanji strani
  const n = 72;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const px = rx * Math.cos(a);
    const pz = rz * Math.sin(a);
    const tang = Math.atan2(rz * Math.cos(a), -rx * Math.sin(a)); // smer tangente
    parts.push(box(2.2, H * 0.86, 1.2, 0, H * 0.43, 0).rotateY(-tang).translate(px, 0, pz));
  }
  return finish(parts, H);
}

export function cityGeometry(kind: CityKind, size: Size): BufferGeometry {
  if (kind === 'colosseum') return colosseum(size);
  if (kind === 'eiffel') return eiffel(size);
  if (kind === 'boat') return boat(size);
  if (kind === 'car' || kind === 'hatch' || kind === 'suv' || kind === 'van' || kind === 'bus') return vehicle(size, VEHICLES[kind]);
  if (kind === 'ferris') return ferris(size);
  return kind === 'townhouse' ? townhouse(size) : kind === 'block' ? block(size) : tower(size);
}
