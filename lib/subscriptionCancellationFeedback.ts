import { Platform } from 'react-native';

import { supabase } from './supabase';

export type SubscriptionCancellationFeedbackReason =
  | 'too_expensive'
  | 'missing_features'
  | 'not_using'
  | 'technical_issues'
  | 'temporary_pause'
  | 'other';

export type SubscriptionCancellationFeedbackPayload = {
  userId: string;
  reason: SubscriptionCancellationFeedbackReason;
  details?: string | null;
  source?: string;
  store?: string | null;
  productId?: string | null;
  planType?: string | null;
  expiresAt?: string | null;
  willRenew?: boolean | null;
};

const nullableText = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const saveSubscriptionCancellationFeedback = async ({
  userId,
  reason,
  details,
  source = 'subscription_screen',
  store,
  productId,
  planType,
  expiresAt,
  willRenew,
}: SubscriptionCancellationFeedbackPayload) => {
  const { error } = await supabase.from('subscription_cancellation_feedback').insert({
    user_id: userId,
    reason,
    details: nullableText(details),
    source,
    platform: Platform.OS,
    store: nullableText(store),
    product_id: nullableText(productId),
    plan_type: nullableText(planType),
    expires_at: expiresAt ?? null,
    will_renew: typeof willRenew === 'boolean' ? willRenew : null,
  });

  if (error) {
    throw error;
  }
};
