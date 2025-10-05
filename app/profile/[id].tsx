import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
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
import { Alert } from 'react-native';

// Interface für das Benutzerprofil
interface UserProfile {
  id: string;
  first_name: string;
  last_name?: string;
  user_role?: string;
  bio?: string;
  created_at: string;
}

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
          .select('id, first_name, last_name, user_role, created_at')
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
  
  const roleInfo = getRoleInfo(profile?.user_role);

  return (
    <ThemedBackground style={{ backgroundColor: '#F4EFE6' }}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header 
          title={isOwnProfile ? "Mein Profil" : (profile ? `${profile.first_name} ${profile.last_name || ''}`.trim() : "Benutzerprofil")}
          subtitle={isOwnProfile ? (profile ? `${profile.first_name} ${profile.last_name || ''}`.trim() : undefined) : undefined}
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
            <LiquidGlassCard style={styles.profileCard} intensity={26} overlayColor={GLASS_OVERLAY}>
              {/* Profilbild und Name */}
              <View style={styles.profileHeader}>
                <View style={[styles.avatarContainer, { backgroundColor: roleInfo.color }]}>
                  <IconSymbol name={roleInfo.icon as any} size={40} color="#FFFFFF" />
                </View>
                
                <View style={styles.nameContainer}>
                  <ThemedText style={styles.userName}>
                    {profile.first_name} {profile.last_name}
                  </ThemedText>
                  
                  <View style={[styles.roleTag, { backgroundColor: roleInfo.color }]}>
                    <ThemedText style={styles.roleText}>{roleInfo.label}</ThemedText>
                  </View>
                  
                  <ThemedText style={styles.joinDate}>
                    Dabei seit {formatJoinDate(profile.created_at)}
                  </ThemedText>
                </View>
                
                {!isOwnProfile && (
                  <FollowButton 
                    userId={profile.id}
                    size="medium"
                    showIcon={false}
                    onFollowStatusChange={handleFollowStatusChange}
                  />
                )}
              </View>
              
              {/* Follower Statistiken */}
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <ThemedText style={[styles.statValue, { color: theme.accent }]}>{followersCount}</ThemedText>
                  <ThemedText style={styles.statLabel}>Follower</ThemedText>
                </View>
                
                <View style={styles.statItem}>
                  <ThemedText style={[styles.statValue, { color: theme.accent }]}>{followingCount}</ThemedText>
                  <ThemedText style={styles.statLabel}>Folgt</ThemedText>
                </View>

                <View style={styles.statItem}>
                  <ThemedText style={[styles.statValue, { color: theme.accent }]}>{posts.length}</ThemedText>
                  <ThemedText style={styles.statLabel}>Beiträge</ThemedText>
                </View>
              </View>
              
              {/* Chat-Button für gegenseitige Follower */}
              {mutualFollow && !isOwnProfile && (
                <TouchableOpacity 
                  style={[styles.chatButton, { backgroundColor: theme.accent }]}
                  onPress={() => {
                    // Zum Chat navigieren
                    router.push(`/chat/${profile.id}` as any);
                  }}
                >
                  <IconSymbol name="envelope.fill" size={20} color="#FFFFFF" />
                  <Text style={styles.chatButtonText}>Nachricht senden</Text>
                </TouchableOpacity>
              )}
            </LiquidGlassCard>

            {/* Benutzerbeiträge */}
            <ThemedView 
              style={[styles.postsContainer, { backgroundColor: theme.card }]} 
              lightColor={theme.card}
              darkColor={theme.card}
            >
              <View style={styles.postsHeader}>
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
                  data={posts}
                  renderItem={renderPostItem}
                  keyExtractor={item => item.id}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                  style={styles.postsList}
                />
              )}
            </ThemedView>
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
    paddingBottom: 30,
  },
  profileCard: {
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
    marginHorizontal: 16,
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
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  joinDate: {
    fontSize: 14,
    opacity: 0.7,
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
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  postItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postDate: {
    fontSize: 14,
    opacity: 0.7,
  },
  postContent: {
    fontSize: 16,
  },
  postStats: {
    flexDirection: 'row',
    marginTop: 8,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    marginLeft: 4,
  },
  postsContainer: {
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  postsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  postsHeaderText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  loadingPostsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPostsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPostsText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  postsList: {
    flex: 1,
  },
});
