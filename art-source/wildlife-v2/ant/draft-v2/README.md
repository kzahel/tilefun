# Red wood-ant worker draft-v2

Fresh Formica rufa worker, standalone species-appropriate Blender source and
authored palette-letter finish. Production-agent draft gate only; coordinator
and human review pending.

The isolated builder retains37 meshes and60 actual poses: bicoloured fixed skull,
compound eyes, paired mandibles, elbowed scape/funiculus antennae, rust mesosoma,
single petiole scale, dark gaster and six separately articulated legs. Each has
a fixed coxa, femur.19, tibia.24 and tarsal segment sqrt(.055^2+.025^2). There
are no mesh scaling, shape keys or head/body morphs during animation. Full
vertices remain in ant.blend; compact guide JSON exports actual projected hulls,
bounds, joints/contacts, antenna landmarks and local mesh/topology hashes.

The accepted orthographic camera remains40 degrees above ground,50 from vertical,
10 world pixels/unit,32px square canvas, ortho3.2, shift9/32, anchor16,25. Current
idle profile height7px, down11/up12. The5px roster value is a proposal; source
projection and readable rounded gaster are retained without image resampling or
squashing all facings. Native scale needs human review beside Explorer.

Eight crawl poses alternate left fore+hind/right middle against the opposite
tripod. Intended continuous duty.625 includes double support; actual sampled
contacts are six at0/1/4/5 and three at2/3/6/7. Actual landings occur0 and4,
confirmed from fresh evaluated segment endpoints. Root/body stay fixed; planted
stroke moves across the projected ground plane for in-place playback. Six action
poses sweep the two rigid antenna segments around a fixed skull. Subpixel
mandible movement is not invented or counted as an action.

The palette-letter heads, mesosoma and gaster are deliberately species-specific
and constant in every pose. One-pixel limb/antenna finishing follows independent
projected chains. Rear master hides front eyes/mandibles. Profile head uses4px
width matching its projected3.25px bounds; gaster uses4 integer rows for3.1px
projected volume, explicitly preserving the upper curve. Near legs use charcoal,
far legs brown, and body surfaces hide rasterized joint overlap. Opposite profiles
mirror baked lighting. These are recorded stylizations, not guide-proven art.

Primary grounding: [wood-ant locomotion study](https://journals.biologists.com/jeb/article/217/13/2358/12278/Level-locomotion-in-wood-ants-evidence-for)
on Formica polyctena supports conserved alternating tripods, overlapping support
and small body motion. This is a related wood ant, not measured rufa gait angles.
[Published rufa worker description routed by AntWiki](https://antwiki.org/wiki/Formica_rufa)
grounds dark cap/gaster, red mesosoma and elbowed antenna morphology; the
Borowiec/Salata2022 description is attributed there. The mclone checklist row
was read without its model. No earlier wildlife or butterfly drawings are used.

Replay from repository root: isolated background Blender build.py, fresh process
opening ant.blend with audit.py, workspace Python author_masters.py and finish.py,
bundled full Chromium capture.mjs, Python verify.py and review_panels.py. Exact
command/exit records and rejected first finish/capture are in ignored worker state.
Registered revision files are immutable; changes require a new identity.

Revision2 corrects explicit button types in the preview only. All PNG/GIF/Blender
bytes are identical to frozen revision1; fresh source/replay/browser checks
validate the routed revision. Original first inspection remains valid for these
identical pixels; revised capture timing is recorded in output-audit.json.

Revision2 fresh source1080 segment/312 contact checks and output60 head/120 body
checks pass;217 Chromium comparisons span8.462/8.404s. Opened revised4x complete
timelines for all facings, unchanged appearance. First finishing replay failed
because copied metadata newline normalization differed from Windows writer;
after normal finishing regeneration, repeated replay passes. All PNG/GIF/.blend
bytes still match revision1 exactly. No assertion or art changed.
