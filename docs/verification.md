# Verification matrix

## Automated checks

| Risk | Deterministic evidence |
| --- | --- |
| Horizontal axis lock | Movement beyond slop enters `horizontal-drag` and requests prevention |
| Vertical scrolling stolen | Vertical-dominant movement cancels without prevention |
| Early selection | Drag tests assert selected index is unchanged before pointer up |
| Threshold error | Pointer-up coordinates decide final displacement; exact width-relative boundary commits and final-up reversal cancels |
| Multiple commits | Release clears ownership; later lost capture leaves committed index unchanged |
| Wrong pointer | Mismatched pointer IDs cannot move or release the owner |
| Secondary input | Non-primary and non-left-button pointer downs are ignored |
| Cancellation | Pointer cancel, lost capture, and breakpoint exit preserve committed selection |
| Navigation edge | Previous and next wrap at both ends |
| Keyboard focus | Arrow/Home/End set selection and focus intent; direct controls do not |
| Mid-drag navigation | Explicit select/navigation cancels ownership; old move/up events cannot commit again |
| Focus replay | Focus intent is consumed after keyboard render and stays clear on later pointer events |
| Capture/click lifecycle | Adapter releases cancelled ownership and clears stale click suppression on cancel/loss/new accepted down |
| Invalid input | Config and event bounds reject unsupported or non-finite values |
| Teardown | Disposal prevents subsequent state changes |

Run with `node --test`.

## CLI behavior trace

`node demo/run.mjs` prints the pending → horizontal-drag → commit sequence and then a keyboard selection. It is a readable state trace, not a substitute for the assertions.

## HTTP smoke expectations

The local server binds only to `127.0.0.1`, uses an exact route allowlist, serves `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, returns 404 for unlisted routes, and accepts a bounded integer `PORT` override.

## Manual browser checks

At approximately 390 px:

- vertically scroll from the illustration without horizontal interception;
- horizontally drag below and above threshold;
- reverse direction before release;
- use all tabs, controls, palettes, and keyboard commands;
- confirm the palette label/visual changes while selected feature remains stable.

At approximately 1024 px:

- confirm tabs and controls still select;
- confirm dragging does not navigate;
- resize during a mobile drag and confirm cancellation.

With reduced motion enabled, selection should work with no track transition.

## Failure interpretation

A unit failure identifies transition/validation logic. A browser failure may instead identify event wiring, ARIA rendering, focus behavior, media queries, CSS gesture policy, or server delivery. These layers are separated so failures can be localized rather than hidden behind end-to-end-only coverage.

No claim is made for physical-device behavior or assistive-technology certification; those require separate device and AT test programs.
