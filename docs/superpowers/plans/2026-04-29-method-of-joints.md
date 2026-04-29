# Method of Joints Trainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static single-page web app that teaches students to predict tension and compression in truss members using the method of joints, deployable to GitHub Pages.

**Architecture:** Pure vanilla HTML/CSS/JS with no build step. `truss.js` is a pure-function data/solver module; `fbd.js` renders SVG free-body diagrams; `ui.js` owns all DOM state and event wiring. Problems are loaded from `problems.json` at startup via `fetch`. King-post truss is built and verified first; the two additional problems and replay mode are added after.

**Tech Stack:** HTML5, CSS3, vanilla ES6 (modules via `<script type="module">`), SVG, no external dependencies.

---

## File Map

| File | Responsibility |
|---|---|
| `index.html` | Shell markup — header, truss banner placeholder, FBD panel, side panel, ledger, sign convention bar |
| `style.css` | Layout grid, responsive breakpoint (<700px), colors, typography, component styles |
| `problems.json` | Array of all three truss problem definitions (geometry, loads, precomputed reactions) |
| `truss.js` | `getSolvableJoints`, `solveJoint`, `getEquationStrings`, `getMemberAngle` — pure functions, no DOM |
| `fbd.js` | `renderFBD(jointId, problem, solvedForces, predictions, svgEl)` — clears and redraws one joint's FBD SVG |
| `ui.js` | App state, problem loader, truss banner SVG, joint selection, prediction interaction, solve/verify, ledger, hints, feedback, summary/replay |

---

## Task 1: Project scaffold and static shell

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `problems.json`
- Create: `truss.js`
- Create: `fbd.js`
- Create: `ui.js`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Method of Joints Trainer</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="app-header">
    <div class="header-left">
      <label for="problem-select" class="sr-only">Select problem</label>
      <select id="problem-select"></select>
    </div>
    <div class="sign-convention">
      <span class="sc-tension">+ Tension: member pulls joint outward</span>
      <span class="sc-sep">·</span>
      <span class="sc-compression">− Compression: member pushes joint inward</span>
    </div>
    <div class="header-right">
      <button id="btn-hint" disabled>Hint</button>
      <button id="btn-reset" disabled>Reset</button>
    </div>
  </header>

  <section class="truss-banner" aria-label="Truss overview">
    <svg id="truss-overview-svg" width="100%" height="120"></svg>
  </section>

  <main class="workspace">
    <section class="fbd-panel" aria-label="Free body diagram">
      <h2 class="panel-title">Select a joint to begin</h2>
      <svg id="fbd-svg" width="100%" height="300" aria-label="Free body diagram"></svg>
      <div class="equation-display" id="equation-display"></div>
    </section>

    <aside class="side-panel" aria-label="Member predictions">
      <h2 class="panel-title">Members at joint</h2>
      <ul id="member-list" class="member-list"></ul>
      <button id="btn-solve" disabled>Solve &amp; Verify</button>
      <div id="feedback-message" role="status" aria-live="polite" class="feedback"></div>
    </aside>
  </main>

  <section class="ledger-bar" aria-label="Member ledger">
    <ul id="ledger-list" class="ledger-list"></ul>
  </section>

  <div id="summary-screen" class="summary-screen hidden" role="dialog" aria-label="Problem complete">
    <h2>All members solved!</h2>
    <svg id="summary-svg" width="100%" height="200"></svg>
    <table id="summary-table"></table>
    <div class="summary-actions">
      <button id="btn-replay">Replay solution</button>
      <button id="btn-try-another">Try another problem</button>
    </div>
  </div>

  <div id="replay-screen" class="replay-screen hidden">
    <div class="replay-header">
      <span id="replay-step-label"></span>
      <button id="btn-replay-prev">← Prev</button>
      <button id="btn-replay-next">Next →</button>
      <button id="btn-replay-print">Print</button>
      <button id="btn-replay-close">Close</button>
    </div>
    <div class="replay-content">
      <svg id="replay-fbd-svg" width="100%" height="300"></svg>
      <div id="replay-equations"></div>
    </div>
  </div>

  <script type="module" src="ui.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `style.css`**

```css
/* ── Reset & base ─────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; background: #f8f9fa; color: #212529; min-height: 100vh; display: flex; flex-direction: column; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.hidden { display: none !important; }

/* ── Colors ───────────────────────────────────────────────── */
:root {
  --tension:     #185FA5;
  --compression: #A32D2D;
  --zero:        #6c757d;
  --reaction:    #28a745;
  --load:        #dc3545;
  --unknown:     #adb5bd;
  --solvable:    #28a745;
  --active:      #185FA5;
  --solved-joint:#0d3d6e;
  --locked:      #adb5bd;
  --bg-panel:    #ffffff;
  --border:      #dee2e6;
}

/* ── Header ───────────────────────────────────────────────── */
.app-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; background: var(--bg-panel); border-bottom: 1px solid var(--border);
  flex-wrap: wrap; gap: 8px;
}
.sign-convention { font-size: 12px; display: flex; gap: 8px; }
.sc-tension { color: var(--tension); font-weight: 600; }
.sc-compression { color: var(--compression); font-weight: 600; }
.sc-sep { color: var(--unknown); }
.header-right { display: flex; gap: 8px; }
#problem-select { font-size: 14px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px; }

/* ── Buttons ──────────────────────────────────────────────── */
button {
  padding: 6px 14px; border-radius: 4px; border: 1px solid var(--border);
  background: var(--bg-panel); cursor: pointer; font-size: 13px; font-weight: 500;
  transition: background 0.15s;
}
button:disabled { opacity: 0.4; cursor: not-allowed; }
button:not(:disabled):hover { background: #f1f3f5; }
#btn-solve { width: 100%; background: var(--active); color: #fff; border-color: var(--active); margin-top: 12px; padding: 10px; font-size: 14px; }
#btn-solve:not(:disabled):hover { background: #1250a0; }
#btn-solve:disabled { background: var(--border); color: var(--unknown); border-color: var(--border); }

/* ── Truss banner ─────────────────────────────────────────── */
.truss-banner { background: var(--bg-panel); border-bottom: 1px solid var(--border); padding: 12px 20px; }

/* ── Workspace ────────────────────────────────────────────── */
.workspace {
  display: grid; grid-template-columns: 1fr 260px; gap: 0;
  flex: 1; background: var(--bg-panel); border-bottom: 1px solid var(--border);
}
.fbd-panel { padding: 16px 20px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
.side-panel { padding: 16px; display: flex; flex-direction: column; }
.panel-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--zero); margin-bottom: 8px; }

/* ── Equation display ─────────────────────────────────────── */
.equation-display { font-family: monospace; font-size: 13px; color: #495057; line-height: 1.8; padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid var(--border); }

/* ── Member list (side panel) ─────────────────────────────── */
.member-list { list-style: none; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.member-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px;
  cursor: pointer; background: #f8f9fa; gap: 8px;
}
.member-row.selected { border-color: var(--active); background: #e7f0fb; }
.member-row.correct { border-color: var(--reaction); background: #d1e7dd; }
.member-row.wrong { border-color: var(--compression); background: #f8d7da; }
.member-row-name { font-weight: 700; font-size: 13px; min-width: 28px; }
.member-row-buttons { display: flex; gap: 4px; }
.btn-predict {
  padding: 4px 8px; font-size: 11px; font-weight: 600; border-radius: 3px;
  border: 1px solid var(--border); background: #fff; cursor: pointer;
}
.btn-predict.active-T { background: var(--tension); color: #fff; border-color: var(--tension); }
.btn-predict.active-C { background: var(--compression); color: #fff; border-color: var(--compression); }
.member-row-badge { font-family: monospace; font-size: 11px; min-width: 60px; text-align: right; color: var(--zero); }
.member-row-badge.T { color: var(--tension); font-weight: 700; }
.member-row-badge.C { color: var(--compression); font-weight: 700; }
.member-row-badge.Z { color: var(--zero); }

/* ── Feedback ─────────────────────────────────────────────── */
.feedback { font-size: 13px; line-height: 1.6; margin-top: 10px; padding: 10px 12px; border-radius: 4px; border-left: 4px solid transparent; }
.feedback.wrong { background: #fff3cd; border-color: #ffc107; color: #664d03; }
.feedback.correct { background: #d1e7dd; border-color: var(--reaction); color: #0f5132; }
.feedback:empty { display: none; }

/* ── Ledger ───────────────────────────────────────────────── */
.ledger-bar { padding: 10px 20px; background: var(--bg-panel); }
.ledger-list { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.ledger-item {
  font-family: monospace; font-size: 12px; padding: 4px 8px;
  border: 1px solid var(--border); border-radius: 4px; background: #f8f9fa; color: var(--unknown);
}
.ledger-item.T { color: var(--tension); border-color: var(--tension); background: #e7f0fb; font-weight: 700; }
.ledger-item.C { color: var(--compression); border-color: var(--compression); background: #fde8e8; font-weight: 700; }
.ledger-item.Z { color: var(--zero); border-color: var(--zero); }

/* ── Summary ──────────────────────────────────────────────── */
.summary-screen {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.summary-screen > * { background: var(--bg-panel); border-radius: 8px; padding: 32px; max-width: 640px; width: 90%; }
.summary-screen h2 { margin-bottom: 16px; }
#summary-table { width: 100%; border-collapse: collapse; font-family: monospace; font-size: 13px; margin: 16px 0; }
#summary-table td, #summary-table th { padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: left; }
.summary-actions { display: flex; gap: 8px; margin-top: 16px; }

/* ── Replay ───────────────────────────────────────────────── */
.replay-screen { position: fixed; inset: 0; background: var(--bg-panel); z-index: 100; display: flex; flex-direction: column; }
.replay-header { display: flex; align-items: center; gap: 10px; padding: 12px 20px; border-bottom: 1px solid var(--border); }
#replay-step-label { font-weight: 700; flex: 1; }
.replay-content { padding: 20px; flex: 1; overflow-y: auto; }
#replay-equations { font-family: monospace; font-size: 13px; line-height: 1.8; padding: 10px; background: #f8f9fa; border-radius: 4px; margin-top: 10px; }

/* ── Responsive ───────────────────────────────────────────── */
@media (max-width: 700px) {
  .workspace { grid-template-columns: 1fr; }
  .fbd-panel { border-right: none; border-bottom: 1px solid var(--border); }
  .sign-convention { display: none; }
}

/* ── Print (replay) ───────────────────────────────────────── */
@media print {
  .app-header, .truss-banner, .workspace, .ledger-bar { display: none; }
  .replay-screen { position: static; }
  .replay-header button { display: none; }
}
```

