# Resizable Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed-height, fixed-width layout with a fully resizable panel layout where the truss overview sits in a top strip and the FBD/side panels fill remaining height, all with drag handles and SVGs that redraw as panels resize.

**Architecture:** CSS flexbox fills the viewport; two drag handles (horizontal between overview and workspace, vertical between FBD and side panel) use mousedown/mousemove/mouseup to update inline heights/widths persisted to localStorage; ResizeObserver instances watch each SVG container and re-call the existing render functions when dimensions change. The bottom ledger bar is removed — ledger items move into the overview strip.

**Tech Stack:** Vanilla JS ES modules, CSS flexbox, ResizeObserver API, localStorage. No build step — serve via `python -m http.server 8080` and open `http://localhost:8080`.

---

## File Map

| File | Changes |
|---|---|
| `style.css` | body viewport lock; banner flex; overview child classes; workspace flex; fbd-panel + fbd-svg flex; side-panel flex-shrink; handle styles; remove .ledger-bar |
| `index.html` | banner inner wrapper + ledger; horizontal handle element; vertical handle element; fbd-svg height attr; remove ledger-bar section |
| `ui.js` | new DOM refs + constants; initResizeHandles(); initResizeObservers(); renderOverview() reads H from container; boot() calls both |

---

## Task 1: CSS — viewport lock, panel flex, handle styles

**Files:** Modify `style.css`

- [ ] **Step 1: Lock body to viewport height**

In `style.css`, replace:
```css
body { font-family: system-ui, -apple-system, sans-serif; background: #f8f9fa; color: #212529; min-height: 100vh; display: flex; flex-direction: column; }
```
With:
```css
body { font-family: system-ui, -apple-system, sans-serif; background: #f8f9fa; color: #212529; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
```

- [ ] **Step 2: Replace .truss-banner and add overview child classes**

Replace:
```css
.truss-banner { background: var(--bg-panel); border-bottom: 1px solid var(--border); padding: 12px 20px; }
```
With:
```css
.truss-banner { background: var(--bg-panel); border-bottom: 1px solid var(--border); display: flex; align-items: stretch; overflow: hidden; flex-shrink: 0; }
.overview-inner { display: flex; flex: 1; min-width: 0; padding: 8px 16px; gap: 12px; overflow: hidden; }
.overview-svg-wrap { flex: 1; min-width: 0; display: flex; align-items: center; overflow: hidden; }
#truss-overview-svg { display: block; }
.overview-ledger { flex-shrink: 0; width: 200px; padding: 8px 0 8px 12px; border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow-y: auto; }
.overview-ledger-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--zero); margin-bottom: 6px; flex-shrink: 0; }
```

- [ ] **Step 3: Update .workspace from grid to flex**

Replace:
```css
.workspace {
  display: grid; grid-template-columns: 1fr 260px; gap: 0;
  flex: 1; background: var(--bg-panel); border-bottom: 1px solid var(--border);
}
```
With:
```css
.workspace { display: flex; flex: 1; min-height: 0; background: var(--bg-panel); }
```

- [ ] **Step 4: Update .fbd-panel and add #fbd-svg flex rule**

Replace:
```css
.fbd-panel { padding: 16px 20px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
```
With:
```css
.fbd-panel { padding: 16px 20px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 0; overflow: hidden; }
#fbd-svg { flex: 1; min-height: 0; display: block; }
```

- [ ] **Step 5: Update .side-panel**

Replace:
```css
.side-panel { padding: 16px; display: flex; flex-direction: column; }
```
With:
```css
.side-panel { padding: 16px; display: flex; flex-direction: column; flex-shrink: 0; overflow-y: auto; }
```

- [ ] **Step 6: Remove .ledger-bar, add resize handle styles**

Remove this rule (keep `.ledger-list` and `.ledger-item` — those classes stay on the moved element):
```css
.ledger-bar { padding: 10px 20px; background: var(--bg-panel); }
```

Add these rules after the existing `/* ── Ledger ─────────── */` block:
```css
/* ── Resize handles ───────────────────────────────────────── */
.resize-handle-h {
  height: 6px; flex-shrink: 0; cursor: row-resize; user-select: none;
  background: #f1f3f5; display: flex; align-items: center; justify-content: center;
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
}
.resize-handle-h::after {
  content: ''; display: block; width: 32px; height: 2px; border-radius: 1px;
  background: #adb5bd; box-shadow: 0 -3px 0 #adb5bd, 0 3px 0 #adb5bd;
}
.resize-handle-h:hover::after, .resize-handle-h.dragging::after {
  background: #6c757d; box-shadow: 0 -3px 0 #6c757d, 0 3px 0 #6c757d;
}
.resize-handle-v {
  width: 6px; flex-shrink: 0; cursor: col-resize; user-select: none;
  background: #f1f3f5; display: flex; align-items: center; justify-content: center;
  border-left: 1px solid var(--border); border-right: 1px solid var(--border);
}
.resize-handle-v::after {
  content: ''; display: block; height: 32px; width: 2px; border-radius: 1px;
  background: #adb5bd; box-shadow: -3px 0 0 #adb5bd, 3px 0 0 #adb5bd;
}
.resize-handle-v:hover::after, .resize-handle-v.dragging::after {
  background: #6c757d; box-shadow: -3px 0 0 #6c757d, 3px 0 0 #6c757d;
}
```

