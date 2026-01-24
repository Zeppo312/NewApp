import { supabase } from './supabase';
import { getCachedUser } from './supabase';
import { createNotification } from './community';

// Interface für einen Follow
export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

// Interface für einen Benutzer mit Follow-Status
export interface UserWithFollow {
  id: string;
  first_name: string;
  last_name?: string;
  user_role?: string;
  username?: string | null;
  is_following: boolean;
}

/**
 * Folge einem Benutzer
 * @param userId Die ID des Benutzers, dem gefolgt werden soll
 */
export const followUser = async (userId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData?.user) return { success: false, error: 'Nicht angemeldet' };

    console.log(`User ${userData.user.id} is attempting to follow user ${userId}`);

    // Prüfen ob der Benutzer bereits gefolgt wird
    const { isFollowing, error: checkError } = await isFollowingUser(userId);
    
    if (checkError) {
      console.error('Fehler beim Prüfen des Follow-Status:', checkError);
      return { success: false, error: checkError };
    }
    
    if (isFollowing) {
      console.log(`User ${userData.user.id} already follows user ${userId}`);
      return { success: true, data: null };
    }

    // Dem Benutzer folgen
    const { data, error } = await supabase
      .from('user_follows')
      .insert({
        follower_id: userData.user.id,
        following_id: userId,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Fehler beim Folgen:', error);
      return { success: false, error: error.message };
    }

    console.log(`User ${userData.user.id} successfully followed user ${userId}`);

    // Benutzerinformationen für die Benachrichtigung abrufen
    const { data: userData2 } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userData.user.id)
      .single();

    // Namen für die Benachrichtigung erstellen
    const firstName = userData2?.first_name || 'Ein Benutzer';
    const lastName = userData2?.last_name || '';
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    console.log(`Creating follow notification from ${fullName} to user ${userId}`);

    // Erstelle eine Benachrichtigung für den gefolgten Benutzer
    const { data: notificationData, error: notificationError } = await createNotification(
      userId,              // Empfänger der Benachrichtigung 
      'follow',            // Benachrichtigungstyp
      userData.user.id,    // Die reference_id ist die ID des Followers
      `${fullName} folgt dir jetzt` // Benachrichtigungstext
    );
    
    console.log("Notification creation result:", notificationData);

    return { success: true, data };
  } catch (error) {
    console.error('Fehler beim Folgen:', error);
    return { success: false, error };
  }
};

/**
 * Entfolge einem Benutzer
 * @param userId Die ID des Benutzers, dem entfolgt werden soll
 */
export const unfollowUser = async (userId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData?.user) return { success: false, error: 'Nicht angemeldet' };

    const { error } = await supabase
      .from('user_follows')
      .delete()
      .match({
        follower_id: userData.user.id,
        following_id: userId
      });

    if (error) {
      console.error('Fehler beim Entfolgen:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Fehler beim Entfolgen:', error);
    return { success: false, error };
  }
};

/**
 * Prüft, ob der aktuelle Benutzer einem anderen Benutzer folgt
 * @param userId Die ID des Benutzers, für den der Status geprüft werden soll
 */
export const isFollowingUser = async (userId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData?.user) return { isFollowing: false, error: 'Nicht angemeldet' };

    const { data, error } = await supabase
      .rpc('is_following', {
        follower_id_param: userData.user.id,
        following_id_param: userId
      });

    if (error) {
      console.error('Fehler beim Prüfen des Folge-Status:', error);
      return { isFollowing: false, error: error.message };
    }

    return { isFollowing: data || false, error: null };
  } catch (error) {
    console.error('Fehler beim Prüfen des Folge-Status:', error);
    return { isFollowing: false, error };
  }
};

/**
 * Holt eine Liste aller Benutzer, denen der aktuelle Benutzer folgt
 */
