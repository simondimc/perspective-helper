import { Vector3 } from 'three';
import { CameraParams, createProjection, frameGeometry, worldToCameraDir } from './camera';
import { GuideSettings } from './guides';
import { Vec2, vanishingPoints } from './projection';

// Vlečenje bežišč in horizonta: iz položaja kazalca izračuna nove parametre kamere.
// Velja za rektilinearno projekcijo; 2-točkovno bežišči X in Z ležita na horizontu, pri katerem
// velja x_X · x_Z = −f² (v mm na senzorju), zato sta goriščna razdalja in yaw določena z obema bežiščema.

export type HandleKind = { type: 'horizon' } | { type: 'vp'; axis: 'x' | 'y' | 'z' };

const AXES = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Katere osi je pri predlogi mogoče vleči. */
export function draggableAxes(mode: CameraParams['mode']): Array<'x' | 'y' | 'z'> {
  return mode === '1pt' ? ['z'] : mode === '2pt' ? ['x', 'z'] : ['x', 'z', 'y'];
}

/** Končna bežišča (v NDC) osi `axis`. */
function vpNdc(c: CameraParams, axis: 'x' | 'y' | 'z'): Vec2[] {
  const proj = createProjection(c);
  return vanishingPoints(proj, worldToCameraDir(c, AXES[axis]))
    .map((v) => v.point)
    .filter((p): p is Vec2 => !!p);
}

/** Najde ročaj pod kazalcem (piksli kadra). Bežišča imajo prednost pred horizontom. */
export function hitTest(c: CameraParams, g: GuideSettings, w: number, h: number, px: Vec2, radius = 14): HandleKind | null {
  if (c.projection !== 'rectilinear') return null;
  const enabled = { x: g.vpX, y: g.vpY, z: g.vpZ };
  for (const axis of draggableAxes(c.mode)) {
    if (!enabled[axis]) continue;
    for (const p of vpNdc(c, axis)) {
      const x = ((p.x + 1) / 2) * w;
      const y = ((1 - p.y) / 2) * h;
      if (Math.hypot(x - px.x, y - px.y) <= radius) return { type: 'vp', axis };
    }
  }
  if (g.horizon) {
    // horizont je premica a·x + b·y + c = 0 v NDC (linearna oblika smeri "gor")
    const f = frameGeometry(c);
    const up = worldToCameraDir(c, new Vector3(0, 1, 0));
    const a = (up.x * f.sensorW) / (2 * f.focal);
    const b = (up.y * f.sensorH) / (2 * f.focal);
    const k = a * 2 * f.shiftX + b * 2 * f.shiftY - up.z;
    const n = { x: (px.x / w) * 2 - 1, y: 1 - (px.y / h) * 2 };
    const grad = Math.hypot((a * 2) / w, (b * 2) / h);
    if (grad > 1e-12 && Math.abs(a * n.x + b * n.y + k) / grad <= radius * 0.7) return { type: 'horizon' };
  }
  return null;
}

/** Nove parametre kamere, ko kazalec (NDC kadra) povleče ročaj. `keepFocal`: goriščna razdalja ostane. */
export function applyDrag(c: CameraParams, kind: HandleKind, ndc: Vec2, keepFocal: boolean): CameraParams {
  const g = frameGeometry(c);
  const sx = (ndc.x * g.sensorW) / 2;
  const sy = (ndc.y * g.sensorH) / 2;
  const out = { ...c };

  if (kind.type === 'horizon' || (kind.type === 'vp' && c.mode === '1pt')) {
    if (c.mode !== '3pt') {
      out.shiftY = clamp(-ndc.y / 2, -1, 1);
    } else {
      const r = rad(c.roll);
      const delta = sx * Math.sin(r) + sy * Math.cos(r);
      out.pitch = clamp(deg(Math.atan(-delta / c.focalMm)), -89, 89);
    }
    return out;
  }
  if (kind.type !== 'vp') return out;

  if (kind.axis === 'y') {
    // navpično bežišče leži na osi (sin r, cos r) skozi središče; položaj določa pitch, smer roll
    const r1 = Math.atan2(sx, sy);
    const r2 = r1 + Math.PI;
    const cur = rad(c.roll);
    const diff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const r = diff(r1, cur) <= diff(r2, cur) ? r1 : r2;
    const yp = sx * Math.sin(r) + sy * Math.cos(r);
    out.roll = clamp(wrap180(deg(r)), -180, 180);
    out.pitch = clamp(deg(Math.atan(c.focalMm / yp)), -89, 89);
    return out;
  }

  if (c.mode === '2pt') {
    // bežišči sta na horizontu: navpični položaj vlečenega bežišča premakne horizont (lens shift)
    out.shiftY = clamp(-ndc.y / 2, -1, 1);
    const f0 = c.focalMm;
    const psi = rad(c.yaw);
    const xz = -f0 * Math.tan(psi); // bežišče Z
    const xx = f0 / Math.tan(psi); // bežišče X
    let f = f0;
    if (!keepFocal && Math.abs(sx) > 1e-6) {
      const other = kind.axis === 'z' ? xx : xz;
      if (sx * other < 0 && isFinite(other)) f = clamp(Math.sqrt(-sx * other), 8, 300);
    }
    let yawNew = kind.axis === 'z' ? -Math.atan(sx / f) : Math.atan2(f, sx);
    // smer ali nasprotna smer: izberi bližjo trenutni
    const near = (a: number) => {
      let best = a;
      for (const cand of [a, a + Math.PI, a - Math.PI]) {
        if (Math.abs(Math.atan2(Math.sin(cand - psi), Math.cos(cand - psi))) < Math.abs(Math.atan2(Math.sin(best - psi), Math.cos(best - psi)))) best = cand;
      }
      return best;
    };
    yawNew = near(yawNew);
    out.focalMm = f;
    out.yaw = wrap180(deg(yawNew));
    return out;
  }

  // 3-točkovna: numerično poišči yaw, pri katerem je bežišče najbližje kazalcu
  const dist = (yaw: number) => {
    const t = { ...c, yaw };
    let best = Infinity;
    for (const p of vpNdc(t, kind.axis)) best = Math.min(best, Math.hypot((p.x - ndc.x) * g.sensorW, (p.y - ndc.y) * g.sensorH));
    return best;
  };
  let bestYaw = c.yaw;
  let bestD = dist(c.yaw);
  for (let y = -180; y < 180; y += 1) {
    const d = dist(y);
    if (d < bestD) (bestD = d), (bestYaw = y);
  }
  const center = bestYaw;
  for (let y = center - 1; y <= center + 1; y += 0.02) {
    const d = dist(y);
    if (d < bestD) (bestD = d), (bestYaw = y);
  }
  out.yaw = wrap180(bestYaw);
  return out;
}
