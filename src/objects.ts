import {
  BoxGeometry,
  BufferAttribute,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  BufferGeometry,
  ConeGeometry,
  Box3,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { chairGeometry, tableGeometry } from './furniture';
import { HOUSE_KINDS, HouseKind, houseGeometry } from './house';
import { RoadPath, roadsGeometry } from './roads';
import { terrainGeometry } from './terrain';
import { CITY_KINDS, CityKind, cityGeometry } from './city';
import { NATURE_KINDS, NatureKind, natureGeometry } from './village';
import { DEFAULT_OPENING, Opening, isWallType, wallGeometry } from './wall';
import { Angles, JointName, Pose, jointFrames, jointPosition, rigGeometry, toMeshSpace } from './figure';
import { ANIMAL_LABELS, AnimalType, isAnimalType } from './animalRigs';
import { isPosable, rigOf } from './rigs';
import { rigFor } from './clothes';
import { restSize } from './figure';

export type BaseType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'figure' | 'woman' | 'dog' | 'horse' | 'elephant' | 'wall' | 'wallDoor' | 'wallWindow' | 'table' | 'chair' | HouseKind | NatureKind | CityKind | 'roads' | 'water';
export type ObjectType = BaseType | AnimalType;

/** Dodatni parametri pokrajine. */
export interface TerrainParams {
  seed?: number;
  flat?: number;
  /** Teren iz podatkov: mreža višin (hn + 1)² vrednosti, vrstice od severa. */
  heights?: number[];
  hn?: number;
  /** Omrežje cest (tip »roads«). */
  paths?: RoadPath[];
  /** Figure: obleka in lasje (glej clothes.ts). */
  outfit?: string;
  hair?: string;
  /** Orožje v desni/levi roki (glej clothes.ts). */
  weaponR?: string;
  weaponL?: string;
  /** Figura iz paketa figur: »paket/figura« (glej packs.ts). */
  figureRef?: string;
}

const isHouseOrNature = (t: ObjectType): boolean => (HOUSE_KINDS as string[]).includes(t) || (NATURE_KINDS as string[]).includes(t) || (CITY_KINDS as string[]).includes(t);

/** Prikaz objektov: mavec, samo robovi (brez ploskev) ali oboje. */
export type ObjectStyle = 'solid' | 'edges' | 'both';
export type Triple = [number, number, number];

/** Parametrični opis objekta; mesh se vedno generira iz teh podatkov. */
export interface ObjectParams {
  id: string;
  type: ObjectType;
  name: string;
  /** Središče objekta (m). */
  position: Triple;
  /** Eulerjevi koti XYZ v stopinjah. */
  rotation: Triple;
  /** Dimenzije lokalnega ogrodja (m): škatla w,h,d; ostali primitivi premer X, višina Y, premer Z. */
  size: Triple;
  /** Poza figure (koti sklepov); manjkajoči sklepi so v mirovanju. */
  pose?: Pose;
  /** Odprtina v steni (vrata/okno); manjkajoče vrednosti so privzete. */
  opening?: Opening;
  /** Pokrajina: seme šuma in delež ravnega središča (0–1); ali mreža višin iz podatkov. */
  seed?: number;
  flat?: number;
  heights?: number[];
  hn?: number;
  /** Omrežje cest (tip »roads«): poti z absolutnimi koordinatami. */
  paths?: RoadPath[];
  /** Figure: obleka in lasje (glej clothes.ts). */
  outfit?: string;
  hair?: string;
  /** Orožje v desni/levi roki (glej clothes.ts). */
  weaponR?: string;
  weaponL?: string;
  /** Figura iz paketa figur: »paket/figura« (glej packs.ts). */
  figureRef?: string;
}

export const TYPE_LABELS: Record<ObjectType, string> = {
  ...ANIMAL_LABELS,
  box: 'Škatla',
  sphere: 'Krogla',
  cylinder: 'Valj',
  cone: 'Stožec',
  figure: 'Moški',
  woman: 'Ženska',
  dog: 'Pes',
  horse: 'Konj',
  elephant: 'Slon',
  wall: 'Stena',
  wallDoor: 'Stena z vrati',
  wallWindow: 'Stena z oknom',
  table: 'Miza',
  chair: 'Stol',
  house: 'Hiša',
  houseHip: 'Hiša (štirikapna)',
  houseTwo: 'Hiša z nadstropjem',
  cottage: 'Koča',
  barn: 'Skedenj',
  church: 'Cerkev',
  townhouse: 'Mestna hiša',
  block: 'Blok',
  tower: 'Stolpnica',
  car: 'Avto (limuzina)',
  hatch: 'Avto (hatchback)',
  suv: 'SUV',
  van: 'Kombi',
  bus: 'Avtobus',
  eiffel: 'Eifflov stolp',
  ferris: 'Panoramsko kolo',
  boat: 'Ladja',
  colosseum: 'Koloseum',
  road: 'Cesta',
  tree: 'Drevo',
  pine: 'Smreka',
  bush: 'Grm',
  yard: 'Dvorišče',
  terrain: 'Pokrajina',
  roads: 'Omrežje cest',
  water: 'Voda',
  shell: 'Stavba s streho',
  river: 'Reka',
  bridge: 'Most',
  hill: 'Hrib',
  hayrack: 'Kozolec',
};

const DEFAULT_SIZE: Partial<Record<ObjectType, Triple>> = {
  box: [1, 1, 1],
  sphere: [1, 1, 1],
  cylinder: [0.8, 1.5, 0.8],
  cone: [0.8, 1.5, 0.8],
  figure: [0.57, 1.8, 0.31],
  woman: [0.5, 1.7, 0.28],
  dog: [0.26, 0.73, 1.14],
  horse: [0.6, 2.2, 2.54],
  elephant: [1.8, 3.4, 5.8],
  wall: [3, 2.6, 0.2],
  wallDoor: [3, 2.6, 0.2],
  wallWindow: [3, 2.6, 0.2],
  table: [1.4, 0.75, 0.8],
  chair: [0.45, 0.9, 0.45],
  house: [8, 5.5, 6],
  houseHip: [8, 5, 6],
  houseTwo: [9, 7.5, 7],
  cottage: [6, 4.2, 5],
  barn: [10, 6.5, 7],
  church: [7, 14, 18],
  townhouse: [7, 11, 9],
  block: [24, 21, 12],
  tower: [20, 90, 20],
  car: [1.8, 1.45, 4.5],
  hatch: [1.75, 1.45, 3.9],
  suv: [1.95, 1.75, 4.7],
  van: [2.0, 2.4, 5.3],
  bus: [2.55, 3.2, 12],
  eiffel: [125, 330, 125],
  ferris: [120, 135, 40],
  boat: [4, 3.2, 15],
  colosseum: [188, 48, 156],
  road: [4, 0.05, 30],
  tree: [4, 6, 4],
  pine: [3, 8, 3],
  bush: [1.4, 1, 1.4],
  yard: [10, 1, 8],
  terrain: [800, 80, 800],
  roads: [100, 1, 100],
  water: [100, 1, 100],
  shell: [10, 7, 8],
  river: [20, 3, 100],
  bridge: [24, 4.5, 8],
  hill: [200, 60, 200],
  hayrack: [8, 5, 3.2],
};

/** Vsi objekti si delijo isti beli mat material (mavčni videz). */
export const plasterMaterial = new MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.9, metalness: 0 });