export const getFollowedUsers = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData?.user) return { data: null, error: 'Nicht angemeldet' };

    const { data, error } = await supabase
      .rpc('get_followed_users_with_profiles', {
        user_id_param: userData.user.id
      });

    if (error) {
      console.error('Fehler beim Abrufen der gefolgten Benutzer:', error);
      return { data: null, error: error.message };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Fehler beim Abrufen der gefolgten Benutzer:', error);
    return { data: null, error };
  }
};

/**
 * Holt die Anzahl der Follower eines Benutzers
 * @param userId Die ID des Benutzers, für den die Anzahl geholt werden soll
 */
export const getFollowerCount = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_follower_count', {
        user_id_param: userId
      });

    if (error) {
      console.error('Fehler beim Abrufen der Follower-Anzahl:', error);
      return { count: 0, error: error.message };
    }

    return { count: data || 0, error: null };
  } catch (error) {
    console.error('Fehler beim Abrufen der Follower-Anzahl:', error);
    return { count: 0, error };
  }
};

/**
 * Holt die Anzahl der Benutzer, denen ein Benutzer folgt
 * @param userId Die ID des Benutzers, für den die Anzahl geholt werden soll
 */
export const getFollowingCount = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_following_count', {
        user_id_param: userId
      });

    if (error) {
      console.error('Fehler beim Abrufen der Following-Anzahl:', error);
      return { count: 0, error: error.message };
    }

    return { count: data || 0, error: null };
  } catch (error) {
    console.error('Fehler beim Abrufen der Following-Anzahl:', error);
    return { count: 0, error };
  }
};

/**
 * Ruft alle Benutzer ab, die dem aktuellen Benutzer in der Community folgen
 */
export const getFollowers = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData?.user) return { data: null, error: 'Nicht angemeldet' };

    console.log(`Getting followers for user ${userData.user.id}`);

    // Benutzer abrufen, die dem aktuellen Benutzer folgen
    const { data, error } = await supabase
      .from('user_follows')
      .select(`
        follower_id
      `)
      .eq('following_id', userData.user.id);

    if (error) {
      console.error('Fehler beim Abrufen der Follower:', error);
      return { data: null, error: error.message };
    }

    console.log(`Found ${data?.length || 0} followers, fetching their profiles`);

    // Für jeden Follower das Profil abrufen
    const followers = [];
    
    for (const followerRelation of data || []) {
      const followerId = followerRelation.follower_id as string;
      
      try {
        // Versuche zuerst, das Profil über die profiles-Tabelle zu finden
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, user_role, username')
          .eq('id', followerId)
          .single();
          
        if (!profileError && profileData) {
          followers.push({
            id: profileData.id,
            first_name: profileData.first_name || 'Benutzer',
            last_name: profileData.last_name || '',
            user_role: profileData.user_role || 'unknown',
            username: profileData.username || null,
          });
          continue;
        }
        
        // Wenn das nicht funktioniert hat, versuche es mit der get_user_profile-Funktion
        if (profileError) {
          console.log(`Profile not found directly for user ${followerId}, trying RPC method`);
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_user_profile', { user_id_param: followerId });
            
          if (!rpcError && rpcData && rpcData.length > 0) {
            const rpcProfile = rpcData[0];
            followers.push({
              id: followerId,
              first_name: rpcProfile.first_name || 'Benutzer',
              last_name: rpcProfile.last_name || '',
              user_role: rpcProfile.user_role || 'unknown',
              username: rpcProfile.username || null,
            });
            continue;
          }
        }
        
        // Falls wir immer noch kein Profil haben, erstelle einen Platzhalter
        console.log(`No profile found for user ${followerId}, creating placeholder`);
        followers.push({
          id: followerId,
          first_name: 'Benutzer',
          last_name: '',
          user_role: 'unknown',
          username: null,
        });
        
      } catch (followerError) {
        console.error(`Error processing follower ${followerId}:`, followerError);
        // Füge trotzdem einen Platzhalter hinzu
        followers.push({
          id: followerId,
          first_name: 'Benutzer',
          last_name: '',
          user_role: 'unknown',
          username: null,
        });
      }
    }

    console.log(`Successfully fetched ${followers.length} follower profiles`);
    return { data: followers, error: null };
  } catch (error) {
    console.error('Fehler beim Abrufen der Follower:', error);
    return { data: [], error }; // Return empty array instead of null to avoid rendering errors
  }
};

