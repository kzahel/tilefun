param(
    [Parameter(Mandatory=$true)][string]$Bundle,
    [string]$Study = 'fidelity-001',
    [string]$Id = 'direct-001',
    [string]$SpatialRoot = '/home/sox/spatial-assets'
)
$ErrorActionPreference = 'Stop'
foreach ($value in @($Study,$Id)) {
    if ($value -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Use safe fresh IDs' }
}
$bundlePath = (Resolve-Path $Bundle).Path
$studyPath = Join-Path $bundlePath "conditioning-studies/$Study"
$plan = Get-Content (Join-Path $studyPath 'plan.json') -Raw | ConvertFrom-Json
if ((Get-FileHash (Join-Path $bundlePath 'inputs.json')).Hash.ToLowerInvariant() -ne $plan.inputManifestSha256) { throw 'Source manifest changed' }
$directory = Join-Path $studyPath $Id
New-Item -ItemType Directory -Path $directory -ErrorAction Stop > $null
$bundleLinux = (& wsl -e wslpath -a $bundlePath).Trim()
$pipelineLinux = (& wsl -e wslpath -a (Join-Path $PSScriptRoot 'pipeline.py')).Trim()
$sheetLinux = (& wsl -e wslpath -a (Join-Path $PSScriptRoot 'stage_sheet.py')).Trim()
$execution = @{ id=$Id; study=$Study; inputManifestSha256=$plan.inputManifestSha256; mode='direct'; seed=42; status='running'; review='Unreviewed diagnostic comparison; no promotion'; cases=@() }
foreach ($asset in @('shed','compact-1-east')) {
    foreach ($strength in @(0.65,0.8)) {
        $case = @($plan.cases | Where-Object { $_.asset -eq $asset -and $_.strength -eq $strength })
        if ($case.Count -ne 1) { throw 'Missing or ambiguous matched reference' }
        $run = "$Study-$Id-$asset-s$([int][math]::Round($strength*100))"
        $item = @{asset=$asset; strength=$strength; reference=$case[0].reference; run=$run; status='running'}
        $execution.cases += $item
        $execution | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $directory 'execution.json') -Encoding utf8
        try {
            Write-Output "Direct TRELLIS: $asset strength $strength"
            & wsl -e "$SpatialRoot/envs/trellis2-py310/bin/python" $pipelineLinux --bundle $bundleLinux --provider "$SpatialRoot/providers/TRELLIS.2" --reference $item.reference --id $run --seed 42 *> (Join-Path $directory "$run.log")
            if ($LASTEXITCODE -ne 0) { throw 'TRELLIS pipeline failed; inspect retained log' }
            $record = Get-Content (Join-Path $bundlePath "pipelines/$run/pipeline.json") -Raw | ConvertFrom-Json
            $item.pipelineStatus=$record.status
            if (Test-Path (Join-Path $bundlePath "runs/$run/export/candidate.glb")) {
                & node (Join-Path $PSScriptRoot 'render_export.mjs') $bundlePath $run *> (Join-Path $directory "$run-capture.log")
                if ($LASTEXITCODE -ne 0) { throw 'Export capture failed' }
            }
            & wsl -e "$SpatialRoot/envs/trellis2-py310/bin/python" $sheetLinux --bundle $bundleLinux --run $run --asset $asset *> (Join-Path $directory "$run-sheet.log")
            if ($LASTEXITCODE -ne 0) { throw 'Stage sheet failed' }
            $item.status='completed-diagnostics'
        } catch { $item.status='failed'; $item.failure=$_.Exception.Message; Write-Output "Retained failure: $($item.failure)" }
        $execution | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $directory 'execution.json') -Encoding utf8
    }
}
$execution.status = if (@($execution.cases | Where-Object status -eq 'failed').Count) {'completed-with-failures'} else {'completed-diagnostics'}
$execution | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $directory 'execution.json') -Encoding utf8
Write-Output $directory
