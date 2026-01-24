/**
 * Diagnose-Script für Supabase Storage Bucket
 * Prüft, ob der public-images Bucket existiert und richtig konfiguriert ist
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase Credentials aus Umgebungsvariablen
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Fehler: EXPO_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein!');
  console.log('\nSetze die Umgebungsvariablen:');
  console.log('export EXPO_PUBLIC_SUPABASE_URL="deine-supabase-url"');
  console.log('export SUPABASE_SERVICE_ROLE_KEY="dein-service-role-key"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStorageBucket() {
  console.log('🔍 Prüfe Supabase Storage Setup...\n');

  try {
    // 1. Liste alle Buckets
    console.log('📦 Prüfe Buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Fehler beim Abrufen der Buckets:', bucketsError);
      return;
    }

    console.log(`✅ Gefundene Buckets: ${buckets.length}`);
    buckets.forEach(bucket => {
      console.log(`   - ${bucket.name} (${bucket.public ? 'öffentlich' : 'privat'})`);
    });

    // 2. Prüfe ob public-images existiert
    const publicImagesBucket = buckets.find(b => b.name === 'public-images');
    
    if (!publicImagesBucket) {
      console.log('\n❌ Der "public-images" Bucket existiert NICHT!');
      console.log('\n📝 So erstellst du ihn:');
      console.log('   1. Gehe zum Supabase Dashboard → Storage');
      console.log('   2. Klicke auf "New bucket"');
      console.log('   3. Name: public-images');
      console.log('   4. Public bucket: ✅ JA');
      console.log('   5. Oder führe die Migration aus: supabase/migrations/20260604000000_create_storage_bucket.sql');
      return;
    }

    console.log('\n✅ "public-images" Bucket existiert!');
    console.log(`   - Öffentlich: ${publicImagesBucket.public ? '✅ Ja' : '❌ Nein'}`);
    console.log(`   - ID: ${publicImagesBucket.id}`);

    if (!publicImagesBucket.public) {
      console.log('\n⚠️  WARNUNG: Der Bucket ist NICHT öffentlich!');
      console.log('   Bilder können nicht ohne Authentifizierung abgerufen werden.');
      console.log('   Mache den Bucket öffentlich im Supabase Dashboard.');
    }

    // 3. Prüfe Policies
    console.log('\n🔐 Prüfe Storage Policies...');
    const { data: policies, error: policiesError } = await supabase.rpc('get_storage_policies');
    
    // Hinweis: Diese RPC-Funktion existiert möglicherweise nicht standardmäßig
    // Daher überspringen wir diesen Schritt bei Fehler
    if (policiesError) {
      console.log('   ℹ️  Policy-Check übersprungen (RPC-Funktion nicht verfügbar)');
    } else {
      console.log('   ✅ Policies gefunden');
    }

    // 4. Test-Upload versuchen
    console.log('\n📤 Teste Upload-Berechtigung...');
    const testFileName = `test-${Date.now()}.txt`;
    const testFilePath = `test/${testFileName}`;
    const testContent = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('public-images')
      .upload(testFilePath, testContent, {
        contentType: 'text/plain',
      });

    if (uploadError) {
      console.error('❌ Test-Upload fehlgeschlagen:', uploadError.message);
      console.log('\n   Mögliche Ursachen:');
      console.log('   - Fehlende Upload-Policy');
      console.log('   - Falsche Berechtigungen');
      console.log('   - Führe die Migration aus: supabase/migrations/20260604000000_create_storage_bucket.sql');
    } else {
      console.log('✅ Test-Upload erfolgreich!');
      
      // Test-Datei wieder löschen
      const { error: deleteError } = await supabase.storage
        .from('public-images')
        .remove([testFilePath]);
      
      if (deleteError) {
        console.log('⚠️  Test-Datei konnte nicht gelöscht werden');
      } else {
        console.log('✅ Test-Datei erfolgreich gelöscht');
      }
    }

    // 5. Zusammenfassung
    console.log('\n📋 Zusammenfassung:');
    if (publicImagesBucket && publicImagesBucket.public && !uploadError) {
      console.log('✅ Storage ist korrekt konfiguriert!');
      console.log('   Du kannst jetzt Bilder hochladen.');
    } else {
      console.log('⚠️  Storage benötigt noch Konfiguration');
      console.log('   Siehe Hinweise oben.');
    }

  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error);
  }
}

// Main
(async () => {
  await checkStorageBucket();
})();


