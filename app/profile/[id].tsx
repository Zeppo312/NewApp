import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, ActivityIndicator, FlatList, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getFollowerCount, getFollowingCount, isFollowingUser } from '@/lib/follows';
import { FollowButton } from '@/components/FollowButton';
import Header from '@/components/Header';
import { getPosts } from '@/lib/community';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiquidGlassCard } from '@/constants/DesignGuide';
import { TagDisplay } from '@/components/TagDisplay';

// Interface für das Benutzerprofil
interface UserProfile {
  id: string;
  first_name: string;
  last_name?: string;
  user_role?: string;
  username?: string | null;
  bio?: string;
  avatar_url?: string | null;
  created_at: string;
}

// Follower/Following Minimaltyp für Friends-Zeile
interface Follower {
  id: string;
  first_name: string;
  last_name?: string;
  user_role?: string;
  username?: string | null;
  avatar_url?: string | null;
}

const TEXT_PRIMARY = '#5A3A2C';
const TEXT_MUTED = 'rgba(90,58,44,0.75)';
const POST_CARD_OVERLAY = 'rgba(255,255,255,0.78)';
const CONTENT_MAX_WIDTH = 520;

export default function ProfileScreen() {
  const { id } = useLocalSearchParams();
  const userId = Array.isArray(id) ? id[0] : id as string;
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mutualFollow, setMutualFollow] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<Follower[]>([]);

  // Benutzerposts laden
  const loadUserPosts = async (userId: string) => {
    try {
      setLoadingPosts(true);
      console.log(`Loading posts for user ${userId}`);
      
      const { data, error } = await getPosts('', [], userId);
      
      if (error) throw error;
      
      // Filtere anonyme Posts heraus, wenn es nicht das eigene Profil ist
      let filteredPosts = data || [];
      if (!isOwnProfile) {
        filteredPosts = filteredPosts.filter(post => !post.is_anonymous);
      }
      
      console.log(`Found ${filteredPosts.length} non-anonymous posts for user ${userId}`);
      setPosts(filteredPosts);
    } catch (error) {
      console.error('Fehler beim Laden der Beiträge:', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  // Following-Liste für Profilnutzer laden (für Friends/Stories-Zeile)
  const loadFollowingUsers = async (ownerId: string) => {
    try {
      // hole alle following_ids, denen dieser Profilnutzer folgt
      const { data, error } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', ownerId);
      if (error) throw error;

      const list: Follower[] = [];
      for (const rel of data || []) {
        const fid = rel.following_id as string;
        try {
          const { data: p, error: perr } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, user_role, username, avatar_url')
            .eq('id', fid)
            .single();
          if (!perr && p) {
            list.push({
              id: p.id,
              first_name: p.first_name || 'Benutzer',
              last_name: p.last_name || '',
              user_role: p.user_role || 'unknown',
              username: p.username || null,
              avatar_url: p.avatar_url || null,
            });
            continue;
          }
          if (perr) {
            const { data: rpcData } = await supabase.rpc('get_user_profile', { user_id_param: fid });
            if (rpcData && rpcData.length > 0) {
              list.push({
                id: fid,
                first_name: rpcData[0].first_name || 'Benutzer',
                last_name: rpcData[0].last_name || '',
                user_role: rpcData[0].user_role || 'unknown',
                username: rpcData[0].username || null,
                avatar_url: rpcData[0].avatar_url || null,
              });
              continue;
            }
          }
          list.push({ id: fid, first_name: 'Benutzer', last_name: '', user_role: 'unknown', username: null, avatar_url: null });
        } catch (e) {
          list.push({ id: fid, first_name: 'Benutzer', last_name: '', user_role: 'unknown', username: null, avatar_url: null });
        }
      }
      setFollowingUsers(list);
    } catch (e) {
      // silently ignore friends row issues
    }
  };

  // Benutzerinformationen und Statistiken laden
  useEffect(() => {
    async function loadProfileData() {
      try {
        setLoading(true);
        console.log(`Loading profile data for user ID: ${userId}`);
        
        // Prüfen, ob es das eigene Profil ist
        if (user && user.id === userId) {
          setIsOwnProfile(true);
        }
        
        // Mehrere Methoden verwenden, um das Profil zu finden
        let profileData = null;
        
        // 1. Erst versuchen, das Profil direkt aus der profiles Tabelle zu laden
        const { data: directProfileData, error: directProfileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, user_role, username, avatar_url, created_at')
          .eq('id', userId)
          .single();
          
        if (!directProfileError && directProfileData) {
          console.log(`Found profile directly for user ${userId}`);
          profileData = directProfileData;
        } else {
          console.log(`Direct profile lookup failed: ${directProfileError?.message}`);
          
          // 2. Falls das fehlschlägt, versuche die RPC-Methode
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_user_profile', { user_id_param: userId });
            
          if (!rpcError && rpcData && rpcData.length > 0) {
            console.log(`Found profile via RPC for user ${userId}`);
            profileData = {
              id: userId,
              first_name: rpcData[0].first_name || 'Benutzer',
              last_name: rpcData[0].last_name || '',
              user_role: rpcData[0].user_role || '',
              username: rpcData[0].username || null,
              avatar_url: rpcData[0].avatar_url || null,
              created_at: rpcData[0].created_at || new Date().toISOString()
            };
          } else {
            console.log(`RPC profile lookup failed: ${rpcError?.message}`);
            
            // 3. Als letzten Ausweg, prüfe die user_settings Tabelle
            const { data: settingsData, error: settingsError } = await supabase
              .from('user_settings')
              .select('first_name, last_name, username, created_at')
              .eq('user_id', userId)
              .single();
              
            if (!settingsError && settingsData) {
              console.log(`Found settings for user ${userId}`);
              profileData = {
                id: userId,
                first_name: settingsData.first_name || settingsData.username || 'Benutzer',
                last_name: settingsData.last_name || '',
                user_role: '',
                username: settingsData.username || null,
                avatar_url: null,
                created_at: settingsData.created_at || new Date().toISOString()
              };
            } else {
              console.log(`Settings lookup failed: ${settingsError?.message}`);
              
              // 4. Wenn nichts funktioniert hat, erstelle ein Platzhalter-Profil
              console.log(`Creating placeholder profile for user ${userId}`);
              profileData = {
                id: userId,
                first_name: 'Benutzer',
                last_name: '',
                user_role: '',
                username: null,
                avatar_url: null,
                created_at: new Date().toISOString()
              };
              
              // Optional: Versuche, dieses Platzhalter-Profil in der Datenbank zu speichern
              try {
                await supabase
                  .from('profiles')
                  .upsert({
                    id: userId,
                    first_name: 'Benutzer',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
                console.log(`Created placeholder profile in database for user ${userId}`);
              } catch (createError) {
                console.error(`Error creating placeholder profile: ${createError}`);
              }
            }
          }
        }
        
        // Profildaten setzen, egal auf welchem Weg wir sie bekommen haben
        if (profileData) {
          setProfile(profileData as UserProfile);
        }
        
        // Follower und Following-Zahlen abrufen
        const { count: followers } = await getFollowerCount(userId);
        const { count: following } = await getFollowingCount(userId);
        
        setFollowersCount(followers);
        setFollowingCount(following);
        
        // Prüfen ob gegenseitiges Folgen besteht
        if (user && !isOwnProfile) {
          await checkMutualFollowStatus();
        }
        
        // Lade die Beiträge des Benutzers
        await loadUserPosts(userId);
        // Lade deren Following-Liste (für Friends-Zeile)
        await loadFollowingUsers(userId);
        
      } catch (error) {
        console.error('Fehler beim Laden der Profildaten:', error);
      } finally {
        setLoading(false);
      }
    }
    
    // Separate Funktion zur Prüfung des gegenseitigen Folgen-Status
    async function checkMutualFollowStatus() {
      if (!user || isOwnProfile) return;
      
      console.log(`Checking mutual follow between current user ${user.id} and profile user ${userId}`);
      
      // Prüfen, ob der aktuelle Benutzer diesem Benutzer folgt
      const { isFollowing: iFollow } = await isFollowingUser(userId);
      console.log(`Current user follows profile user: ${iFollow}`);
      
      // Prüfen, ob dieser Benutzer dem aktuellen Benutzer folgt
      const { data: theyFollowMe, error: followError } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', userId)
        .eq('following_id', user.id)
        .maybeSingle();
        
      console.log(`Profile user follows current user: ${!!theyFollowMe}`);
      
      if (followError) {
        console.error("Error checking if profile user follows current user:", followError);
      }
      
      const isMutualFollow = iFollow && !!theyFollowMe;
      console.log(`Mutual follow status: ${isMutualFollow}`);
      setMutualFollow(isMutualFollow);
    }
    
    loadProfileData();
  }, [userId, user]);
  
  // Bilder für Profilrollen definieren
  const getRoleInfo = (role?: string) => {
    switch (role) {
      case 'mama':
        return { 
          color: '#FF9F9F', 
          label: 'Mama',
          icon: 'person.fill'
        };
      case 'papa':
        return { 
          color: '#9FD8FF', 
          label: 'Papa',
          icon: 'person.fill'
        };
      case 'admin':
        return { 
          color: '#9775FA', 
          label: 'Administrator',
          icon: 'shield.fill'
        };
      default:
        return { 
          color: '#D9D9D9', 
          label: 'Benutzer',
          icon: 'person.fill'
        };
    }
  };
  
  // Aktualisiere den mutual-follow Status, wenn sich der Follow-Status ändert
  const handleFollowStatusChange = (isFollowing: boolean) => {
    if (isFollowing) {
      setFollowersCount(prev => prev + 1);
      // Prüfe erneut den mutual follow status
      if (user && !isOwnProfile) {
        // Prüfen, ob dieser Benutzer dem aktuellen Benutzer folgt
        supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', userId)
          .eq('following_id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            // Wenn die andere Person bereits folgt, ist es jetzt ein mutual follow
            if (data) {
              console.log(`Setting mutual follow to true after follow`);
              setMutualFollow(true);
            }
          });
      }
    } else {
      setFollowersCount(prev => Math.max(0, prev - 1));
      // Bei Unfollow ist es definitiv kein mutual follow mehr
      setMutualFollow(false);
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

  type NamedEntity = {
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
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

  // Post-Helfer wie Community-Feed
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
  
  const getPostEmoji = (item: any) => {
    const txt = (item.content || '').toLowerCase();
    const hasTag = (key: string) => (item.tags || []).some((t: any) => t.name?.toLowerCase().includes(key));
    if (txt.includes('still') || txt.includes('flasch') || hasTag('fütter')) return '🍼';
    if (txt.includes('schlaf') || txt.includes('müd') || hasTag('schlaf')) return '🌙';
    if (txt.includes('windel') || txt.includes('kack') || txt.includes('stuhl')) return '💩';
    if (txt.includes('herz') || txt.includes('liebe')) return '❤️';
    if (txt.includes('?') || txt.includes('hilfe')) return '❓';
    return '💬';
  };

  // Renderingfunktion für Beiträge – Community-Style Karten
  const renderPostItem = ({ item }: { item: any }) => {
    const avatar = getAvatar(item);
    const iconEmoji = getPostEmoji(item);
    const dateLabel = formatDate(item.created_at);
    const displayName = item.is_anonymous ? 'Anonym' : (item.user_name || 'Profil');
    const roleLabel = !item.is_anonymous ? getRoleInfo(item.user_role).label : null;
    const metaLineParts = [roleLabel, dateLabel].filter(Boolean);
    const metaLine = metaLineParts.join(' · ');

    const handleProfilePress = () => {
      if (!item.is_anonymous && item.user_id) {
        router.push(`/profile/${item.user_id}` as any);
      }
    };

    return (
      <LiquidGlassCard
        style={styles.feedCard}
        intensity={24}
        overlayColor={POST_CARD_OVERLAY}
        borderColor={'rgba(255,255,255,0.4)'}
      >
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => router.push({ pathname: '/community', params: { postId: item.id } } as any)}
        >
          <View style={styles.feedInner}>
            <View style={styles.postHeaderRow}>
              <TouchableOpacity
                style={styles.userInfoRow}
                onPress={handleProfilePress}
                disabled={item.is_anonymous}
                activeOpacity={item.is_anonymous ? 1 : 0.85}
              >
                <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
                  {avatar.uri ? (
                    <Image source={{ uri: avatar.uri }} style={styles.avatarImage} />
                  ) : (
                    <ThemedText style={styles.avatarText}>{item.is_anonymous ? '🍼' : avatar.label}</ThemedText>
                  )}
                </View>
                <View style={styles.metaContainer}>
                  <ThemedText style={[styles.userNameText, { color: theme.accent }]} numberOfLines={1}>
                    {displayName}
                  </ThemedText>
                  {metaLine.length > 0 && (
                    <ThemedText style={styles.metaSubLine} numberOfLines={1}>
                      {metaLine}
                    </ThemedText>
                  )}
                </View>
              </TouchableOpacity>
              <ThemedText style={styles.postEmoji}>{iconEmoji}</ThemedText>
            </View>

            {item.tags && item.tags.length > 0 && (
              <View style={styles.tagRow}>
                <TagDisplay tags={item.tags} small />
              </View>
            )}

            <ThemedText style={styles.postBodyText}>{item.content}</ThemedText>

            {!!item.image_url && (
              <View style={styles.postImageContainer}>
                <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
              </View>
            )}

            <View style={[styles.postActionsRow, { borderTopColor: colorScheme === 'dark' ? theme.border : '#EFEFEF' }]}>
              <View style={styles.actionItem}>
                <IconSymbol
                  name={item.has_liked ? 'heart.fill' : 'heart'}
                  size={18}
                  color={item.has_liked ? '#FF6B6B' : theme.tabIconDefault}
                />
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
  
  const roleInfo = getRoleInfo(profile?.user_role);
  const profileInitials = getProfileInitials(profile);

  return (
    <ThemedBackground style={{ backgroundColor: '#F4EFE6' }}>
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
            <IconSymbol name="exclamationmark.triangle" size={48} color="#FF6B6B" />
            <ThemedText style={styles.errorTitle}>Profil nicht gefunden</ThemedText>
            <ThemedText style={styles.errorText}>
              Das gesuchte Profil konnte nicht gefunden werden oder existiert nicht.
            </ThemedText>
          </View>
        ) : (
          // Hauptansicht für das geladene Profil
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            <LiquidGlassCard
              style={styles.profileCard}
              intensity={32}
              overlayColor="rgba(255,255,255,0.18)"
              borderColor="rgba(255,255,255,0.5)"
            >
              <View style={styles.profileGlassContent}>
                {/* Profilbild und Name */}
                <View style={styles.profileHeader}>
                  <View style={styles.avatarGlassWrapper}>
                    <BlurView intensity={42} tint="light" style={StyleSheet.absoluteFill} />
                    <View style={[styles.avatarGlassBorder, { borderColor: roleInfo.color }]} />
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImage} />
                    ) : (
                      <View style={[styles.avatarFallback, { backgroundColor: roleInfo.color }]}>
                        <ThemedText style={styles.avatarFallbackText}>{profileInitials}</ThemedText>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.nameContainer}>
                    <ThemedText style={styles.userName}>
                      {getProfileDisplayName(profile)}
                    </ThemedText>
                    
                    <View style={[styles.roleChip, { backgroundColor: roleInfo.color }]}>
                      <ThemedText style={styles.roleChipText}>{roleInfo.label}</ThemedText>
                    </View>
                    
                    <ThemedText style={styles.joinDate}>
                      Dabei seit {formatJoinDate(profile.created_at)}
                    </ThemedText>
                  </View>
                </View>

                {!isOwnProfile && (
                  <View style={styles.profileActions}>
                    <FollowButton 
                      userId={profile.id}
                      size="medium"
                      showIcon={false}
                      onFollowStatusChange={handleFollowStatusChange}
                      style={styles.followButton}
                    />
                    <TouchableOpacity 
                      style={[styles.dmButton, { backgroundColor: theme.accent }]}
                      onPress={() => router.push(`/chat/${profile.id}` as any)}
                    >
                      <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.dmButtonText}>Direktnachricht</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}

                {mutualFollow && !isOwnProfile && (
                  <ThemedText style={[styles.mutualBadge, { color: theme.accent }]}>
                    Ihr folgt euch gegenseitig
                  </ThemedText>
                )}
                
                {/* Statistiken: Beiträge (links), Follower (mitte), Folgt (rechts) */}
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <ThemedText style={[styles.statValue, { color: theme.accent }]}>{posts.length}</ThemedText>
                    <ThemedText style={styles.statLabel}>Beiträge</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText style={[styles.statValue, { color: theme.accent }]}>{followersCount}</ThemedText>
                    <ThemedText style={styles.statLabel}>Follower</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText style={[styles.statValue, { color: theme.accent }]}>{followingCount}</ThemedText>
                    <ThemedText style={styles.statLabel}>Folgt</ThemedText>
                  </View>
                </View>
              </View>
            </LiquidGlassCard>

            {/* Friends/Following – IG-Stories-Style Row */}
            <LiquidGlassCard
              style={styles.friendsSection}
              intensity={28}
              overlayColor="rgba(255,255,255,0.18)"
              borderColor="rgba(255,255,255,0.4)"
            >
              <View style={styles.friendsGlassContent}>
                <View style={styles.friendsHeaderRow}>
                  <ThemedText style={styles.friendsTitle}>Freunde</ThemedText>
                  {!!followingUsers?.length && (
                    <TouchableOpacity onPress={() => {}}>
                      <ThemedText style={styles.friendsAction}>Alle ansehen</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsRow}>
                  {(followingUsers || []).slice(0, 12).map((u) => {
                    const initials = getProfileInitials(u);
                    const displayName = getProfileDisplayName(u);
                    const hasAvatar = !!u.avatar_url;
                    const chipBg = u.user_role === 'mama' ? '#9775FA' : u.user_role === 'papa' ? '#4DA3FF' : '#E6E6E6';
                    const chipFg = u.user_role === 'mama' || u.user_role === 'papa' ? '#FFFFFF' : '#333333';
                    return (
                      <TouchableOpacity key={u.id} style={styles.friendItem} onPress={() => router.push(`/profile/${u.id}` as any)}>
                        <LinearGradient
                          colors={[ '#FEDA75', '#F58529', '#DD2A7B', '#8134AF', '#515BD4' ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.friendRing}
                        >
                          <View style={[styles.friendCircle, { backgroundColor: chipBg }]}>
                            {hasAvatar ? (
                              <Image source={{ uri: u.avatar_url! }} style={styles.friendAvatarImage} />
                            ) : (
                              <ThemedText style={[styles.friendInitials, { color: chipFg }]}>{initials}</ThemedText>
                            )}
                          </View>
                        </LinearGradient>
                        <ThemedText style={styles.friendName} numberOfLines={1}>
                          {displayName}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                  {(!followingUsers || followingUsers.length === 0) && (
                    <View style={styles.friendsEmpty}>
                      <IconSymbol name="person.2" size={20} color={theme.tabIconDefault} />
                      <ThemedText style={styles.friendsEmptyText}>Noch keine Freunde</ThemedText>
                    </View>
                  )}
                </ScrollView>
              </View>
            </LiquidGlassCard>

            {/* Benutzerbeiträge – Community-Style Feed */}
            <LiquidGlassCard
              style={styles.postsSection}
              intensity={28}
              overlayColor="rgba(255,255,255,0.18)"
              borderColor="rgba(255,255,255,0.4)"
            >
              <View style={styles.postsGlassContent}>
                <View style={styles.postsHeaderContainer}>
                  <ThemedText style={styles.postsHeaderText}>Beiträge</ThemedText>
                </View>
                {loadingPosts ? (
                  <View style={styles.loadingPostsContainer}>
                    <ActivityIndicator size="small" color={theme.accent} />
                    <ThemedText style={styles.loadingText}>Beiträge werden geladen...</ThemedText>
                  </View>
                ) : posts.length === 0 ? (
                  <View style={styles.emptyPostsContainer}>
                    <IconSymbol name="text.bubble" size={32} color={theme.tabIconDefault} />
                    <ThemedText style={styles.emptyPostsText}>
                      {isOwnProfile 
                        ? "Du hast noch keine Beiträge erstellt." 
                        : "Dieser Benutzer hat noch keine Beiträge erstellt."}
                    </ThemedText>
                  </View>
                ) : (
                  <FlatList
                    style={styles.postsList}
                    data={posts}
                    renderItem={renderPostItem}
                    keyExtractor={item => item.id}
                    scrollEnabled={false}
                    nestedScrollEnabled={true}
                    contentContainerStyle={styles.postsListContent}
                  />
                )}
              </View>
            </LiquidGlassCard>
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
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  profileCard: {
    marginBottom: 24,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    borderRadius: 28,
  },
  profileGlassContent: {
    padding: 24,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarGlassWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  avatarGlassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    resizeMode: 'cover',
  },
  nameContainer: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  roleChip: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'center',
    marginBottom: 4,
  },
  roleChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  joinDate: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  followButton: {
    minWidth: 120,
    marginRight: 12,
    marginBottom: 8,
  },
  dmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginBottom: 8,
  },
  dmButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 14,
  },
  mutualBadge: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 12, 
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
  postsSection: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  postsGlassContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  postsHeaderContainer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  postsHeaderText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  // Feed styles
  feedCard: {
    marginBottom: 16,
    borderRadius: 24,
    width: '100%',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  feedInner: {
    paddingVertical: 16,
    paddingHorizontal: 20,
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
    flexShrink: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
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
  metaContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  userNameText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  metaSubLine: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_MUTED,
    marginTop: 2,
  },
  postEmoji: {
    fontSize: 18,
    marginLeft: 12,
  },
  tagRow: {
    marginBottom: 8,
  },
  postBodyText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
    color: TEXT_PRIMARY,
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 0.5,
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
    marginTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionCount: {
    marginLeft: 6,
    fontSize: 14,
    color: TEXT_MUTED,
  },
  // Friends row
  friendsSection: {
    marginTop: 12,
    marginBottom: 20,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  friendsGlassContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  friendsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  friendsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  friendsAction: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
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
    borderRadius: 28,
  },
  friendInitials: {
    fontSize: 18,
    fontWeight: '800',
  },
  friendName: {
    fontSize: 12,
    maxWidth: 64,
    textAlign: 'center',
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
  loadingPostsContainer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyPostsContainer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF',
  },
  emptyPostsText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  postsList: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  postsListContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
});
