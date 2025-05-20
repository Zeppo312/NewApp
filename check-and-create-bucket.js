const { createClient } = require('@supabase/supabase-js');

// Deine Supabase-Anmeldedaten aus lib/supabase.ts
const supabaseUrl = 'https://kwniiyayhzgjfqjsjcfu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bmlpeWF5aHpnamZxanNqY2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NzEyNjIsImV4cCI6MjA1OTU0NzI2Mn0.h0CL1_SXhfp9BXSPy0ipprs57qSZ8A_26wh2hP-8vZk';

// Erstelle den Supabase-Client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAndCreateBucket() {
  try {
    // Buckets auflisten
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Fehler beim Auflisten der Buckets:', error);
      return;
    }
    
    console.log('Vorhandene Buckets:');
    console.log(buckets);
    
    // Prüfen, ob der community-images Bucket existiert
    const communityBucket = buckets.find(bucket => bucket.name === 'community-images');
    
    if (communityBucket) {
      console.log('\nCommunity-Images Bucket existiert bereits!');
      console.log('Bucket-Details:', communityBucket);
      
      // Versuche die Bucket-Einstellungen zu überprüfen
      const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('community-images');
      
      if (bucketError) {
        console.error('Fehler beim Abrufen der Bucket-Details:', bucketError);
      } else {
        console.log('\nBucket öffentlicher Zugriff:', bucketData.public);
        
        // Wenn der Bucket nicht öffentlich ist, setze ihn auf öffentlich
        if (!bucketData.public) {
          console.log('Setze Bucket auf öffentlich...');
          const { data: updateData, error: updateError } = await supabase.storage.updateBucket('community-images', {
            public: true
          });
          
          if (updateError) {
            console.error('Fehler beim Aktualisieren des Buckets:', updateError);
          } else {
            console.log('Bucket erfolgreich auf öffentlich gesetzt!');
          }
        }
      }
    } else {
      console.log('\nCommunity-Images Bucket existiert nicht!');
      
      // Bucket erstellen
      console.log('Erstelle community-images Bucket...');
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('community-images', {
        public: true
      });
      
      if (createError) {
        console.error('Fehler beim Erstellen des Buckets:', createError);
      } else {
        console.log('Bucket erfolgreich erstellt:', newBucket);
      }
    }
  } catch (err) {
    console.error('Unerwarteter Fehler:', err);
  }
}

checkAndCreateBucket(); 