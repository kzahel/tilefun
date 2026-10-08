"""Zero low-alpha leakage while preserving the native provider crop exactly."""
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
    bundle = args.bundle
    base_root = bundle / "references/mask-compact-1-east-native-clean"
    record = json.loads((base_root / "reference.json").read_text())
    image = Image.open(base_root / "reference.png").convert("RGBA")
    alpha = np.array(image.getchannel("A"))
    mask = np.where(alpha < 32, 0, alpha).astype(np.uint8)
    if not np.array_equal(mask > 204, alpha > 204):
        raise RuntimeError("Must preserve the provider's bbox exactly")
    ref_id = "mask-compact-1-east-native-floor32"
    root = bundle / "references" / ref_id
    root.mkdir(exist_ok=False)
    image.putalpha(Image.fromarray(mask))
    image.save(root / "reference.png")
    Image.fromarray(mask).save(root / "mask.png")
    image.convert("RGB").save(root / "mask-input.png")
    if digest(root / "mask-input.png") != record["rgbSha256"]:
        raise RuntimeError("Visible RGB must be unchanged")
    record.update(id=ref_id, file=f"references/{ref_id}/reference.png", sha256=digest(root / "reference.png"), maskSha256=digest(root / "mask.png"), implementationSha256=digest(__file__))
    record["segmentation"].update(mode="native-floor32", rule="Native alpha<32 becomes zero; all other alpha/RGB unchanged; bbox alpha>204 asserted identical", probe="Adaptive control after amplified outside-RGB grid inspection")
    record["metrics"].update(zeroedLowAlphaPixels=int(((alpha>0)&(alpha<32)).sum()))
    (root / "reference.json").write_text(json.dumps(record, indent=2)+"\n")
    (root / "register_alpha_floor.py").write_bytes(Path(__file__).read_bytes())
    (bundle / "floor-mask-execution.json").write_text(json.dumps([record], indent=2)+"\n")
    extra = json.loads((bundle / "point-mask-execution.json").read_text()) + [record]
    (bundle / "extra-mask-execution.json").write_text(json.dumps(extra, indent=2)+"\n")
    print(json.dumps({"id": ref_id, "zeroedLowAlphaPixels": record["metrics"]["zeroedLowAlphaPixels"], "cropPreserved": True}))


if __name__ == "__main__":
    main()