- [ ] **Step 3: Create empty module stubs**

`truss.js`:
```js
export function getMemberAngle(memberId, jointId, problem) {}
export function getSolvableJoints(problem, solvedForces) {}
export function solveJoint(jointId, problem, solvedForces) {}
export function getEquationStrings(jointId, problem, solvedForces) {}
```

`fbd.js`:
```js
export function renderFBD(jointId, problem, solvedForces, predictions, svgEl) {}
```

`ui.js`:
```js
import { getSolvableJoints, solveJoint, getEquationStrings, getMemberAngle } from './truss.js';
import { renderFBD } from './fbd.js';
```

- [ ] **Step 4: Create `problems.json` with the king-post problem only**

```json
[
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
    ],
    "solutionOrder": ["A", "C", "B", "D"]
  }
]
```

- [ ] **Step 5: Open `index.html` in a browser and confirm the shell renders without errors**

Open `index.html` directly (no server needed). Expected: header with dropdown, blank SVG areas, no console errors.

---

## Task 2: `truss.js` — `getMemberAngle` and `getSolvableJoints`

**Files:**
- Modify: `truss.js`

- [ ] **Step 1: Write failing tests in a `<script type="module">` test block in a new `test.html`**

Create `test.html`:
```html
<!DOCTYPE html>
<html><body>
<pre id="out"></pre>
<script type="module">
import { getMemberAngle, getSolvableJoints } from './truss.js';

const KING_POST = {
  joints: [
    { id: 'A', x: 0, y: 0 }, { id: 'B', x: 4, y: 0 },
    { id: 'C', x: 8, y: 0 }, { id: 'D', x: 4, y: 3 }
  ],
  members: [
    { id: 'AB', j1: 'A', j2: 'B' }, { id: 'BC', j1: 'B', j2: 'C' },
    { id: 'BD', j1: 'B', j2: 'D' }, { id: 'AD', j1: 'A', j2: 'D' },
    { id: 'CD', j1: 'C', j2: 'D' }
  ],
  loads: [{ joint: 'D', fx: 0, fy: -12 }],
  reactions: [{ joint: 'A', fx: 0, fy: 6 }, { joint: 'C', fx: 0, fy: 6 }]
};

const results = [];

function assert(name, got, expected, tol = 1e-9) {
  const pass = Math.abs(got - expected) < tol;
  results.push(`${pass ? 'PASS' : 'FAIL'}: ${name} — got ${got}, expected ${expected}`);
}

// getMemberAngle: AB from A points right → angle 0
assert('AB from A → 0', getMemberAngle('AB', 'A', KING_POST), 0);
// AB from B points left → angle Math.PI
assert('AB from B → π', getMemberAngle('AB', 'B', KING_POST), Math.PI);
// AD from A: D is at (4,3) from A(0,0) → atan2(3,4)
assert('AD from A → atan2(3,4)', getMemberAngle('AD', 'A', KING_POST), Math.atan2(3, 4));

// getSolvableJoints with no solved forces: A and C have 2 unknowns each
const solvable0 = getSolvableJoints(KING_POST, {});
results.push(`${solvable0.includes('A') && solvable0.includes('C') ? 'PASS' : 'FAIL'}: solvable0 includes A and C`);
results.push(`${!solvable0.includes('B') && !solvable0.includes('D') ? 'PASS' : 'FAIL'}: solvable0 excludes B and D`);

// After solving AD and AB, joint D has 2 unknowns: BD and CD → solvable
const solvable1 = getSolvableJoints(KING_POST, { AD: -10, AB: 8, CD: -10, BC: 8 });
results.push(`${solvable1.includes('B') || solvable1.includes('D') ? 'PASS' : 'FAIL'}: solvable1 includes B or D`);

document.getElementById('out').textContent = results.join('\n');
</script>
</body></html>
```

Open `test.html` — expected: all FAIL (functions return undefined).

- [ ] **Step 2: Implement `getMemberAngle` and `getSolvableJoints`**

```js
export function getMemberAngle(memberId, jointId, problem) {
  const member = problem.members.find(m => m.id === memberId);
  const otherId = member.j1 === jointId ? member.j2 : member.j1;
  const from = problem.joints.find(j => j.id === jointId);
  const to   = problem.joints.find(j => j.id === otherId);
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function getSolvableJoints(problem, solvedForces) {
  return problem.joints
    .filter(joint => {
      const unknownCount = problem.members.filter(
        m => (m.j1 === joint.id || m.j2 === joint.id) && !(m.id in solvedForces)
      ).length;
      return unknownCount > 0 && unknownCount <= 2;
    })
    .map(j => j.id);
}
```

