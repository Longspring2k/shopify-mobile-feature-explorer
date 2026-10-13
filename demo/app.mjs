import { mountFeatureExplorer } from '../src/browser-adapter.mjs';

const root = document.querySelector('[data-feature-explorer]');
const mounted = mountFeatureExplorer(root);
window.featureExplorer = mounted;
