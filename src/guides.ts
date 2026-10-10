import { Vector3 } from 'three';
import { CameraParams, cameraPosition, cameraQuaternion, createProjection } from './camera';
import { Projection, Vec2, Vec3, vanishingPoints } from './projection';

export interface GuideSettings {
  horizon: boolean;
  vpX: boolean;
  vpY: boolean;
  vpZ: boolean;
  fan: boolean;
  fanDensity: number;
  objectVps: boolean;
  objectFan: boolean;
  /** Oznake bežišč: X/Y/Z ali A/B/C (A = X, B = Z, C = Y, kot na skicah). */
  labels: 'xyz' | 'abc';
  /** Ob bežišču izpiši goriščno razdaljo. */
  showFocal: boolean;
  /** Rdeč okvir (orientirana kocka) okoli objektov. */
  boxes: boolean;
}

export const DEFAULT_GUIDES: GuideSettings = {
  horizon: true,
  vpX: true,
  vpY: true,
  vpZ: true,
  fan: true,
  fanDensity: 12,
  objectVps: true,
  objectFan: false,
  labels: 'xyz',
  showFocal: false,
  boxes: false,
};

const COLORS = { x: '#e5484d', y: '#2fa84f', z: '#3e7bfa', horizon: '#ff2d95', object: '#ff9f1c', box: '#d7263d' };

interface Px {
  x: number;
  y: number;
}

/** NDC (Y gor) -> piksli kadra (Y dol). */
const toPx = (p: Vec2, w: number, h: number): Px => ({ x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h });

type Seg = [number, number, number, number];

/** Območje risanja v pikslih kadra (lahko presega kader: "papir" okoli slike). */
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const rectCorners = (R: Rect): Array<[number, number]> => [[R.x0, R.y0], [R.x1, R.y0], [R.x0, R.y1], [R.x1, R.y1]];

/** Liang–Barsky: neskončna premica skozi (px,py) s smerjo (dx,dy), odrezana na kader. */
function clipLine(px: number, py: number, dx: number, dy: number, R: Rect): Seg | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  const edges: Array<[number, number]> = [
    [-dx, px - R.x0],
    [dx, R.x1 - px],
    [-dy, py - R.y0],
    [dy, R.y1 - py],
  ];
  for (const [p, q] of edges) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
  }
  if (!(t0 < t1) || !isFinite(t0) || !isFinite(t1)) return null;
  return [px + dx * t0, py + dy * t0, px + dx * t1, py + dy * t1];
}

