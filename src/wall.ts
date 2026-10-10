import { BufferGeometry, ExtrudeGeometry, Path, Shape } from 'three';

/** Odprtina v steni (m): širina, višina, odmik sredine od sredine stene po X in višina spodnjega roba nad tlemi. */
export interface Opening {
  w: number;
  h: number;
  x: number;
  y: number;
}

export type WallType = 'wallDoor' | 'wallWindow';
export const isWallType = (t: string | undefined): t is WallType => t === 'wallDoor' || t === 'wallWindow';

export const DEFAULT_OPENING: Record<WallType, Opening> = {
  wallDoor: { w: 0.9, h: 2.05, x: 0, y: 0 },
  wallWindow: { w: 1.2, h: 1.2, x: 0, y: 0.9 },
};

const MARGIN = 0.05;

/** Odprtina mora ostati znotraj stene (z majhnim robom). */
export function clampOpening(size: [number, number, number], o: Opening): Opening {
  const [W, H] = size;
  const w = Math.max(0.1, Math.min(o.w, W - 2 * MARGIN));
  const y = Math.max(0, Math.min(o.y, H - MARGIN - 0.1));
  const h = Math.max(0.1, Math.min(o.h, H - MARGIN - y));
  const x = Math.max(-(W / 2 - MARGIN - w / 2), Math.min(o.x, W / 2 - MARGIN - w / 2));
  return { w, h, x, y };
}

/** Stena z odprtino (vrata ali okno): ena sama mreža, središče v sredini stene, debelina po Z. */
export function wallGeometry(size: [number, number, number], opening: Opening): BufferGeometry {
  const [W, H, T] = size;
  const o = clampOpening(size, opening);
  const x0 = o.x - o.w / 2;
  const x1 = o.x + o.w / 2;
  const y0 = -H / 2 + o.y;
  const y1 = y0 + o.h;
  const shape = new Shape();
  if (o.y <= 0.001) {
    // vrata: odprtina sega do tal, zato je v obrisu zareza
    shape.moveTo(-W / 2, -H / 2);
    shape.lineTo(x0, -H / 2);
    shape.lineTo(x0, y1);
    shape.lineTo(x1, y1);
    shape.lineTo(x1, -H / 2);
    shape.lineTo(W / 2, -H / 2);
    shape.lineTo(W / 2, H / 2);
    shape.lineTo(-W / 2, H / 2);
    shape.closePath();
  } else {
    shape.moveTo(-W / 2, -H / 2);
    shape.lineTo(W / 2, -H / 2);
    shape.lineTo(W / 2, H / 2);
    shape.lineTo(-W / 2, H / 2);
    shape.closePath();
    const hole = new Path();
    hole.moveTo(x0, y0);
    hole.lineTo(x0, y1);
    hole.lineTo(x1, y1);
    hole.lineTo(x1, y0);
    hole.closePath();
    shape.holes.push(hole);
  }
  return new ExtrudeGeometry(shape, { depth: T, bevelEnabled: false }).translate(0, 0, -T / 2);
}
