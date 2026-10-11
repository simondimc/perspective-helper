import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { FrameGeometry, Projection, ProjectionKind, RadialProjection, RectilinearProjection, Vec3 } from './projection';

export type PerspectiveMode = '1pt' | '2pt' | '3pt';

export const ASPECTS: Record<string, number> = {
  '3:2': 3 / 2,
  '2:3': 2 / 3,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '1:1': 1,
  '16:9': 16 / 9,
  'A (ležeče)': Math.SQRT2,
  'A (pokončno)': 1 / Math.SQRT2,
};

/** Parametri kompozicijske kamere. Kamera je edini vir resnice za bežišča in horizont. */
export interface CameraParams {
  mode: PerspectiveMode;
  x: number;
  z: number;
  eyeHeight: number;
  /** Stopinje; pozitivno = zavrtitev v desno. 0 = pogled v smeri -Z. */
  yaw: number;
  /** Stopinje; pozitivno = pogled navzgor. */
  pitch: number;
  /** Stopinje. */
  roll: number;
  /** Goriščna razdalja v mm (35 mm ekvivalent). */
  focalMm: number;
  /** Navpični zamik leče kot delež višine kadra; pozitivno = kader se dvigne. */
  shiftY: number;
  aspect: string;
  projection: ProjectionKind;
}

export const DEFAULT_CAMERA: CameraParams = {
  mode: '3pt',
  x: 5,
  z: 7,
  eyeHeight: 2.6,
  yaw: -35,
  pitch: -15,
  roll: 0,
  focalMm: 35,
  shiftY: -0.15,
  aspect: '3:2',
  projection: 'rectilinear',
};

const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Predloga perspektive je omejitev na orientacijo kamere; vrne skladne parametre. */
export function constrain(p: CameraParams): CameraParams {
  const c = { ...p };
  c.eyeHeight = Math.max(0.05, c.eyeHeight);
  if (!['rectilinear', 'equidistant', 'stereographic', 'equirectangular'].includes(c.projection)) c.projection = 'rectilinear';
  c.focalMm = Math.min(300, Math.max(c.projection === 'rectilinear' ? 8 : 2, c.focalMm));
  c.yaw = wrap180(c.yaw);
  if (!(c.aspect in ASPECTS)) c.aspect = '3:2';
  if (c.mode === '1pt') {
    c.yaw = wrap180(Math.round(c.yaw / 90) * 90);
    c.pitch = 0;
    c.roll = 0;
  } else if (c.mode === '2pt') {
    c.pitch = 0;
    c.roll = 0;
  } else {
    c.shiftY = 0;
  }
  return c;
}

const rad = (d: number) => (d * Math.PI) / 180;

export function cameraQuaternion(p: CameraParams): Quaternion {
  const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -rad(p.yaw));
  const qx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rad(p.pitch));
  const qz = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rad(p.roll));
  return qy.multiply(qx).multiply(qz);
}

export function cameraPosition(p: CameraParams): Vector3 {
  return new Vector3(p.x, p.eyeHeight, p.z);
}

export function frameGeometry(p: CameraParams): FrameGeometry {
  const aspect = ASPECTS[p.aspect] ?? 1.5;
  const long = 36;
  const sensorW = aspect >= 1 ? long : long * aspect;
  const sensorH = aspect >= 1 ? long / aspect : long;
  return { sensorW, sensorH, focal: p.focalMm, shiftX: 0, shiftY: p.shiftY };
}

export function frameAspect(p: CameraParams): number {
  return ASPECTS[p.aspect] ?? 1.5;
}

export function createProjection(p: CameraParams): Projection {
  const f = frameGeometry(p);
  return p.projection === 'rectilinear' ? new RectilinearProjection(f) : new RadialProjection(p.projection, f);
}

/** Svetovna smer -> smer v prostoru kamere. */
export function worldToCameraDir(p: CameraParams, worldDir: Vector3): Vec3 {
  const v = worldDir.clone().applyQuaternion(cameraQuaternion(p).invert());
  return { x: v.x, y: v.y, z: v.z };
}

/** Three.js kamera, ki sledi parametrom (vključno z zamikom leče). */
export class CompositionCamera {
  readonly camera = new PerspectiveCamera(50, 1.5, 0.1, 3000);

  apply(p: CameraParams): void {
    const f = frameGeometry(p);
    const c = this.camera;
    c.fov = (2 * Math.atan(f.sensorH / (2 * f.focal)) * 180) / Math.PI;
    c.aspect = f.sensorW / f.sensorH;
    c.position.copy(cameraPosition(p));
    c.quaternion.copy(cameraQuaternion(p));
    c.updateProjectionMatrix();
    // zamik leče: ndc = P*x/(-z) - b
    c.projectionMatrix.elements[8] = 2 * f.shiftX;
    c.projectionMatrix.elements[9] = 2 * f.shiftY;
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
    c.updateMatrixWorld(true);
  }
}
