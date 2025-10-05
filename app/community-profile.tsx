import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator, FlatList, Text, Alert, ScrollView } from 'react-native';
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
import { GlassCard, LiquidGlassCard, GLASS_OVERLAY } from '@/constants/DesignGuide';
import { FollowButton } from '@/components/FollowButton';

// Interface für das Benutzerprofil
interface UserProfile {
  id: string;
  first_name: string;
  last_name?: string;
  user_role?: string;
  bio?: string;
  created_at: string;
}

// Interface für einen Follower
interface Follower {
  id: string;
  first_name: string;
  last_name?: string;
  user_role?: string;
}

// Enum für Tabs
enum ProfileTab {
  FOLLOWERS = 'followers',
  FOLLOWING = 'following',
  POSTS = 'posts',
  REPLIES = 'replies',
  FAVORITES = 'favorites',
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
  const [activeTab, setActiveTab] = useState<ProfileTab>(ProfileTab.FOLLOWERS);

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
        .select('id, first_name, last_name, user_role, created_at')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData as UserProfile);

      // Follower und Following-Zahlen abrufen
      const { count: followers } = await getFollowerCount(user.id);
      const { count: following } = await getFollowingCount(user.id);

      setFollowersCount(followers);
      setFollowingCount(following);

      // Follower für den ersten Tab laden
      loadFollowers();

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
            .select('id, first_name, last_name, user_role')
            .eq('id', followingId)
            .single();
            
          if (!profileError && profileData) {
            followingUsers.push({
              id: profileData.id,
              first_name: profileData.first_name || 'Benutzer',
              last_name: profileData.last_name || '',
              user_role: profileData.user_role || 'unknown'
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
                user_role: rpcProfile.user_role || 'unknown'
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
            user_role: 'unknown'
          });
          
        } catch (followingError) {
          console.error(`Error processing following user ${followingId}:`, followingError);
          // Füge trotzdem einen Platzhalter hinzu
          followingUsers.push({
            id: followingId,
            first_name: 'Benutzer',
            last_name: '',
            user_role: 'unknown'
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

  // Renderingfunktion für Follower und Following
  const renderUserItem = ({ item }: { item: Follower }) => {
    const roleInfo = getRoleInfo(item.user_role);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => router.push(`/profile/${item.id}` as any)}
      >
        <View style={[styles.userAvatar, { backgroundColor: roleInfo.color }]}>
          <IconSymbol name={roleInfo.icon as any} size={24} color="#FFFFFF" />
        </View>
        <View style={styles.userInfo}>
          <ThemedText style={styles.userNameItem}>
            {item.first_name} {item.last_name}
          </ThemedText>
          <View style={[styles.userRoleTag, { backgroundColor: roleInfo.color }]}>
            <ThemedText style={styles.userRoleText}>{roleInfo.label}</ThemedText>
          </View>
        </View>
        <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
      </TouchableOpacity>
    );
  };

  // Renderingfunktion für Beiträge
  const renderPostItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={styles.postItem}
        onPress={() => router.push(`/community` as any)}
      >
        <View style={styles.postHeader}>
          <IconSymbol name={item.type === 'poll' ? "chart.bar" : "text.bubble"} size={20} color={theme.accent} />
          <ThemedText style={styles.postDate}>{new Date(item.created_at).toLocaleDateString()}</ThemedText>
        </View>
        <ThemedText style={styles.postContent} numberOfLines={2}>
          {item.content}
        </ThemedText>
        <View style={styles.postStats}>
          <View style={styles.postStat}>
            <IconSymbol name="heart" size={16} color={theme.tabIconDefault} />
            <ThemedText style={styles.statText}>{item.likes_count || 0}</ThemedText>
          </View>
          <View style={styles.postStat}>
            <IconSymbol name="bubble.right" size={16} color={theme.tabIconDefault} />
            <ThemedText style={styles.statText}>{item.comments_count || 0}</ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedBackground style={{ backgroundColor: '#F4EFE6' }}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header 
          title="Mein Community-Profil"
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
            <LiquidGlassCard style={styles.profileCard} intensity={26} overlayColor={GLASS_OVERLAY}>
              <View style={styles.profileHeader}>
                {/* Profilbild */}
                <View style={[styles.avatarContainer, { backgroundColor: getRoleInfo(profile.user_role).chipBg }]}>
                  <IconSymbol name={getRoleInfo(profile.user_role).icon as any} size={40} color={getRoleInfo(profile.user_role).chipFg} />
                </View>
                
                {/* Profilinformationen */}
                <View style={styles.nameContainer}>
                  <ThemedText style={styles.userName}>
                    {profile.first_name} {profile.last_name}
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

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.dmButton} onPress={() => Alert.alert('Bald verfügbar', 'Direktnachrichten kommen bald 🎉') }>
                    <IconSymbol name="paperplane.fill" size={18} color={'#FFFFFF'} />
                    <ThemedText style={styles.dmButtonText}>Nachricht</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Statistiken */}
              <View style={styles.statsContainer}>
                <TouchableOpacity 
                  style={[
                    styles.statItem, 
                    activeTab === ProfileTab.FOLLOWERS && styles.activeStatItem
                  ]}
                  onPress={() => setActiveTab(ProfileTab.FOLLOWERS)}
                >
                  <ThemedText style={[
                    styles.statValue, 
                    activeTab === ProfileTab.FOLLOWERS && { color: theme.accent }
                  ]}>
                    {followersCount}
                  </ThemedText>
                  <ThemedText style={styles.statLabel}>Follower</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.statItem, 
                    activeTab === ProfileTab.FOLLOWING && styles.activeStatItem
                  ]}
                  onPress={() => setActiveTab(ProfileTab.FOLLOWING)}
                >
                  <ThemedText style={[
                    styles.statValue, 
                    activeTab === ProfileTab.FOLLOWING && { color: theme.accent }
                  ]}>
                    {followingCount}
                  </ThemedText>
                  <ThemedText style={styles.statLabel}>Folgt</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.statItem, 
                    activeTab === ProfileTab.POSTS && styles.activeStatItem
                  ]}
                  onPress={() => setActiveTab(ProfileTab.POSTS)}
                >
                  <ThemedText style={[
                    styles.statValue, 
                    activeTab === ProfileTab.POSTS && { color: theme.accent }
                  ]}>
                    {posts.length}
                  </ThemedText>
                  <ThemedText style={styles.statLabel}>Beiträge</ThemedText>
                </TouchableOpacity>
              </View>
            </LiquidGlassCard>

            {/* Tabs: Beiträge / Antworten / Favoriten */}
            <View style={styles.tabContainer}>
              {[{ key: ProfileTab.POSTS, label: 'Beiträge' }, { key: ProfileTab.REPLIES, label: 'Antworten' }, { key: ProfileTab.FAVORITES, label: 'Favoriten' }].map(t => (
                <TouchableOpacity key={t.key} style={styles.tabButton} onPress={() => setActiveTab(t.key as ProfileTab)}>
                  <ThemedText style={[styles.tabText, activeTab === t.key && { color: theme.accent, borderBottomWidth: 2, borderBottomColor: theme.accent }]}>
                    {t.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Tab-Inhalte */}
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
                <FlatList
                  data={posts}
                  renderItem={renderPostItem}
                  keyExtractor={(item) => item.id}
                  ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                      <IconSymbol name="text.bubble" size={32} color={theme.tabIconDefault} />
                      <ThemedText style={styles.emptyText}>Keine Beiträge</ThemedText>
                      <ThemedText style={styles.emptySubtext}>Du hast noch keine Beiträge erstellt.</ThemedText>
                    </View>
                  )}
                  contentContainerStyle={styles.flatListContent}
                />
              )}
              {activeTab === ProfileTab.REPLIES && (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="arrowshape.turn.up.left" size={32} color={theme.tabIconDefault} />
                  <ThemedText style={styles.emptyText}>Noch keine Antworten</ThemedText>
                  <ThemedText style={styles.emptySubtext}>Deine Antworten erscheinen hier.</ThemedText>
                </View>
              )}
              {activeTab === ProfileTab.FAVORITES && (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="heart" size={32} color={theme.tabIconDefault} />
                  <ThemedText style={styles.emptyText}>Keine Favoriten</ThemedText>
                  <ThemedText style={styles.emptySubtext}>Markiere Beiträge, um sie hier zu speichern.</ThemedText>
                </View>
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
    flex: 1,
    marginBottom: 20,
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
    padding: 16,
  },
  activeStatItem: {
    borderBottomWidth: 2,
    borderBottomColor: '#9775FA',
  },
  flatListContent: {
    paddingBottom: 20,
  },
}); 
