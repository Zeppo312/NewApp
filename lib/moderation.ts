import { getCachedUser, supabase } from './supabase';

/**
 * Melden und Blockieren von nutzergenerierten Inhalten (App Store Guideline 1.2).
 *
 * Serverseitig hängen hier `content_reports`, `user_blocks` und die
 * `moderation_*`-RPCs aus 20270817000000_ugc_moderation.sql dran.
 */

export type ReportTargetType =
  | 'post'
  | 'comment'
  | 'nested_comment'
  | 'group_post'
  | 'group_comment'
  | 'group_nested_comment'
  | 'group_message'
  | 'direct_message'
  | 'profile';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'self_harm'
  | 'misinformation'
  | 'other';

export type BlockedUser = {
  id: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
};

export type ModerationResult = { success: boolean; error?: string };

/**
 * Im Speicher gehaltene Blockliste. Der Server filtert geblockte Inhalte
 * ohnehin über RLS – der Cache sorgt dafür, dass bereits geladene Listen
 * ohne Reload sofort aktualisiert werden können ("instantly", wie von Apple
 * gefordert).
 */
let blockedUserIds = new Set<string>();
let blockedIdsLoaded = false;
type BlockListListener = (ids: Set<string>) => void;
const blockListListeners = new Set<BlockListListener>();

const notifyBlockListChanged = () => {
  const snapshot = new Set(blockedUserIds);
  blockListListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.error('moderation: block list listener failed', err);
    }
  });
};

/**
 * Registriert einen Listener auf Änderungen der Blockliste.
 * Gibt eine Abmelde-Funktion zurück (für useEffect-Cleanup).
 */
export const subscribeToBlockList = (listener: BlockListListener): (() => void) => {
  blockListListeners.add(listener);
  return () => {
    blockListListeners.delete(listener);
  };
};

/**
 * Lädt die IDs aller Nutzer, die in irgendeiner Richtung mit dem aktuellen
 * Nutzer verblockt sind. Beide Richtungen zählen, damit auch derjenige,
 * der blockiert wurde, die Inhalte nicht mehr sieht.
 */
export const loadBlockedUserIds = async (force = false): Promise<Set<string>> => {
  if (blockedIdsLoaded && !force) return new Set(blockedUserIds);

  try {
    const { data: userData } = await getCachedUser();
    const userId = userData?.user?.id;
    if (!userId) {
      blockedUserIds = new Set();
      blockedIdsLoaded = false;
      return new Set();
    }

    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    if (error) {
      console.error('moderation: failed to load blocked users', error);
      return new Set(blockedUserIds);
    }

    const next = new Set<string>();
    (data || []).forEach((row: { blocker_id: string; blocked_id: string }) => {
      next.add(row.blocker_id === userId ? row.blocked_id : row.blocker_id);
    });

    blockedUserIds = next;
    blockedIdsLoaded = true;
    notifyBlockListChanged();
    return new Set(blockedUserIds);
  } catch (err) {
    console.error('moderation: unexpected error loading blocked users', err);
    return new Set(blockedUserIds);
  }
};

/** Synchroner Zugriff auf die zuletzt geladene Blockliste. */
export const getBlockedUserIdsSync = (): Set<string> => new Set(blockedUserIds);

/** Synchrone Prüfung für Render-Pfade (Feed, Chatliste, Kommentare). */
export const isUserBlocked = (userId: string | null | undefined): boolean =>
  !!userId && blockedUserIds.has(userId);

/** Beim Logout aufräumen, damit kein Zustand über Konten hinweg hängen bleibt. */
export const resetBlockListCache = (): void => {
  blockedUserIds = new Set();
  blockedIdsLoaded = false;
  notifyBlockListChanged();
};

/**
 * Inhalt melden. Der Server ermittelt Autor und Snapshot selbst, damit die
 * Meldung auch dann vollständig ist, wenn der Inhalt danach verschwindet.
 */
