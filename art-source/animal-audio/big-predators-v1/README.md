# Big predator recordings v1

Five real recordings cover tiger, lion, brown bear, leopard and jaguar. Panther
explicitly inherits the leopard cough as a melanistic leopard; it adds no unique
source or artificial pitch variant. Seven runtime excerpts: two lion calls, two
bear growls and one tiger/leopard/jaguar phrase each.

Tiger (lauramellis, Freesound 263115) and lion (Bidone, 69572) are CC0. Leopard
(drobiumdesign, 346402) is CC BY 3.0. Brown bear (YleArkisto, 249441) is CC BY 4.0.
Jaguar is About Zoos, extracted by AntumDeluge, distributed as FLAC by OpenGameArt
under CC BY 3.0 or newer. Source/license links, exact bytes, hashes and access
dates live in each provenance file and manifest.json. Public credits are at
[recording credits](../../../public/assets/audio/animals/CREDITS.txt), linked from
Animal Browser. These credits identify the edits and imply no endorsement.

The four Freesound files are public HQ MP3 previews, not lossless originals.
Jaguar is the lossless FLAC excerpt from the original OpenGameArt archive.
Source descriptions identify real animals; human imitations, filtered human
roars and poorly documented mixed-species fight effects were excluded.
Lion retains field ambience; the retained source has hot peaks. Selected excerpts
are filtered/gain-limited before export. Brown bear retains archival recording
character. These choices need owner listening review rather than an automated
claim of perceptual quality.

Playback uses fresh replicated named display poses, including warning displays.
First-observed displays, resting, feeding, stalking and chasing remain silent.
Species cooldowns are 20–25 seconds. Shared distance attenuation, panning, six-voice
cap and lifecycle cleanup apply in game and lab. Recorded ownership suppresses the
old generic cat design even if an audio download fails. Explicit auditions cycle
actual takes without enabling world ambience.

Explicit export: `python scripts/wildlife/export-animal-audio.py big-predators-v1`.
The recipe uses mono 24 kHz, species filters, RMS target 0.16/source peak ceiling
0.75, 20/40 ms edge fades and Vorbis quality 4. The exporter refuses to overwrite
frozen banks. Normal builds never download or regenerate recordings. Exact trims,
filters and decoded output metrics are retained. Signal/description inspection
was performed; **owner listening review remains pending**.
