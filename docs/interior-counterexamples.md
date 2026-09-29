# Small-layout counterexample search

The review page shows eight selected layouts. Enumeration, structural auditing,
and reduction run offline; they never run during page loading. The page imports
only a short seed manifest and builds those eight sketches. No generated renders
or fingerprints are cached. Source sprites retain the existing shared atlas path.

## Generate a round

```sh
npm run interiors:counterexamples -- search
# Reproduce stage 14, excluding that stage from known coverage:
npm run interiors:counterexamples -- search --through-stage 13
```

Version 1 enumerates 1,152 parameter combinations across four motifs: paired T
junctions, loops with offset openings, closely spaced room doors, and doors
between short returns. Parameters vary 7–9-cell room size, spacing, height,
thickness, and handedness. This is a bounded motif search, not exhaustive
enumeration of all floor plans. Every floor uses the same material.

The search removes exact duplicates (including profile ordering and floor
palette differences) and known cases, rejects structural failures, then greedily
selects new local wall/door neighborhoods and nearby event pairs. Selection favors
smaller cases on ties and limits a family to two of an eight-case round. Novelty
is a coverage heuristic, not a prediction of visual failure. Mirrors remain
distinct because projection makes handedness relevant.

Stage 14 examined 1,152 combinations: 240 duplicates, 128 disconnected input
plans, and 784 valid candidates. It selected seeds 65, 677, 267, 987, 832, 112,
254, and 938. No renderer structural fault was found in this search. Rejected
disconnected inputs are not evidence of solver bugs.

To publish a later round, preserve earlier seed manifests and add the selected
seeds as a new review stage. Keep the versioned generator stable; a generator
change that changes fixture identity needs a new version. Selection is an
explicit source change, so a renderer fix or page refresh cannot silently replace
the cases currently being reviewed.

## Audit and reduce a failure

```sh
npm run interiors:counterexamples -- audit --seed 65
npm run interiors:counterexamples -- audit --case probe-v1-65
npm run interiors:counterexamples -- reduce --seed 0 --issue disconnected-floor
npm run interiors:counterexamples -- reduce --feedback probe-v1-65
# Alternatively, provide a zero-based source sketch cell near the visual problem:
npm run interiors:counterexamples -- reduce --case probe-v1-267 --pin 3,3
```

`--feedback CASE_ID` reads the latest local report, including its original sketch,
profiles, and optional pins. Render pins account for viewport padding when mapped
to the sketch. `--fixture FILE` accepts a ReviewCase JSON object. Commands write
JSON to stdout only; use `npx tsx scripts/interior-counterexamples.ts` directly
when redirecting output to avoid npm's script banner.

The structural audit checks projected bounds, authored floor connectivity,
doorway occupancy and tile layers, and duplicate, missing, or covered physical
faces. Optional provenance records actual emitted faces; expected exposure is
reconstructed from solid columns and shell masks. Normal rendering does not
collect this metadata. Connectivity describes the authored floor graph, not
player movement or furniture clearance. These checks cannot judge sprite seams,
tile style, or every projected overlap.

Structural reduction retains the requested issue code while deleting wall
sections/openings and trimming empty interior rows/columns. With a sufficient
budget the result is one-minimal under these supported operations, not globally
smallest. The issue may move as the case shrinks. The current reducer supports
profile walls without arches; unsupported fixtures fail explicitly.

For a visual report, the reducer conservatively preserves the 3×3 source
neighborhood around each pin and requires the proposal to pass structural checks.
Its output always includes `needsVisualConfirmation: true`. A smaller sketch can
lose a global visual failure even when those neighborhoods survive. The agent
must put the returned `fixture` into a subsequent small review round, linked by
`relatedCaseId`, and ask for an ordinary verdict before treating it as reproducing
the same issue. An unpinned visual report remains useful; the agent can choose a
pin from its screenshot or note. Never require the reviewer to perform reduction.

## Review loop

Open `interior-review.html?stage=14&unchecked=1`. Good/Wrong remain one-click,
notes and pins optional, and two Wrong reports pause the round. Fix the first
reported family before asking for more verdicts. Retain the original failing
case while exploring reductions. Once the user approves a render, promote its
matching capture to the regression baseline. Changed pixels reopen the verdict;
structural success never counts as human visual approval.