export const reportContent = async (params: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string | null;
}): Promise<ModerationResult> => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData?.user) return { success: false, error: 'not_authenticated' };

    const { error } = await supabase.rpc('report_content', {
      target_type_param: params.targetType,
      target_id_param: params.targetId,
      reason_param: params.reason,
      details_param: params.details?.trim() ? params.details.trim() : null,
      source_param: 'user',
    });

    if (error) {
      console.error('moderation: report failed', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('moderation: unexpected error reporting content', err);
    return { success: false, error: 'unexpected_error' };
  }
};

/**
 * Nutzer blockieren. Optional wird der auslösende Inhalt zusätzlich gemeldet –
 * Apple verlangt, dass der Entwickler beim Blockieren über den Inhalt
 * informiert wird.
 */
export const blockUser = async (
  userId: string,
  reportedContent?: { targetType: ReportTargetType; targetId: string; reason?: ReportReason },
): Promise<ModerationResult> => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData?.user) return { success: false, error: 'not_authenticated' };
    if (userData.user.id === userId) return { success: false, error: 'cannot_block_self' };

    const { error } = await supabase.rpc('block_user', { target_user_id: userId });

    if (error) {
      console.error('moderation: block failed', error);
      return { success: false, error: error.message };
    }

    if (reportedContent) {
      const { error: reportError } = await supabase.rpc('report_content', {
        target_type_param: reportedContent.targetType,
        target_id_param: reportedContent.targetId,
        reason_param: reportedContent.reason ?? 'harassment',
        details_param: 'Nutzer wurde beim Blockieren gemeldet.',
        source_param: 'block',
      });

      if (reportError) {
        // Der Block selbst ist erfolgreich – die Meldung ist ein Zusatz.
        console.error('moderation: block report failed', reportError);
      }
    }

    blockedUserIds.add(userId);
    blockedIdsLoaded = true;
    notifyBlockListChanged();

    return { success: true };
  } catch (err) {
    console.error('moderation: unexpected error blocking user', err);
    return { success: false, error: 'unexpected_error' };
  }
};

export const unblockUser = async (userId: string): Promise<ModerationResult> => {
  try {
    const { data: userData } = await getCachedUser();
    const currentUserId = userData?.user?.id;
    if (!currentUserId) return { success: false, error: 'not_authenticated' };

    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', userId);

    if (error) {
      console.error('moderation: unblock failed', error);
      return { success: false, error: error.message };
    }

    await loadBlockedUserIds(true);
    return { success: true };
  } catch (err) {
    console.error('moderation: unexpected error unblocking user', err);
    return { success: false, error: 'unexpected_error' };
  }
};

/**
 * Liste der selbst blockierten Nutzer (für den Verwaltungs-Screen).
 * Nutzer, die den aktuellen Nutzer blockiert haben, erscheinen hier nicht.
 */
export const getBlockedUsers = async (): Promise<BlockedUser[]> => {
  try {
    const { data: userData } = await getCachedUser();
    const currentUserId = userData?.user?.id;
    if (!currentUserId) return [];

    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id, created_at')
      .eq('blocker_id', currentUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('moderation: failed to load block list', error);
      return [];
    }

    const rows = data || [];
    if (rows.length === 0) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, first_name, last_name, avatar_url')
      .in(
        'id',
        rows.map((row: { blocked_id: string }) => row.blocked_id),
      );

    const profileById = new Map(
      (profiles || []).map((profile: any) => [profile.id as string, profile]),
    );

    return rows.map((row: { blocked_id: string; created_at: string }) => {
      const profile = profileById.get(row.blocked_id);
      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();

      return {
        id: row.blocked_id,
        name: profile?.username?.trim() || fullName || 'Unbekannt',
        avatar_url: profile?.avatar_url ?? null,
        created_at: row.created_at,
      };
    });
  } catch (err) {
    console.error('moderation: unexpected error loading block list', err);
    return [];
  }
};

