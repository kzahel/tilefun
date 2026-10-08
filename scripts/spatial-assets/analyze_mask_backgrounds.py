"""Expose sub-visible provider RGB outside a declared hard foreground; diagnostic only."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    args = parser.parse_args()
    destination = args.bundle / "background-analysis"
    destination.mkdir(exist_ok=True)
    records = []
    for file in sorted((args.bundle / "runs").glob("trellis-*/run.json")):
        record = json.loads(file.read_text())
        if record["status"] != "succeeded":
            continue
        ref = record["conditioningReference"]
        rgba = Image.open(args.bundle / ref["file"]).convert("RGBA")
        if digest(args.bundle / ref["file"]) != ref["sha256"]:
            raise RuntimeError("Conditioning cutout changed")
        alpha = np.array(rgba.getchannel("A"))
        ys, xs = np.where(alpha > 204)
        cx, cy = (xs.min()+xs.max())/2, (ys.min()+ys.max())/2
        size = int(max(xs.max()-xs.min(), ys.max()-ys.min()))
        bounds = (cx-size//2, cy-size//2, cx+size//2, cy+size//2)
        # Reproduce the declared upstream PIL crop; assert its exact output pixels.
        cropped = np.array(rgba.crop(bounds)).astype(np.float32)/255
        expected = (cropped[:,:,:3]*cropped[:,:,3:4]*255).astype(np.uint8)
        actual = np.array(Image.open(file.parent / "provider-input.png").convert("RGB"))
        if not np.array_equal(expected, actual):
            raise RuntimeError("Provider preprocessing differs from recorded crop/composite")
        outside = cropped[:,:,3] < .5
        max_channel = actual.max(axis=2)
        near_transparent = np.array(rgba.getchannel("A")) < 13
        out = destination / file.parent.name
        out.mkdir(exist_ok=True)
        outside_only = np.where(outside[:,:,None], actual, 0)
        Image.fromarray(np.minimum(outside_only.astype(np.uint16)*32,255).astype(np.uint8)).save(out / "outside-rgb-x32.png")
        item = {"run": file.parent.name, "reference": ref["id"], "providerInputSha256": digest(file.parent / "provider-input.png"),
                "crop": list(map(float,bounds)), "outsideHardForegroundPixels": int(outside.sum()),
                "outsideNonzeroRgbPixels": int((outside & (max_channel>0)).sum()),
                "outsideMeanMaxChannelByte": float(max_channel[outside].mean()),
                "outside99PercentileMaxChannelByte": float(np.percentile(max_channel[outside],99)),
                "nearTransparentNonzeroAlphaPixels": int((near_transparent & (alpha>0)).sum()),
                "amplifiedImageSha256": digest(out / "outside-rgb-x32.png"), "implementationSha256": digest(__file__),
                "displayTransform": "Only pixels with cropped alpha<0.5; RGB multiplied by 32 and clamped. Diagnostic amplification, not conditioning artwork.",
                "limit": "Sub-visible RGB is a plausible failure source; thresholds also change crop and foreground edge colors, so this does not prove a unique causal mechanism."}
        (out / "analysis.json").write_text(json.dumps(item, indent=2)+"\n")
        records.append(item)
    (destination / "results.json").write_text(json.dumps(records, indent=2)+"\n")
    print(json.dumps({"runs": len(records), "measurements": [{"run": r["run"], "nonzeroOutside": r["outsideNonzeroRgbPixels"], "p99": r["outside99PercentileMaxChannelByte"]} for r in records]}))


if __name__ == "__main__":
    main()