- [ ] **Step 3: Open `test.html` and confirm all tests PASS**

---

## Task 3: `truss.js` — `solveJoint`

**Files:**
- Modify: `truss.js`

- [ ] **Step 1: Add failing tests to `test.html`**

Add inside the `<script>` block, after the existing tests:

```js
// solveJoint at A (king-post): AD and AB unknown, A_y=6 known
import { solveJoint } from './truss.js';

const solA = solveJoint('A', KING_POST, {});
// AD = -10 (compression), AB = 8 (tension)
assert('solveJoint A: AD', solA['AD'], -10, 0.001);
assert('solveJoint A: AB', solA['AB'],   8, 0.001);

// solveJoint at C: CD and BC unknown, C_y=6 known
const solC = solveJoint('C', KING_POST, {});
assert('solveJoint C: CD', solC['CD'], -10, 0.001);
assert('solveJoint C: BC', solC['BC'],   8, 0.001);

// solveJoint at B: BD unknown (AB and BC already solved)
const solB = solveJoint('B', KING_POST, { AB: 8, BC: 8, AD: -10, CD: -10 });
assert('solveJoint B: BD', solB['BD'], 0, 0.001);
```

Open `test.html` — expected: new tests FAIL.

- [ ] **Step 2: Implement `solveJoint`**

```js
export function solveJoint(jointId, problem, solvedForces) {
  const joint = problem.joints.find(j => j.id === jointId);

  // Sum known force contributions to RHS
  let rhsX = 0, rhsY = 0;

  // Add reactions at this joint
  (problem.reactions || []).forEach(r => {
    if (r.joint === jointId) { rhsX -= r.fx; rhsY -= r.fy; }
  });

  // Add external loads at this joint
  (problem.loads || []).forEach(l => {
    if (l.joint === jointId) { rhsX -= l.fx; rhsY -= l.fy; }
  });

  // Separate solved vs unsolved members connected to this joint
  const connectedMembers = problem.members.filter(
    m => m.j1 === jointId || m.j2 === jointId
  );

  const unknowns = [];
  connectedMembers.forEach(m => {
    const angle = getMemberAngle(m.id, jointId, problem);
    if (m.id in solvedForces) {
      // Known: subtract from RHS  (ΣF = 0  →  known + unknown = 0)
      rhsX -= solvedForces[m.id] * Math.cos(angle);
      rhsY -= solvedForces[m.id] * Math.sin(angle);
    } else {
      unknowns.push({ id: m.id, cos: Math.cos(angle), sin: Math.sin(angle) });
    }
  });

  if (unknowns.length === 0) return {};

  if (unknowns.length === 1) {
    const u = unknowns[0];
    // Pick equation with larger coefficient to avoid division by near-zero
    const force = Math.abs(u.cos) >= Math.abs(u.sin)
      ? rhsX / u.cos
      : rhsY / u.sin;
    return { [u.id]: force };
  }

  if (unknowns.length === 2) {
    const [u1, u2] = unknowns;
    const det = u1.cos * u2.sin - u2.cos * u1.sin;
    return {
      [u1.id]: (rhsX * u2.sin - rhsY * u2.cos) / det,
      [u2.id]: (u1.cos * rhsY - u1.sin * rhsX) / det,
    };
  }

  // >2 unknowns: joint not solvable — caller should not call this
  throw new Error(`Joint ${jointId} has ${unknowns.length} unknowns — not solvable`);
}
```

- [ ] **Step 3: Open `test.html` and confirm all solver tests PASS**

---

## Task 4: `truss.js` — `getEquationStrings`

**Files:**
- Modify: `truss.js`

- [ ] **Step 1: Add failing test**

Add to `test.html`:
```js
import { getEquationStrings } from './truss.js';

const eqs = getEquationStrings('A', KING_POST, {});
// ΣFy must mention A_y and F_AD
const fyOk = eqs.fy.includes('6') && eqs.fy.includes('F_AD');
results.push(`${fyOk ? 'PASS' : 'FAIL'}: getEquationStrings A ΣFy mentions 6 and F_AD`);
// ΣFx must mention F_AB and F_AD
const fxOk = eqs.fx.includes('F_AB') && eqs.fx.includes('F_AD');
results.push(`${fxOk ? 'PASS' : 'FAIL'}: getEquationStrings A ΣFx mentions F_AB and F_AD`);
```

Open `test.html` — expected: new tests FAIL.

- [ ] **Step 2: Implement `getEquationStrings`**

```js
export function getEquationStrings(jointId, problem, solvedForces) {
  const fmt = n => {
    const rounded = Math.round(n * 1000) / 1000;
    return rounded >= 0 ? `+${rounded}` : `${rounded}`;
  };
  const fmtAngle = (cos, sin) => {
    // Express as fraction if close to a rational multiple of 1
    const r = n => Math.round(n * 10000) / 10000;
    return { cos: r(cos), sin: r(sin) };
  };

  const connectedMembers = problem.members.filter(
    m => m.j1 === jointId || m.j2 === jointId
  );

  let termsX = [], termsY = [];

  // Reactions
  (problem.reactions || []).forEach(r => {
    if (r.joint !== jointId) return;
    if (r.fx !== 0) termsX.push(fmt(r.fx));
    if (r.fy !== 0) termsY.push(fmt(r.fy));
  });

  // Loads
  (problem.loads || []).forEach(l => {
    if (l.joint !== jointId) return;
    if (l.fx !== 0) termsX.push(fmt(l.fx));
    if (l.fy !== 0) termsY.push(fmt(l.fy));
  });

  // Members
  connectedMembers.forEach(m => {
    const angle = getMemberAngle(m.id, jointId, problem);
    const { cos, sin } = fmtAngle(Math.cos(angle), Math.sin(angle));

    if (m.id in solvedForces) {
      const f = solvedForces[m.id];
      if (Math.abs(cos) > 1e-9) termsX.push(fmt(f * cos));
      if (Math.abs(sin) > 1e-9) termsY.push(fmt(f * sin));
    } else {
      if (Math.abs(cos) > 1e-9) termsX.push(`F_${m.id}·(${cos})`);
      if (Math.abs(sin) > 1e-9) termsY.push(`F_${m.id}·(${sin})`);
    }
  });

  const join = terms => terms.length ? terms.join(' ') : '0';
  return {
    fx: `ΣFx = ${join(termsX)} = 0`,
    fy: `ΣFy = ${join(termsY)} = 0`,
  };
}
```

- [ ] **Step 3: Open `test.html` and confirm equation string tests PASS**

---

## Task 5: `fbd.js` — SVG free-body diagram renderer

**Files:**
- Modify: `fbd.js`

- [ ] **Step 1: Add visual test page**

