param(
    [Parameter(Mandatory = $true)][int]$LauncherId,
    [Parameter(Mandatory = $true)][string]$DeadlineUtc,
    [Parameter(Mandatory = $true)][string]$SessionRoot
)
$ErrorActionPreference = 'Stop'
$taskDeadline = [DateTimeOffset]::Parse($DeadlineUtc)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WildlifeRunPower {
    [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
}
'@
# Bounded system wake request; display sleep stays available. Released on exit.
$taskPowerState = [WildlifeRunPower]::SetThreadExecutionState([uint32]2147483649)
@{ pid = $PID; launcherPid = $LauncherId; accepted = ($taskPowerState -ne 0);
    previousState = ('0x{0:X8}' -f $taskPowerState); startedUtc = [DateTimeOffset]::UtcNow.ToString('o') } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $SessionRoot 'power.json') -Encoding utf8
if ($taskPowerState -eq 0) { Write-Warning 'Windows did not accept the bounded system wake request; deadline monitoring remains active.' }
try {
    while (Get-Process -Id $LauncherId -ErrorAction SilentlyContinue) {
        if ([DateTimeOffset]::UtcNow -ge $taskDeadline) {
            $taskProcesses = @(Get-CimInstance Win32_Process)
            $taskOwned = [Collections.Generic.HashSet[int]]::new()
            [void]$taskOwned.Add($LauncherId)
            do {
                $taskAdded = $false
                foreach ($taskProcess in $taskProcesses) {
                    if ($taskOwned.Contains([int]$taskProcess.ParentProcessId) -and $taskOwned.Add([int]$taskProcess.ProcessId)) {
                        $taskAdded = $true
                    }
                }
            } while ($taskAdded)
            foreach ($taskId in $taskOwned) {
                if ($taskId -ne $LauncherId) { Stop-Process -Id $taskId -Force -ErrorAction SilentlyContinue }
            }
            Stop-Process -Id $LauncherId -Force -ErrorAction SilentlyContinue
            "Stopped run-owned process tree at deadline $($taskDeadline.ToString('o')); interrupted lock retained for inspection." |
                Set-Content -LiteralPath (Join-Path $SessionRoot 'DEADLINE-STOP.md') -Encoding utf8
            break
        }
        Start-Sleep -Seconds 10
    }
} finally { [WildlifeRunPower]::SetThreadExecutionState([uint32]2147483648) | Out-Null }