/**
 * Filtert eine geladene Liste clientseitig. Ergänzt die serverseitigen
 * RLS-Filter, damit bereits gerenderte Listen sofort aktualisiert werden.
 */
export const filterBlockedAuthors = <T extends Record<string, any>>(
  items: T[],
  authorKey: keyof T = 'user_id' as keyof T,
): T[] => items.filter((item) => !isUserBlocked(item[authorKey] as unknown as string));

// ---------------------------------------------------------------------------
// Moderations-Backoffice (nur für profiles.is_admin)
// ---------------------------------------------------------------------------

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export type ModerationReport = {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  target_snapshot: string | null;
  /** Bild-URL des gemeldeten Beitrags oder Profilbilds. */
  media_url: string | null;
  /** Gesetzt, wenn eine Sprachnachricht gemeldet wurde. */
  audio_storage_path: string | null;
  reason: ReportReason | 'auto_filter';
  details: string | null;
  source: 'user' | 'auto_filter' | 'block';
  status: ReportStatus;
  created_at: string;
  follow_up_at: string | null;
  follow_up_message: string | null;
  reporter_id: string | null;
  reporter_name: string;
  reported_user_id: string | null;
  reported_user_name: string;
  reported_user_suspended: boolean | null;
  reported_user_open_reports: number;
};

export const getModerationReports = async (
  status: ReportStatus = 'open',
): Promise<ModerationReport[]> => {
  try {
    const { data, error } = await supabase.rpc('get_moderation_reports', {
      status_param: status,
      limit_param: 100,
    });

    if (error) {
      console.error('moderation: failed to load reports', error);
      return [];
    }

    return (data || []) as ModerationReport[];
  } catch (err) {
    console.error('moderation: unexpected error loading reports', err);
    return [];
  }
};

const callModerationRpc = async (
  fn: string,
  params: Record<string, unknown>,
): Promise<ModerationResult> => {
  try {
    const { error } = await supabase.rpc(fn, params);

    if (error) {
      console.error(`moderation: ${fn} failed`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error(`moderation: unexpected error in ${fn}`, err);
    return { success: false, error: 'unexpected_error' };
  }
};

export const moderationDeleteContent = (
  targetType: ReportTargetType,
  targetId: string,
): Promise<ModerationResult> =>
  callModerationRpc('moderation_delete_content', {
    target_type_param: targetType,
    target_id_param: targetId,
  });

export const moderationSuspendUser = (
  userId: string,
  reason?: string | null,
): Promise<ModerationResult> =>
  callModerationRpc('moderation_suspend_user', {
    target_user_id: userId,
    reason_param: reason ?? null,
  });

export const moderationRemoveContentAndSuspendUser = (
  reportId: string,
  reason?: string | null,
): Promise<ModerationResult> =>
  callModerationRpc('moderation_remove_content_and_suspend_user', {
    report_id_param: reportId,
    reason_param: reason ?? null,
  });

export const moderationUnsuspendUser = (userId: string): Promise<ModerationResult> =>
  callModerationRpc('moderation_unsuspend_user', { target_user_id: userId });

export const moderationResolveReport = (
  reportId: string,
  resolution: 'dismissed' | 'resolved' = 'dismissed',
): Promise<ModerationResult> =>
  callModerationRpc('moderation_resolve_report', {
    report_id_param: reportId,
    resolution_param: resolution,
  });

/**
 * Rückfrage an den Melder. Die Meldung bleibt offen und trägt danach den
 * Vermerk `follow_up_at`; der Melder erhält die Frage als Direktnachricht
 * (inklusive Push über den bestehenden direct_messages-Webhook).
 */
export const moderationAskReporter = (
  reportId: string,
  message: string,
): Promise<ModerationResult> =>
  callModerationRpc('moderation_ask_reporter', {
    report_id_param: reportId,
    message_param: message.trim(),
  });
