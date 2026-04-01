import { getCachedUser, supabase } from './supabase';

export type GroupVisibility = 'public' | 'private';
export type GroupRole = 'owner' | 'admin' | 'member';
export type GroupMemberStatus = 'active' | 'left' | 'removed';
export type GroupInviteStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export interface CommunityGroup {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string | null;
  visibility: GroupVisibility;
  avatar_url?: string | null;
  cover_image_url?: string | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
  current_user_role?: GroupRole | null;
  current_user_membership_status?: GroupMemberStatus | null;
  is_member?: boolean;
  pending_invite_id?: string | null;
  owner_is_admin?: boolean;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  invited_user_id: string;
  invited_by_user_id: string;
  status: GroupInviteStatus;
  created_at: string;
  responded_at?: string | null;
  group?: CommunityGroup | null;
  invited_by_name?: string;
}

export interface GroupMemberProfile {
  user_id: string;
  role: GroupRole;
  status: GroupMemberStatus;
  joined_at: string;
  display_name: string;
  avatar_url?: string | null;
  username?: string | null;
}

export interface GroupUserSearchResult {
  id: string;
  display_name: string;
  username?: string | null;
  avatar_url?: string | null;
}

type GroupRecord = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string | null;
  visibility: GroupVisibility;
  avatar_url?: string | null;
  cover_image_url?: string | null;
  created_at: string;
  updated_at: string;
};

type MembershipRecord = {
  group_id: string;
  role: GroupRole;
  status: GroupMemberStatus;
};

type InviteRecord = {
  id: string;
  group_id: string;
  status: GroupInviteStatus;
};

type ProfileRecord = {
  id: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  is_admin?: boolean | null;
};

type GroupMemberProfileRpcRow = {
  user_id: string;
  role: GroupRole;
  status: GroupMemberStatus;
  joined_at: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  community_use_avatar?: boolean | null;
};

const buildDisplayName = (profile?: {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) => {
  const username = profile?.username?.trim();
  if (username) return username;
  const firstName = profile?.first_name?.trim() || '';
  const lastName = profile?.last_name?.trim() || '';
  return `${firstName} ${lastName}`.trim() || 'Benutzer';
};

const buildInviteSearchFilter = (query: string) => {
  const cleanedQuery = query.trim().replace(/[%(),]/g, ' ').replace(/\s+/g, ' ');
  const tokens = cleanedQuery.split(' ').map((token) => token.trim()).filter(Boolean);

  const filters = [
    `username.ilike.%${cleanedQuery}%`,
    `first_name.ilike.%${cleanedQuery}%`,
    `last_name.ilike.%${cleanedQuery}%`,
  ];

  if (tokens.length >= 2) {
    const firstToken = tokens[0];
    const remaining = tokens.slice(1).join(' ');

    filters.push(`and(first_name.ilike.%${firstToken}%,last_name.ilike.%${remaining}%)`);
    filters.push(`and(first_name.ilike.%${remaining}%,last_name.ilike.%${firstToken}%)`);
  }

  return filters.join(',');
};

const slugifyGroupName = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48) || `gruppe-${Date.now()}`;

const normalizeGroup = (
  group: GroupRecord,
  membershipMap: Map<string, MembershipRecord>,
  inviteMap: Map<string, InviteRecord>,
  memberCountMap: Map<string, number>,
  ownerAdminMap: Map<string, boolean>,
): CommunityGroup => {
  const membership = membershipMap.get(group.id);
  const invite = inviteMap.get(group.id);

  return {
    ...group,
    member_count: memberCountMap.get(group.id) ?? 0,
    current_user_role: membership?.role ?? null,
    current_user_membership_status: membership?.status ?? null,
    is_member: membership?.status === 'active',
    pending_invite_id: invite?.status === 'pending' ? invite.id : null,
    owner_is_admin: ownerAdminMap.get(group.owner_id) === true,
  };
};

const compareGroups = (a: CommunityGroup, b: CommunityGroup) => {
  if ((a.owner_is_admin ? 1 : 0) !== (b.owner_is_admin ? 1 : 0)) {
    return (b.owner_is_admin ? 1 : 0) - (a.owner_is_admin ? 1 : 0);
  }

  const createdAtDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
};

