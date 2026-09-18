// Self-check for the Capacity Score scoring module. Run: node selfcheck.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { computeCapacity } from "./capacity.js";

const config = JSON.parse(readFileSync(new URL("./capacity-config.json", import.meta.url), "utf8"));

// Build inputs from per-factor part-drag totals (each part = 4 answers on 1..4).
function inputsFor(bio, beh, env, lea) {
  const spread = (total) => {
    const a = [1, 1, 1, 1];
    let rest = total - 4;
    for (let i = 0; i < 4 && rest > 0; i++) {
      const add = Math.min(3, rest);
      a[i] += add;
      rest -= add;
    }
    return a;
  };
  return { biology: spread(bio), behaviour: spread(beh), environment: spread(env), leadership: spread(lea) };
}

const score = (b, h, e, l, source = "assessment") => computeCapacity(inputsFor(b, h, e, l), source, config);

// Inversion endpoints: 16 drag -> 100 capacity, 64 drag -> 0 capacity.
let r = score(4, 4, 4, 4);
assert.equal(r.capacityScore, 100);
assert.equal(r.band, "Peak");
assert.deepEqual(r.subscores, { biology: 100, behaviour: 100, environment: 100, leadership: 100 });

r = score(16, 16, 16, 16);
assert.equal(r.capacityScore, 0);
assert.equal(r.band, "Restore");
assert.deepEqual(r.subscores, { biology: 0, behaviour: 0, environment: 0, leadership: 0 });

// Rachel's drag-band boundaries mapped to capacity bands.
assert.equal(score(4, 8, 8, 11).totalDrag, 31);
assert.equal(score(4, 8, 8, 11).dragBand, "Turning with you");
assert.equal(score(4, 8, 8, 11).band, "Steady"); // 31 drag -> 69 capacity, Steady floor

assert.equal(score(4, 8, 8, 12).totalDrag, 32);
assert.equal(score(4, 8, 8, 12).dragBand, "Starting to slip");
assert.equal(score(4, 8, 8, 12).band, "Conserve"); // 32 drag -> 67 capacity

assert.equal(score(16, 12, 12, 7).totalDrag, 47);
assert.equal(score(16, 12, 12, 7).band, "Conserve"); // 47 drag -> 35 capacity

assert.equal(score(16, 12, 12, 8).totalDrag, 48);
assert.equal(score(16, 12, 12, 8).dragBand, "Turning against you");
assert.equal(score(16, 12, 12, 8).band, "Restore"); // 48 drag -> 33 capacity

// Peak vs Steady split (config cutoff 85): 23 drag -> 85 Peak, 24 drag -> 83 Steady.
assert.equal(score(4, 4, 4, 11).capacityScore, 85);
assert.equal(score(4, 4, 4, 11).band, "Peak");
assert.equal(score(4, 4, 4, 12).capacityScore, 83);
assert.equal(score(4, 4, 4, 12).band, "Steady");

// Coherence: balanced -> 1, maximally split -> 0. Flag off: coherence never moves the headline score.
assert.equal(score(8, 8, 8, 8).coherence, 1);
const split = score(4, 4, 16, 16); // subscores 100,100,0,0 -> stdev 50
assert.equal(split.coherence, 0);
const balanced = score(10, 10, 10, 10); // same 40 total drag
assert.equal(split.totalDrag, balanced.totalDrag);
assert.equal(split.capacityScore, balanced.capacityScore); // coherenceAffectsScore=false

// Flag on: spin adjustment applies exactly as configured.
const cfgOn = structuredClone(config);
cfgOn.scoring.coherenceAffectsScore = true;
const adj = computeCapacity(inputsFor(4, 4, 16, 16), "assessment", cfgOn);
const raw = split.capacityScore;
assert.equal(adj.capacityScore, Math.round(raw * (config.scoring.coherenceBase + config.scoring.coherenceCoefficient * 0)));

// Push lever: draggier of behaviour/environment wins; tie goes to configured tieBreak.
assert.equal(score(8, 14, 6, 8).pushLever, "behaviour");
assert.equal(score(8, 6, 14, 8).pushLever, "environment");
assert.equal(score(8, 10, 10, 8).pushLever, config.scoring.pushLever.tieBreak);

// Confidence: assessment complete = medium, incomplete = low, wearable = high.
assert.equal(score(8, 8, 8, 8).confidence, "medium");
assert.equal(score(8, 8, 8, 8, "wearable").confidence, "high");
const partial = computeCapacity({ biology: [2, 2], behaviour: [2, 2, 2, 2], environment: [2, 2, 2, 2], leadership: [2, 2, 2, 2] }, "assessment", config);
assert.equal(partial.confidence, "low");
assert.equal(partial.complete, false);

// --- THE ARROW AND THE WORDS MUST AGREE --------------------------------------
// ⛔ This exact bug shipped TWICE. 7 Aug: the masthead read `score > 50` while
// the body read the band, so Rachel's email said "building" at the top and
// "draining" underneath. 18 Sept: the wheel arrow read `score >= 50` while the
// paragraph read the band, so a Steady result drew a clockwise sweep over the
// words "it is edging backwards". Her verdict: "blatantly untrue".
// Both times two rules described one thing. This pins them together in source.
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");

// the arrow spins forwards for exactly Peak and Steady, and reads the BAND
assert.match(page, /const building = r\.band === "Peak" \|\| r\.band === "Steady";/,
  "the wheel arrow must derive from the band, never from a bare score threshold");
assert.match(page, /const marginal = r\.band === "Steady";/,
  "Steady must draw the short arc (Rachel, 18 Sept: 'only marginal')");
assert.doesNotMatch(page, /const spin = r\.capacityScore/,
  "the score threshold arrow is the 18 Sept regression, do not reintroduce it");

// and the email's direction word agrees with it, band for band
const pullBlock = page.slice(page.indexOf("var PULL = {"), page.indexOf("var pull = PULL["));
for (const [band, dir] of [["Restore","left"],["Conserve","left"],["Steady","right"],["Peak","right"]]) {
  const row = pullBlock.match(new RegExp(`${band}:\\s*\\[([^\\]]*)\\]`, "s"));
  assert.ok(row, `PULL is missing ${band}`);
  assert.match(row[1], new RegExp(`"${dir}"`),
    `the ${band} email says the wheel turns a different way to the ${band} arrow`);
}

// a subscore of exactly 50 still draws something (it read as a broken row)
assert.match(page, /Math\.max\(1\.5, Math\.min\(50, Math\.abs\(signed\) \* 50\)\)/,
  "level subscores need a visible floor, not a bare centre line");

console.log("self-check green: all assertions passed (config " + config.version + ")");
