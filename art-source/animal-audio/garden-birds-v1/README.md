# Garden bird recordings v1

Three distinct recorded voices: two crow caws, three raven calls and two pigeon
coo excerpts. No synthesis, species pitch swaps or artificial variants are used.
Sources are exact public HQ MP3 previews, not lossless original downloads.

| Voice | Creator | Original page |
| --- | --- | --- |
| Crow | nigelcoop | [crow.wav](https://freesound.org/people/nigelcoop/sounds/75162/) |
| Raven | KiddoFish86 | [Raven_Caw.wav](https://freesound.org/people/KiddoFish86/sounds/274439/) |
| Pigeon | Alva Majo / 5ro4 | [pigeon walking and cooing.wav](https://freesound.org/people/5ro4/sounds/701282/) |

Each individual page declares [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Original source URLs, creator, license, date and SHA-256 are retained in each
provenance JSON and `manifest.json`. No account, cookie or authenticated download
was used. The earlier Jofae crow candidate is not used; no raven/crow interchange
or dove inheritance is implied by broad tags on a source page.

The crow source is an outdoor flight departure, filtered by its creator; raven
is described as close-microphone recording. Pigeon was recorded walking and cooing
and retains incidental movement/recording character. Excerpts are source/signal
selections, **not owner listening approvals**. Listening review remains pending.

Runtime calls are sparse stationary idle ambience, never generic work-action
onsets or continuous flight loops. Crow/raven keep quiet while holding real
replicated twig/shiny actors; pickup cancels active and pending calls. All three
inherit normal range, shared voice cap, cadence and pause/mute/focus cleanup.
Explicit Animal Browser auditions rotate the retained takes independently.

`export.py` is an offline Python/ffmpeg recipe, runnable from any directory. It
verifies source hashes and merges only these three entries into the runtime map.
Normal builds never download or regenerate audio. Processing: mono 24 kHz, 45 Hz
high pass, RMS target 0.16 limited to source peak 0.75, 20/40 ms edge fades, Vorbis
quality 4. Manifest pins exact trims, filters, duration, peak/RMS and export hashes.
All exports were decoded and measured. Re-encoded Vorbis container serials may
differ; compare decoded PCM/metrics when replaying rather than overwriting frozen
artifacts. The preceding familiar/farm banks are unchanged.

[Implementation and validation](../../../docs/tactical/178-garden-bird-voices.md).
