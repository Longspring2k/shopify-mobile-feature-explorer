const EVENT_TYPES = new Set([
  'pointerdown', 'pointermove', 'pointerup', 'pointercancel',
  'lostpointercapture', 'viewport', 'select', 'navigate', 'key', 'focus-applied',
]);

export const DEFAULT_CONFIG = Object.freeze({
  count: 3,
  slop: 10,
  thresholdRatio: 0.25,
  maxDisplacementRatio: 0.85,
  mobile: true,
});

const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
};

export function validateConfig(input) {
  const config = { ...DEFAULT_CONFIG, ...input };
  if (!Number.isInteger(config.count) || config.count < 1 || config.count > 20) {
    throw new RangeError('count must be an integer from 1 to 20');
  }
  finite(config.slop, 'slop');
  if (config.slop < 0 || config.slop > 100) throw new RangeError('slop must be from 0 to 100');
  finite(config.thresholdRatio, 'thresholdRatio');
  if (config.thresholdRatio <= 0 || config.thresholdRatio > 0.75) {
    throw new RangeError('thresholdRatio must be greater than 0 and at most 0.75');
  }
  finite(config.maxDisplacementRatio, 'maxDisplacementRatio');
  if (config.maxDisplacementRatio <= 0 || config.maxDisplacementRatio > 1) {
    throw new RangeError('maxDisplacementRatio must be greater than 0 and at most 1');
  }
  if (config.maxDisplacementRatio < config.thresholdRatio) {
    throw new RangeError('maxDisplacementRatio must be at least thresholdRatio');
  }
  if (typeof config.mobile !== 'boolean') throw new TypeError('mobile must be boolean');
  return Object.freeze(config);
}

export function validateEvent(event, count = DEFAULT_CONFIG.count) {
  if (!event || typeof event !== 'object' || !EVENT_TYPES.has(event.type)) {
    throw new TypeError('event.type is not supported');
  }
  if (event.type.startsWith('pointer') || event.type === 'lostpointercapture') {
    if (!Number.isInteger(event.pointerId) || event.pointerId < 0) {
      throw new RangeError('pointerId must be a nonnegative integer');
    }
  }
  if (['pointerdown', 'pointermove', 'pointerup'].includes(event.type)) {
    finite(event.x, 'x');
    finite(event.y, 'y');
    finite(event.width, 'width');
    if (event.width <= 0 || event.width > 10000) throw new RangeError('width must be greater than 0 and at most 10000');
  }
  if (event.type === 'pointerdown') {
    if (!Number.isFinite(event.button)) throw new TypeError('button must be finite');
    if (typeof event.isPrimary !== 'boolean') throw new TypeError('isPrimary must be boolean');
  }
  if (event.type === 'select') {
    if (!Number.isInteger(event.index) || event.index < 0 || event.index >= count) {
      throw new RangeError('index is outside the feature range');
    }
  }
  if (event.type === 'navigate' && ![-1, 1].includes(event.delta)) {
    throw new RangeError('delta must be -1 or 1');
  }
  if (event.type === 'viewport' && typeof event.mobile !== 'boolean') {
    throw new TypeError('mobile must be boolean');
  }
  if (event.type === 'key' && !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    throw new RangeError('key is not supported');
  }
  return event;
}

const wrap = (index, count) => (index % count + count) % count;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createExplorer(options = {}) {
  const config = validateConfig(options);
  let state = {
    selectedIndex: 0,
    focusIndex: null,
    gesture: 'idle',
    ownerPointerId: null,
    startX: 0,
    startY: 0,
    dragOffset: 0,
    preventDefault: false,
    mobile: config.mobile,
    disposed: false,
  };

  const publicState = () => Object.freeze({ ...state });
  const resetGesture = (gesture) => {
    state = {
      ...state,
      gesture,
      ownerPointerId: null,
      dragOffset: 0,
      preventDefault: false,
    };
  };
  const select = (index, focus = false) => {
    state = {
      ...state,
      selectedIndex: wrap(index, config.count),
      focusIndex: focus ? wrap(index, config.count) : null,
    };
  };

  function dispatch(rawEvent) {
    if (state.disposed) return publicState();
    const event = validateEvent(rawEvent, config.count);

    if (event.type === 'viewport') {
      if (state.mobile && !event.mobile && state.ownerPointerId !== null) resetGesture('cancel');
      state = { ...state, mobile: event.mobile };
      return publicState();
    }
    if (event.type === 'focus-applied') {
      state = { ...state, focusIndex: null };
      return publicState();
    }
    if (event.type === 'select') {
      if (state.ownerPointerId !== null) resetGesture('cancel');
      select(event.index, event.source === 'keyboard');
      return publicState();
    }
    if (event.type === 'navigate') {
      if (state.ownerPointerId !== null) resetGesture('cancel');
      select(state.selectedIndex + event.delta, event.source === 'keyboard');
      return publicState();
    }
    if (event.type === 'key') {
      if (state.ownerPointerId !== null) resetGesture('cancel');
      if (event.key === 'Home') select(0, true);
      else if (event.key === 'End') select(config.count - 1, true);
      else select(state.selectedIndex + (event.key === 'ArrowLeft' ? -1 : 1), true);
      return publicState();
    }
    if (!state.mobile) return publicState();

    if (event.type === 'pointerdown') {
      if (state.ownerPointerId !== null || event.isPrimary === false || event.button !== 0) return publicState();
      state = {
        ...state,
        gesture: 'pending',
        ownerPointerId: event.pointerId,
        startX: event.x,
        startY: event.y,
        dragOffset: 0,
        preventDefault: false,
        focusIndex: null,
      };
      return publicState();
    }

    if (event.pointerId !== state.ownerPointerId) return publicState();

    if (event.type === 'pointermove') {
      const dx = event.x - state.startX;
      const dy = event.y - state.startY;
      if (state.gesture === 'pending') {
        if (Math.hypot(dx, dy) < config.slop) return publicState();
        if (Math.abs(dy) >= Math.abs(dx)) {
          resetGesture('cancel');
          return publicState();
        }
      }
      if (state.gesture === 'pending' || state.gesture === 'horizontal-drag') {
        const limit = event.width * config.maxDisplacementRatio;
        state = {
          ...state,
          gesture: 'horizontal-drag',
          dragOffset: clamp(dx, -limit, limit),
          preventDefault: true,
        };
      }
      return publicState();
    }

    if (event.type === 'pointerup') {
      if (state.gesture === 'horizontal-drag') {
        const dx = event.x - state.startX;
        const dy = event.y - state.startY;
        const threshold = event.width * config.thresholdRatio;
        const limit = event.width * config.maxDisplacementRatio;
        const releaseOffset = clamp(dx, -limit, limit);
        if (Math.abs(dx) >= config.slop && Math.abs(dx) > Math.abs(dy) && Math.abs(releaseOffset) >= threshold) {
          select(state.selectedIndex + (releaseOffset < 0 ? 1 : -1), false);
          resetGesture('commit');
        } else resetGesture('cancel');
      } else resetGesture('cancel');
      return publicState();
    }

    if (event.type === 'pointercancel') {
      resetGesture('cancel');
      return publicState();
    }
    if (event.type === 'lostpointercapture') {
      if (event.pointerId === state.ownerPointerId) resetGesture('cancel');
      return publicState();
    }

    return publicState();
  }

  return {
    dispatch,
    snapshot: publicState,
    dispose() {
      resetGesture('cancel');
      state = { ...state, disposed: true };
      return publicState();
    },
  };
}
