param(
    [Parameter(Mandatory=$true)][string]$Bundle,
    [string]$SpatialRoot = '/home/sox/spatial-assets'
)
$ErrorActionPreference = 'Stop'
$bundlePath = (Resolve-Path $Bundle).Path
$bundleLinux = (& wsl -e wslpath -a $bundlePath).Trim()
$scriptsLinux = (& wsl -e wslpath -a $PSScriptRoot).Trim()
$plan = Get-Content (Join-Path $bundlePath 'plan.json') -Raw | ConvertFrom-Json
$execution = @{status='running'; seed=42; mode='direct'; review='Unreviewed diagnostic runs, including design-drift negative cases'; cases=@()}
foreach ($model in @('flux','qwen')) {
    # Qwen may still be sampling. Wait for its saved generation ledger, never infer success from a timeout.
    $ledger = Join-Path $bundlePath "edit-$model.json"
    while ($true) {
        if (Test-Path $ledger) {
            $items = @(Get-Content $ledger -Raw | ConvertFrom-Json)
            if ($items.Count -eq $plan.assets.Count * $plan.imageSeeds.Count) { break }
        }
        Start-Sleep -Seconds 3
    }
    & wsl -e "$SpatialRoot/envs/mvadapter-py310/bin/python" "$scriptsLinux/mask_alternatives.py" --bundle $bundleLinux *> (Join-Path $bundlePath "logs/mask-$model.log")
    if ($LASTEXITCODE -ne 0) { throw 'Mask generation failed; inspect retained log' }
    foreach ($asset in $plan.assets) {
        $reference = "$model-$asset-s42-u2net"
        if ($model -eq 'qwen' -and (Test-Path (Join-Path $bundlePath "references/qwen-$asset-s42/reference.json"))) { $reference="qwen-$asset-s42" }
        $run = "trellis-$reference"
        $item = @{asset=$asset; model=$model; reference=$reference; run=$run; status='started'}
        $execution.cases += $item
        $execution | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $bundlePath 'mesh-execution.json') -Encoding utf8
        try {
            & wsl -e flock "$SpatialRoot/gpu073.lock" "$SpatialRoot/envs/trellis2-py310/bin/python" "$scriptsLinux/pipeline.py" --bundle $bundleLinux --provider "$SpatialRoot/providers/TRELLIS.2" --reference $reference --id $run --seed 42 *> (Join-Path $bundlePath "logs/$run.log")
            if ($LASTEXITCODE -ne 0) { throw 'TRELLIS pipeline failed; inspect retained log' }
            $item.pipelineStatus = (Get-Content (Join-Path $bundlePath "pipelines/$run/pipeline.json") -Raw | ConvertFrom-Json).status
            if (Test-Path (Join-Path $bundlePath "runs/$run/export/candidate.glb")) {
                & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundlePath $run *> (Join-Path $bundlePath "logs/$run-capture.log")
                if ($LASTEXITCODE -ne 0) { throw 'Export capture failed' }
            }
            & wsl -e "$SpatialRoot/envs/trellis2-py310/bin/python" "$scriptsLinux/stage_sheet.py" --bundle $bundleLinux --run $run --asset $asset *> (Join-Path $bundlePath "logs/$run-sheet.log")
            if ($LASTEXITCODE -ne 0) { throw 'Stage sheet failed' }
            $item.status='completed-diagnostics'
        } catch { $item.status='failed'; $item.failure=$_.Exception.Message }
        $execution | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $bundlePath 'mesh-execution.json') -Encoding utf8
        Write-Output "$run $($item.status)"
    }
}
$execution.status = if (@($execution.cases | Where-Object status -eq 'failed').Count) {'completed-with-failures'} else {'completed-diagnostics'}
$execution | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $bundlePath 'mesh-execution.json') -Encoding utf8
