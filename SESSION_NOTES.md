# Method of Joints Trainer — Session Notes

## Project
Static web app teaching structural engineering students to predict tension/compression in truss members using the Method of Joints. No framework, no build step. Opens via file:// or static HTTP server.

## Current State
Task 2 complete. getMemberAngle and getSolvableJoints implemented and committed.

## Done This Session
- Created `index.html` — full HTML shell with all required sections (header, truss banner, workspace, ledger, summary dialog, replay overlay)
- Created `style.css` — full stylesheet with CSS custom properties, responsive layout, print styles
- Created `truss.js` — stub exports: getMemberAngle, getSolvableJoints, solveJoint, getEquationStrings
- Created `fbd.js` — stub export: renderFBD
- Created `ui.js` — imports from truss.js and fbd.js, no logic yet
- Created `problems.json` — King-Post Truss problem with 4 joints, 5 members, 1 load, 2 reactions, solution order
- Committed all 6 files (commit 6885193)
- Implemented getMemberAngle and getSolvableJoints in truss.js; created test.html (commit 848e6eb)

## What Still Needs Doing (in order)
1. ~~Task 2: Implement truss.js math (getMemberAngle, getSolvableJoints, solveJoint, getEquationStrings)~~ DONE (partial: getMemberAngle + getSolvableJoints)
2. Task 3: Implement fbd.js SVG renderer
3. Task 4: Implement ui.js — problem loading, joint selection, prediction UI, solve/verify, ledger, summary, replay
4. Task 5: Add more problems to problems.json
5. Task 6: Testing and polish

## Key Technical Decisions
- `<script type="module">` is used — Chrome requires HTTP server for file:// protocol (CORS policy on ES modules). Firefox works with file:// in some versions. Users should run a local server (e.g., `python -m http.server`) for development.
- Architecture: truss.js = pure math (no DOM), fbd.js = SVG rendering only, ui.js = all DOM/state
- problems.json coordinates are unitless; joints use logical grid units (x=0..8, y=0..3 for king-post)
- Sign convention: positive = tension (member pulls joint outward), negative = compression

## Gotchas
- style.css uses Unicode box-drawing chars in comments (─, ──) — open with UTF-8 encoding
- LF->CRLF line ending warnings on commit are benign (Windows git config)
