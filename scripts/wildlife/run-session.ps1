param(
    [Parameter(Mandatory = $true)][string]$Brief,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9-]+$')][string]$Name,
    [ValidateRange(0.1, 48)][double]$Hours = 1,
    [string]$DeadlineUtc,
    [string]$ReferenceImage,
    [switch]$Background
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$taskRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$taskRunRoot = Join-Path $taskRoot 'data/wildlife-campaign-v2'
$taskBriefPath = (Resolve-Path -LiteralPath $Brief).Path
$taskBasePath = Join-Path $taskRoot 'docs/tactical/029-wildlife-production.prompt.md'
if ($DeadlineUtc -and $PSBoundParameters.ContainsKey('Hours')) {
    throw 'Supply DeadlineUtc or Hours, not both.'
}
if ($DeadlineUtc) {
    if ($DeadlineUtc -notmatch '^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$') {
        throw 'DeadlineUtc must be an ISO timestamp with Z or an explicit UTC offset.'
    }
    $taskDeadline = [DateTimeOffset]::Parse($DeadlineUtc, [Globalization.CultureInfo]::InvariantCulture).ToUniversalTime()
} else {
    $taskDeadline = [DateTimeOffset]::UtcNow.AddHours($Hours)
}
if ($taskDeadline -le [DateTimeOffset]::UtcNow) { throw 'Deadline must be in the future.' }
New-Item -ItemType Directory -Path $taskRunRoot -Force | Out-Null
$taskSessionRoot = Join-Path $taskRunRoot $Name
if (Test-Path -LiteralPath $taskSessionRoot) { throw "Session identity already exists: $Name" }
New-Item -ItemType Directory -Path $taskSessionRoot | Out-Null

