# Device-Accurate Live Preview — Design

**Status:** Approved.

## Purpose

The exported playable lays itself out on a fixed logical canvas (`1000×563` landscape / `563×1000` portrait, see `htmlGenerator.ts`'s `LAYOUT` constant) and uniformly CSS-transform-scales that canvas to fit whatever `window.innerWidth`/`window.innerHeight` it's loaded into. That makes element *positions* scale-invariant — but the editor's Live Preview iframe today sizes itself as a **percentage** of the surrounding editor layout (`width:56.3%` in portrait, `width:100%` in landscape — see `LivePreview.tsx`'s `frameStyle`), never an absolute pixel size. So the preview's own `window.innerWidth`/`innerHeight` never matches any real device's — you can't tell from the editor alone whether a real phone (whose aspect ratio is typically ≈19.5:9–20:9, notably taller than the design's ≈16:9) will show letterboxing, or how bad it'll be, without testing on an actual phone.

## Approach

Give the preview iframe **real, fixed CSS-pixel dimensions matching an actual device**, then visually shrink the whole thing with an outer `transform: scale()` to fit the available editor space — the same "fixed canvas + scale-to-fit" technique the exported playable already uses internally, applied one layer up. A CSS transform on a wrapper never changes what the iframe's own JS reads for `window.innerWidth`/`innerHeight` (that's determined by the iframe's actual layout box, not its rendered/painted size), so the exported playable's own resize logic computes against the real device's numbers while still fitting on a laptop screen.

## Device presets

A dropdown in the preview toolbar, portrait dimensions (landscape swaps width/height):

| Label | W×H | Ratio |
|---|---|---|
| Design (563×1000) | 563×1000 | current design ratio, default/first entry |
| iPhone SE | 375×667 | ≈9:16 |
| iPhone 14 | 390×844 | ≈19.5:9 |
| iPhone 14 Pro Max | 430×932 | ≈19.5:9 |
| Pixel 7 | 412×915 | ≈20:9 |
| Galaxy S21 | 360×800 | ≈20:9 |
| Ultra-tall 21:9 | 360×840 | 21:9 — worst-case stress test |

Default selection is "Design", so nothing about the preview's default appearance changes unless a user picks a different device — purely additive.

## Implementation sketch

- `LivePreview.tsx` gains `deviceIdx` state (index into a `DEVICE_PRESETS` array) alongside the existing `orient` state.
- The iframe's own `width`/`height` become the selected device's true pixel dimensions (swapped by orientation) — no more percentage sizing.
- A `ResizeObserver` on `.preview-wrap` computes a `fitScale = min(availableWidth/frameW, availableHeight/frameH, 1)` and applies it via `transform: scale(fitScale)` on a wrapper `<div>` around the iframe, centered with `position: absolute` (the existing `.preview-wrap` already has `position: relative`).
- The existing debounced-refresh-on-config-change and Restart-button behavior are untouched — this only changes how the iframe is *sized*, not what HTML is generated or when.

## Out of scope

- Simulating device pixel ratio (DPR) — not achievable from a webpage's own JS; a real device or devtools-level emulation remains the only way to check bitmap sharpness.
- Simulating ad-network SDK wrapper behavior (insets, overlays) — each network's own preview/test tooling remains the source of truth for that.
- Any change to the exported playable's own `LAYOUT`/scaling code in `htmlGenerator.ts` — this is an editor-preview-only change.
