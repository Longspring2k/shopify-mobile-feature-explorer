# State machine and coordinate model

## Public state

The pure module exposes the selected index, optional keyboard focus target, gesture outcome, owner pointer ID, bounded drag offset, mobile eligibility, and disposal state. Public events and configuration are validated; numeric coordinates, dimensions, ratios, IDs, and indexes must be finite and within documented bounds.

## Coordinate example

With a viewport width of **390 px**, a threshold ratio of **0.25**, and a start coordinate of **320 px**:

1. Moving to 260 px yields `dx = -60`. This exceeds slop and locks a horizontal drag, but selection stays on feature 1.
2. Moving to 210 px yields `dx = -110`.
3. Threshold is `390 × 0.25 = 97.5 px`.
4. Releasing at 210 px commits next because `|-110| >= 97.5`.

The offset is bounded to 85% of the current width, so malformed or extreme movement cannot translate the track without limit.

## Why drag translation is not committed selection

During `horizontal-drag`, the current panel moves by `dragOffset`, providing reversible feedback. The selected index remains stable. Release displacement is recalculated from the `pointerup` coordinate, current width, axis lock, and slop rather than trusting the last rendered move. Moving back toward the origin reduces the offset; releasing below threshold returns to the same feature. This separation prevents a direction reversal from producing multiple selections and guarantees at most one commit per pointer sequence.

## Terminal outcomes

- `cancel`: vertical intent, pointer cancellation, capture loss while owned, breakpoint exit, or release below threshold. The committed index is invariant.
- `commit`: release at or beyond threshold. The wrapped adjacent index becomes committed exactly once.

Navigation wraps by design rather than clamps. That choice gives the three-feature explorer continuous previous/next behavior and is covered in the pure tests.

Any explicit select, previous/next navigation, or keyboard navigation cancels existing pointer ownership before changing selection. Later move/up events from that old sequence are ignored. Keyboard focus intent is a one-render command: the adapter acknowledges it with `focus-applied`, returning public focus intent to `null`.

Configuration rejects a maximum displacement ratio below the commit threshold ratio because that would make a commit unreachable.
