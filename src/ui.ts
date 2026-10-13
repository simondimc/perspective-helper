import './ui.css';
import { ASPECTS } from './camera';
import { Rig, axesOf, limitsOf } from './figure';
import { isPosable, rigOf } from './rigs';
import { SceneFile, applyScene, checkRequirements, blankSceneFile, createScene, currentSceneId, deleteScene, downloadBlob, downloadScene, fileSafeName, getIndex, loadLocal, pickSceneFile, renameScene, resetScene, sceneNameOf, saveLocal, serialize, setCurrentScene } from './io';
import { ANIMAL_TYPES } from './animalRigs';
import { ObjectStyle, ObjectType, TYPE_LABELS } from './objects';
import { FigureDef, FigurePack, figureRef, listPacks, parsePack, removePack, savePack } from './packs';
import { History } from './history';
import { HAIRS, OUTFITS, WEAPONS } from './clothes';
import { DEFAULT_OPENING, clampOpening, isWallType } from './wall';
import { PROJECTION_LABELS } from './projection';
import { SceneView, TransformMode, ViewMode } from './scene';
import { AppState } from './state';

const AUTOSAVE_DELAY = 600;

/** Primeri scen: mesta iz podatkov OpenStreetMap (1 × 1 km); datoteke se naložijo šele ob izbiri. */
interface ExampleScene {
  name: string;
  label: string;
  group: string;
  load: () => Promise<{ default: unknown }>;
}

const OSM_SCENES = {
  capital: { name: 'Ljubljana – center', label: 'Ljubljana: center (Prešernov trg, Tromostovje, Grajski hrib)', group: 'Mesta', load: () => import('./data/ljubljana.json') },
  paris: { name: 'Pariz – Eifflov stolp', label: 'Pariz: Eifflov stolp in Seina', group: 'Mesta', load: () => import('./data/paris.json') },
  london: { name: 'London – Westminster', label: 'London: Westminster (Big Ben, Temza)', group: 'Mesta', load: () => import('./data/london.json') },
  tokyo: { name: 'Tokio – Shibuya', label: 'Tokio: Shibuya (križišče Shibuya)', group: 'Mesta', load: () => import('./data/tokyo.json') },
  newyork: { name: 'New York – Midtown', label: 'New York: Midtown (Bryant Park, Empire State Building)', group: 'Mesta', load: () => import('./data/newyork.json') },
  rome: { name: 'Rim – Koloseum', label: 'Rim: Koloseum in Forum', group: 'Mesta', load: () => import('./data/rome.json') },
  venice: { name: 'Benetke – Rialto', label: 'Benetke: Rialto in Veliki kanal', group: 'Mesta', load: () => import('./data/venice.json') },
  fidi: { name: 'New York – Lower Manhattan', label: 'New York: Lower Manhattan (Wall Street, One WTC)', group: 'Mesta', load: () => import('./data/fidi.json') },
} satisfies Record<string, ExampleScene>;
type OsmScene = keyof typeof OSM_SCENES;

