import { getCachedUser, supabase } from './supabase';

export type StartupMessageContentType = 'text' | 'html' | 'remote_url';

export type StartupMessage = {
  id: string;
  title: string;
  summary: string | null;
  content_type: StartupMessageContentType;
  content: string | null;
  source_url: string | null;
  button_label: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
};

export type StartupMessageDraft = {
  id?: string;
  title: string;
  summary: string;
  contentType: StartupMessageContentType;
  content: string;
  sourceUrl: string;
  buttonLabel: string;
  isActive: boolean;
};

export const DEFAULT_STARTUP_MESSAGE_DRAFT: StartupMessageDraft = {
  title: '',
  summary: '',
  contentType: 'text',
  content: '',
  sourceUrl: '',
  buttonLabel: 'Okay',
  isActive: true,
};

const isStartupMessageContentType = (
  value: unknown,
): value is StartupMessageContentType =>
  value === 'text' || value === 'html' || value === 'remote_url';

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const nextValue = value.trim();
  return nextValue.length > 0 ? nextValue : null;
};

const sanitizeStartupMessage = (value: any): StartupMessage => ({
  id: String(value?.id ?? ''),
  title: String(value?.title ?? ''),
  summary: normalizeString(value?.summary),
  content_type: isStartupMessageContentType(value?.content_type)
    ? value.content_type
    : 'text',
  content: normalizeString(value?.content),
  source_url: normalizeString(value?.source_url),
  button_label: normalizeString(value?.button_label) ?? 'Okay',
  is_active: typeof value?.is_active === 'boolean' ? value.is_active : undefined,
  created_at: String(value?.created_at ?? ''),
  updated_at: String(value?.updated_at ?? ''),
  created_by: normalizeString(value?.created_by),
  updated_by: normalizeString(value?.updated_by),
});

const buildDraftPayload = (
  draft: StartupMessageDraft,
  userId: string,
): Record<string, unknown> => {
  const title = draft.title.trim();
  const buttonLabel = draft.buttonLabel.trim() || 'Okay';
  const summary = draft.summary.trim();
  const content = draft.content.trim();
  const sourceUrl = draft.sourceUrl.trim();

  if (!title) {
    throw new Error('Bitte einen Titel für die Nachricht eingeben.');
  }

  if (draft.contentType === 'remote_url') {
    if (!sourceUrl) {
      throw new Error('Bitte eine HTTPS-URL für die Web-Inhalte eingeben.');
    }

    if (!isValidStartupMessageUrl(sourceUrl)) {
      throw new Error('Bitte eine gültige HTTPS-URL eingeben.');
    }
  } else if (!content) {
    throw new Error('Bitte einen Inhalt für die Nachricht eingeben.');
  }

  return {
    title,
    summary: summary || null,
    content_type: draft.contentType,
    content: draft.contentType === 'remote_url' ? null : content,
    source_url: draft.contentType === 'remote_url' ? sourceUrl : null,
    button_label: buttonLabel,
    is_active: draft.isActive,
    updated_by: userId,
  };
};

export const isValidStartupMessageUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const listStartupMessagesForAdmin = async (): Promise<StartupMessage[]> => {
  const { data, error } = await supabase
    .from('startup_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(sanitizeStartupMessage);
};

export const saveStartupMessage = async (
  draft: StartupMessageDraft,
): Promise<StartupMessage> => {
  const { data: userData } = await getCachedUser();
  const userId = userData.user?.id;

  if (!userId) {
    throw new Error('Kein angemeldeter Nutzer gefunden.');
  }

  const payload = buildDraftPayload(draft, userId);

  if (draft.id) {
    const { data, error } = await supabase
      .from('startup_messages')
      .update(payload)
      .eq('id', draft.id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return sanitizeStartupMessage(data);
  }

  const { data, error } = await supabase
    .from('startup_messages')
    .insert({
      ...payload,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return sanitizeStartupMessage(data);
};

export const deleteStartupMessage = async (messageId: string): Promise<void> => {
  const { error } = await supabase.from('startup_messages').delete().eq('id', messageId);

  if (error) {
    throw error;
  }
};

export const getPendingStartupMessage = async (): Promise<StartupMessage | null> => {
  const { data, error } = await supabase.rpc('get_pending_startup_message');

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ? sanitizeStartupMessage(row) : null;
};

export const acknowledgeStartupMessage = async (messageId: string): Promise<void> => {
  const { data: userData } = await getCachedUser();
  const userId = userData.user?.id;

  if (!userId) {
    throw new Error('Kein angemeldeter Nutzer gefunden.');
  }

  const { error } = await supabase.from('startup_message_acknowledgements').upsert(
    {
      message_id: messageId,
      user_id: userId,
    },
    {
      onConflict: 'message_id,user_id',
    },
  );

  if (error) {
    throw error;
  }
};

export const convertStartupMessageToDraft = (
  message?: StartupMessage | null,
): StartupMessageDraft => {
  if (!message) {
    return { ...DEFAULT_STARTUP_MESSAGE_DRAFT };
  }

  return {
    id: message.id,
    title: message.title,
    summary: message.summary ?? '',
    contentType: message.content_type,
    content: message.content ?? '',
    sourceUrl: message.source_url ?? '',
    buttonLabel: message.button_label || 'Okay',
    isActive: message.is_active !== false,
  };
};