Create `fbd-test.html`:
```html
<!DOCTYPE html>
<html>
<head><link rel="stylesheet" href="style.css">
<style>body{padding:20px;} svg{border:1px solid #dee2e6; background:#fff;}</style>
</head>
<body>
<h3>FBD Test — Joint A, no predictions</h3>
<svg id="svg1" width="300" height="280"></svg>
<h3>FBD Test — Joint A, AD=Compression predicted, AB=Tension predicted</h3>
<svg id="svg2" width="300" height="280"></svg>
<h3>FBD Test — Joint A, all solved</h3>
<svg id="svg3" width="300" height="280"></svg>
<script type="module">
import { renderFBD } from './fbd.js';
const KING_POST = {
  joints:[{id:'A',x:0,y:0},{id:'B',x:4,y:0},{id:'C',x:8,y:0},{id:'D',x:4,y:3}],
  members:[{id:'AB',j1:'A',j2:'B'},{id:'BC',j1:'B',j2:'C'},{id:'BD',j1:'B',j2:'D'},{id:'AD',j1:'A',j2:'D'},{id:'CD',j1:'C',j2:'D'}],
  loads:[{joint:'D',fx:0,fy:-12}],
  reactions:[{joint:'A',fx:0,fy:6},{joint:'C',fx:0,fy:6}]
};
renderFBD('A', KING_POST, {}, {}, document.getElementById('svg1'));
renderFBD('A', KING_POST, {}, {AD:'C', AB:'T'}, document.getElementById('svg2'));
renderFBD('A', KING_POST, {AD:-10, AB:8}, {}, document.getElementById('svg3'));
</script>
</body></html>
```

Open `fbd-test.html` — expected: blank SVGs (no implementation yet).

- [ ] **Step 2: Implement `renderFBD`**

```js
const COLORS = {
  tension:     '#185FA5',
  compression: '#A32D2D',
  zero:        '#6c757d',
  reaction:    '#28a745',
  load:        '#dc3545',
  unknown:     '#adb5bd',
};
const ARROW_BASE_LEN = 70;
const MIN_ARROW_LEN  = 24;
const JOINT_R        = 12;

function makeArrowhead(id, color) {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('markerWidth', '7');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('refX', '6');
  marker.setAttribute('refY', '3.5');
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M0,0 L7,3.5 L0,7 Z');
  path.setAttribute('fill', color);
  marker.appendChild(path);
  defs.appendChild(marker);
  return defs;
}

function drawArrow(svg, cx, cy, angle, length, color, markerId, dashed, label, ariaLabel) {
  const ex = cx + Math.cos(angle) * length;
  const ey = cy + Math.sin(angle) * length;
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', cx); line.setAttribute('y1', cy);
  line.setAttribute('x2', ex); line.setAttribute('y2', ey);
  line.setAttribute('stroke', color); line.setAttribute('stroke-width', '2');
  if (dashed) line.setAttribute('stroke-dasharray', '5,4');
  line.setAttribute('marker-end', `url(#${markerId})`);
  if (ariaLabel) line.setAttribute('aria-label', ariaLabel);
  svg.appendChild(line);

  if (label) {
    const tx = cx + Math.cos(angle) * (length * 0.6 + 10);
    const ty = cy + Math.sin(angle) * (length * 0.6 + 10);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', tx); text.setAttribute('y', ty);
    text.setAttribute('font-size', '11');
    text.setAttribute('fill', color);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = label;
    svg.appendChild(text);
  }
}

export function renderFBD(jointId, problem, solvedForces, predictions, svgEl) {
  // Clear
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  const W = svgEl.clientWidth  || svgEl.getAttribute('width')  || 300;
  const H = svgEl.clientHeight || svgEl.getAttribute('height') || 280;
  const cx = W / 2;
  const cy = H / 2;

  // Collect all force magnitudes to scale arrows
  const magnitudes = [];
  Object.values(solvedForces).forEach(f => magnitudes.push(Math.abs(f)));
  const maxMag = magnitudes.length ? Math.max(...magnitudes) : 0;
  const scale = f => maxMag > 0
    ? Math.max(MIN_ARROW_LEN, ARROW_BASE_LEN * Math.abs(f) / maxMag)
    : ARROW_BASE_LEN;

  // Reactions at this joint
  (problem.reactions || []).forEach(r => {
    if (r.joint !== jointId) return;
    if (r.fx !== 0) {
      const angle = r.fx > 0 ? 0 : Math.PI;
      const markerId = `arr-reaction-x-${jointId}`;
      svgEl.appendChild(makeArrowhead(markerId, COLORS.reaction));
      drawArrow(svgEl, cx, cy, angle, ARROW_BASE_LEN, COLORS.reaction, markerId, false,
        `${r.fx > 0 ? '+' : ''}${r.fx} kN`, `Reaction: ${r.fx} kN horizontal`);
    }
    if (r.fy !== 0) {
      // SVG y is inverted: positive fy (upward) → negative SVG y direction
      const angle = r.fy > 0 ? -Math.PI / 2 : Math.PI / 2;
      const markerId = `arr-reaction-y-${jointId}`;
      svgEl.appendChild(makeArrowhead(markerId, COLORS.reaction));
      drawArrow(svgEl, cx, cy, angle, ARROW_BASE_LEN, COLORS.reaction, markerId, false,
        `${r.fy > 0 ? '+' : ''}${r.fy} kN`, `Reaction: ${r.fy} kN vertical`);
    }
  });

  // Loads at this joint
  (problem.loads || []).forEach(l => {
    if (l.joint !== jointId) return;
    if (l.fy !== 0) {
      const angle = l.fy > 0 ? -Math.PI / 2 : Math.PI / 2;
      const markerId = `arr-load-y-${jointId}`;
      svgEl.appendChild(makeArrowhead(markerId, COLORS.load));
      drawArrow(svgEl, cx, cy, angle, ARROW_BASE_LEN, COLORS.load, markerId, false,
        `${l.fy} kN`, `Load: ${l.fy} kN vertical`);
    }
    if (l.fx !== 0) {
      const angle = l.fx > 0 ? 0 : Math.PI;
      const markerId = `arr-load-x-${jointId}`;
      svgEl.appendChild(makeArrowhead(markerId, COLORS.load));
      drawArrow(svgEl, cx, cy, angle, ARROW_BASE_LEN, COLORS.load, markerId, false,
        `${l.fx} kN`, `Load: ${l.fx} kN horizontal`);
    }
  });

  // Member arrows
  const connectedMembers = problem.members.filter(
    m => m.j1 === jointId || m.j2 === jointId
  );

  connectedMembers.forEach(m => {
    // Angle from this joint toward the other end (outward direction)
    const otherId = m.j1 === jointId ? m.j2 : m.j1;
    const from = problem.joints.find(j => j.id === jointId);
    const to   = problem.joints.find(j => j.id === otherId);
    // SVG y-axis is inverted vs truss coords
    const outwardAngle = Math.atan2(-(to.y - from.y), to.x - from.x);

    const markerId = `arr-${m.id}-${jointId}`;

    if (m.id in solvedForces) {
      const f = solvedForces[m.id];
      const isZero = Math.abs(f) < 0.001;
      const color  = isZero ? COLORS.zero : f > 0 ? COLORS.tension : COLORS.compression;
      // Tension: arrow away from joint. Compression: arrow toward joint (inward).
      const drawAngle = (!isZero && f < 0) ? outwardAngle + Math.PI : outwardAngle;
      const len = isZero ? MIN_ARROW_LEN : scale(f);
      const label = isZero ? `${m.id} 0` : `${m.id} ${f > 0 ? '+' : ''}${Math.round(f * 10) / 10}`;
      svgEl.appendChild(makeArrowhead(markerId, color));
      drawArrow(svgEl, cx, cy, drawAngle, len, color, markerId, false, label,
        `Member ${m.id}: ${isZero ? 'zero force' : f > 0 ? 'tension' : 'compression'} ${f} kN`);

    } else if (predictions[m.id]) {
      const pred = predictions[m.id]; // 'T' or 'C'
      const color = pred === 'T' ? COLORS.tension : COLORS.compression;
      const drawAngle = pred === 'C' ? outwardAngle + Math.PI : outwardAngle;
      svgEl.appendChild(makeArrowhead(markerId, color));
      drawArrow(svgEl, cx, cy, drawAngle, ARROW_BASE_LEN, color, markerId, false,
        `${m.id} ${pred}`, `Member ${m.id}: predicted ${pred === 'T' ? 'tension' : 'compression'}`);

    } else {
      // Unknown: dashed gray outward
      svgEl.appendChild(makeArrowhead(markerId, COLORS.unknown));
      drawArrow(svgEl, cx, cy, outwardAngle, ARROW_BASE_LEN, COLORS.unknown, markerId, true,
        `${m.id} ?`, `Member ${m.id}: unknown`);
    }
  });

  // Joint circle (drawn last so it sits on top)
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
  circle.setAttribute('r', JOINT_R);
  circle.setAttribute('fill', '#e7f0fb');
  circle.setAttribute('stroke', '#185FA5');
  circle.setAttribute('stroke-width', '2');
  circle.setAttribute('aria-label', `Joint ${jointId}`);
  svgEl.appendChild(circle);

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', cx); label.setAttribute('y', cy + 1);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('dominant-baseline', 'middle');
  label.setAttribute('font-size', '12');
  label.setAttribute('font-weight', 'bold');
  label.setAttribute('fill', '#185FA5');
  label.textContent = jointId;
  svgEl.appendChild(label);
}
```

- [ ] **Step 3: Open `fbd-test.html` and visually verify**

Check:
- SVG 1: dashed gray arrows for AD and AB, green upward arrow for A_y reaction.
- SVG 2: red inward arrow for AD (C), blue outward arrow for AB (T).
- SVG 3: red inward arrow labeled "AD −10", blue outward arrow labeled "AB +8".

---

## Task 6: `ui.js` — Problem loader and truss overview banner

**Files:**
- Modify: `ui.js`

- [ ] **Step 1: Implement problem loader and truss banner SVG**

```js
import { getSolvableJoints, solveJoint, getEquationStrings, getMemberAngle } from './truss.js';
import { renderFBD } from './fbd.js';

