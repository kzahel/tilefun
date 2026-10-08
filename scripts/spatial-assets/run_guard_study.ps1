param(
    [string]$Bundle = 'D:/spatial-assets/075',
    [string]$SourceBundle = 'D:/spatial-assets/073',
    [string]$MaskBundle = 'D:/spatial-assets/074',
    [string]$SpatialRoot = '/home/sox/spatial-assets',
    [ValidateSet('All','Props','Trees','Textures','Report')][string]$Phase = 'All',
    [string]$TextureSelection,
    [switch]$SkipPrepare
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path "$Bundle/logs" -Force > $null
$bundlePath = (Resolve-Path $Bundle).Path
$bundleLinux = (& wsl -e wslpath -a $bundlePath).Trim()
$scriptsLinux = (& wsl -e wslpath -a $PSScriptRoot).Trim()
$workflowSha = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
New-Item -ItemType Directory -Path "$bundlePath/implementation/workflows" -Force > $null
Copy-Item -LiteralPath $PSCommandPath -Destination "$bundlePath/implementation/workflows/$workflowSha.ps1" -Force
function Invoke-StudyStep([string]$Name, [string[]]$Arguments, [switch]$Gpu) {
    $call = if ($Gpu) {@('flock',"$SpatialRoot/gpu073.lock") + $Arguments} else {$Arguments}
    & wsl -e @call *> "$bundlePath/logs/$Name.log"
    if ($LASTEXITCODE -ne 0) {throw "$Name failed; see $bundlePath/logs"}
}
if (-not $SkipPrepare -and $Phase -in @('All','Props')) {
    $sourceLinux = (& wsl -e wslpath -a (Resolve-Path $SourceBundle).Path).Trim()
    $maskLinux = (& wsl -e wslpath -a (Resolve-Path $MaskBundle).Path).Trim()
    Invoke-StudyStep 'prepare' @("$SpatialRoot/envs/sam2/bin/python","$scriptsLinux/prepare_guard_study.py",'--source',$sourceLinux,'--masks',$maskLinux,'--bundle',$bundleLinux)
}
if ($Phase -in @('All','Props')) {
    $references = @(Get-Content "$bundlePath/mask-execution.json" -Raw | ConvertFrom-Json)
    foreach ($ref in $references) {
        $run = "trellis-$($ref.id)"
        if (Test-Path "$bundlePath/runs/$run/run.json") {throw "Run exists: $run; retain it and use a fresh bundle"}
        Invoke-StudyStep $run @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/pipeline.py",'--bundle',$bundleLinux,'--provider',"$SpatialRoot/providers/TRELLIS.2",'--reference',$ref.id,'--id',$run,'--seed','42') -Gpu
        if (Test-Path "$bundlePath/runs/$run/export/candidate.glb") {
            & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundlePath $run *> "$bundlePath/logs/$run-capture.log"
            if ($LASTEXITCODE -ne 0) {throw 'Capture failed'}
        }
        Invoke-StudyStep "$run-sheet" @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/stage_sheet.py",'--bundle',$bundleLinux,'--run',$run,'--asset',$ref.asset)
        Write-Output "$run completed"
    }
    Invoke-StudyStep 'triposg-props' (@("$SpatialRoot/envs/triposg/bin/python","$scriptsLinux/triposg_alternatives.py",'--bundle',$bundleLinux,'--provider',"$SpatialRoot/providers/TripoSG",'--decoder','hierarchical','--references') + @($references | ForEach-Object {$_.id})) -Gpu
}
if ($Phase -in @('All','Trees')) {
    Invoke-StudyStep 'tree-framing' @("$SpatialRoot/envs/triposg/bin/python","$scriptsLinux/prepare_tree_framing.py",'--bundle',$bundleLinux,'--provider',"$SpatialRoot/providers/TripoSG") -Gpu
    Invoke-StudyStep 'triposg-trees' @("$SpatialRoot/envs/triposg/bin/python","$scriptsLinux/triposg_alternatives.py",'--bundle',$bundleLinux,'--provider',"$SpatialRoot/providers/TripoSG",'--decoder','hierarchical','--jobs',"$bundleLinux/tree-jobs.json") -Gpu
}
if ($Phase -eq 'Textures' -or ($Phase -eq 'All' -and $TextureSelection)) {
    if (-not $TextureSelection) {throw 'Textures phase requires a concrete recorded TextureSelection file'}
    $selection = Get-Content $TextureSelection -Raw | ConvertFrom-Json
    if (-not (Test-Path "$bundlePath/texture-selection.json")) {
        Copy-Item -LiteralPath $TextureSelection -Destination "$bundlePath/texture-selection.json"
    }
    foreach ($case in $selection.cases) {
        if ((Get-FileHash -LiteralPath "$bundlePath/$($case.mesh)" -Algorithm SHA256).Hash.ToLowerInvariant() -ne $case.meshSha256) {throw 'Selected shape changed'}
        $refRecord = Get-Content "$bundlePath/references/$($case.reference)/reference.json" -Raw | ConvertFrom-Json
        if ($refRecord.sha256 -ne $case.referenceSha256) {throw 'Selected texture reference changed'}
        $mesh = (& wsl -e wslpath -a (Resolve-Path "$bundlePath/$($case.mesh)").Path).Trim()
        Invoke-StudyStep $case.id @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/texture_shape_alternatives.py",'--bundle',$bundleLinux,'--provider',"$SpatialRoot/providers/TRELLIS.2",'--mesh',$mesh,'--reference',$case.reference,'--id',$case.id) -Gpu
        $record = Get-Content "$bundlePath/runs/$($case.id)/run.json" -Raw | ConvertFrom-Json
        if ($record.status -eq 'succeeded') {
            & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundlePath $case.id *> "$bundlePath/logs/$($case.id)-capture.log"
            if ($LASTEXITCODE -ne 0) {throw 'Texture capture failed'}
            Invoke-StudyStep "$($case.id)-sheet" @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/stage_sheet.py",'--bundle',$bundleLinux,'--run',$case.id,'--asset','oak-tree')
        }
        Write-Output "$($case.id) $($record.status)"
    }
}
if ($Phase -in @('All','Props','Trees')) {
    Invoke-StudyStep 'shape-exports' @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/simplify_shape_alternatives.py",'--bundle',$bundleLinux) -Gpu
    foreach ($directory in Get-ChildItem "$bundlePath/runs/triposg-*" -Directory) {
        if ((Test-Path "$($directory.FullName)/export-inspection/candidate.glb") -and -not (Test-Path "$($directory.FullName)/export-inspection/inspection/inspection.json")) {
            & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundlePath $directory.Name inspection export-inspection *> "$bundlePath/logs/$($directory.Name)-capture.log"
            if ($LASTEXITCODE -ne 0) {throw 'Tripo capture failed'}
        }
        if (-not (Test-Path "$bundlePath/stage-sheets/$($directory.Name)/stages/sheet.json")) {
            Invoke-StudyStep "$($directory.Name)-sheet" @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/stage_sheet.py",'--bundle',$bundleLinux,'--run',$directory.Name)
        }
    }
}
if ($Phase -in @('All','Report')) {
    foreach ($directory in Get-ChildItem "$bundlePath/runs" -Directory) {
        $record = Get-Content "$($directory.FullName)/run.json" -Raw | ConvertFrom-Json
        if ($record.status -eq 'succeeded' -and -not (Test-Path "$bundlePath/stage-sheets/$($directory.Name)/stages/sheet.json")) {
            Invoke-StudyStep "$($directory.Name)-sheet" @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/stage_sheet.py",'--bundle',$bundleLinux,'--run',$directory.Name)
        }
    }
    Invoke-StudyStep 'materials' @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/extract_alternative_materials.py",'--bundle',$bundleLinux)
    Invoke-StudyStep 'backgrounds' @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/analyze_mask_backgrounds.py",'--bundle',$bundleLinux)
    Invoke-StudyStep 'guard-analysis' @("$SpatialRoot/envs/sam2/bin/python","$scriptsLinux/analyze_guard_study.py",'--bundle',$bundleLinux)
    Invoke-StudyStep 'archive' @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/archive_alternatives.py",'--bundle',$bundleLinux)
    Invoke-StudyStep 'report' @("$SpatialRoot/envs/trellis2-py310/bin/python","$scriptsLinux/guard_study_report.py",'--bundle',$bundleLinux)
    & node (Join-Path $PSScriptRoot 'validate_alternatives.mjs') $bundlePath *> "$bundlePath/logs/validation.log"
    if ($LASTEXITCODE -ne 0) {throw 'Report validation failed'}
}
