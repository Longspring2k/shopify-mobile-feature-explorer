import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExplorer,
  DEFAULT_CONFIG,
  validateConfig,
  validateEvent,
} from '../src/state-machine.mjs';

const down = (pointerId = 1, x = 200, y = 100, extra = {}) => ({
  type: 'pointerdown', pointerId, x, y, width: 300, isPrimary: true, button: 0,
  pointerType: 'touch', ...extra,
});
const move = (pointerId, x, y, width = 300) => ({ type: 'pointermove', pointerId, x, y, width });
const up = (pointerId, x, y, width = 300) => ({ type: 'pointerup', pointerId, x, y, width });

function reduce(events, config = {}) {
  const explorer = createExplorer({ count: 3, ...config });
  return events.reduce((result, event) => explorer.dispatch(event), explorer.snapshot());
}

test('horizontal movement beyond slop locks drag but does not commit before pointerup', () => {
  const explorer = createExplorer({ count: 3 });
  explorer.dispatch(down());
  const moved = explorer.dispatch(move(1, 170, 104));
  assert.equal(moved.gesture, 'horizontal-drag');
  assert.equal(moved.selectedIndex, 0);
  assert.equal(moved.preventDefault, true);
  assert.equal(moved.dragOffset, -30);
});

test('vertical-dominant motion cancels gesture and leaves native scroll available', () => {
  const state = reduce([down(), move(1, 196, 126)]);
  assert.equal(state.gesture, 'cancel');
  assert.equal(state.selectedIndex, 0);
  assert.equal(state.preventDefault, false);
});

test('commit threshold is based on current width and exact boundary commits once', () => {
  const explorer = createExplorer({ count: 3, thresholdRatio: 0.25 });
  explorer.dispatch(down(1, 200, 100));
  explorer.dispatch(move(1, 125, 102, 300));
  const committed = explorer.dispatch(up(1, 125, 102, 300));
  assert.equal(committed.selectedIndex, 1);
  assert.equal(committed.gesture, 'commit');
  const stable = explorer.dispatch({ type: 'lostpointercapture', pointerId: 1 });
  assert.equal(stable.selectedIndex, 1);
});

test('pointerup coordinates determine the final displacement after reversal without a final move', () => {
  const explorer = createExplorer({ count: 3 });
  explorer.dispatch(down(1, 200, 100));
  explorer.dispatch(move(1, 100, 100));
  const released = explorer.dispatch(up(1, 195, 100));
  assert.equal(released.selectedIndex, 0);
  assert.equal(released.gesture, 'cancel');
});

test('pointerup coordinates commit at the exact threshold without a final move', () => {
  const explorer = createExplorer({ count: 3, thresholdRatio: 0.25 });
  explorer.dispatch(down(1, 200, 100));
  explorer.dispatch(move(1, 180, 100));
  const released = explorer.dispatch(up(1, 125, 100, 300));
  assert.equal(released.selectedIndex, 1);
  assert.equal(released.gesture, 'commit');
});

test('sub-threshold drag reverses without committing', () => {
  const explorer = createExplorer({ count: 3 });
  explorer.dispatch({ type: 'select', index: 1, source: 'button' });
  explorer.dispatch(down(4, 160, 80));
  explorer.dispatch(move(4, 110, 82));
  const reversed = explorer.dispatch(move(4, 155, 81));
  assert.equal(reversed.selectedIndex, 1);
  assert.equal(reversed.dragOffset, -5);
  const result = explorer.dispatch(up(4, 155, 81));
  assert.equal(result.selectedIndex, 1);
  assert.equal(result.gesture, 'cancel');
});

test('selection wraps in both directions', () => {
  const explorer = createExplorer({ count: 3 });
  assert.equal(explorer.dispatch({ type: 'navigate', delta: -1, source: 'button' }).selectedIndex, 2);
  assert.equal(explorer.dispatch({ type: 'navigate', delta: 1, source: 'button' }).selectedIndex, 0);
});

test('discrete selection cancels drag ownership and ignores the old release', () => {
  const explorer = createExplorer({ count: 3 });
  explorer.dispatch(down(9, 200, 100));
  explorer.dispatch(move(9, 100, 100));
  const selected = explorer.dispatch({ type: 'select', index: 2, source: 'button' });
  assert.equal(selected.selectedIndex, 2);
  assert.equal(selected.ownerPointerId, null);
  assert.equal(selected.gesture, 'cancel');
  assert.equal(explorer.dispatch(move(9, 50, 100)).selectedIndex, 2);
  assert.equal(explorer.dispatch(up(9, 50, 100)).selectedIndex, 2);
});

