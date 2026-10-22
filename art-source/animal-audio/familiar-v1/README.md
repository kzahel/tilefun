# Familiar animal recordings v1

Six real animal voices cover dog/cat (including their two coats each), cow,
sheep, chicken and horse. Eleven distinct recorded excerpts: three dog barks,
three hen calls, two cow calls, and one complete cat/sheep/horse call each.
The single-take voices intentionally have no artificial pitch-generated variants.

Sources are exact **public HQ MP3 preview files**, not the creators' original
lossless uploads. All six individual pages declare CC0-1.0; provenance JSON
retains creator, page, CDN URL, access date and exact bytes/hash. No account,
cookie, API key or authenticated download was used. Keep these public source
files and provenance with derived exports. Creator credit is retained even for CC0.

`manifest.json` pins source and runtime SHA-256, exact trim times, processing
filters and measured duration/peak/RMS. `export.py` is an explicit offline Python
3/ffmpeg recipe, run from any directory. Normal builds never download or regenerate
these files. Re-encoded Vorbis container serials can differ between ffmpeg runs;
verify decoded PCM and retained signal metrics when replaying the recipe rather
than treating a new container hash as the original frozen artifact.

Processing: select short complete calls, remove low rumble, mono 24 kHz, adjust
gain toward RMS 0.16 with a 0.75 source peak ceiling, add 20 ms onset/40 ms tail
fades and encode OGG/Vorbis quality 4. No species pitch swaps, time stretching,
generated imitations or fabricated extra takes are used. Lossy codec peaks are
checked below 0.9. The small indoor dog recording and distant cow recording retain
their recording character; owner listening review should assess them in context.

Sources:

| Voice | Creator | Page |
| --- | --- | --- |
| Dog | krissyeliot | [dog-barking.wav](https://freesound.org/people/krissyeliot/sounds/125523/) |
| Cat | Sadiquecat | [Cat meow](https://freesound.org/people/Sadiquecat/sounds/689324/) |
| Cow | JarredGibb | [Cow moo](https://freesound.org/people/JarredGibb/sounds/233145/) |
| Sheep | Gitanki | [sheep.wav](https://freesound.org/people/Gitanki/sounds/172712/) |
| Chicken | Breviceps | [Chicken clucking](https://freesound.org/people/Breviceps/sounds/456803/) |
| Horse | 3bagbrew | [horse.mp3](https://freesound.org/people/3bagbrew/sounds/59569/) |

[CC0 license](https://creativecommons.org/publicdomain/zero/1.0/).
Source/signal inspection and automated decoding are recorded separately from
**owner listening approval, which remains pending**. Audition the exact runtime
files through Animal Browser → Sounds → Recorded voices → Audition voice.
Repeated presses cycle available takes. [Delivery and validation](../../../docs/tactical/176-familiar-animal-voices.md).
