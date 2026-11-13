// Evaluated by the authoritative simulation, never by a client's render clock.
// A damped-in sideways wander gives the released bubble buoyancy without
// changing its forward speed or snapping at the mouth on release.
export function floatingBubblePosition(bubble, age) {
  const t = Math.max(0, age), origin = bubble.origin || bubble;
  const speed = Math.hypot(bubble.vx, bubble.vz) || 1;
  const phase = ((bubble.id * 2.3999632297) % (Math.PI * 2));
  const envelope = 1 - Math.exp(-t * 3);
  const sideways = envelope * (.28 * Math.sin(t * 3.3 + phase) + .11 * Math.sin(t * 5.7 - phase));
  const lift = envelope * (.14 * Math.sin(t * 2.5 + phase * .6) + .055 * Math.sin(t * 4.1)) + Math.min(t, 4) * .025;
  return {
    x: origin.x + bubble.vx * t + bubble.vz / speed * sideways,
    y: origin.y + lift,
    z: origin.z + bubble.vz * t - bubble.vx / speed * sideways
  };
}

export function bubbleTouchesHead(from, to, head, radius) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const length2 = dx * dx + dy * dy + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, ((head.x - from.x) * dx + (head.y - from.y) * dy + (head.z - from.z) * dz) / length2)) : 0;
  return Math.hypot(from.x + dx * t - head.x, from.y + dy * t - head.y, from.z + dz * t - head.z) <= radius;
}
