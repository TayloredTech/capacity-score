// Capacity Score V2 — push vs drag, bipolar capture.
// Everything Rachel tunes lives in capacity-config.json; this file should not need edits.
//
// computePushDrag(inputs, source, config) -> PushDragResult
//   inputs: { biology: number[], behaviour: number[], environment: number[], leadership: number[] }
//           one signed answer per statement, each -100..+100.
//           Negative = that area is dragging on the person; positive = driving them; 0 = neutral.
//
// Roll-up per dimension d with statements a1..an (spec: docs/execos/capacity-push-drag-spec.md):
//   PUSH_d = mean of max(ai, 0) across ALL n statements  -> 0..100
//   DRAG_d = mean of max(-ai, 0) across ALL n statements -> 0..100
//   NET_d  = PUSH_d - DRAG_d                              -> -100..+100
// Averaging over all statements keeps PUSH and DRAG comparable and guarantees
// PUSH_d + DRAG_d <= 100, so the two sides of the bullet bar can never overlap.
//
// Legacy mapping (so old links, bands, the wheel, and stored trends stay comparable):
//   legacy 0..100 score = (NET + 100) / 2, per dimension and overall.
//
// PushDragResult: {
//   push, drag, net           per-factor maps (push/drag 0..100, net -100..100, whole numbers)
//   overallPush, overallDrag, overallNet
//   subscores                 per-factor legacy 0..100 (feeds the wheel arcs)
//   capacityScore             overall legacy 0..100 (feeds spin speed, bands)
//   band, coherence 0..1, pushLever, confidence, complete, version
// }

const FACTORS = ["biology", "behaviour", "environment", "leadership"];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sum = (a) => a.reduce((t, v) => t + v, 0);

function stdev(values) {
  const mean = sum(values) / values.length;
  return Math.sqrt(sum(values.map((v) => (v - mean) ** 2)) / values.length);
}

function bandFor(score, bands) {
  // bands: [{name, min}] — highest min that score reaches wins
  return bands.reduce((hit, b) => (score >= b.min ? b : hit), bands[0]).name;
}

const legacyFromNet = (net) => clamp(Math.round((net + 100) / 2), 0, 100);

export function computePushDrag(inputs, source, config) {
  const s = config.scoring;

  const push = {}, drag = {}, net = {}, subscores = {};
  let complete = true;

  for (const f of FACTORS) {
    const n = config.instrument.parts.find((p) => p.factor === f).statements.length;
    const raw = inputs[f] || [];
    const answered = raw.filter((v) => Number.isFinite(v));
    if (answered.length < n) complete = false;
    // Unanswered statements count as 0 (neutral) so a partial read degrades gently.
    const pos = raw.map((v) => (Number.isFinite(v) ? Math.max(v, 0) : 0));
    const neg = raw.map((v) => (Number.isFinite(v) ? Math.max(-v, 0) : 0));
    push[f] = Math.round(sum(pos) / n);
    drag[f] = Math.round(sum(neg) / n);
    net[f] = push[f] - drag[f]; // net from the rounded figures so displayed maths always adds up
    subscores[f] = legacyFromNet(net[f]);
  }

  const overallPush = Math.round(sum(FACTORS.map((f) => push[f])) / FACTORS.length);
  const overallDrag = Math.round(sum(FACTORS.map((f) => drag[f])) / FACTORS.length);
  const overallNet = Math.round(sum(FACTORS.map((f) => net[f])) / FACTORS.length);
  const capacityScore = legacyFromNet(overallNet);

  const coherence = clamp(1 - stdev(FACTORS.map((f) => subscores[f])) / s.coherenceDivisor, 0, 1);

  // Rachel's push-first logic: of the two reachable levers, the draggier one is where to push.
  const [a, b] = s.pushLever.compare;
  const pushLever = drag[a] === drag[b] ? s.pushLever.tieBreak : drag[a] > drag[b] ? a : b;

  const confidence = !complete ? "low" : source === "assessment" ? "medium" : "high";

  return {
    push,
    drag,
    net,
    overallPush,
    overallDrag,
    overallNet,
    subscores,
    capacityScore,
    coherence,
    band: bandFor(capacityScore, s.bands),
    confidence,
    version: config.version,
    pushLever,
    complete,
  };
}
