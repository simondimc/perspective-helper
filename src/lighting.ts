import { Box3, DirectionalLight, HemisphereLight, PCFShadowMap, Scene, Sphere, Vector3, WebGLRenderer } from 'three';

export interface LightParams {
  /** Stopinje; 0 = luč prihaja od spredaj (+Z), pozitivno proti +X. */
  azimuth: number;
  /** Stopinje nad obzorjem. */
  elevation: number;
  /** Razmerje glavna luč : okolica. */
  ratio: number;
  /** Izpostavitev (eksponent tonskega preslikovanja). */
  exposure: number;
}

export const DEFAULT_LIGHT: LightParams = { azimuth: -50, elevation: 45, ratio: 4, exposure: 1 };

/** Skupna "energija" luči; glavna in okoljska se delita po razmerju. */
const TOTAL = 3;

export class Lighting {
  readonly key = new DirectionalLight(0xffffff, 1);
  readonly hemi = new HemisphereLight(0xffffff, 0x8a8a8a, 1);
  private params: LightParams = { ...DEFAULT_LIGHT };

  constructor(scene: Scene, renderer: WebGLRenderer) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    this.key.castShadow = true;
    const size = Math.min(4096, renderer.capabilities.maxTextureSize);
    this.key.shadow.mapSize.set(size, size);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    scene.add(this.key, this.key.target, this.hemi);
  }

  direction(): Vector3 {
    const az = (this.params.azimuth * Math.PI) / 180;
    const el = (this.params.elevation * Math.PI) / 180;
    return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  }

  /** Posodobi luči; senčna mapa se prilagodi tako, da pokrije vse objekte in njihove vržene sence. */
  apply(p: LightParams, bounds: Box3, renderer: WebGLRenderer): void {
    this.params = { ...p };
    const r = Math.max(0.01, p.ratio);
    this.key.intensity = (TOTAL * r) / (r + 1);
    this.hemi.intensity = TOTAL / (r + 1);
    renderer.toneMappingExposure = p.exposure;

    const dir = this.direction();
    const sphere = new Sphere(new Vector3(0, 0, 0), 5);
    if (!bounds.isEmpty()) bounds.getBoundingSphere(sphere);
    const elev = Math.max(5, p.elevation) * (Math.PI / 180);
    const height = bounds.isEmpty() ? 0 : Math.max(0, bounds.max.y);
    const reach = Math.min(height / Math.tan(elev), 60);
    const R = Math.max(8, sphere.radius + reach + 2);
    const center = new Vector3(sphere.center.x, 0, sphere.center.z);
    this.key.target.position.copy(center);
    this.key.position.copy(center).addScaledVector(dir, R * 2);
    const cam = this.key.shadow.camera;
    cam.left = -R;
    cam.right = R;
    cam.top = R;
    cam.bottom = -R;
    cam.near = 0.5;
    cam.far = R * 4;
    cam.updateProjectionMatrix();
    this.key.target.updateMatrixWorld();
  }
}
