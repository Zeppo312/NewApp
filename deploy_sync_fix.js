// Script zum Deployen der aktualisierten Sync-Funktionen für Supabase

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Stelle sicher, dass du deine eigenen Credentials hier einträgst
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('FEHLER: SUPABASE_URL und SUPABASE_SERVICE_KEY müssen als Umgebungsvariablen gesetzt sein.');
  console.log('Beispiel: SUPABASE_URL=https://abcdefg.supabase.co SUPABASE_SERVICE_KEY=eyJhbG.... node deploy_sync_fix.js');
  process.exit(1);
}

// Initialisiere Supabase-Client mit service_role key (volle Admin-Rechte)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function deployFunctions() {
  try {
    console.log('Starte Deployment der SQL-Funktionen für Schlaftracker-Synchronisierung...');

    // Lese den Inhalt der SQL-Dateien
    const oneWaySyncSQL = fs.readFileSync(path.join(__dirname, 'sql', 'sync_sleep_entries_one_way.sql'), 'utf8');
    
    // Führe die SQL-Befehle auf dem Supabase-Server aus
    console.log('Deploye one-way Synchronisierungsfunktion...');
    const { data: oneWayResult, error: oneWayError } = await supabase.rpc('exec_sql', {
      query: oneWaySyncSQL
    });

    if (oneWayError) {
      console.error('Fehler beim Deployen der one-way Synchronisierungsfunktion:', oneWayError);
    } else {
      console.log('One-way Synchronisierungsfunktion erfolgreich deployed!');
    }

    // Optional: Teste, ob die Funktionen verfügbar sind
    console.log('Prüfe, ob die Funktionen verfügbar sind...');
    const { data: testFuncs, error: testError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT proname, proowner::regrole, prosecdef
        FROM pg_proc
        WHERE proname LIKE 'sync_sleep_entries%';
      `
    });

    if (testError) {
      console.error('Fehler beim Testen der Funktionen:', testError);
    } else {
      console.log('Installierte Funktionen:');
      console.log(testFuncs?.rows || 'Keine Funktionen gefunden');
    }

    console.log('Deployment abgeschlossen!');
  } catch (error) {
    console.error('Unerwarteter Fehler beim Deployment:', error);
  }
}

deployFunctions();

/*
 * ANLEITUNG ZUM AUSFÜHREN DES SKRIPTS:
 * 
 * 1. Stelle sicher, dass du @supabase/supabase-js installiert hast:
 *    npm install @supabase/supabase-js
 * 
 * 2. Setze die Umgebungsvariablen für Supabase:
 *    SUPABASE_URL=https://deine-projekt-id.supabase.co
 *    SUPABASE_SERVICE_KEY=dein-service-key
 * 
 * 3. Führe das Skript aus:
 *    node deploy_sync_fix.js
 * 
 * HINWEIS: Dieses Skript benötigt exec_sql RPC-Funktion auf dem Supabase-Server.
 * Falls diese nicht verfügbar ist, musst du die SQL-Befehle manuell über die
 * Supabase SQL-Editor-Oberfläche ausführen.
 */ 