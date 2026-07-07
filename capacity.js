// Capacity Score V1 — frozen interface, tunable formula.
// Everything Rachel tunes lives in capacity-config.json; this file should not need edits.
//
// computeCapacity(inputs, source, config) -> CapacityResult
//   inputs: { biology: number[], behaviour: number[], environment: number[], leadership: number[] }
//           raw drag answers on the instrument scale (1..4), one per statement. Higher = more drag.
//   source: "wearable" | "assessment" | "mixed"
//
// CapacityResult: {
//   capacityScore 0..100, subscores {biology,behaviour,environment,leadership} each 0..100,
//   coherence 0..1, band, confidence, version,
//   totalDrag, partDrag, dragBand, pushLever, complete
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

export function computeCapacity(inputs, source, config) {
  const s = config.scoring;
  const scale = config.instrument.scale;
  const perFactor = config.instrument.parts.find((p) => p.factor === "biology").statements.length;

  const partDrag = {};
  const subscores = {};
  let complete = true;
  for (const f of FACTORS) {
    const answers = (inputs[f] || []).filter((v) => Number.isFinite(v));
    if (answers.length < perFactor) complete = false;
    const drag = sum(answers);
    partDrag[f] = drag;
    const floor = perFactor * scale.min; // 4 -> best possible part drag
    subscores[f] = clamp(Math.round((100 * (floor + s.factorDivisor - drag)) / s.factorDivisor), 0, 100);
  }

  const totalDrag = sum(FACTORS.map((f) => partDrag[f]));
  const dragFloor = FACTORS.length * perFactor * scale.min; // 16
  let capacityScore = clamp(Math.round((100 * (dragFloor + s.capacityDivisor - totalDrag)) / s.capacityDivisor), 0, 100);

  const coherence = clamp(1 - stdev(FACTORS.map((f) => subscores[f])) / s.coherenceDivisor, 0, 1);
  if (s.coherenceAffectsScore) {
    capacityScore = clamp(Math.round(capacityScore * (s.coherenceBase + s.coherenceCoefficient * coherence)), 0, 100);
  }

  // Rachel's push-first logic: of the two reachable levers, the draggier one is where to push.
  const [a, b] = s.pushLever.compare;
  const pushLever = partDrag[a] === partDrag[b] ? s.pushLever.tieBreak : partDrag[a] > partDrag[b] ? a : b;

  const confidence = !complete ? "low" : source === "assessment" ? "medium" : "high";

  return {
    capacityScore,
    subscores,
    coherence,
    band: bandFor(capacityScore, s.bands),
    confidence,
    version: config.version,
    totalDrag,
    partDrag,
    dragBand: bandFor(totalDrag, s.dragBands),
    pushLever,
    complete,
  };
}
