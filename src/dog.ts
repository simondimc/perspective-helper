import { BufferGeometry, CylinderGeometry, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Pes iz primitivov (elipsoidi in valji). Gleda v +Z, stoji na tleh (y = 0), širina po X.

function parts(seg: number): BufferGeometry[] {
  const hi = seg;
  const lo = Math.max(6, Math.round(seg * 0.7));
  const ell = (rx: number, ry: number, rz: number, x: number, y: number, z: number) => new SphereGeometry(1, hi, lo).scale(rx, ry, rz).translate(x, y, z);
  const p: BufferGeometry[] = [
    ell(0.12, 0.15, 0.3, 0, 0.42, 0), // trup
    ell(0.13, 0.17, 0.14, 0, 0.45, 0.2), // prsni koš
    ell(0.12, 0.15, 0.14, 0, 0.41, -0.2), // zadnji del
    ell(0.075, 0.1, 0.11, 0, 0.56, 0.34), // vrat
    ell(0.085, 0.085, 0.1, 0, 0.64, 0.45), // glava
    ell(0.045, 0.04, 0.085, 0, 0.6, 0.56), // gobec
    ell(0.022, 0.06, 0.04, 0.065, 0.67, 0.42), // levo uho
    ell(0.022, 0.06, 0.04, -0.065, 0.67, 0.42), // desno uho
  ];
  for (const x of [-0.075, 0.075]) {
    for (const z of [0.2, -0.2]) {
      p.push(new CylinderGeometry(0.035, 0.026, 0.38, Math.max(8, seg)).translate(x, 0.2, z));
      p.push(ell(0.035, 0.025, 0.05, x, 0.025, z + 0.02));
    }
  }
  // rep: valj, nagnjen nazaj in navzgor
  p.push(new CylinderGeometry(0.016, 0.022, 0.32, Math.max(8, seg)).rotateX(-0.9).translate(0, 0.55, -0.36));
  return p;
}

function raw(seg: number): BufferGeometry {
  return mergeGeometries(parts(seg))!;
}

const rest = raw(24);
rest.computeBoundingBox();
/** Okvir psa v mirovanju: središče in velikost, na katera se pri `size` normalizira. */
export const DOG_CENTER = rest.boundingBox!.getCenter(new Vector3());
export const DOG_SIZE = rest.boundingBox!.getSize(new Vector3());
rest.dispose();

/** Geometrija psa, skalirana na `size`; `lowPoly` je groba različica za prikaz robov. */
export function dogGeometry(size: [number, number, number], lowPoly = false): BufferGeometry {
  const g = raw(lowPoly ? 10 : 24);
  g.translate(-DOG_CENTER.x, -DOG_CENTER.y, -DOG_CENTER.z);
  return g.scale(size[0] / DOG_SIZE.x, size[1] / DOG_SIZE.y, size[2] / DOG_SIZE.z);
}