// ── App state ──────────────────────────────────────────────────
let problem       = null;
let solvedForces  = {};
let predictions   = {};   // { jointId: { memberId: 'T'|'C'|null } }
let activeJoint   = null;
let hintLevels    = {};   // { jointId: 0|1|2|3 }
let selectedMember = null;
let solutionLog   = [];   // [{ jointId, forces }] in order solved

// ── DOM refs ───────────────────────────────────────────────────
const selectEl    = document.getElementById('problem-select');
const overviewSvg = document.getElementById('truss-overview-svg');
const fbdSvg      = document.getElementById('fbd-svg');
const eqDisplay   = document.getElementById('equation-display');
const memberList  = document.getElementById('member-list');
const btnSolve    = document.getElementById('btn-solve');
const btnHint     = document.getElementById('btn-hint');
const btnReset    = document.getElementById('btn-reset');
const feedbackEl  = document.getElementById('feedback-message');
const ledgerList  = document.getElementById('ledger-list');
const panelTitle  = document.querySelector('.fbd-panel .panel-title');

// ── Boot ───────────────────────────────────────────────────────
async function boot() {
  const res = await fetch('./problems.json');
  const problems = await res.json();

  problems.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = p.name;
    selectEl.appendChild(opt);
  });

  selectEl.addEventListener('change', () => loadProblem(problems[+selectEl.value]));
  loadProblem(problems[0]);
}

function loadProblem(p) {
  problem       = p;
  solvedForces  = {};
  predictions   = {};
  activeJoint   = null;
  hintLevels    = {};
  selectedMember = null;
  solutionLog   = [];

  panelTitle.textContent = 'Select a joint to begin';
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';
  eqDisplay.textContent = '';
  memberList.innerHTML = '';
  btnSolve.disabled = true;
  btnHint.disabled  = true;
  btnReset.disabled  = true;

  renderOverview();
  renderLedger();
}

// ── Truss overview banner ──────────────────────────────────────
function renderOverview() {
  while (overviewSvg.firstChild) overviewSvg.removeChild(overviewSvg.firstChild);

  const W = overviewSvg.parentElement.clientWidth || 600;
  const H = 120;
  overviewSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // Fit truss coords into SVG viewport with padding
  const xs = problem.joints.map(j => j.x);
  const ys = problem.joints.map(j => j.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 40;
  const scaleX = (W - pad * 2) / (maxX - minX || 1);
  const scaleY = (H - pad * 2) / (maxY - minY || 1);
  const sc = Math.min(scaleX, scaleY);
  const offX = pad + (W - pad * 2 - (maxX - minX) * sc) / 2 - minX * sc;
  const offY = H - pad - minY * sc;
  const tx = x => offX + x * sc;
  const ty = y => offY - y * sc;   // flip y for SVG

  // Members
  problem.members.forEach(m => {
    const j1 = problem.joints.find(j => j.id === m.j1);
    const j2 = problem.joints.find(j => j.id === m.j2);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', tx(j1.x)); line.setAttribute('y1', ty(j1.y));
    line.setAttribute('x2', tx(j2.x)); line.setAttribute('y2', ty(j2.y));

    const f = solvedForces[m.id];
    let stroke = '#adb5bd';
    if (f !== undefined) {
      stroke = Math.abs(f) < 0.001 ? '#6c757d' : f > 0 ? '#185FA5' : '#A32D2D';
    }
    line.setAttribute('stroke', stroke);
    line.setAttribute('stroke-width', '2.5');
    line.setAttribute('aria-label', `Member ${m.id}`);
    overviewSvg.appendChild(line);
  });

  const solvable = getSolvableJoints(problem, solvedForces);

  // Joints
  problem.joints.forEach(joint => {
    const isSolved   = Object.keys(solvedForces).some(mid => {
      const m = problem.members.find(mm => mm.id === mid);
      return m && (m.j1 === joint.id || m.j2 === joint.id);
    }) && problem.members.filter(m => m.j1 === joint.id || m.j2 === joint.id)
          .every(m => m.id in solvedForces);
    const isSolvable = solvable.includes(joint.id);
    const isActive   = joint.id === activeJoint;

    const unknownCount = problem.members.filter(
      m => (m.j1 === joint.id || m.j2 === joint.id) && !(m.id in solvedForces)
    ).length;

    let fill = '#adb5bd', stroke = '#8a9ba8', cursor = 'default';
    if (isSolved)   { fill = '#0d3d6e'; stroke = '#0d3d6e'; }
    if (isSolvable) { fill = '#28a745'; stroke = '#1a7335'; cursor = 'pointer'; }
    if (isActive)   { fill = '#185FA5'; stroke = '#1250a0'; cursor = 'pointer'; }

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if (isSolvable || isActive) {
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `Joint ${joint.id}: click to solve`);
      g.style.cursor = cursor;
      const activate = () => activateJoint(joint.id);
      g.addEventListener('click', activate);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
    } else {
      g.setAttribute('aria-label', `Joint ${joint.id}: locked — ${unknownCount} unknowns remaining`);
      g.setAttribute('title', `Joint ${joint.id}: locked — ${unknownCount} unknowns remaining`);
    }

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', tx(joint.x)); circle.setAttribute('cy', ty(joint.y));
    circle.setAttribute('r', '10');
    circle.setAttribute('fill', fill);
    circle.setAttribute('stroke', stroke);
    circle.setAttribute('stroke-width', '2');
    g.appendChild(circle);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', tx(joint.x)); text.setAttribute('y', ty(joint.y) + 1);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', 'white');
    text.setAttribute('pointer-events', 'none');
    text.textContent = joint.id;
    g.appendChild(text);

    // Solved checkmark
    if (isSolved) {
      const ck = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ck.setAttribute('x', tx(joint.x) + 8); ck.setAttribute('y', ty(joint.y) - 8);
      ck.setAttribute('font-size', '10'); ck.setAttribute('fill', '#28a745');
      ck.textContent = '✓';
      g.appendChild(ck);
    }

    overviewSvg.appendChild(g);
  });
}

