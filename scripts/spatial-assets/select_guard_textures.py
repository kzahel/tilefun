"""Record two visually selected tree probes with one crop-preserving texture reference."""
import argparse
import copy
from pathlib import Path

import numpy as np
from PIL import Image
from alternatives_report import read
from prepare_guard_study import write
from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    args = parser.parse_args()
    bundle = args.bundle
    base = bundle / "references/mask-oak-tree-native-clean"
    ref = "mask-oak-tree-native-floor32"
    root = bundle / "references" / ref
    root.mkdir(exist_ok=False)
    record = copy.deepcopy(read(base / "reference.json"))
    image = Image.open(base / "reference.png").convert("RGBA")
    alpha = np.array(image.getchannel("A"))
    mask = np.where(alpha < 32, 0, alpha).astype(np.uint8)
    assert np.array_equal(mask > 204, alpha > 204)
    image.putalpha(Image.fromarray(mask))
    image.save(root / "reference.png")
    Image.fromarray(mask).save(root / "mask.png")
    image.convert("RGB").save(root / "mask-input.png")
    assert digest(root / "mask-input.png") == record["rgbSha256"]
    record.update(id=ref, file=f"references/{ref}/reference.png", sha256=digest(root / "reference.png"),
                  maskSha256=digest(root / "mask.png"), implementationSha256=digest(__file__))
    record["segmentation"] = {"mode": "native-floor32", "rule": "Native alpha<32 zeroed; RGB, remaining alpha and TRELLIS crop unchanged", "role": "Common texturing reference only; not used to generate the tree geometry matrix"}
    record["metrics"]["zeroedLowAlphaPixels"] = int(((alpha > 0) & (alpha < 32)).sum())
    write(root / "reference.json", record)
    (root / Path(__file__).name).write_bytes(Path(__file__).read_bytes())
    cases = []
    for mode, seed, reason in [("native-clean", 43, "Repeat the soft-mask route at the second seed; coherent trunk and 3D crown but some gaps"),
                               ("sam2-points", 42, "Common frame visibly restores dense canopy relative to sparse default SAM point control")]:
        run = f"triposg-tree-{mode}-common-s{seed}"
        mesh = bundle / "runs" / run / "export-inspection/candidate.glb"
        assert read(bundle / "runs" / run / "run.json")["status"] == "succeeded"
        cases.append({"id": f"texture-tree-{mode}-s{seed}", "mesh": str(mesh.relative_to(bundle)),
                      "meshSha256": digest(mesh), "reference": ref, "referenceSha256": record["sha256"],
                      "shapeRun": run, "reason": reason})
    write(bundle / "texture-selection.json", {"cases": cases, "textureSeed": 42,
          "basis": "Agent inspection of fixed-camera front/side/oblique captures; adaptive two-case experiment, not human review",
          "reference": ref, "implementationSha256": digest(__file__),
          "limits": "Texturing starts from 50k inspection geometry; raw high-density shapes retained separately. Selection does not establish an optimal mask/seed."})
    print({"cases": len(cases), "reference": ref})


if __name__ == "__main__":
    main()
