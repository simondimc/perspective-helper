import { FILE_VERSION, SceneFile } from './io';
import { ObjectParams, ObjectType, Triple, defaultSize } from './objects';
import { defaultState } from './state';

// Primer: manjša podeželska vas ob glavni cesti (ob +Z je opazovalec, cesta teče proti −Z in se konča pri cerkvi).
// Hiše na levi gledajo proti cesti (+X), na desni proti −X; `face` je kot zasuka okoli Y v stopinjah.

const ROAD_W = 5;

export function villageScene(): SceneFile {
  const objects: ObjectParams[] = [];
  let n = 0;
  const put = (type: ObjectType, name: string, x: number, z: number, face = 0, size?: Triple, y = 0): ObjectParams => {
    const sz = size ?? defaultSize(type);
    const o: ObjectParams = { id: `v${n++}`, type, name, position: [x, y + sz[1] / 2, z], rotation: [0, face, 0], size: sz, pose: {} };
    objects.push(o);
    return o;
  };
  const L = 90; // levi bok: gleda proti +X
  const R = -90; // desni bok: gleda proti −X

  put('road', 'Glavna cesta', 0, -25, 0, [ROAD_W, 0.05, 70]);
  put('road', 'Stranska pot', 15, -33, 90, [3, 0.045, 26]);

  // levi bok: dvorišče s hišo, hiša z nadstropjem, koča z dvoriščem
  put('yard', 'Dvorišče 1', -9.5, -2, L, [12, 1, 10]);
  put('house', 'Hiša 1', -11, -2, L);
  put('houseTwo', 'Hiša z nadstropjem', -9.5, -25, L);
  put('yard', 'Dvorišče 2', -9, -47, L, [10, 1, 9]);
  put('cottage', 'Koča', -10.5, -47, L, [6, 4.2, 4.5]);
  for (const z of [-14, -36]) put('bush', 'Grm', -3.5, z, 0, [1.2, 0.9, 1.2]);

  // desni bok: hiša s štirikapno streho in dvoriščem, skedenj, hiša
  put('yard', 'Dvorišče 3', 9.5, -10, R, [12, 1, 10]);
  put('houseHip', 'Hiša s štirikapno streho', 11, -10, R);
  put('barn', 'Skedenj', 11, -36, R);
  put('house', 'Hiša 2', 9, -55, R, [7, 5, 5.5]);

  // cerkev na koncu ceste
  put('church', 'Cerkev', 0, -69);

  // drevesje
  const trees: Array<[ObjectType, number, number, number?]> = [
    ['tree', -22, -5], ['tree', -24, -20, 5], ['tree', -21, -38], ['pine', -26, -52], ['tree', -19, -62],
    ['tree', 24, -2], ['pine', 26, -22], ['tree', 22, -45, 5], ['pine', 25, -60], ['tree', -6, -9, 3.4],
    ['tree', 4, -66, 4.5], ['pine', -8, -64], ['pine', 8, -66],
  ];
  for (const [t, x, z, h] of trees) {
    const s = defaultSize(t);
    put(t, t === 'pine' ? 'Smreka' : 'Drevo', x, z, 0, h ? [s[0] * (h / s[1]), h, s[2] * (h / s[1])] : s);
  }
  for (const [x, z] of [[-17, -12], [-17, -30], [17, -22], [18, -48], [-14, -57], [5, -30]]) put('bush', 'Grm', x, z, 0, [1.6, 1.1, 1.6]);

  // živali in ljudje
  put('cow', 'Krava', 20, -38, 70);
  put('cow', 'Krava', 17, -42, -20);
  put('sheep', 'Ovca', 22, -34, 100);
  put('sheep', 'Ovca', 19, -33, 40);
  put('horse', 'Konj', 20, -50, 20);
  put('chicken', 'Kokoš', 8.2, -7, 40);
  put('chicken', 'Kokoš', 8.8, -12, 130);
  put('dog', 'Pes', -1, -14, 10);
  const man = put('figure', 'Moški', 1.2, -8, 160);
  man.size = [0.57, 1.8, 0.31];
  man.position[1] = 0.9;
  const woman = put('woman', 'Ženska', -3.3, -20, 80);
  woman.size = [0.5, 1.7, 0.28];
  woman.position[1] = 0.85;

  const d = defaultState();
  return {
    version: FILE_VERSION,
    name: 'Podeželska vas',
    objects,
    camera: { ...d.camera, mode: '2pt', x: 2.5, z: 13, eyeHeight: 1.7, yaw: 0, pitch: 0, roll: 0, focalMm: 20, shiftY: -0.1, aspect: '3:2' },
    light: { ...d.light },
    guides: { ...d.guides, vpX: true, vpY: false, vpZ: true },
    view: { ...d.view },
  };
}
