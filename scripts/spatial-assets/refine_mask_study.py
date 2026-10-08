"""Retained oak box-only failure versus deterministic canopy/trunk SAM prompts."""
import argparse
import json
from pathlib import Path
import time

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    args = parser.parse_args()
    bundle = args.bundle
    base = json.loads((bundle / "references/mask-oak-tree-sam2-box/reference.json").read_text())
    ref_id = "mask-oak-tree-sam2-points"
    output_root = bundle / "references" / ref_id
    output_root.mkdir(exist_ok=False)
    rgb = Image.open(bundle / "mask-analysis/oak-tree/clean-rgb.png").convert("RGB")
    alpha = np.array(Image.open(bundle / "mask-analysis/oak-tree/native-alpha.png"))
    native = alpha >= 128
    ys, xs = np.where(native)
    distances = distance_transform_edt(native)
    y, x = np.unravel_index(np.argmax(distances), native.shape)
    lower = native & (np.indices(native.shape)[0] >= ys.min() + .8*(ys.max()-ys.min()))
    lower_distances = distance_transform_edt(lower)
    ly, lx = np.unravel_index(np.argmax(lower_distances), native.shape)
    points = np.array([[x, y], [lx, ly]], dtype=np.float32)
    from huggingface_hub import hf_hub_download
    import torch
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor
    env = json.loads((bundle / "environment.json").read_text())
    checkpoint = hf_hub_download(env["sam"]["repo"], "sam2.1_hiera_small.pt", revision=env["sam"]["revision"])
    if digest(checkpoint) != env["sam"]["checkpointSha256"]:
        raise RuntimeError("SAM checkpoint changed")
    predictor = SAM2ImagePredictor(build_sam2(env["sam"]["config"], checkpoint, device="cuda", apply_postprocessing=False))
    started = time.perf_counter()
    with torch.inference_mode(), torch.autocast("cuda", dtype=torch.bfloat16):
        predictor.set_image(np.array(rgb))
        masks, scores, logits = predictor.predict(box=np.array(base["segmentation"]["samBox"]), point_coords=points, point_labels=np.ones(2, dtype=np.int32), multimask_output=False)
    torch.cuda.synchronize()
    mask = masks[0].astype(np.uint8)*255
    image = rgb.convert("RGBA")
    image.putalpha(Image.fromarray(mask))
    image.save(output_root / "reference.png")
    rgb.save(output_root / "mask-input.png")
    Image.fromarray(mask).save(output_root / "mask.png")
    np.savez_compressed(output_root / "sam-output.npz", mask=masks[0], predicted_score=scores, low_resolution_logits=logits, positive_points_xy=points)
    selected, core = mask >= 128, alpha >= 243
    my, mx = np.where(selected)
    base.update(id=ref_id, file=f"references/{ref_id}/reference.png", sha256=digest(output_root / "reference.png"), maskSha256=digest(output_root / "mask.png"), rgbSha256=digest(output_root / "mask-input.png"), implementationSha256=digest(__file__))
    base["segmentation"].update(mode="sam2-points", seconds=time.perf_counter()-started, predictedMaskScore=float(scores[0]), positivePoints=points.tolist(), pointRule="Maximum native-alpha>=128 distance transform globally, then maximum within bottom 20 percent of native bbox; two positive labels, no manual selection")
    base["metrics"] = {"selectedPixels": int(selected.sum()), "nativeCoreRetainedFraction": float((selected & core).sum()/core.sum()),
                       "selectedInNativeNearTransparentPixels": int((selected & (alpha<13)).sum()),
                       "nativeBinaryAgreementIoU": float((selected & native).sum()/(selected | native).sum()),
                       "providerAlphaGt08Bbox": [int(mx.min()), int(my.min()), int(mx.max()), int(my.max())],
                       "limit": "Returned native alpha is not ground truth; prompts encode an automatic class-specific trunk hypothesis"}
    (output_root / "reference.json").write_text(json.dumps(base, indent=2)+"\n")
    (bundle / "point-mask-execution.json").write_text(json.dumps([base], indent=2)+"\n")
    (output_root / "refine_mask_study.py").write_bytes(Path(__file__).read_bytes())
    print(json.dumps({"id": ref_id, "points": points.tolist(), "metrics": base["metrics"]}), flush=True)


if __name__ == "__main__":
    main()