- [ ] **Step 7: Update responsive breakpoint**

Replace:
```css
@media (max-width: 700px) {
  .workspace { grid-template-columns: 1fr; }
  .fbd-panel { border-right: none; border-bottom: 1px solid var(--border); }
  .sign-convention { display: none; }
}
```
With:
```css
@media (max-width: 700px) {
  .workspace { flex-direction: column; }
  .fbd-panel { border-right: none; border-bottom: 1px solid var(--border); }
  .resize-handle-v { display: none; }
  .sign-convention { display: none; }
}
```

- [ ] **Step 8: Commit**

```bash
git add style.css
git commit -m "feat: restructure CSS for resizable viewport-filling layout"
```

---

## Task 2: HTML — restructure markup

**Files:** Modify `index.html`

- [ ] **Step 1: Restructure truss-banner — add inner wrapper and ledger**

Replace:
```html
  <section class="truss-banner" aria-label="Truss overview">
    <svg id="truss-overview-svg" width="100%" height="120"></svg>
  </section>
```
With:
```html
  <section class="truss-banner" aria-label="Truss overview" id="truss-banner">
    <div class="overview-inner">
      <div class="overview-svg-wrap">
        <svg id="truss-overview-svg" width="100%" height="100%"></svg>
      </div>
      <div class="overview-ledger">
        <div class="overview-ledger-title">Ledger</div>
        <ul id="ledger-list" class="ledger-list"></ul>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Add horizontal resize handle between banner and workspace**

After the `</section>` closing tag of `.truss-banner` and before `<main class="workspace">`, insert:
```html
  <div class="resize-handle-h" id="resize-handle-h"></div>
```

- [ ] **Step 3: Update fbd-svg height and insert vertical resize handle**

Replace:
```html
    <svg id="fbd-svg" width="100%" height="300" aria-label="Free body diagram"></svg>
    <div class="equation-display" id="equation-display"></div>
  </section>

  <aside class="side-panel" aria-label="Member predictions">
```
With:
```html
    <svg id="fbd-svg" width="100%" height="100%" aria-label="Free body diagram"></svg>
    <div class="equation-display" id="equation-display"></div>
  </section>

  <div class="resize-handle-v" id="resize-handle-v"></div>

  <aside class="side-panel" aria-label="Member predictions">
```

- [ ] **Step 4: Remove the old ledger-bar section**

Remove this entire block:
```html
  <section class="ledger-bar" aria-label="Member ledger">
    <ul id="ledger-list" class="ledger-list"></ul>
  </section>
```

- [ ] **Step 5: Verify in browser**

```bash
python -m http.server 8080
```
Open `http://localhost:8080`.

Expected:
- Page fills the full browser window with no vertical scrollbar
- Overview strip appears at top; ledger column on its right
- FBD panel and side panel fill remaining height
- Thin grip bars visible between sections (not draggable yet)
- No content is clipped or hidden

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: restructure HTML for resizable layout with drag handle elements"
```

---

## Task 3: JS — resize handle drag behavior with localStorage persistence

**Files:** Modify `ui.js`

- [ ] **Step 1: Add DOM refs and size constants**

After the existing `// ── DOM refs ───────────────────────────────────────────────` block (after the `const panelTitle = ...` line), add:

```js
const bannerEl    = document.getElementById('truss-banner');
const sidePanel   = document.querySelector('.side-panel');

const OVERVIEW_DEFAULT_H = 160;
const OVERVIEW_MIN_H     = 80;
const SIDE_DEFAULT_W     = 280;
const SIDE_MIN_W         = 200;
const SIDE_MAX_W         = 480;
```

- [ ] **Step 2: Add initResizeHandles function**

Add this entire function before the `// ── Boot ───────────────────────────────────────────────────────` comment:

