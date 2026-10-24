# Ladybug shared paint

Owner-authorized correction, tactical 187. Exact human review pending.

The complete bank uses `material-surfaces` under `wildlife-paint-v1`.
Editable Blender sources and palette/projection inputs remain at the exact
checksum-pinned paths in inputs.json. They are read-only; this revision
changes finishing only, preserving camera, motion, timing and sockets.

Rebuild before registration with `python scripts/wildlife/finish-bank.py --animals ladybug`.
After registration use the same command with `--check` for read-only byte replay.
