#!/usr/bin/env bash
set -euo pipefail
# All generation and diagnostics run locally; only initial checkpoint fetching uses the network.
spatial_root=${1:?Usage: run_local.sh EXTERNAL_ROOT BUNDLE ASSET FRESH_ID [REGISTERED_REFERENCE] [REFERENCE_SCALE]}
bundle=${2:?}
asset=${3:?}
run_id=${4:?}
scripts=$(cd "$(dirname "$0")" && pwd)
prompt=${8:-"$bundle/prompts/$asset.txt"}
if [[ "$asset" == oak-tree && -z "${8:-}" ]]; then prompt="$scripts/prompts/oak-local-views.txt"; fi
if [[ ! -f "$prompt" ]]; then echo "Missing frozen asset prompt: $prompt" >&2; exit 1; fi
reference_args=()
if [[ -n "${5:-}" ]]; then
  reference_args=(--reference "$5")
fi
"$spatial_root/envs/mvadapter-py310/bin/python" "$scripts/local_views.py" \
  --bundle "$bundle" --provider "$spatial_root/providers/MV-Adapter" \
  --asset "$asset" --id "$run_id" --prompt "$prompt" \
  --reference-scale "${6:-1}" \
  "${reference_args[@]}"
"$spatial_root/envs/trellis2-py310/bin/python" "$scripts/reference.py" --bundle "$bundle" \
  from-views --views "$run_id" --angle 0 --id "$run_id-reference"
"$spatial_root/envs/trellis2-py310/bin/python" "$scripts/pipeline.py" \
  --bundle "$bundle" --provider "$spatial_root/providers/TRELLIS.2" \
  --reference "$run_id-reference" --id "$run_id" --seed "${7:-42}"
