"""Explicit, offline audio export. Normal builds consume the retained OGG bank.

Run from the repository root with Python 3 and ffmpeg/ffprobe on PATH.
Source files are exact public HQ MP3 previews, not lossless originals.
"""
import array
import hashlib
import json
import math
import re
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).resolve().parent
DEST = ROOT / "public/assets/audio/animals/farm-v1"
RANGES = {
    "goat": [(0.85, 2.2), (3.35, 4.25)],
    "donkey": [(4.8, 6.8), (8.2, 9.4)],
    "piglet": [(0, 1.429)],
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def formatted_json(value):
    text = json.dumps(value, indent=2)
    text = re.sub(r'"trim": \[\s*([0-9.]+),\s*([0-9.]+)\s*\]', r'"trim": [\1, \2]', text)
    text = re.sub(r'"(\w+)": \[\n    "([^"\n]+)"\n  \]', r'"\1": ["\2"]', text)
    return text + "\n"


def pcm(path, filters=None):
    cmd = ["ffmpeg", "-v", "error", "-i", str(path)]
    if filters:
        cmd += ["-af", filters]
    return array.array("f", subprocess.check_output(cmd + ["-ac", "1", "-ar", "24000", "-f", "f32le", "-"]))


def export():
    DEST.mkdir(parents=True, exist_ok=True)
    records = []
    for kind, ranges in RANGES.items():
        provenance = json.loads((SOURCE / f"{kind}-provenance.json").read_text())
        original = SOURCE / provenance["sourceFile"]
        assert sha(original) == provenance["sha256"], f"Changed source: {kind}"
        variants = []
        for i, (start, end) in enumerate(ranges):
            trim = f"atrim=start={start}:end={end},asetpts=PTS-STARTPTS,highpass=f=45"
            samples = pcm(original, trim)
            peak = max(abs(x) for x in samples)
            rms = math.sqrt(sum(x*x for x in samples) / len(samples))
            gain = min(0.16 / rms, 0.75 / peak)
            filters = f"{trim},volume={gain:.9f},afade=t=in:d=0.02,afade=t=out:st={end-start-0.04:.6f}:d=0.04"
            path = DEST / f"{kind}-{i+1}.ogg"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(original), "-af", filters,
                            "-ac", "1", "-ar", "24000", "-c:a", "libvorbis", "-q:a", "4", "-map_metadata", "-1", str(path)], check=True)
            output = pcm(path)
            metrics = {"duration": len(output) / 24000, "peak": max(abs(x) for x in output),
                       "rms": math.sqrt(sum(x*x for x in output) / len(output))}
            assert metrics["peak"] < 0.9 and metrics["rms"] > 0.025
            variants.append({"path": path.relative_to(ROOT / "public").as_posix(), "sha256": sha(path),
                             "trim": [start, end], "filters": filters, **metrics})
        records.append({**provenance, "variants": variants})
    receipt = {"version": 1, "id": "farm-v1", "license": "CC0-1.0", "sampleRate": 24000,
               "channels": 1, "listeningReview": "pending-owner", "sources": records}
    (SOURCE / "manifest.json").write_text(formatted_json(receipt), encoding="utf8", newline="\n")
    runtime = json.loads((ROOT / "src/audio/animal-recordings.json").read_text())
    runtime.update({r["id"]: [v["path"] for v in r["variants"]] for r in records})
    (ROOT / "src/audio/animal-recordings.json").write_text(formatted_json(runtime), encoding="utf8", newline="\n")
    print(json.dumps({"voices": len(records), "clips": sum(len(r["variants"]) for r in records)}))


if __name__ == "__main__":
    export()
