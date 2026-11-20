// Time and easing helpers shared by every moving part of the scene (camera, doors, bonnet, drive, dust).

// The scene draws on demand, so the first frame after a pause gets the whole pause as its delta.
// Clamped so a motion never starts with a jump and a slow frame never skips part of it.
export const frameTime = (delta) => Math.min(Math.max(delta, 0), 1 / 30);

// Critically damped spring: leaves and arrives with no jump in speed and never overshoots. Exact for any step.
export function springTo(state, goal, omega, dt) {
  const offset = state.value - goal;
  const decay = Math.exp(-omega * dt);
  const push = (state.velocity + omega * offset) * dt;

  state.velocity = (state.velocity - omega * push) * decay;
  state.value = goal + (offset + push) * decay;
}

// Lightly damped spring (zeta < 1) for the body on its suspension: a small settle, no bouncing.
export function suspend(state, goal, omega, zeta, dt) {
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = dt / steps;

  for (let index = 0; index < steps; index += 1) {
    state.velocity += (omega * omega * (goal - state.value) - 2 * zeta * omega * state.velocity) * h;
    state.value += state.velocity * h;
  }
}

// A move from the current position, speed and acceleration to `to` in `duration` seconds, arriving at `endVelocity`
// (at rest by default) with no acceleration. Quintic, so position, speed and acceleration stay continuous even when a
// move is replaced half-way. Past the end it carries on at `endVelocity`.
export function planMove(from, velocity, acceleration, to, duration, endVelocity = 0) {
  const T = duration;
  const delta = to - from;
  const v1 = endVelocity;

  return {
    T,
    to,
    v1,
    c: [
      from,
      velocity,
      acceleration / 2,
      (20 * delta - (8 * v1 + 12 * velocity) * T - 3 * acceleration * T * T) / (2 * T ** 3),
      (-30 * delta + (14 * v1 + 16 * velocity) * T + 3 * acceleration * T * T) / (2 * T ** 4),
      (12 * delta - 6 * (v1 + velocity) * T - acceleration * T * T) / (2 * T ** 5),
    ],
  };
}

export function sampleMove(plan, time, out) {
  if (time >= plan.T) {
    out.value = plan.to + (plan.v1 || 0) * (time - plan.T);
    out.velocity = plan.v1 || 0;
    out.acceleration = 0;

    return out;
  }

  const [, c1, c2, c3, c4, c5] = plan.c;
  const t = time;

  out.value = plan.c[0] + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * c5))));
  out.velocity = c1 + t * (2 * c2 + t * (3 * c3 + t * (4 * c4 + t * 5 * c5)));
  out.acceleration = 2 * c2 + t * (6 * c3 + t * (12 * c4 + t * 20 * c5));

  return out;
}
