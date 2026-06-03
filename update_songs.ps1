$musicFolder = Join-Path $PSScriptRoot "music"
$outputFile  = Join-Path $PSScriptRoot "songs.json"

$audioExtensions = @(".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".wma")

if (-not (Test-Path $musicFolder)) {
    Write-Error "music/ folder not found at: $musicFolder"
    exit 1
}

$songs = @(Get-ChildItem -Path $musicFolder -File |
    Where-Object { $audioExtensions -contains $_.Extension.ToLower() } |
    Sort-Object Name |
    ForEach-Object {
        [PSCustomObject]@{
            filename = $_.Name
            path     = "music/" + [Uri]::EscapeDataString($_.Name)
            cover    = "default_cover.png"
        }
    })

$json = $songs | ConvertTo-Json -Depth 2
Set-Content -Path $outputFile -Value $json -Encoding UTF8

Write-Host "Generated songs.json with $($songs.Count) songs -> $outputFile"
