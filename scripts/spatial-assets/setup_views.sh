#!/usr/bin/env bash
set -euo pipefail
spatial_root=${1:?Usage: setup_views.sh EXTERNAL_ROOT}
scripts=$(cd "$(dirname "$0")" && pwd)
uv="$spatial_root/envs/bootstrap/bin/uv"
view_python="$spatial_root/envs/mvadapter-py310/bin/python"
if [[ ! -x "$view_python" ]]; then
  "$uv" venv --python "$spatial_root/envs/trellis2-py310/bin/python" "$spatial_root/envs/mvadapter-py310"
fi
"$uv" pip install --python "$view_python" --index-url https://download.pytorch.org/whl/cu124 \
  'torch==2.6.0+cu124' 'torchvision==0.21.0+cu124'
"$uv" pip install --python "$view_python" -r "$scripts/requirements-views.txt"
if [[ ! -d "$spatial_root/providers/MV-Adapter" ]]; then
  git clone https://github.com/huanngzh/MV-Adapter.git "$spatial_root/providers/MV-Adapter"
  git -C "$spatial_root/providers/MV-Adapter" checkout --detach 4277e0018232bac82bb2c103caf0893cedb711be
fi
expected=4277e0018232bac82bb2c103caf0893cedb711be
actual=$(git -C "$spatial_root/providers/MV-Adapter" rev-parse HEAD)
if [[ "$actual" != "$expected" ]]; then
  echo "MV-Adapter checkout must be pinned to $expected; found $actual" >&2
  exit 1
fi
export CUDA_HOME="$spatial_root/cuda-12.4"
export PATH="$spatial_root/envs/mvadapter-py310/bin:$CUDA_HOME/bin:/usr/local/bin:/usr/bin:/bin"
export LD_LIBRARY_PATH="$CUDA_HOME/lib:${LD_LIBRARY_PATH:-}"
export TORCH_CUDA_ARCH_LIST=${TORCH_CUDA_ARCH_LIST:-8.9}
export MAX_JOBS=${MAX_JOBS:-6}
for include in "$spatial_root"/envs/mvadapter-py310/lib/python3.10/site-packages/nvidia/*/include; do
  export CPATH="$include:${CPATH:-}"
done
"$uv" pip install --python "$view_python" --no-build-isolation --no-deps "$spatial_root/providers/nvdiffrast"
