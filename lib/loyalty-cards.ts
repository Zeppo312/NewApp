import { getCachedUser, supabase } from '@/lib/supabase';

export type LoyaltyCard = {
  id: string;
  name: string;
  barcode: string;
  scannedType: string;
  color: string;
  createdAt: string;
};

export type NewLoyaltyCard = Omit<LoyaltyCard, 'id' | 'createdAt'>;

type LoyaltyCardRow = {
  id: string;
  name: string;
  barcode: string;
  scanned_type: string;
  color: string;
  created_at: string;
};

type DataResult<T> = { data: T | null; error: unknown | null };

const fromRow = (row: LoyaltyCardRow): LoyaltyCard => ({
  id: row.id,
  name: row.name,
  barcode: row.barcode,
  scannedType: row.scanned_type,
  color: row.color,
  createdAt: row.created_at,
});

const requireCurrentUser = async () => {
  const { data, error } = await getCachedUser();
  if (error || !data.user) {
    return { user: null, error: error ?? new Error('Nicht angemeldet') };
  }
  return { user: data.user, error: null };
};

export const fetchLoyaltyCards = async (): Promise<DataResult<LoyaltyCard[]>> => {
  const { user, error: userError } = await requireCurrentUser();
  if (!user) return { data: null, error: userError };

  const { data, error } = await supabase
    .from('loyalty_cards')
    .select('id, name, barcode, scanned_type, color, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return {
    data: error ? null : ((data ?? []) as LoyaltyCardRow[]).map(fromRow),
    error,
  };
};

export const createLoyaltyCard = async (
  card: NewLoyaltyCard
): Promise<DataResult<LoyaltyCard>> => {
  const { user, error: userError } = await requireCurrentUser();
  if (!user) return { data: null, error: userError };

  const { data, error } = await supabase
    .from('loyalty_cards')
    .insert({
      user_id: user.id,
      name: card.name,
      barcode: card.barcode,
      scanned_type: card.scannedType,
      color: card.color,
    })
    .select('id, name, barcode, scanned_type, color, created_at')
    .single();

  return {
    data: data ? fromRow(data as LoyaltyCardRow) : null,
    error,
  };
};

export const deleteLoyaltyCard = async (cardId: string): Promise<{ error: unknown | null }> => {
  const { user, error: userError } = await requireCurrentUser();
  if (!user) return { error: userError };

  const { error } = await supabase
    .from('loyalty_cards')
    .delete()
    .eq('id', cardId)
    .eq('user_id', user.id);

  return { error };
};
