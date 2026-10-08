param(
    [string]$Bundle = 'D:/spatial-assets/074',
    [string]$SpatialRoot = '/home/sox/spatial-assets',
    [switch]$SkipPrepare,
    [string]$ReferencesFile = 'mask-execution.json',
    [switch]$SkipSeedProbes,
    [string]$SourceBundle = 'D:/spatial-assets/073'
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path "$Bundle/logs" -Force > $null
$bundlePath = (Resolve-Path $Bundle).Path
$bundleLinux = (& wsl -e wslpath -a $bundlePath).Trim()
$sourceLinux = (& wsl -e wslpath -a (Resolve-Path $SourceBundle).Path).Trim()
$scriptsLinux = (& wsl -e wslpath -a $PSScriptRoot).Trim()
function Invoke-MaskStep([string]$Name, [string[]]$Arguments, [switch]$Gpu) {
    $call = if ($Gpu) {@('flock',"$SpatialRoot/gpu073.lock") + $Arguments} else {$Arguments}
    & wsl -e @call *> "$bundlePath/logs/$Name.log"
    if ($LASTEXITCODE -ne 0) {throw "$Name failed; log retained in $bundlePath/logs"}
}
if (-not $SkipPrepare) {
    Invoke-MaskStep 'sam-setup' @('bash',"$scriptsLinux/setup_mask_study.sh",$SpatialRoot,$bundleLinux)
    Invoke-MaskStep 'prepare-masks' @("$SpatialRoot/envs/sam2/bin/python","$scriptsLinux/prepare_mask_study.py",'--source',$sourceLinux,'--bundle',$bundleLinux,'--provider',"$SpatialRoot/providers/sam2") -Gpu
    Invoke-MaskStep 'sam-point-probe' @("$SpatialRoot/envs/sam2/bin/python","$scriptsLinux/refine_mask_study.py",'--bundle',$bundleLinux) -Gpu
    Invoke-MaskStep 'alpha-floor-probe' @("$SpatialRoot/envs/sam2/bin/python","$scriptsLinux/register_alpha_floor.py",'--bundle',$bundleLinux)
}
$references = @(Get-Content "$bundlePath/$ReferencesFile" -Raw | ConvertFrom-Json)
if ($ReferencesFile -eq 'mask-execution.json' -and (Test-Path "$bundlePath/point-mask-execution.json")) {
    $references += @(Get-Content "$bundlePath/point-mask-execution.json" -Raw | ConvertFrom-Json)
}
if ($ReferencesFile -eq 'mask-execution.json' -and (Test-Path "$bundlePath/floor-mask-execution.json")) {
    $references += @(Get-Content "$bundlePath/floor-mask-execution.json" -Raw | ConvertFrom-Json)
}
$ledgerFile = if ($ReferencesFile -eq 'mask-execution.json') {'mesh-execution.json'} else {"mesh-$([System.IO.Path]::GetFileNameWithoutExtension($ReferencesFile)).json"}
$ledger = @{status='running'; cases=@(); review='Unreviewed matched mask/model experiments'}
foreach ($reference in $references) {
    $run = "trellis-$($reference.id)"
    $item = @{id=$run; reference=$reference.id; asset=$reference.asset; status='started'}
    $ledger.cases += $item
    $ledger | ConvertTo-Json -Depth 8 | Set-Content "$bundlePath/$ledgerFile" -Encoding utf8
    try {
        if (Test-Path "$bundlePath/runs/$run/run.json") {throw 'Run already exists; use fresh study or inspect retained failure'}
        Invoke-MaskStep $run @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/pipeline.py",'--bundle',$bundleLinux,'--provider',"$SpatialRoot/providers/TRELLIS.2",'--reference',$reference.id,'--id',$run,'--seed','42') -Gpu
        if (Test-Path "$bundlePath/runs/$run/export/candidate.glb") {
            & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundlePath $run *> "$bundlePath/logs/$run-capture.log"
            if ($LASTEXITCODE -ne 0) {throw 'GLB capture failed'}
        }
        Invoke-MaskStep "$run-sheet" @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/stage_sheet.py",'--bundle',$bundleLinux,'--run',$run,'--asset',$reference.asset)
        $item.status=(Get-Content "$bundlePath/pipelines/$run/pipeline.json" -Raw | ConvertFrom-Json).status
    } catch {$item.status='failed'; $item.failure=$_.Exception.Message}
    $ledger | ConvertTo-Json -Depth 8 | Set-Content "$bundlePath/$ledgerFile" -Encoding utf8
    Write-Output "$run $($item.status)"
}
Invoke-MaskStep 'triposg-matched' (@("$SpatialRoot/envs/triposg/bin/python","$scriptsLinux/triposg_alternatives.py",'--bundle',$bundleLinux,'--provider',"$SpatialRoot/providers/TripoSG",'--decoder','hierarchical','--references') + @($references | ForEach-Object {$_.id})) -Gpu
Invoke-MaskStep 'shape-exports' @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/simplify_shape_alternatives.py",'--bundle',$bundleLinux) -Gpu
foreach ($directory in Get-ChildItem "$bundlePath/runs/triposg-*" -Directory) {
    if ((Test-Path "$($directory.FullName)/export-inspection/candidate.glb") -and -not (Test-Path "$($directory.FullName)/export-inspection/inspection/inspection.json")) {
        & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundlePath $directory.Name inspection export-inspection *> "$bundlePath/logs/$($directory.Name)-capture.log"
        if ($LASTEXITCODE -ne 0) {throw 'TripoSG capture failed'}
    }
}
$ledger.status=if (@($ledger.cases | Where-Object status -eq 'failed').Count) {'completed-with-retained-failures'} else {'completed-diagnostics'}
$ledger | ConvertTo-Json -Depth 8 | Set-Content "$bundlePath/$ledgerFile" -Encoding utf8
if ($ReferencesFile -eq 'mask-execution.json' -and -not $SkipSeedProbes) {
    & (Join-Path $PSScriptRoot 'run_mask_seed_probe.ps1') -Bundle $bundlePath -SpatialRoot $SpatialRoot
    & (Join-Path $PSScriptRoot 'run_mask_seed_probe.ps1') -Bundle $bundlePath -SpatialRoot $SpatialRoot -Modes native-floor32 -LedgerFile floor-seed-execution.json
}
Invoke-MaskStep 'material-data' @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/extract_alternative_materials.py",'--bundle',$bundleLinux)
Invoke-MaskStep 'background-analysis' @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/analyze_mask_backgrounds.py",'--bundle',$bundleLinux)
Invoke-MaskStep 'archive' @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/archive_alternatives.py",'--bundle',$bundleLinux)
Invoke-MaskStep 'report' @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/mask_study_report.py",'--bundle',$bundleLinux)
& node (Join-Path $PSScriptRoot 'validate_alternatives.mjs') $bundlePath *> "$bundlePath/logs/validation.log"
if ($LASTEXITCODE -ne 0) {throw 'Artifact/report validation failed'}
Write-Output "Completed matched study: $bundlePath/report/index.html"