/** Snop črt iz končnega bežišča P (v pikslih). */
function fanFromPoint(P: Px, n: number, R: Rect): Seg[] {
  const out: Seg[] = [];
  const inside = P.x >= R.x0 && P.x <= R.x1 && P.y >= R.y0 && P.y <= R.y1;
  let angles: number[] = [];
  if (inside) {
    for (let i = 0; i < n; i++) angles.push((i * Math.PI) / n);
  } else {
    const a0 = Math.atan2((R.y0 + R.y1) / 2 - P.y, (R.x0 + R.x1) / 2 - P.x);
    let lo = 0;
    let hi = 0;
    for (const [cx, cy] of rectCorners(R)) {
      let d = Math.atan2(cy - P.y, cx - P.x) - a0;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
    angles = [];
    for (let i = 0; i < n; i++) angles.push(a0 + lo + ((i + 0.5) / n) * (hi - lo));
  }
  for (const a of angles) {
    const s = clipLine(P.x, P.y, Math.cos(a), Math.sin(a), R);
    if (s) out.push(s);
  }
  return out;
}

/** Vzporedne črte za bežišče v neskončnosti; u je enotska smer v pikslih. */
function fanParallel(u: Px, n: number, R: Rect): Seg[] {
  const cx0 = (R.x0 + R.x1) / 2;
  const cy0 = (R.y0 + R.y1) / 2;
  const nx = -u.y;
  const ny = u.x;
  const cs = rectCorners(R).map(([x, y]) => (x - cx0) * nx + (y - cy0) * ny);
  const lo = Math.min(...cs);
  const hi = Math.max(...cs);
  const out: Seg[] = [];
  for (let i = 0; i < n; i++) {
    const s = lo + ((i + 0.5) / n) * (hi - lo);
    const seg = clipLine(cx0 + nx * s, cy0 + ny * s, u.x, u.y, R);
    if (seg) out.push(seg);
  }
  return out;
}

function strokeSegs(ctx: CanvasRenderingContext2D, segs: Seg[]): void {
  ctx.beginPath();
  for (const [a, b, c, d] of segs) {
    ctx.moveTo(a, b);
    ctx.lineTo(c, d);
  }
  ctx.stroke();
}

/** Točke, kjer horizont (smeri z y=0) prečka rob kadra; iščemo spremembe predznaka vzdolž oboda. */
function horizonSegment(proj: Projection, upCam: Vector3, w: number, h: number, R: Rect): { seg: Seg | null; above: boolean } {
  const g = (x: number, y: number): number | null => {
    const d = proj.unproject({ x: (x / w) * 2 - 1, y: 1 - (y / h) * 2 });
    return d ? upCam.x * d.x + upCam.y * d.y + upCam.z * d.z : null;
  };
  const corners: Array<[number, number]> = [[R.x0, R.y0], [R.x1, R.y0], [R.x1, R.y1], [R.x0, R.y1]];
  const hits: Px[] = [];
  const steps = 200;
  for (let e = 0; e < 4; e++) {
    const [x0, y0] = corners[e];
    const [x1, y1] = corners[(e + 1) % 4];
    let prev = g(x0, y0);
    let pt = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cur = g(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      if (prev !== null && cur !== null && prev * cur < 0) {
        let a = pt;
        let b = t;
        let ga = prev;
        for (let k = 0; k < 30; k++) {
          const m = (a + b) / 2;
          const gm = g(x0 + (x1 - x0) * m, y0 + (y1 - y0) * m) ?? 0;
          if (ga * gm <= 0) b = m;
          else {
            a = m;
            ga = gm;
          }
        }
        const m = (a + b) / 2;
        hits.push({ x: x0 + (x1 - x0) * m, y: y0 + (y1 - y0) * m });
      }
      prev = cur;
      pt = t;
    }
  }
  if (hits.length >= 2) return { seg: [hits[0].x, hits[0].y, hits[hits.length - 1].x, hits[hits.length - 1].y], above: false };
  return { seg: null, above: (g(w / 2, h / 2) ?? 0) > 0 };
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x + ux * size, y + uy * size);
  ctx.lineTo(x - ux * size * 0.6 - uy * size * 0.7, y - uy * size * 0.6 + ux * size * 0.7);
  ctx.lineTo(x - ux * size * 0.6 + uy * size * 0.7, y - uy * size * 0.6 - ux * size * 0.7);
  ctx.closePath();
  ctx.fill();
}

/** Pozicija na robu kadra (zamaknjena navznoter) v smeri (ux,uy) iz središča. */
function edgePoint(ux: number, uy: number, R: Rect, margin: number): Px {
  const hw = (R.x1 - R.x0) / 2;
  const hh = (R.y1 - R.y0) / 2;
  const tx = Math.abs(ux) > 1e-9 ? (hw - margin) / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-9 ? (hh - margin) / Math.abs(uy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: (R.x0 + R.x1) / 2 + ux * t, y: (R.y0 + R.y1) / 2 + uy * t };
}

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/** Poljuben vektor, pravokoten na `a`. */
function perpendicular(a: Vec3): Vec3 {
  const t = Math.abs(a.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  return norm(cross(a, t));
}

/** Velik krog s ploskvijo, ki ima normalo n: t -> smer. */
function greatCircle(n: Vec3): (t: number) => Vec3 {
  const a = perpendicular(n);
  const b = cross(n, a);
  return (t) => ({
    x: Math.cos(t) * a.x + Math.sin(t) * b.x,
    y: Math.cos(t) * a.y + Math.sin(t) * b.y,
    z: Math.cos(t) * a.z + Math.sin(t) * b.z,
  });
}

/**
 * Vzorči krivuljo (t v [0,1]) skozi projekcijo in jo nariše; prekine ob nedoločenih točkah in skokih
 * (npr. šiv ekvirektangularne projekcije). Vrne prvo točko znotraj območja R (za oznako).
 */
function strokeCurve(ctx: CanvasRenderingContext2D, proj: Projection, f: (t: number) => Vec3, n: number, w: number, h: number, R: Rect): Px | null {
  const maxJump = Math.max(R.x1 - R.x0, R.y1 - R.y0) * 0.5;
  let prev: Px | null = null;
  let first: Px | null = null;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = proj.project(f(i / n));
    const q = p ? toPx(p, w, h) : null;
    if (q && Math.abs(q.x) < 1e6 && Math.abs(q.y) < 1e6) {
      if (prev && Math.hypot(q.x - prev.x, q.y - prev.y) < maxJump) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
      prev = q;
      if (!first && q.x >= R.x0 && q.x <= R.x1 && q.y >= R.y0 && q.y <= R.y1) first = q;
    } else prev = null;
  }
  ctx.stroke();
  return first;
}

