#!/usr/bin/env bash
set -euo pipefail
root=${1:?External WSL spatial-assets root}
study=${2:?Study directory}
revision=2b90b9f5ceec907a1c18123530e92e794ad901a4
uv="$root/envs/bootstrap/bin/uv"
provider="$root/providers/sam2"
if [[ ! -d "$provider" ]]; then git clone --depth 1 https://github.com/facebookresearch/sam2.git "$provider"; fi
if [[ $(git -C "$provider" rev-parse HEAD) != "$revision" ]]; then
  if [[ -n $(git -C "$provider" status --porcelain) ]]; then echo 'SAM provider has local changes' >&2; exit 1; fi
  git -C "$provider" fetch --depth 1 origin "$revision"
  git -C "$provider" checkout --detach "$revision"
fi
python="$root/envs/sam2/bin/python"
if [[ ! -x "$python" ]]; then "$uv" venv --python "$root/envs/trellis2-py310/bin/python" "$root/envs/sam2"; fi
"$uv" pip install --python "$python" --index-url https://download.pytorch.org/whl/cu124 'torch==2.6.0+cu124' 'torchvision==0.21.0+cu124'
export SAM2_BUILD_CUDA=0
"$uv" pip install --python "$python" "$provider" 'numpy==1.26.4' pillow 'huggingface-hub<1' 'rembg==2.0.67' onnxruntime scipy
"$uv" pip freeze --python "$python" > "$study/sam2-freeze.txt"
