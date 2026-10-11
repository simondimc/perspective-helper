import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Okolje za vas: cesta, drevesa, grmi, dvorišče. Središče geometrije je v sredini omejevalnega okvirja (W × H × D).

type Size = [number, number, number];
export type NatureKind = 'road' | 'tree' | 'pine' | 'bush' | 'yard';
export const NATURE_KINDS: NatureKind[] = ['road', 'tree', 'pine', 'bush', 'yard'];

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

export function natureGeometry(kind: NatureKind, size: Size): BufferGeometry {
  switch (kind) {
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
  }
}
