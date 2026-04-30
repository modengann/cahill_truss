# Method of Joints Trainer — Session Notes

## Project
Static web app teaching structural engineering students to predict tension/compression in truss members using the Method of Joints. No framework, no build step. Opens via `python -m http.server` (ES modules require HTTP, not file://).

## Current State
All features complete. Resizable layout implemented and committed.

## Done This Session
- Added resizable panel layout (Option B: overview top strip + workspace below)
  - Overview strip (default 160px) contains truss SVG + ledger, resizable via horizontal drag handle
  - Workspace fills remaining height: FBD panel (flex:1) + vertical drag handle + side panel (default 280px)
  - Both handles use mousedown/mousemove/mouseup; sizes persisted to localStorage
  - ResizeObserver triggers SVG redraws on panel resize (throttled via requestAnimationFrame)
  - Bottom ledger bar removed; ledger items moved into overview strip
- Design spec: `docs/superpowers/specs/2026-04-29-resizable-layout-design.md`
- Implementation plan: `docs/superpowers/plans/2026-04-29-resizable-layout.md`
- 4 commits: CSS → HTML → JS handles → JS observers

## What Still Needs Doing
Nothing known. All previously planned features complete:
- Truss math (getMemberAngle, getSolvableJoints, solveJoint, getEquationStrings) ✓
- FBD SVG renderer ✓
- UI (problem loading, joint selection, prediction, solve/verify, ledger, summary, replay) ✓
- Problems (King-Post, Warren, Cantilever) ✓
- Resizable layout ✓

## Key Technical Decisions
- `<script type="module">` — Chrome requires HTTP server, not file://
- Architecture: truss.js = pure math, fbd.js = SVG only, ui.js = all DOM/state
- Sign convention: positive = tension, negative = compression, |f| < 0.001 = zero
- Drag handles: mousedown on handle → mousemove/mouseup on document (not handle), so drag works if mouse leaves handle
- ResizeObserver uses requestAnimationFrame guard (single variable, not boolean flag) to skip redundant frames
- `overviewSvg.parentElement` = `.overview-svg-wrap` (not `.truss-banner`); clientHeight read from wrap
- Side panel width is dragged rightward to shrink (startW - delta), not leftward

## Gotchas
- style.css uses Unicode box-drawing chars in comments — open with UTF-8 encoding
- LF->CRLF line ending warnings on commit are benign (Windows git config)
- localStorage keys: `truss-overview-h` (px int) and `truss-side-w` (px int)
