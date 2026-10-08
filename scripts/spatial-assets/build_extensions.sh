#!/usr/bin/env bash
set -euo pipefail
# Run inside WSL; dependencies and CUDA are installed under this external root.
spatial_root=${1:?Usage: build_extensions.sh EXTERNAL_ROOT}
export CUDA_HOME="$spatial_root/cuda-12.4"
export PATH="$spatial_root/envs/trellis2-py310/bin:$CUDA_HOME/bin:/usr/local/bin:/usr/bin:/bin"
export LD_LIBRARY_PATH="$CUDA_HOME/lib:${LD_LIBRARY_PATH:-}"
export TORCH_CUDA_ARCH_LIST=${TORCH_CUDA_ARCH_LIST:-8.9}
export MAX_JOBS=${MAX_JOBS:-6}
for include in "$spatial_root"/envs/trellis2-py310/lib/python3.10/site-packages/nvidia/*/include; do
  export CPATH="$include:${CPATH:-}"
done
for package in CuMesh FlexGEMM TRELLIS.2/o-voxel nvdiffrast; do
  log="$spatial_root/build-${package//\//-}.log"
  echo "Building $package; log: $log"
  if ! "$spatial_root/envs/bootstrap/bin/uv" pip install \
    --python "$spatial_root/envs/trellis2-py310/bin/python" --no-build-isolation --no-deps \
    "$spatial_root/providers/$package" > "$log" 2>&1; then
    tail -35 "$log"
    exit 1
  fi
done
