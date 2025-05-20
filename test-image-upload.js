const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase Anmeldedaten
const supabaseUrl = 'https://kwniiyayhzgjfqjsjcfu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bmlpeWF5aHpnamZxanNqY2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NzEyNjIsImV4cCI6MjA1OTU0NzI2Mn0.h0CL1_SXhfp9BXSPy0ipprs57qSZ8A_26wh2hP-8vZk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Testdaten für den Login (deine Anmeldedaten für Supabase)
const TEST_EMAIL = 'DEINE_EMAIL@BEISPIEL.COM'; // Bitte echte Anmeldedaten eintragen
const TEST_PASSWORD = 'DEIN_PASSWORT'; // Bitte echtes Passwort eintragen

async function testImageUpload() {
  try {
    console.log('=== TEST IMAGE UPLOAD ===');
    console.log('1. Teste Buckets...');
    
    // Liste alle Buckets auf
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Fehler beim Auflisten der Buckets:', bucketsError);
      return;
    }
    
    console.log('Vorhandene Buckets:', buckets.map(b => b.name).join(', '));
    
    // Überprüfe, ob der community-images Bucket existiert
    const communityBucket = buckets.find(b => b.name === 'community-images');
    
    if (!communityBucket) {
      console.error('ERROR: Der community-images Bucket existiert nicht!');
      return;
    }
    
    console.log('community-images Bucket gefunden!');
    
    // 2. Login als Benutzer
    console.log('\n2. Logge mich ein...');
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (authError) {
      console.error('Fehler beim Einloggen:', authError);
      return;
    }
    
    console.log('Erfolgreich eingeloggt als:', authData.user.email);
    
    // 3. Erstelle ein Testbild
    console.log('\n3. Erstelle Testbild...');
    
    // Ein minimales Base64-Bild (1x1 Pixel rot)
    const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    
    // Extrahiere den Base64-Teil
    const base64Data = base64Image.split('base64,')[1];
    
    // Dateiname generieren
    const fileName = `test_image_${Date.now()}.png`;
    const filePath = `posts/${fileName}`;
    console.log('Dateiname:', fileName);
    
    // 4. Versuche das Bild hochzuladen
    console.log('\n4. Lade Bild hoch...');
    
    // Methode 1: mit Buffer
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      console.log('Buffer erstellt, Größe:', buffer.length);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('community-images')
        .upload(filePath, buffer, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (uploadError) {
        console.error('Fehler beim Hochladen (Methode 1):', uploadError);
      } else {
        console.log('Bild erfolgreich hochgeladen (Methode 1):', uploadData);
        
        // 5. Generiere öffentliche URL
        const { data: publicUrlData } = supabase.storage
          .from('community-images')
          .getPublicUrl(filePath);
        
        console.log('Öffentliche URL:', publicUrlData.publicUrl);
        
        // 6. Prüfe, ob das Bild abrufbar ist
        console.log('\n6. Prüfe, ob das Bild abrufbar ist...');
        console.log('Bitte rufe diese URL manuell im Browser auf:', publicUrlData.publicUrl);
      }
    } catch (err) {
      console.error('Unerwarteter Fehler bei Methode 1:', err);
    }
    
    // 7. Speichere das Bild in der Datenbank
    console.log('\n7. Speichere in der Datenbank...');
    
    // Erstelle einen Test-Post mit Bild-URL
    const testPost = {
      user_id: authData.user.id,
      content: 'Test-Post für Bild-Upload ' + new Date().toISOString(),
      type: 'text',
      is_anonymous: false,
      image_url: supabase.storage.from('community-images').getPublicUrl(filePath).data.publicUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Post-Daten:', testPost);
    
    // Füge den Post in die Datenbank ein
    const { data: postData, error: postError } = await supabase
      .from('community_posts')
      .insert(testPost)
      .select();
    
    if (postError) {
      console.error('Fehler beim Erstellen des Posts:', postError);
    } else {
      console.log('Post erfolgreich erstellt:', postData);
    }
    
    // 8. Überprüfe, ob der Post korrekt gespeichert wurde
    console.log('\n8. Überprüfe den Post...');
    
    const { data: checkData, error: checkError } = await supabase
      .from('community_posts')
      .select('*')
      .eq('id', postData[0].id)
      .single();
    
    if (checkError) {
      console.error('Fehler beim Überprüfen des Posts:', checkError);
    } else {
      console.log('Post in der Datenbank:', checkData);
      console.log('image_url im Post:', checkData.image_url);
    }
    
  } catch (err) {
    console.error('Allgemeiner Fehler:', err);
  }
}

testImageUpload(); 