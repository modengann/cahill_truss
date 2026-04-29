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

  problem.joints.forEach(joint => {
    const isSolved   = problem.members.filter(m => m.j1 === joint.id || m.j2 === joint.id)
                         .every(m => m.id in solvedForces)
                       && problem.members.some(m => m.j1 === joint.id || m.j2 === joint.id);
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

// ── Ledger ─────────────────────────────────────────────────────
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

function activateJoint(jointId) {
  // placeholder — implemented in Task 7
}

boot();
