import { supabase } from '@/lib/supabase';

// Typdefinitionen
export interface FaqCategory {
  id: string;
  name: string;
  icon: string;
}

export interface FaqEntry {
  id: string;
  category_id: string;
  question: string;
  answer: string;
  order_number: number;
  category?: string; // Für die Anzeige des Kategorienamens (wird clientseitig hinzugefügt)
}

// Funktion zum Abrufen aller Kategorien
export const getFaqCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('faq_categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching FAQ categories:', error);
    return { data: null, error };
  }
};

// Funktion zum Abrufen aller FAQ-Einträge
export const getFaqEntries = async () => {
  try {
    // Abrufen aller FAQ-Einträge
    const { data: entries, error } = await supabase
      .from('faq_entries')
      .select(`
        id,
        category_id,
        question,
        answer,
        order_number,
        faq_categories(name)
      `)
      .order('order_number');

    if (error) throw error;

    // Kategorienamen zu den Einträgen hinzufügen
    const entriesWithCategories = entries.map(entry => ({
      ...entry,
      category: entry.faq_categories?.name || ''
    }));

    return { data: entriesWithCategories, error: null };
  } catch (error) {
    console.error('Error fetching FAQ entries:', error);
    return { data: null, error };
  }
};

// Funktion zum Abrufen von FAQ-Einträgen nach Kategorie
export const getFaqEntriesByCategory = async (categoryId: string) => {
  try {
    // Abrufen der FAQ-Einträge nach Kategorie
    const { data: entries, error } = await supabase
      .from('faq_entries')
      .select(`
        id,
        category_id,
        question,
        answer,
        order_number,
        faq_categories(name)
      `)
      .eq('category_id', categoryId)
      .order('order_number');

    if (error) throw error;

    // Kategorienamen zu den Einträgen hinzufügen
    const entriesWithCategories = entries.map(entry => ({
      ...entry,
      category: entry.faq_categories?.name || ''
    }));

    return { data: entriesWithCategories, error: null };
  } catch (error) {
    console.error('Error fetching FAQ entries by category:', error);
    return { data: null, error };
  }
};

// Funktion zum Suchen von FAQ-Einträgen
export const searchFaqEntries = async (searchTerm: string) => {
  try {
    // Suchen nach FAQ-Einträgen, die den Suchbegriff in der Frage oder Antwort enthalten
    const { data: entries, error } = await supabase
      .from('faq_entries')
      .select(`
        id,
        category_id,
        question,
        answer,
        order_number,
        faq_categories(name)
      `)
      .or(`question.ilike.%${searchTerm}%,answer.ilike.%${searchTerm}%`)
      .order('order_number');

    if (error) throw error;

    // Kategorienamen zu den Einträgen hinzufügen
    const entriesWithCategories = entries.map(entry => ({
      ...entry,
      category: entry.faq_categories?.name || ''
    }));

    return { data: entriesWithCategories, error: null };
  } catch (error) {
    console.error('Error searching FAQ entries:', error);
    return { data: null, error };
  }
};
