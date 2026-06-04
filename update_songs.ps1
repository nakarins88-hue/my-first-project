$musicFolder = Join-Path $PSScriptRoot "music"
$outputFile  = Join-Path $PSScriptRoot "songs.json"

$audioExtensions = @(".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".wma")

if (-not (Test-Path $musicFolder)) {
    Write-Error "music/ folder not found at: $musicFolder"
    exit 1
}

# --- Read real media duration via Windows Shell (fixes the M4A double-duration bug) ---
$shell = New-Object -ComObject Shell.Application
$shellFolder = $shell.Namespace($musicFolder)

# Find the "Length" column index (works on Thai/English Windows; usually 27)
$lengthCol = -1
for ($i = 0; $i -lt 350; $i++) {
    $colName = $shellFolder.GetDetailsOf($null, $i)
    if ($colName -eq 'Length' -or $colName -eq 'ความยาว') { $lengthCol = $i; break }
}
if ($lengthCol -lt 0) { $lengthCol = 27 }  # sensible fallback

function Get-DurationSeconds($folder, $item, $col) {
    if ($null -eq $item -or $col -lt 0) { return $null }
    $raw = $folder.GetDetailsOf($item, $col)
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    # Strip hidden unicode marks (e.g. U+200E), keep only digits and colons
    $clean = ($raw -replace '[^\d:]', '')
    if ($clean -notmatch ':') { return $null }
    $parts = $clean.Split(':')
    [int]$h = 0; [int]$m = 0; [int]$s = 0
    if ($parts.Count -eq 3) { $h = [int]$parts[0]; $m = [int]$parts[1]; $s = [int]$parts[2] }
    elseif ($parts.Count -eq 2) { $m = [int]$parts[0]; $s = [int]$parts[1] }
    else { return $null }
    $total = $h * 3600 + $m * 60 + $s
    if ($total -le 0) { return $null }
    return $total
}

$songs = @(Get-ChildItem -Path $musicFolder -File |
    Where-Object { $audioExtensions -contains $_.Extension.ToLower() } |
    Sort-Object Name |
    ForEach-Object {
        $item = $shellFolder.ParseName($_.Name)
        $dur  = Get-DurationSeconds $shellFolder $item $lengthCol
        [PSCustomObject]@{
            filename = $_.Name
            path     = "music/" + [Uri]::EscapeDataString($_.Name)
            cover    = "default_cover.png"
            duration = $dur
        }
    })

$json = $songs | ConvertTo-Json -Depth 2
Set-Content -Path $outputFile -Value $json -Encoding UTF8

$withDur = ($songs | Where-Object { $null -ne $_.duration }).Count
Write-Host "Generated songs.json with $($songs.Count) songs ($withDur with duration, Length column = $lengthCol) -> $outputFile"

# ============================================================================
#  Auto-upload to GitHub so the live website updates (run this ONE file, done)
# ============================================================================
Write-Host ""
Write-Host "Uploading to GitHub..."

Push-Location $PSScriptRoot
try {
    git add . | Out-Null
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        $stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
        git commit -m "Update songs ($($songs.Count) total) - $stamp" | Out-Null
        git push
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "DONE! Songs uploaded. The website updates in about 1 minute." -ForegroundColor Green
            Write-Host "Open the site and refresh (Ctrl+Shift+R) to see new songs."
        } else {
            Write-Host ""
            Write-Host "Push FAILED. Check your internet / GitHub login and try again." -ForegroundColor Red
        }
    } else {
        Write-Host "No changes to upload - the website is already up to date." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Git step failed: $_" -ForegroundColor Red
} finally {
    Pop-Location
}
