import { describe, expect, it } from 'vitest';
import { Euler, Quaternion, Vector3 } from 'three';
import { CameraParams, CompositionCamera, DEFAULT_CAMERA, constrain, createProjection, worldToCameraDir } from './camera';
import { vanishingPoint } from './projection';

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

function proj(p: CameraParams, world: Vector3) {
  const cam = new Vector3(p.x, p.eyeHeight, p.z);
  return createProjection(p).project(worldToCameraDir(p, world.clone().sub(cam)));
}

const boxCorners = (center: Vector3, size: Vector3, yawDeg: number) => {
  const q = new Quaternion().setFromEuler(new Euler(0, (yawDeg * Math.PI) / 180, 0));
  const pts: Vector3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(new Vector3(sx * size.x, sy * size.y, sz * size.z).multiplyScalar(0.5).applyQuaternion(q).add(center));
  }
  return pts;
};

describe('projekcija', () => {
  it('unproject(project(d)) vrne isto smer', () => {
    const p = constrain({ ...DEFAULT_CAMERA, mode: '3pt', pitch: 12, roll: 5, yaw: 20 });
    const pr = createProjection(p);
    const d = { x: 0.1, y: -0.05, z: -1 };
    const pt = pr.project(d)!;
    const back = pr.unproject(pt)!;
    const len = Math.hypot(d.x, d.y, d.z);
    near(back.x, d.x / len);
    near(back.y, d.y / len);
    near(back.z, d.z / len);
  });

  it('se ujema z Three.js kamero (vključno z lens shift)', () => {
    const p = constrain({ ...DEFAULT_CAMERA, mode: '2pt', shiftY: 0.2, yaw: -20, focalMm: 28, aspect: '4:3' });
    const cc = new CompositionCamera();
    cc.apply(p);
    for (const w of [new Vector3(0, 1, 0), new Vector3(-2, 0.3, 1), new Vector3(1, 2, -3)]) {
      const mine = proj(p, w)!;
      const three = w.clone().project(cc.camera);
      near(mine.x, three.x, 1e-5);
      near(mine.y, three.y, 1e-5);
    }
  });

  it('2-točkovna: navpični robovi škatle so navpični v kadru', () => {
    const p = constrain({ ...DEFAULT_CAMERA, mode: '2pt', pitch: 30, roll: 10, shiftY: 0.15 });
    expect(p.pitch).toBe(0);
    const c = boxCorners(new Vector3(0, 1, 0), new Vector3(1.2, 2, 1.2), 25);
    for (let i = 0; i < 8; i++) {
      if (i & 2) continue; // robovi v smeri Y
      const a = proj(p, c[i])!;
      const b = proj(p, c[i | 2])!;
      near(a.x, b.x, 1e-9);
    }
  });

  it('bežišče leži na podaljšku robov škatle', () => {
    const p = constrain({ ...DEFAULT_CAMERA, mode: '3pt', pitch: -15, yaw: -30, roll: 4 });
    const yaw = 28;
    const c = boxCorners(new Vector3(0, 1, 0), new Vector3(2, 1, 1), yaw);
    const q = new Quaternion().setFromEuler(new Euler(0, (yaw * Math.PI) / 180, 0));
    const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].map((v) => v.applyQuaternion(q));
    // pari oglišč, ki se razlikujeta v eni lokalni osi (bit 4=x, 2=y, 1=z)
    [4, 2, 1].forEach((bit, axis) => {
      const vp = vanishingPoint(createProjection(p), worldToCameraDir(p, axes[axis]));
      expect(vp.point).not.toBeNull();
      for (let i = 0; i < 8; i++) {
        if (i & bit) continue;
        const a = proj(p, c[i])!;
        const b = proj(p, c[i | bit])!;
        const v = vp.point!;
        const cross = (b.x - a.x) * (v.y - a.y) - (b.y - a.y) * (v.x - a.x);
        const scale = Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(v.x - a.x, v.y - a.y);
        near(cross / scale, 0, 1e-6);
      }
    });
  });

  it('1-točkovna: bežišče Z je v središču, X in Y v neskončnosti', () => {
    const p = constrain({ ...DEFAULT_CAMERA, mode: '1pt', yaw: 3, shiftY: 0 });
    const pr = createProjection(p);
    const z = vanishingPoint(pr, worldToCameraDir(p, new Vector3(0, 0, 1)));
    near(z.point!.x, 0);
    near(z.point!.y, 0);
    expect(vanishingPoint(pr, worldToCameraDir(p, new Vector3(1, 0, 0))).infinity).not.toBeNull();
    expect(vanishingPoint(pr, worldToCameraDir(p, new Vector3(0, 1, 0))).infinity).not.toBeNull();
  });
});

