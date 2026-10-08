param(
    [Parameter(Mandatory=$true)][string]$Bundle,
    [string]$Id = 'fidelity-001',
    [string]$SpatialRoot = '/home/sox/spatial-assets'
)
$ErrorActionPreference = 'Stop'
if ($Id -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Use a fresh safe study ID' }
$bundlePath = (Resolve-Path $Bundle).Path
$directory = Join-Path $bundlePath "conditioning-studies/$Id"
if (Test-Path $directory) { throw 'Study exists; use a fresh ID' }
New-Item -ItemType Directory -Path $directory > $null
$bundleLinux = (& wsl -e wslpath -a $bundlePath).Trim()
$scriptLinux = (& wsl -e wslpath -a (Join-Path $PSScriptRoot 'local_reference.py')).Trim()
$reportLinux = (& wsl -e wslpath -a (Join-Path $PSScriptRoot 'fidelity_report.py')).Trim()
$assets = @('shed','tent-blue','compact-1-east')
$plan = @{ id=$Id; inputManifestSha256=(Get-FileHash (Join-Path $bundlePath 'inputs.json')).Hash.ToLowerInvariant();
    review='Unreviewed local fidelity ablation; no promotion'; seed=42; steps=50; guidanceScale=5; cases=@() }
foreach ($asset in $assets) {
    $baseline = "current2-$asset-001-img2img-reference"
    foreach ($strength in @(0.35,0.55,0.65,0.8)) {
        $tag = [int][math]::Round($strength*100)
        $reference = if ($strength -eq 0.8) { $baseline } else { "$Id-$asset-s$tag" }
        $plan.cases += @{ asset=$asset; strength=$strength; reference=$reference; reused=($strength -eq 0.8) }
    }
}
$plan | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $directory 'plan.json') -Encoding utf8
$execution = @{status='running'; startedUtc=[DateTime]::UtcNow.ToString('o'); cases=@()}
foreach ($case in $plan.cases) {
    $item = @{asset=$case.asset; reference=$case.reference; strength=$case.strength; status='running'}
    $execution.cases += $item
    try {
        if ($case.reused) {
            $record = Get-Content (Join-Path $bundlePath "references/$($case.reference)/generation.json") -Raw | ConvertFrom-Json
            if ($record.status -ne 'registered' -or $record.inputManifestSha256 -ne $plan.inputManifestSha256) { throw 'Baseline source mismatch' }
            $item.status='preserved-baseline'
        } else {
            Write-Output "Generating $($case.asset), strength $($case.strength)"
            $promptLinux = "$bundleLinux/prompts/$($case.asset).txt"
            & wsl -e "$SpatialRoot/envs/mvadapter-py310/bin/python" $scriptLinux --bundle $bundleLinux --asset $case.asset --id $case.reference --prompt $promptLinux --strength ($case.strength.ToString([cultureinfo]::InvariantCulture)) --seed 42 *> (Join-Path $directory "$($case.reference).log")
            if ($LASTEXITCODE -ne 0) { throw 'Saved-image generation failed; inspect retained log' }
            $item.status='registered'
        }
    } catch { $item.status='failed'; $item.failure=$_.Exception.Message; Write-Output "Retained failure: $($item.failure)" }
    $execution | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $directory 'execution.json') -Encoding utf8
}
$execution.status = if (@($execution.cases | Where-Object status -eq 'failed').Count) {'completed-with-failures'} else {'completed-diagnostics'}
$execution.finishedUtc=[DateTime]::UtcNow.ToString('o')
$execution | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $directory 'execution.json') -Encoding utf8
& wsl -e "$SpatialRoot/envs/trellis2-py310/bin/python" $reportLinux --bundle $bundleLinux --study $Id
if ($LASTEXITCODE -ne 0) { throw 'Fidelity report failed; all references remain preserved' }
