# Large herbivore recordings v1

Six sources/eight excerpts cover elephant (including upright elephant), elk,
white-tailed deer, moose, zebra and hippopotamus. Exact source, creator, license,
download, bytes and hashes live in each provenance file and manifest. Public
[recording credits](../../../public/assets/audio/animals/CREDITS.txt) are linked
from Animal Browser. Elephant/elk/deer/zebra Freesound sources are CC0, hippo is
Yle's CC BY 4.0 field archive, and Bwells explicitly dedicated the moose recording
to the public domain. That dedication is recorded as Public-domain-self, not CC0.
Freesound files retain public HQ MP3 previews; moose retains its distributed Ogg.

Elephant is a zoo trumpet; upright elephant explicitly inherits the same animal
voice. Elk is a Banff rut bugle with a long 75-second cooldown. Zebra is an actual
Grant zebra bray rather than a horse sound. These have sparse stationary idle
calls and appropriate existing generic action poses. Trunk reaching, plucking,
shaking and eating are not vocal cues. Moose has a filtered low-grunt phrase from
a remote-camera field recording, retaining forest noise. Hippo grunts retain water
ambience. These are provisional sound contexts, not new seasonal/courtship AI.

Deer uses two alarm snorts identified by the uploader at 40 and 44 seconds in
Crab Orchard National Wildlife Refuge, Illinois. Its white-tailed identification
is inferred from the location, not explicitly supplied as a scientific species
name by the uploader. No roe-deer bark or distressed fawn cry is substituted.
The ordinary white-tailed deer runtime identity now selects this recording.
Playback is limited to a fresh replicated alarm stamp; first-observed stamps,
resting and browsing remain silent. A fifteen-second cooldown prevents stamp loops
from repeatedly calling. The native test uses serialized game entities, including
actual scared state, and checks silence, onset, deduplication and cleanup.

Mono 24 kHz, explicit species filters, RMS target 0.16 limited to source peak 0.75,
quiet edges and Vorbis quality 4; exact trims and decoded output measurements are
retained. The moose low pass deliberately reduces the dominant insect band.
Descriptions, waveforms and spectra were inspected; **owner listening review
remains pending**, including the field-noise balance. The explicit bank exporter
refuses to overwrite frozen output; builds never fetch or re-encode recordings.
