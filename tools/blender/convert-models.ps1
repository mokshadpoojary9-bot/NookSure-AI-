# Batch-convert selected downloaded .blend assets to web-ready .glb files.
# One Blender process per model keeps memory low. Originals are never modified.
#
#   powershell -ExecutionPolicy Bypass -File tools\blender\convert-models.ps1 [-Blender <path>] [-Downloads <path>] [-MaxPx 1024]
param(
  [string]$Blender = "",
  [string]$Downloads = (Join-Path $env:USERPROFILE "Downloads"),
  [string]$OutDir = (Join-Path $PSScriptRoot "..\..\frontend\public\models"),
  [int]$MaxPx = 1024,
  [string[]]$Only = @()
)

# asset folder name (under Downloads)  ->  output file name
$Models = [ordered]@{
  "ArmChair_01_4k.blend"            = "armchair.glb"
  "dining_table_4k.blend"           = "dining-table.glb"
  "side_table_01_4k.blend"          = "side-table.glb"
  "modern_wooden_cabinet_4k.blend"  = "cabinet.glb"
}

if (-not $Blender) {
  $Blender = Get-ChildItem "C:\Program Files\Blender Foundation" -Filter blender.exe -Recurse -Depth 2 -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $Blender -or -not (Test-Path $Blender)) { throw "blender.exe not found; pass -Blender <path>" }
$script = Join-Path $PSScriptRoot "convert_to_glb.py"
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
New-Item -ItemType Directory -Force $OutDir | Out-Null

foreach ($folder in $Models.Keys) {
  $out = $Models[$folder]
  if ($Only.Count -and -not ($Only -contains $out)) { continue }
  $blend = Get-ChildItem (Join-Path $Downloads $folder) -Filter *.blend -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $blend) { Write-Warning "SKIP $folder - no .blend found"; continue }
  $target = Join-Path $OutDir $out
  Write-Host "== $($blend.Name) -> $out"
  $log = & $Blender -b --factory-startup $blend.FullName --python $script -- $target $MaxPx 2>&1
  $line = $log | Where-Object { "$_" -like "NOOKSURE_RESULT *" } | Select-Object -Last 1
  if ($line) { Write-Host ("$line" -replace "^NOOKSURE_RESULT ", "") } else { Write-Warning "FAILED $folder"; $log | Select-Object -Last 15 | ForEach-Object { Write-Host "   $_" } }
}
