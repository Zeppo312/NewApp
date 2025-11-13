import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator, FlatList, Text, Alert, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getFollowerCount, getFollowingCount, getFollowers } from '@/lib/follows';
import Header from '@/components/Header';
import { getPosts } from '@/lib/community';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiquidGlassCard } from '@/constants/DesignGuide';
import { FollowButton } from '@/components/FollowButton';

// Interface für das Benutzerprofil
interface UserProfile {
  id: string;
  first_name: string;
  last_name?: string;
  user_role?: string;
  username?: string | null;
  avatar_url?: string | null;
  bio?: string;
  created_at: string;
}

// Interface für einen Follower
interface Follower {
  id: string;
  first_name: string;
  last_name?: string;
  user_role?: string;
  username?: string | null;
  avatar_url?: string | null;
}

type NamedEntity = {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

// Enum für Tabs
enum ProfileTab {
  FOLLOWERS = 'followers',
  FOLLOWING = 'following',
  POSTS = 'posts',
}

export default function CommunityProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Follower[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Standardmäßig Beiträge anzeigen
  const [activeTab, setActiveTab] = useState<ProfileTab>(ProfileTab.POSTS);

  // Benutzerprofil und Statistiken laden
  useEffect(() => {
    loadProfileData();
  }, [user]);

  // Daten basierend auf dem aktiven Tab laden
  useEffect(() => {
    if (profile) {
      switch (activeTab) {
        case ProfileTab.FOLLOWERS:
          loadFollowers();
          break;
        case ProfileTab.FOLLOWING:
          loadFollowing();
          break;
        case ProfileTab.POSTS:
          loadUserPosts();
          break;
      }
    }
  }, [activeTab, profile]);

  // Profilinformationen und Statistiken laden
  const loadProfileData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Benutzerinformationen abrufen
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_role, username, avatar_url, created_at')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData as UserProfile);

      // Follower und Following-Zahlen abrufen
      const { count: followers } = await getFollowerCount(user.id);
      const { count: following } = await getFollowingCount(user.id);

      setFollowersCount(followers);
      setFollowingCount(following);

      // Follower & Following laden (für Friends/Stories-Zeile)
      loadFollowers();
      loadFollowing();

    } catch (error) {
      console.error('Fehler beim Laden der Profildaten:', error);
      Alert.alert('Fehler', 'Beim Laden der Profildaten ist ein Fehler aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  // Follower laden
  const loadFollowers = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await getFollowers();

      if (error) throw error;
      setFollowers(data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Follower:', error);
      Alert.alert('Fehler', 'Beim Laden der Follower ist ein Fehler aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  // Following laden
  const loadFollowing = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log(`Getting following users for user ${user.id}`);

      // Benutzer abrufen, denen der aktuelle Benutzer folgt
      const { data, error } = await supabase
        .from('user_follows')
        .select(`following_id`)
        .eq('follower_id', user.id);

      if (error) throw error;

      console.log(`Found ${data?.length || 0} following users, fetching their profiles`);

      // Für jeden gefolgten Benutzer das Profil abrufen
      const followingUsers = [];
      
      for (const followingRelation of data || []) {
        const followingId = followingRelation.following_id as string;
        
        try {
          // Versuche zuerst, das Profil über die profiles-Tabelle zu finden
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, user_role, username, avatar_url')
            .eq('id', followingId)
            .single();
            
          if (!profileError && profileData) {
            followingUsers.push({
              id: profileData.id,
              first_name: profileData.first_name || 'Benutzer',
              last_name: profileData.last_name || '',
              user_role: profileData.user_role || 'unknown',
              username: profileData.username || null,
              avatar_url: profileData.avatar_url || null,
            });
            continue;
          }
          
          // Wenn das nicht funktioniert hat, versuche es mit der get_user_profile-Funktion
          if (profileError) {
            console.log(`Profile not found directly for user ${followingId}, trying RPC method`);
            const { data: rpcData, error: rpcError } = await supabase
              .rpc('get_user_profile', { user_id_param: followingId });
              
            if (!rpcError && rpcData && rpcData.length > 0) {
            const rpcProfile = rpcData[0];
            followingUsers.push({
              id: followingId,
              first_name: rpcProfile.first_name || 'Benutzer',
              last_name: rpcProfile.last_name || '',
              user_role: rpcProfile.user_role || 'unknown',
              username: rpcProfile.username || null,
              avatar_url: rpcProfile.avatar_url || null,
            });
            continue;
          }
          }
          
          // Falls wir immer noch kein Profil haben, erstelle einen Platzhalter
          console.log(`No profile found for user ${followingId}, creating placeholder`);
        followingUsers.push({
          id: followingId,
          first_name: 'Benutzer',
          last_name: '',
          user_role: 'unknown',
          username: null,
          avatar_url: null,
        });
          
        } catch (followingError) {
          console.error(`Error processing following user ${followingId}:`, followingError);
          // Füge trotzdem einen Platzhalter hinzu
          followingUsers.push({
            id: followingId,
            first_name: 'Benutzer',
            last_name: '',
            user_role: 'unknown',
            username: null,
          });
        }
      }

      console.log(`Successfully fetched ${followingUsers.length} following profiles`);
      setFollowing(followingUsers);
    } catch (error) {
      console.error('Fehler beim Laden der gefolgten Benutzer:', error);
      Alert.alert('Fehler', 'Beim Laden der gefolgten Benutzer ist ein Fehler aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  // Beiträge des Benutzers laden
  const loadUserPosts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Use the userId parameter in getPosts to filter posts
      const { data, error } = await getPosts('', [], user.id);

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Beiträge:', error);
      Alert.alert('Fehler', 'Beim Laden der Beiträge ist ein Fehler aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  // Bilder für Profilrollen definieren
  const getRoleInfo = (role?: string) => {
    switch (role) {
      case 'mama':
        return {
          chipBg: '#9775FA', // purple
          chipFg: '#FFFFFF',
          badge: '💜 Mama',
          label: 'Mama',
          icon: 'person.fill'
        };
      case 'papa':
        return {
          chipBg: '#4DA3FF', // blue
          chipFg: '#FFFFFF',
          badge: '💙 Papa',
          label: 'Papa',
          icon: 'person.fill'
        };
      case 'admin':
        return {
          chipBg: '#9775FA',
          chipFg: '#FFFFFF',
          badge: '🛡️ Admin',
          label: 'Administrator',
          icon: 'shield.fill'
        };
      default:
        return {
          chipBg: '#E6E6E6',
          chipFg: '#333333',
          badge: '🤍 Elternteil',
          label: 'Elternteil',
          icon: 'person.fill'
        };
    }
  };

  // Format für das Beitrittsdatum
  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long'
    });
  };

  const getProfileDisplayName = (entity?: NamedEntity | null) => {
    if (!entity) return 'Profil';
    const username = entity.username?.trim();
    if (username) return username;
    const first = entity.first_name?.trim() || '';
    const last = entity.last_name?.trim() || '';
    const fallback = `${first} ${last}`.trim();
    return fallback || 'Profil';
  };

  const getProfileInitials = (entity?: NamedEntity | null) => {
    const displayName = getProfileDisplayName(entity).replace(/\s+/g, '');
    const alphanumeric = displayName.replace(/[^A-Za-z0-9]/g, '');
    if (alphanumeric.length >= 2) return alphanumeric.slice(0, 2).toUpperCase();
    if (alphanumeric.length === 1) return alphanumeric.toUpperCase();
    const fallback = `${entity?.first_name?.[0] || ''}${entity?.last_name?.[0] || ''}`.trim();
    return fallback ? fallback.toUpperCase() : 'LB';
  };

  // Renderingfunktion für Follower und Following
  const renderUserItem = ({ item }: { item: Follower }) => {
    const roleInfo = getRoleInfo(item.user_role);
    const displayName = getProfileDisplayName(item);
    const avatarUrl = item.avatar_url;

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => router.push(`/profile/${item.id}` as any)}
      >
        <View style={[styles.userAvatar, { backgroundColor: roleInfo.chipBg }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.userAvatarImage} />
          ) : (
            <IconSymbol name={roleInfo.icon as any} size={24} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.userInfo}>
          <ThemedText style={styles.userNameItem}>
            {displayName}
          </ThemedText>
          <View style={[styles.userRoleTag, { backgroundColor: roleInfo.chipBg }]}>
            <ThemedText style={styles.userRoleText}>{roleInfo.label}</ThemedText>
          </View>
        </View>
        <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
      </TouchableOpacity>
    );
  };

  // Renderingfunktion für Beiträge
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return 'Heute';
    if (diffInDays === 1) return 'Gestern';
    if (diffInDays < 7) return `Vor ${diffInDays} Tagen`;
    return date.toLocaleDateString('de-DE');
  };

  const getAvatar = (item: any) => {
    if (item.is_anonymous) return { label: '👤', bg: 'rgba(0,0,0,0.08)' };
    const name = (item.user_name || '').trim();
    const initial = name ? name.charAt(0).toUpperCase() : '👶';
    const bg = profile?.user_role === 'mama' ? 'rgba(255,159,159,0.25)' : profile?.user_role === 'papa' ? 'rgba(159,216,255,0.25)' : 'rgba(0,0,0,0.08)';
    return { label: initial, bg, uri: item.user_avatar_url };
  };

  const renderFeedItem = ({ item }: { item: any }) => {
    const avatar = getAvatar(item);
    return (
      <LiquidGlassCard style={styles.feedCard} intensity={28} overlayColor={'rgba(255,255,255,0.18)'} borderColor={'rgba(255,255,255,0.4)'}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/community', params: { postId: item.id } } as any)}>
          <View style={styles.feedInner}>
            <View style={styles.postHeaderRow}>
              <View style={styles.userInfoRow}>
                <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
                  {avatar.uri ? (
                    <Image source={{ uri: avatar.uri }} style={styles.avatarImage} />
                  ) : (
                    <ThemedText style={styles.avatarText}>{item.is_anonymous ? '🍼' : avatar.label}</ThemedText>
                  )}
                </View>
                <ThemedText style={styles.userNameText}>{item.user_name || 'Anonym'}</ThemedText>
                <ThemedText style={styles.postDateText}>{formatDate(item.created_at)}</ThemedText>
              </View>
            </View>

            <ThemedText style={styles.postBodyText}>{item.content}</ThemedText>

            {!!item.image_url && (
              <View style={styles.postImageContainer}> 
                <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
              </View>
            )}

            <View style={[styles.postActionsRow, { borderTopColor: colorScheme === 'dark' ? theme.border : '#EFEFEF' }]}>
              <View style={styles.actionItem}>
                <IconSymbol name={item.has_liked ? 'heart.fill' : 'heart'} size={18} color={item.has_liked ? '#FF6B6B' : theme.tabIconDefault} />
                <ThemedText style={styles.actionCount}>{item.likes_count || 0}</ThemedText>
              </View>
              <View style={styles.actionItem}>
                <IconSymbol name="bubble.right" size={18} color={theme.tabIconDefault} />
                <ThemedText style={styles.actionCount}>{item.comments_count || 0}</ThemedText>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </LiquidGlassCard>
    );
  };

  return (
    <ThemedBackground style={{ backgroundColor: '#F6F0FF' }}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header 
          title="Profil"
          showBackButton
          onBackPress={() => router.back()}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>Profil wird geladen...</ThemedText>
          </View>
        ) : !profile ? (
          <View style={styles.errorContainer}>
            <IconSymbol name="person.crop.circle.badge.exclamationmark" size={48} color={theme.error} />
            <ThemedText style={styles.errorTitle}>Fehler beim Laden</ThemedText>
            <ThemedText style={styles.errorText}>
              Dein Community-Profil konnte nicht geladen werden. Bitte versuche es später erneut.
            </ThemedText>
          </View>
        ) : (
          // Hauptansicht für das geladene Profil
          <ScrollView 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Profilkarte im Liquid Glass */}
            <LiquidGlassCard style={styles.profileCard} intensity={32} overlayColor={'rgba(255,255,255,0.22)'} borderColor={'rgba(255,255,255,0.55)'}>
              <View style={styles.profileHeader}>
                {/* Profilbild */}
                <View style={[styles.avatarContainer, { backgroundColor: getRoleInfo(profile.user_role).chipBg }]}>
                  {profile.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImage} />
                  ) : (
                    <IconSymbol name={getRoleInfo(profile.user_role).icon as any} size={40} color={getRoleInfo(profile.user_role).chipFg} />
                  )}
                </View>
                
                {/* Profilinformationen */}
                <View style={styles.nameContainer}>
                  <ThemedText style={styles.userName}>
                    {getProfileDisplayName(profile)}
                  </ThemedText>
                  
                  <View style={[styles.roleChip, { backgroundColor: getRoleInfo(profile.user_role).chipBg }]}> 
                    <ThemedText style={[styles.roleChipText, { color: getRoleInfo(profile.user_role).chipFg }]}>
                      {getRoleInfo(profile.user_role).badge}
                    </ThemedText>
                  </View>
                  
                  <ThemedText style={styles.joinDate}>
                    Dabei seit {formatJoinDate(profile.created_at)}
                  </ThemedText>
                </View>

                {/* Actions entfernt auf eigenem Profil */}
              </View>
              
              {/* Statistiken */}
              <View style={styles.statsContainer}>
                {/* Beiträge links */}
                <TouchableOpacity 
                  style={[styles.statItem, activeTab === ProfileTab.POSTS && styles.activeStatItem]}
                  onPress={() => setActiveTab(ProfileTab.POSTS)}
                >
                  <ThemedText style={[styles.statValue, activeTab === ProfileTab.POSTS && { color: theme.accent }]}>
                    {posts.length}
                  </ThemedText>
                  <ThemedText style={styles.statLabel}>Beiträge</ThemedText>
                </TouchableOpacity>

                {/* Follower in der Mitte */}
                <TouchableOpacity 
                  style={[styles.statItem, activeTab === ProfileTab.FOLLOWERS && styles.activeStatItem]}
                  onPress={() => setActiveTab(ProfileTab.FOLLOWERS)}
                >
                  <ThemedText style={[styles.statValue, activeTab === ProfileTab.FOLLOWERS && { color: theme.accent }]}>
                    {followersCount}
                  </ThemedText>
                  <ThemedText style={styles.statLabel}>Follower</ThemedText>
                </TouchableOpacity>

                {/* Folgt rechts */}
                <TouchableOpacity 
                  style={[styles.statItem, activeTab === ProfileTab.FOLLOWING && styles.activeStatItem]}
                  onPress={() => setActiveTab(ProfileTab.FOLLOWING)}
                >
                  <ThemedText style={[styles.statValue, activeTab === ProfileTab.FOLLOWING && { color: theme.accent }]}>
                    {followingCount}
                  </ThemedText>
                  <ThemedText style={styles.statLabel}>Folgt</ThemedText>
                </TouchableOpacity>
              </View>
            </LiquidGlassCard>

            {/* Friends/Following – IG-Stories-Style Row */}
            <View style={styles.friendsSection}>
              <View style={styles.friendsHeaderRow}>
                <ThemedText style={styles.friendsTitle}>Freunde</ThemedText>
                <TouchableOpacity onPress={() => setActiveTab(ProfileTab.FOLLOWING)}>
                  <ThemedText style={styles.friendsAction}>Alle ansehen</ThemedText>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsRow}>
                {(following.length > 0 ? following : followers).slice(0, 12).map((u) => {
                  const role = getRoleInfo(u.user_role);
                  const initials = getProfileInitials(u);
                  const displayName = getProfileDisplayName(u);
                  const hasAvatar = !!u.avatar_url;
                  return (
                    <TouchableOpacity key={u.id} style={styles.friendItem} onPress={() => router.push(`/profile/${u.id}` as any)}>
                      <LinearGradient
                        colors={[ '#FEDA75', '#F58529', '#DD2A7B', '#8134AF', '#515BD4' ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.friendRing}
                      >
                        <View style={[styles.friendCircle, { backgroundColor: role.chipBg }]}>
                          {hasAvatar ? (
                            <Image source={{ uri: u.avatar_url! }} style={styles.friendAvatarImage} />
                          ) : (
                            <ThemedText style={[styles.friendInitials, { color: role.chipFg }]}>{initials}</ThemedText>
                          )}
                        </View>
                      </LinearGradient>
                      <ThemedText style={styles.friendName} numberOfLines={1}>
                        {displayName}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
                {following.length === 0 && followers.length === 0 && (
                  <View style={styles.friendsEmpty}>
                    <IconSymbol name="person.2" size={20} color={theme.tabIconDefault} />
                    <ThemedText style={styles.friendsEmptyText}>Noch keine Freunde</ThemedText>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Inhalte (Posts als Standard) */}
            <View style={styles.tabContent}>
              {activeTab === ProfileTab.FOLLOWERS && (
                <FlatList
                  data={followers}
                  renderItem={renderUserItem}
                  keyExtractor={(item) => item.id}
                  ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                      <IconSymbol name="person.2.slash" size={32} color={theme.tabIconDefault} />
                      <ThemedText style={styles.emptyText}>Keine Follower</ThemedText>
                      <ThemedText style={styles.emptySubtext}>Du hast noch keine Follower.</ThemedText>
                    </View>
                  )}
                  contentContainerStyle={styles.flatListContent}
                />
              )}
              {activeTab === ProfileTab.FOLLOWING && (
                <FlatList
                  data={following}
                  renderItem={renderUserItem}
                  keyExtractor={(item) => item.id}
                  ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                      <IconSymbol name="person.2.slash" size={32} color={theme.tabIconDefault} />
                      <ThemedText style={styles.emptyText}>Folgt niemandem</ThemedText>
                      <ThemedText style={styles.emptySubtext}>Du folgst noch keinem anderen Benutzer.</ThemedText>
                    </View>
                  )}
                  contentContainerStyle={styles.flatListContent}
                />
              )}
              {activeTab === ProfileTab.POSTS && (
                posts.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <IconSymbol name="text.bubble" size={32} color={theme.tabIconDefault} />
                    <ThemedText style={styles.emptyText}>Keine Beiträge</ThemedText>
                    <ThemedText style={styles.emptySubtext}>Du hast noch keine Beiträge erstellt.</ThemedText>
                  </View>
                ) : (
                  <FlatList
                    data={posts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderFeedItem}
                    contentContainerStyle={{ paddingTop: 4, paddingBottom: 12 }}
                  />
                )
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  profileCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(151,117,250,0.35)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#9775FA',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  // Feed styles (Community-like)
  feedCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  feedInner: {
    padding: 16,
  },
  postHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    resizeMode: 'cover',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A4A4A',
  },
  userNameText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  postDateText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  postBodyText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
  },
  postImageContainer: {
    marginTop: 6,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  postActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionCount: {
    marginLeft: 6,
    fontSize: 14,
    color: '#888',
  },
  friendsSection: {
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(151,117,250,0.18)',
    shadowColor: '#9775FA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  friendsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  friendsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  friendsAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9775FA',
  },
  friendsRow: {
    paddingHorizontal: 4,
  },
  friendItem: {
    width: 68,
    marginRight: 10,
    alignItems: 'center',
  },
  friendRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  friendCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEE',
    overflow: 'hidden',
  },
  friendAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  friendInitials: {
    fontSize: 18,
    fontWeight: '800',
  },
  friendName: {
    fontSize: 12,
    maxWidth: 64,
  },
  friendsEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  friendsEmptyText: {
    marginLeft: 6,
    fontSize: 13,
    opacity: 0.7,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileAvatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
    resizeMode: 'cover',
  },
  nameContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roleChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  joinDate: {
    fontSize: 14,
    opacity: 0.7,
  },
  actionsRow: {
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9775FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  dmButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    justifyContent: 'space-around',
  },
  tabButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  contentContainer: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  loadingContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    resizeMode: 'cover',
  },
  userInfo: {
    flex: 1,
  },
  userNameItem: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userRoleTag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  userRoleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  postItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  postContent: {
    fontSize: 16,
    marginBottom: 12,
  },
  postStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    paddingTop: 12,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    marginLeft: 4,
    fontSize: 14,
    opacity: 0.7,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  tabContent: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(151,117,250,0.15)',
    shadowColor: '#9775FA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 24,
  },
  activeStatItem: {
    borderBottomWidth: 2,
    borderBottomColor: '#9775FA',
  },
  flatListContent: {
    paddingBottom: 20,
  },
}); 