const enrichGroupsForCurrentUser = async (groups: GroupRecord[], userId: string) => {
  if (groups.length === 0) {
    return [];
  }

  const groupIds = groups.map((group) => group.id);
  const ownerIds = [...new Set(groups.map((group) => group.owner_id).filter(Boolean))];

  const [
    { data: memberships, error: membershipsError },
    { data: counts, error: countsError },
    { data: invites, error: invitesError },
    { data: ownerProfiles, error: ownerProfilesError },
  ] = await Promise.all([
    supabase
      .from('community_group_members')
      .select('group_id, role, status')
      .eq('user_id', userId)
      .in('group_id', groupIds),
    supabase
      .from('community_group_members')
      .select('group_id')
      .eq('status', 'active')
      .in('group_id', groupIds),
    supabase
      .from('community_group_invites')
      .select('id, group_id, status')
      .eq('invited_user_id', userId)
      .eq('status', 'pending')
      .in('group_id', groupIds),
    ownerIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, is_admin')
          .in('id', ownerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (membershipsError) throw membershipsError;
  if (countsError) throw countsError;
  if (invitesError) throw invitesError;
  if (ownerProfilesError) {
    console.warn('Failed to load group owner admin flags:', ownerProfilesError);
  }

  const membershipMap = new Map<string, MembershipRecord>();
  for (const membership of (memberships || []) as MembershipRecord[]) {
    membershipMap.set(membership.group_id, membership);
  }

  const memberCountMap = new Map<string, number>();
  for (const countRow of counts || []) {
    memberCountMap.set(countRow.group_id, (memberCountMap.get(countRow.group_id) || 0) + 1);
  }

  const inviteMap = new Map<string, InviteRecord>();
  for (const invite of (invites || []) as InviteRecord[]) {
    inviteMap.set(invite.group_id, invite);
  }

  const ownerAdminMap = new Map<string, boolean>();
  for (const profile of (ownerProfiles || []) as ProfileRecord[]) {
    ownerAdminMap.set(profile.id, profile.is_admin === true);
  }

  return groups
    .map((group) => normalizeGroup(group, membershipMap, inviteMap, memberCountMap, ownerAdminMap))
    .sort(compareGroups);
};

const generateUniqueSlug = async (name: string) => {
  const baseSlug = slugifyGroupName(name);
  const { data, error } = await supabase
    .from('community_groups')
    .select('slug')
    .ilike('slug', `${baseSlug}%`);

  if (error) {
    throw error;
  }

  const existingSlugs = new Set((data || []).map((item) => item.slug));
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
};

export const createGroup = async ({
  name,
  description,
  visibility,
}: {
  name: string;
  description?: string;
  visibility: GroupVisibility;
}) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const cleanedName = name.trim();
    if (!cleanedName) {
      return { data: null, error: new Error('Bitte gib einen Gruppennamen ein.') };
    }

    const slug = await generateUniqueSlug(cleanedName);
    const now = new Date().toISOString();

    const { data: group, error: groupError } = await supabase
      .from('community_groups')
      .insert({
        owner_id: userData.user.id,
        name: cleanedName,
        slug,
        description: description?.trim() || null,
        visibility,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (groupError) {
      return { data: null, error: groupError };
    }

    const { error: memberError } = await supabase
      .from('community_group_members')
      .insert({
        group_id: group.id,
        user_id: userData.user.id,
        role: 'owner',
        status: 'active',
        joined_at: now,
        created_at: now,
        updated_at: now,
      });

    if (memberError) {
      await supabase.from('community_groups').delete().eq('id', group.id);
      return { data: null, error: memberError };
    }

    const [enrichedGroup] = await enrichGroupsForCurrentUser([group as GroupRecord], userData.user.id);
    return { data: enrichedGroup, error: null };
  } catch (error) {
    console.error('Failed to create group:', error);
    return { data: null, error };
  }
};

export const getMyGroups = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from('community_group_members')
      .select('group_id')
      .eq('user_id', userData.user.id)
      .eq('status', 'active');

    if (membershipsError) {
      return { data: null, error: membershipsError };
    }

    const groupIds = [...new Set((memberships || []).map((membership) => membership.group_id).filter(Boolean))];
    if (groupIds.length === 0) {
      return { data: [], error: null };
    }

    const { data: groups, error: groupsError } = await supabase
      .from('community_groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    if (groupsError) {
      return { data: null, error: groupsError };
    }

    const enriched = await enrichGroupsForCurrentUser((groups || []) as GroupRecord[], userData.user.id);
    return { data: enriched, error: null };
  } catch (error) {
    console.error('Failed to load my groups:', error);
    return { data: null, error };
  }
};

export const getDiscoverableGroups = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const { data: groups, error } = await supabase
      .from('community_groups')
      .select('*')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    const enriched = await enrichGroupsForCurrentUser((groups || []) as GroupRecord[], userData.user.id);
    return { data: enriched, error: null };
  } catch (error) {
    console.error('Failed to load public groups:', error);
    return { data: null, error };
  }
};

