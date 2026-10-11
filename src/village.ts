import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry, LatheGeometry, Shape, SphereGeometry, Vector2 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Okolje za vas: cesta, drevesa, grmi, dvorišče. Središče geometrije je v sredini omejevalnega okvirja (W × H × D).

type Size = [number, number, number];
export type NatureKind = 'terrain' | 'road' | 'tree' | 'pine' | 'bush' | 'yard' | 'river' | 'bridge' | 'hill' | 'hayrack';
export const NATURE_KINDS: NatureKind[] = ['terrain', 'road', 'tree', 'pine', 'bush', 'yard', 'river', 'bridge', 'hill', 'hayrack'];

const box = (w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry => new BoxGeometry(w, h, d).translate(x, y, z);
const ell = (rx: number, ry: number, rz: number, x: number, y: number, z: number): BufferGeometry => new SphereGeometry(1, 24, 16).scale(rx, ry, rz).translate(x, y, z);
const cyl = (rt: number, rb: number, h: number, y: number): BufferGeometry => new CylinderGeometry(rt, rb, h, 16).translate(0, y, 0);
const finish = (parts: BufferGeometry[], H: number): BufferGeometry => mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!.translate(0, -H / 2, 0);

/** Cesta: ravna plošča s prekinjeno sredinsko črto (dolžina vzdolž Z). */
function road([W, H, D]: Size): BufferGeometry {
  const parts: BufferGeometry[] = [box(W, H * 0.7, D, 0, H * 0.35, 0)];
  const n = Math.max(1, Math.floor(D / 4));
  const len = Math.min(2, (D / n) * 0.5);
  const lw = Math.min(0.15, W * 0.04);
  for (let i = 0; i < n; i++) parts.push(box(lw, H * 0.3, len, 0, H * 0.85, -D / 2 + (D / n) * (i + 0.5)));
  return finish(parts, H);
}

/** Listavec: deblo in krošnja iz treh elipsoidov. */
function tree([W, H, D]: Size): BufferGeometry {
  const trunkH = H * 0.4;
  const crownY = H * 0.68;
  return finish([
    cyl(W * 0.05, W * 0.08, trunkH, trunkH / 2),
    ell(W * 0.5, H * 0.32, D * 0.5, 0, crownY, 0),
    ell(W * 0.36, H * 0.2, D * 0.36, W * 0.12, H * 0.84, D * 0.08),
    ell(W * 0.34, H * 0.2, D * 0.34, -W * 0.14, H * 0.8, -D * 0.1),
  ], H);
}

/** Smreka: deblo in tri zloženi stožci. */
function pine([W, H, D]: Size): BufferGeometry {
  const parts: BufferGeometry[] = [cyl(W * 0.05, W * 0.07, H * 0.15, H * 0.075)];
  const layers = [[0.5, 0.45, 0.12], [0.38, 0.42, 0.34], [0.26, 0.4, 0.56]];
  for (const [r, h, y] of layers) parts.push(new ConeGeometry(0.5, 1, 20).scale(W * r * 2, H * h, D * r * 2).translate(0, H * (y + h / 2), 0));
  return finish(parts, H);
}

/** Grm: nizka skupina elipsoidov. */
function bush([W, H, D]: Size): BufferGeometry {
  return finish([
    ell(W * 0.32, H * 0.5, D * 0.32, 0, H * 0.5, 0),
    ell(W * 0.26, H * 0.4, D * 0.26, W * 0.24, H * 0.4, D * 0.1),
    ell(W * 0.25, H * 0.38, D * 0.25, -W * 0.22, H * 0.38, -D * 0.12),
    ell(W * 0.22, H * 0.34, D * 0.22, W * 0.02, H * 0.34, -D * 0.28),
  ], H);
}

/** Dvorišče: tlakovana ploščad z ograjo na treh straneh; spredaj (+Z) je odprto. */
function yard([W, H, D]: Size): BufferGeometry {
  const slab = Math.min(0.05, H * 0.1);
  const post = Math.min(0.1, W * 0.02);
  const fenceH = H - slab;
  const parts: BufferGeometry[] = [box(W, slab, D, 0, slab / 2, 0)];
  const run = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 1.2));
    const horiz = Math.abs(z1 - z0) < 1e-6;
    for (let i = 0; i <= n; i++) parts.push(box(post, fenceH, post, x0 + ((x1 - x0) * i) / n, slab + fenceH / 2, z0 + ((z1 - z0) * i) / n));
    for (const f of [0.35, 0.8]) {
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      parts.push(horiz ? box(len, post * 0.5, post * 0.5, cx, slab + fenceH * f, cz) : box(post * 0.5, post * 0.5, len, cx, slab + fenceH * f, cz));
    }
  };
  const x = W / 2 - post / 2;
  const z = D / 2 - post / 2;
  run(-x, -z, x, -z);
  run(-x, -z, -x, z);
  run(x, -z, x, z);
  return finish(parts, H);
}

