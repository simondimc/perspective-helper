import { ObjectParams, ObjectStore } from './objects';
import { AppState } from './state';

// Razveljavi / ponovi: zgodovina posnetkov scene (predmeti, kamera, luč, vodila, prikaz, izbira).
// Nespremenjeni predmeti si delijo isti posnetek med vnosi, zato velike scene (mesta) ne porabijo veliko pomnilnika.

interface Entry {
  id: string;
  key: string;
  obj: ObjectParams;
}

interface Snap {
  entries: Entry[];
  meta: string;
  camera: AppState['camera'];
  light: AppState['light'];
  guides: AppState['guides'];
  view: AppState['view'];
  selectedId: string | null;
}

const MAX_STEPS = 100;
const MAX_ENTRIES = 250000; // skupno število shranjenih predmetov v zgodovini (omejitev pomnilnika)

/** Ključ predmeta; velike tabele (višine terena, poti cest) se ne spreminjajo, zato štejemo samo dolžino. */
const objKey = (p: ObjectParams): string => JSON.stringify(p, (k, v) => ((k === 'heights' || k === 'paths') && Array.isArray(v) ? v.length : v));

function cloneParams(p: ObjectParams): ObjectParams {
  const { heights, paths, ...rest } = p;
  const c = structuredClone(rest) as ObjectParams;
  if (heights) c.heights = heights;
  if (paths) c.paths = paths;
  return c;
}

export class History {
  private undoStack: Snap[] = [];
  private redoStack: Snap[] = [];
  private current: Snap;
  private applying = false;
  onChange: () => void = () => {};

  constructor(
    private state: AppState,
    private store: ObjectStore,
    /** Po obnovi stanja: osveži kamero, luč, prikaz in vmesnik. */
    private refresh: () => void,
  ) {
    this.current = this.take();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private take(prev?: Snap): Snap {
    const old = new Map((prev?.entries ?? []).map((e) => [e.id, e]));
    const entries: Entry[] = this.store.list().map((p) => {
      const key = objKey(p);
      const o = old.get(p.id);
      return o && o.key === key ? o : { id: p.id, key, obj: cloneParams(p) };
    });
    const camera = structuredClone(this.state.camera);
    const light = structuredClone(this.state.light);
    const guides = structuredClone(this.state.guides);
    const view = structuredClone(this.state.view);
    return { entries, meta: JSON.stringify([camera, light, guides, view]), camera, light, guides, view, selectedId: this.store.selectedId };
  }

  private same(a: Snap, b: Snap): boolean {
    return a.meta === b.meta && a.entries.length === b.entries.length && a.entries.every((e, i) => e.key === b.entries[i].key && e.id === b.entries[i].id);
  }

  /** Nov začetek (npr. po nalaganju druge scene): zgodovina se izprazni. */
  reset(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.current = this.take();
    this.onChange();
  }

  /** Zabeleži trenutno stanje kot nov korak, če se je kaj spremenilo. */
  commit(): void {
    if (this.applying) return;
    const next = this.take(this.current);
    if (this.same(next, this.current)) return;
    this.undoStack.push(this.current);
    this.current = next;
    this.redoStack = [];
    let total = this.undoStack.reduce((n, s) => n + s.entries.length, 0);
    while (this.undoStack.length > MAX_STEPS || (total > MAX_ENTRIES && this.undoStack.length > 1)) total -= this.undoStack.shift()!.entries.length;
    this.onChange();
  }

  undo(): void {
    this.commit();
    const target = this.undoStack.pop();
    if (!target) return;
    this.redoStack.push(this.current);
    this.restore(target);
  }

  redo(): void {
    this.commit();
    const target = this.redoStack.pop();
    if (!target) return;
    this.undoStack.push(this.current);
    this.restore(target);
  }

  private restore(snap: Snap): void {
    this.applying = true;
    try {
      Object.assign(this.state.camera, structuredClone(snap.camera));
      Object.assign(this.state.light, structuredClone(snap.light));
      Object.assign(this.state.guides, structuredClone(snap.guides));
      Object.assign(this.state.view, structuredClone(snap.view));
      const have = new Map(this.store.list().map((p) => [p.id, objKey(p)]));
      const want = new Set(snap.entries.map((e) => e.id));
      for (const id of have.keys()) if (!want.has(id)) this.store.remove(id);
      for (const e of snap.entries) {
        if (!have.has(e.id)) this.store.restore(cloneParams(e.obj));
        else if (have.get(e.id) !== e.key) {
          const { id: _id, ...patch } = cloneParams(e.obj);
          void _id;
          this.store.update(e.id, patch);
        }
      }
      this.store.select(snap.selectedId && want.has(snap.selectedId) ? snap.selectedId : null);
      this.refresh();
    } finally {
      this.applying = false;
    }
    this.current = this.take(snap);
    this.onChange();
  }
}
