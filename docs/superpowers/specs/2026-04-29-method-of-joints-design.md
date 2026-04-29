# Method of Joints Trainer — Design Spec

**Date:** 2026-04-29  
**Status:** Approved  

---

## Overview

A single-page static web app that teaches students to predict tension and compression in truss members using the method of joints. Hosted on GitHub Pages. Vanilla HTML/CSS/JS, no build step, no dependencies.

---

## Sign Convention (displayed prominently at all times)

> **(+) Tension** — member pulls the joint outward along its axis.  
> **(−) Compression** — member pushes the joint inward along its axis.  
> **Zero** — neither; member carries no force.

Color encoding: Tension = blue (`#185FA5`), Compression = red (`#A32D2D`), Zero-force = gray (`#6c757d`), Known reactions = green (`#28a745`), External loads = red arrow.

---

## Layout

### Desktop (≥700px): Layout B

```
┌─────────────────────────────────────────────────────────────┐
│  [Problem selector ▾]   Sign convention key   [Hint] [Reset]│
├─────────────────────────────────────────────────────────────┤
│           Truss Overview Banner (SVG)                        │
│  Joints: green=solvable, blue=active, gray=locked, check=done│
├────────────────────────────────────┬────────────────────────┤
│  Free Body Diagram (SVG)           │  Members at this joint │
│  · Joint circle (labeled)          │  ┌────────────────────┐│
│  · Member arrows (dashed=unknown,  │  │ AD  [T(+)]  [C(−)] ││
│    solid=predicted/solved)         │  │ AB  [T(+)]  [C(−)] ││
│  · Reaction arrows (green)         │  └────────────────────┘│
│  · External load arrows (red)      │                        │
│                                    │  [Solve & Verify]      │
│  ΣFx = …                           │                        │
│  ΣFy = …                           │  (disabled until all   │
│                                    │   unknowns predicted)  │
├────────────────────────────────────┴────────────────────────┤
│  Member Ledger: [AB ? ] [BC ? ] [AD −10 C] [CD −10 C] …     │
└─────────────────────────────────────────────────────────────┘
```

### Mobile (<700px)

Stack vertically: header → truss banner → FBD → side panel → ledger.

---

## File Structure

```
truss_demo/
├── index.html        Shell, panels, ledger, sign convention banner
├── style.css         Layout, colors, responsive breakpoints
├── truss.js          Data model + solver (pure functions, no DOM)
├── fbd.js            SVG rendering for a single joint's FBD
├── ui.js             Event handlers, prediction state, ledger, feedback
├── problems.json     Array of truss problem definitions
└── README.md         Setup, GitHub Pages deploy, adding problems
```

---

## Data Model

### `problems.json` schema

```json
{
  "id": "king-post",
  "name": "King-Post Truss",
  "joints": [
    { "id": "A", "x": 0, "y": 0, "support": "pin" },
    { "id": "B", "x": 4, "y": 0, "support": "free" },
    { "id": "C", "x": 8, "y": 0, "support": "roller" },
    { "id": "D", "x": 4, "y": 3, "support": "free" }
  ],
  "members": [
    { "id": "AB", "j1": "A", "j2": "B" },
    { "id": "BC", "j1": "B", "j2": "C" },
    { "id": "BD", "j1": "B", "j2": "D" },
    { "id": "AD", "j1": "A", "j2": "D" },
    { "id": "CD", "j1": "C", "j2": "D" }
  ],
  "loads": [
    { "joint": "D", "fx": 0, "fy": -12 }
  ],
  "reactions": [
    { "joint": "A", "fx": 0, "fy": 6 },
    { "joint": "C", "fx": 0, "fy": 6 }
  ]
}
```

**Rules:** `reactions` are precomputed and stored in the JSON — students do not solve for them. `loads` are applied external forces. All forces in kN; positive x = right, positive y = up.

---

## `truss.js` — Pure Functions

### `getSolvableJoints(problem, solvedForces)`

Returns an array of joint IDs whose count of unsolved connected members is ≤ 2. A member is "solved" if its ID appears in `solvedForces`.

### `solveJoint(jointId, problem, solvedForces)`

Builds and solves the linear system at the given joint.

For each member connected to the joint:
- If solved: contribute its force × direction components as known constants to RHS.
- If unsolved: add its direction components as a column in the coefficient matrix.

