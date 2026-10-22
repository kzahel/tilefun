# Dove and insect recordings v1

Three real source recordings, two excerpts each. Dove has its own mourning-dove
coos rather than inheriting pigeon. Bee uses bumblebee wing buzz; cricket uses
single-cricket wing stridulation. The latter two are mechanical animal sounds,
not vocalizations. No synthesis, pitch swaps or fabricated variations.

| Sound | Creator | Exact source page |
| --- | --- | --- |
| Dove coo | nathankwright | [mourning_dove _2017-06-06.wav](https://freesound.org/people/nathankwright/sounds/456930/) |
| Bee flight buzz | Department64 | [BEE_buzzin_02.wav](https://freesound.org/people/Department64/sounds/103047/) |
| Cricket chirp | ClaudeDebussy | [Single cricket up close](https://freesound.org/people/ClaudeDebussy/sounds/428679/) |

Each source page declares [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/).
The exact public HQ MP3 preview is retained with creator, source page, CDN URL,
license, verification date, SHA-256 and byte count. These are public previews,
not lossless original downloads; no account or authenticated download was used.

Dove is an outdoor field recording with low original level. Its tonal phrases
are filtered at 200–2,000 Hz to reduce background rumble/hiss before matching gain.
Bee is described as a bumblebee buzzing around. It is not a hive ambience bed or
a fly recording. Cricket was recorded close with a Shure Beta 57A; the creator
applied noise reduction and a low cut. A further 2,500 Hz high pass reduces its
remaining low noise; its main chirp band lies around 6–8 kHz and fits 24 kHz output.
Source species and sound categories are explicit in the receipts. Generic game
art does not imply that these recordings identify its exact biological species.

Playback is shared by game and lab. Dove calls sparsely at stationary idle.
Bee emits finite 1.05-second buzz excerpts only during replicated moving `fly`
poses, with 4–7-second spacing; landing/sipping cancels active and pending buzz.
It does not run a continuous swarm loop. Cricket chirps only at stationary idle,
with at least twelve seconds between admissions across the entire local group.
Only one world insect source may sound at once, within the combined six-creature
budget. Insect movement/alarm, removal, range, pause/mute/focus and teardown stop
owned playback. Explicit Animal Browser auditions are independent button gestures.

`export.py` is an explicit offline Python/ffmpeg recipe. Normal builds consume
committed exports without downloading or re-encoding. Processing uses mono 24 kHz,
species-specific filters, RMS target 0.16 limited to source peak 0.75, 20/40 ms
edge fades and Vorbis quality 4. Exact trims, filters, durations, decoded peak/RMS
and output hashes are retained in `manifest.json`. Existing three banks are unchanged.
Vorbis container serials can differ on re-encoding; do not overwrite frozen files
merely to replay the recipe.

Source descriptions, waveforms/spectra and decoded output signals were inspected.
These checks do not establish perceptual quality. **Owner listening review remains
pending.** [Implementation and validation](../../../docs/tactical/182-dove-and-insect-sounds.md).
