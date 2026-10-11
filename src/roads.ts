import { BufferAttribute, BufferGeometry } from 'three';

/** Omrežje cest: vsaka pot je črta (x, y, z, x, y, z, …) s širino w; iz nje nastane trak, ki sledi terenu (y je že višina). */
export interface RoadPath {
  w: number;
  p: number[];
}

export function roadsGeometry(paths: RoadPath[]): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const { w, p } of paths) {
    const n = Math.floor(p.length / 3);
    if (n < 2) continue;
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      let tx = p[b * 3] - p[a * 3];
      let tz = p[b * 3 + 2] - p[a * 3 + 2];
      const len = Math.hypot(tx, tz) || 1;
      tx /= len;
      tz /= len;
      const nx = -tz * (w / 2);
      const nz = tx * (w / 2);
      pos.push(p[i * 3] + nx, p[i * 3 + 1], p[i * 3 + 2] + nz, p[i * 3] - nx, p[i * 3 + 1], p[i * 3 + 2] - nz);
    }
    for (let i = 0; i < n - 1; i++) {
      const l0 = base + i * 2;
      const r0 = l0 + 1;
      const l1 = l0 + 2;
      const r1 = l0 + 3;
      idx.push(l0, l1, r0, r0, l1, r1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
