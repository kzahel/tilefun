"""Export one new, explicitly selected animal bank. Never runs during builds.

Usage: python scripts/wildlife/export-animal-audio.py <bank-id>
Retained source files/provenance and recipe.json are the only inputs. Refuses to
overwrite frozen runtime audio; choose a new bank revision for changed sounds.
"""
import array
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf8"))


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf8", newline="\n")


def pcm(path, filters=None):
    command = ["ffmpeg", "-v", "error", "-i", str(path)]
    if filters:
        command += ["-af", filters]
    return array.array("f", subprocess.check_output(command + ["-ac", "1", "-ar", "24000", "-f", "f32le", "-"]))


def export(bank):
    if not re.fullmatch(r"[a-z0-9-]+-v[0-9]+", bank):
        raise ValueError("Expected a bank id ending in -v<number>")
    source = ROOT / "art-source/animal-audio" / bank
    destination = ROOT / "public/assets/audio/animals" / bank
    recipe = read(source / "recipe.json")
    if destination.exists() or (source / "manifest.json").exists():
        raise ValueError("Frozen bank already exists; author a new revision")
    runtime_path = ROOT / "src/audio/animal-recordings.json"
    runtime = read(runtime_path)
    if any(kind in runtime for kind in recipe):
        raise ValueError("Voice already exported; replacement needs an explicit reviewed migration")
    records = []
    destination.mkdir(parents=True)
    for kind, definition in recipe.items():
        provenance = read(source / f"{kind}-provenance.json")
        original = source / provenance["sourceFile"]
        assert sha(original) == provenance["sha256"], f"Changed source: {kind}"
        variants = []
        for index, (start, end) in enumerate(definition["ranges"], 1):
            assert 0 <= start < end and end - start <= 6
            trim = f"atrim=start={start}:end={end},asetpts=PTS-STARTPTS,{definition['filters']}"
            samples = pcm(original, trim)
            peak = max(abs(x) for x in samples)
            rms = math.sqrt(sum(x*x for x in samples) / len(samples))
            gain = min(0.16 / rms, 0.75 / peak)
            filters = f"{trim},volume={gain:.9f},afade=t=in:d=0.02,afade=t=out:st={end-start-0.04:.6f}:d=0.04"
            path = destination / f"{kind}-{index}.ogg"
            subprocess.run(["ffmpeg", "-v", "error", "-i", str(original), "-af", filters,
                            "-ac", "1", "-ar", "24000", "-c:a", "libvorbis", "-q:a", "4", "-map_metadata", "-1", str(path)], check=True)
            output = pcm(path)
            metrics = {"duration": len(output) / 24000, "peak": max(abs(x) for x in output),
                       "rms": math.sqrt(sum(x*x for x in output) / len(output))}
            assert metrics["peak"] < 0.9 and metrics["rms"] > 0.025, (kind, metrics)
            variants.append({"path": path.relative_to(ROOT / "public").as_posix(), "sha256": sha(path),
                             "trim": [start, end], "filters": filters, **metrics})
        records.append({**provenance, "variants": variants})
    write(source / "manifest.json", {"version": 1, "id": bank, "sampleRate": 24000,
                                      "channels": 1, "listeningReview": "pending-owner", "sources": records})
    runtime.update({r["id"]: [v["path"] for v in r["variants"]] for r in records})
    write(runtime_path, runtime)
    print(json.dumps({"bank": bank, "voices": len(records), "clips": sum(len(r["variants"]) for r in records)}))


if __name__ == "__main__":
    export(sys.argv[1])
