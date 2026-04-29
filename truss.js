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

export function solveJoint(jointId, problem, solvedForces) {}
export function getEquationStrings(jointId, problem, solvedForces) {}
