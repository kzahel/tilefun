#!/usr/bin/env bash
set -euo pipefail
# Separate environments; never upgrade the established TRELLIS/SDXL environments.
root=${1:?Usage: setup_alternatives.sh EXTERNAL_ROOT STUDY}
study=${2:?}
uv="$root/envs/bootstrap/bin/uv"
mkdir -p "$study/logs"
for project in diffusers TripoSG; do
  if [[ ! -d "$root/providers/$project" ]]; then
    if [[ "$project" == diffusers ]]; then remote=https://github.com/huggingface/diffusers.git; else remote=https://github.com/VAST-AI-Research/TripoSG.git; fi
    git clone --depth 1 "$remote" "$root/providers/$project"
  fi
done
for pinned in 'diffusers:122b1e11fd497c3eeef14b3b98ca26a60166e48b' 'TripoSG:fc5c40990181e2a756c4e0b1c2f4d6b5202faf8c'; do
  project=${pinned%%:*}
  revision=${pinned#*:}
  if [[ $(git -C "$root/providers/$project" rev-parse HEAD) != "$revision" ]]; then
    if [[ -n $(git -C "$root/providers/$project" status --porcelain) ]]; then echo "Provider has local changes: $project" >&2; exit 1; fi
    git -C "$root/providers/$project" fetch --depth 1 origin "$revision"
    git -C "$root/providers/$project" checkout --detach "$revision"
  fi
done
for environment in image-edit triposg; do
  python="$root/envs/$environment/bin/python"
  if [[ ! -x "$python" ]]; then "$uv" venv --python "$root/envs/trellis2-py310/bin/python" "$root/envs/$environment"; fi
  "$uv" pip install --python "$python" --index-url https://download.pytorch.org/whl/cu124 'torch==2.6.0+cu124' 'torchvision==0.21.0+cu124'
done
"$uv" pip install --python "$root/envs/image-edit/bin/python" "$root/providers/diffusers" 'transformers==5.19.0' 'accelerate==1.15.0' pillow 'numpy==1.26.4' sentencepiece protobuf
"$uv" pip install --python "$root/envs/triposg/bin/python" 'diffusers==0.30.3' 'transformers==4.46.3' 'peft==0.13.2' 'huggingface-hub<1' accelerate 'numpy==1.26.4' pillow trimesh einops omegaconf scikit-image 'opencv-python<4.12' jaxtyping 'typeguard==2.13.3'
export CUDA_HOME="$root/cuda-12.4"
export PATH="$CUDA_HOME/bin:$PATH"
export LD_LIBRARY_PATH="$CUDA_HOME/lib:${LD_LIBRARY_PATH:-}"
export TORCH_CUDA_ARCH_LIST=8.9
export MAX_JOBS=6
"$uv" pip install --python "$root/envs/triposg/bin/python" setuptools ninja
"$uv" pip install --python "$root/envs/triposg/bin/python" --no-build-isolation 'diso==0.1.4'
for environment in image-edit triposg; do
  "$uv" pip freeze --python "$root/envs/$environment/bin/python" > "$study/$environment-freeze.txt"
done
"$root/envs/image-edit/bin/python" - "$root" "$study" <<'PY'
import importlib.metadata, json, subprocess, sys
from pathlib import Path
root, study = map(Path, sys.argv[1:])
data = {'providers': {p: subprocess.check_output(['git', '-C', str(root/'providers'/p), 'rev-parse', 'HEAD'], text=True).strip() for p in ['diffusers', 'TripoSG']}, 'environments': {}}
for name in ['image-edit', 'triposg']:
    data['environments'][name] = json.loads(subprocess.check_output([str(root/'envs'/name/'bin/python'), '-c', 'import importlib.metadata,json; print(json.dumps({d.metadata["Name"]: d.version for d in importlib.metadata.distributions()}))'], text=True))
(study/'environment.json').write_text(json.dumps(data, indent=2)+'\n')
print(json.dumps({'status': 'installed', 'providers': data['providers']}))
PY
