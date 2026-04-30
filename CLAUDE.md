# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running locally

No build step. Open `index.html` via a local HTTP server — ES modules (`<script type="module">`) require HTTP, not `file://`:

```
python -m http.server
# then open http://localhost:8000
```

## Architecture

Three JS modules; strict separation of concerns:

- **`truss.js`** — pure math, no DOM. Exports: `getMemberAngle`, `getSolvableJoints`, `solveJoint`, `getEquationStrings`. All functions take `(problem, solvedForces)` as data; no global state.
- **`fbd.js`** — SVG rendering only, no state. Exports: `renderFBD(jointId, problem, solvedForces, predictions, svgEl)`. Draws arrows outward from the joint center; tension = outward, compression = reversed (inward).
- **`ui.js`** — all DOM and app state. Imports from the other two. Owns `problem`, `solvedForces`, `predictions`, `activeJoint`, `hintLevels`, `solutionLog`.

Data flow: `boot()` fetches `problems.json` → `loadProblem()` resets state → user clicks joint → `activateJoint()` → `renderFBD` + `renderSidePanel` + `renderEquations` → user submits predictions → `btnSolve` calls `solveJoint` → compares to predictions → on all-correct: commits to `solvedForces`, re-renders overview/ledger.

## Sign convention

Positive force = tension (member pulls joint outward). Negative = compression. Zero-force threshold: `|f| < 0.001`. This convention flows through the solver, FBD renderer, and ledger display.

## Adding problems

Edit `problems.json`. Reactions must be precomputed — the solver uses them as known inputs, not derived values. `solutionOrder` controls replay step order. See README.md for the full field reference.

## Key constraints

- `solveJoint` handles 1 or 2 unknowns per joint only. `getSolvableJoints` filters to joints with ≤ 2 unknown members, which is how the app enforces solve order.
- FBD arrow scaling is relative to `maxMag` across all `solvedForces`; unknown/predicted members always render at `ARROW_BASE_LEN = 70`.
- Each `renderFBD` call increments a global `_renderId` to generate unique SVG `<marker>` IDs, avoiding cross-render arrowhead bleed.
