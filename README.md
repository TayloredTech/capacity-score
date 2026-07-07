# Capacity Score V1 — Which Way Is Your Wheel Turning?

The free Taylored capacity assessment: Rachel's 16-statement Wheel Diagnostic, scored live, with the animated Capacity Wheel as the result. Static site, no build step.

**Everything tunable lives in one file: `capacity-config.json`.** Edit it, save, refresh. No code changes, ever. The scoring engine (`capacity.js`) and the page (`index.html`) just read the config.

## Run it locally

```
cd projects/capacity-score
python -m http.server 8080
```

Then open http://localhost:8080. Preview a result without answering: http://localhost:8080/?demo=conserve (also `peak`, `steady`, `restore` — demo mode stores nothing).

## Check the scoring after any config change

```
node selfcheck.mjs
```

Green means the drag inversion (16 drag = 100 capacity, 64 drag = 0), band boundaries, coherence math, push-lever logic, and confidence rules all still hold. If you change band cutoffs the self-check expectations may need updating too — ask Hex.

## Rachel's knobs (all in `capacity-config.json`)

### The instrument — `instrument`
- `parts[].statements` — the 16 statements, 4 per wheel point. Edit wording freely.
- `parts[].title` / `lead` — the part headings and framing lines.
- `scale.labels` — Rarely / Sometimes / Often / Almost always.
- `title`, `kicker`, `intro`, `howItWorks` — the landing page copy.

### The scoring — `scoring`
- `bands` — capacity-score cutoffs for Peak / Steady / Conserve / Restore. Each entry is the minimum score for that band. Current: Restore 0, Conserve 34, Steady 69, Peak 85.
- `dragBands` — your original drag bands (16–31 / 32–47 / 48–64), used for the "turning with you / slipping / against you" read.
- `capacityDivisor` (48) and `factorDivisor` (12) — the drag-to-capacity inversion. Leave these unless the statement count changes.
- `coherenceAffectsScore` — **false** by default: the spin (coherence) is visual only and the headline score is exactly your instrument. Flip to `true` to let imbalance adjust the score by up to ±15% (`coherenceBase` 0.85 + `coherenceCoefficient` 0.15).
- `coherenceDivisor` (50) — how harshly imbalance across the four points is judged.
- `pushLever.tieBreak` — which lever wins when Behaviour and Environment drag equally.

### The words on the result page — `copy`
- `bandReads` — the paragraph shown for each band.
- `leverIntro` + `leverPrompts` — the "where to push first" section (keystone / pocket).
- `bridge` — the "what this cannot tell you" close, the tagline, the CTA button label and URL.
- `emailCapture` — the email step copy, and `emailRequired` (true/false).

### The wheel's look and motion — `wheel`
- `factorColors`, `factorLabels`, `factorAngles` — colour, name, and position of each point (0 = top, 90 = right, 180 = bottom, 270 = left). Current order: Biology top, Leadership right, Behaviour bottom, Environment left.
- `axisLabels` — the BEING / DOING axis words.
- `spinSpeedMap` — how score maps to spin speed and direction, in degrees per second. Negative = anticlockwise (the wheel turning against you). Add or move points freely, the wheel interpolates between them.
- `wobble` — `maxAngleDegrees`, `maxEccentricityPx`, `frequencyHz`, `sensitivity`. Imbalance across the four points makes the wheel wobble and run off-centre. A perfectly balanced wheel spins true.
- `spinUp` — the reveal animation: `durationMs`, `easing`, `arcStaggerMs`, `countUp`.
- `arcRadius`, `arcWidth`, `sectorSpanDegrees` — arc geometry.

### Where responses go — `storage`
Every completed assessment (answers, scores, email) is inserted into the `capacity_responses` table in Supabase, plus a local-browser backup. The key in the config is the publishable (public) key: it can only insert, never read. This table is the validation dataset for tuning the weights later.

## Deploy

Static files, any host. Currently deployed via GitHub Pages; pushing to `main` redeploys automatically.
