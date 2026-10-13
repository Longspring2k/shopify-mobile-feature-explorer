import { createExplorer } from './state-machine.mjs';

const MOBILE_QUERY = '(max-width: 47.999rem)';

export function mountFeatureExplorer(root, options = {}) {
  if (!(root instanceof Element)) throw new TypeError('root must be an Element');
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = [...root.querySelectorAll('[role="tabpanel"]')];
  if (!tabs.length || tabs.length !== panels.length) throw new Error('tabs and panels must have equal nonzero counts');

  const viewport = root.querySelector('[data-gesture-viewport]');
  const track = root.querySelector('[data-panel-track]');
  const previous = root.querySelector('[data-previous]');
  const next = root.querySelector('[data-next]');
  const status = root.querySelector('[data-status]');
  const paletteButtons = [...root.querySelectorAll('[data-palette]')];
  if (!viewport || !track || !previous || !next || !status) throw new Error('required explorer controls are missing');

  const media = matchMedia(MOBILE_QUERY);
  const controller = createExplorer({ ...options, count: tabs.length, mobile: media.matches });
  let destroyed = false;
  let suppressClick = false;
  const cleanups = [];
  const on = (target, type, handler, settings) => {
    target.addEventListener(type, handler, settings);
    cleanups.push(() => target.removeEventListener(type, handler, settings));
  };

  function render(state, { announce = false } = {}) {
    root.dataset.gesture = state.gesture;
    root.dataset.selectedIndex = String(state.selectedIndex);
    root.style.setProperty('--drag-offset', `${state.dragOffset}px`);
    tabs.forEach((tab, index) => {
      const selected = index === state.selectedIndex;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel, index) => {
      panel.hidden = index !== state.selectedIndex;
    });
    if (state.focusIndex !== null) {
      tabs[state.focusIndex]?.focus();
      controller.dispatch({ type: 'focus-applied' });
    }
    if (announce) status.textContent = `${tabs[state.selectedIndex].textContent.trim()} selected`;
  }

  function dispatch(event, renderOptions) {
    const previousOwner = controller.snapshot().ownerPointerId;
    const state = controller.dispatch(event);
    if (previousOwner !== null && state.ownerPointerId === null && event.type !== 'pointerup') suppressClick = false;
    if (previousOwner !== null && state.ownerPointerId === null && viewport.hasPointerCapture(previousOwner)) {
      viewport.releasePointerCapture(previousOwner);
    }
    render(state, renderOptions);
    return state;
  }

  tabs.forEach((tab, index) => {
    on(tab, 'click', () => dispatch({ type: 'select', index, source: 'button' }, { announce: true }));
  });

  on(root.querySelector('[role="tablist"]'), 'keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    dispatch({ type: 'key', key: event.key }, { announce: true });
  });
  on(previous, 'click', () => dispatch({ type: 'navigate', delta: -1, source: 'button' }, { announce: true }));
  on(next, 'click', () => dispatch({ type: 'navigate', delta: 1, source: 'button' }, { announce: true }));

  paletteButtons.forEach((button) => on(button, 'click', () => {
    const palette = button.dataset.palette;
    root.dataset.palette = palette;
    paletteButtons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
    status.textContent = `${button.textContent.trim()} palette selected`;
  }));

  on(viewport, 'pointerdown', (event) => {
    if (event.target.closest('button')) return;
    const previousOwner = controller.snapshot().ownerPointerId;
    const rect = viewport.getBoundingClientRect();
    const state = dispatch({
      type: 'pointerdown', pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      width: rect.width, isPrimary: event.isPrimary, button: event.button, pointerType: event.pointerType,
    });
    if (previousOwner === null && state.ownerPointerId === event.pointerId) {
      suppressClick = false;
      viewport.setPointerCapture(event.pointerId);
    }
  });
  on(viewport, 'pointermove', (event) => {
    const rect = viewport.getBoundingClientRect();
    const state = dispatch({ type: 'pointermove', pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width });
    if (state.ownerPointerId === event.pointerId && state.preventDefault) {
      event.preventDefault();
      suppressClick = true;
    }
  }, { passive: false });
  on(viewport, 'pointerup', (event) => {
    const rect = viewport.getBoundingClientRect();
    const before = controller.snapshot().selectedIndex;
    const state = dispatch({ type: 'pointerup', pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width }, { announce: true });
    suppressClick ||= state.selectedIndex !== before;
  });
  on(viewport, 'pointercancel', (event) => {
    if (controller.snapshot().ownerPointerId === event.pointerId) suppressClick = false;
    dispatch({ type: 'pointercancel', pointerId: event.pointerId });
  });
  on(viewport, 'lostpointercapture', (event) => {
    // Automatic capture loss follows a legitimate release before its click.
    // Preserve suppression for that click; only owned capture loss is a cancel.
    if (controller.snapshot().ownerPointerId === event.pointerId) suppressClick = false;
    dispatch({ type: 'lostpointercapture', pointerId: event.pointerId });
  });
  on(viewport, 'click', (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  }, true);
  on(viewport, 'dragstart', (event) => event.preventDefault());

  const onBreakpoint = () => dispatch({ type: 'viewport', mobile: media.matches });
  media.addEventListener('change', onBreakpoint);
  cleanups.push(() => media.removeEventListener('change', onBreakpoint));

  render(controller.snapshot());
  return {
    controller,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const owner = controller.snapshot().ownerPointerId;
      if (owner !== null && viewport.hasPointerCapture(owner)) viewport.releasePointerCapture(owner);
      cleanups.splice(0).forEach((cleanup) => cleanup());
      controller.dispose();
      root.style.removeProperty('--drag-offset');
    },
  };
}
