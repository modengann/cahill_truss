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
const bannerEl    = document.getElementById('truss-banner');
const sidePanel   = document.querySelector('.side-panel');

const OVERVIEW_DEFAULT_H = 160;
const OVERVIEW_MIN_H     = 80;
const SIDE_DEFAULT_W     = 280;
const SIDE_MIN_W         = 200;
const SIDE_MAX_W         = 480;

// ── Resize handles ─────────────────────────────────────────────
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

// ── Resize observers ───────────────────────────────────────────
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

// ── Boot ───────────────────────────────────────────────────────
async function boot() {
  initResizeHandles();
  const res = await fetch('./problems.json');
  const problems = await res.json();

  problems.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = p.name;
    selectEl.appendChild(opt);
  });

  selectEl.addEventListener('change', () => loadProblem(problems[+selectEl.value]));
  loadProblem(problems[0]);
  initResizeObservers();
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

  const W = overviewSvg.parentElement.clientWidth  || 600;
  const H = overviewSvg.parentElement.clientHeight || OVERVIEW_DEFAULT_H;
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
  activeJoint   = jointId;
  selectedMember = null;
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';
  btnHint.disabled  = false;
  btnReset.disabled = false;
  btnSolve.disabled = true;

  if (!predictions[jointId]) predictions[jointId] = {};

  panelTitle.textContent = `Free Body Diagram — Joint ${jointId}`;

  renderFBD(jointId, problem, solvedForces, predictions[jointId], fbdSvg);
  renderEquations(jointId);
  renderSidePanel(jointId);
  renderOverview();
}

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
  btnSolve.disabled = !unknownMembers.every(m => preds[m.id]);
}

function renderEquations(jointId) {
  const eqs = getEquationStrings(jointId, problem, solvedForces);
  eqDisplay.textContent = `${eqs.fx}\n${eqs.fy}`;
}

btnReset.addEventListener('click', () => {
  if (!activeJoint) return;
  predictions[activeJoint] = {};
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';
  renderFBD(activeJoint, problem, solvedForces, {}, fbdSvg);
  renderSidePanel(activeJoint);
});

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
  feedbackEl.className = 'feedback wrong';
}

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
    const correct = isZero || (!isZero && pred === 'T' && f > 0) || (!isZero && pred === 'C' && f < 0);

    const row = [...rows].find(r => r.dataset.memberId === m.id);
    if (correct) {
      row.classList.add('correct');
    } else {
      row.classList.add('wrong');
      allCorrect = false;
    }

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
    Object.assign(solvedForces, solved);
    solutionLog.push({ jointId: activeJoint, forces: { ...solved } });

    renderFBD(activeJoint, problem, solvedForces, {}, fbdSvg);
    renderLedger();
    renderOverview();
    renderEquations(activeJoint);

    feedbackEl.className = 'feedback correct';
    feedbackEl.textContent = `Joint ${activeJoint} solved. Values added to ledger.`;

    if (problem.members.every(m => m.id in solvedForces)) {
      setTimeout(showSummary, 600);
    } else {
      const nextBtn = document.createElement('button');
      nextBtn.textContent = 'Next Joint →';
      nextBtn.style.cssText = 'margin-top:8px;background:#28a745;color:white;border:none;border-radius:4px;padding:8px 16px;cursor:pointer;width:100%;';
      nextBtn.addEventListener('click', () => {
        activeJoint = null;
        panelTitle.textContent = 'Select a joint to begin';
        feedbackEl.textContent = '';
        feedbackEl.className = 'feedback';
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

// ── Summary ────────────────────────────────────────────────────
function showSummary() {
  const screen = document.getElementById('summary-screen');
  screen.classList.remove('hidden');

  renderOverview();
  const sumSvg = document.getElementById('summary-svg');
  sumSvg.innerHTML = overviewSvg.innerHTML;
  sumSvg.setAttribute('viewBox', overviewSvg.getAttribute('viewBox'));

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
    loadProblem(problem);
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
  const { jointId } = solutionLog[replayIndex];

  document.getElementById('replay-step-label').textContent =
    `Step ${replayIndex + 1} of ${solutionLog.length}: Joint ${jointId}`;

  const partial = {};
  for (let i = 0; i <= replayIndex; i++) Object.assign(partial, solutionLog[i].forces);

  const replaySvg = document.getElementById('replay-fbd-svg');
  renderFBD(jointId, problem, partial, {}, replaySvg);

  const prevPartial = {};
  for (let i = 0; i < replayIndex; i++) Object.assign(prevPartial, solutionLog[i].forces);
  const eqs = getEquationStrings(jointId, problem, prevPartial);
  document.getElementById('replay-equations').textContent = `${eqs.fx}\n${eqs.fy}`;

  document.getElementById('btn-replay-prev').disabled = replayIndex === 0;
  document.getElementById('btn-replay-next').disabled = replayIndex === solutionLog.length - 1;
}

boot();
