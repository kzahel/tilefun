"""Measure crop invariance, alpha leakage and a matched TripoSG repeat control."""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from alternatives_report import read
from prepare_guard_study import PROPS, write
from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    args = parser.parse_args()
    bundle = args.bundle
    backgrounds = read(bundle / "background-analysis/results.json")
    pairs = []
    for asset in PROPS:
        clean = bundle / "references" / f"mask-{asset}-native-clean"
        floor = bundle / "references" / f"mask-{asset}-native-floor32"
        a = np.array(Image.open(clean / "reference.png"))
        b = np.array(Image.open(floor / "reference.png"))
        assert np.array_equal(a[:, :, :3], b[:, :, :3])
        assert np.array_equal(a[:, :, 3] > 204, b[:, :, 3] > 204)
        assert np.array_equal(b[:, :, 3], np.where(a[:, :, 3] < 32, 0, a[:, :, 3]))
        measurements = [next(r for r in backgrounds if r["run"] == f"trellis-mask-{asset}-{m}") for m in ["native-clean", "native-floor32"]]
        assert measurements[0]["crop"] == measurements[1]["crop"]
        pairs.append({"asset": asset, "RGBIdentical": True, "cropIdentical": True,
                      "zeroedLowAlphaPixels": int(((a[:, :, 3] > 0) & (b[:, :, 3] == 0)).sum()),
                      "outsideNonzeroRGB": [r["outsideNonzeroRgbPixels"] for r in measurements],
                      "outsideRGBP99": [r["outside99PercentileMaxChannelByte"] for r in measurements]})
    control = next(c for c in read(bundle / "controls.json") if c["asset"] == "oak-tree" and c["mode"] == "native-clean")
    original = Path(control["bundle"]) / "runs" / control["id"]
    repeat = bundle / "runs/triposg-tree-native-clean-common-s42"
    a, b = np.load(original / "raw.npz"), np.load(repeat / "raw.npz")
    repeat_result = {"original": control["id"], "repeat": repeat.name,
                     "providerPixelsIdentical": np.array_equal(np.asarray(Image.open(original / "provider-input.png")), np.asarray(Image.open(repeat / "provider-input.png"))),
                     "verticesIdentical": np.array_equal(a["vertices"], b["vertices"]),
                     "facesIdentical": np.array_equal(a["faces"], b["faces"]),
                     "originalTriangles": len(a["faces"]), "repeatTriangles": len(b["faces"])}
    if a["vertices"].shape == b["vertices"].shape:
        repeat_result["maximumOrderedVertexDifference"] = float(np.abs(a["vertices"]-b["vertices"]).max())
    textures = []
    selection = read(bundle / "texture-selection.json")
    if selection:
        for case in selection["cases"]:
            record = read(bundle / "runs" / case["id"] / "run.json")
            if digest(bundle / case["mesh"]) != case["meshSha256"] or record["meshInputSha256"] != case["meshSha256"]:
                raise RuntimeError("Texture parent shape changed")
            if record["input"]["sha256"] != case["referenceSha256"]:
                raise RuntimeError("Texture conditioning differs from selected common reference")
            textures.append({"id": case["id"], "parentMeshVerified": True,
                             "providerInputSha256": record["outputSha256"]["provider-input.png"],
                             "shapePreservation": record["shapePreservation"]})
        if len({t["providerInputSha256"] for t in textures}) != 1:
            raise RuntimeError("Texture trials must use identical provider pixels")
    result = {"props": pairs, "matchedRepeat": repeat_result, "implementationSha256": digest(__file__),
              "textures": textures,
              "limit": "Input invariance and numeric repeat checks do not establish art quality or uniquely identify the failure mechanism."}
    write(bundle / "guard-analysis.json", result)
    print(result)


if __name__ == "__main__":
    main()