```js
// ── Resize handles ─────────────────────────────────────────
function initResizeHandles() {
  const handleH = document.getElementById('resize-handle-h');
  const handleV = document.getElementById('resize-handle-v');

  const savedH = parseInt(localStorage.getItem('truss-overview-h'), 10);
  const savedW = parseInt(localStorage.getItem('truss-side-w'), 10);
  bannerEl.style.height = (savedH || OVERVIEW_DEFAULT_H) + 'px';
  sidePanel.style.width = (savedW || SIDE_DEFAULT_W) + 'px';

  handleH.addEventListener('mousedown', e => {
    e.preventDefault();
    handleH.classList.add('dragging');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const startY = e.clientY;
    const startH = bannerEl.getBoundingClientRect().height;

    const onMove = e => {
      const maxH = window.innerHeight * 0.45;
      const newH = Math.min(maxH, Math.max(OVERVIEW_MIN_H, startH + e.clientY - startY));
      bannerEl.style.height = newH + 'px';
    };
    const onUp = () => {
      handleH.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('truss-overview-h', Math.round(bannerEl.getBoundingClientRect().height));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  handleV.addEventListener('mousedown', e => {
    e.preventDefault();
    handleV.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const startX = e.clientX;
    const startW = sidePanel.getBoundingClientRect().width;

    const onMove = e => {
      const newW = Math.min(SIDE_MAX_W, Math.max(SIDE_MIN_W, startW - (e.clientX - startX)));
      sidePanel.style.width = newW + 'px';
    };
    const onUp = () => {
      handleV.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('truss-side-w', Math.round(sidePanel.getBoundingClientRect().width));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
```

- [ ] **Step 3: Call initResizeHandles at the top of boot()**

Replace:
```js
async function boot() {
  const res = await fetch('./problems.json');
```
With:
```js
async function boot() {
  initResizeHandles();
  const res = await fetch('./problems.json');
```

- [ ] **Step 4: Verify drag handles in browser**

Reload `http://localhost:8080`.

Expected:
- Dragging the horizontal grip bar makes the overview strip taller/shorter
- Dragging the vertical grip bar makes the side panel wider/narrower
- Cursor changes to `row-resize` / `col-resize` during drag and restores on release
- Sizes survive a page reload (verify in DevTools → Application → Local Storage: `truss-overview-h` and `truss-side-w`)

- [ ] **Step 5: Commit**

```bash
git add ui.js
git commit -m "feat: implement resize handle drag with localStorage persistence"
```

---

## Task 4: JS — ResizeObservers for dynamic SVG redraw

**Files:** Modify `ui.js`

- [ ] **Step 1: Update renderOverview() to read container height**

In `renderOverview()`, replace:
```js
  const W = overviewSvg.parentElement.clientWidth || 600;
  const H = 120;
```
With:
```js
  const W = overviewSvg.parentElement.clientWidth  || 600;
  const H = overviewSvg.parentElement.clientHeight || OVERVIEW_DEFAULT_H;
```

(`overviewSvg.parentElement` is `.overview-svg-wrap`, which stretches to the banner height via flexbox.)

- [ ] **Step 2: Add initResizeObservers function**

Add this function immediately after `initResizeHandles()`:

```js
function initResizeObservers() {
  let overviewRaf = null;
  new ResizeObserver(() => {
    if (overviewRaf) return;
    overviewRaf = requestAnimationFrame(() => {
      overviewRaf = null;
      if (problem) renderOverview();
    });
  }).observe(bannerEl);

  let fbdRaf = null;
  new ResizeObserver(() => {
    if (fbdRaf) return;
    fbdRaf = requestAnimationFrame(() => {
      fbdRaf = null;
      if (activeJoint) {
        renderFBD(activeJoint, problem, solvedForces, predictions[activeJoint] || {}, fbdSvg);
      }
    });
  }).observe(fbdSvg);

  const replayFbdSvg = document.getElementById('replay-fbd-svg');
  let replayRaf = null;
  new ResizeObserver(() => {
    if (replayRaf) return;
    replayRaf = requestAnimationFrame(() => {
      replayRaf = null;
      if (!document.getElementById('replay-screen').classList.contains('hidden')) {
        renderReplayStep();
      }
    });
  }).observe(replayFbdSvg);
}
```

- [ ] **Step 3: Call initResizeObservers at the end of boot(), after first render**

Replace:
```js
  selectEl.addEventListener('change', () => loadProblem(problems[+selectEl.value]));
  loadProblem(problems[0]);
}
```
With:
```js
  selectEl.addEventListener('change', () => loadProblem(problems[+selectEl.value]));
  loadProblem(problems[0]);
  initResizeObservers();
}
```

- [ ] **Step 4: Verify dynamic SVG resize**

Reload `http://localhost:8080`. Select any problem.

Expected:
- Drag the horizontal handle → the truss overview SVG redraws to fill the new strip height, joints and members stay proportional
- Select a joint so the FBD is visible → drag the vertical handle → FBD redraws centered in the new panel width
- Drag the horizontal handle while FBD is visible → FBD redraws for the new height
- Complete a problem → open Replay → drag handles (or resize browser window) → replay FBD redraws

- [ ] **Step 5: Commit**

```bash
git add ui.js
git commit -m "feat: redraw SVGs dynamically via ResizeObserver on panel resize"
```
