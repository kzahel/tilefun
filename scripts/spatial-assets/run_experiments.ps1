param(
    [Parameter(Mandatory = $true)][string]$Prefix,
    [string]$Bundle = (Join-Path $PSScriptRoot '../../data/spatial-assets/070'),
    [string]$SpatialRoot
)
$ErrorActionPreference = 'Stop'
# Fixed prompt/input/image seed; strength and mesh seed are the declared variables.
$cases = @(
    @{ Suffix = 'strength055'; Strength = 0.55; MeshSeed = 42 },
    @{ Suffix = 'strength08'; Strength = 0.8; MeshSeed = 42 },
    @{ Suffix = 'strength08-seed1'; Strength = 0.8; MeshSeed = 1 },
    @{ Suffix = 'strength095'; Strength = 0.95; MeshSeed = 42 }
)
foreach ($case in $cases) {
    $parameters = @{ Id = "$Prefix-$($case.Suffix)"; Bundle = $Bundle; Strength = $case.Strength; ImageSeed = 42; MeshSeed = $case.MeshSeed; Mode = 'direct' }
    if ($SpatialRoot) { $parameters.SpatialRoot = $SpatialRoot }
    & (Join-Path $PSScriptRoot 'run.ps1') @parameters
}
& (Join-Path $PSScriptRoot 'run.ps1') -Id "$Prefix-multiview" -Bundle $Bundle -SpatialRoot $SpatialRoot -Mode multiview