boot();
```

- [ ] **Step 2: Open `index.html` in a browser**

Expected: problem name shows in dropdown, truss overview SVG renders with gray members and green joint circles for A and C.

---

## Task 7: `ui.js` — Joint activation and FBD + side panel wiring

**Files:**
- Modify: `ui.js`

- [ ] **Step 1: Add `activateJoint`, `renderSidePanel`, and prediction button handlers**

Append to `ui.js`:

```js
// ── Joint activation ───────────────────────────────────────────
function activateJoint(jointId) {
  activeJoint   = jointId;
  selectedMember = null;
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';
  btnHint.disabled  = false;
  btnReset.disabled = false;
  btnSolve.disabled = true;

  if (!predictions[jointId]) predictions[jointId] = {};

  panelTitle.textContent = `Free Body Diagram — Joint ${jointId}`;

  const preds = predictions[jointId];
  renderFBD(jointId, problem, solvedForces, preds, fbdSvg);
  renderEquations(jointId);
  renderSidePanel(jointId);
  renderOverview();
}

// ── Side panel ─────────────────────────────────────────────────
function renderSidePanel(jointId) {
  memberList.innerHTML = '';
  const unknownMembers = problem.members.filter(
    m => (m.j1 === jointId || m.j2 === jointId) && !(m.id in solvedForces)
  );

  if (unknownMembers.length === 0) {
    memberList.innerHTML = '<li style="color:#6c757d;font-size:13px;">All members at this joint are solved.</li>';
    btnSolve.disabled = true;
    return;
  }

  unknownMembers.forEach(m => {
    const pred = (predictions[jointId] || {})[m.id];
    const li = document.createElement('li');
    li.className = 'member-row';
    li.dataset.memberId = m.id;

    li.innerHTML = `
      <span class="member-row-name">${m.id}</span>
      <div class="member-row-buttons">
        <button class="btn-predict${pred === 'T' ? ' active-T' : ''}"
                data-pred="T" aria-label="${m.id} tension">T (+)</button>
        <button class="btn-predict${pred === 'C' ? ' active-C' : ''}"
                data-pred="C" aria-label="${m.id} compression">C (−)</button>
      </div>
      <span class="member-row-badge${pred ? ' ' + pred : ''}">
        ${pred ? pred : '?'}
      </span>`;

    li.querySelectorAll('.btn-predict').forEach(btn => {
      btn.addEventListener('click', () => setPrediction(jointId, m.id, btn.dataset.pred));
    });

    memberList.appendChild(li);
  });

  checkSolveReady(jointId);
}

function setPrediction(jointId, memberId, pred) {
  if (!predictions[jointId]) predictions[jointId] = {};
  predictions[jointId][memberId] = pred;
  renderFBD(jointId, problem, solvedForces, predictions[jointId], fbdSvg);
  renderSidePanel(jointId);
}

function checkSolveReady(jointId) {
  const preds = predictions[jointId] || {};
  const unknownMembers = problem.members.filter(
    m => (m.j1 === jointId || m.j2 === jointId) && !(m.id in solvedForces)
  );
  const allPredicted = unknownMembers.every(m => preds[m.id]);
  btnSolve.disabled = !allPredicted;
}

// ── Equations ──────────────────────────────────────────────────
function renderEquations(jointId) {
  const eqs = getEquationStrings(jointId, problem, solvedForces);
  eqDisplay.textContent = `${eqs.fx}\n${eqs.fy}`;
}
```

- [ ] **Step 2: Wire Reset and Hint buttons**

Append to `ui.js`:

```js
// ── Reset ──────────────────────────────────────────────────────
btnReset.addEventListener('click', () => {
  if (!activeJoint) return;
  predictions[activeJoint] = {};
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';
  renderFBD(activeJoint, problem, solvedForces, {}, fbdSvg);
  renderSidePanel(activeJoint);
});

// ── Hint ───────────────────────────────────────────────────────
btnHint.addEventListener('click', () => {
  if (!activeJoint) return;
  if (!hintLevels[activeJoint]) hintLevels[activeJoint] = 0;
  hintLevels[activeJoint] = Math.min(hintLevels[activeJoint] + 1, 3);
  showHint(activeJoint, hintLevels[activeJoint]);
});

function showHint(jointId, level) {
  const unknowns = problem.members.filter(
    m => (m.j1 === jointId || m.j2 === jointId) && !(m.id in solvedForces)
  );

  let msg = '';
  if (level === 1) {
    msg = 'Isolate the joint with the fewest unknowns — fewer unknowns means fewer variables in your equilibrium equations.';
  } else if (level === 2) {
    // Find which equation has only one unknown
    let xOnlyUnknown = null, yOnlyUnknown = null;
    let xCount = 0, yCount = 0;
    unknowns.forEach(m => {
      const angle = getMemberAngle(m.id, jointId, problem);
      if (Math.abs(Math.sin(angle)) > 1e-9) { yCount++; yOnlyUnknown = m.id; }
      if (Math.abs(Math.cos(angle)) > 1e-9) { xCount++; xOnlyUnknown = m.id; }
    });
    if (yCount === 1) {
      msg = `ΣFy has only one unknown here: F_${yOnlyUnknown}. Start there.`;
    } else if (xCount === 1) {
      msg = `ΣFx has only one unknown here: F_${xOnlyUnknown}. Start there.`;
    } else {
      msg = 'Both ΣFx and ΣFy have two unknowns — solve the system simultaneously.';
    }
  } else if (level === 3) {
    const solved = solveJoint(jointId, problem, solvedForces);
    const first = unknowns[0];
    const f = solved[first.id];
    const sign = Math.abs(f) < 0.001 ? 'Zero force' : f > 0 ? 'Tension' : 'Compression';
    msg = `F_${first.id} = ${Math.round(f * 100) / 100} kN (${sign}).`;
  }

  feedbackEl.textContent = msg;
  feedbackEl.className = 'feedback wrong'; // amber style for hints
}
```

- [ ] **Step 3: Open `index.html`, click Joint A**

Expected: FBD renders with green upward reaction arrow and two dashed gray member arrows. Side panel shows AD and AB rows with T/C buttons. Clicking T on AD changes the FBD arrow to solid blue outward.

---

## Task 8: `ui.js` — Solve & Verify, feedback, ledger, unlock

**Files:**
- Modify: `ui.js`

- [ ] **Step 1: Add Solve & Verify handler**

Append to `ui.js`:

```js
// ── Solve & Verify ─────────────────────────────────────────────
btnSolve.addEventListener('click', () => {
  if (!activeJoint) return;
  const solved = solveJoint(activeJoint, problem, solvedForces);
  const preds  = predictions[activeJoint] || {};

  const unknowns = problem.members.filter(
    m => (m.j1 === activeJoint || m.j2 === activeJoint) && !(m.id in solvedForces)
  );

  let allCorrect = true;
  const rows = memberList.querySelectorAll('.member-row');

  unknowns.forEach(m => {
    const f    = solved[m.id];
    const pred = preds[m.id];
    const isZero = Math.abs(f) < 0.001;
    const correct = (!isZero && pred === 'T' && f > 0) || (!isZero && pred === 'C' && f < 0);

    const row = [...rows].find(r => r.dataset.memberId === m.id);
    if (correct) {
      row.classList.add('correct');
    } else {
      row.classList.add('wrong');
      allCorrect = false;
    }

    // Update badge with solved value
    const badge = row.querySelector('.member-row-badge');
    if (isZero) {
      badge.className = 'member-row-badge Z';
      badge.textContent = '0 kN';
    } else {
      badge.className = `member-row-badge ${f > 0 ? 'T' : 'C'}`;
      badge.textContent = `${f > 0 ? '+' : ''}${Math.round(f * 100) / 100} kN`;
    }
  });

  if (allCorrect) {
    // Commit forces
    Object.assign(solvedForces, solved);
    solutionLog.push({ jointId: activeJoint, forces: { ...solved } });

    renderFBD(activeJoint, problem, solvedForces, {}, fbdSvg);
    renderLedger();
    renderOverview();
    renderEquations(activeJoint);

    feedbackEl.className = 'feedback correct';
    feedbackEl.textContent = `Joint ${activeJoint} solved. Values added to ledger.`;

    // Check if all members solved
    if (problem.members.every(m => m.id in solvedForces)) {
      setTimeout(showSummary, 600);
    } else {
      // Add Next Joint button
      const nextBtn = document.createElement('button');
      nextBtn.textContent = 'Next Joint →';
      nextBtn.style.marginTop = '8px';
      nextBtn.style.background = '#28a745';
      nextBtn.style.color = 'white';
      nextBtn.style.border = 'none';
      nextBtn.style.borderRadius = '4px';
      nextBtn.style.padding = '8px 16px';
      nextBtn.style.cursor = 'pointer';
      nextBtn.addEventListener('click', () => {
        activeJoint = null;
        panelTitle.textContent = 'Select a joint to begin';
        feedbackEl.textContent = '';
        memberList.innerHTML = '';
        btnSolve.disabled = true;
        btnHint.disabled = true;
        btnReset.disabled = true;
        while (fbdSvg.firstChild) fbdSvg.removeChild(fbdSvg.firstChild);
        eqDisplay.textContent = '';
        renderOverview();
        nextBtn.remove();
      });
      feedbackEl.after(nextBtn);
    }
  } else {
    // Build diagnostic message
    const wrongMembers = unknowns.filter(m => {
      const f = solved[m.id];
      const pred = preds[m.id];
      const isZero = Math.abs(f) < 0.001;
      return !(!isZero && ((pred === 'T' && f > 0) || (pred === 'C' && f < 0)));
    });
    feedbackEl.className = 'feedback wrong';
    feedbackEl.textContent = buildDiagnostic(activeJoint, wrongMembers[0].id, solved);
  }
});