/** Reka (dolžina vzdolž Z): dno in dva nabrežna zidova višine H; pri nizki H (jezero) samo plošča. */
function river([W, H, D]: Size): BufferGeometry {
  const bed = Math.min(0.05, H * 0.2);
  const parts: BufferGeometry[] = [box(W, bed, D, 0, bed / 2, 0)];
  if (H > 0.3) {
    const wall = Math.min(0.8, W * 0.06);
    for (const sx of [-1, 1]) parts.push(box(wall, H, D, sx * (W / 2 - wall / 2), H / 2, 0));
  }
  return finish(parts, H);
}

/** Most (dolžina vzdolž X, širina vozišča vzdolž Z): krov, ograja in oporniki. Vrh krova je 1 m pod višino H. */
function bridge([W, H, D]: Size): BufferGeometry {
  const rail = Math.min(1, H * 0.4);
  const deckT = Math.min(0.8, H * 0.3);
  const deckTop = H - rail;
  const parts: BufferGeometry[] = [box(W, deckT, D, 0, deckTop - deckT / 2, 0)];
  for (const sz of [-1, 1]) parts.push(box(W, rail, Math.min(0.4, D * 0.1), 0, H - rail / 2, sz * (D / 2 - Math.min(0.4, D * 0.1) / 2)));
  const piers = Math.max(2, Math.floor(W / 14));
  for (let i = 0; i <= piers; i++) if (i > 0 && i < piers) parts.push(box(Math.min(1.5, D * 0.2), deckTop - deckT, D * 0.8, -W / 2 + (W * i) / piers, (deckTop - deckT) / 2, 0));
  return finish(parts, H);
}

/** Hrib: zaobljena kupola (parabolični profil). */
function hill([W, H, D]: Size): BufferGeometry {
  const prof: Vector2[] = [new Vector2(0.5, 0)];
  for (let i = 0; i <= 20; i++) {
    const rr = 1 - i / 20; // normiran polmer 1 → 0
    prof.push(new Vector2(rr * 0.5, H * (1 - rr * rr)));
  }
  return new LatheGeometry(prof, 32).scale(W, 1, D);
}

/** Kozolec: lesen okvir z letvami in nizko dvokapno streho (dolžina vzdolž X). */
function hayrack([W, H, D]: Size): BufferGeometry {
  const post = Math.min(0.2, D * 0.08);
  const roofH = H * 0.28;
  const wallH = H - roofH;
  const parts: BufferGeometry[] = [];
  const posts = Math.max(2, Math.round(W / 2.5));
  for (let i = 0; i <= posts; i++) for (const sz of [-1, 1]) parts.push(box(post, wallH, post, -W / 2 + (W * i) / posts, wallH / 2, sz * (D / 2 - post / 2)));
  for (const f of [0.15, 0.5, 0.85]) for (const sz of [-1, 1]) parts.push(box(W, post * 0.5, post * 0.5, 0, wallH * f, sz * (D / 2 - post / 2)));
  const slats = Math.round(W / 0.35);
  for (let i = 0; i < slats; i++) for (const sz of [-1, 1]) parts.push(box(post * 0.35, wallH * 0.75, post * 0.35, -W / 2 + (W * (i + 0.5)) / slats, wallH * 0.52, sz * (D / 2 - post / 2)));
  const shape = new Shape();
  shape.moveTo(-D / 2 - 0.2, wallH);
  shape.lineTo(D / 2 + 0.2, wallH);
  shape.lineTo(0, H);
  shape.closePath();
  parts.push(new ExtrudeGeometry(shape, { depth: W, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(W / 2, 0, 0));
  return finish(parts, H);
}

export function natureGeometry(kind: NatureKind, size: Size): BufferGeometry {
  switch (kind) {
    case 'terrain':
      return new BoxGeometry(1, 1, 1); // pokrajina se zgradi v objects.ts (terrain.ts)
    case 'road':
      return road(size);
    case 'tree':
      return tree(size);
    case 'pine':
      return pine(size);
    case 'bush':
      return bush(size);
    case 'yard':
      return yard(size);
    case 'river':
      return river(size);
    case 'bridge':
      return bridge(size);
    case 'hill':
      return hill(size);
    case 'hayrack':
      return hayrack(size);
  }
}
