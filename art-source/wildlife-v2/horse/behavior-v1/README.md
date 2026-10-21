# horse · behavior-v1

Owner-authorized existing-species action bank for [168](../../../../docs/tactical/168-grazing-browsing-and-building.md).
Exact new art is pending human review. All prior native travel cells are byte-identical.

Lower a connected rigid neck/head to graze and drink, then raise; planted corrected legs and a fixed-length tail flick remain anatomical.

`inputs.json` retains exact editable source, native sheet/metadata, original palette
masters and paint helper fingerprints. `projection.json` records evaluated source
poses. Reopened source audits enforce immutable mesh volumes, fixed-length links,
planted soles and connected neck attachments. The finishing helper reprojects
source-owned palette paint; it does not stretch anatomy or change camera scale.

Author only an unregistered revision with `blender -b --factory-startup -t 2
--python-exit-code 1 --python scripts/wildlife/range-build.py -- horse`, then
`python -X utf8 scripts/wildlife/range-finish.py horse`.
`python -X utf8 scripts/wildlife/range-replay.py horse --check` replays minimal
retained inputs into an isolated ignored directory. Registered banks are immutable.