function buildDiagnostic(jointId, memberId, solved) {
  const f = solved[memberId];
  const isZero = Math.abs(f) < 0.001;
  if (isZero) {
    return `${memberId} carries no force at this joint. Both equilibrium equations are satisfied without it contributing — it is a zero-force member.`;
  }
  if (f < 0) {
    return `${memberId} = ${Math.round(f * 100) / 100} kN. The net known forces require a component in the opposite direction — ${memberId} must push the joint (compression).`;
  }
  return `${memberId} = +${Math.round(f * 100) / 100} kN. The net known forces require a component in the same direction — ${memberId} must pull the joint (tension).`;
}
```

- [ ] **Step 2: Add `renderLedger`**

Append to `ui.js`:

```js
function renderLedger() {
  ledgerList.innerHTML = '';
  problem.members.forEach(m => {
    const li = document.createElement('li');
    li.className = 'ledger-item';
    const f = solvedForces[m.id];
    if (f === undefined) {
      li.textContent = `${m.id} ?`;
    } else if (Math.abs(f) < 0.001) {
      li.className += ' Z';
      li.textContent = `${m.id} = 0`;
    } else if (f > 0) {
      li.className += ' T';
      li.textContent = `${m.id} = +${Math.round(f * 100) / 100} kN T`;
    } else {
      li.className += ' C';
      li.textContent = `${m.id} = ${Math.round(f * 100) / 100} kN C`;
    }
    ledgerList.appendChild(li);
  });
}
```

- [ ] **Step 3: End-to-end test of king-post problem**

Open `index.html`. Work through the king-post problem:
1. Click Joint A → predict AD=C, AB=T → Solve & Verify → confirm correct, ledger updates.
2. Click Joint C → predict CD=C, BC=T → Solve & Verify → confirm correct.
3. Click Joint B → predict BD=T or C → Solve & Verify → see zero-force diagnostic.
4. Confirm all members appear in ledger with correct values.

---

## Task 9: Summary screen and replay mode

**Files:**
- Modify: `ui.js`

- [ ] **Step 1: Implement `showSummary`**

Append to `ui.js`:

```js
// ── Summary ────────────────────────────────────────────────────
function showSummary() {
  const screen = document.getElementById('summary-screen');
  screen.classList.remove('hidden');

  // Render colored truss SVG
  renderOverview(); // overview already colored; clone it into summary
  const sumSvg = document.getElementById('summary-svg');
  sumSvg.innerHTML = overviewSvg.innerHTML;
  sumSvg.setAttribute('viewBox', overviewSvg.getAttribute('viewBox'));

  // Table
  const table = document.getElementById('summary-table');
  table.innerHTML = '<tr><th>Member</th><th>Force (kN)</th><th>Type</th></tr>';
  problem.members.forEach(m => {
    const f = solvedForces[m.id];
    const isZero = Math.abs(f) < 0.001;
    const type = isZero ? 'Zero' : f > 0 ? 'Tension' : 'Compression';
    const color = isZero ? '#6c757d' : f > 0 ? '#185FA5' : '#A32D2D';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.id}</td><td style="font-family:monospace">${isZero ? '0' : (f > 0 ? '+' : '') + Math.round(f * 100) / 100}</td><td style="color:${color};font-weight:700">${type}</td>`;
    table.appendChild(tr);
  });

  document.getElementById('btn-replay').onclick = startReplay;
  document.getElementById('btn-try-another').onclick = () => {
    screen.classList.add('hidden');
    // Reset to first problem or let user pick from dropdown
    loadProblem(problem); // reload same; user can pick another via dropdown
  };
}

// ── Replay ─────────────────────────────────────────────────────
let replayIndex = 0;

function startReplay() {
  document.getElementById('summary-screen').classList.add('hidden');
  const replayScreen = document.getElementById('replay-screen');
  replayScreen.classList.remove('hidden');
  replayIndex = 0;
  renderReplayStep();

  document.getElementById('btn-replay-prev').onclick = () => {
    if (replayIndex > 0) { replayIndex--; renderReplayStep(); }
  };
  document.getElementById('btn-replay-next').onclick = () => {
    if (replayIndex < solutionLog.length - 1) { replayIndex++; renderReplayStep(); }
  };
  document.getElementById('btn-replay-close').onclick = () => {
    replayScreen.classList.add('hidden');
    document.getElementById('summary-screen').classList.remove('hidden');
  };
  document.getElementById('btn-replay-print').onclick = () => window.print();
}

function renderReplayStep() {
  const { jointId, forces } = solutionLog[replayIndex];

  document.getElementById('replay-step-label').textContent =
    `Step ${replayIndex + 1} of ${solutionLog.length}: Joint ${jointId}`;

  // Reconstruct solvedForces up to and including this step
  const partial = {};
  for (let i = 0; i <= replayIndex; i++) {
    Object.assign(partial, solutionLog[i].forces);
  }

  const replaySvg = document.getElementById('replay-fbd-svg');
  renderFBD(jointId, problem, partial, {}, replaySvg);

  const eqs = getEquationStrings(jointId, problem,
    // Show equations with forces known from previous steps only
    (() => { const p = {}; for (let i = 0; i < replayIndex; i++) Object.assign(p, solutionLog[i].forces); return p; })()
  );
  document.getElementById('replay-equations').textContent = `${eqs.fx}\n${eqs.fy}`;

  document.getElementById('btn-replay-prev').disabled = replayIndex === 0;
  document.getElementById('btn-replay-next').disabled = replayIndex === solutionLog.length - 1;
}
```

- [ ] **Step 2: Test summary and replay**

Complete the king-post problem. Confirm:
- Summary screen appears with colored truss and forces table.
- Clicking Replay steps through each joint's FBD.
- Print button triggers browser print dialog.
- Close returns to summary.

---

## Task 10: Add Warren and Cantilever problems to `problems.json`

**Files:**
- Modify: `problems.json`

- [ ] **Step 1: Add the two problems**

```json
[
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
    "loads": [{ "joint": "D", "fx": 0, "fy": -12 }],
    "reactions": [
      { "joint": "A", "fx": 0, "fy": 6 },
      { "joint": "C", "fx": 0, "fy": 6 }
    ],
    "solutionOrder": ["A", "C", "B", "D"]
  },
  {
    "id": "warren",
    "name": "Warren Truss",
    "joints": [
      { "id": "A", "x": 0,  "y": 0, "support": "pin" },
      { "id": "B", "x": 6,  "y": 0, "support": "free" },
      { "id": "C", "x": 12, "y": 0, "support": "roller" },
      { "id": "D", "x": 3,  "y": 4, "support": "free" },
      { "id": "E", "x": 9,  "y": 4, "support": "free" }
    ],
    "members": [
      { "id": "AB", "j1": "A", "j2": "B" },
      { "id": "BC", "j1": "B", "j2": "C" },
      { "id": "AD", "j1": "A", "j2": "D" },
      { "id": "DE", "j1": "D", "j2": "E" },
      { "id": "CE", "j1": "C", "j2": "E" },
      { "id": "BD", "j1": "B", "j2": "D" },
      { "id": "BE", "j1": "B", "j2": "E" }
    ],
    "loads": [
      { "joint": "D", "fx": 0, "fy": -12 },
      { "joint": "E", "fx": 0, "fy": -12 }
    ],
    "reactions": [
      { "joint": "A", "fx": 0, "fy": 12 },
      { "joint": "C", "fx": 0, "fy": 12 }
    ],
    "solutionOrder": ["A", "C", "D", "E", "B"]
  },
  {
    "id": "cantilever",
    "name": "Cantilever Truss",
    "joints": [
      { "id": "A", "x": 0, "y": 0, "support": "pin" },
      { "id": "B", "x": 0, "y": 4, "support": "roller-horizontal" },
      { "id": "C", "x": 3, "y": 0, "support": "free" },
      { "id": "D", "x": 3, "y": 4, "support": "free" },
      { "id": "E", "x": 6, "y": 0, "support": "free" }
    ],
    "members": [
      { "id": "AB", "j1": "A", "j2": "B" },
      { "id": "AC", "j1": "A", "j2": "C" },
      { "id": "BC", "j1": "B", "j2": "C" },
      { "id": "BD", "j1": "B", "j2": "D" },
      { "id": "CD", "j1": "C", "j2": "D" },
      { "id": "CE", "j1": "C", "j2": "E" },
      { "id": "DE", "j1": "D", "j2": "E" }
    ],
    "loads": [{ "joint": "E", "fx": 0, "fy": -20 }],
    "reactions": [
      { "joint": "A", "fx": 30, "fy": 20 },
      { "joint": "B", "fx": -30, "fy": 0 }
    ],
    "solutionOrder": ["E", "D", "A", "C", "B"]
  }
]
```

- [ ] **Step 2: Test Warren truss end-to-end**

Open `index.html`, select "Warren Truss". Solve A → C → D → E → B. Confirm BD=0 and BE=0 appear as zero-force with gray badges and diagnostic messages.

- [ ] **Step 3: Test Cantilever truss end-to-end**

Select "Cantilever Truss". Solve E → D → A → C → B. Verify DE=+25T, BC=+25T, AC=−30C in ledger.

---

## Task 11: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# Method of Joints Trainer

A static web app for learning the method of joints in structural analysis. Students predict whether each truss member is in tension or compression, then verify their predictions using equilibrium equations.

## Running locally

Open `index.html` in any browser. No server required.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages**, set source to **Deploy from branch: main / (root)**.
3. The app will be live at `https://<username>.github.io/<repo-name>/`.

## Adding new problems

Edit `problems.json`. Each problem is an object with:

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier |
| `name` | string | Display name in the dropdown |
| `joints` | array | Each joint: `{ id, x, y, support }` |
| `members` | array | Each member: `{ id, j1, j2 }` |
| `loads` | array | Applied forces: `{ joint, fx, fy }` in kN |
| `reactions` | array | Support reactions (precomputed): `{ joint, fx, fy }` in kN |
| `solutionOrder` | array | Joint IDs in the order students should solve them (used for replay) |

**Support types:** `"pin"` (fx+fy), `"roller"` (fy only), `"roller-horizontal"` (fx only), `"free"` (none).

**Coordinate system:** x = right, y = up. Forces in kN; positive = right/up.

**Reactions must be precomputed.** The solver uses them as known inputs — it does not compute reactions from scratch.

### Example: simple 3-joint truss

```json
{
  "id": "simple",
  "name": "Simple Triangle",
  "joints": [
    { "id": "A", "x": 0, "y": 0, "support": "pin" },
    { "id": "B", "x": 4, "y": 0, "support": "roller" },
    { "id": "C", "x": 2, "y": 3, "support": "free" }
  ],
  "members": [
    { "id": "AC", "j1": "A", "j2": "C" },
    { "id": "BC", "j1": "B", "j2": "C" },
    { "id": "AB", "j1": "A", "j2": "B" }
  ],
  "loads": [{ "joint": "C", "fx": 0, "fy": -10 }],
  "reactions": [
    { "joint": "A", "fx": 0, "fy": 5 },
    { "joint": "B", "fx": 0, "fy": 5 }
  ],
  "solutionOrder": ["A", "B", "C"]
}
```
```

---

## Self-Review Checklist

Running spec coverage check now:

| Spec requirement | Task |
|---|---|
| Layout B (truss banner + FBD + ledger) | Tasks 1, 6 |
| Interaction C (side panel member list + T/C buttons) | Task 7 |
| FBD arrows: dashed unknown, solid predicted/solved | Task 5 |
| Tension=blue, Compression=red, Zero=gray | Tasks 1, 5 |
| `truss.js` pure functions, no DOM | Tasks 2, 3, 4 |
| `fbd.js` SVG renderer | Task 5 |
| Solve & Verify with correct/wrong feedback | Task 8 |
| Diagnostic messages in physical terms | Task 8 |
| Member ledger | Task 8 |
| Hint system 3 levels | Task 7 |
| Reset button | Task 7 |
| Summary screen | Task 9 |
| Replay mode with print | Task 9 |
| King-post problem fully solved + tested | Tasks 1–9 |
| Warren + Cantilever problems | Task 10 |
| README with schema docs | Task 11 |
| Responsive (<700px) | Task 1 (CSS) |
| Keyboard navigation + aria-labels | Tasks 5, 6 |
| `problems.json` loadable via fetch | Task 6 |

No gaps found. All spec requirements covered.
