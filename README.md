# Mobile Product Feature Explorer

An original, dependency-free interaction study for a product-feature section. The repository contains runnable source, a local browser demo, deterministic state-machine tests, and an explicit evidence boundary.

**Technical showcase · Anonymized · Local demonstration**

JavaScript | CSS | Pointer Events | WAI-ARIA tabs | Node.js

## Run it

Requires a current Node.js release (verified with Node 26).

```sh
node --test
node demo/run.mjs
node demo/server.mjs
```

Open `http://127.0.0.1:4177/`. Set `PORT` to an integer from 1 through 65535 to override the port.

## What the demo proves

- One selected-feature state is shared by tabs, previous/next buttons, keyboard commands, and pointer drag.
- The pure state machine owns pointer identity and models `idle`, `pending`, `horizontal-drag`, `cancel`, and `commit` outcomes.
- Mobile drag uses axis locking. Vertical intent remains native scrolling; horizontal intent calls `preventDefault()` only after lock.
- Drag translation is reversible and visual only. Selection changes once from the final release coordinate at or beyond a width-relative threshold.
- Navigation wraps at both ends.
- Tabs use a real tablist/tabpanel relationship, roving `tabindex`, and Arrow/Home/End keys.
- Keyboard selection moves focus once; pointer, button, palette, and later hover/move renders do not steal it back.
- The gesture is disabled above the mobile breakpoint, and crossing that breakpoint cancels an active drag.
- Reduced-motion preference removes track transition without changing state behavior.
- The illustration and copy are newly made CSS/HTML material; no external assets or private implementation are included.

## Structure

```text
src/state-machine.mjs   Pure validated state transitions
src/browser-adapter.mjs DOM events, ARIA rendering, lifecycle cleanup
test/                   Deterministic unit coverage
demo/                   Local page, CSS, server, and CLI trace
docs/                   Engineering, state, verification, and scope notes
```

## Shopify adaptation boundary

A theme adapter could read block data, render equivalent tabs/panels in Liquid, and mount the browser adapter on each section instance. That adapter is intentionally **not implemented** here: there is no Shopify API call, theme schema, product data, cart behavior, or claim of store deployment.

## Documentation

- [Engineering decisions](docs/engineering.md)
- [State machine and coordinate model](docs/state-machine.md)
- [Verification matrix](docs/verification.md)
- [Scope and evidence boundaries](docs/scope.md)

## Evidence boundary

The included tests and local browser page establish behavior in this repository. They are not physical-device testing, assistive-technology certification, production deployment evidence, or a copy of a private storefront.
