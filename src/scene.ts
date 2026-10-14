import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CameraHelper,
  Color,
  CubeCamera,
  CylinderGeometry,
  Fog,
  GridHelper,
  Group,
  HalfFloatType,
  LineBasicMaterial,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Plane,
  Sphere,
  Box3,
  Quaternion,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShaderMaterial,
  ShadowMaterial,
  Vector2,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { CompositionCamera, cameraPosition, cameraQuaternion, constrain, frameAspect, frameGeometry } from './camera';
import { GuideBox, GuideInput, drawEdges, drawGuides } from './guides';
import { JointName, anglesFromQuaternion, jointFrames, jointPosition, jointQuaternion, toMeshSpace } from './figure';
import { isPosable, rigOf } from './rigs';
import { HandleKind, applyDrag, hitTest } from './handles';
import { Lighting } from './lighting';
import { ObjectParams, ObjectStore, localAxes, objectQuaternion, terrainMaterial } from './objects';
import { AppState } from './state';

export type ViewMode = 'split' | 'editor' | 'frame';
export type TransformMode = 'translate' | 'rotate' | 'scale';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Razporeditev v oknu (koordinate vsebnika): urejevalnik, papir okoli kadra in kader sam. */
interface Layout {
  editor: Box | null;
  paper: Box | null;
  frame: Box | null;
  pad: { x: number; y: number };
}

const BACKGROUND = new Color(0x9a9a9c);
const CONTAINER_BG = 0x1b1b1d;
/** Belo ozadje kadra: vrednost >1, da po tonskem preslikovanju ostane bela. */
const PAPER_BG = new Color(8, 8, 8);

