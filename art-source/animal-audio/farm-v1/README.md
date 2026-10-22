# Farm animal recordings v1

Real goat bleats, donkey brays and a piglet alarm squeal: three CC0-1.0 sources,
five edited excerpts. These are public HQ MP3 previews, not lossless originals.
No generated voices, pitch swaps or fabricated variations are used.

| Voice | Creator | Source |
| --- | --- | --- |
| Goat | aisselles | [Bleating Goat](https://freesound.org/people/aisselles/sounds/722658/) |
| Donkey | felix.blume | [Donkey braying close to the market, in Morocco](https://freesound.org/people/felix.blume/sounds/152907/) |
| Piglet | wwstudioswastaken (formerly Foleyhaven) | [Piglet_Squeal_01.flac](https://freesound.org/people/wwstudioswastaken/sounds/618483/) |

All three individual pages declare [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Exact public bytes, source URLs, creator, license, retrieval date and SHA-256 are
retained in each provenance JSON and `manifest.json`. No authenticated downloads,
cookies or credentials were used. The piglet source was discovered via the
[Baby Animals pack](https://opengameart.org/content/baby-animals-sounds-pack),
but these bytes come directly from the original creator's Freesound preview.

The goat recording retains its field ambience; donkey excerpts are short sections
of a longer braying sequence. The piglet source describes an angry squeal at its
mother: it plays only on a fresh startled/flee onset, never as calm idle, sniffing
or feeding ambience. Goat/donkey use sparse resting calls and stay quiet during
browsing/hopping or dust bathing. All have explicit Animal Browser auditions;
repeated presses rotate real excerpts.

`export.py` is the explicit offline Python/ffmpeg recipe. Run it from any directory;
it verifies source hashes, writes only this bank and merges its three entries into
the runtime mapping, preserving the frozen familiar bank. Normal builds never
download or export audio. Processing matches familiar-v1: mono 24 kHz, 45 Hz high
pass, gain toward RMS 0.16 with 0.75 peak ceiling, 20/40 ms fades, Vorbis quality 4.
Every output was decoded and measured; manifest pins trims, filters and hashes.
Vorbis container serials can differ when re-encoding; compare decoded PCM and
signal metrics when replaying the recipe rather than replacing frozen outputs.

Source/signal inspection and automated playback verification do not establish
perceptual quality. **Owner listening review remains pending.**
[Implementation and evidence](../../../docs/tactical/177-farm-animal-voices.md).
