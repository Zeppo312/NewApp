/** Shared Supabase service results. The secondary result stays empty for caller compatibility. */
export type BackendType = 'supabase';

export interface DualWriteResult<T> {
  primary: { data: T | null; error: any };
  secondary: { data: T | null; error: any };
  success: boolean;
}

export interface ReadResult<T> {
  data: T | null;
  error: any;
  source: BackendType;
}

export abstract class BaseDataService {
  protected userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  protected async readFromSupabase<T>(
    operation: () => Promise<{ data: T | null; error: any }>
  ): Promise<ReadResult<T>> {
    try {
      const result = await operation();
      return { ...result, source: 'supabase' };
    } catch (error) {
      console.error('[ReadFromActive] supabase read failed:', error);
      return { data: null, error, source: 'supabase' };
    }
  }

  protected async withRetry<T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<{ data: T | null; error: any }> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation();
        if (!result.error) {
          return result;
        }
        lastError = result.error;
      } catch (error) {
        lastError = error;
      }

      // Wait before retry with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return { data: null, error: lastError };
  }
}