const RADIAL_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const RADIAL_FRAG = `
uniform samplerCube tCube;
uniform int uMode;
uniform float uFocal;
uniform vec2 uSensor;
uniform vec2 uShift;
uniform mat3 uRot;
uniform vec3 uBg;
varying vec2 vUv;
const float PI = 3.14159265359;
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec2 s = (ndc + 2.0 * uShift) * uSensor * 0.5;
  vec3 d = vec3(0.0, 0.0, -1.0);
  bool ok = true;
  if (uMode == 2) {
    float lon = s.x / uFocal;
    float lat = s.y / uFocal;
    if (abs(lat) > PI * 0.5 || abs(lon) > PI) ok = false;
    d = vec3(cos(lat) * sin(lon), sin(lat), -cos(lat) * cos(lon));
  } else {
    float r = length(s);
    float th = uMode == 0 ? r / uFocal : 2.0 * atan(r / (2.0 * uFocal));
    if (th > PI) ok = false;
    float ph = atan(s.y, s.x + 1e-9);
    d = vec3(sin(th) * cos(ph), sin(th) * sin(ph), -cos(th));
  }
  vec4 c = ok ? textureCube(tCube, uRot * d) : vec4(uBg, 1.0);
  gl_FragColor = vec4(c.rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

interface AOView {
  composer: EffectComposer;
  gtao: GTAOPass;
  w: number;
  h: number;
  dpr: number;
}

export class SceneView {
  readonly scene = new Scene();
  readonly renderer: WebGLRenderer;
  readonly editorCamera = new PerspectiveCamera(45, 1, 0.1, 3000);
  readonly comp = new CompositionCamera();
  readonly orbit: OrbitControls;
  readonly transform: TransformControls;
  readonly lighting: Lighting;
  readonly overlay = document.createElement('canvas');
  /** Prozorni plošči nad platnom prejemata dogodke kazalca za urejevalnik in kader. */
  readonly editorPane = document.createElement('div');
  readonly framePane = document.createElement('div');
  mode: ViewMode = 'split';
  transformMode: TransformMode = 'translate';
  /** Samo pogled: klik in vlečenje v sceni ne izbereta in ne premakneta predmetov (samo vrtenje, pomik in povečava pogleda). */
  navOnly = false;
  transformSpace: 'world' | 'local' = 'world';
  /** Izbrana je kompozicijska kamera (namesto objekta). */
  cameraSelected = false;
  /** Izbran sklep figure: gizmo zavrti ta sklep. */
  selectedJoint: JointName | null = null;
  private jointProxy = new Object3D();
  /** Povleci-po-tleh: dvig (navpično) namesto gibanja po tleh; tudi s Shift. */
  liftMode = false;
  /** Ročaji gizma, ki objekt dvigujejo; skriti, dokler objekt stoji na tleh. */
  private liftHandles: Array<{ parent: Object3D; child: Object3D }> = [];
  private gizmoDown = false;
  private objDrag: { id: string; plane: Plane; offset: Vector3; vertical: boolean; moved: boolean } | null = null;
  onCameraMoved: () => void = () => {};
  onModeChange: () => void = () => {};
  onSelectionChange: () => void = () => {};

  private grid: GridHelper;
  private floor: Mesh;
  private rig = new Group();
  private helperCam = new PerspectiveCamera();
  private camHelper: CameraHelper;
  private helpers = new Group();
  private raf = 0;
  private downPos = new Vector2();
  private raycaster = new Raycaster();
  private layout: Layout = { editor: null, paper: null, frame: null, pad: { x: 0, y: 0 } };
  private lastLayout = '';
  private dragging: HandleKind | null = null;
  private cube: WebGLCubeRenderTarget | null = null;
  private cubeCam: CubeCamera | null = null;
  private radialScene = new Scene();
  private radialCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private radialMat: ShaderMaterial | null = null;
  private floorMat!: MeshStandardMaterial;
  private shadowFloorMat = new ShadowMaterial({ opacity: 0.35 });
  private floorTintMat = new MeshStandardMaterial({ roughness: 1, metalness: 0 });
  private aoViews: Partial<Record<'editor' | 'frame', AOView>> = {};

  constructor(private container: HTMLElement, private state: AppState, readonly store: ObjectStore) {
    this.renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.domElement.style.pointerEvents = 'none';
    for (const pane of [this.editorPane, this.framePane]) {
      pane.style.cssText = 'position:absolute;touch-action:none;display:none;';
    }
    container.append(this.renderer.domElement, this.overlay, this.editorPane, this.framePane);
    this.overlay.id = 'overlay';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.top = '0';
    container.style.background = '#1b1b1d';

    this.scene.background = BACKGROUND;
    this.scene.fog = new Fog(BACKGROUND, 500, 2600);
    this.lighting = new Lighting(this.scene, this.renderer);

    // tla: bela mat ravnina (sprejema sence) + mreža
    this.floorMat = new MeshStandardMaterial({ color: 0xc2c2c0, roughness: 0.95, metalness: 0 });
    this.floor = new Mesh(new PlaneGeometry(8000, 8000), this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.grid = new GridHelper(40, 40, 0x6f6f72, 0xb0b0b3);
    this.grid.position.y = 0.002;
    (this.grid.material as LineBasicMaterial).transparent = true;
    (this.grid.material as LineBasicMaterial).opacity = 0.7;
    this.scene.add(this.floor, this.grid, this.store.group);

    // vizualizacija kompozicijske kamere v urejevalniku
    const body = new Mesh(new BoxGeometry(0.3, 0.2, 0.22), new MeshBasicMaterial({ color: 0xff9f1c }));
    const lens = new Mesh(new CylinderGeometry(0.07, 0.09, 0.14, 16), new MeshBasicMaterial({ color: 0x3a3a3c }));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = -0.17;
    this.rig.add(body, lens);
    this.rig.userData.isCamera = true;
    this.camHelper = new CameraHelper(this.helperCam);
    this.helpers.add(this.rig, this.camHelper);
    this.scene.add(this.helpers);

    this.editorCamera.position.set(9, 6, 11);
    this.orbit = new OrbitControls(this.editorCamera, this.editorPane);
    this.orbit.target.set(0, 0.5, 0);
    this.orbit.enableDamping = false;
    this.orbit.maxPolarAngle = Math.PI * 0.499;
    this.orbit.addEventListener('change', () => this.invalidate());

    this.transform = new TransformControls(this.editorCamera, this.editorPane);
    this.transform.size = 0.8;
    this.scene.add(this.transform.getHelper());
    // gizmo za premik: samo osi in ravnina tal (brez ravnin, ki objekt dvigujejo v zrak)
    const gizmoRoot = this.transform.getHelper().children.find((c) => 'gizmo' in c) as unknown as { gizmo: Record<string, Object3D>; picker: Record<string, Object3D> };
    for (const grp of [gizmoRoot.gizmo.translate, gizmoRoot.picker.translate]) {
      for (const c of grp.children) if (['XYZ', 'XY', 'YZ'].includes(c.name)) this.liftHandles.push({ parent: grp, child: c });
    }
    this.transform.addEventListener('change', () => this.invalidate());
    this.transform.addEventListener('dragging-changed', (e) => {
      const dragging = (e as unknown as { value: boolean }).value;
      this.orbit.enabled = !dragging;
      if (!dragging && !this.cameraSelected && this.store.selectedId && this.transformMode === 'scale') {
        this.store.bakeScale(this.store.selectedId);
      }
    });
    this.transform.addEventListener('objectChange', () => this.onTransformChange());

    this.store.onChange(() => this.onStoreChange());
    this.store.onSelect(() => {
      if (this.store.selectedId && this.navOnly) this.navOnly = false; // izbira (npr. s seznama) pomeni, da želimo urejati
      this.selectedJoint = null;
      if (this.store.selectedId) this.cameraSelected = false;
      this.updateAttachment();
      this.onSelectionChange();
    });

    this.editorPane.addEventListener('pointerdown', (e) => this.onObjectDragStart(e), true);
    this.editorPane.addEventListener('pointermove', (e) => this.onObjectDragMove(e));
    const endDrag = () => this.endObjectDrag();
    this.editorPane.addEventListener('pointerup', endDrag);
    this.editorPane.addEventListener('pointercancel', endDrag);
    this.editorPane.addEventListener('lostpointercapture', endDrag);
    window.addEventListener('blur', endDrag);
    this.editorPane.addEventListener('pointerdown', (e) => this.downPos.set(e.clientX, e.clientY));
    this.editorPane.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.editorPane.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.bindFramePane();
    new ResizeObserver(() => this.resize()).observe(container);

    this.refreshCamera();
    this.resize();
  }

  // ---- osveževanje stanja ----

  refreshCamera(): void {
    Object.assign(this.state.camera, constrain(this.state.camera));
    const p = this.state.camera;
    this.comp.apply(p);
    this.rig.position.copy(cameraPosition(p));
    this.rig.quaternion.copy(cameraQuaternion(p));
    // krajši frustum za prikaz v urejevalniku
    const h = this.helperCam;
    h.copy(this.comp.camera, false);
    h.near = 0.2;
    h.far = 3;
    h.projectionMatrix.copy(this.comp.camera.projectionMatrix);
    h.projectionMatrix.elements[10] = -(h.far + h.near) / (h.far - h.near);
    h.projectionMatrix.elements[14] = (-2 * h.far * h.near) / (h.far - h.near);
    h.projectionMatrixInverse.copy(h.projectionMatrix).invert();
    h.updateMatrixWorld(true);
    this.camHelper.update();
    if (this.layoutKey() !== this.lastLayout) this.resize();
    this.invalidate();
  }

  refreshLight(): void {
    this.lighting.apply(this.state.light, this.store.bounds(), this.renderer);
    this.invalidate();
  }

  private onStoreChange(): void {
    this.syncGizmoHandles();
    this.syncJointProxy();
    this.refreshLight();
    this.invalidate();
  }

  // ---- izbira in TransformControls ----

  /** Objekt na tleh se premika samo po tleh; v zraku veljajo vsi ročaji gizma. */
  private syncGizmoHandles(): void {
    const id = this.store.selectedId;
    const onFloor = !!id && !this.cameraSelected && !this.selectedJoint && this.store.isOnFloor(id);
    for (const { parent, child } of this.liftHandles) {
      if (onFloor && child.parent) parent.remove(child);
      else if (!onFloor && !child.parent) parent.add(child);
    }
  }

  private updateAttachment(): void {
    const tc = this.transform;
    const sel = this.store.selected();
    if (this.selectedJoint && sel && isPosable(sel.type)) {
      this.store.mesh(sel.id)!.add(this.jointProxy);
      this.syncJointProxy();
      tc.setMode('rotate');
      tc.setSpace('local');
      tc.attach(this.jointProxy);
    } else if (this.cameraSelected) {
      tc.setMode('translate');
      tc.setSpace('world');
      tc.attach(this.rig);
    } else if (this.store.selectedId) {
      tc.setSpace(this.transformSpace);
      const mesh = this.store.mesh(this.store.selectedId);
      if (mesh) {
        tc.setMode(this.transformMode);
        tc.attach(mesh);
      }
    } else {
      tc.detach();
    }
    this.applySnap();
    this.syncGizmoHandles();
    this.store.setActiveJoint(this.selectedJoint);
    this.invalidate();
  }

  /** Izbere sklep izbrane figure; gizmo ga vrti. */
  selectJoint(j: JointName | null): void {
    this.selectedJoint = j;
    this.cameraSelected = false;
    this.updateAttachment();
    this.onSelectionChange();
  }

  /** Postavi proxy v pivot sklepa z njegovo trenutno rotacijo (v prostoru mesha). */
  private syncJointProxy(): void {
    const sel = this.store.selected();
    if (!this.selectedJoint || !sel) return;
    const rig = rigOf(sel.type);
    if (!rig) return;
    const frames = jointFrames(sel.pose ?? {}, rig);
    const j = this.selectedJoint;
    const parentQ = new Quaternion().setFromRotationMatrix(frames[j].parent);
    this.jointProxy.position.copy(toMeshSpace(rig, jointPosition(frames, j), sel.size));
    this.jointProxy.quaternion.copy(parentQ.multiply(jointQuaternion(rig, j, sel.pose?.[j] ?? [0, 0, 0])));
    this.jointProxy.updateMatrixWorld(true);
  }

  selectCamera(): void {
    this.selectedJoint = null;
    this.cameraSelected = true;
    this.store.select(null);
    this.cameraSelected = true;
    this.updateAttachment();
    this.onSelectionChange();
  }

  setNavOnly(on: boolean): void {
    if (this.navOnly === on) return;
    this.navOnly = on;
    if (on) {
      this.selectedJoint = null;
      this.cameraSelected = false;
      this.store.select(null);
    }
    this.updateAttachment();
    this.onSelectionChange();
  }

  setTransformMode(m: TransformMode): void {
    this.transformMode = m;
    this.selectedJoint = null;
    this.updateAttachment();
  }

  setSpace(space: 'world' | 'local'): void {
    this.transformSpace = space;
    this.updateAttachment();
  }

  applySnap(): void {
    const on = this.state.view.snap;
    this.transform.setTranslationSnap(on ? 0.25 : null);
    this.transform.setRotationSnap(on ? (Math.PI / 180) * 5 : null);
    this.transform.setScaleSnap(on ? 0.05 : null);
  }

  private onTransformChange(): void {
    const sel = this.store.selected();
    if (this.selectedJoint && sel) {
      const rig = rigOf(sel.type);
      if (!rig) return;
      const frames = jointFrames(sel.pose ?? {}, rig);
      const parentQ = new Quaternion().setFromRotationMatrix(frames[this.selectedJoint].parent);
      const rel = parentQ.invert().multiply(this.jointProxy.quaternion);
      this.store.setPoseAngles(sel.id, this.selectedJoint, anglesFromQuaternion(rig, this.selectedJoint, rel));
      return;
    }
    if (this.cameraSelected) {
      const c = this.state.camera;
      c.x = this.rig.position.x;
      c.eyeHeight = Math.max(0.05, this.rig.position.y);
      c.z = this.rig.position.z;
      this.refreshCamera();
      this.onCameraMoved();
    } else if (this.store.selectedId && this.transformMode !== 'scale') {
      this.store.syncFromMesh(this.store.selectedId);
    } else {
      if (this.store.selectedId) this.store.clampToFloor(this.store.selectedId);
      this.refreshLight();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.navOnly) return;
    if (Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y) > 5) return;
    if (this.gizmoDown) {
      this.gizmoDown = false;
      return;
    }
    // izbira temelji na mestu pritiska (ne spusta): pri klikih ob robu predmeta kazalec ob spustu lahko zdrsne s predmeta in bi izbiro odstranil
    const down = { clientX: this.downPos.x, clientY: this.downPos.y };
    const joint = this.pickJoint(down);
    if (joint) {
      this.selectJoint(joint);
      return;
    }
    this.paneRay(down);
    const hits = this.raycaster.intersectObjects([...this.store.group.children, this.rig], true);
    const hit = hits[0]?.object;
    if (!hit) {
      this.cameraSelected = false;
      this.store.select(null);
      this.onSelectionChange();
    } else if (hit.parent === this.rig) {
      this.selectCamera();
    } else if (hit.userData.joint) {
      this.selectJoint(hit.userData.joint as JointName);
    } else if (hit.userData.id) {
      this.store.select(hit.userData.id as string);
    }
  }

  private paneRay(e: { clientX: number; clientY: number }): void {
    const rect = this.editorPane.getBoundingClientRect();
    const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.editorCamera);
  }

  /** Dvoklik na objekt (ali kamero): pogled urejevalnika se približa in usmeri nanj. */
  private onDoubleClick(e: MouseEvent): void {
    const rect = this.editorPane.getBoundingClientRect();
    const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.editorCamera);
    const hit = this.raycaster.intersectObjects([...this.store.group.children, this.rig], true)[0]?.object;
    if (!hit) return;
    let target: Object3D | null = hit;
    while (target && !target.userData.id && !target.userData.isCamera) target = target.parent;
    if (target) this.focusOn(target);
  }

  /** Po nalaganju velike scene (mesto) postavi pogled urejevalnika tako, da je vidna cela scena. Majhnih scen ne premakne. */
  frameAll(): void {
    const box = new Box3();
    for (const o of this.store.list()) {
      if (o.type === 'terrain' || o.type === 'roads') continue;
      box.expandByPoint(new Vector3(...o.position));
    }
    if (box.isEmpty()) return;
    const center = box.getCenter(new Vector3());
    const radius = box.getSize(new Vector3()).length() / 2;
    if (radius < 40) return;
    center.y = Math.min(center.y, radius * 0.1);
    const dir = new Vector3(0.45, 0.55, 1).normalize();
    this.orbit.target.copy(center);
    this.editorCamera.position.copy(center).addScaledVector(dir, Math.min(2200, radius * 1.7));
    this.orbit.update();
    this.invalidate();
  }

  focusCamera(): void {
    this.focusOn(this.rig);
  }

  focusOn(obj: Object3D): void {
    const box = new Box3().setFromObject(obj);
    const center = box.getCenter(new Vector3());
    const radius = Math.max(0.3, box.getBoundingSphere(new Sphere()).radius);
    const fov = (this.editorCamera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(fov / 2) * this.editorCamera.aspect);
    const dist = Math.min(40, Math.max(1.5, (radius / Math.sin(Math.min(fov, hfov) / 2)) * 1.25));
    const dir = this.editorCamera.position.clone().sub(this.orbit.target).normalize();
    const toTarget = center;
    const toPos = center.clone().addScaledVector(dir, dist);
    const fromTarget = this.orbit.target.clone();
    const fromPos = this.editorCamera.position.clone();
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 300);
      const e = 1 - Math.pow(1 - k, 3);
      this.orbit.target.lerpVectors(fromTarget, toTarget, e);
      this.editorCamera.position.lerpVectors(fromPos, toPos, e);
      this.orbit.update();
      this.invalidate();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Klik na ročaj sklepa ima prednost pred telesom figure (ročaji so znotraj telesa, zato jih žarek sicer ne bi zadel prvih). */
  private pickJoint(e: { clientX: number; clientY: number }): JointName | null {
    const sel = this.store.selected();
    if (!sel || !isPosable(sel.type)) return null;
    const group = this.store.mesh(sel.id)?.getObjectByName('joints');
    if (!group) return null;
    this.paneRay(e);
    const hit = this.raycaster.intersectObjects(group.children, false)[0];
    return (hit?.object.userData.joint as JointName | undefined) ?? null;
  }

  /** Povlek objekta neposredno: po tleh (pogled od zgoraj ne dvigne objekta), s Shift ali v načinu dviga navpično. */
  private onObjectDragStart(e: PointerEvent): void {
    // klik na gizem (os je pod kazalcem) ne sme spremeniti izbire; TransformControls ob spustu os ponastavi, zato si jo zapomnimo tukaj
    this.gizmoDown = e.button === 0 && !!this.transform.axis;
    if (this.navOnly) return;
    if (e.button !== 0 || this.transformMode !== 'translate' || this.cameraSelected || this.selectedJoint || this.transform.axis) return;
    if (this.pickJoint(e)) return;
    this.paneRay(e);
    const hits = this.raycaster.intersectObjects(this.store.group.children, true);
    const vertical = e.shiftKey || this.liftMode;
    const idOf = (o: Object3D | null): string | null => {
      while (o && !o.userData.id) o = o.parent;
      return (o?.userData.id as string | undefined) ?? null;
    };
    // z Shift (dvig) ima prednost izbran predmet, tudi če ga drug predmet (cesta, teren, zid) delno prekriva
    const selId = this.store.selectedId;
    const selHit = vertical && selId ? hits.find((h) => !h.object.userData.joint && idOf(h.object) === selId) : undefined;
    const hit = selHit ?? hits[0];
    if (!hit || hit.object.userData.joint) return;
    const id = idOf(hit.object);
    if (!id) return;
    // objekt v zraku: običajno vedenje (gizmo); na tleh: povlek po tleh
    if (!vertical && !this.store.isOnFloor(id)) return;
    if (this.store.selectedId !== id) this.store.select(id);
    const mesh = this.store.mesh(id)!;
    const plane = new Plane();
    if (vertical) {
      const n = new Vector3(this.editorCamera.position.x - hit.point.x, 0, this.editorCamera.position.z - hit.point.z);
      // pogled naravnost od zgoraj: vodoravne smeri ni, vzamemo smer kamere
      if (n.lengthSq() < 1e-6) this.editorCamera.getWorldDirection(n).multiplyScalar(-1).setY(0);
      if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
      plane.setFromNormalAndCoplanarPoint(n.normalize(), hit.point);
    } else {
      plane.setFromNormalAndCoplanarPoint(new Vector3(0, 1, 0), hit.point);
    }
    this.objDrag = { id, plane, offset: mesh.position.clone().sub(hit.point), vertical, moved: false };
    this.downPos.set(e.clientX, e.clientY);
    this.orbit.enabled = false;
    this.editorPane.setPointerCapture(e.pointerId);
    e.stopImmediatePropagation();
  }

  private onObjectDragMove(e: PointerEvent): void {
    const d = this.objDrag;
    if (!d) return;
    const mesh = this.store.mesh(d.id);
    if (!mesh) return;
    // majhen premik kazalca med klikom ne sme premakniti predmeta
    if (!d.moved) {
      if (Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y) < 5) return;
      d.moved = true;
    }
    this.paneRay(e);
    const p = new Vector3();
    if (!this.raycaster.ray.intersectPlane(d.plane, p)) return;
    p.add(d.offset);
    const snap = this.state.view.snap ? 0.25 : 0;
    const q = (v: number) => (snap ? Math.round(v / snap) * snap : v);
    if (d.vertical) mesh.position.y = q(p.y);
    else mesh.position.set(q(p.x), mesh.position.y, q(p.z));
    this.store.syncFromMesh(d.id);
  }

  private endObjectDrag(): void {
    if (!this.objDrag) return;
    this.objDrag = null;
    this.orbit.enabled = true;
  }

  /** Vlečenje bežišč in horizonta v kadru zapiše spremembe nazaj v kamero. */
  private bindFramePane(): void {
    const pane = this.framePane;
    const local = (e: PointerEvent) => {
      const r = pane.getBoundingClientRect();
      return { x: e.clientX - r.left - this.layout.pad.x, y: e.clientY - r.top - this.layout.pad.y };
    };
    pane.addEventListener('pointerdown', (e) => {
      const f = this.layout.frame;
      if (!f) return;
      const kind = hitTest(this.state.camera, this.state.guides, f.w, f.h, local(e));
      if (!kind) return;
      this.dragging = kind;
      pane.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    pane.addEventListener('pointermove', (e) => {
      const f = this.layout.frame;
      if (!f) return;
      const p = local(e);
      if (!this.dragging) {
        pane.style.cursor = hitTest(this.state.camera, this.state.guides, f.w, f.h, p) ? 'grab' : 'default';
        return;
      }
      pane.style.cursor = 'grabbing';
      const ndc = { x: (p.x / f.w) * 2 - 1, y: 1 - (p.y / f.h) * 2 };
      const next = applyDrag(this.state.camera, this.dragging, ndc, e.altKey || this.state.view.lockFocal);
      Object.assign(this.state.camera, constrain(next));
      this.refreshCamera();
      this.onCameraMoved();
    });
    const end = () => {
      this.dragging = null;
    };
    pane.addEventListener('pointerup', end);
    pane.addEventListener('pointercancel', end);
  }

  /** Točka na tleh pod središčem pogleda urejevalnika (za postavitev novih objektov). */
  groundTarget(): { x: number; z: number } {
    return { x: this.orbit.target.x, z: this.orbit.target.z };
  }

  // ---- pogled ----

  setMode(mode: ViewMode): void {
    this.mode = mode;
    this.resize();
    this.onModeChange();
  }

  private computeLayout(): Layout {
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    let editor: Box | null = null;
    let region: Box | null = null;
    if (this.mode === 'editor') editor = { x: 0, y: 0, w: cw, h: ch };
    else if (this.mode === 'frame') region = { x: 0, y: 0, w: cw, h: ch };
    else {
      const gap = 6;
      if (this.state.view.layout === 'side') {
        const ew = Math.floor(cw * 0.42);
        editor = { x: 0, y: 0, w: ew, h: ch };
        region = { x: ew + gap, y: 0, w: cw - ew - gap, h: ch };
      } else {
        const eh = Math.floor(ch * 0.42);
        editor = { x: 0, y: 0, w: cw, h: eh };
        region = { x: 0, y: eh + gap, w: cw, h: ch - eh - gap };
      }
    }
    if (!region) return { editor, paper: null, frame: null, pad: { x: 0, y: 0 } };
    const aspect = frameAspect(this.state.camera);
    const pad = this.state.view.paper;
    const margin = this.mode === 'frame' ? 28 : 12;
    const top = this.mode === 'frame' ? 40 : 0;
    const maxW = Math.max(50, region.w - margin * 2);
    const maxH = Math.max(50, region.h - margin * 2 - top);
    let w = maxW / (1 + 2 * pad);
    let h = w / aspect;
    if (h * (1 + 2 * pad) > maxH) {
      h = maxH / (1 + 2 * pad);
      w = h * aspect;
    }
    w = Math.floor(w);
    h = Math.floor(h);
    const px = Math.round(w * pad);
    const py = Math.round(h * pad);
    const pw = w + 2 * px;
    const ph = h + 2 * py;
    const x = region.x + Math.floor((region.w - pw) / 2);
    const y = region.y + Math.floor((region.h - ph) / 2) + top / 2;
    return { editor, paper: { x, y, w: pw, h: ph }, frame: { x: x + px, y: y + py, w, h }, pad: { x: px, y: py } };
  }

  private layoutKey(): string {
    return JSON.stringify([this.computeLayout(), this.container.clientWidth, this.container.clientHeight]);
  }

  resize(): void {
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    this.layout = this.computeLayout();
    this.lastLayout = this.layoutKey();
    this.renderer.setSize(cw, ch, false);
    const dpr = this.renderer.getPixelRatio();
    for (const c of [this.renderer.domElement, this.overlay]) {
      c.style.width = `${cw}px`;
      c.style.height = `${ch}px`;
    }
    this.overlay.width = Math.round(cw * dpr);
    this.overlay.height = Math.round(ch * dpr);
    const place = (el: HTMLElement, b: Box | null) => {
      el.style.display = b ? 'block' : 'none';
      if (!b) return;
      el.style.left = `${b.x}px`;
      el.style.top = `${b.y}px`;
      el.style.width = `${b.w}px`;
      el.style.height = `${b.h}px`;
    };
    place(this.editorPane, this.layout.editor);
    place(this.framePane, this.layout.paper);
    if (this.layout.editor) {
      this.editorCamera.aspect = this.layout.editor.w / this.layout.editor.h;
      this.editorCamera.updateProjectionMatrix();
    }
    this.invalidate();
  }

  invalidate(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  /** V kadru so nebo in tla lahko bela (papir): ostanejo robovi, sence in vodila. */
  private setBackdrop(frame: boolean): void {
    const white = frame && this.state.view.whiteBg;
    const bg = white ? PAPER_BG : BACKGROUND;
    this.scene.background = bg;
    const fog = this.scene.fog as Fog;
    fog.color.copy(bg);
    // megla samo v kadru (atmosferska perspektiva); v urejevalniku bi ovirala pregled scene
    fog.near = frame ? 500 : 1e6;
    fog.far = frame ? 2600 : 2e6;
    const tint = frame && this.state.view.floorColor;
    if (tint) this.floorTintMat.color.set(tint);
    terrainMaterial.color.set(tint ? tint : white ? 0xdadad8 : 0xc2c2c0).multiplyScalar(tint ? 0.78 : 1);
    this.floor.material = tint ? this.floorTintMat : white ? this.shadowFloorMat : this.floorMat;
    if (this.radialMat) (this.radialMat.uniforms.uBg.value as Vector3).set(bg.r, bg.g, bg.b);
  }

  private setHelpers(editor: boolean): void {
    this.helpers.visible = editor;
    this.store.setJointsShown(editor);
    this.store.setEdgesFor(editor);
    // gizmo je viden samo v urejevalniku in samo, ko je nanj pripet predmet (attach/detach sama upravljata vidnost)
    this.transform.getHelper().visible = editor && !!this.transform.object;
    this.grid.visible = editor || this.state.view.gridInFrame;
  }

  // ---- ribje oko: kocka okolice + senčilnik ----

  private ensureRadial(): void {
    if (this.cube) return;
    this.cube = new WebGLCubeRenderTarget(1024, { type: HalfFloatType });
    this.cubeCam = new CubeCamera(0.1, 3000, this.cube);
    this.radialMat = new ShaderMaterial({
      vertexShader: RADIAL_VERT,
      fragmentShader: RADIAL_FRAG,
      uniforms: {
        tCube: { value: this.cube.texture },
        uMode: { value: 0 },
        uFocal: { value: 10 },
        uSensor: { value: new Vector2(36, 24) },
        uShift: { value: new Vector2() },
        uRot: { value: new Matrix3() },
        uBg: { value: new Vector3(BACKGROUND.r, BACKGROUND.g, BACKGROUND.b) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.radialScene.add(new Mesh(new PlaneGeometry(2, 2), this.radialMat));
  }

  private updateCube(): void {
    this.ensureRadial();
    this.cubeCam!.position.copy(cameraPosition(this.state.camera));
    this.cubeCam!.updateMatrixWorld(true);
    this.setHelpers(false);
    this.cubeCam!.update(this.renderer, this.scene);
  }

  /** Upodobi pogled s kamero v trenutni viewport; z ambientno okluzijo (GTAO) prek postprocesiranja. */
  private renderWithAO(key: 'editor' | 'frame', camera: PerspectiveCamera, w: number, h: number): void {
    const strength = this.state.view.ao;
    if (strength <= 0.001) {
      this.renderer.render(this.scene, camera);
      return;
    }
    let v = this.aoViews[key];
    if (!v) {
      const target = new WebGLRenderTarget(16, 16, { type: HalfFloatType, samples: 4 });
      const composer = new EffectComposer(this.renderer, target);
      const gtao = new GTAOPass(this.scene, camera, 16, 16);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 16 });
      composer.addPass(new RenderPass(this.scene, camera));
      composer.addPass(gtao);
      composer.addPass(new OutputPass());
      v = { composer, gtao, w: 0, h: 0, dpr: 0 };
      this.aoViews[key] = v;
    }
    const dpr = this.renderer.getPixelRatio();
    if (v.w !== w || v.h !== h || v.dpr !== dpr) {
      v.composer.setPixelRatio(dpr);
      v.composer.setSize(w, h);
      v.w = w;
      v.h = h;
      v.dpr = dpr;
    }
    v.gtao.blendIntensity = strength;
    v.composer.render();
  }

  /** Upodobi kader v trenutni viewport (po potrebi prek kocke okolice). */
  private drawFrameScene(w: number, h: number): void {
    const cp = this.state.camera;
    if (cp.projection === 'rectilinear') {
      this.renderWithAO('frame', this.comp.camera, w, h);
      return;
    }
    const f = frameGeometry(cp);
    this.setBackdrop(true);
    const u = this.radialMat!.uniforms;
    u.uMode.value = cp.projection === 'equidistant' ? 0 : cp.projection === 'stereographic' ? 1 : 2;
    u.uFocal.value = f.focal;
    (u.uSensor.value as Vector2).set(f.sensorW, f.sensorH);
    (u.uShift.value as Vector2).set(f.shiftX, f.shiftY);
    (u.uRot.value as Matrix3).setFromMatrix4(new Matrix4().makeRotationFromQuaternion(cameraQuaternion(cp)));
    this.renderer.render(this.radialScene, this.radialCam);
  }

  private render(): void {
    const L = this.layout;
    const r = this.renderer;
    const ch = this.container.clientHeight;
    if (L.frame && this.state.camera.projection !== 'rectilinear') {
      this.setBackdrop(true);
      this.updateCube();
    }
    r.setScissorTest(false);
    r.setClearColor(CONTAINER_BG);
    r.clear();
    r.setScissorTest(true);
    const region = (b: Box) => {
      r.setViewport(b.x, ch - b.y - b.h, b.w, b.h);
      r.setScissor(b.x, ch - b.y - b.h, b.w, b.h);
    };
    if (L.editor) {
      this.setBackdrop(false);
      this.setHelpers(true);
      region(L.editor);
      this.renderWithAO('editor', this.editorCamera, L.editor.w, L.editor.h);
    }
    if (L.frame) {
      this.setBackdrop(true);
      this.setHelpers(false);
      region(L.frame);
      this.drawFrameScene(L.frame.w, L.frame.h);
    }
    r.setScissorTest(false);

    const ctx = this.overlay.getContext('2d')!;
    const dpr = r.getPixelRatio();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (L.paper && L.frame) {
      ctx.fillStyle = '#f3f1ec';
      ctx.fillRect(L.paper.x, L.paper.y, L.paper.w, L.paper.h);
      ctx.clearRect(L.frame.x, L.frame.y, L.frame.w, L.frame.h); // kader pusti viden 3D prikaz
      ctx.save();
      ctx.translate(L.frame.x, L.frame.y);
      if (this.store.getStyle() === 'edges') drawEdges(ctx, L.frame.w, L.frame.h, this.state.camera, this.store.edgeSegments(), this.state.view.edgeWidth, 1, this.state.view.paper);
      drawGuides(ctx, L.frame.w, L.frame.h, this.guideInput(), this.state.guides, 1, this.state.view.paper);
      ctx.restore();
    }
  }

  private guideInput(): GuideInput {
    const sel = this.cameraSelected ? undefined : this.store.selected();
    const cornersOf = (o: ObjectParams): Vector3[] => {
      const q = objectQuaternion(o);
      const corners: Vector3[] = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        corners.push(new Vector3((sx * o.size[0]) / 2, (sy * o.size[1]) / 2, (sz * o.size[2]) / 2).applyQuaternion(q).add(new Vector3(...o.position)));
      }
      return corners;
    };
    const boxes: GuideBox[] = this.state.guides.boxes ? this.store.list().map((o) => ({ corners: cornersOf(o) })) : [];
    return { camera: this.state.camera, objectAxes: sel ? localAxes(sel) : null, boxes, selected: sel ? { corners: cornersOf(sel) } : null };
  }

  /** Upodobi trenutni kader kompozicijske kamere v PNG; `longSide` je daljša stranica v pikslih. */
  async exportPng(longSide: number, withGuides: boolean): Promise<Blob> {
    const aspect = frameAspect(this.state.camera);
    const w = aspect >= 1 ? longSide : Math.round(longSide * aspect);
    const h = aspect >= 1 ? Math.round(longSide / aspect) : longSide;
    const r = this.renderer;
    const prevDpr = r.getPixelRatio();
    r.setPixelRatio(1);
    r.setSize(w, h, false);
    r.setScissorTest(false);
    this.setHelpers(false);
    this.setBackdrop(true);
    if (this.state.camera.projection !== 'rectilinear') {
      this.ensureRadial();
      this.cube!.setSize(1536, 1536);
      this.updateCube();
    }
    this.drawFrameScene(w, h);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(r.domElement, 0, 0);
    if (this.store.getStyle() === 'edges') drawEdges(ctx, w, h, this.state.camera, this.store.edgeSegments(), this.state.view.edgeWidth, Math.max(1, w / 1000));
    if (withGuides) drawGuides(ctx, w, h, this.guideInput(), this.state.guides, Math.max(1, w / 1000));
    r.setPixelRatio(prevDpr);
    this.setBackdrop(false);
    this.cube?.setSize(1024, 1024);
    this.resize();
    return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('Izvoz PNG ni uspel'))), 'image/png'));
  }
}
