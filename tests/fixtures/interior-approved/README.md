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

Six thickness/end-join cases were approved on 2026-09-29 (source commit fcb2a93):
the straight, L, T, and doorway thickness cases and both north attachments.
Their saved good fingerprints match the captured PNGs. The baseline now protects
183 renders; the two rejected south attachments remain outside it.

The low south attachment was approved on 2026-09-29 (source commit 4295746).
Its exact pixels bring the regression baseline to 184. The tall south connection
still requires review. These fixtures are test references, never runtime caches.

The tall south height step was approved on 2026-09-29 (source commit 406a3fa).
Its captured pixels match that verdict. All 185 existing cases are now protected;
the subsequent 24 interaction/composition cases are not yet approved.
