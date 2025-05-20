# setup-database.ps1 - Führt die SQL-Migrationen aus

# Supabase-CLI sollte installiert sein (npm install -g supabase)

Write-Host "Führe SQL-Migrationen aus..." -ForegroundColor Cyan

# Prüfe, ob die Datei existiert
$migrationFile = "supabase/migrations/20250506000000_create_nested_comments.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "Migrationsdatei $migrationFile nicht gefunden!" -ForegroundColor Red
    exit 1
}

# Führe die Migration aus
try {
    # Mit Supabase CLI
    Write-Host "Führe Migration mit Supabase CLI aus..." -ForegroundColor Yellow
    supabase db push
    
    if ($LASTEXITCODE -ne 0) {
        throw "Supabase CLI Fehler: Exit-Code $LASTEXITCODE"
    }
    
    Write-Host "Migration erfolgreich!" -ForegroundColor Green
} 
catch {
    Write-Host "Fehler beim Ausführen der Migration: $_" -ForegroundColor Red
    
    # Alternative: Dateiinhalt anzeigen, damit der Benutzer SQL manuell ausführen kann
    Write-Host "`nAlternativ kannst du folgendes SQL manuell in der Supabase SQL Editor ausführen:" -ForegroundColor Yellow
    Get-Content $migrationFile | Write-Host
    
    exit 1
}

Write-Host "`nDatenbank wurde aktualisiert. Verschachtelte Kommentare werden nun unterstützt." -ForegroundColor Green 