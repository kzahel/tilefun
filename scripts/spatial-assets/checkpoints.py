"""Download pinned TRELLIS.2 512 weights into the external Hugging Face cache.

Use --public-only while DINOv3 access is pending. Authentication uses the normal
local Hugging Face credential store; credentials never belong in a run record.
"""
import argparse
import hashlib
from pathlib import Path
from huggingface_hub import HfApi, snapshot_download


CHECKPOINT = "af44b45f2e35a493886929c6d786e563ec68364d"
ENCODER = "ea8dc2863c51be0a264bab82070e3e8836b02d51"
STRUCTURE = "25e0d31ffbebe4b5a97464dd851910efc3002d96"
ENCODER_REPO = "facebook/dinov3-vitl16-pretrain-lvd1689m"
NAMES = ["ss_flow_img_dit_1_3B_64_bf16", "shape_dec_next_dc_f16c32_fp16",
         "slat_flow_img2shape_dit_1_3B_512_bf16", "tex_dec_next_dc_f16c32_fp16",
         "slat_flow_imgshape2tex_dit_1_3B_512_bf16"]


def download_public(checkpoint_revision=CHECKPOINT, structure_revision=STRUCTURE):
    checkpoint = snapshot_download(
        "microsoft/TRELLIS.2-4B", revision=checkpoint_revision,
        allow_patterns=["pipeline.json"] + [f"ckpts/{n}.{ext}" for n in NAMES for ext in ["json", "safetensors"]],
        max_workers=2)
    structure = snapshot_download("microsoft/TRELLIS-image-large", revision=structure_revision,
                                  allow_patterns=["ckpts/ss_dec_conv3d_16l8_fp16.*"], max_workers=2)
    return checkpoint, structure


def download_encoder(encoder_revision=ENCODER):
    return snapshot_download(ENCODER_REPO, revision=encoder_revision,
                             allow_patterns=["config.json", "*.safetensors", "*.safetensors.index.json"],
                             max_workers=2)


def verify_local_encoder(directory, revision=ENCODER):
    """Check browser-supplied files against the pinned Hub Git/LFS metadata."""
    info = HfApi().model_info(ENCODER_REPO, revision=revision, files_metadata=True)
    if info.sha != revision:
        raise RuntimeError("Encoder revision must resolve to the requested immutable commit")
    verified = {}
    for name in ("config.json", "model.safetensors"):
        metadata = next(file for file in info.siblings if file.rfilename == name)
        path = Path(directory) / name
        if path.stat().st_size != metadata.size:
            raise RuntimeError(f"Encoder size mismatch: {name}")
        sha256 = hashlib.sha256()
        git_blob = hashlib.sha1(f"blob {metadata.size}\0".encode())
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                sha256.update(block)
                git_blob.update(block)
        expected = metadata.lfs.sha256 if metadata.lfs else metadata.blob_id
        actual = sha256.hexdigest() if metadata.lfs else git_blob.hexdigest()
        if actual != expected:
            raise RuntimeError(f"Encoder checksum mismatch: {name}")
        verified[name] = {"sha256": sha256.hexdigest(), "bytes": metadata.size,
                          "hubDigest": expected, "hubDigestType": "sha256" if metadata.lfs else "git-blob-sha1"}
    return verified


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public-only", action="store_true")
    args = parser.parse_args()
    if not args.public_only:
        download_encoder()
    download_public()
    print("Pinned checkpoint download complete")