if ($Background) {
    & node (Join-Path $PSScriptRoot 'campaign.mjs') --assert-gate
    if ($LASTEXITCODE -ne 0) { throw 'Supervised pilot gate did not pass; background launch refused.' }
    # Separate PowerShell preserves a foreground CLI child and its normal rollout.
    $taskArguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath,
        '-Brief', $taskBriefPath, '-Name', "$Name-worker", '-DeadlineUtc', $taskDeadline.ToString('o'))
    $taskLauncher = Start-Process -FilePath 'powershell.exe' -ArgumentList $taskArguments -WindowStyle Hidden -PassThru `
        -WorkingDirectory $taskRoot -RedirectStandardOutput (Join-Path $taskSessionRoot 'launcher.stdout.log') `
        -RedirectStandardError (Join-Path $taskSessionRoot 'launcher.stderr.log')
    $taskWatchdog = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -PassThru `
        -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'watchdog.ps1'),
            '-LauncherId', $taskLauncher.Id, '-DeadlineUtc', $taskDeadline.ToString('o'), '-SessionRoot', $taskSessionRoot) `
        -WorkingDirectory $taskRoot -RedirectStandardOutput (Join-Path $taskSessionRoot 'watchdog.stdout.log') `
        -RedirectStandardError (Join-Path $taskSessionRoot 'watchdog.stderr.log')
    @{ name = $Name; launcherPid = $taskLauncher.Id; model = 'gpt-6.1-sol'; effort = 'high';
        watchdogPid = $taskWatchdog.Id; deadlineUtc = $taskDeadline.ToString('o');
        startedUtc = [DateTimeOffset]::UtcNow.ToString('o'); worker = "$Name-worker"; status = 'starting' } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskSessionRoot 'launch.json') -Encoding utf8
    Write-Output "Background launcher PID $($taskLauncher.Id); logs $taskSessionRoot"
    return
}

$taskLockPath = Join-Path $taskRunRoot 'run.lock'
$taskLock = [IO.File]::Open($taskLockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
$taskWriterExited = $false
try {
    $taskStarted = [DateTimeOffset]::UtcNow
    $taskPrompt = (Get-Content -LiteralPath $taskBasePath -Raw) + "`nSESSION ASSIGNMENT:`n" +
        (Get-Content -LiteralPath $taskBriefPath -Raw) + "`nSession identity: $Name. Session artifacts directory: $taskSessionRoot. Launcher PID: $PID." +
        "`nStart UTC: $($taskStarted.ToString('o')). Deadline UTC: $($taskDeadline.ToString('o'))."
    $taskPrompt | Set-Content -LiteralPath (Join-Path $taskSessionRoot 'prompt.md') -Encoding utf8
    @{ name = $Name; launcherPid = $PID; model = 'gpt-6.1-sol'; effort = 'high';
        startedUtc = $taskStarted.ToString('o'); deadlineUtc = $taskDeadline.ToString('o'); status = 'running' } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskSessionRoot 'launch.json') -Encoding utf8
    $taskActivePath = Join-Path $taskRunRoot 'active-session.json'
    @{ name = $Name; launcherPid = $PID; model = 'gpt-6.1-sol'; effort = 'high';
        startedUtc = $taskStarted.ToString('o'); deadlineUtc = $taskDeadline.ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath "$taskActivePath.$PID.tmp" -Encoding utf8
    Move-Item -LiteralPath "$taskActivePath.$PID.tmp" -Destination $taskActivePath -Force
    $taskBytes = [Text.Encoding]::UTF8.GetBytes("$PID $Name $($taskStarted.ToString('o'))")
    $taskLock.Write($taskBytes, 0, $taskBytes.Length)
    $taskLock.Flush()
    if (-not $Name.EndsWith('-worker')) {
        $taskWatchdog = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -PassThru `
            -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'watchdog.ps1'),
                '-LauncherId', $PID, '-DeadlineUtc', $taskDeadline.ToString('o'), '-SessionRoot', $taskSessionRoot) `
            -WorkingDirectory $taskRoot -RedirectStandardOutput (Join-Path $taskSessionRoot 'watchdog.stdout.log') `
            -RedirectStandardError (Join-Path $taskSessionRoot 'watchdog.stderr.log')
        @{ pid = $taskWatchdog.Id; launcherPid = $PID; deadlineUtc = $taskDeadline.ToString('o') } |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskSessionRoot 'watchdog.json') -Encoding utf8
    }
    $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $taskRoot 'data/wildlife-tools/browsers'
    $env:BLENDER_BIN = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
    Set-Location -LiteralPath $taskRoot
    $taskImageArguments = @()
    if ($ReferenceImage) { $taskImageArguments = @('--image', (Resolve-Path -LiteralPath $ReferenceImage).Path) }
    # Explicit request settings override inherited user defaults; do not edit config.
    $taskPrompt | & (Get-Command codex -ErrorAction Stop).Source exec -C $taskRoot -s workspace-write `
        -m gpt-6.1-sol -c 'model_reasoning_effort="high"' @taskImageArguments --json `
        -o (Join-Path $taskSessionRoot 'final.md') - |
        ForEach-Object {
            $_ | Out-File -LiteralPath (Join-Path $taskSessionRoot 'events.jsonl') -Encoding utf8 -Append
            Write-Output $_
        }
    $taskExit = $LASTEXITCODE
    $taskWriterExited = $true
    @{ name = $Name; launcherPid = $PID; model = 'gpt-6.1-sol'; effort = 'high';
        startedUtc = $taskStarted.ToString('o'); deadlineUtc = $taskDeadline.ToString('o');
        endedUtc = [DateTimeOffset]::UtcNow.ToString('o'); exitCode = $taskExit; status = 'exited' } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskSessionRoot 'launch.json') -Encoding utf8
    if ($taskExit -ne 0) { throw "Codex exit $taskExit; inspect $taskSessionRoot" }
} finally {
    $taskLock.Dispose()
    if ($taskWriterExited) { Remove-Item -LiteralPath $taskLockPath }
    else { Write-Warning 'Interrupted writer lock retained; inspect processes before recovery.' }
}