/** Material pokrajine: barva tal (scena ga prilagaja ozadju), da se teren loči od neba in stavb. */
/** Voda: modra površina (teče po poteh kot ceste, vendar z lastnim materialom). */
export const waterMaterial = new MeshStandardMaterial({ color: 0x78a8cc, roughness: 0.35, metalness: 0 });

export const terrainMaterial = new MeshStandardMaterial({ color: 0xc2c2c0, roughness: 0.95, metalness: 0 });

function circle(rx: number, rz: number, y: number, n = 48): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 1) / n) * Math.PI * 2;
    out.push(Math.cos(a) * rx, y, Math.sin(a) * rz, Math.cos(b) * rx, y, Math.sin(b) * rz);
  }
  return out;
}

/** Robovi objekta (brez ploskev) za prikaz "žične" kocke, kot na skicah. */
export function buildEdges(type: ObjectType, size: Triple, pose?: Pose, opening?: Opening, terrain?: TerrainParams): BufferGeometry {
  const [sx, sy, sz] = size;
  let pos: number[] = [];
  if (type === 'terrain') return new EdgesGeometry(terrainGeometry(size, terrain?.seed, terrain?.flat, terrain?.heights, terrain?.hn), 35);
  if (type === 'roads' || type === 'water') return new EdgesGeometry(roadsGeometry(terrain?.paths ?? []), 35);
  if (isWallType(type)) {
    return new EdgesGeometry(buildGeometry(type, size, pose, opening), 1);
  } else if (type === 'dog' || type === 'horse' || type === 'elephant' || isAnimalType(type)) {
    return new EdgesGeometry(rigGeometry(rigOf(type)!, pose ?? {}, size, true), 12);
  } else if (type === 'table' || type === 'chair' || isHouseOrNature(type)) {
    return new EdgesGeometry(buildGeometry(type, size), 1);
  } else if (type === 'box' || type === 'wall' || type === 'figure' || type === 'woman') {
    return new EdgesGeometry(buildGeometry(type, size, pose, undefined, terrain), type === 'box' || type === 'wall' ? 1 : 35);
  } else if (type === 'sphere') {
    const n = 48;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const b = ((i + 1) / n) * Math.PI * 2;
      const r = 0.5;
      pos.push(Math.cos(a) * r * sx, Math.sin(a) * r * sy, 0, Math.cos(b) * r * sx, Math.sin(b) * r * sy, 0); // meridian XY
      pos.push(0, Math.sin(a) * r * sy, Math.cos(a) * r * sz, 0, Math.sin(b) * r * sy, Math.cos(b) * r * sz); // meridian YZ
      pos.push(Math.cos(a) * r * sx, 0, Math.sin(a) * r * sz, Math.cos(b) * r * sx, 0, Math.sin(b) * r * sz); // ekvator
    }
  } else {
    pos = pos.concat(circle(0.5 * sx, 0.5 * sz, -sy / 2));
    if (type === 'cylinder') {
      pos = pos.concat(circle(0.5 * sx, 0.5 * sz, sy / 2));
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pos.push(x * 0.5 * sx, -sy / 2, z * 0.5 * sz, x * 0.5 * sx, sy / 2, z * 0.5 * sz);
    } else {
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pos.push(x * 0.5 * sx, -sy / 2, z * 0.5 * sz, 0, sy / 2, 0);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  return g;
}

export function buildGeometry(type: ObjectType, size: Triple, pose?: Pose, opening?: Opening, terrain?: TerrainParams): BufferGeometry {
  const [sx, sy, sz] = size;
  switch (type) {
    case 'terrain':
      return terrainGeometry(size, terrain?.seed, terrain?.flat, terrain?.heights, terrain?.hn);
    case 'roads':
    case 'water':
      return roadsGeometry(terrain?.paths ?? []);
    case 'box':
    case 'wall':
      return new BoxGeometry(sx, sy, sz);
    case 'sphere':
      return new SphereGeometry(0.5, 64, 40).scale(sx, sy, sz);
    case 'cylinder':
      return new CylinderGeometry(0.5, 0.5, 1, 64).scale(sx, sy, sz);
    case 'cone':
      return new ConeGeometry(0.5, 1, 64).scale(sx, sy, sz);
    case 'figure':
    case 'woman':
      return rigGeometry(rigFor(type, terrain?.outfit, terrain?.hair, terrain?.weaponR, terrain?.weaponL)!, pose ?? {}, size);
    case 'dog':
    case 'horse':
    case 'elephant':
      return rigGeometry(rigOf(type)!, pose ?? {}, size);
    case 'table':
      return tableGeometry(size);
    case 'chair':
      return chairGeometry(size);
    case 'house':
    case 'houseHip':
    case 'houseTwo':
    case 'cottage':
    case 'barn':
    case 'church':
    case 'shell':
      return houseGeometry(type, size);
    case 'townhouse':
    case 'block':
    case 'tower':
    case 'car':
    case 'hatch':
    case 'suv':
    case 'van':
    case 'bus':
    case 'eiffel':
    case 'ferris':
    case 'boat':
    case 'colosseum':
      return cityGeometry(type, size);
    case 'road':
    case 'tree':
    case 'pine':
    case 'bush':
    case 'yard':
    case 'river':
    case 'bridge':
    case 'hill':
    case 'hayrack':
      return natureGeometry(type, size);
    case 'wallDoor':
    case 'wallWindow':
      return wallGeometry(size, { ...DEFAULT_OPENING[type], ...opening });
    default:
      // živali s skeletom
      return rigGeometry(rigOf(type)!, pose ?? {}, size);
  }
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function objectQuaternion(p: ObjectParams): Quaternion {
  return new Quaternion().setFromEuler(new Euler(rad(p.rotation[0]), rad(p.rotation[1]), rad(p.rotation[2]), 'XYZ'));
}

/** Lokalne osi objekta v svetovnih koordinatah; iz njih izhajajo bežišča objekta. */
export function localAxes(p: ObjectParams): [Vector3, Vector3, Vector3] {
  const q = objectQuaternion(p);
  return [new Vector3(1, 0, 0).applyQuaternion(q), new Vector3(0, 1, 0).applyQuaternion(q), new Vector3(0, 0, 1).applyQuaternion(q)];
}

let idCounter = 0;
const newId = () => `o${Date.now().toString(36)}${(idCounter++).toString(36)}`;

const ghostMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const EDGE_COLOR = 0xd7263d;
const edgeOverlay = new LineBasicMaterial({ color: EDGE_COLOR, depthTest: false, transparent: true });
const edgeDepth = new LineBasicMaterial({ color: EDGE_COLOR });

/** Najnižja točka oglišč mesha v svetovnih koordinatah (ročaji in robovi se ne štejejo). */
function minWorldY(mesh: Mesh): number {
  const pos = mesh.geometry.getAttribute('position');
  const m = mesh.matrixWorld.elements;
  let min = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = m[1] * pos.getX(i) + m[5] * pos.getY(i) + m[9] * pos.getZ(i) + m[13];
    if (y < min) min = y;
  }
  return min;
}

/** Naravna velikost živali iz skeleta (zaokrožena na cm). */
function defaultRigSize(type: ObjectType): Triple {
  const rig = rigOf(type);
  const s = rig ? restSize(rig) : [1, 1, 1];
  return [Math.round(s[0] * 100) / 100, Math.round(s[1] * 100) / 100, Math.round(s[2] * 100) / 100];
}

/** Privzeta velikost objekta ob dodajanju (m). */
export const defaultSize = (type: ObjectType): Triple => [...(DEFAULT_SIZE[type] ?? defaultRigSize(type))] as Triple;

const jointMat = new MeshBasicMaterial({ color: 0xffb703, depthTest: false, transparent: true });
const jointMatActive = new MeshBasicMaterial({ color: 0xe5242b, depthTest: false, transparent: true });

export class ObjectStore {
  readonly group = new Group();
  private items = new Map<string, { params: ObjectParams; mesh: Mesh }>();
  private listeners: Array<() => void> = [];
  private selListeners: Array<() => void> = [];
  selectedId: string | null = null;
  private style: ObjectStyle = 'solid';
  /** Robovi kot 3D črte so vidni (urejevalnik); v kadru jih pri »samo robovi« nariše 2D plast. */
  private showEdges3D = true;

  onChange(cb: () => void): void {
    this.listeners.push(cb);
  }
  onSelect(cb: () => void): void {
    this.selListeners.push(cb);
  }
  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }

  list(): ObjectParams[] {
    return [...this.items.values()].map((i) => i.params);
  }
  get(id: string): ObjectParams | undefined {
    return this.items.get(id)?.params;
  }
  mesh(id: string): Mesh | undefined {
    return this.items.get(id)?.mesh;
  }
  selected(): ObjectParams | undefined {
    return this.selectedId ? this.get(this.selectedId) : undefined;
  }

  private createMesh(p: ObjectParams): Mesh {
    const mesh = new Mesh(buildGeometry(p.type, p.size, p.pose, p.opening, p), p.type === 'terrain' ? terrainMaterial : p.type === 'water' ? waterMaterial : plasterMaterial);
    // ravne površine (voda, ceste) ne mečejo sence: sicer se na veliki sceni pojavi vzorec sence na sami površini
    mesh.castShadow = p.type !== 'water' && p.type !== 'roads';
    mesh.receiveShadow = true;
    mesh.userData.id = p.id;
    mesh.userData.terrain = p.type === 'terrain';
    mesh.userData.water = p.type === 'water';
    // pokrajine se v 3D ne da izbrati s klikom (bi zakrila vse za seboj in ovirala vrtenje pogleda); izbere se s seznama predmetov
    if (p.type === 'terrain' || p.type === 'roads' || p.type === 'water') mesh.raycast = () => {};
    this.applyTransform(mesh, p);
    this.addEdges(mesh, p);
    this.applyStyle(mesh);
    if (isPosable(p.type)) this.addJoints(mesh, p);
    return mesh;
  }

  /** Ročaji sklepov figure (klik jih izbere, nato se vrtijo z gizmom). */
  private addJoints(mesh: Mesh, p: ObjectParams): void {
    const group = new Group();
    group.name = 'joints';
    group.visible = false;
    const rig = rigOf(p.type)!;
    const geo = new SphereGeometry(0.035 * Math.max(0.55, Math.min(2.2, p.size[1] / 1.8)), 12, 8);
    for (const j of rig.joints) {
      const h = new Mesh(geo, jointMat);
      h.name = j;
      h.userData.joint = j;
      h.renderOrder = 20;
      h.raycast = (rc, hits) => {
        if (this.selectedId === p.id) Mesh.prototype.raycast.call(h, rc, hits);
      };
      group.add(h);
    }
    mesh.add(group);
    this.updateJoints(mesh, p);
  }

  private updateJoints(mesh: Mesh, p: ObjectParams): void {
    const group = mesh.getObjectByName('joints');
    if (!group) return;
    const rig = rigOf(p.type);
    if (!rig) return;
    const frames = jointFrames(p.pose ?? {}, rig);
    for (const j of rig.joints) group.getObjectByName(j)!.position.copy(toMeshSpace(rig, jointPosition(frames, j), p.size));
  }

  /** Izbrani sklep je obarvan rdeče, ostali rumeno. */
  setActiveJoint(joint: string | null): void {
    this.items.forEach((it, id) => {
      const g = it.mesh.getObjectByName('joints');
      g?.children.forEach((h) => ((h as Mesh).material = joint && id === this.selectedId && h.name === joint ? jointMatActive : jointMat));
    });
  }

  /** Ročaji sklepov so vidni samo v urejevalniku in samo pri izbrani figuri. */
  setJointsShown(show: boolean): void {
    this.items.forEach((it, id) => {
      const g = it.mesh.getObjectByName('joints');
      if (g) g.visible = show && id === this.selectedId;
    });
  }

  /** Poza figure z vsemi sklepi. */
  getPose(id: string): Record<JointName, Angles> {
    const pose = this.get(id)?.pose ?? {};
    const out = {} as Record<JointName, Angles>;
    for (const j of rigOf(this.get(id)?.type)?.joints ?? []) out[j] = [...(pose[j] ?? [0, 0, 0])] as Angles;
    return out;
  }

  /** Postavi predmet tako, da se najnižja točka dotika tal (npr. po spremembi poze v sedenje). */
  dropToFloor(id: string): void {
    const it = this.items.get(id);
    if (!it) return;
    it.mesh.updateMatrixWorld(true);
    it.mesh.position.y -= minWorldY(it.mesh);
    it.params.position[1] = it.mesh.position.y;
    it.mesh.updateMatrixWorld(true);
  }

  /** Sprememba poze: če je predmet stal na tleh, ostane na tleh (sedeča figura se spusti, dvignjena noga ne dvigne telesa). */
  setPose(id: string, pose: Pose): void {
    const was = this.isOnFloor(id);
    this.update(id, { pose: structuredClone(pose) });
    if (was) {
      this.dropToFloor(id);
      this.emit();
    }
  }

  setPoseAngles(id: string, joint: JointName, a: Angles): void {
    const pose = this.getPose(id);
    pose[joint] = a;
    this.setPose(id, pose);
  }

  private addEdges(mesh: Mesh, p: ObjectParams): void {
    const old = mesh.getObjectByName('edges') as LineSegments | undefined;
    if (old) {
      old.geometry.dispose();
      mesh.remove(old);
    }
    const lines = new LineSegments(buildEdges(p.type, p.size, p.pose, p.opening, p), edgeOverlay);
    lines.name = 'edges';
    lines.renderOrder = 10;
    lines.raycast = () => {};
    mesh.add(lines);
  }

  private applyStyle(mesh: Mesh): void {
    const lines = mesh.getObjectByName('edges') as LineSegments;
    mesh.material = this.style === 'edges' ? ghostMaterial : (mesh.userData.terrain ? terrainMaterial : mesh.userData.water ? waterMaterial : plasterMaterial);
    mesh.receiveShadow = this.style !== 'edges';
    lines.visible = this.edgesVisible();
    lines.material = this.style === 'both' ? edgeDepth : edgeOverlay;
  }

  private edgesVisible(): boolean {
    return this.style === 'both' || (this.style === 'edges' && this.showEdges3D);
  }

  setEdgesFor(editorPass: boolean): void {
    this.showEdges3D = editorPass;
    this.items.forEach((it) => {
      const lines = it.mesh.getObjectByName('edges');
      if (lines) lines.visible = this.edgesVisible();
    });
  }

  getStyle(): ObjectStyle {
    return this.style;
  }

  /** Robovi vseh objektov v svetovnih koordinatah (pari točk) za 2D izris. */
  edgeSegments(): Float32Array[] {
    return [...this.items.values()].map((it) => {
      it.mesh.updateMatrixWorld(true);
      const lines = it.mesh.getObjectByName('edges') as LineSegments;
      const pos = lines.geometry.getAttribute('position');
      const out = new Float32Array(pos.count * 3);
      const v = new Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(it.mesh.matrixWorld);
        out.set([v.x, v.y, v.z], i * 3);
      }
      return out;
    });
  }

  setStyle(style: ObjectStyle): void {
    this.style = style;
    this.items.forEach((it) => this.applyStyle(it.mesh));
    this.emit();
  }

  private applyTransform(mesh: Mesh, p: ObjectParams): void {
    mesh.position.set(...p.position);
    mesh.rotation.set(rad(p.rotation[0]), rad(p.rotation[1]), rad(p.rotation[2]), 'XYZ');
    mesh.scale.set(1, 1, 1);
  }

  /** Ali objekt stoji na tleh (najnižja točka pri y = 0). */
  isOnFloor(id: string): boolean {
    const it = this.items.get(id);
    if (!it) return false;
    it.mesh.updateMatrixWorld(true);
    return minWorldY(it.mesh) < 0.002;
  }

  /** Dvigne mesh, če sega pod tla (y < 0); vrne true, če se je premaknil. */
  clampToFloor(id: string): boolean {
    const it = this.items.get(id);
    if (!it) return false;
    it.mesh.updateMatrixWorld(true);
    const minY = minWorldY(it.mesh);
    if (minY >= -1e-6) return false;
    it.mesh.position.y -= minY;
    it.params.position[1] = it.mesh.position.y;
    return true;
  }

  private insert(p: ObjectParams): ObjectParams {
    const mesh = this.createMesh(p);
    this.items.set(p.id, { params: p, mesh });
    this.group.add(mesh);
    this.clampToFloor(p.id);
    return p;
  }

  add(type: ObjectType, at?: { x: number; z: number }): ObjectParams {
    const size = [...(DEFAULT_SIZE[type] ?? defaultRigSize(type))] as Triple;
    const p = this.insert({
      id: newId(),
      type,
      name: TYPE_LABELS[type],
      position: [at?.x ?? 0, size[1] / 2, at?.z ?? 0],
      rotation: [0, 0, 0],
      size,
    });
    this.select(p.id);
    this.emit();
    return p;
  }

  duplicate(id: string): ObjectParams | undefined {
    const src = this.get(id);
    if (!src) return;
    const p = this.insert({
      ...structuredClone(src),
      id: newId(),
      position: [src.position[0] + src.size[0] * 0.5 + 0.3, src.position[1], src.position[2] + 0.3],
    });
    this.select(p.id);
    this.emit();
    return p;
  }

  /** Vstavi predmet z znanim id (obnovitev iz zgodovine). */
  restore(p: ObjectParams): void {
    if (this.items.has(p.id)) return;
    this.insert(p);
    this.emit();
  }

  remove(id: string): void {
    const it = this.items.get(id);
    if (!it) return;
    this.group.remove(it.mesh);
    it.mesh.geometry.dispose();
    this.items.delete(id);
    if (this.selectedId === id) this.select(null);
    this.emit();
  }

  select(id: string | null): void {
    if (id !== null && !this.items.has(id)) id = null;
    this.selectedId = id;
    this.selListeners.forEach((cb) => cb());
  }

  /** Preimenuje predmet (geometrija se ne spremeni). */
  rename(id: string, name: string): void {
    const it = this.items.get(id);
    const n = name.trim();
    if (!it || !n) return;
    it.params.name = n;
    this.emit();
  }

  /** Ročna sprememba parametrov (npr. iz UI): regenerira mesh. */
  update(id: string, patch: Partial<Omit<ObjectParams, 'id'>>): void {
    const it = this.items.get(id);
    if (!it) return;
    Object.assign(it.params, patch);
    it.mesh.geometry.dispose();
    it.mesh.geometry = buildGeometry(it.params.type, it.params.size, it.params.pose, it.params.opening, it.params);
    this.addEdges(it.mesh, it.params);
    this.applyStyle(it.mesh);
    this.applyTransform(it.mesh, it.params);
    this.updateJoints(it.mesh, it.params);
    this.clampToFloor(id);
    this.emit();
  }

  /** Prenos položaja in rotacije iz mesha (po premiku s TransformControls) v parametre. */
  syncFromMesh(id: string): void {
    const it = this.items.get(id);
    if (!it) return;
    const m = it.mesh;
    this.clampToFloor(id);
    it.params.position = [m.position.x, m.position.y, m.position.z];
    it.params.rotation = [deg(m.rotation.x), deg(m.rotation.y), deg(m.rotation.z)];
    this.emit();
  }

  /** Vgradi mesh.scale v dimenzije (lokalno) in resetira scale na 1. */
  bakeScale(id: string): void {
    const it = this.items.get(id);
    if (!it) return;
    const s = it.mesh.scale;
    if (s.x === 1 && s.y === 1 && s.z === 1) return;
    const size: Triple = [it.params.size[0] * s.x, it.params.size[1] * s.y, it.params.size[2] * s.z];
    this.syncFromMesh(id);
    this.update(id, { size });
  }

  clear(): void {
    [...this.items.keys()].forEach((id) => this.remove(id));
  }

  load(list: ObjectParams[]): void {
    this.clear();
    list.forEach((p) => this.insert({ ...structuredClone(p), id: p.id || newId() }));
    this.select(null);
    this.emit();
  }

  bounds(): Box3 {
    const box = new Box3();
    this.group.updateMatrixWorld(true);
    this.group.children.forEach((c) => box.expandByObject(c));
    return box;
  }
}
