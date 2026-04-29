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
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  const W = svgEl.clientWidth  || +svgEl.getAttribute('width')  || 300;
  const H = svgEl.clientHeight || +svgEl.getAttribute('height') || 280;
  const cx = W / 2;
  const cy = H / 2;

  const magnitudes = [];
  Object.values(solvedForces).forEach(f => magnitudes.push(Math.abs(f)));
  const maxMag = magnitudes.length ? Math.max(...magnitudes) : 0;
  const scale = f => maxMag > 0
    ? Math.max(MIN_ARROW_LEN, ARROW_BASE_LEN * Math.abs(f) / maxMag)
    : ARROW_BASE_LEN;

  (problem.reactions || []).forEach(r => {
    if (r.joint !== jointId) return;
    if (r.fx !== 0) {
      const angle = r.fx > 0 ? 0 : Math.PI;
      const markerId = `arr-reaction-x-${jointId}`;
      svgEl.appendChild(makeArrowhead(markerId, COLORS.reaction));
      drawArrow(svgEl, cx, cy, angle, ARROW_BASE_LEN, COLORS.reaction, markerId, false,
        `A_x = ${r.fx > 0 ? '+' : ''}${r.fx} kN`, `Reaction: ${r.fx} kN horizontal`);
    }
    if (r.fy !== 0) {
      const angle = r.fy > 0 ? -Math.PI / 2 : Math.PI / 2;
      const markerId = `arr-reaction-y-${jointId}`;
      svgEl.appendChild(makeArrowhead(markerId, COLORS.reaction));
      drawArrow(svgEl, cx, cy, angle, ARROW_BASE_LEN, COLORS.reaction, markerId, false,
        `A_y = ${r.fy > 0 ? '+' : ''}${r.fy} kN`, `Reaction: ${r.fy} kN vertical`);
    }
  });

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

  const connectedMembers = problem.members.filter(
    m => m.j1 === jointId || m.j2 === jointId
  );

  connectedMembers.forEach(m => {
    const otherId = m.j1 === jointId ? m.j2 : m.j1;
    const from = problem.joints.find(j => j.id === jointId);
    const to   = problem.joints.find(j => j.id === otherId);
    const outwardAngle = Math.atan2(-(to.y - from.y), to.x - from.x);

    const markerId = `arr-${m.id}-${jointId}`;

    if (m.id in solvedForces) {
      const f = solvedForces[m.id];
      const isZero = Math.abs(f) < 0.001;
      const color  = isZero ? COLORS.zero : f > 0 ? COLORS.tension : COLORS.compression;
      const drawAngle = (!isZero && f < 0) ? outwardAngle + Math.PI : outwardAngle;
      const len = isZero ? MIN_ARROW_LEN : scale(f);
      const label = isZero
        ? `${m.id} 0`
        : `${m.id} ${f > 0 ? '+' : ''}${Math.round(f * 10) / 10}`;
      svgEl.appendChild(makeArrowhead(markerId, color));
      drawArrow(svgEl, cx, cy, drawAngle, len, color, markerId, false, label,
        `Member ${m.id}: ${isZero ? 'zero force' : f > 0 ? 'tension' : 'compression'} ${f} kN`);

    } else if (predictions[m.id]) {
      const pred = predictions[m.id];
      const color = pred === 'T' ? COLORS.tension : COLORS.compression;
      const drawAngle = pred === 'C' ? outwardAngle + Math.PI : outwardAngle;
      svgEl.appendChild(makeArrowhead(markerId, color));
      drawArrow(svgEl, cx, cy, drawAngle, ARROW_BASE_LEN, color, markerId, false,
        `${m.id} ${pred}`, `Member ${m.id}: predicted ${pred === 'T' ? 'tension' : 'compression'}`);

    } else {
      svgEl.appendChild(makeArrowhead(markerId, COLORS.unknown));
      drawArrow(svgEl, cx, cy, outwardAngle, ARROW_BASE_LEN, COLORS.unknown, markerId, true,
        `${m.id} ?`, `Member ${m.id}: unknown`);
    }
  });

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