function drawVanishing(
  ctx: CanvasRenderingContext2D,
  proj: Projection,
  dirCam: Vec3,
  color: string,
  label: string,
  focalText: string | null,
  fan: number,
  w: number,
  h: number,
  R: Rect,
  s: number,
): void {
  const vps = vanishingPoints(proj, dirCam);
  const curved = proj.kind !== 'rectilinear';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  // snop črt: pri rektilinearni projekciji ravne črte, sicer veliki krogi skozi smer
  if (fan > 0) {
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1 * s;
    if (curved) {
      const a = norm(dirCam);
      const b0 = perpendicular(a);
      const c0 = cross(a, b0);
      for (let i = 0; i < fan; i++) {
        const phi = (i * Math.PI) / fan;
        const nrm = { x: Math.cos(phi) * b0.x + Math.sin(phi) * c0.x, y: Math.cos(phi) * b0.y + Math.sin(phi) * c0.y, z: Math.cos(phi) * b0.z + Math.sin(phi) * c0.z };
        strokeCurve(ctx, proj, (t) => greatCircle(nrm)(t * Math.PI * 2), 360, w, h, R);
      }
    } else {
      const vp = vps[0];
      if (vp?.point) strokeSegs(ctx, fanFromPoint(toPx(vp.point, w, h), fan, R));
      else if (vp?.infinity) strokeSegs(ctx, fanParallel({ x: vp.infinity.x, y: -vp.infinity.y }, fan, R));
    }
    ctx.globalAlpha = 1;
  }

  ctx.font = `600 ${12 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  vps.forEach((vp, idx) => {
    const text = idx === 0 ? label : `−${label}`;
    const P = vp.point ? toPx(vp.point, w, h) : null;
    const u = vp.infinity ? { x: vp.infinity.x, y: -vp.infinity.y } : null;
    const inRect = P && P.x >= R.x0 && P.x <= R.x1 && P.y >= R.y0 && P.y <= R.y1;
    if (P && inRect) {
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(P.x, P.y, 6 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(text, P.x, P.y - 15 * s);
      if (focalText) ctx.fillText(focalText, P.x, P.y + 17 * s);
    } else {
      // bežišče zunaj območja: puščica na robu v njegovi smeri
      let dx: number, dy: number;
      if (P) {
        dx = P.x - (R.x0 + R.x1) / 2;
        dy = P.y - (R.y0 + R.y1) / 2;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l;
        dy /= l;
      } else if (u) {
        dx = u.x;
        dy = u.y;
      } else return;
      const e = edgePoint(dx, dy, R, 16 * s);
      arrow(ctx, e.x, e.y, dx, dy, 9 * s);
      ctx.fillText(text, e.x - dx * 20 * s, e.y - dy * 20 * s);
    }
  });
}

export interface GuideBox {
  /** 8 oglišč v svetovnih koordinatah, indeks = 4*x + 2*y + z (bit 1 = pozitivna stran). */
  corners: Vector3[];
}

export interface GuideInput {
  camera: CameraParams;
  /** Lokalne osi izbranega objekta (svetovni koordinati) ali null. */
  objectAxes: Vector3[] | null;
  boxes?: GuideBox[];
}

/** Nariše perspektivna vodila v kader velikosti w×h; `scale` poveča debeline črt pri izvozu, `pad` je papir okoli kadra. */
export function drawGuides(ctx: CanvasRenderingContext2D, w: number, h: number, input: GuideInput, g: GuideSettings, scale = 1, pad = 0): void {
  const R: Rect = { x0: -pad * w, y0: -pad * h, x1: w + pad * w, y1: h + pad * h };
  const proj = createProjection(input.camera);
  const qInv = cameraQuaternion(input.camera).invert();
  const toCam = (v: Vector3): Vec3 => {
    const c = v.clone().applyQuaternion(qInv);
    return { x: c.x, y: c.y, z: c.z };
  };
  const s = scale;
  const rect = proj.kind === 'rectilinear';
  ctx.save();
  ctx.beginPath();
  ctx.rect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (g.horizon) {
    const up = toCam(new Vector3(0, 1, 0));
    ctx.strokeStyle = COLORS.horizon;
    ctx.fillStyle = COLORS.horizon;
    ctx.font = `600 ${12 * s}px system-ui, sans-serif`;
    if (rect) {
      const { seg, above } = horizonSegment(proj, new Vector3(up.x, up.y, up.z), w, h, R);
      if (seg) {
        ctx.lineWidth = 2 * s;
        strokeSegs(ctx, [seg]);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('horizont', Math.min(seg[0], seg[2]) + 8 * s, (seg[1] + seg[3]) / 2 - 4 * s);
      } else {
        const y = above ? R.y1 - 16 * s : R.y0 + 16 * s;
        arrow(ctx, w / 2, y, 0, above ? 1 : -1, 9 * s);
        ctx.textAlign = 'center';
        ctx.textBaseline = above ? 'bottom' : 'top';
        ctx.fillText('horizont', w / 2 + 50 * s, above ? R.y1 - 8 * s : R.y0 + 8 * s);
      }
    } else {
      ctx.lineWidth = 2 * s;
      const circle = greatCircle(up);
      const first = strokeCurve(ctx, proj, (t) => circle(t * Math.PI * 2), 720, w, h, R);
      if (first) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('horizont', first.x + 8 * s, first.y - 4 * s);
      }
    }
  }

  const names = g.labels === 'abc' ? ['A', 'C', 'B'] : ['X', 'Y', 'Z'];
  const focal = g.showFocal ? `${Math.round(input.camera.focalMm)} mm` : null;
  const axes: Array<[boolean, Vector3, string, string]> = [
    [g.vpX, new Vector3(1, 0, 0), COLORS.x, names[0]],
    [g.vpY, new Vector3(0, 1, 0), COLORS.y, names[1]],
    [g.vpZ, new Vector3(0, 0, 1), COLORS.z, names[2]],
  ];
  for (const [on, dir, color, label] of axes) {
    if (on) drawVanishing(ctx, proj, toCam(dir), color, label, focal, g.fan ? g.fanDensity : 0, w, h, R, s);
  }

  if (g.objectVps && input.objectAxes) {
    input.objectAxes.forEach((dir, i) => {
      drawVanishing(ctx, proj, toCam(dir), COLORS.object, `${names[i]}′`, null, g.objectFan ? g.fanDensity : 0, w, h, R, s);
    });
  }

  if (g.boxes && input.boxes) {
    const camPos = cameraPosition(input.camera);
    ctx.strokeStyle = COLORS.box;
    ctx.lineWidth = 1.6 * s;
    for (const box of input.boxes) {
      for (let i = 0; i < 8; i++) {
        for (const bit of [4, 2, 1]) {
          if (i & bit) continue;
          const a = box.corners[i];
          const b = box.corners[i | bit];
          strokeCurve(ctx, proj, (t) => toCam(new Vector3().lerpVectors(a, b, t).sub(camPos)), 24, w, h, R);
        }
      }
    }
  }

  if (pad > 0) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5 * s;
    ctx.strokeRect(0, 0, w, h);
  }
  ctx.restore();
}

/** Robovi objektov kot 2D črte konstantne debeline (bolje vidni kot 1-pikslne 3D črte; delujejo tudi pri ribjem očesu). */
export function drawEdges(ctx: CanvasRenderingContext2D, w: number, h: number, camera: CameraParams, objects: Float32Array[], widthPx: number, scale = 1, pad = 0): void {
  const proj = createProjection(camera);
  const qInv = cameraQuaternion(camera).invert();
  const pos = cameraPosition(camera);
  const n = proj.kind === 'rectilinear' ? 6 : 14;
  const R: Rect = { x0: -pad * w, y0: -pad * h, x1: w + pad * w, y1: h + pad * h };
  const maxJump = Math.max(R.x1 - R.x0, R.y1 - R.y0) * 0.5;
  const a = new Vector3();
  const b = new Vector3();
  const p = new Vector3();
  ctx.save();
  ctx.beginPath();
  ctx.rect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
  ctx.clip();
  ctx.strokeStyle = COLORS.box;
  ctx.lineWidth = widthPx * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const seg of objects) {
    for (let i = 0; i + 5 < seg.length; i += 6) {
      a.set(seg[i], seg[i + 1], seg[i + 2]);
      b.set(seg[i + 3], seg[i + 4], seg[i + 5]);
      let prev: Px | null = null;
      for (let k = 0; k <= n; k++) {
        p.lerpVectors(a, b, k / n).sub(pos).applyQuaternion(qInv);
        const q = proj.project({ x: p.x, y: p.y, z: p.z });
        const px = q ? toPx(q, w, h) : null;
        if (px && Math.abs(px.x) < 1e6 && Math.abs(px.y) < 1e6) {
          if (prev && Math.hypot(px.x - prev.x, px.y - prev.y) < maxJump) ctx.lineTo(px.x, px.y);
          else ctx.moveTo(px.x, px.y);
          prev = px;
        } else prev = null;
      }
    }
  }
  ctx.stroke();
  ctx.restore();
}