Also add reaction components (from `problem.reactions`) and load components (from `problem.loads`) to the RHS.

System:

```
[cos θ1  cos θ2] [F1]   [−ΣFx_known]
[sin θ1  sin θ2] [F2] = [−ΣFy_known]
```

For 1×1 case (one unknown): pick the equation with a nonzero coefficient, solve directly.  
For 2×2 case: `F1 = (b1·c22 − b2·c12) / det`, `F2 = (c11·b2 − c21·b1) / det` where `det = c11·c22 − c12·c21`.

Returns `{ memberId: force, … }` with signed values (positive = tension).

### `getEquationStrings(jointId, problem, solvedForces)`

Returns `{ fx: string, fy: string }` — human-readable equilibrium equations with all known values substituted numerically and unsolved members shown as variable names (e.g., `"ΣFy = 6 + F_AD·(3/5) = 0"`). Used for display below the FBD.

### `getMemberAngle(memberId, jointId, problem)`

Returns the angle θ of the member as seen from the given joint (i.e., direction from `jointId` toward the other end). Used by both the solver and the FBD renderer.

---

## `fbd.js` — SVG Rendering

### `renderFBD(jointId, problem, solvedForces, predictions, svgEl)`

Clears and redraws the SVG. Content:

1. **Joint circle** — labeled, blue highlight ring.
2. **One arrow per connected member:**
   - Solved (known force): solid arrow, direction encodes sign (tension = away from joint, compression = toward joint), color = blue/red/gray.
   - Predicted but not yet verified: solid arrow with prediction color (blue=T, red=C), direction encodes the prediction, labeled "T" or "C".
   - Unpredicted unknown: dashed gray arrow pointing away from joint, labeled "?".
3. **Reaction arrows** (from `problem.reactions` at this joint): solid green, labeled with value and direction.
4. **External load arrows** (from `problem.loads` at this joint): solid red, labeled with value.

Arrow length: scaled so the largest force magnitude gets ~40% of SVG half-width. Minimum arrow length enforced so zero-force members still render as short gray arrows.

Angles computed from joint coordinates, correct for all four quadrants (uses `Math.atan2`).

All SVG elements include `aria-label` attributes for screen readers.

---

## `ui.js` — Interaction & State

### App state (module-level)

```js
let problem = null;           // loaded Problem object
let solvedForces = {};        // { memberId: number }
let predictions = {};         // { jointId: { memberId: "T"|"C"|null } }
let activeJoint = null;
let hintLevels = {};          // { jointId: 0|1|2|3 }
let selectedMember = null;    // memberId currently highlighted in side panel
```

### Joint selection

- On load: call `getSolvableJoints()`, mark those joint circles green in truss banner SVG.
- Locked joints: gray, pointer-events none, tooltip "Solve more joints first — N unknowns remaining."
- Clicking a solvable joint: sets `activeJoint`, renders FBD, populates side panel, resets `selectedMember`.

### Prediction interaction

1. Student clicks a member row in the side panel → `selectedMember` set, row highlights.
2. Student clicks T(+) or C(−) → `predictions[activeJoint][memberId]` set, FBD re-renders, row shows colored T/C badge.
3. When all members at `activeJoint` have predictions → "Solve & Verify" button enables.

### Solve & Verify

1. Call `solveJoint(activeJoint, problem, solvedForces)`.
2. For each predicted member: compare sign of solved force to prediction.
   - T predicted, force > 0 → correct.
   - C predicted, force < 0 → correct.
   - Zero (|force| < 0.001): any T or C prediction is treated as incorrect. The diagnostic explains it's a zero-force member and shows the gray badge. No separate "Zero" prediction button is provided — students discover zero-force members as a result of the solve step.
3. All correct: merge solved forces into `solvedForces`, update ledger, re-render truss banner (solved members colored), call `getSolvableJoints()` to unlock next joints, show success message and "Next Joint →".
4. Any wrong: highlight wrong member rows red, show diagnostic message below FBD (see Feedback Messages), keep current state so student can retry.

### Reset (current joint)

Clears `predictions[activeJoint]`, re-renders FBD with all dashed arrows, resets side panel selections. Does not clear `hintLevels`.

### Hint system (per joint, 3 levels, cumulative reveal)

