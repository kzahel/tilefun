param(
    [Parameter(Mandatory = $true)][string]$Id,
    [string]$Asset = 'oak-tree',
    [string]$Bundle = (Join-Path $PSScriptRoot '../../data/spatial-assets/070'),
    [string]$SpatialRoot,
    [ValidateSet('direct', 'multiview')][string]$Mode = 'multiview',
    [double]$Strength = 0.8,
    [int]$ImageSeed = 42,
    [int]$MeshSeed = 42,
    [string]$Prompt
)
$ErrorActionPreference = 'Stop'
if ($Id -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Use a single safe fresh ID' }
if ($Asset -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Use a single safe asset ID' }
$bundlePath = (Resolve-Path $Bundle).Path
$bundleLinux = (& wsl -e wslpath -a $bundlePath).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot map bundle to WSL' }
$runnerLinux = (& wsl -e wslpath -a (Join-Path $PSScriptRoot 'run_img2img.sh')).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot map runner to WSL' }
& wsl -e bash -n $runnerLinux
if ($LASTEXITCODE -ne 0) { throw 'Invalid shell launcher; check LF line endings before generating' }
if (-not $SpatialRoot) {
    $SpatialRoot = (& wsl -e bash -c 'printf "%s/spatial-assets" "$HOME"').Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot determine external WSL root' }
}
$promptLinux = if ($Prompt) { (& wsl -e wslpath -a (Resolve-Path $Prompt).Path).Trim() } else { "" }
& wsl -e bash $runnerLinux $SpatialRoot $bundleLinux $Asset $Id ($Strength.ToString([cultureinfo]::InvariantCulture)) $ImageSeed $MeshSeed $Mode $promptLinux
if ($LASTEXITCODE -ne 0) { throw 'Local generation pipeline failed; inspect saved stage records' }
$glb = Join-Path $bundlePath "runs/$Id/export/candidate.glb"
if (-not (Test-Path -LiteralPath $glb)) {
    Write-Output "Geometry screen stopped the candidate. Inspect runs/$Id/inspection and pipelines/$Id/pipeline.json."
} else {
    & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundlePath $Id
    if ($LASTEXITCODE -ne 0) { throw 'Mesh capture failed; the GLB and pipeline records are preserved' }
}
$sheetLinux = (& wsl -e wslpath -a (Join-Path $PSScriptRoot 'stage_sheet.py')).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot map stage-sheet generator to WSL' }
& wsl -e "$SpatialRoot/envs/trellis2-py310/bin/python" $sheetLinux --bundle $bundleLinux --run $Id --asset $Asset
if ($LASTEXITCODE -ne 0) { throw 'Stage sheet generation failed; stage outputs are preserved' }
$reportLinux = (& wsl -e wslpath -a (Join-Path $PSScriptRoot 'report.py')).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot map report generator to WSL' }
& wsl -e "$SpatialRoot/envs/trellis2-py310/bin/python" $reportLinux --bundle $bundleLinux --id $Id
if ($LASTEXITCODE -ne 0) { throw 'Report generation failed; all stage records are preserved' }
Write-Output (Join-Path $bundlePath "reports/$Id/index.html")
