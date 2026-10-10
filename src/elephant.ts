import { BufferGeometry, CylinderGeometry, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Slon iz primitivov (elipsoidi, valji). Gleda v +Z, stoji na tleh (y = 0), širina po X.

function parts(seg: number): BufferGeometry[] {
  const hi = seg;
  const lo = Math.max(6, Math.round(seg * 0.7));
  const cs = Math.max(8, seg);
  const ell = (rx: number, ry: number, rz: number) => new SphereGeometry(1, hi, lo).scale(rx, ry, rz);
  const p: BufferGeometry[] = [
    ell(0.9, 1.0, 1.5).translate(0, 2.0, 0), // trup
    ell(0.85, 0.95, 0.9).translate(0, 2.0, -1.1), // zadnji del
    ell(0.85, 1.0, 0.8).translate(0, 2.1, 0.9), // ramena
    ell(0.5, 0.65, 0.6).translate(0, 2.5, 2.0), // glava
    ell(0.42, 0.42, 0.36).translate(0, 3.0, 1.85), // čelo
    new CylinderGeometry(0.04, 0.015, 0.9, cs).rotateX(1.3).translate(0.32, 2.2, 2.7), // levi okel
    new CylinderGeometry(0.04, 0.015, 0.9, cs).rotateX(1.3).translate(-0.32, 2.2, 2.7), // desni okel
    ell(0.05, 0.5, 0.45).rotateY(0.35).translate(0.65, 2.75, 1.65), // levo uho
    ell(0.05, 0.5, 0.45).rotateY(-0.35).translate(-0.65, 2.75, 1.65), // desno uho
    new CylinderGeometry(0.04, 0.02, 0.9, cs).rotateX(0.15).translate(0, 1.55, -2.0), // rep
  ];
  // rilec: veriga valjev, ki se proti koncu usmeri naprej
  let pos = new Vector3(0, 2.4, 2.45);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const phi = 0.1 + (0.95 * i) / (n - 1);
    const d = new Vector3(0, -Math.cos(phi), Math.sin(phi));
    const len = 0.4;
    const r0 = 0.22 - (0.14 * i) / n;
    const r1 = 0.22 - (0.14 * (i + 1)) / n;
    const mid = pos.clone().addScaledVector(d, len / 2);
    p.push(new CylinderGeometry(r0, r1, len, cs).rotateX(-phi).translate(mid.x, mid.y, mid.z));
    pos = pos.addScaledVector(d, len * 0.95);
  }
  for (const x of [-0.5, 0.5]) {
    for (const z of [0.95, -1.1]) {
      p.push(new CylinderGeometry(0.3, 0.26, 1.5, cs).translate(x, 0.75, z)); // noga
      p.push(new CylinderGeometry(0.31, 0.31, 0.15, cs).translate(x, 0.075, z)); // stopalo
    }
  }
  return p;
}

function raw(seg: number): BufferGeometry {
  return mergeGeometries(parts(seg))!;
}

const rest = raw(24);
rest.computeBoundingBox();
export const ELEPHANT_CENTER = rest.boundingBox!.getCenter(new Vector3());
export const ELEPHANT_SIZE = rest.boundingBox!.getSize(new Vector3());
rest.dispose();

/** Geometrija slona, skalirana na `size`; `lowPoly` je groba različica za prikaz robov. */
export function elephantGeometry(size: [number, number, number], lowPoly = false): BufferGeometry {
  const g = raw(lowPoly ? 10 : 24);
  g.translate(-ELEPHANT_CENTER.x, -ELEPHANT_CENTER.y, -ELEPHANT_CENTER.z);
  return g.scale(size[0] / ELEPHANT_SIZE.x, size[1] / ELEPHANT_SIZE.y, size[2] / ELEPHANT_SIZE.z);
}
