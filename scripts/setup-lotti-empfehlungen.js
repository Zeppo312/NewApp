/**
 * Setup-Script für Lottis Empfehlungen Feature
 * Führt die Datenbank-Migration aus
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase Credentials aus Umgebungsvariablen
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service Role Key benötigt!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Fehler: EXPO_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein!');
  console.log('\nSetze die Umgebungsvariablen:');
  console.log('export EXPO_PUBLIC_SUPABASE_URL="deine-supabase-url"');
  console.log('export SUPABASE_SERVICE_ROLE_KEY="dein-service-role-key"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starte Setup für Lottis Empfehlungen...\n');

  try {
    // Lese die Migration
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260603000000_create_lotti_recommendations.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Führe Datenbank-Migration aus...');
    
    // Führe die Migration aus
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      // Falls exec_sql nicht verfügbar ist, versuche direkt mit dem SQL
      console.log('⚠️  exec_sql nicht verfügbar, verwende direkten SQL-Import...');
      console.log('\n📝 Bitte führe die Migration manuell im Supabase Dashboard aus:');
      console.log('   1. Gehe zum Supabase Dashboard -> SQL Editor');
      console.log('   2. Kopiere den Inhalt von: supabase/migrations/20260603000000_create_lotti_recommendations.sql');
      console.log('   3. Füge ihn ein und führe ihn aus\n');
      
      // Zeige den SQL Code an
      console.log('--- SQL CODE (START) ---');
      console.log(migrationSQL);
      console.log('--- SQL CODE (ENDE) ---\n');
    } else {
      console.log('✅ Migration erfolgreich ausgeführt!\n');
    }

    // Prüfe, ob die Tabelle existiert
    console.log('🔍 Prüfe Tabellen...');
    const { data: tables, error: tableError } = await supabase
      .from('lotti_recommendations')
      .select('count')
      .limit(0);

    if (tableError) {
      console.log('⚠️  Tabelle noch nicht sichtbar. Bitte führe die Migration manuell aus.');
    } else {
      console.log('✅ Tabelle lotti_recommendations existiert!\n');
    }

    console.log('📋 Nächste Schritte:');
    console.log('   1. Setze einen User als Admin:');
    console.log('      - Gehe zum Supabase Dashboard -> Table Editor -> profiles');
    console.log('      - Finde deinen User und setze is_admin auf true\n');
    console.log('   2. Starte die App und gehe zu "Mehr" -> "Lottis Empfehlungen"');
    console.log('   3. Als Admin kannst du jetzt Empfehlungen hinzufügen!\n');

  } catch (error) {
    console.error('❌ Fehler beim Setup:', error);
    process.exit(1);
  }
}

// Admin-User setzen
async function setUserAsAdmin(userEmail) {
  try {
    console.log(`👤 Setze User ${userEmail} als Admin...`);
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('email', userEmail)
      .select();

    if (error) throw error;

    if (profile && profile.length > 0) {
      console.log('✅ User ist jetzt Admin!');
    } else {
      console.log('⚠️  User nicht gefunden. Bitte E-Mail überprüfen.');
    }
  } catch (error) {
    console.error('❌ Fehler beim Setzen des Admin-Status:', error);
  }
}

// Main
(async () => {
  await runMigration();
  
  // Optional: Setze einen User als Admin
  const adminEmail = process.argv[2];
  if (adminEmail) {
    console.log('\n');
    await setUserAsAdmin(adminEmail);
  }
})();

