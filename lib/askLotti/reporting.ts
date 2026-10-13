import { supabase } from '@/lib/supabase';
import type { ReportReason } from '@/lib/moderation';
import type { StoredChatMessage } from './chatStore';

export const MAX_REPORT_DETAILS_LENGTH = 1000;
export const ASK_LOTTI_REPORT_REASONS: ReportReason[] = [
  'misinformation', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'spam', 'other',
];

export const canReportLottiMessage = (message: StoredChatMessage): boolean =>
  message.role === 'lotti' && message.id !== 'intro' && !message.isError && !!message.text.trim();

/** Only the explicitly selected answer is uploaded, never the conversation or baby records. */
export async function reportLottiAnswer(params: {
  conversationId: string;
  message: StoredChatMessage;
  reason: ReportReason;
  details: string;
}): Promise<boolean> {
  if (!canReportLottiMessage(params.message) ||
      !ASK_LOTTI_REPORT_REASONS.includes(params.reason) ||
      params.details.length > MAX_REPORT_DETAILS_LENGTH) return false;

  try {
    const { data, error } = await supabase.rpc('report_lotti_answer', {
      conversation_id_param: params.conversationId,
      message_id_param: params.message.id,
      answer_param: [params.message.text, params.message.disclaimer].filter(Boolean).join('\n\n'),
      reason_param: params.reason,
      details_param: params.details.trim() || null,
    });
    return !error && typeof data === 'string' && data.length > 0;
  } catch {
    return false;
  }
}
