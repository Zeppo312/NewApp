const { createClient } = require('@supabase/supabase-js');

// Supabase-Konfiguration
const supabaseUrl = 'https://kwniiyayhzgjfqjsjcfu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bmlpeWF5aHpnamZxanNqY2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NzEyNjIsImV4cCI6MjA1OTU0NzI2Mn0.h0CL1_SXhfp9BXSPy0ipprs57qSZ8A_26wh2hP-8vZk';

// Erstellen des Supabase-Clients
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkBuckets() {
  try {
    // Buckets auflisten
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error);
      return;
    }
    
    console.log('Available buckets:');
    console.log(buckets);
    
    // Prüfen, ob der diary-photos Bucket existiert
    const diaryBucket = buckets.find(bucket => bucket.name === 'diary-photos');
    
    if (diaryBucket) {
      console.log('\nDiary photos bucket exists!');
      console.log('Bucket details:', diaryBucket);
      
      // Versuchen, die Bucket-Einstellungen zu überprüfen
      const { data: bucketPublic, error: publicError } = await supabase.storage.getBucket('diary-photos');
      
      if (publicError) {
        console.error('Error getting bucket details:', publicError);
      } else {
        console.log('\nBucket public access:', bucketPublic.public);
      }
    } else {
      console.log('\nDiary photos bucket does not exist!');
      
      // Bucket erstellen
      console.log('Creating diary-photos bucket...');
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('diary-photos', {
        public: true
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
      } else {
        console.log('Bucket created successfully:', newBucket);
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkBuckets();
