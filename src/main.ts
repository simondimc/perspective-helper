import { loadLocal } from './io';
import { ObjectStore } from './objects';
import { SceneView } from './scene';
import { defaultObjects, defaultState } from './state';
import { UI } from './ui';

const state = defaultState();
const store = new ObjectStore();
const view = new SceneView(document.getElementById('app')!, state, store);

if (!loadLocal(state, store)) store.load(defaultObjects());
view.refreshCamera();
view.refreshLight();
view.applySnap();
store.setStyle(state.view.objectStyle);
new UI(view, state);

(window as unknown as { app: unknown }).app = { state, store, view };
