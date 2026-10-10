import { BufferGeometry, CylinderGeometry, BoxGeometry, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Konj iz primitivov (elipsoidi, valji). Gleda v +Z, stoji na tleh (y = 0), širina po X.

function parts(seg: number): BufferGeometry[] {
  const hi = seg;
  const lo = Math.max(6, Math.round(seg * 0.7));
  const cs = Math.max(8, seg);
  const ell = (rx: number, ry: number, rz: number) => new SphereGeometry(1, hi, lo).scale(rx, ry, rz);
  const p: BufferGeometry[] = [
    ell(0.3, 0.36, 0.62).translate(0, 1.2, 0), // trup
    ell(0.28, 0.4, 0.3).translate(0, 1.2, 0.45), // prsi
    ell(0.3, 0.38, 0.35).translate(0, 1.2, -0.5), // zadnjica
    new CylinderGeometry(0.1, 0.17, 0.85, cs).rotateX(0.7).translate(0, 1.68, 0.92), // vrat
    ell(0.09, 0.12, 0.3).rotateX(0.6).translate(0, 1.98, 1.2), // glava
    ell(0.07, 0.08, 0.12).rotateX(0.7).translate(0, 1.8, 1.42), // gobec
    ell(0.03, 0.08, 0.03).translate(0.06, 2.12, 1.03), // levo uho
    ell(0.03, 0.08, 0.03).translate(-0.06, 2.12, 1.03), // desno uho
    new CylinderGeometry(0.04, 0.02, 0.7, cs).rotateX(0.2).translate(0, 1.15, -0.93), // rep
  ];
  for (const x of [-0.14, 0.14]) {
    p.push(new CylinderGeometry(0.075, 0.05, 0.5, cs).translate(x, 0.95, 0.45)); // sprednja noga zgoraj
    p.push(new CylinderGeometry(0.045, 0.04, 0.55, cs).translate(x, 0.3, 0.45)); // spodaj
    p.push(new BoxGeometry(0.1, 0.1, 0.12).translate(x, 0.05, 0.46)); // kopito
  }
  for (const x of [-0.17, 0.17]) {
    p.push(ell(0.12, 0.3, 0.2).translate(x, 1.0, -0.55)); // stegno
    p.push(new CylinderGeometry(0.05, 0.04, 0.6, cs).translate(x, 0.3, -0.55)); // spodnji del
    p.push(new BoxGeometry(0.1, 0.1, 0.12).translate(x, 0.05, -0.54)); // kopito
  }
  return p;
}

function raw(seg: number): BufferGeometry {
  return mergeGeometries(parts(seg))!;
}

const rest = raw(24);
rest.computeBoundingBox();
export const HORSE_CENTER = rest.boundingBox!.getCenter(new Vector3());
export const HORSE_SIZE = rest.boundingBox!.getSize(new Vector3());
rest.dispose();

/** Geometrija konja, skalirana na `size`; `lowPoly` je groba različica za prikaz robov. */
export function horseGeometry(size: [number, number, number], lowPoly = false): BufferGeometry {
  const g = raw(lowPoly ? 10 : 24);
  g.translate(-HORSE_CENTER.x, -HORSE_CENTER.y, -HORSE_CENTER.z);
  return g.scale(size[0] / HORSE_SIZE.x, size[1] / HORSE_SIZE.y, size[2] / HORSE_SIZE.z);
}
