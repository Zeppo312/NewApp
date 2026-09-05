import { BaseDataService, DualWriteResult, ReadResult } from './BaseDataService';
import { supabase } from '@/lib/supabase';
import type { ConvexReactClient } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { BackendType } from '@/contexts/BackendContext';

/**
 * BabyService
 *
 * Manages baby data with dual-backend support (Supabase + Convex).
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
  constructor(
    activeBackend: BackendType,
    convexClient: ConvexReactClient | null,
    userId: string
  ) {
    super(activeBackend, convexClient, userId);
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

    const convexOperation = async () => {
      if (!this.convexClient) {
        return { data: null, error: new Error('Convex client not available') };
      }

      try {
        const data = await this.convexClient.query(api.babies.getUserBabies, {
          userId: this.userId,
        });

        // Map Convex data to BabyInfo format
        const mappedData: BabyInfo[] = (data || []).map((baby: any) => ({
          id: baby._id,
          user_id: baby.user_id,
          name: baby.name || null,
          birth_date: baby.birth_date || null,
          preferred_bedtime: baby.preferred_bedtime || null,
          weight: baby.weight || null,
          height: baby.height || null,
          photo_url: baby.photo_url || null,
          baby_gender: baby.baby_gender || null,
          created_at: baby.created_at,
          updated_at: baby.updated_at,
        }));

        return { data: mappedData, error: null };
      } catch (error) {
        return { data: null, error };
      }
    };

    return this.readFromActive(this.activeBackend, supabaseOperation, convexOperation);
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

    const convexOperation = async () => {
      if (!this.convexClient) {
        return { data: null, error: new Error('Convex client not available') };
      }

      try {
        const data = await this.convexClient.query(api.babies.getBabyById, {
          babyId: babyId as any, // Convex ID is passed as string
        });

        if (!data) {
          return { data: null, error: new Error('Baby not found') };
        }

        // Map Convex data to BabyInfo format
        const mappedData: BabyInfo = {
          id: data._id,
          user_id: data.user_id,
          name: data.name || null,
          birth_date: data.birth_date || null,
          preferred_bedtime: (data as any).preferred_bedtime || null,
          weight: data.weight || null,
          height: data.height || null,
          photo_url: data.photo_url || null,
          baby_gender: data.baby_gender || null,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        return { data: mappedData, error: null };
      } catch (error) {
        return { data: null, error };
      }
    };

    return this.readFromActive(this.activeBackend, supabaseOperation, convexOperation);
  }

  /**
   * Create a new baby (uses only the active backend)
   */
  async createBaby(input: CreateBabyInput): Promise<DualWriteResult<BabyInfo>> {
    if (this.activeBackend === 'supabase') {
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
    } else {
      // Convex operation
      if (!this.convexClient) {
        const error = new Error('Convex client not available');
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }

      try {
        const now = new Date().toISOString();
        const convexData = await this.convexClient.mutation(api.babies.createBaby, {
          userId: input.user_id,
          name: input.name,
          birthDate: input.birth_date,
          weight: input.weight,
          height: input.height,
          photoUrl: input.photo_url,
          babyGender: input.baby_gender,
          createdAt: now,
          updatedAt: now,
        });

        if (!convexData) {
          return {
            primary: { data: null, error: new Error('Failed to create baby') },
            secondary: { data: null, error: null },
            success: false,
          };
        }

        // Map Convex response to BabyInfo
        const mappedData: BabyInfo = {
          id: convexData._id,
          user_id: convexData.user_id,
          name: convexData.name || null,
          birth_date: convexData.birth_date || null,
          preferred_bedtime: (convexData as any).preferred_bedtime || null,
          weight: convexData.weight || null,
          height: convexData.height || null,
          photo_url: convexData.photo_url || null,
          baby_gender: convexData.baby_gender || null,
          created_at: convexData.created_at,
          updated_at: convexData.updated_at,
        };

        return {
          primary: { data: mappedData, error: null },
          secondary: { data: null, error: null },
          success: true,
        };
      } catch (error) {
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }
    }
  }

  /**
   * Update an existing baby (uses only the active backend)
   */
  async updateBaby(
    babyId: string,
    updates: UpdateBabyInput
  ): Promise<DualWriteResult<BabyInfo>> {
    if (this.activeBackend === 'supabase') {
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
    } else {
      // Convex operation
      if (!this.convexClient) {
        const error = new Error('Convex client not available');
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }

      try {
        const now = new Date().toISOString();
        const convexData = await this.convexClient.mutation(api.babies.updateBaby, {
          babyId: babyId as any, // Convex ID is passed as string
          name: updates.name ?? undefined,
          birthDate: updates.birth_date ?? undefined,
          weight: updates.weight ?? undefined,
          height: updates.height ?? undefined,
          photoUrl: updates.photo_url ?? undefined,
          babyGender: updates.baby_gender ?? undefined,
          updatedAt: now,
        });

        if (!convexData) {
          return {
            primary: { data: null, error: new Error('Baby not found') },
            secondary: { data: null, error: null },
            success: false,
          };
        }

        // Map Convex response to BabyInfo
        const mappedData: BabyInfo = {
          id: convexData._id,
          user_id: convexData.user_id,
          name: convexData.name || null,
          birth_date: convexData.birth_date || null,
          preferred_bedtime: (convexData as any).preferred_bedtime || null,
          weight: convexData.weight || null,
          height: convexData.height || null,
          photo_url: convexData.photo_url || null,
          baby_gender: convexData.baby_gender || null,
          created_at: convexData.created_at,
          updated_at: convexData.updated_at,
        };

        return {
          primary: { data: mappedData, error: null },
          secondary: { data: null, error: null },
          success: true,
        };
      } catch (error) {
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }
    }
  }

  /**
   * Delete a baby (uses only the active backend)
   */
  async deleteBaby(babyId: string): Promise<DualWriteResult<boolean>> {
    if (this.activeBackend === 'supabase') {
      // Supabase operation
      const { error } = await supabase.from('baby_info').delete().eq('id', babyId);

      return {
        primary: { data: !error, error },
        secondary: { data: null, error: null },
        success: !error,
      };
    } else {
      // Convex operation
      if (!this.convexClient) {
        const error = new Error('Convex client not available');
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }

      try {
        const result = await this.convexClient.mutation(api.babies.deleteBaby, {
          babyId: babyId as any, // Convex ID is passed as string
        });

        return {
          primary: { data: result.success, error: null },
          secondary: { data: null, error: null },
          success: result.success,
        };
      } catch (error) {
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }
    }
  }
}