test('discrete navigation and keyboard commands cancel drag ownership', () => {
  for (const event of [
    { type: 'navigate', delta: 1, source: 'button' },
    { type: 'key', key: 'End' },
  ]) {
    const explorer = createExplorer({ count: 3 });
    explorer.dispatch(down(6));
    explorer.dispatch(move(6, 100, 100));
    const navigated = explorer.dispatch(event);
    assert.equal(navigated.ownerPointerId, null);
    assert.equal(navigated.gesture, 'cancel');
    const selectedIndex = navigated.selectedIndex;
    assert.equal(explorer.dispatch(up(6, 0, 100)).selectedIndex, selectedIndex);
  }
});

test('pointer identity ownership ignores mismatched moves and releases', () => {
  const explorer = createExplorer({ count: 3 });
  explorer.dispatch(down(7));
  assert.equal(explorer.dispatch(move(8, 50, 100)).gesture, 'pending');
  assert.equal(explorer.dispatch(up(8, 50, 100)).gesture, 'pending');
  assert.equal(explorer.snapshot().ownerPointerId, 7);
});

test('secondary and non-primary pointers never start a gesture', () => {
  const explorer = createExplorer({ count: 3 });
  assert.equal(explorer.dispatch(down(1, 0, 0, { button: 1 })).gesture, 'idle');
  assert.equal(explorer.dispatch(down(2, 0, 0, { isPrimary: false })).gesture, 'idle');
});

test('pointercancel and legitimate lost capture preserve committed selection', () => {
  const explorer = createExplorer({ count: 3 });
  explorer.dispatch({ type: 'select', index: 2, source: 'button' });
  explorer.dispatch(down());
  explorer.dispatch(move(1, 100, 100));
  assert.equal(explorer.dispatch({ type: 'pointercancel', pointerId: 1 }).selectedIndex, 2);
  assert.equal(explorer.snapshot().gesture, 'cancel');
  assert.equal(explorer.dispatch({ type: 'lostpointercapture', pointerId: 1 }).selectedIndex, 2);
});

test('breakpoint change cancels an active drag and desktop ignores future gestures', () => {
  const explorer = createExplorer({ count: 3 });
  explorer.dispatch(down());
  explorer.dispatch(move(1, 120, 100));
  const desktop = explorer.dispatch({ type: 'viewport', mobile: false });
  assert.equal(desktop.gesture, 'cancel');
  assert.equal(desktop.selectedIndex, 0);
  assert.equal(explorer.dispatch(down(2)).gesture, 'cancel');
  assert.equal(explorer.snapshot().ownerPointerId, null);
});

test('keyboard navigation wraps and reports focus intent while direct selection does not', () => {
  const explorer = createExplorer({ count: 3 });
  let state = explorer.dispatch({ type: 'key', key: 'ArrowLeft' });
  assert.equal(state.selectedIndex, 2);
  assert.equal(state.focusIndex, 2);
  state = explorer.dispatch({ type: 'key', key: 'Home' });
  assert.equal(state.selectedIndex, 0);
  state = explorer.dispatch({ type: 'key', key: 'End' });
  assert.equal(state.selectedIndex, 2);
  state = explorer.dispatch({ type: 'select', index: 1, source: 'button' });
  assert.equal(state.selectedIndex, 1);
  assert.equal(state.focusIndex, null);
});

test('keyboard focus intent is consumed and does not persist into later renders', () => {
  const explorer = createExplorer({ count: 3 });
  assert.equal(explorer.dispatch({ type: 'key', key: 'ArrowRight' }).focusIndex, 1);
  assert.equal(explorer.dispatch({ type: 'focus-applied' }).focusIndex, null);
  assert.equal(explorer.dispatch(move(44, 1, 1)).focusIndex, null);
});

test('invalid configs and event numeric values fail explicitly', () => {
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, count: 0 }), /count/);
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, thresholdRatio: 2 }), /thresholdRatio/);
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, thresholdRatio: 0.5, maxDisplacementRatio: 0.25 }), /maxDisplacementRatio/);
  assert.throws(() => validateEvent({ type: 'pointermove', pointerId: 1, x: NaN, y: 0, width: 300 }), /finite/);
  assert.throws(() => validateEvent({ ...down(), pointerId: -1 }), /pointerId/);
  assert.throws(() => validateEvent({ ...down(), pointerId: 1.5 }), /pointerId/);
  assert.throws(() => validateEvent({ ...down(), button: '0' }), /button/);
  assert.throws(() => validateEvent({ ...down(), isPrimary: 1 }), /isPrimary/);
  assert.throws(() => validateEvent({ type: 'select', index: 5 }, 3), /index/);
  assert.throws(() => validateEvent({ type: 'navigate', delta: 0 }), /delta/);
});

test('disposal prevents all future state changes', () => {
  const explorer = createExplorer({ count: 3 });
  explorer.dispose();
  assert.equal(explorer.dispatch({ type: 'navigate', delta: 1 }).selectedIndex, 0);
  assert.equal(explorer.snapshot().disposed, true);
});
