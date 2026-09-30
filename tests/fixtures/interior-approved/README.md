# Approved interior baseline

The first 163 renders were accepted by the reviewer on 2026-09-29. They capture the
legacy renderer after the connected wall-mass outline fixes (commit f802863).
`fingerprints.json` hashes the sketch, canvas dimensions, and RGBA pixels exactly
as the review page does. These hashes record the historical approvals; PNGs are
the actual visual regression references. Browser/OS differences in translucent
shadow compositing can change an exact hash without changing the appearance.

The browser regression test compares every baseline case's native-resolution
canvas PNG without posting feedback. It uses Playwright's perceived-color
threshold of 0.01 (well below the default 0.2) with zero differing pixels allowed
above that threshold. This tolerates tiny shadow-rounding differences while
retaining checks for changed geometry, occlusion, dimensions, and appearance.
Targeted geometry tests still assert exact pixel colors. Failures include actual,
expected, and diff images in the HTML report and CI artifacts.

Functional review scenarios seed approvals from freshly rendered fingerprints in
an isolated context in the test browser, independently of these visual baselines.
Explicit stale-verdict scenarios still verify that changed fingerprints reopen
approvals. Production verdict matching continues to use exact fingerprints.

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

Sixteen interaction cases were approved on 2026-09-29 (source commit 2ee17d0):
seven small interactions, all eight mixed-profile cases, and the first two-room
composition. Each capture matches its good verdict. The baseline now protects
201 renders; the rejected normal-height east attachments and remaining six room
compositions still require review.

The repaired east thick-wall connection was approved after commit 214d8fd.
The next reports identified normal west caps stopping inside the shell face.
Correcting that shared join intentionally changes `interaction-thick-shell` and
`interaction-two-rooms`. Their historical approved PNGs are retained, with the
old fingerprints in `pending-reapproval.json`; they are not approvals of the new
renders. The active baseline protects 200 unchanged images. Restore these two to
the active manifest only after fresh human approval with matching pixels.

After 0aaad89, the three-room layout and short-return composition were approved
and captured with matching verdicts. Low east and tall west reports then exposed
the need for a shared normal-height reference at side connections. That fix also
reopens `profile-door-true`, `profile-door-east-low`, and `profile-door-east-tall`.
Their old images remain untouched and their fingerprints join the pending file.
The active baseline now protects 199 unchanged renders; five historical approvals
await recheck. No changed render has been automatically approved.

All 209 cases were approved after 4f667b6. The ten outstanding captures now match
their latest good verdicts, including all five reopened attachments. There are
no pending reapprovals. `superseded-fingerprints.json` retains older hashes solely
to test that changed renders invalidate historical verdicts. Stage 12 adds eight
new boundary candidates; those remain outside the approved baseline.

After 1d59799, both normal north attachments and the thick low north attachment
were approved and captured with matching verdicts. The tall north and normal
south reports require the renderer to distinguish physical shell height from
cutaway height. That shared correction reopens `connection-north-tall`,
`connection-south-tall`, `interaction-mixed-north`, and `interaction-mixed-south`.
Their historical PNGs remain untouched, with hashes in `pending-reapproval.json`.
The active baseline protects 208 unchanged renders; changed versions still need
human review.

All 217 cases passed after ca8115f, including the two reports and four reopened
attachments. Their latest approved captures now complete the active baseline.
The four pending hashes moved into `superseded-fingerprints.json` for historical
verdict tests; there are no pending reapprovals. Stage 13's eight nearby door,
junction, and loop candidates remain unapproved until human review.

All 225 cases passed after 2dbe80f. The eight nearby-case captures match the latest
good verdicts and now join the active baseline. Stage 14's eight generated
counterexamples remain outside the baseline until human review.

All 233 wall cases passed after b707e54. The eight generated cases have matching
good verdicts and now join the active baseline, with no changed pixels. Stage 15
introduces furniture review; these new images and placement metadata remain
unapproved. Furniture fingerprints also include their placements and the used
catalog definitions, so changing an invisible footprint requires fresh review.

The single-bed/bedside scene was approved after 2986679. Its current pixels and
catalog metadata match that explicit good verdict and join the 233 unchanged
wall baselines (234 total). Other furniture cases remain unapproved. Static
furniture grading is now on hold while movement, collision, and occlusion are
reviewed in the separate playtest; movement reports never create approvals.