export const getPendingGroupInvites = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const { data: invites, error } = await supabase
      .from('community_group_invites')
      .select('id, group_id, invited_user_id, invited_by_user_id, status, created_at, responded_at')
      .eq('invited_user_id', userData.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    if (!invites || invites.length === 0) {
      return { data: [], error: null };
    }

    const groupIds = [...new Set(invites.map((invite) => invite.group_id))];
    const inviterIds = [...new Set(invites.map((invite) => invite.invited_by_user_id))];

    const [{ data: groups }, { data: inviterProfiles }] = await Promise.all([
      supabase.from('community_groups').select('*').in('id', groupIds),
      supabase.from('profiles').select('id, username, first_name, last_name').in('id', inviterIds),
    ]);

    const enrichedGroups = await enrichGroupsForCurrentUser((groups || []) as GroupRecord[], userData.user.id);
    const groupMap = new Map(enrichedGroups.map((group) => [group.id, group]));
    const inviterMap = new Map(
      ((inviterProfiles || []) as ProfileRecord[]).map((profile) => [profile.id, buildDisplayName(profile)]),
    );

    const result: GroupInvite[] = invites.map((invite) => ({
      ...invite,
      group: groupMap.get(invite.group_id) || null,
      invited_by_name: inviterMap.get(invite.invited_by_user_id) || 'Benutzer',
    }));

    return { data: result, error: null };
  } catch (error) {
    console.error('Failed to load group invites:', error);
    return { data: null, error };
  }
};

export const getGroupDetails = async (groupId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const { data: group, error } = await supabase
      .from('community_groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    if (!group) {
      return { data: null, error: new Error('Gruppe nicht gefunden') };
    }

    const [enriched] = await enrichGroupsForCurrentUser([group as GroupRecord], userData.user.id);
    return { data: enriched, error: null };
  } catch (error) {
    console.error('Failed to load group details:', error);
    return { data: null, error };
  }
};

