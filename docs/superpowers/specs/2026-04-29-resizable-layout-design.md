# Resizable Layout Design

**Date:** 2026-04-29
**Status:** Approved

## Summary

Replace the current fixed-height, fixed-width layout with a fully resizable panel layout (Option B). The truss overview sits in a top strip; the FBD and member-prediction panels occupy the workspace below. All panels have drag handles. SVGs redraw dynamically as panels resize.

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Header (fixed height ~44px)                            │
├─────────────────────────────────────────────────────────┤
│  Overview strip (default 160px, resizable)              │
│  ┌──────────────────────────────────┬─────────────────┐ │
│  │  Truss SVG (fills available w)   │  Ledger items   │ │
│  └──────────────────────────────────┴─────────────────┘ │
├╌╌╌╌╌╌╌╌ horizontal drag handle ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│  Workspace (flex: 1, fills remaining height)            │
│  ┌────────────────────────┬╌╌╌┬──────────────────────┐  │
│  │  FBD panel             │ ┃ │  Side panel          │  │
│  │  - Panel title         │   │  - Members list      │  │
│  │  - FBD SVG (flex: 1)   │   │  - Solve & Verify    │  │
│  │  - Equation display    │   │  - Feedback          │  │
│  └────────────────────────┴╌╌╌┴──────────────────────┘  │
│                         vertical drag handle             │
└─────────────────────────────────────────────────────────┘
```

The bottom ledger strip (`<section class="ledger-bar">`) is removed. Ledger items move into the right side of the overview strip.

---

## Drag Handles

### Horizontal handle (between overview and workspace)
- 6px tall grip bar with three short horizontal rules as visual indicator
- `cursor: row-resize`
- Dragging changes `overviewHeight` (CSS variable or inline height on `.truss-banner`)
- Min overview height: 80px
- Max overview height: 45% of `window.innerHeight`
- On drag end: persist height to `localStorage` key `truss-overview-h`
- On load: restore from `localStorage` if present

### Vertical handle (between FBD and side panel)
- 6px wide grip bar with three short vertical rules
- `cursor: col-resize`
- Dragging changes side panel width
- Min side panel width: 200px
- Max side panel width: 480px
- On drag end: persist width to `localStorage` key `truss-side-w`
- On load: restore from `localStorage` if present

---

## Dynamic SVG Resize

Both SVGs must fill their container and re-render when the container changes size.

### Overview SVG (`#truss-overview-svg`)
- Set `width="100%" height="100%"` (remove hardcoded `height="120"`)
- `renderOverview()` already reads `parentElement.clientWidth`; update it to also read `clientHeight` for H
- Attach a `ResizeObserver` to `.truss-banner`; call `renderOverview()` on size change
- Throttle observer callback with `requestAnimationFrame` (one render per frame max)

### FBD SVG (`#fbd-svg`)
- Set `width="100%" height="100%"` (remove hardcoded `height="300"`)
- `.fbd-panel` becomes `display: flex; flex-direction: column` — SVG takes `flex: 1`
- `renderFBD()` already reads `svgEl.clientWidth` and `svgEl.clientHeight`; this is sufficient once height is set by CSS
- Attach a `ResizeObserver` to `#fbd-svg`; call re-render (re-call `renderFBD` with current state) on size change
- Throttle with `requestAnimationFrame`

### Replay FBD SVG (`#replay-fbd-svg`)
- Same treatment: `width="100%" height="100%"`, attach ResizeObserver, re-call `renderReplayStep()`

---

## CSS Changes (`style.css`)

1. **`body`**: add `height: 100vh; overflow: hidden`
2. **`.truss-banner`**: remove fixed padding that constrains height; add `overflow: hidden; display: flex; align-items: stretch;`
3. Add `.overview-inner` wrapper inside banner: `display: flex; flex: 1; min-height: 0; gap: 12px; overflow: hidden`
4. Add `.overview-ledger` styles: right side of overview, flex column, scrollable
5. **`.workspace`**: change from `grid` to `display: flex; flex: 1; min-height: 0;` — removes fixed 260px column
6. **`.fbd-panel`**: `flex: 1; min-width: 0; overflow: hidden`
7. **`.side-panel`**: `flex-shrink: 0; overflow-y: auto` — width set by JS/localStorage
8. Add `.resize-handle-h` and `.resize-handle-v` styles (6px, grip dots, hover highlight)
9. Remove `.ledger-bar` and `.ledger-list` styles (no longer used)

---

## HTML Changes (`index.html`)

1. Remove `<section class="ledger-bar">...</section>` entirely
2. Replace `<svg id="truss-overview-svg" width="100%" height="120">` → remove `height="120"`
3. Inside `.truss-banner`: add `.overview-inner` wrapper containing the SVG and a `.overview-ledger` div with `<ul id="overview-ledger-list">` inside (replaces ledger bar)
4. Add `<div class="resize-handle-h">` as a sibling **between** `.truss-banner` and `.workspace` (not inside either)
5. Inside `.workspace`: replace existing markup with FBD panel + `<div class="resize-handle-v">` + side panel
6. Replace `<svg id="fbd-svg" width="100%" height="300">` → remove `height="300"`
7. Replace `<svg id="replay-fbd-svg" width="100%" height="300">` → remove `height="300"`

---

## JS Changes (`ui.js`)

### New: `initResizeHandles()`
Called once at boot. Sets up mousedown → mousemove → mouseup for both handles.

```js
function initResizeHandles() {
  // Horizontal: resize overview height
  // Vertical: resize side panel width
  // On mouseup: save to localStorage
}
```

### New: `initResizeObservers()`
Called once at boot after DOM is ready. Sets up ResizeObserver instances for overview banner and FBD SVG.

```js
function initResizeObservers() {
  // Debounced renderOverview on truss-banner resize
  // Debounced re-render of FBD on fbd-svg resize
  // Debounced re-render of replay FBD on replay-fbd-svg resize (only when replay is open)
}
```

### Updated: `renderLedger()`
Instead of writing to `#ledger-list`, write to a new `#overview-ledger-list` element inside the overview strip.

### Updated: `renderOverview()`
Read both `clientWidth` and `clientHeight` from the banner element (not hardcoded H=120).

### Updated: `boot()`
- Call `initResizeHandles()`
- Call `initResizeObservers()`
- Restore panel sizes from localStorage before first render

---

## Defaults and Constraints

| Panel | Default | Min | Max | localStorage key |
|---|---|---|---|---|
| Overview height | 160px | 80px | 45vh | `truss-overview-h` |
| Side panel width | 280px | 200px | 480px | `truss-side-w` |

---

## What Does Not Change

- `truss.js` — no changes
- `fbd.js` — no changes (already uses clientWidth/clientHeight)
- Summary and replay screen markup and logic — minor: replay FBD gets ResizeObserver
- Problems.json — no changes
- Sign convention display in header — no changes
- All button/prediction/feedback logic — no changes
