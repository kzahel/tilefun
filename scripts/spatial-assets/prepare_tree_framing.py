"""Freeze common TripoSG framing and verify native-clean matches official input."""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from reference import digest
from prepare_guard_study import TREE_MODES, write


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--provider", type=Path, required=True)
    args = parser.parse_args()
    sys.path.insert(0, str(args.provider / "scripts"))
    from image_process import prepare_image
    bundle = args.bundle
    root = bundle / "framing"
    root.mkdir(exist_ok=False)
    base = np.array(Image.open(bundle / "references/mask-oak-tree-native-clean/reference.png").convert("RGBA"))
    ys, xs = np.where(base[:, :, 3] > 0)
    x, y, w, h = int(xs.min()), int(ys.min()), int(xs.max()-xs.min()+1), int(ys.max()-ys.min()+1)
    if w > h:
        px = int(w * .1)
        py = int(px + (w-h)/2)
    else:
        py = int(h * .1)
        px = int(py + (h-w)/2)
    protocol = {"bboxXYWH": [x, y, w, h], "paddingLRBT": [px, px, py, py],
                "rule": "All masks use native-clean alpha>0 bbox and identical padding; mask opacity and RGB retained",
                "providerPreprocessingSha256": digest(args.provider / "scripts/image_process.py"),
                "implementationSha256": digest(__file__), "checks": []}
    jobs = []
    controls = json.loads((bundle / "controls.json").read_text())
    for mode in TREE_MODES:
        ref = f"mask-oak-tree-{mode}"
        source = bundle / "references" / ref / "reference.png"
        arr = np.array(Image.open(source).convert("RGBA"))
        if not np.array_equal(arr[:, :, :3], base[:, :, :3]):
            raise RuntimeError("RGB must be identical across masks")
        rgb = torch.tensor(arr[:, :, :3], device="cuda").permute(2, 0, 1).float()/255
        alpha = torch.tensor(arr[:, :, 3], device="cuda").float()[None]/255
        composite = rgb * alpha + torch.ones_like(rgb) * (1-alpha)
        padded = F.pad(composite[:, y:y+h, x:x+w], (px, px, py, py, 0, 0), value=1.)
        image = Image.fromarray((padded.permute(1, 2, 0).cpu().numpy()*255).astype(np.uint8))
        path = root / f"{mode}-common.png"
        image.save(path)
        official = prepare_image(str(source), bg_color=np.array([1., 1., 1.]), rmbg_net=None)
        official.save(root / f"{mode}-default.png")
        control = next(c for c in controls if c["asset"] == "oak-tree" and c["mode"] == mode)
        prior = Path(control["bundle"]) / "runs" / control["id"] / "provider-input.png"
        if not np.array_equal(np.asarray(official), np.asarray(Image.open(prior))):
            raise RuntimeError("Official preprocessing no longer matches frozen 074 control")
        if mode == "native-clean" and not np.array_equal(np.asarray(image), np.asarray(official)):
            raise RuntimeError("Common frame must match native-clean default exactly")
        protocol["checks"].append({"mode": mode, "defaultMatches074": True,
                                   "commonEqualsDefault": np.array_equal(np.asarray(image), np.asarray(official)),
                                   "commonSize": list(image.size), "defaultSize": list(official.size)})
        for seed in [42, 43]:
            jobs.append({"id": f"triposg-tree-{mode}-common-s{seed}", "reference": ref, "seed": seed,
                         "preparedImage": str(path.relative_to(bundle)), "preparedSha256": digest(path),
                         "framingProtocol": protocol | {"checks": None}, "framing": "common"})
        jobs.append({"id": f"triposg-tree-{mode}-default-s43", "reference": ref, "seed": 43, "framing": "default"})
    write(root / "protocol.json", protocol)
    (root / Path(__file__).name).write_bytes(Path(__file__).read_bytes())
    write(bundle / "tree-jobs.json", jobs)
    print(json.dumps(protocol))


if __name__ == "__main__":
    main()
