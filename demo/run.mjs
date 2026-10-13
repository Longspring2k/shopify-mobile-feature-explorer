import { createExplorer } from '../src/state-machine.mjs';

const explorer = createExplorer({ count: 3, thresholdRatio: 0.25 });
const events = [
  { type: 'pointerdown', pointerId: 9, x: 320, y: 180, width: 390, isPrimary: true, button: 0, pointerType: 'touch' },
  { type: 'pointermove', pointerId: 9, x: 260, y: 184, width: 390 },
  { type: 'pointermove', pointerId: 9, x: 210, y: 182, width: 390 },
  { type: 'pointerup', pointerId: 9, x: 210, y: 182, width: 390 },
  { type: 'key', key: 'ArrowRight' },
];

console.log('pointer gesture trace');
for (const event of events) {
  const state = explorer.dispatch(event);
  console.log(JSON.stringify({ event: event.type, x: event.x ?? null, gesture: state.gesture, dragOffset: state.dragOffset, selectedIndex: state.selectedIndex, focusIndex: state.focusIndex }));
}
