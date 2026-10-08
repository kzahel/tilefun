param(
    [Parameter(Mandatory = $true)][string]$Bundle,
    [string]$Prefix = 'current',
    [string]$Id = 'ten-current-assets-001',
    [string]$SpatialRoot,
    [hashtable]$PreservedRuns = @{}
)
$ErrorActionPreference = 'Stop'
if ($Prefix -notmatch '^[a-zA-Z0-9_-]+$' -or $Id -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Use safe fresh batch IDs' }
$bundlePath = (Resolve-Path $Bundle).Path
$manifest = Get-Content (Join-Path $bundlePath 'inputs.json') -Raw | ConvertFrom-Json
$selection = Get-Content (Join-Path $bundlePath 'selection.json') -Raw | ConvertFrom-Json
$batchDir = Join-Path $bundlePath "batches/$Id"
if (Test-Path -LiteralPath $batchDir) { throw 'Batch already exists; use a fresh ID' }
New-Item -ItemType Directory -Path $batchDir > $null
if (-not $SpatialRoot) { $SpatialRoot = (& wsl -e bash -c 'printf "%s/spatial-assets" "$HOME"').Trim() }
$bundleLinux = (& wsl -e wslpath -a $bundlePath).Trim()
$sheetLinux = (& wsl -e wslpath -a (Join-Path $PSScriptRoot 'stage_sheet.py')).Trim()
$reportLinux = (& wsl -e wslpath -a (Join-Path $PSScriptRoot 'batch_report.py')).Trim()
$correctionsPath = Join-Path $bundlePath 'prompts/observed-corrections.json'
$corrections = if (Test-Path $correctionsPath) { Get-Content $correctionsPath -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
$record = @{ id = $Id; status = 'running'; startedUtc = [DateTime]::UtcNow.ToString('o');
    inputManifestSha256 = (Get-FileHash (Join-Path $bundlePath 'inputs.json') -Algorithm SHA256).Hash.ToLowerInvariant();
    settings = $selection.settings; review = 'Unreviewed offline diagnostics; no promotion'; assets = @() }
function Save-Batch { $record | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $batchDir 'batch.json') -Encoding utf8 }
Save-Batch
foreach ($asset in $selection.assets) {
    $runId = if ($PreservedRuns.ContainsKey($asset.id)) { $PreservedRuns[$asset.id] } else { "$Prefix-$($asset.id)-001" }
    if ($runId -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Use a safe single run ID for preserved pilots' }
    $item = @{ asset = $asset.id; label = $asset.label; run = $runId; status = 'running'; startedUtc = [DateTime]::UtcNow.ToString('o') }
    $promptArgs = @{}
    if ($corrections.ContainsKey($asset.id)) {
        $chosen = $corrections[$asset.id]
        $promptPath = Join-Path $bundlePath $chosen.file
        if ((Get-FileHash $promptPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $chosen.sha256) { throw 'Corrected prompt hash mismatch' }
        $promptArgs.Prompt = $promptPath
        $item.promptCorrection = $chosen
    }
    $record.assets += $item
    Save-Batch
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $pipelinePath = Join-Path $bundlePath "pipelines/$runId/pipeline.json"
    $sheetPath = Join-Path $bundlePath "stage-sheets/$runId/stages/sheet.json"
    try {
        if (Test-Path -LiteralPath $pipelinePath) {
            $pipeline = Get-Content $pipelinePath -Raw | ConvertFrom-Json
            $run = Get-Content (Join-Path $bundlePath "runs/$runId/run.json") -Raw | ConvertFrom-Json
            if ($pipeline.status -notmatch '^(completed-diagnostics|stopped-)' -or $run.input.manifestSha256 -ne $record.inputManifestSha256 -or -not (Test-Path -LiteralPath $sheetPath)) {
                throw 'Existing run is incomplete or belongs to another manifest; use a fresh prefix'
            }
            $item.status = $pipeline.status
            $item.execution = 'Previously completed pilot in this frozen batch, preserved'
        } else {
            Write-Output "Generating $($asset.label) ($($record.assets.Count)/$($selection.assets.Count))"
            & (Join-Path $PSScriptRoot 'run.ps1') -Id $runId -Asset $asset.id -Bundle $bundlePath -SpatialRoot $SpatialRoot @promptArgs `
                -Strength $selection.settings.strength -ImageSeed $selection.settings.imageSeed -MeshSeed $selection.settings.meshSeed -Mode $selection.settings.mode `
                *> (Join-Path $batchDir "$($asset.id).log")
            $pipeline = Get-Content $pipelinePath -Raw | ConvertFrom-Json
            $item.status = $pipeline.status
            $item.execution = 'Generated locally in this batch'
        }
    } catch {
        $item.status = 'failed'
        $item.failure = $_.Exception.Message
        Write-Output "Retained failure for $($asset.label): $($item.failure)"
        if (-not (Test-Path -LiteralPath $sheetPath)) {
            & wsl -e "$SpatialRoot/envs/trellis2-py310/bin/python" $sheetLinux --bundle $bundleLinux --run $runId --asset $asset.id `
                *> (Join-Path $batchDir "$($asset.id)-partial-sheet.log")
        }
    } finally {
        $timer.Stop()
        $item.batchObservedSeconds = $timer.Elapsed.TotalSeconds
        $item.finishedUtc = [DateTime]::UtcNow.ToString('o')
        Save-Batch
    }
}
$record.status = if (@($record.assets | Where-Object { $_.status -eq 'failed' }).Count) { 'completed-with-computational-failures' } else { 'completed-diagnostics' }
$record.finishedUtc = [DateTime]::UtcNow.ToString('o')
Save-Batch
& wsl -e "$SpatialRoot/envs/trellis2-py310/bin/python" $reportLinux --bundle $bundleLinux --batch $Id
if ($LASTEXITCODE -ne 0) { throw 'Batch report failed; execution ledger and per-asset sheets are retained' }
Write-Output (Join-Path $batchDir 'report/index.html')