import { applyDrag } from './handles';
import { RadialProjection } from './projection';

const vpOf = (p: CameraParams, v: Vector3) => vanishingPoint(createProjection(p), worldToCameraDir(p, v)).point!;

describe('vlečenje bežišč', () => {
  it('2-točkovna: vlečenje na isti položaj ne spremeni kamere', () => {
    const p = constrain({ ...DEFAULT_CAMERA, mode: '2pt', yaw: -30, focalMm: 50, shiftY: 0.1 });
    for (const axis of ['x', 'z'] as const) {
      const v = vpOf(p, axis === 'x' ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1));
      for (const keep of [true, false]) {
        const q = applyDrag(p, { type: 'vp', axis }, v, keep);
        near(q.yaw, p.yaw, 1e-6);
        near(q.focalMm, p.focalMm, 1e-6);
        near(q.shiftY, p.shiftY, 1e-9);
      }
    }
  });

  it('2-točkovna: bežišči A in B pristaneta tam, kamor ju postavimo', () => {
    const p = constrain({ ...DEFAULT_CAMERA, mode: '2pt', yaw: -30, focalMm: 50, shiftY: 0 });
    const z = vpOf(p, new Vector3(0, 0, 1));
    const target = { x: -0.4, y: 0 }; // X bežišče levo od središča
    const q = constrain(applyDrag(p, { type: 'vp', axis: 'x' }, target, false));
    const xNew = vpOf(q, new Vector3(1, 0, 0));
    const zNew = vpOf(q, new Vector3(0, 0, 1));
    near(xNew.x, target.x, 1e-6);
    near(zNew.x, z.x, 1e-6);
  });

  it('3-točkovna: horizont in navpično bežišče se vrneta na isto kamero', () => {
    const p = constrain({ ...DEFAULT_CAMERA, mode: '3pt', pitch: -22, roll: 7, yaw: 15, focalMm: 28 });
    const up = vpOf(p, new Vector3(0, 1, 0));
    const q = applyDrag(p, { type: 'vp', axis: 'y' }, up, true);
    near(q.pitch, p.pitch, 1e-6);
    near(q.roll, p.roll, 1e-6);
    // točka na horizontu
    const proj = createProjection(p);
    const hp = proj.project(worldToCameraDir(p, new Vector3(Math.cos(0.3), 0, Math.sin(0.3))));
    if (hp) near(applyDrag(p, { type: 'horizon' }, hp, true).pitch, p.pitch, 1e-6);
  });

  it('ribje oko: unproject(project(d)) vrne isto smer', () => {
    for (const kind of ['equidistant', 'stereographic', 'equirectangular'] as const) {
      const p = constrain({ ...DEFAULT_CAMERA, focalMm: 10, projection: kind });
      const pr = new RadialProjection(kind, { sensorW: 36, sensorH: 24, focal: 10, shiftX: 0, shiftY: 0.05 });
      const d = { x: 0.3, y: -0.2, z: -0.8 };
      const back = pr.unproject(pr.project(d)!)!;
      const l = Math.hypot(d.x, d.y, d.z);
      near(back.x, d.x / l, 1e-9);
      near(back.y, d.y / l, 1e-9);
      near(back.z, d.z / l, 1e-9);
      expect(p.projection).toBe(kind);
    }
  });
});