- **Level 1** (first click): "Isolate the joint with the fewest unknowns — fewer unknowns means fewer variables in your equilibrium equations."
- **Level 2** (second click): Identifies which equation (ΣFx or ΣFy) has only one unknown at this joint and names the member. E.g., "ΣFy has only one unknown here: F_AD. F_AB is horizontal so it contributes nothing to ΣFy."
- **Level 3** (third click): Gives the numeric answer for one member. E.g., "F_AD = −10 kN (Compression)."

Hint level persists across Reset but resets if student selects a new joint.

### Feedback messages

Wrong prediction diagnostic is phrased in physical terms, generated from the solved result:

- Compression result, tension predicted: "The y-component of [member] must point downward to balance [known force] pointing upward. That means [member] is pushing the joint — compression."
- Tension result, compression predicted: "The y-component of [member] must point upward to offset the net downward force. That means [member] is pulling the joint — tension."
- Zero force: "[member] carries no force. Both equilibrium equations are satisfied without it contributing — it's a zero-force member."

Messages are templated strings generated in `ui.js` from the solved force value, known forces, and member geometry.

### Summary screen

Shown when `Object.keys(solvedForces).length === problem.members.length`:
- Full truss SVG colored by T/C/zero.
- Table of all member forces with T/C badge.
- "Replay" button and "Try Another Problem" dropdown.

### Replay mode

Steps through solution joints in order, re-rendering each FBD and equation string. Navigation: "← Prev" / "Next →" buttons. A "Print" button applies a print stylesheet that renders all steps as a vertically stacked printable summary.

---

## Three Problems

### Problem 1: King-Post Truss

Joints: A(0,0) pin, B(4,0), C(8,0) roller, D(4,3)  
Members: AB, BC, BD, AD, CD  
Load: 12 kN↓ at D  
Reactions: A_y=+6, C_y=+6, A_x=0  
Solution: AD=−10C, CD=−10C, AB=+8T, BC=+8T, BD=0  
Solution order: A → C → B (or D for verification)

### Problem 2: Warren Truss

Joints: A(0,0) pin, B(6,0), C(12,0) roller, D(3,4), E(9,4)  
Members: AB, BC, AD, DE, CE, BD, BE  
Load: 12 kN↓ at D, 12 kN↓ at E  
Reactions: A_y=+12, C_y=+12, A_x=0  
Solution: AB=+9T, BC=+9T, AD=−15C, DE=−9C, CE=−15C, BD=0, BE=0  
Teaching point: BD and BE are zero-force members discoverable by inspection.  
Solution order: A → C → D → E → B

### Problem 3: Cantilever Truss

Joints: A(0,0) pin, B(0,4) roller (horizontal force only), C(3,0), D(3,4), E(6,0)  
Members: AB, AC, BC, BD, CD, CE, DE  
Load: 20 kN↓ at E  
Reactions: A_x=+30, A_y=+20, B_x=−30 (wall pulls B leftward)  
Solution: DE=+25T, BC=+25T, BD=+15T, AB=−20C, CD=−20C, AC=−30C, CE=−15C  
Teaching point: cantilever support (horizontal roller at wall); no symmetric shortcut.  
Solution order: E → D → A → C → B

---

## Visual Design

- Background: `#ffffff` / `#f8f9fa` panel backgrounds.
- UI font: system sans-serif stack. Force values and equations: `font-family: monospace`.
- Joint circle colors in truss banner: green=solvable, blue=active, dark blue with checkmark=solved, gray=locked.
- Truss member colors after solve: blue (T), red (C), gray (zero), light gray (unknown).
- Sufficient color contrast (WCAG AA) throughout.
- Keyboard navigation: joint circles focusable, T/C buttons reachable by Tab, Enter activates.
- `aria-label` on all SVG arrow elements.

---

## Accessibility

- All interactive SVG elements have `tabindex="0"` and `role="button"` with `aria-label`.
- Feedback messages appear in a `role="status"` live region so screen readers announce them.
- Color is never the sole indicator of state — shape (dashed/solid), label (T/C/?), and text always accompany color.

---

## README Contents

1. How to run locally: `open index.html` in any browser (no server needed).
2. How to deploy to GitHub Pages: push to `main`, enable Pages from root.
3. How to add problems: edit `problems.json` following the schema above; reactions must be precomputed.
4. Data format reference: full schema with field descriptions.
