param(
    [string]$DataRoot = 'D:/spatial-assets',
    [string]$Study = ('alternatives-' + (Get-Date -Format 'yyyyMMdd-HHmmss')),
    [string]$SpatialRoot = '/home/sox/spatial-assets'
)
$ErrorActionPreference = 'Stop'
if ($Study -notmatch '^[a-zA-Z0-9_-]+$') {throw 'Use a safe study ID'}
$root = (Resolve-Path $DataRoot).Path
$bundle = Join-Path $root $Study
if (Test-Path $bundle) {throw 'Use a fresh study ID; previous runs are immutable evidence'}
New-Item -ItemType Directory -Path "$bundle/logs" -Force > $null
$bundleLinux = (& wsl -e wslpath -a $bundle).Trim()
$rootLinux = (& wsl -e wslpath -a $root).Trim()
$scriptsLinux = (& wsl -e wslpath -a $PSScriptRoot).Trim()
$imagePython = "$SpatialRoot/envs/image-edit/bin/python"
$shapePython = "$SpatialRoot/envs/triposg/bin/python"
$diagnosticPython = "$SpatialRoot/envs/trellis2-py310/bin/python"
function Invoke-SpatialStep([string]$Name, [string[]]$Arguments, [switch]$Gpu) {
    Write-Output "Running $Name"
    $call = if ($Gpu) {@('flock',"$SpatialRoot/gpu073.lock") + $Arguments} else {$Arguments}
    & wsl -e @call *> "$bundle/logs/$Name.log"
    if ($LASTEXITCODE -ne 0) {throw "$Name failed; retained log: $bundle/logs/$Name.log"}
}
Invoke-SpatialStep 'freeze' @($diagnosticPython,"$scriptsLinux/prepare_alternatives.py",'--root',$rootLinux,'--study',$bundleLinux)
Invoke-SpatialStep 'setup' @('bash',"$scriptsLinux/setup_alternatives.sh",$SpatialRoot,$bundleLinux)
foreach ($model in @('flux','qwen','triposg')) {
    Invoke-SpatialStep "download-$model" @($imagePython,"$scriptsLinux/download_alternatives.py",'--study',$bundleLinux,'--model',$model)
}
foreach ($model in @('flux','qwen')) {
    Invoke-SpatialStep "edit-$model" @($imagePython,"$scriptsLinux/edit_alternatives.py",'--bundle',$bundleLinux,'--model',$model) -Gpu
}
Invoke-SpatialStep 'masks' @("$SpatialRoot/envs/mvadapter-py310/bin/python","$scriptsLinux/mask_alternatives.py",'--bundle',$bundleLinux)
Invoke-SpatialStep 'triposg-original' @($shapePython,"$scriptsLinux/triposg_alternatives.py",'--bundle',$bundleLinux,'--provider',"$SpatialRoot/providers/TripoSG",'--decoder','hierarchical') -Gpu
Invoke-SpatialStep 'fit-car' @($diagnosticPython,"$scriptsLinux/fit_car_alternative.py",'--bundle',$bundleLinux) -Gpu
$assets = @(Get-Content "$bundle/plan.json" -Raw | ConvertFrom-Json).assets
$references = @($assets | ForEach-Object {"flux-$_-s42-u2net"}) + @($assets | ForEach-Object {"qwen-$_-s42"})
Invoke-SpatialStep 'triposg-references' (@($shapePython,"$scriptsLinux/triposg_alternatives.py",'--bundle',$bundleLinux,'--provider',"$SpatialRoot/providers/TripoSG",'--decoder','hierarchical','--references') + $references) -Gpu
Invoke-SpatialStep 'shape-inspection-exports' @($diagnosticPython,"$scriptsLinux/simplify_shape_alternatives.py",'--bundle',$bundleLinux) -Gpu
& (Join-Path $PSScriptRoot 'run_alternative_meshes.ps1') -Bundle $bundle -SpatialRoot $SpatialRoot *> "$bundle/logs/mesh-runner.log"
& (Join-Path $PSScriptRoot 'run_alternative_masks.ps1') -Bundle $bundle -SpatialRoot $SpatialRoot *> "$bundle/logs/mask-probes.log"
foreach ($directory in Get-ChildItem "$bundle/runs/triposg-*" -Directory) {
    if (Test-Path "$($directory.FullName)/export-inspection/candidate.glb") {
        & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundle $directory.Name inspection export-inspection *> "$bundle/logs/$($directory.Name)-capture.log"
        if ($LASTEXITCODE -ne 0) {throw "Shape capture failed: $($directory.Name)"}
    }
}
& node (Join-Path $PSScriptRoot 'render_export.mjs') $bundle fitted-car-001 *> "$bundle/logs/fitted-car-capture.log"
if ($LASTEXITCODE -ne 0) {throw 'Fitted car capture failed'}
foreach ($texture in @(
    @{id='texture-fitted-car-qwen-uv2'; mesh='fitted-car-001/export/candidate.glb'; reference='qwen-compact-1-east-s42'; uv=$true},
    @{id='texture-triposg-oak-qwen'; mesh='triposg-oak-tree-qwen-oak-tree-s42-hierarchical/export-inspection/candidate.glb'; reference='qwen-oak-tree-s42'; uv=$false}
)) {
    $parameters = @($diagnosticPython,"$scriptsLinux/texture_shape_alternatives.py",'--bundle',$bundleLinux,'--provider',"$SpatialRoot/providers/TRELLIS.2",'--mesh',"$bundleLinux/runs/$($texture.mesh)",'--reference',$texture.reference,'--id',$texture.id)
    if ($texture.uv) {$parameters += '--preserve-uv'}
    Invoke-SpatialStep $texture.id $parameters -Gpu
    if (Test-Path "$bundle/runs/$($texture.id)/export/candidate.glb") {
        & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundle $texture.id *> "$bundle/logs/$($texture.id)-capture.log"
        if ($LASTEXITCODE -ne 0) {throw 'Textured shape capture failed'}
    }
}
Invoke-SpatialStep 'material-data' @($diagnosticPython,"$scriptsLinux/extract_alternative_materials.py",'--bundle',$bundleLinux)
Invoke-SpatialStep 'archive' @($diagnosticPython,"$scriptsLinux/archive_alternatives.py",'--bundle',$bundleLinux)
Invoke-SpatialStep 'report' @($diagnosticPython,"$scriptsLinux/alternatives_report.py",'--bundle',$bundleLinux)
& node (Join-Path $PSScriptRoot 'validate_alternatives.mjs') $bundle *> "$bundle/logs/validation.log"
if ($LASTEXITCODE -ne 0) {throw 'Artifact/report validation failed'}
Write-Output "Completed diagnostic study: $bundle/report/index.html"
