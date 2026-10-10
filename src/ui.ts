import './ui.css';
import { ASPECTS } from './camera';
import { Rig, axesOf, limitsOf } from './figure';
import { isPosable, rigOf } from './rigs';
import { applyScene, downloadBlob, downloadScene, pickSceneFile, resetScene, saveLocal } from './io';
import { ANIMAL_TYPES } from './animalRigs';
import { ObjectStyle, ObjectType, TYPE_LABELS } from './objects';
import { DEFAULT_OPENING, clampOpening, isWallType } from './wall';
import { PROJECTION_LABELS } from './projection';
import { SceneView, TransformMode, ViewMode } from './scene';
import { AppState } from './state';

const AUTOSAVE_DELAY = 600;

const ICONS: Record<string, string> = {
  box: '<path d="M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10"/>',
  sphere: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="3.5"/><path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  cylinder: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/>',
  cone: '<path d="M12 3 5 18c0 1.7 3.1 3 7 3s7-1.3 7-3z"/><path d="M5 18c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  figure: '<circle cx="12" cy="5" r="2.5"/><path d="M8 21v-7l-2-3V9h12v2l-2 3v7M12 9v7"/>',
  woman: '<circle cx="12" cy="5" r="2.5"/><path d="M12 8l-4.5 10h9zM10 18v3M14 18v3"/>',
  table: '<path d="M3 9h18M5 9v11M19 9v11M7 9v6M17 9v6"/>',
  chair: '<path d="M7 4v16M7 12h10v8M17 12v8M7 4h2"/>',
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
  private stack = el('div', 'bottomstack');

  constructor(private view: SceneView, private state: AppState) {
    this.hint.id = 'hint';
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
    const btns = tools.map(([m, title, ic]) => {
      const b = el('button', '', icon(ic));
      b.title = title;
      b.onclick = () => {
        view.setTransformMode(m);
        this.sync();
      };
      this.tools.append(b);
      return [m, b] as const;
    });
    this.syncs.push(() => btns.forEach(([m, b]) => b.classList.toggle('on', view.transformMode === m && !view.cameraSelected && !view.selectedJoint)));
    bar.append(this.tools);
    this.root.append(bar);
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
    const first: Array<[ObjectType, string]> = [['box', 'Škatla'], ['sphere', 'Krogla'], ['cylinder', 'Valj'], ['cone', 'Stožec'], ['figure', 'Figura'], ['woman', 'Ženska']];
    first.forEach(([t, n]) => btn(t, n));
    // živali: ena ikona odpre seznam
    const animals: ObjectType[] = ['dog', 'horse', 'elephant', ...ANIMAL_TYPES];
    const ab = el('button', '', icon('dog'));
    ab.title = 'Živali';
    const pop = el('div', 'popover');
    pop.hidden = true;
    for (const t of animals) {
      const b = el('button', '', TYPE_LABELS[t]);
      b.onclick = () => {
        add(t);
        pop.hidden = true;
      };
      pop.append(b);
    }
    ab.onclick = (e) => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
      pop.style.top = `${ab.offsetTop}px`;
    };
    window.addEventListener('pointerdown', (e) => {
      if (!pop.contains(e.target as Node)) pop.hidden = true;
    });
    this.addbar.append(ab, pop);
    const rest: Array<[ObjectType, string]> = [['wall', 'Stena'], ['wallDoor', 'Stena z vrati'], ['wallWindow', 'Stena z oknom'], ['table', 'Miza'], ['chair', 'Stol']];
    rest.forEach(([t, n]) => btn(t, n));
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
    const btn = (label: string, fn: () => void | Promise<void>) => {
      const b = el('button', 'btn', label);
      b.onclick = run(fn);
      return b;
    };
    const files = el('div', 'btns');
    files.append(
      btn('Shrani JSON', () => downloadScene(state, view.store)),
      btn('Odpri JSON', async () => { applyScene(await pickSceneFile(), state, view.store); this.afterLoad(); }),
      btn('PNG + vodila', async () => downloadBlob(await view.exportPng(2400, true), 'kader-z-vodili.png')),
      btn('PNG čisto', async () => downloadBlob(await view.exportPng(2400, false), 'kader.png')),
    );
    const reset = btn('Ponastavi sceno', () => { if (confirm('Ponastavim sceno na začetno?')) { resetScene(state, view.store); this.afterLoad(); } });
    reset.style.color = 'var(--muted)';
    const fileCard = this.card('Datoteka', false, files, reset);

    side.append(this.poseCard(), camCard, lightCard, guidesCard, viewCard, fileCard);
    this.root.append(side, toggle);
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
      content.append(presets, el('div', 'hint', 'V sceni klikni rumeno piko (sklep) in jo zavrti z gizmom.'));
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

  private buildSelbar(): void {
    const { view } = this;
    const bar = this.selbar;
    bar.id = 'selbar';
    bar.className = 'floatbar';
    bar.append(this.selName);
    type Key = 'px' | 'py' | 'pz' | 'ry' | 'sx' | 'sy' | 'sz';
    const read = (k: Key): number => {
      const p = view.store.selected();
      if (!p) return 0;
      return { px: p.position[0], py: p.position[1], pz: p.position[2], ry: p.rotation[1], sx: p.size[0], sy: p.size[1], sz: p.size[2] }[k];
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
      else if (k === 'ry') rot[1] = v;
      else size[{ sx: 0, sy: 1, sz: 2 }[k]] = Math.max(0.01, v);
      view.store.update(p.id, { position: pos, rotation: rot, size });
    };
    const add = (label: string, k: Key, min: number, max: number, step: number, unit: string) =>
      bar.append(this.slider(label, min, max, step, () => read(k), (v) => write(k, v), (v) => v.toFixed(2), undefined, { unit, decimals: unit === '°' ? 0 : 2 }));
    add('X', 'px', -15, 15, 0.05, 'm');
    add('Y (višina)', 'py', 0, 10, 0.05, 'm');
    add('Z', 'pz', -15, 15, 0.05, 'm');
    add('Rotacija', 'ry', -180, 180, 1, '°');
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
    this.view.store.setStyle(this.state.view.objectStyle);
    this.sync();
    this.syncSelection();
    this.scheduleSave();
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => saveLocal(this.state, this.view.store), AUTOSAVE_DELAY);
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
      } else if ((key === 'delete' || key === 'backspace') && store.selectedId) {
        store.remove(store.selectedId);
      } else if (key === 'd' && (e.ctrlKey || e.metaKey) && store.selectedId) {
        e.preventDefault();
        store.duplicate(store.selectedId);
      } else if (!e.ctrlKey && !e.metaKey && this.view.mode !== 'frame') {
        if (key === 'w') this.view.setTransformMode('translate');
        else if (key === 'e') this.view.setTransformMode('rotate');
        else if (key === 'r') this.view.setTransformMode('scale');
        this.sync();
      }
    });
  }
}
