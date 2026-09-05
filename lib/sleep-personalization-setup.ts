/**
 * Sleep Personalization Database Setup
 *
 * Erstellt automatisch die sleep_personalization Tabelle beim ersten Start,
 * falls sie noch nicht existiert.
 */

import { supabase } from '@/lib/supabase';

let setupCompleted = false;

export async function ensureSleepPersonalizationTable(): Promise<boolean> {
  // Nur einmal pro App-Session ausführen
  if (setupCompleted) return true;

  try {
    // Prüfe ob Tabelle existiert, indem wir versuchen sie zu lesen
    const { error: checkError } = await supabase
      .from('sleep_personalization')
      .select('id')
      .limit(1);

    if (!checkError) {
      // Tabelle existiert bereits
      setupCompleted = true;
      return true;
    }

    // Tabelle existiert nicht - erstelle sie via SQL
    const { error: createError } = await supabase.rpc('create_sleep_personalization_table');

    if (createError) {
      // RPC existiert nicht - nutze Fallback
      console.warn('Sleep personalization table setup failed:', createError);
      console.warn('Please run the migration manually in Supabase Dashboard');
      console.warn('SQL script is in: supabase/migrations/20270123000000_create_sleep_personalization.sql');
      return false;
    }

    setupCompleted = true;
    return true;
  } catch (error) {
    console.error('Failed to ensure sleep personalization table:', error);
    return false;
  }
}