export const updateGroup = async ({
  groupId,
  name,
  description,
}: {
  groupId: string;
  name: string;
  description?: string | null;
}) => {
  try {
    const cleanedName = name.trim();
    if (!cleanedName) {
      return { data: null, error: new Error('Bitte gib einen Gruppennamen ein.') };
    }

    const { error } = await supabase
      .from('community_groups')
      .update({
        name: cleanedName,
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    if (error) {
      return { data: null, error };
    }

    return getGroupDetails(groupId);
  } catch (error) {
    console.error('Failed to update group:', error);
    return { data: null, error };
  }
};

export const deleteGroup = async (groupId: string) => {
  try {
    const { error } = await supabase
      .from('community_groups')
      .delete()
      .eq('id', groupId);

    return { data: error ? null : true, error };
  } catch (error) {
    console.error('Failed to delete group:', error);
    return { data: null, error };
  }
};

export const getGroupMembers = async (groupId: string) => {
  try {
    const { data: memberships, error } = await supabase.rpc('get_group_member_profiles', {
      target_group_id: groupId,
    });

    if (error) {
      return { data: null, error };
    }

    if (!memberships || memberships.length === 0) {
      return { data: [], error: null };
    }

    const result: GroupMemberProfile[] = ((memberships || []) as GroupMemberProfileRpcRow[]).map((membership) => {
      const profile = {
        username: membership.username,
        first_name: membership.first_name,
        last_name: membership.last_name,
      };
      return {
        user_id: membership.user_id,
        role: membership.role,
        status: membership.status,
        joined_at: membership.joined_at,
        display_name: buildDisplayName(profile),
        avatar_url: membership.community_use_avatar === false ? null : membership.avatar_url || null,
        username: membership.username || null,
      };
    });

    return { data: result, error: null };
  } catch (error) {
    console.error('Failed to load group members:', error);
    return { data: null, error };
  }
};

export const joinPublicGroup = async (groupId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const { data: group, error: groupError } = await supabase
      .from('community_groups')
      .select('id, visibility')
      .eq('id', groupId)
      .maybeSingle();

    if (groupError) {
      return { data: null, error: groupError };
    }

    if (!group) {
      return { data: null, error: new Error('Gruppe nicht gefunden') };
    }

    if (group.visibility !== 'public') {
      return { data: null, error: new Error('Diese Gruppe ist privat und benötigt eine Einladung.') };
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('community_group_members')
      .upsert(
        {
          group_id: groupId,
          user_id: userData.user.id,
          role: 'member',
          status: 'active',
          joined_at: now,
          created_at: now,
          updated_at: now,
        },
        { onConflict: 'group_id,user_id' },
      );

    if (error) {
      return { data: null, error };
    }

    return getGroupDetails(groupId);
  } catch (error) {
    console.error('Failed to join group:', error);
    return { data: null, error };
  }
};

export const leaveGroup = async (groupId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const { data: membership, error: membershipError } = await supabase
      .from('community_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (membershipError) {
      return { data: null, error: membershipError };
    }

    if (!membership) {
      return { data: null, error: new Error('Du bist kein Mitglied dieser Gruppe.') };
    }

    if (membership.role === 'owner') {
      return { data: null, error: new Error('Als Besitzerin kannst du die Gruppe nicht einfach verlassen.') };
    }

    const { error } = await supabase
      .from('community_group_members')
      .update({ status: 'left', updated_at: new Date().toISOString() })
      .eq('group_id', groupId)
      .eq('user_id', userData.user.id);

    return { data: error ? null : true, error };
  } catch (error) {
    console.error('Failed to leave group:', error);
    return { data: null, error };
  }
};

export const respondToGroupInvite = async (inviteId: string, accept: boolean) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const { data: invite, error: inviteError } = await supabase
      .from('community_group_invites')
      .select('id, group_id, invited_user_id, status')
      .eq('id', inviteId)
      .eq('invited_user_id', userData.user.id)
      .maybeSingle();

    if (inviteError) {
      return { data: null, error: inviteError };
    }

    if (!invite || invite.status !== 'pending') {
      return { data: null, error: new Error('Diese Einladung ist nicht mehr offen.') };
    }

    const nextStatus: GroupInviteStatus = accept ? 'accepted' : 'declined';
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('community_group_invites')
      .update({ status: nextStatus, responded_at: now })
      .eq('id', inviteId)
      .eq('invited_user_id', userData.user.id);

    if (updateError) {
      return { data: null, error: updateError };
    }

    if (accept) {
      const { error: membershipError } = await supabase
        .from('community_group_members')
        .upsert(
          {
            group_id: invite.group_id,
            user_id: userData.user.id,
            role: 'member',
            status: 'active',
            joined_at: now,
            created_at: now,
            updated_at: now,
          },
          { onConflict: 'group_id,user_id' },
        );

      if (membershipError) {
        return { data: null, error: membershipError };
      }
    }

    return getGroupDetails(invite.group_id);
  } catch (error) {
    console.error('Failed to respond to group invite:', error);
    return { data: null, error };
  }
};