const ICONS: Record<string, string> = {
  box: '<path d="M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10"/>',
  sphere: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="3.5"/><path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  cylinder: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/>',
  cone: '<path d="M12 3 5 18c0 1.7 3.1 3 7 3s7-1.3 7-3z"/><path d="M5 18c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  figure: '<circle cx="12" cy="5" r="2.5"/><path d="M8 21v-7l-2-3V9h12v2l-2 3v7M12 9v7"/>',
  woman: '<circle cx="12" cy="5" r="2.5"/><path d="M12 8l-4.5 10h9zM10 18v3M14 18v3"/>',
  table: '<path d="M3 9h18M5 9v11M19 9v11M7 9v6M17 9v6"/>',
  chair: '<path d="M7 4v16M7 12h10v8M17 12v8M7 4h2"/>',
  house: '<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5"/>',
  houseHip: '<path d="M2 12 8 5h8l6 7M5 12v8h14v-8M10 20v-4h4v4"/>',
  houseTwo: '<path d="M3 9 12 3l9 6M5 8v13h14V8M9 12h2M13 12h2M9 17h2M13 17h2"/>',
  cottage: '<path d="M2 13 12 6l10 7M5 12v8h14v-8M9 20v-4h3v4M15 14h2v2h-2z"/>',
  barn: '<path d="M3 11 7 5h10l4 6v9H3zM9 20v-7h6v7M9 13l6 7M15 13l-6 7"/>',
  church: '<path d="M12 2v4M10 4h4M8 10l4-4 4 4v11H8zM3 21v-7l5-3M21 21v-7l-5-3M10.5 21v-4h3v4"/>',
  townhouse: '<path d="M6 21V6h12v15M3 21h18M9 9h2M13 9h2M9 13h2M13 13h2M10 21v-4h4v4"/>',
  block: '<path d="M5 21V3h14v18M3 21h18M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>',
  ferris: '<circle cx="12" cy="10" r="7"/><circle cx="12" cy="10" r="1"/><path d="M12 3v14M5 10h14M7 5l10 10M17 5 7 15M8 21l4-11 4 11"/>',
  boat: '<path d="M3 15h18l-3 5H6zM12 15V4l6 8h-6M10 8l-4 5h4"/>',
  car: '<path d="M3 15v-3l2-4h9l3 4h4v3zM7 15a2 2 0 1 0 0 .1M16 15a2 2 0 1 0 0 .1M6.5 8l-1 4h12"/>',
  tower: '<path d="M10 21V8l2-5 2 5v13M6 21v-9h4M14 21v-9h4M3 21h18"/>',
  road: '<path d="M8 3 4 21M16 3l4 18M12 4v3M12 10v3M12 16v3"/>',
  tree: '<circle cx="12" cy="9" r="6"/><path d="M12 15v6M9 21h6"/>',
  pine: '<path d="M12 3 7 10h3l-4 6h12l-4-6h3zM12 16v5"/>',
  bush: '<circle cx="8" cy="15" r="4"/><circle cx="16" cy="15" r="4"/><circle cx="12" cy="11" r="4"/><path d="M4 19h16"/>',
  terrain: '<path d="M2 18l5-7 3 4 4-8 4 6 4-3v8zM2 18h20"/>',
  river: '<path d="M3 8c3-2 6 2 9 0s6-2 9 0M3 13c3-2 6 2 9 0s6-2 9 0M3 18c3-2 6 2 9 0s6-2 9 0"/>',
  bridge: '<path d="M2 10h20M4 10v4a4 4 0 0 0 8 0v-4M12 10v4a4 4 0 0 0 8 0v-4M2 18h20"/>',
  hill: '<path d="M2 20c3-10 7-14 10-14s7 4 10 14zM15 8l3-2"/>',
  hayrack: '<path d="M3 10l9-5 9 5M5 10v10M12 10v10M19 10v10M8 12v8M16 12v8"/>',
  yard: '<path d="M3 20V8h18v12M3 20h18M7 8v12M12 8v12M17 8v12M3 12h18"/>',
  wall: '<path d="M3 5h18v14H3zM3 10h18M3 15h18M9 5v5M15 10v5M9 15v4"/>',
  wallDoor: '<path d="M4 4h16v16H4zM9 20V10h6v10"/>',
  wallWindow: '<path d="M4 4h16v16H4zM8 8h8v6H8z"/>',
  elephant: '<path d="M4 14c0-4 3-6 7-6 4 0 7 2 7 6v6M4 14v6M8 14v6M14 14v6M18 14v6M18 12c2 0 3 1 3 4M4 11c-1-2 0-4 1-4"/>',
  horse: '<path d="M3 15h12l1-4 2-4 2 1-1 3-1 1v8M5 15v6M8 15v6M13 15v6M16 15v6M18 7l-1-3"/>',
  dog: '<path d="M3 13h11l2-4h3l2 2-2 1v3M5 13v7M8 13v7M13 13v7M16 12v8M16 9l-1-3"/>',
  translate: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>',
  scale: '<path d="M4 20 20 4M14 4h6v6M10 20H4v-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  lift: '<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>',
  undo: '<path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2 6-5.5 6S6 18 5 15l-1.2-3a1.4 1.4 0 0 1 2.4-1.2L8 13"/>',
  people: '<circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20v-2a5 5 0 0 1 10 0v2M15 20v-1.5a4 4 0 0 1 6-3.4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};
const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export class UI {
  private root = document.getElementById('ui')!;
  private syncs: Array<() => void> = [];
  /** Sinhronizacije drsnikov poze (se zamenjajo, ko se skelet spremeni). */
  private poseSyncs: Array<() => void> = [];
  private syncTarget: Array<() => void> | null = null;
  private saveTimer = 0;
  private hint = el('div');
  private tools = el('div', 'seg');
  private addbar = el('div', 'addbar');
  private selbar = el('div');
  private selName = el('span', 'name');
  private warnedStorage = false;
  private history!: History;
  private stack = el('div', 'bottomstack');

  constructor(private view: SceneView, private state: AppState) {
    this.hint.id = 'hint';
    this.history = new History(state, view.store, () => this.afterHistory());
    this.buildBar();
    this.buildAddbar();
    this.buildSidebar();
    this.buildSelbar();
    this.root.append(this.hint, this.stack);
    this.bindHotkeys();

    view.store.onChange(() => {
      this.sync();
      this.syncSelection();
      this.scheduleSave();
    });
    view.onSelectionChange = () => {
      this.syncSelection();
      this.syncChrome();
    };
    view.onCameraMoved = () => {
      this.sync();
      this.scheduleSave();
    };
    view.onModeChange = () => this.syncChrome();
    this.sync();
    this.syncSelection();
    this.syncChrome();
  }

  // ---- gradniki ----

  private sync(): void {
    this.syncs.forEach((f) => f());
    this.poseSyncs.forEach((f) => f());
  }

  private changed(fn: () => void): void {
    fn();
    this.sync();
    this.scheduleSave();
  }

  private seg<T extends string>(opts: Array<[T, string]>, get: () => T, set: (v: T) => void, cls = ''): HTMLElement {
    const box = el('div', `seg ${cls}`);
    const btns = opts.map(([v, label]) => {
      const b = el('button', '', label);
      b.onclick = () => set(v);
      box.append(b);
      return [v, b] as const;
    });
    this.syncs.push(() => btns.forEach(([v, b]) => b.classList.toggle('on', get() === v)));
    return box;
  }

  private chip(label: string, get: () => boolean, set: (v: boolean) => void, color?: string): HTMLButtonElement {
    const b = el('button', 'chip', label);
    if (color) b.style.setProperty('--c', color);
    b.onclick = () => set(!get());
    this.syncs.push(() => b.classList.toggle('on', get()));
    return b;
  }

  private slider(label: string, min: number | (() => number), max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string = (v) => String(+v.toFixed(2)), visible?: () => boolean, edit?: { unit: string; decimals: number; scale?: number }): HTMLElement {
    const row = el('div', 'row');
    const lab = el('div', 'lab', `<span>${label}</span><b></b>`);
    const input = el('input');
    input.type = 'range';
    input.min = String(typeof min === 'number' ? min : min());
    input.max = String(max);
    input.step = String(step);
    input.oninput = () => set(parseFloat(input.value));
    // vnos s tipkovnico: namesto oznake vrednosti številčno polje
    let num: HTMLInputElement | null = null;
    if (edit) {
      num = el('input', 'num');
      num.type = 'number';
      const sc = edit.scale ?? 1;
      num.step = String(step * sc);
      num.onchange = () => {
        const v = parseFloat(num!.value) / sc;
        if (!isFinite(v)) return;
        const lo = typeof min === 'number' ? min : min();
        set(Math.min(max, Math.max(lo, v)));
      };
      num.onkeydown = (e) => {
        if (e.key === 'Enter') num!.blur();
      };
      const b = lab.querySelector('b')!;
      b.textContent = '';
      b.append(num, el('span', 'unit', edit.unit));
    }
    row.append(lab, input);
    (this.syncTarget ?? this.syncs).push(() => {
      if (typeof min === 'function') input.min = String(min());
      const v = get();
      input.value = String(v);
      if (num) {
        if (document.activeElement !== num) num.value = (v * (edit!.scale ?? 1)).toFixed(edit!.decimals);
      } else lab.querySelector('b')!.textContent = fmt(v);
      row.hidden = visible ? !visible() : false;
    });
    return row;
  }

  private card(title: string, open: boolean, ...children: HTMLElement[]): HTMLDetailsElement {
    const d = el('details', 'card');
    d.open = open;
    d.append(el('summary', '', title));
    const body = el('div', 'body');
    body.append(...children);
    d.append(body);
    return d;
  }

  private row(label: string, child: HTMLElement): HTMLElement {
    const r = el('div', 'row');
    r.append(el('div', 'lab', `<span>${label}</span>`), child);
    return r;
  }

  // ---- zgornja vrstica in orodja ----

  private buildBar(): void {
    const bar = el('div', 'bar');
    const view = this.view;
    const modes: Array<[ViewMode, string]> = [['split', 'Scena + kader'], ['editor', 'Scena'], ['frame', 'Kader']];
    bar.append(this.seg(modes, () => view.mode, (m) => view.setMode(m)));
    const tools: Array<[TransformMode, string, string]> = [['translate', 'Premik (W)', 'translate'], ['rotate', 'Rotacija (E)', 'rotate'], ['scale', 'Velikost (R)', 'scale']];
    const histBar = el('div', 'seg');
    const undoBtn = el('button', '', icon('undo'));
    undoBtn.title = 'Razveljavi (Ctrl/Cmd + Z)';
    undoBtn.onclick = () => this.undo();
    const redoBtn = el('button', '', icon('redo'));
    redoBtn.title = 'Ponovi (Ctrl/Cmd + Y ali Ctrl/Cmd + Shift + Z)';
    redoBtn.onclick = () => this.redo();
    histBar.append(undoBtn, redoBtn);
    const syncHist = () => {
      undoBtn.disabled = !this.history.canUndo;
      redoBtn.disabled = !this.history.canRedo;
    };
    this.history.onChange = syncHist;
    syncHist();
    bar.append(histBar);
    const navBtn = el('button', '', icon('hand'));
    navBtn.title = 'Samo pogled (H): klik in vlečenje v sceni ne izbereta in ne premakneta predmetov';
    navBtn.onclick = () => {
      view.setNavOnly(!view.navOnly);
      this.sync();
    };
    this.tools.append(navBtn);
    this.syncs.push(() => navBtn.classList.toggle('on', view.navOnly));
    const btns = tools.map(([m, title, ic]) => {
      const b = el('button', '', icon(ic));
      b.title = title;
      b.onclick = () => {
        view.setNavOnly(false);
        view.setTransformMode(m);
        this.sync();
      };
      this.tools.append(b);
      return [m, b] as const;
    });
    this.syncs.push(() => btns.forEach(([m, b]) => b.classList.toggle('on', view.transformMode === m && !view.navOnly && !view.cameraSelected && !view.selectedJoint)));
    bar.append(this.tools);
    bar.append(this.sceneSwitcher());
    this.root.append(bar);
  }

  // ---- več scen ----

  private switchScene(id: string): void {
    if (id === currentSceneId()) return;
    clearTimeout(this.saveTimer);
    saveLocal(this.state, this.view.store);
    setCurrentScene(id);
    if (!loadLocal(this.state, this.view.store)) resetScene(this.state, this.view.store);
    this.afterLoad();
  }

  private async newScene(kind: 'blank' | 'default' | 'copy' | OsmScene): Promise<void> {
    const idx = getIndex();
    const osm = kind in OSM_SCENES ? OSM_SCENES[kind as OsmScene] : null;
    const base = osm ? osm.name : kind === 'copy' ? `${idx.items.find((m) => m.id === idx.current)?.name ?? 'Scena'} (kopija)` : `Scena ${idx.items.length + 1}`;
    const name = prompt('Ime nove scene', base);
    if (name === null) return;
    clearTimeout(this.saveTimer);
    saveLocal(this.state, this.view.store);
    let data: SceneFile | null = null;
    if (kind === 'blank') data = blankSceneFile();
    else if (kind === 'copy') data = serialize(this.state, this.view.store);
    else if (osm) data = (await osm.load()).default as unknown as SceneFile;
    const newId = createScene(name.trim() || base, data);
    this.switchScene(newId);
    // če shranjevanja ni bilo (pomnilnik brskalnika poln), sceno uporabimo neposredno iz pomnilnika
    if (data && data.objects.length && this.view.store.list()[0]?.id !== data.objects[0].id) {
      applyScene(data, this.state, this.view.store);
      this.afterLoad();
    }
  }

  /** Izbirnik scene v zgornji vrstici: preklop in hitro dodajanje. */
  private sceneSwitcher(): HTMLElement {
    const box = el('div', 'seg sceneseg');
    const sel = el('select', 'scenesel');
    sel.title = 'Scena';
    let sig = '';
    this.syncs.push(() => {
      const idx = getIndex();
      const next = idx.items.map((m) => `${m.id}:${m.name}`).join('|') + `#${idx.current}`;
      if (next === sig) return;
      sig = next;
      sel.replaceChildren(...idx.items.map((m) => new Option(m.name, m.id)));
      sel.value = idx.current;
    });
    sel.onchange = () => this.switchScene(sel.value);
    const add = el('button', '', '+');
    add.title = 'Nova scena';
    add.onclick = () => this.newScene('blank');
    box.append(sel, add);
    return box;
  }

  /** Kartica z vsemi scenami: preklop, preimenovanje, brisanje, podvajanje. */
  private sceneList(): HTMLElement {
    const list = el('div', 'objlist');
    let sig = '';
    this.syncs.push(() => {
      const idx = getIndex();
      const next = idx.items.map((m) => `${m.id}:${m.name}`).join('|') + `#${idx.current}`;
      if (next === sig) return;
      sig = next;
      list.replaceChildren();
      for (const m of idx.items) {
        const row = el('div', `scenerow${m.id === idx.current ? ' on' : ''}`);
        const name = el('button', 'nm', m.name);
        name.onclick = () => this.switchScene(m.id);
        const ren = el('button', 'mini', '✎');
        ren.title = 'Preimenuj';
        ren.onclick = () => {
          const n = prompt('Novo ime scene', m.name);
          if (n !== null && n.trim()) {
            renameScene(m.id, n);
            this.sync();
          }
        };
        const del = el('button', 'mini', '🗑');
        del.title = 'Izbriši sceno';
        del.onclick = () => {
          if (!confirm(`Izbrišem sceno »${m.name}«?`)) return;
          const wasCurrent = m.id === currentSceneId();
          deleteScene(m.id);
          if (wasCurrent) {
            if (!loadLocal(this.state, this.view.store)) resetScene(this.state, this.view.store);
            this.afterLoad();
          } else this.sync();
        };
        row.append(name, ren, del);
        list.append(row);
      }
    });
    const btns = el('div', 'btns');
    const mk = (label: string, fn: () => void) => {
      const b = el('button', 'btn', label);
      b.onclick = fn;
      btns.append(b);
    };
    mk('+ Prazna', () => this.newScene('blank'));
    mk('+ Privzeta', () => this.newScene('default'));
    mk('Podvoji', () => this.newScene('copy'));
    // primeri: nova scena iz izbranega primera
    const tpl = el('select', 'scenesel tplsel');
    tpl.title = 'Nova scena iz primera';
    tpl.append(new Option('Primeri scen …', ''));
    const groups = new Map<string, HTMLOptGroupElement>();
    for (const [v, o] of Object.entries(OSM_SCENES) as Array<[string, ExampleScene]>) {
      let g = groups.get(o.group);
      if (!g) {
        g = document.createElement('optgroup');
        g.label = o.group;
        groups.set(o.group, g);
        tpl.append(g);
      }
      g.append(new Option(o.label, v));
    }
    tpl.onchange = () => {
      const v = tpl.value as OsmScene | '';
      tpl.value = '';
      if (v) this.newScene(v);
    };
    btns.append(tpl);
    return this.card('Scene', false, list, btns);
  }

  /** Postavi pojavno okno ob desni rob orodne vrstice, v višino gumba (vrstica se lahko pomika, zato fiksen položaj). */
  private placePopover(pop: HTMLElement, anchor: HTMLElement): void {
    const bar = this.addbar.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    pop.style.left = `${bar.right + 8}px`;
    pop.style.top = `${Math.max(8, Math.min(a.top, window.innerHeight - 120))}px`;
  }

  private buildAddbar(): void {
    const { view } = this;
    const add = (t: ObjectType) => view.store.add(t, view.groundTarget());
    const btn = (t: ObjectType, title: string) => {
      const b = el('button', '', icon(t));
      b.title = `Dodaj: ${title}`;
      b.onclick = () => add(t);
      this.addbar.append(b);
    };
    // kamera je v sceni samo ena; izbere se s tem gumbom (oranžen), kot tudi s klikom nanjo v sceni
    const camBtn = el('button', 'cambtn', icon('camera'));
    camBtn.title = 'Kamera: izberi in pokaži kamero v sceni';
    camBtn.onclick = () => {
      view.selectCamera();
      view.focusCamera();
    };
    this.syncs.push(() => camBtn.classList.toggle('on', view.cameraSelected));
    this.addbar.append(camBtn, el('div', 'sep'));
    const first: Array<[ObjectType, string]> = [['box', 'Škatla'], ['sphere', 'Krogla'], ['cylinder', 'Valj'], ['cone', 'Stožec'], ['figure', 'Moški'], ['woman', 'Ženska']];
    // figure: pred dodajanjem izberete višino
    const sizePop = el('div', 'popover sizepop');
    sizePop.hidden = true;
    const KEY_H = 'perspective-helper:figure-height-cm';
    let lastH = 180;
    try {
      lastH = parseFloat(localStorage.getItem(KEY_H) ?? '') || 180;
    } catch {
      /* brez shranjevanja */
    }
    const KEY_W = 'perspective-helper:figure-weight-kg';
    let lastW = 75;
    try {
      lastW = parseFloat(localStorage.getItem(KEY_W) ?? '') || 75;
    } catch {
      /* brez shranjevanja */
    }
    let sizeType: ObjectType = 'figure';
    const title = el('div', 'hint', 'Višina figure (cm)');
    const heightInput = el('input');
    heightInput.type = 'number';
    heightInput.step = '1';
    heightInput.min = '30';
    heightInput.max = '300';
    heightInput.value = String(lastH);
    const weightTitle = el('div', 'hint', 'Teža (kg): vpliva na postavo');
    const weightInput = el('input');
    weightInput.type = 'number';
    weightInput.step = '1';
    weightInput.min = '20';
    weightInput.max = '250';
    weightInput.value = String(lastW);
    const wchips = el('div', 'chips');
    for (const kg of [50, 60, 75, 90, 110, 140]) {
      const c = el('button', 'chip', String(kg));
      c.onclick = () => (weightInput.value = String(kg));
      wchips.append(c);
    }
    const chips = el('div', 'chips');
    for (const [h, lab] of [[120, 'otrok'], [150, '150'], [160, '160'], [170, '170'], [180, '180'], [190, '190'], [200, '200']] as Array<[number, string]>) {
      const c = el('button', 'chip', lab);
      c.onclick = () => (heightInput.value = String(h));
      chips.append(c);
    }
    const addSized = el('button', 'btn', 'Dodaj figuro');
    addSized.onclick = () => {
      const cm = Math.min(300, Math.max(30, parseFloat(heightInput.value) || 180));
      const h = cm / 100;
      const kg = Math.min(250, Math.max(20, parseFloat(weightInput.value) || 75));
      try {
        localStorage.setItem(KEY_W, String(kg));
        localStorage.setItem(KEY_H, String(cm));
      } catch {
        /* brez shranjevanja */
      }
      const o = add(sizeType);
      const base = o.size;
      const k = h / base[1];
      // postava iz ITM (kg / m²): referenčni 22; širina in globina rasteta z ITM
      const bmi = kg / (h * h);
      const wf = Math.min(2.2, Math.max(0.65, 1 + (bmi - 22) * 0.04));
      const df = Math.min(2.4, Math.max(0.7, 1 + (bmi - 22) * 0.05));
      view.store.update(o.id, { size: [base[0] * k * wf, h, base[2] * k * df], position: [o.position[0], h / 2, o.position[2]] });
      sizePop.style.display = 'none';
    };
    sizePop.append(title, heightInput, chips, weightTitle, weightInput, wchips, addSized);
    sizePop.style.display = 'none';
    this.addbar.append(sizePop);
    for (const [t, n] of first) {
      if (t === 'figure' || t === 'woman') {
        const b = el('button', '', icon(t));
        b.title = `Dodaj: ${n} (izberete višino)`;
        b.onclick = (e) => {
          e.stopPropagation();
          sizeType = t;
          title.textContent = `Višina: ${n} (cm)`;
          addSized.textContent = `Dodaj: ${n}`;
          const open = sizePop.style.display === 'none' || sizeType !== t;
          sizePop.style.display = open ? 'grid' : 'none';
          this.placePopover(sizePop, b);
          heightInput.value = String(t === 'woman' && !localStorage.getItem(KEY_H) ? 170 : lastH);
          weightInput.value = String(t === 'woman' && !localStorage.getItem(KEY_W) ? 60 : lastW);
        };
        this.addbar.append(b);
      } else btn(t, n);
    }
    window.addEventListener('pointerdown', (e) => {
      if (!sizePop.contains(e.target as Node)) sizePop.style.display = 'none';
    });
    // skupine (živali, hiše, okolje): ena ikona odpre seznam
    const group = (iconName: string, title: string, types: ObjectType[]) => {
      const gb = el('button', '', icon(iconName));
      gb.title = title;
      const pop = el('div', 'popover');
      pop.hidden = true;
      for (const t of types) {
        const b = el('button', '', TYPE_LABELS[t]);
        b.onclick = () => {
          add(t);
          pop.hidden = true;
        };
        pop.append(b);
      }
      gb.onclick = (e) => {
        e.stopPropagation();
        pop.hidden = !pop.hidden;
        this.placePopover(pop, gb);
      };
      window.addEventListener('pointerdown', (e) => {
        if (!pop.contains(e.target as Node)) pop.hidden = true;
      });
      this.addbar.append(gb, pop);
    };
    // paketi figur: uvožene figure (velikost, obleka, lasje, poza) se dodajo v sceno; scena si zapomni, iz katerega paketa so
    const packBtn = el('button', '', icon('people'));
    packBtn.title = 'Paketi figur';
    const packPop = el('div', 'popover');
    packPop.hidden = true;
    const fillPacks = () => {
      packPop.replaceChildren();
      const lib = listPacks();
      if (!lib.length) {
        const h = el('div', 'hint', 'Ni uvoženih paketov figur. Uvozi paket v kartici Datoteka (Uvozi paket figur).');
        h.style.gridColumn = '1 / -1';
        packPop.append(h);
        return;
      }
      for (const pack of lib) {
        const head = el('div', 'hint', pack.name);
        head.style.cssText = 'grid-column:1 / -1;display:flex;justify-content:space-between;align-items:center;gap:8px';
        const del = el('button', '', '✕');
        del.title = `Odstrani paket »${pack.name}« iz knjižnice (figure v scenah ostanejo)`;
        del.style.cssText = 'width:auto;height:auto;padding:2px 6px';
        del.onclick = () => {
          if (confirm(`Odstranim paket »${pack.name}« iz knjižnice? Figure v obstoječih scenah ostanejo.`)) {
            removePack(pack.id);
            fillPacks();
          }
        };
        head.append(del);
        packPop.append(head);
        for (const f of pack.figures) {
          const b = el('button', '', f.name);
          b.onclick = () => {
            this.addPackFigure(pack, f);
            packPop.hidden = true;
          };
          packPop.append(b);
        }
      }
    };
    this.refreshPacks = fillPacks;
    packBtn.onclick = (e) => {
      e.stopPropagation();
      fillPacks();
      packPop.hidden = !packPop.hidden;
      this.placePopover(packPop, packBtn);
    };
    window.addEventListener('pointerdown', (e) => {
      if (!packPop.contains(e.target as Node)) packPop.hidden = true;
    });
    this.addbar.append(packBtn, packPop);
    group('dog', 'Živali', ['dog', 'horse', 'elephant', ...ANIMAL_TYPES]);
    group('wall', 'Stene in pohištvo', ['wall', 'wallDoor', 'wallWindow', 'table', 'chair']);
    group('house', 'Stavbe', ['house', 'houseHip', 'houseTwo', 'cottage', 'barn', 'hayrack', 'shell', 'townhouse', 'block', 'tower', 'church']);
    group('ferris', 'Znamenitosti', ['eiffel', 'colosseum', 'ferris']);
    group('car', 'Vozila', ['car', 'hatch', 'suv', 'van', 'bus', 'boat']);
    group('tree', 'Narava', ['tree', 'pine', 'bush', 'hill', 'terrain', 'river']);
    group('road', 'Ceste in dvorišča', ['road', 'bridge', 'yard']);
    this.root.append(this.addbar);
  }

  // ---- stranska vrstica ----

  private buildSidebar(): void {
    const { view, state } = this;
    const side = el('div');
    side.id = 'sidebar';
    const toggle = el('button', '', icon('menu'));
    toggle.id = 'sbToggle';
    // nastavitve so ob prvem obisku zaprte; izbira se zapomni
    const KEY = 'perspective-helper:sidebar';
    const setOpen = (open: boolean) => {
      side.classList.toggle('collapsed', !open);
      document.body.classList.toggle('sb-open', open);
      try {
        localStorage.setItem(KEY, open ? 'open' : 'closed');
      } catch {
        /* brez shranjevanja */
      }
    };
    toggle.title = 'Nastavitve';
    toggle.onclick = () => setOpen(side.classList.contains('collapsed'));
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* brez shranjevanja */
    }
    setOpen(saved === 'open');
    const cam = () => this.changed(() => view.refreshCamera());
    const c = state.camera;

    // kamera
    // ribje oko je ena od možnosti perspektive; vrsta se pokaže samo zanj
    let lastRadial: typeof c.projection = 'equidistant';
    type Persp = '1pt' | '2pt' | '3pt' | 'fish';
    const persp = this.seg<Persp>(
      [['1pt', '1 točka'], ['2pt', '2 točki'], ['3pt', '3 točke'], ['fish', 'Ribje oko']],
      () => (c.projection !== 'rectilinear' ? 'fish' : c.mode),
      (m) => {
        if (m === 'fish') {
          c.projection = lastRadial;
          c.mode = '3pt';
          if (c.focalMm > 24) c.focalMm = 10;
        } else {
          c.projection = 'rectilinear';
          c.mode = m;
        }
        cam();
        this.sync();
      },
      'full small',
    );
    const focalChips = el('div', 'chips');
    for (const f of [14, 24, 35, 50, 85, 135]) focalChips.append(this.chip(`${f}`, () => Math.round(c.focalMm) === f, () => { c.focalMm = f; cam(); }));
    const aspect = el('select', 'sel');
    Object.keys(ASPECTS).forEach((k) => aspect.append(new Option(k, k)));
    aspect.onchange = () => { c.aspect = aspect.value; cam(); };
    this.syncs.push(() => (aspect.value = c.aspect));
    const proj = el('select', 'sel');
    Object.entries(PROJECTION_LABELS).filter(([k]) => k !== 'rectilinear').forEach(([k, v]) => proj.append(new Option(v, k)));
    proj.onchange = () => { lastRadial = proj.value as typeof c.projection; c.projection = lastRadial; cam(); };
    const projRow = this.row('Vrsta ribjega očesa', proj);
    this.syncs.push(() => {
      if (c.projection !== 'rectilinear') lastRadial = c.projection;
      proj.value = lastRadial;
      projRow.hidden = c.projection === 'rectilinear';
    });
    this.buildCameraBar(cam);
    const hint = el('div', 'hint', 'Rotacijo in položaj kamere nastaviš v vrstici Kamera spodaj ali povleci bežišča v kadru. Alt: ohrani gorišče.');
    const camCard = this.card(
      'Kamera',
      false,
      persp,
      projRow,
      this.slider('Goriščna razdalja', () => (c.projection === 'rectilinear' ? 8 : 2), 300, 1, () => c.focalMm, (v) => { c.focalMm = v; cam(); }, (v) => `${Math.round(v)} mm`, undefined, { unit: 'mm', decimals: 0 }),
      focalChips,
      this.row('Razmerje kadra', aspect),
      hint,
    );

    // luč
    const light = () => this.changed(() => view.refreshLight());
    const dial = this.lightDial(light);
    const lightCard = this.card(
      'Luč',
      false,
      dial,
      this.chip('Brez luči (samo okolica)', () => state.light.ratio <= 0.01, (v) => { state.light.ratio = v ? 0 : 4; light(); }),
      this.slider('Kontrast (luč : okolica)', 0, 15, 0.1, () => state.light.ratio, (v) => { state.light.ratio = v; light(); }, (v) => String(+v.toFixed(1)), undefined, { unit: '', decimals: 1 }),
      this.slider('Ambientna okluzija', 0, 1, 0.05, () => state.view.ao, (v) => this.changed(() => { state.view.ao = v; view.invalidate(); }), (v) => String(v), undefined, { unit: '%', decimals: 0, scale: 100 }),
      this.slider('Svetlost', 0.3, 2.5, 0.01, () => state.light.exposure, (v) => { state.light.exposure = v; light(); }, (v) => String(+v.toFixed(2)), undefined, { unit: '', decimals: 2 }),
    );

    // vodila
    const g = state.guides;
    const gd = (fn: () => void) => () => this.changed(() => { fn(); view.invalidate(); });
    const vps = el('div', 'chips');
    vps.append(
      this.chip('Horizont', () => g.horizon, gd(() => (g.horizon = !g.horizon)), '#ff2d95'),
      this.chip('X', () => g.vpX, gd(() => (g.vpX = !g.vpX)), '#e5484d'),
      this.chip('Y', () => g.vpY, gd(() => (g.vpY = !g.vpY)), '#2fa84f'),
      this.chip('Z', () => g.vpZ, gd(() => (g.vpZ = !g.vpZ)), '#3e7bfa'),
    );
    const more = el('div', 'chips');
    more.append(
      this.chip('Snop črt', () => g.fan, gd(() => (g.fan = !g.fan))),
      this.chip('Objekt', () => g.objectVps, gd(() => (g.objectVps = !g.objectVps)), '#ff9f1c'),
      this.chip('Vodila objekta', () => g.objectEdges, gd(() => (g.objectEdges = !g.objectEdges)), '#ff9f1c'),
      this.chip('Okvirji', () => g.boxes, gd(() => (g.boxes = !g.boxes)), '#d7263d'),
      this.chip('A B C', () => g.labels === 'abc', gd(() => (g.labels = g.labels === 'abc' ? 'xyz' : 'abc'))),
      this.chip('mm', () => g.showFocal, gd(() => (g.showFocal = !g.showFocal))),
    );
    const guidesCard = this.card(
      'Vodila',
      false,
      vps,
      more,
      this.slider('Gostota snopa', 2, 40, 1, () => g.fanDensity, (v) => gd(() => (g.fanDensity = v))(), (v) => String(Math.round(v)), () => g.fan, { unit: '', decimals: 0 }),
      this.slider('Papir okoli kadra', 0, 2, 0.05, () => state.view.paper, (v) => this.changed(() => { state.view.paper = v; view.resize(); }), (v) => String(+v.toFixed(2)), undefined, { unit: '', decimals: 2 }),
    );

    // prikaz
    const style = this.seg<ObjectStyle>([['solid', 'Mavec'], ['edges', 'Robovi'], ['both', 'Oboje']], () => state.view.objectStyle, (v) => this.changed(() => { state.view.objectStyle = v; view.store.setStyle(v); }), 'full');
    const flags = el('div', 'chips');
    flags.append(
      this.chip('Belo ozadje kadra', () => state.view.whiteBg, (v) => this.changed(() => { state.view.whiteBg = v; view.invalidate(); })),
      this.chip('Mreža v kadru', () => state.view.gridInFrame, (v) => this.changed(() => { state.view.gridInFrame = v; view.invalidate(); })),
      (() => {
        const b = this.chip('Pripenjanje', () => state.view.snap, (v) => this.changed(() => { state.view.snap = v; view.applySnap(); }));
        b.title = 'Pripenjanje na mrežo: premik po 0,25 m, rotacija po 5°, velikost po 0,05 m. Izklopljeno: gladko gibanje.';
        return b;
      })(),
    );
    const layout = this.seg<'stacked' | 'side'>([['stacked', 'Eno pod drugim'], ['side', 'Eno ob drugem']], () => state.view.layout, (v) => this.changed(() => { state.view.layout = v; view.resize(); }), 'full small');
    // barva tal v kadru
    const swatches = el('div', 'chips');
    const setFloor = (c: string) => this.changed(() => { state.view.floorColor = c; view.invalidate(); });
    for (const [c, title] of [['', 'Brez'], ['#d9cfb8', 'Pesek'], ['#bfd3b5', 'Trava'], ['#bccddc', 'Voda'], ['#e2c3bb', 'Opeka'], ['#a9a9ad', 'Siva']] as const) {
      const b = el('button', 'swatch');
      b.title = title;
      b.style.background = c || 'repeating-linear-gradient(45deg,#fff 0 4px,#ccc 4px 8px)';
      b.onclick = () => setFloor(c);
      this.syncs.push(() => b.classList.toggle('on', state.view.floorColor === c));
      swatches.append(b);
    }
    const picker = el('input', 'picker');
    picker.type = 'color';
    picker.title = 'Poljubna barva';
    picker.oninput = () => setFloor(picker.value);
    this.syncs.push(() => { if (state.view.floorColor) picker.value = state.view.floorColor; });
    swatches.append(picker);
    const edgeW = this.slider('Debelina robov', 1, 8, 0.5, () => state.view.edgeWidth, (v) => this.changed(() => { state.view.edgeWidth = v; view.invalidate(); }), (v) => `${v} px`, () => state.view.objectStyle === 'edges', { unit: 'px', decimals: 1 });
    const viewCard = this.card('Prikaz', false, this.row('Objekti', style), edgeW, this.row('Scena + kader', layout), this.row('Tla v kadru', swatches), flags);

    // datoteka
    const run = (fn: () => void | Promise<void>) => async () => {
      try {
        await fn();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    };
    const btn = (label: string, fn: () => void | Promise<void>, tip?: string) => {
      const b = el('button', 'btn', label);
      if (tip) b.title = tip;
      b.onclick = run(fn);
      return b;
    };
    const files = el('div', 'btns');
    files.append(
      btn('Shrani sceno', () => downloadScene(state, view.store), 'Prenese sceno kot datoteko JSON'),
      btn('Odpri sceno', async () => {
        const data = await pickSceneFile();
        checkRequirements(data); // scene s figurami iz paketov: paket mora biti prej uvožen
        applyScene(data, state, view.store);
        const name = sceneNameOf(data);
        if (name) renameScene(currentSceneId(), name);
        this.afterLoad();
      }, 'Odpre sceno iz datoteke JSON'),
      btn('PNG + vodila', async () => downloadBlob(await view.exportPng(2400, true), `${fileSafeName()}-kader-z-vodili.png`)),
      btn('PNG čisto', async () => downloadBlob(await view.exportPng(2400, false), `${fileSafeName()}-kader.png`)),
    );
    const packs = el('div', 'btns');
    packs.append(
      btn('Uvozi paket figur', async () => {
        const pack = parsePack(await pickSceneFile());
        if (!savePack(pack)) throw new Error('Paketa ni mogoče shraniti: v brskalniku ni več prostora.');
        this.refreshPacks();
        alert(`Uvožen paket »${pack.name}« (${pack.figures.length} figur). Najdeš ga v levi vrstici pod ikono Paketi figur.`);
      }),
    );
    const fileCard = this.card('Datoteka', false, files, packs);

    side.append(this.sceneList(), this.objectList(), this.poseCard(), camCard, lightCard, guidesCard, viewCard, fileCard);
    // navedba virov za primere mest (obvezna po licenci ODbL)
    const credits = el('div', 'credits');
    credits.innerHTML = 'Primeri mest (Ljubljana, Pariz, London, Tokio, New York, Rim, Benetke): stavbe, ulice in vode © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">prispevki OpenStreetMap</a> (licenca ODbL); višine terena: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a>.';
    side.append(credits);
    this.root.append(side, toggle);
  }

  /** Seznam predmetov v sceni: klik izbere predmet (kot klik v sceni) in pogled urejevalnika se usmeri nanj. */
  private objectList(): HTMLElement {
    const { view } = this;
    const list = el('div', 'objlist');
    let sig = '';
    const render = () => {
      const items = view.store.list();
      const sel = view.cameraSelected ? 'camera' : (view.store.selectedId ?? '');
      const next = items.map((o) => `${o.id}:${o.name}:${o.type}`).join('|') + `#${sel}`;
      if (next === sig) return;
      sig = next;
      list.replaceChildren();
      const row = (label: string, sub: string, active: boolean, onClick: () => void, onRename?: () => void) => {
        const b = el('button', `objrow${active ? ' on' : ''}`);
        b.append(el('span', 'nm', label), el('span', 'sub', sub));
        b.onclick = onClick;
        if (onRename) {
          b.title = 'Dvojni klik za preimenovanje';
          b.ondblclick = onRename;
        }
        list.append(b);
      };
      row('Kamera', 'kompozicijska', sel === 'camera', () => {
        view.selectCamera();
        view.focusCamera();
      });
      for (const o of items) {
        row(o.name, TYPE_LABELS[o.type] ?? o.type, o.id === sel, () => {
          view.store.select(o.id);
          const m = view.store.mesh(o.id);
          if (m) view.focusOn(m);
        }, () => this.renameObject(o.id));
      }
      if (!items.length) list.append(el('div', 'hint', 'V sceni ni predmetov.'));
    };
    this.syncs.push(render);
    return this.card('Predmeti v sceni', false, list);
  }

  /** Poza figure: pripravljene poze in drsniki za sklepe (prikaže se samo, ko je izbrana figura). */
  private poseCard(): HTMLElement {
    const { store } = this.view;
    const sel = () => {
      const p = store.selected();
      return p && isPosable(p.type) ? p : undefined;
    };
    const content = el('div');
    content.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    let current = '';
    const rebuild = (rig: Rig | null) => {
      current = rig?.id ?? '';
      content.replaceChildren();
      this.poseSyncs = [];
      if (!rig) return;
      this.syncTarget = this.poseSyncs;
      const presets = el('div', 'chips');
      for (const name of Object.keys(rig.poses)) {
        const b = el('button', 'chip', name);
        b.onclick = () => {
          const p = sel();
          if (p) store.setPose(p.id, rig.poses[name]);
        };
        presets.append(b);
      }
      content.append(presets);
      if (rig.id === 'man' || rig.id === 'woman') {
        const pick = (label: string, key: 'outfit' | 'hair' | 'weaponR' | 'weaponL', opts: Record<string, string>) => {
          const sel_ = el('select', 'sel');
          for (const [v, l] of Object.entries(opts)) sel_.append(new Option(l, v));
          sel_.onchange = () => {
            const p = sel();
            if (p) store.update(p.id, { [key]: sel_.value === 'none' ? undefined : sel_.value });
          };
          this.poseSyncs.push(() => (sel_.value = sel()?.[key] ?? 'none'));
          content.append(this.row(label, sel_));
        };
        pick('Obleka', 'outfit', OUTFITS);
        pick('Lasje', 'hair', HAIRS);
        pick('Orožje/ščit: desna roka', 'weaponR', WEAPONS);
        pick('Orožje/ščit: leva roka', 'weaponL', WEAPONS);
      }
      content.append(el('div', 'hint', 'V sceni klikni rumeno piko (sklep) in jo zavrti z gizmom.'));
      for (const g of rig.groups) {
        const d = el('details');
        d.append(el('summary', 'hint', g.title));
        const body = el('div');
        body.style.cssText = 'display:flex;flex-direction:column;gap:9px;padding-top:8px';
        for (const j of g.joints) {
          const labels = axesOf(rig, j);
          const lim = limitsOf(rig, j);
          labels.forEach((label, i) => {
            const [lo, hi] = lim[i];
            if (lo === hi) return;
            body.append(
              this.slider(
                `${rig.def[j].label}: ${label}`,
                lo,
                hi,
                1,
                () => {
                  const p = sel();
                  return p ? (store.getPose(p.id)[j]?.[i] ?? 0) : 0;
                },
                (v) => {
                  const p = sel();
                  if (!p) return;
                  const a = store.getPose(p.id)[j];
                  a[i] = v;
                  store.setPoseAngles(p.id, j, a);
                },
                (v) => `${Math.round(v)}°`,
                undefined,
                { unit: '°', decimals: 0 },
              ),
            );
          });
        }
        d.append(body);
        content.append(d);
      }
      this.syncTarget = null;
    };
    const card = this.card('Poza', false, content);
    this.syncs.push(() => {
      const p = sel();
      card.hidden = !p;
      const rig = p ? rigOf(p.type) : null;
      if ((rig?.id ?? '') !== current) rebuild(rig);
    });
    return card;
  }

  /** Okrogel izbirnik smeri luči: kot = azimut, razdalja od roba = višina nad obzorjem (pogled od zgoraj). */
  private lightDial(onChange: () => void): HTMLElement {
    const L = this.state.light;
    const dial = el('div', 'dial');
    const dot = el('i');
    const cap = el('small');
    dial.append(dot, cap);
    const R = 56;
    this.syncs.push(() => {
      const r = ((90 - L.elevation) / 87) * (R - 9);
      const az = (L.azimuth * Math.PI) / 180;
      dot.style.left = `${R + Math.sin(az) * r}px`;
      dot.style.top = `${R + Math.cos(az) * r}px`;
      cap.textContent = `${Math.round(L.azimuth)}° · ${Math.round(L.elevation)}°`;
    });
    const set = (e: PointerEvent) => {
      const b = dial.getBoundingClientRect();
      const dx = e.clientX - (b.left + b.width / 2);
      const dy = e.clientY - (b.top + b.height / 2);
      L.azimuth = Math.round((Math.atan2(dx, dy) * 180) / Math.PI);
      L.elevation = Math.round(Math.max(3, 90 - Math.min(1, Math.hypot(dx, dy) / (b.width / 2 - 9)) * 87));
      onChange();
    };
    dial.onpointerdown = (e) => {
      dial.setPointerCapture(e.pointerId);
      set(e);
    };
    dial.onpointermove = (e) => {
      if (dial.hasPointerCapture(e.pointerId)) set(e);
    };
    dial.style.marginBottom = '14px';
    return dial;
  }

  /** Nastavitve rotacije kamere: pokažejo se, ko je kamera izbrana v sceni (ali v pogledu samo kader). */
  private buildCameraBar(cam: () => void): void {
    const c = this.state.camera;
    const bar = el('div', 'floatbar');
    bar.id = 'camBar';
    bar.append(
      el('span', 'name', 'Kamera'),
      this.slider('Yaw', -180, 180, 0.5, () => c.yaw, (v) => { c.yaw = v; cam(); }, (v) => `${v.toFixed(1)}°`, undefined, { unit: '°', decimals: 1 }),
      this.slider('Pitch', -89, 89, 0.5, () => c.pitch, (v) => { c.pitch = v; cam(); }, (v) => `${v.toFixed(1)}°`, () => c.mode === '3pt', { unit: '°', decimals: 1 }),
      this.slider('Roll', -180, 180, 0.5, () => c.roll, (v) => { c.roll = v; cam(); }, (v) => `${v.toFixed(1)}°`, () => c.mode === '3pt', { unit: '°', decimals: 1 }),
      this.slider('Lens shift', -1, 1, 0.005, () => c.shiftY, (v) => { c.shiftY = v; cam(); }, (v) => v.toFixed(2), () => c.mode !== '3pt', { unit: '', decimals: 3 }),
      this.slider('Višina oči', 0.1, 20, 0.05, () => c.eyeHeight, (v) => { c.eyeHeight = v; cam(); }, (v) => `${v.toFixed(2)} m`, undefined, { unit: 'm', decimals: 2 }),
    );
    // premik kamere: naprej/nazaj in levo/desno glede na smer pogleda (po tleh), ob držanju se ponavlja
    const pad = el('div', 'dpad');
    const move = (fwd: number, side: number, big: boolean) => {
      const step = big ? 1 : 0.25;
      const a = (c.yaw * Math.PI) / 180;
      c.x += (Math.sin(a) * fwd + Math.cos(a) * side) * step;
      c.z += (-Math.cos(a) * fwd + Math.sin(a) * side) * step;
      cam();
    };
    const dirBtn = (label: string, title: string, fwd: number, side: number, area: string) => {
      const b = el('button', '', label);
      b.title = title;
      b.style.gridArea = area;
      let timer = 0;
      let rep = 0;
      const stop = () => {
        clearTimeout(timer);
        clearInterval(rep);
      };
      b.onpointerdown = (e) => {
        e.preventDefault();
        move(fwd, side, e.shiftKey);
        timer = window.setTimeout(() => (rep = window.setInterval(() => move(fwd, side, e.shiftKey), 70)), 300);
      };
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel'] as const) b.addEventListener(ev, stop);
      pad.append(b);
    };
    dirBtn('▲', 'Naprej (Shift: 1 m)', 1, 0, 'f');
    dirBtn('◀', 'Levo', 0, -1, 'l');
    dirBtn('▶', 'Desno', 0, 1, 'r');
    dirBtn('▼', 'Nazaj', -1, 0, 'b');
    const posRow = (label: string, get: () => number, set: (v: number) => void) => {
      const lb = el('label', 'pos', label);
      const inp = el('input');
      inp.type = 'number';
      inp.step = '0.1';
      inp.onchange = () => {
        const v = parseFloat(inp.value);
        if (isFinite(v)) {
          set(v);
          cam();
        }
      };
      this.syncs.push(() => {
        if (document.activeElement !== inp) inp.value = get().toFixed(2);
      });
      lb.append(inp);
      return lb;
    };
    const mv = el('div', 'move');
    mv.append(el('span', 'hint', 'Premik'), pad, posRow('X', () => c.x, (v) => (c.x = v)), posRow('Z', () => c.z, (v) => (c.z = v)));
    bar.append(mv);
    // vrstica je vedno vidna; naslov jo skrči/razširi
    bar.classList.add('show');
    const title = bar.querySelector('.name') as HTMLElement;
    title.style.cursor = 'pointer';
    title.title = 'Skrči / razširi';
    const KEY = 'perspective-helper:cambar';
    const setMin = (min: boolean) => {
      bar.classList.toggle('min', min);
      title.textContent = min ? 'Kamera ▸' : 'Kamera ▾';
      try {
        localStorage.setItem(KEY, min ? 'min' : 'open');
      } catch {
        /* brez shranjevanja */
      }
    };
    title.onclick = () => setMin(!bar.classList.contains('min'));
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* brez shranjevanja */
    }
    setMin(saved === 'min');
    this.stack.append(bar);
  }

  // ---- vrstica izbranega objekta ----

  /** Osveži seznam paketov figur v levi vrstici (po uvozu). */
  private refreshPacks: () => void = () => {};

  /** Doda figuro iz paketa v sceno: velikost, obleka, lasje in poza so iz paketa; scena si zapomni paket (figureRef). */
  private addPackFigure(pack: FigurePack, f: FigureDef): void {
    const { view } = this;
    const o = view.store.add(f.type, view.groundTarget());
    view.store.update(o.id, {
      name: f.name,
      size: [...f.size],
      position: [o.position[0], f.size[1] / 2, o.position[2]],
      outfit: f.outfit,
      hair: f.hair,
      weaponR: f.weaponR,
      weaponL: f.weaponL,
      pose: f.pose ? structuredClone(f.pose) : {},
      figureRef: figureRef(pack.id, f.id),
    });
  }

  /** Vpraša za novo ime predmeta in ga preimenuje. */
  private renameObject(id: string): void {
    const p = this.view.store.get(id);
    if (!p) return;
    const n = prompt('Novo ime predmeta', p.name);
    if (n === null || !n.trim()) return;
    this.view.store.rename(id, n);
    this.syncSelection();
    this.sync();
  }

  private buildSelbar(): void {
    const { view } = this;
    const bar = this.selbar;
    bar.id = 'selbar';
    bar.className = 'floatbar';
    this.selName.title = 'Klikni za preimenovanje';
    this.selName.onclick = () => {
      const id = view.store.selectedId;
      if (id && !view.cameraSelected) this.renameObject(id);
    };
    bar.append(this.selName);
    type Key = 'px' | 'py' | 'pz' | 'rx' | 'ry' | 'rz' | 'sx' | 'sy' | 'sz';
    const read = (k: Key): number => {
      const p = view.store.selected();
      if (!p) return 0;
      return { px: p.position[0], py: p.position[1], pz: p.position[2], rx: p.rotation[0], ry: p.rotation[1], rz: p.rotation[2], sx: p.size[0], sy: p.size[1], sz: p.size[2] }[k];
    };
    const write = (k: Key, v: number) => {
      const p = view.store.selected();
      if (!p) return;
      const pos = [...p.position] as [number, number, number];
      const rot = [...p.rotation] as [number, number, number];
      const size = [...p.size] as [number, number, number];
      if (k === 'px') pos[0] = v;
      else if (k === 'py') pos[1] = v;
      else if (k === 'pz') pos[2] = v;
      else if (k === 'rx') rot[0] = v;
      else if (k === 'ry') rot[1] = v;
      else if (k === 'rz') rot[2] = v;
      else size[{ sx: 0, sy: 1, sz: 2 }[k]] = Math.max(0.01, v);
      view.store.update(p.id, { position: pos, rotation: rot, size });
    };
    const add = (label: string, k: Key, min: number, max: number, step: number, unit: string) =>
      bar.append(this.slider(label, min, max, step, () => read(k), (v) => write(k, v), (v) => v.toFixed(2), undefined, { unit, decimals: unit === '°' ? 0 : 2 }));
    add('X', 'px', -15, 15, 0.05, 'm');
    add('Y (višina)', 'py', 0, 10, 0.05, 'm');
    add('Z', 'pz', -15, 15, 0.05, 'm');
    add('Rotacija X', 'rx', -180, 180, 1, '°');
    add('Rotacija Y', 'ry', -180, 180, 1, '°');
    add('Rotacija Z', 'rz', -180, 180, 1, '°');
    add('Širina', 'sx', 0.05, 8, 0.05, 'm');
    add('Višina', 'sy', 0.05, 8, 0.05, 'm');
    add('Globina', 'sz', 0.05, 8, 0.05, 'm');
    // odprtina v steni (vrata/okno)
    const wallSel = () => {
      const p = view.store.selected();
      return p && isWallType(p.type) ? p : undefined;
    };
    const addOp = (label: string, key: 'w' | 'h' | 'x' | 'y', min: number, max: number) =>
      bar.append(
        this.slider(
          label,
          min,
          max,
          0.05,
          () => {
            const p = wallSel();
            return p ? clampOpening(p.size, { ...DEFAULT_OPENING[p.type as 'wallDoor' | 'wallWindow'], ...p.opening })[key] : 0;
          },
          (v) => {
            const p = wallSel();
            if (!p) return;
            const cur = clampOpening(p.size, { ...DEFAULT_OPENING[p.type as 'wallDoor' | 'wallWindow'], ...p.opening });
            view.store.update(p.id, { opening: { ...cur, [key]: v } });
          },
          (v) => v.toFixed(2),
          () => !!wallSel(),
          { unit: 'm', decimals: 2 },
        ),
      );
    addOp('Odprtina: širina', 'w', 0.2, 6);
    addOp('Odprtina: višina', 'h', 0.2, 4);
    addOp('Odmik X', 'x', -3, 3);
    addOp('Dvig od tal', 'y', 0, 3);
    const lift = el('button', '', icon('lift'));
    lift.title = 'Dvig: povleci objekt navpično (ali drži Shift)';
    lift.onclick = () => {
      view.liftMode = !view.liftMode;
      this.sync();
    };
    this.syncs.push(() => lift.classList.toggle('on', view.liftMode));
    for (const b of [lift]) b.querySelector('svg')!.style.cssText = 'width:16px;height:16px';
    const dup = el('button', '', icon('copy'));
    dup.title = 'Podvoji (Ctrl/⌘+D)';
    dup.onclick = () => view.store.selectedId && view.store.duplicate(view.store.selectedId);
    const del = el('button', '', icon('trash'));
    del.title = 'Izbriši (Del)';
    del.onclick = () => view.store.selectedId && view.store.remove(view.store.selectedId);
    bar.append(lift, dup, del);
    for (const b of [dup, del]) b.querySelector('svg')!.style.cssText = 'width:16px;height:16px';
    this.stack.prepend(bar);
  }

  private syncSelection(): void {
    const p = this.view.store.selected();
    this.selbar.classList.toggle('show', !!p && !this.view.cameraSelected);
    this.selName.textContent = p && !this.view.cameraSelected ? p.name : 'Ni izbranega predmeta';
    if (!p) return;
    this.sync();
  }

  private syncChrome(): void {
    const v = this.view;
    const edit = v.mode !== 'frame';
    this.tools.style.display = edit ? '' : 'none';
    this.addbar.style.display = edit ? '' : 'none';
    this.hint.textContent = v.mode === 'frame' ? 'Povleci bežišča ali horizont · Tab: pogled' : 'Povleci objekt po tleh · Shift ali ⇕: dvig · klik na kamero (oranžna) · Tab: pogled';
    this.sync();
  }

  private afterLoad(): void {
    this.view.refreshCamera();
    this.view.refreshLight();
    this.view.applySnap();
    this.view.frameAll();
    this.view.store.setStyle(this.state.view.objectStyle);
    this.sync();
    this.syncSelection();
    this.history.reset();
    this.scheduleSave();
  }

  /** Po razveljavi/ponovi: osveži kamero, luč, prikaz in vmesnik (zgodovine ne ponastavi). */
  private afterHistory(): void {
    this.view.refreshCamera();
    this.view.refreshLight();
    this.view.applySnap();
    this.view.store.setStyle(this.state.view.objectStyle);
    this.sync();
    this.syncSelection();
    this.scheduleSave();
  }

  private undo(): void {
    this.history.undo();
  }

  private redo(): void {
    this.history.redo();
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.history.commit();
      if (!saveLocal(this.state, this.view.store) && !this.warnedStorage) {
        this.warnedStorage = true;
        alert('Brskalnik nima več prostora za shranjevanje scen, zato se te scene ne bo dalo obnoviti ob osvežitvi. Sceno shrani v datoteko (Datoteka → Shrani sceno) ali izbriši kakšno staro sceno (kartica Scene).');
      }
    }, AUTOSAVE_DELAY);
  }

  // ---- bližnjice ----

  private bindHotkeys(): void {
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      const typing = (t instanceof HTMLInputElement && !['range', 'checkbox'].includes(t.type)) || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
      if (typing) return;
      const store = this.view.store;
      const key = e.key.toLowerCase();
      if (key === 'tab') {
        e.preventDefault();
        const order = ['split', 'frame', 'editor'] as const;
        this.view.setMode(order[(order.indexOf(this.view.mode) + 1) % 3]);
      } else if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        this.redo();
      } else if ((key === 'delete' || key === 'backspace') && store.selectedId) {
        store.remove(store.selectedId);
      } else if (key === 'd' && (e.ctrlKey || e.metaKey) && store.selectedId) {
        e.preventDefault();
        store.duplicate(store.selectedId);
      } else if (!e.ctrlKey && !e.metaKey && this.view.mode !== 'frame') {
        if (key === 'h') this.view.setNavOnly(!this.view.navOnly);
        else if (key === 'w' || key === 'e' || key === 'r') {
          this.view.setNavOnly(false);
          this.view.setTransformMode(key === 'w' ? 'translate' : key === 'e' ? 'rotate' : 'scale');
        }
        this.sync();
      }
    });
  }
}
