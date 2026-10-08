param(
    [Parameter(Mandatory=$true)][string]$Bundle,
    [string]$SpatialRoot = '/home/sox/spatial-assets'
)
$ErrorActionPreference = 'Stop'
$bundlePath = (Resolve-Path $Bundle).Path
$bundleLinux = (& wsl -e wslpath -a $bundlePath).Trim()
$scriptsLinux = (& wsl -e wslpath -a $PSScriptRoot).Trim()
foreach ($asset in @('compact-1-east','oak-tree')) {
    $run = "trellis-qwen-$asset-u2net-probe"
    & wsl -e flock "$SpatialRoot/gpu073.lock" "$SpatialRoot/envs/trellis2-py310/bin/python" "$scriptsLinux/pipeline.py" --bundle $bundleLinux --provider "$SpatialRoot/providers/TRELLIS.2" --reference "qwen-$asset-s42-u2net" --id $run --seed 42 *> "$bundlePath/logs/$run.log"
    if ($LASTEXITCODE -ne 0) {throw "Mask probe failed: $run"}
    if (Test-Path "$bundlePath/runs/$run/export/candidate.glb") {
        & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundlePath $run *> "$bundlePath/logs/$run-capture.log"
        if ($LASTEXITCODE -ne 0) {throw "Mask probe capture failed: $run"}
    }
    & wsl -e "$SpatialRoot/envs/trellis2-py310/bin/python" "$scriptsLinux/stage_sheet.py" --bundle $bundleLinux --run $run --asset $asset *> "$bundlePath/logs/$run-sheet.log"
    if ($LASTEXITCODE -ne 0) {throw "Mask probe stage sheet failed: $run"}
}