export const searchProfilesForGroupInvite = async (groupId: string, query: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const cleanedQuery = query.trim();
    if (cleanedQuery.length < 2) {
      return { data: [], error: null };
    }

    const { data: rpcProfiles, error: rpcError } = await supabase.rpc('search_group_invite_profiles', {
      target_group_id: groupId,
      search_text: cleanedQuery,
    });

    if (!rpcError) {
      const results: GroupUserSearchResult[] = ((rpcProfiles || []) as ProfileRecord[]).map((profile) => ({
        id: profile.id,
        display_name: buildDisplayName(profile),
        username: profile.username || null,
        avatar_url: profile.avatar_url || null,
      }));

      return { data: results, error: null };
    }

    const isMissingRpc =
      rpcError.code === 'PGRST202'
      || rpcError.message?.includes('search_group_invite_profiles');

    if (!isMissingRpc) {
      return { data: null, error: rpcError };
    }

    const [{ data: memberships }, { data: profiles, error }] = await Promise.all([
      supabase
        .from('community_group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('status', 'active'),
      supabase
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url')
        .or(buildInviteSearchFilter(cleanedQuery))
        .limit(20),
    ]);

    if (error) {
      return { data: null, error };
    }

    const candidateProfiles = (profiles || []) as ProfileRecord[];
    if (candidateProfiles.length === 0) {
      return { data: [], error: null };
    }

    const candidateIds = candidateProfiles.map((profile) => profile.id);
    const { data: candidateSettings } = await supabase
      .from('user_settings')
      .select('user_id, community_identity_mode, community_use_avatar, updated_at')
      .in('user_id', candidateIds)
      .not('community_identity_mode', 'is', null)
      .not('community_use_avatar', 'is', null)
      .order('updated_at', { ascending: false });

    const blockedIds = new Set<string>([
      userData.user.id,
      ...((memberships || []).map((membership) => membership.user_id)),
    ]);
    const approvedIds = new Set<string>();

    for (const settings of candidateSettings || []) {
      if (!approvedIds.has(settings.user_id)) {
        approvedIds.add(settings.user_id);
      }
    }

    const results: GroupUserSearchResult[] = candidateProfiles
      .filter((profile) => !blockedIds.has(profile.id))
      .filter((profile) => approvedIds.has(profile.id))
      .filter((profile) => {
        const searchable = [
          profile.username || '',
          profile.first_name || '',
          profile.last_name || '',
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        ]
          .join(' ')
          .toLowerCase();

        return searchable.includes(cleanedQuery.toLowerCase());
      })
      .map((profile) => ({
        id: profile.id,
        display_name: buildDisplayName(profile),
        username: profile.username || null,
        avatar_url: profile.avatar_url || null,
      }));

    return { data: results, error: null };
  } catch (error) {
    console.error('Failed to search invite candidates:', error);
    return { data: null, error };
  }
};

export const inviteUserToGroup = async (groupId: string, invitedUserId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const { data: group, error: groupError } = await supabase
      .from('community_groups')
      .select('id, name, visibility')
      .eq('id', groupId)
      .maybeSingle();

    if (groupError) {
      return { data: null, error: groupError };
    }

    if (!group) {
      return { data: null, error: new Error('Gruppe nicht gefunden') };
    }

    if (group.visibility !== 'private') {
      return { data: null, error: new Error('Einladungen sind nur für private Gruppen nötig.') };
    }

    const [{ data: existingMember }, { data: existingInvite }] = await Promise.all([
      supabase
        .from('community_group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', invitedUserId)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('community_group_invites')
        .select('id')
        .eq('group_id', groupId)
        .eq('invited_user_id', invitedUserId)
        .eq('status', 'pending')
        .maybeSingle(),
    ]);

    if (existingMember) {
      return { data: null, error: new Error('Diese Nutzerin ist bereits Mitglied der Gruppe.') };
    }

    if (existingInvite) {
      return { data: existingInvite as GroupInvite, error: null };
    }

    const { data: invite, error } = await supabase
      .from('community_group_invites')
      .insert({
        group_id: groupId,
        invited_user_id: invitedUserId,
        invited_by_user_id: userData.user.id,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id, group_id, invited_user_id, invited_by_user_id, status, created_at, responded_at')
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: invite as GroupInvite, error: null };
  } catch (error) {
    console.error('Failed to invite user to group:', error);
    return { data: null, error };
  }
};
