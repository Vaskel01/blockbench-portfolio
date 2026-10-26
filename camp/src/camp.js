// Shared, mutable camp state. The DOM controls write to it; the R3F components read it every frame.
export const camp = {
  moving: true,
  clock: 0, // real seconds since start
  ambient: 0, // seconds of ambient animation (stops while paused)
  waveAt: -100,
  fireAt: -100,
  chestOpen: false,
  lidMoving: false,
  turn: 0,
  turnTarget: 0,
  orbit: { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 },
  dragging: null,
  // Pickable roots, keyed by the action they trigger, plus the head for labels.
  refs: { wave: null, fire: null, chest: null, head: null },
};

export const WAVE_TIME = 2.6;

export function waveEnvelope() {
  const age = camp.clock - camp.waveAt;
  if (age >= WAVE_TIME) return 0;
  return Math.sin((Math.min(1, age / 0.35) * Math.PI) / 2) * Math.min(1, (WAVE_TIME - age) / 0.45);
}

export function fireBoost() {
  const age = camp.clock - camp.fireAt;
  return age < 2 ? Math.exp(-age * 1.7) : 0;
}
