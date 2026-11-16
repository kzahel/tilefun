# Terrain holes after changing zoom

Fixed 2026-11-16. [Multiplayer networking](../topics/multiplayer-networking.md)
owns the replication contract; [renderer unification](../topics/renderer-unification.md)
owns the visible symptom. Follow-up to the [driving fog investigation](first-person-driving-fog.md).

## Reproduction and cause

The real single-player Worker reproduces nine persistent missing chunks when
cycling directly between **0.1× and 0.25×**. At regional seed 2026, arrival tile
`(300,519)`, the missing strip is `cx=24, cy=28..36`. Ground images finish
preparing, but the client has no terrain data for that strip. Waiting ten
seconds after zooming out does not fill it. An earlier 1× ↔ 0.1× control did
not reproduce it: the intermediate view range matters.

The diagnostic wraps the public `RemoteStateView.applyMessage` in an isolated
browser and records chunk lists, snapshot revisions and client presence after
each production chunk sync. For example, chunk `24,30` has this history:

| Message | Server lists chunk | Terrain snapshot |
| --- | --- | --- |
| 15 | Yes | Revision 0 |
| 40 | Yes | Revision 1 |
| 107 | No | None; client deletes terrain |
| 114 | Yes | None; client remains empty |

This is a stale replication baseline, rather than an unfinished renderer job.
Observer residency keeps one chunk beyond the view; terrain replication covers
two. Narrowing the view can therefore evict a chunk while its coordinates stay
inside replication interest. `interestChunks` previously retained its remembered
revision until it left interest. When the authority loaded it again, the old
revision suppressed its terrain snapshot, even though the client had already
been told to delete it. Reloaded chunks can also restart at a lower revision.

## Fix and evidence

`interestChunks` now prunes revisions against the actual delivered loaded-key
set. A removed chunk loses its send baseline; reentry sends full terrain data.
Unchanged resident chunks still avoid redundant snapshots. The fix is in the
shared server used by single-player, P2P, dedicated hosting and Worker labs.
Fog remains at the owner's selected fixed distance.

The same six-stage zoom sequence was run before and after, using bundled
Chromium headless, 1280 × 800, isolated browser storage and Vite, Node 24.22.1
on macOS. [Sanitized evidence](../benchmarks/terrain-holes-on-zoom.json) records
the ranges, missing coordinates and representative protocol history.

| Result | Before | After |
| --- | --- | --- |
| Reentries listed without client terrain | 18 (nine chunks, twice) | 0 |
| Missing terrain at the final 0.1× checkpoint | 9 chunks | 0 |
| Loaded chunks missing ground images at checkpoints | 0 | 0 |
| Pending terrain jobs at checkpoints | 0 | 0 |
| Page errors | 0 | 0 |

`node scripts/first-person/zoom-holes.mjs` repeats the trace and writes reports
and screenshots in the printed temporary directory. `--flat` changes the
generation; `--headed` shows the bundled browser. The script observes protocol
application; it neither supplies missing chunks nor changes residency policy.
Fixed waits are reproduction checkpoints, not performance claims or a guarantee
that every larger overview has finished streaming on every device.

The native `RealmReplicator.test.ts` regression drives production replication
and `RemoteStateView` through load → eviction → same-revision reload inside
interest. It fails before the fix because the client stays empty, then passes
afterward; the next unchanged publication sends no redundant terrain.
All 44 focused replication/client/residency cases, typechecks, focused lint and
diff checks pass. `streaming:bench -- --assert-ready` passes all six ordinary
stages with zero missing-data or incomplete-cache frames.

Existing open clients need Save and reload to start the corrected authority.
Previously stranded chunks may remain absent in an old running session.