/**
 * Erstellt nachträglich Benachrichtigungen für bestehende Follower
 * Diese Funktion kann einmalig aufgerufen werden, um Benachrichtigungen für bestehende Follow-Beziehungen zu erstellen
 */
export const createMissingFollowNotifications = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData?.user) return { success: false, error: 'Nicht angemeldet' };

    console.log(`Looking for missing follow notifications for user ${userData.user.id}`);

    // 1. Hole alle Benutzer, die dem aktuellen Benutzer folgen
    const { data: followers, error: followersError } = await supabase
      .from('user_follows')
      .select('follower_id, created_at')
      .eq('following_id', userData.user.id);
    
    if (followersError) {
      console.error('Fehler beim Laden der Follower:', followersError);
      return { success: false, error: followersError.message };
    }

    console.log(`Found ${followers?.length || 0} followers`);
    
    // 2. Prüfe für jeden Follower, ob eine Benachrichtigung existiert
    const missingNotifications = [];
    
    for (const follower of followers || []) {
      // Prüfe, ob bereits eine Benachrichtigung vorhanden ist
      const { data: existingNotifications, error: notificationError } = await supabase
        .from('community_notifications')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('sender_id', follower.follower_id)
        .eq('type', 'follow');
      
      if (notificationError) {
        console.error('Fehler beim Prüfen der Benachrichtigungen:', notificationError);
        continue;
      }
      
      // Wenn keine Benachrichtigung existiert, erstelle eine
      if (!existingNotifications || existingNotifications.length === 0) {
        missingNotifications.push(follower);
      }
    }
    
    console.log(`Found ${missingNotifications.length} missing notifications`);
    
    // 3. Erstelle fehlende Benachrichtigungen
    const createdNotifications = [];
    
    for (const follower of missingNotifications) {
      // Benutzerinformationen für die Benachrichtigung abrufen
      const { data: followerProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', follower.follower_id)
        .single();

      // Namen für die Benachrichtigung erstellen
      const firstName = followerProfile?.first_name || 'Ein Benutzer';
      const lastName = followerProfile?.last_name || '';
      const fullName = lastName ? `${firstName} ${lastName}` : firstName;

      console.log(`Creating follow notification from ${fullName} to user ${userData.user.id}`);

      // Erstelle eine Benachrichtigung für den gefolgten Benutzer
      const { data, error: notificationError } = await createNotification(
        userData.user.id,     // Empfänger der Benachrichtigung 
        'follow',             // Benachrichtigungstyp
        follower.follower_id, // Die reference_id ist die ID des Followers
        `${fullName} folgt dir jetzt` // Benachrichtigungstext
      );
      
      if (notificationError) {
        console.error('Fehler beim Erstellen der Benachrichtigung:', notificationError);
        continue;
      }
      
      // ID aus dem Ergebnis extrahieren
      let notificationId = 'unknown';
      if (data && typeof data === 'object') {
        const notificationData = data as Record<string, any>;
        if ('id' in notificationData) {
          notificationId = notificationData.id as string;
        }
      }
      
      createdNotifications.push({
        follower_id: follower.follower_id,
        notification_id: notificationId
      });
    }
    
    return { 
      success: true, 
      data: { 
        created: createdNotifications.length,
        notifications: createdNotifications 
      } 
    };
  } catch (error) {
    console.error('Fehler beim Erstellen fehlender Benachrichtigungen:', error);
    return { success: false, error };
  }
}; 
