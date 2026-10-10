// Projekcijski modul: preslika 3D smer (v prostoru kamere, kamera gleda v -Z, X desno, Y gor)
// v 2D točko kadra. Vmesnik je neodvisen od implementacije, zato lahko kasneje dodamo
// ekvidistantno, stereografsko ali ekvirektangularno projekcijo.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Geometrija kadra: senzor v mm (35 mm ekvivalent), goriščna razdalja in zamik leče (delež velikosti kadra). */
export interface FrameGeometry {
  sensorW: number;
  sensorH: number;
  focal: number;
  shiftX: number;
  shiftY: number;
}

export type ProjectionKind = 'rectilinear' | 'equidistant' | 'stereographic' | 'equirectangular';

export const PROJECTION_LABELS: Record<ProjectionKind, string> = {
  rectilinear: 'Rektilinearna',
  equidistant: 'Ribje oko (ekvidistantna)',
  stereographic: 'Ribje oko (stereografska)',
  equirectangular: 'Ekvirektangularna',
};

export interface Projection {
  readonly kind: ProjectionKind;
  /** Smer v prostoru kamere -> točka v NDC kadra ([-1,1], Y gor) ali null, če smer ni upodobljena. */
  project(dir: Vec3): Vec2 | null;
  /** Točka v NDC kadra -> enotska smer v prostoru kamere ali null. */
  unproject(p: Vec2): Vec3 | null;
  /**
   * Smer slike premic, vzporednih z `dir`, ko je `dir` vzporedna z ravnino slike (bežišče v neskončnosti).
   * Izotropne enote (enake za X in Y), Y gor, enotski vektor.
   */
  infinityDirection(dir: Vec3): Vec2 | null;
}

const EPS = 1e-9;

export class RectilinearProjection implements Projection {
  readonly kind: ProjectionKind = 'rectilinear';

  constructor(readonly frame: FrameGeometry) {}

  project(d: Vec3): Vec2 | null {
    const len = Math.hypot(d.x, d.y, d.z);
    if (len === 0 || d.z > -EPS * len) return null;
    const { sensorW, sensorH, focal, shiftX, shiftY } = this.frame;
    const k = focal / -d.z;
    return {
      x: (k * d.x) / (sensorW / 2) - 2 * shiftX,
      y: (k * d.y) / (sensorH / 2) - 2 * shiftY,
    };
  }

  unproject(p: Vec2): Vec3 | null {
    const { sensorW, sensorH, focal, shiftX, shiftY } = this.frame;
    const x = ((p.x + 2 * shiftX) * (sensorW / 2)) / focal;
    const y = ((p.y + 2 * shiftY) * (sensorH / 2)) / focal;
    const len = Math.hypot(x, y, 1);
    return { x: x / len, y: y / len, z: -1 / len };
  }

  infinityDirection(d: Vec3): Vec2 | null {
    const len = Math.hypot(d.x, d.y);
    if (len < EPS) return null;
    return { x: d.x / len, y: d.y / len };
  }
}

/** Ribje oko in ekvirektangularna projekcija: vsaka smer ima sliko, zato ima premica dve nasprotni bežišči. */
export class RadialProjection implements Projection {
  constructor(readonly kind: Exclude<ProjectionKind, 'rectilinear'>, readonly frame: FrameGeometry) {}

  private radius(theta: number): number {
    const f = this.frame.focal;
    return this.kind === 'stereographic' ? 2 * f * Math.tan(theta / 2) : f * theta;
  }

  private theta(r: number): number {
    const f = this.frame.focal;
    return this.kind === 'stereographic' ? 2 * Math.atan(r / (2 * f)) : r / f;
  }

  project(d: Vec3): Vec2 | null {
    const len = Math.hypot(d.x, d.y, d.z);
    if (len === 0) return null;
    const { sensorW, sensorH, focal, shiftX, shiftY } = this.frame;
    const nx = d.x / len;
    const ny = d.y / len;
    const nz = d.z / len;
    let sx: number;
    let sy: number;
    if (this.kind === 'equirectangular') {
      sx = focal * Math.atan2(nx, -nz);
      sy = focal * Math.asin(Math.max(-1, Math.min(1, ny)));
    } else {
      const th = Math.acos(Math.max(-1, Math.min(1, -nz)));
      if (this.kind === 'stereographic' && th > Math.PI - 1e-6) return null;
      const r = this.radius(th);
      const phi = Math.atan2(ny, nx);
      sx = r * Math.cos(phi);
      sy = r * Math.sin(phi);
    }
    return { x: sx / (sensorW / 2) - 2 * shiftX, y: sy / (sensorH / 2) - 2 * shiftY };
  }

  unproject(p: Vec2): Vec3 | null {
    const { sensorW, sensorH, focal, shiftX, shiftY } = this.frame;
    const sx = (p.x + 2 * shiftX) * (sensorW / 2);
    const sy = (p.y + 2 * shiftY) * (sensorH / 2);
    if (this.kind === 'equirectangular') {
      const lon = sx / focal;
      const lat = sy / focal;
      if (Math.abs(lat) > Math.PI / 2 || Math.abs(lon) > Math.PI) return null;
      return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: -Math.cos(lat) * Math.cos(lon) };
    }
    const th = this.theta(Math.hypot(sx, sy));
    if (th > Math.PI) return null;
    const phi = Math.atan2(sy, sx);
    return { x: Math.sin(th) * Math.cos(phi), y: Math.sin(th) * Math.sin(phi), z: -Math.cos(th) };
  }

  infinityDirection(): Vec2 | null {
    return null;
  }
}

export interface VanishingPoint {
  /** Točka v NDC; null, če je bežišče v neskončnosti. */
  point: Vec2 | null;
  /** Smer proti bežišču v neskončnosti (izotropno, Y gor); null, če je bežišče končno. */
  infinity: Vec2 | null;
}

const FAR_NDC = 1e6;

/**
 * Bežišča premic s smerjo `dir` (v prostoru kamere). Premica ima dve nasprotni smeri: pri rektilinearni
 * projekciji se upodobi le tista pred kamero, pri ribjem očesu obe.
 */
export function vanishingPoints(proj: Projection, dir: Vec3): VanishingPoint[] {
  const out: VanishingPoint[] = [];
  for (const d of [dir, { x: -dir.x, y: -dir.y, z: -dir.z }]) {
    const p = proj.project(d);
    if (p && Math.hypot(p.x, p.y) < FAR_NDC) out.push({ point: p, infinity: null });
  }
  if (!out.length) {
    const inf = proj.infinityDirection(dir);
    if (inf) out.push({ point: null, infinity: inf });
  }
  return out;
}

export function vanishingPoint(proj: Projection, dir: Vec3): VanishingPoint {
  return vanishingPoints(proj, dir)[0] ?? { point: null, infinity: null };
}
