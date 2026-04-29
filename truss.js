export function getMemberAngle(memberId, jointId, problem) {
  const member = problem.members.find(m => m.id === memberId);
  if (!member) throw new Error(`getMemberAngle: member '${memberId}' not found`);
  const otherId = member.j1 === jointId ? member.j2 : member.j1;
  const from = problem.joints.find(j => j.id === jointId);
  if (!from) throw new Error(`getMemberAngle: joint '${jointId}' not found`);
  const to   = problem.joints.find(j => j.id === otherId);
  if (!to)   throw new Error(`getMemberAngle: joint '${otherId}' not found`);
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

export function solveJoint(jointId, problem, solvedForces) {
  let rhsX = 0, rhsY = 0;

  (problem.reactions || []).forEach(r => {
    if (r.joint === jointId) { rhsX -= r.fx; rhsY -= r.fy; }
  });

  (problem.loads || []).forEach(l => {
    if (l.joint === jointId) { rhsX -= l.fx; rhsY -= l.fy; }
  });

  const connectedMembers = problem.members.filter(
    m => m.j1 === jointId || m.j2 === jointId
  );

  const unknowns = [];
  connectedMembers.forEach(m => {
    const angle = getMemberAngle(m.id, jointId, problem);
    if (m.id in solvedForces) {
      rhsX -= solvedForces[m.id] * Math.cos(angle);
      rhsY -= solvedForces[m.id] * Math.sin(angle);
    } else {
      unknowns.push({ id: m.id, cos: Math.cos(angle), sin: Math.sin(angle) });
    }
  });

  if (unknowns.length === 0) return {};

  if (unknowns.length === 1) {
    const u = unknowns[0];
    const force = Math.abs(u.cos) >= Math.abs(u.sin)
      ? rhsX / u.cos
      : rhsY / u.sin;
    return { [u.id]: force };
  }

  if (unknowns.length === 2) {
    const [u1, u2] = unknowns;
    const det = u1.cos * u2.sin - u2.cos * u1.sin;
    if (Math.abs(det) < 1e-9)
      throw new Error(`Joint ${jointId}: members are parallel — system is singular`);
    return {
      [u1.id]: (rhsX * u2.sin - rhsY * u2.cos) / det,
      [u2.id]: (u1.cos * rhsY - u1.sin * rhsX) / det,
    };
  }

  throw new Error(`Joint ${jointId} has ${unknowns.length} unknowns — not solvable`);
}

export function getEquationStrings(jointId, problem, solvedForces) {
  const fmt = n => {
    const rounded = Math.round(n * 1000) / 1000;
    return rounded >= 0 ? `+${rounded}` : `${rounded}`;
  };
  const fmtAngle = (cos, sin) => {
    const r = n => Math.round(n * 10000) / 10000;
    return { cos: r(cos), sin: r(sin) };
  };

  const connectedMembers = problem.members.filter(
    m => m.j1 === jointId || m.j2 === jointId
  );

  let termsX = [], termsY = [];

  (problem.reactions || []).forEach(r => {
    if (r.joint !== jointId) return;
    if (r.fx !== 0) termsX.push(fmt(r.fx));
    if (r.fy !== 0) termsY.push(fmt(r.fy));
  });

  (problem.loads || []).forEach(l => {
    if (l.joint !== jointId) return;
    if (l.fx !== 0) termsX.push(fmt(l.fx));
    if (l.fy !== 0) termsY.push(fmt(l.fy));
  });

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
