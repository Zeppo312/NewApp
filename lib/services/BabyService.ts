import { BaseDataService, DualWriteResult, ReadResult } from './BaseDataService';
import { supabase } from '@/lib/supabase';

/**
 * BabyService
 *
 * Manages baby data with Supabase.
 * Extends BaseDataService to provide baby-specific operations.
 */

export interface BabyInfo {
  id: string;
  user_id: string;
  name?: string | null;
  birth_date?: string | null;
  preferred_bedtime?: string | null;
  weight?: string | null;
  height?: string | null;
  photo_url?: string | null;
  baby_gender?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBabyInput {
  user_id: string;
  name?: string;
  birth_date?: string;
  preferred_bedtime?: string;
  weight?: string;
  height?: string;
  photo_url?: string;
  baby_gender?: string;
}

export interface UpdateBabyInput {
  name?: string | null;
  birth_date?: string | null;
  preferred_bedtime?: string | null;
  weight?: string | null;
  height?: string | null;
  photo_url?: string | null;
  baby_gender?: string | null;
}

export class BabyService extends BaseDataService {
  constructor(userId: string) {
    super(userId);
  }

  /**
   * Get all babies visible to the user
   */
  async listBabies(): Promise<ReadResult<BabyInfo[]>> {
    const supabaseOperation = async () => {
      // Get babies where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('baby_info')
        .select(`
          *,
          baby_members!inner (
            role
          )
        `)
        .eq('baby_members.user_id', this.userId)
        .order('created_at', { ascending: true });

      // Get babies owned by user
      const { data: ownedData, error: ownedError } = await supabase
        .from('baby_info')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: true });

      // Combine and deduplicate
      const combined = [...(memberData ?? []), ...(ownedData ?? [])];
      const seen = new Set<string>();
      const deduped = combined.filter((baby) => {
        if (!baby?.id || seen.has(baby.id)) return false;
        seen.add(baby.id);
        return true;
      });

      const error = memberError || ownedError;
      return { data: deduped.length > 0 ? deduped as BabyInfo[] : null, error };
    };

    return this.readFromSupabase(supabaseOperation);
  }

  /**
   * Get a specific baby by ID
   */
  async getBaby(babyId: string): Promise<ReadResult<BabyInfo>> {
    const supabaseOperation = async () => {
      const { data, error } = await supabase
        .from('baby_info')
        .select('*')
        .eq('id', babyId)
        .single();

      return { data: data as BabyInfo | null, error };
    };

    return this.readFromSupabase(supabaseOperation);
  }

  /**
   * Create a new baby (Supabase)
   */
  async createBaby(input: CreateBabyInput): Promise<DualWriteResult<BabyInfo>> {
    // Supabase operation
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('baby_info')
      .insert({
        user_id: input.user_id,
        name: input.name,
        birth_date: input.birth_date,
        preferred_bedtime: input.preferred_bedtime,
        weight: input.weight,
        height: input.height,
        photo_url: input.photo_url,
        baby_gender: input.baby_gender,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    return {
      primary: { data: data as BabyInfo | null, error },
      secondary: { data: null, error: null },
      success: !error,
    };
  }

  /**
   * Update an existing baby (Supabase)
   */
  async updateBaby(
    babyId: string,
    updates: UpdateBabyInput
  ): Promise<DualWriteResult<BabyInfo>> {
    // Supabase operation
    const { data, error } = await supabase
      .from('baby_info')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', babyId)
      .select()
      .single();

    return {
      primary: { data: data as BabyInfo | null, error },
      secondary: { data: null, error: null },
      success: !error,
    };
  }

  /**
   * Delete a baby (Supabase)
   */
  async deleteBaby(babyId: string): Promise<DualWriteResult<boolean>> {
    // Supabase operation
    const { error } = await supabase.from('baby_info').delete().eq('id', babyId);

    return {
      primary: { data: !error, error },
      secondary: { data: null, error: null },
      success: !error,
    };
  }
}
