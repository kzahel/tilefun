#!/usr/bin/env bash
set -euo pipefail
# Recommended experimental local path. Every invocation requires a fresh ID.
spatial_root=${1:?Usage: run_img2img.sh EXTERNAL_ROOT BUNDLE ASSET FRESH_ID [STRENGTH=.8] [IMAGE_SEED=42] [MESH_SEED=42] [MODE=direct]}
bundle=${2:?}
asset=${3:?}
run_id=${4:?}
scripts=$(cd "$(dirname "$0")" && pwd)
mode=${8:-direct}
if [[ "$mode" != direct && "$mode" != multiview ]]; then
  echo "Mode must be direct or multiview" >&2
  exit 1
fi
reference_id="$run_id-reference"
if [[ "$mode" == multiview ]]; then reference_id="$run_id-img2img-reference"; fi
prompt=${9:-"$bundle/prompts/$asset.txt"}
if [[ "$asset" == oak-tree && -z "${9:-}" ]]; then prompt="$scripts/prompts/oak-local-views.txt"; fi
if [[ ! -f "$prompt" ]]; then echo "Missing frozen asset prompt: $prompt" >&2; exit 1; fi
"$spatial_root/envs/mvadapter-py310/bin/python" "$scripts/local_reference.py" \
  --bundle "$bundle" --asset "$asset" --id "$reference_id" \
  --prompt "$prompt" --strength "${5:-.8}" --seed "${6:-42}"
if [[ "$mode" == multiview ]]; then
  bash "$scripts/run_local.sh" "$spatial_root" "$bundle" "$asset" "$run_id" "$reference_id" 1 "${7:-42}" "$prompt"
else
  "$spatial_root/envs/trellis2-py310/bin/python" "$scripts/pipeline.py" \
    --bundle "$bundle" --provider "$spatial_root/providers/TRELLIS.2" \
    --reference "$reference_id" --id "$run_id" --seed "${7:-42}"
fi
