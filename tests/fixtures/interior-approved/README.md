# Approved interior baseline

The first 163 renders were accepted by the reviewer on 2026-09-29. They capture the
legacy renderer after the connected wall-mass outline fixes (commit f802863).
`fingerprints.json` hashes the sketch, canvas dimensions, and RGBA pixels exactly
as the review page does. PNGs retain the actual visual reference.

The browser regression test checks every baseline case without posting feedback.
Do not regenerate this directory to make a failing test pass. A changed image
must return to the human review cycle before its baseline is replaced.

Ten height/arch sampler renders were added after individual approvals on
2026-09-29 (source commit 3431db0). The two rejected doorway attachments are not
in this baseline. There are now 173 approved renders.

Three side-wall attachment renders were added after individual approvals on
2026-09-29 (source commit 49f3974). The tall east attachment remains outside
the baseline pending review. The baseline now contains 176 approved renders.

The tall east attachment was approved on 2026-09-29 (source commit 9d4a6a9).
Its captured pixels match the saved good verdict exactly. All 177 existing
cases are now protected; thickness/end-join candidates require new review.
