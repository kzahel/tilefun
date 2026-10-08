param([string]$Bundle='D:/spatial-assets/074', [string]$SpatialRoot='/home/sox/spatial-assets', [string[]]$Modes=@('native-clean','native-hard'), [string]$LedgerFile='seed-probe-execution.json')
$ErrorActionPreference='Stop'
$bundlePath=(Resolve-Path $Bundle).Path
$bundleLinux=(& wsl -e wslpath -a $bundlePath).Trim()
$scriptsLinux=(& wsl -e wslpath -a $PSScriptRoot).Trim()
$ledger=@{status='running'; seed=43; cases=@(); rationale='Repeat matched car native-clean versus native-hard result at a second mesh seed'}
foreach($mode in $Modes) {
    $reference="mask-compact-1-east-$mode"
    $run="trellis-$reference-s43"
    $item=@{id=$run; reference=$reference; status='started'}
    $ledger.cases+=$item
    $ledger | ConvertTo-Json -Depth 6 | Set-Content "$bundlePath/$LedgerFile" -Encoding utf8
    & wsl -e flock "$SpatialRoot/gpu073.lock" "$SpatialRoot/envs/trellis2-py310/bin/python" "$scriptsLinux/pipeline.py" --bundle $bundleLinux --provider "$SpatialRoot/providers/TRELLIS.2" --reference $reference --id $run --seed 43 *> "$bundlePath/logs/$run.log"
    if($LASTEXITCODE -ne 0){throw "Seed probe failed: $run"}
    if(Test-Path "$bundlePath/runs/$run/export/candidate.glb") {
        & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundlePath $run *> "$bundlePath/logs/$run-capture.log"
        if($LASTEXITCODE -ne 0){throw 'Seed capture failed'}
    }
    & wsl -e "$SpatialRoot/envs/trellis2-py310/bin/python" "$scriptsLinux/stage_sheet.py" --bundle $bundleLinux --run $run --asset compact-1-east *> "$bundlePath/logs/$run-sheet.log"
    if($LASTEXITCODE -ne 0){throw 'Seed stage sheet failed'}
    $item.status=(Get-Content "$bundlePath/pipelines/$run/pipeline.json" -Raw | ConvertFrom-Json).status
    $ledger | ConvertTo-Json -Depth 6 | Set-Content "$bundlePath/$LedgerFile" -Encoding utf8
    Write-Output "$run $($item.status)"
}
$ledger.status='completed-diagnostics'
$ledger | ConvertTo-Json -Depth 6 | Set-Content "$bundlePath/$LedgerFile" -Encoding utf8
