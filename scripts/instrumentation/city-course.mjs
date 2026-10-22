// Serialized into the owned authority Worker. One explicit setup pose; all
// sampled movement then uses ordinary vehicle controls, collision and prediction.
export function prepareCityCourse(course) {
  const realm = globalThis.__diagnosticAuthority.activeRealm;
  const session = [...realm.sessions.values()][0];
  const states = [...realm.traffic.states.values()];
  let car, points;
  if (course === "racetrack") {
    car = states.find((c) => c.lane.race && c.lane.id.includes(":ring:0:") && !c.driverId);
    if (!car) throw Error("No native inner-ring racer available");
    const prefix = car.lane.id.split(":quarter:")[0];
    points = [...realm.traffic.network(car).lanes.values()]
      .filter((l) => l.id.startsWith(`${prefix}:quarter:`))
      .sort((a, b) => a.id.localeCompare(b.id))
      .flatMap((l) => l.path.points);
    if (points.length < 80) throw Error("Incomplete native racing circuit");
  } else {
    car = states.find((c) => c.entity.proceduralId?.includes(":vehicle-depot:bridge-car"));
    // Placed vehicles keep their durable identity on the traffic record.
    car ??= states.find((c) => c.identity?.includes(":vehicle-depot:bridge-car"));
    if (!car) throw Error("No generated depot sports car available");
    const original = { ...car.entity.position };
    // Clear north infield lane. Do not move props or introduce a synthetic fleet.
    car.entity.position = { wx: original.wx - 19 * 16, wy: original.wy - 3 * 16 };
    points = [
      { x: car.entity.position.wx, y: car.entity.position.wy },
      { x: car.entity.position.wx + 54 * 16, y: car.entity.position.wy },
    ];
    realm.entityManager.spatialHash.update(car.entity);
  }
  car.speed = 0;
  car.entity.velocity = { vx: 0, vy: 0 };
  session.player.position = { ...car.entity.position };
  session.player.wz = session.player.groundZ = car.entity.wz ?? 0;
  realm.entityManager.spatialHash.update(session.player);
  realm.vehicles.enter(session, car.entity.id);
  return {
    course,
    model: car.entity.type,
    position: { ...car.entity.position },
    lane: car.lane.id,
    key: "ArrowRight",
    points,
  };
}

export function prepareDepotWalk() {
  const realm = globalThis.__diagnosticAuthority.activeRealm;
  const player = [...realm.sessions.values()][0].player;
  // Same clear infield lane as the driving fixture; ordinary walking follows.
  player.position = { wx: (462 - 27) * 16, wy: (455 - 11) * 16 };
  player.wz = player.groundZ = 0;
  realm.entityManager.spatialHash.update(player);
}

/** Aim ahead on the same closed polyline without changing authority state. */
export function courseDirection(points, position, lookahead = 80) {
  let nearest = Infinity,
    segment = 0,
    offset = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    if (!length) continue;
    const t = Math.max(
      0,
      Math.min(1, ((position.wx - a.x) * dx + (position.wy - a.y) * dy) / (length * length)),
    );
    const distance = Math.hypot(position.wx - a.x - t * dx, position.wy - a.y - t * dy);
    if (distance < nearest) {
      nearest = distance;
      segment = i;
      offset = t * length;
    }
  }
  let remaining = offset + lookahead;
  for (let n = 0; n < points.length; n++) {
    const a = points[segment],
      b = points[(segment + 1) % points.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= length) {
      const x = a.x + ((b.x - a.x) * remaining) / length - position.wx;
      const y = a.y + ((b.y - a.y) * remaining) / length - position.wy;
      const norm = Math.hypot(x, y) || 1;
      return { x: x / norm, y: y / norm, distance: nearest };
    }
    remaining -= length;
    segment = (segment + 1) % points.length;
  }
  throw Error("Invalid driving course");
}
