import { supabase } from './supabase';

// Typdefinitionen
export interface Post {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_anonymous?: boolean;
  type?: 'text' | 'poll';
  // Virtuelle Felder (werden durch Joins oder clientseitige Berechnungen gefüllt)
  user_name?: string;
  user_role?: string;
  likes_count?: number;
  comments_count?: number;
  has_liked?: boolean;
  poll_id?: string; // ID der zugehörigen Umfrage, falls type === 'poll'
  tags?: Array<{
    id: string;
    name: string;
    category: 'trimester' | 'baby_age';
  }>;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_anonymous?: boolean;
  // Virtuelle Felder
  user_name?: string;
  user_role?: string;
  likes_count?: number;
  has_liked?: boolean;
}

// Beiträge abrufen
export const getPosts = async (searchQuery: string = '', tagIds: string[] = []) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Beiträge abrufen
    let posts;
    let postsError;

    if (tagIds.length > 0) {
      // Wenn Tags ausgewählt sind, verwende die get_posts_with_tags Funktion
      const result = await supabase
        .rpc('get_posts_with_tags', { tag_ids: tagIds });
      posts = result.data;
      postsError = result.error;
    } else {
      // Normale Abfrage ohne Tag-Filter
      const result = await supabase
        .from('community_posts')
        .select()
        .order('created_at', { ascending: false });
      posts = result.data;
      postsError = result.error;
    }

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      return { data: null, error: postsError };
    }

    // Für jeden Beitrag die Benutzerinformationen, Likes und Kommentare abrufen
    const postsWithCounts = await Promise.all(posts.map(async (post) => {
      // DIREKTER ANSATZ: Benutzerinformationen direkt aus der Datenbank abrufen
      console.log(`Fetching profile for user_id: ${post.user_id}`);

      // Versuche zuerst, das Profil über die id zu finden
      let profile = null;
      let profileError = null;

      // Direkte SQL-Abfrage, um das Profil zu finden
      const { data: profileData, error: profileErr } = await supabase
        .rpc('get_user_profile', { user_id_param: post.user_id });

      if (profileErr) {
        console.error(`Error fetching profile by id for user_id ${post.user_id}:`, profileErr);
        profileError = profileErr;
      } else if (profileData && profileData.length > 0) {
        profile = profileData[0];
        console.log(`Profile found by id for user_id ${post.user_id}:`, profile);
      }

      // Wenn kein Profil gefunden wurde, versuche es mit einer direkten Abfrage der profiles-Tabelle
      if (!profile) {
        const { data: directProfileData, error: directProfileErr } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, user_role')
          .eq('id', post.user_id)
          .single();

        if (directProfileErr) {
          console.error(`Error fetching profile directly for user_id ${post.user_id}:`, directProfileErr);
        } else if (directProfileData) {
          profile = directProfileData;
          console.log(`Profile found directly for user_id ${post.user_id}:`, profile);
        }
      }

      // Wenn immer noch kein Profil gefunden wurde, erstelle ein Platzhalter-Profil
      if (!profile) {
        console.warn(`No profile found for user_id ${post.user_id}. Creating a placeholder.`);

        // Erstelle ein Platzhalter-Profil für diesen Benutzer
        try {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: post.user_id,
              first_name: 'Benutzer',  // Platzhalter-Name
              last_name: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) {
            console.error(`Error creating placeholder profile for ${post.user_id}:`, insertError);
          } else if (newProfile) {
            profile = newProfile;
            console.log(`Created placeholder profile for ${post.user_id}:`, profile);
          }
        } catch (e) {
          console.error(`Exception creating placeholder profile for ${post.user_id}:`, e);
        }
      }

      // Likes für diesen Beitrag zählen
      const { count: likesCount, error: likesError } = await supabase
        .from('community_post_likes')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', post.id);

      if (likesError) {
        console.error('Error counting likes:', likesError);
      }

      // Kommentare für diesen Beitrag zählen
      const { count: commentsCount, error: commentsError } = await supabase
        .from('community_comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', post.id);

      if (commentsError) {
        console.error('Error counting comments:', commentsError);
      }

      // Prüfen, ob der aktuelle Benutzer diesen Beitrag geliked hat
      const { data: userLike, error: userLikeError } = await supabase
        .from('community_post_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (userLikeError) {
        console.error('Error checking user like:', userLikeError);
      }

      // Detaillierte Debug-Ausgabe
      console.log(`Post ${post.id} raw data:`, JSON.stringify(post));
      console.log(`Post ${post.id} profile:`, profile ? JSON.stringify(profile) : 'null');

      // Überprüfe, ob die user_id in der profiles-Tabelle existiert
      if (!profile) {
        console.warn(`No profile found for user_id ${post.user_id}. This might be a data integrity issue.`);
        // Wir können nicht direkt auf auth.users zugreifen, aber wir können versuchen,
        // andere Informationen über den Benutzer zu finden
        try {
          // Versuche, andere Beiträge des Benutzers zu finden
          const { data: otherPosts, error: otherPostsError } = await supabase
            .from('community_posts')
            .select('id')
            .eq('user_id', post.user_id)
            .neq('id', post.id)
            .limit(1);

          console.log(`Other posts by user ${post.user_id}:`, otherPosts ? otherPosts.length : 0);

          if (otherPostsError) {
            console.error(`Error fetching other posts for user ${post.user_id}:`, otherPostsError);
          }
        } catch (e) {
          console.error(`Error in additional user checks for ${post.user_id}:`, e);
        }
      }

      // Überprüfe, ob der Beitrag anonym ist
      // Wichtig: Wir müssen explizit prüfen, ob is_anonymous true ist
      // Bei false oder undefined/null sollte der Benutzername angezeigt werden
      const isAnonymous = post.is_anonymous === true;

      console.log(`Post ${post.id} is_anonymous:`, post.is_anonymous, 'isAnonymous:', isAnonymous);

      // Wenn nicht anonym und ein Profil gefunden wurde, zeige den Vornamen an
      // Wichtig: Wir müssen sicherstellen, dass profile und first_name existieren
      let userName = 'Anonym';

      if (!isAnonymous && profile && profile.first_name) {
        userName = profile.first_name;
      }

      // Wenn der Beitrag vom aktuellen Benutzer stammt, füge "(Du)" hinzu
      if (post.user_id === userData.user.id) {
        userName = isAnonymous ? 'Anonym (Du)' : `${userName} (Du)`;
      }

      console.log(`Post ${post.id} final userName:`, userName, 'profile exists:', !!profile, 'first_name exists:', !!profile?.first_name, 'is current user:', post.user_id === userData.user.id);

      return {
        ...post,
        user_name: userName,
        user_role: isAnonymous ? 'unknown' : (profile?.user_role || 'unknown'),
        likes_count: likesCount || 0,
        comments_count: commentsCount || 0,
        has_liked: !!userLike,
        // Stelle sicher, dass is_anonymous immer einen Wert hat
        is_anonymous: isAnonymous
      };
    }));

    return { data: postsWithCounts, error: null };
  } catch (err) {
    console.error('Failed to get posts:', err);
    return { data: null, error: err };
  }
};

// Kommentare für einen Beitrag abrufen
export const getComments = async (postId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Kommentare abrufen
    const { data: comments, error: commentsError } = await supabase
      .from('community_comments')
      .select()
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      return { data: null, error: commentsError };
    }

    // Für jeden Kommentar die Benutzerinformationen und Likes abrufen
    const commentsWithCounts = await Promise.all(comments.map(async (comment) => {
      // DIREKTER ANSATZ: Benutzerinformationen direkt aus der Datenbank abrufen
      console.log(`Fetching profile for comment user_id: ${comment.user_id}`);

      // Versuche zuerst, das Profil über die id zu finden
      let profile = null;
      let profileError = null;

      // Direkte SQL-Abfrage, um das Profil zu finden
      const { data: profileData, error: profileErr } = await supabase
        .rpc('get_user_profile', { user_id_param: comment.user_id });

      if (profileErr) {
        console.error(`Error fetching profile by id for comment user_id ${comment.user_id}:`, profileErr);
        profileError = profileErr;
      } else if (profileData && profileData.length > 0) {
        profile = profileData[0];
        console.log(`Profile found by id for comment user_id ${comment.user_id}:`, profile);
      }

      // Wenn kein Profil gefunden wurde, versuche es mit einer direkten Abfrage der profiles-Tabelle
      if (!profile) {
        const { data: directProfileData, error: directProfileErr } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, user_role')
          .eq('id', comment.user_id)
          .single();

        if (directProfileErr) {
          console.error(`Error fetching profile directly for comment user_id ${comment.user_id}:`, directProfileErr);
        } else if (directProfileData) {
          profile = directProfileData;
          console.log(`Profile found directly for comment user_id ${comment.user_id}:`, profile);
        }
      }

      // Wenn immer noch kein Profil gefunden wurde, erstelle ein Platzhalter-Profil
      if (!profile) {
        console.warn(`No profile found for comment user_id ${comment.user_id}. Creating a placeholder.`);

        // Erstelle ein Platzhalter-Profil für diesen Benutzer
        try {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: comment.user_id,
              first_name: 'Benutzer',  // Platzhalter-Name
              last_name: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) {
            console.error(`Error creating placeholder profile for comment ${comment.user_id}:`, insertError);
          } else if (newProfile) {
            profile = newProfile;
            console.log(`Created placeholder profile for comment ${comment.user_id}:`, profile);
          }
        } catch (e) {
          console.error(`Exception creating placeholder profile for comment ${comment.user_id}:`, e);
        }
      }

      // Likes für diesen Kommentar zählen
      const { count: likesCount, error: likesError } = await supabase
        .from('community_comment_likes')
        .select('id', { count: 'exact', head: true })
        .eq('comment_id', comment.id);

      if (likesError) {
        console.error('Error counting comment likes:', likesError);
      }

      // Prüfen, ob der aktuelle Benutzer diesen Kommentar geliked hat
      const { data: userLike, error: userLikeError } = await supabase
        .from('community_comment_likes')
        .select('id')
        .eq('comment_id', comment.id)
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (userLikeError) {
        console.error('Error checking user comment like:', userLikeError);
      }

      // Detaillierte Debug-Ausgabe
      console.log(`Comment ${comment.id} raw data:`, JSON.stringify(comment));
      console.log(`Comment ${comment.id} profile:`, profile ? JSON.stringify(profile) : 'null');

      // Überprüfe, ob der Kommentar anonym ist
      // Wichtig: Wir müssen explizit prüfen, ob is_anonymous true ist
      // Bei false oder undefined/null sollte der Benutzername angezeigt werden
      const isAnonymous = comment.is_anonymous === true;

      console.log(`Comment ${comment.id} is_anonymous:`, comment.is_anonymous, 'isAnonymous:', isAnonymous);

      // Wenn nicht anonym und ein Profil gefunden wurde, zeige den Vornamen an
      let userName = 'Anonym';

      if (!isAnonymous && profile && profile.first_name) {
        userName = profile.first_name;
      }

      // Wenn der Kommentar vom aktuellen Benutzer stammt, füge "(Du)" hinzu
      if (comment.user_id === userData.user.id) {
        userName = isAnonymous ? 'Anonym (Du)' : `${userName} (Du)`;
      }

      console.log(`Comment ${comment.id} final userName:`, userName, 'profile exists:', !!profile, 'first_name exists:', !!profile?.first_name, 'is current user:', comment.user_id === userData.user.id);

      return {
        ...comment,
        user_name: userName,
        user_role: isAnonymous ? 'unknown' : (profile?.user_role || 'unknown'),
        likes_count: likesCount || 0,
        has_liked: !!userLike,
        // Stelle sicher, dass is_anonymous immer einen Wert hat
        is_anonymous: isAnonymous
      };
    }));

    return { data: commentsWithCounts, error: null };
  } catch (err) {
    console.error('Failed to get comments:', err);
    return { data: null, error: err };
  }
};

// Neuen Beitrag erstellen
export const createPost = async (content: string, isAnonymous: boolean = false, type: 'text' | 'poll' = 'text', pollData?: any, tagIds: string[] = []) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Debug-Ausgabe
    console.log('Creating post with is_anonymous:', isAnonymous, 'type:', type);

    // Direkter Ansatz: Explizit is_anonymous setzen
    const insertData = {
      user_id: userData.user.id,
      content,
      is_anonymous: isAnonymous, // Explizit auf true oder false setzen
      type, // 'text' oder 'poll'
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Insert data:', JSON.stringify(insertData));

    // Versuche zuerst mit is_anonymous
    let result = await supabase
      .from('community_posts')
      .insert(insertData)
      .select()
      .single();

    // Wenn es einen Fehler gibt und der Fehler mit is_anonymous zusammenhängt, versuche es ohne
    if (result.error && result.error.message && result.error.message.includes('is_anonymous')) {
      console.log('Error with is_anonymous field, trying without it');
      const { is_anonymous, ...dataWithoutAnonymous } = insertData;
      result = await supabase
        .from('community_posts')
        .insert(dataWithoutAnonymous)
        .select()
        .single();
    }

    const { data, error } = result;

    if (error) {
      console.error('Error creating post:', error);
      return { data: null, error };
    }

    // Wenn es sich um einen Umfrage-Post handelt, erstelle die Umfrage
    if (type === 'poll' && pollData && data) {
      try {
        // Umfrage erstellen
        const { data: poll, error: pollError } = await supabase
          .from('community_polls')
          .insert({
            post_id: data.id,
            question: pollData.question,
            allow_multiple_choices: pollData.allow_multiple_choices || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (pollError) {
          console.error('Error creating poll:', pollError);
          return { data, error: pollError };
        }

        // Optionen für die Umfrage erstellen
        if (poll && pollData.options && pollData.options.length > 0) {
          const optionsToInsert = pollData.options.map((option: string) => ({
            poll_id: poll.id,
            option_text: option,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          const { error: optionsError } = await supabase
            .from('community_poll_options')
            .insert(optionsToInsert);

          if (optionsError) {
            console.error('Error creating poll options:', optionsError);
            return { data, error: optionsError };
          }

          // Füge die Umfrage-ID zum Post hinzu
          return { data: { ...data, poll_id: poll.id }, error: null };
        }
      } catch (pollErr) {
        console.error('Failed to create poll:', pollErr);
        return { data, error: pollErr };
      }
    }

    // Tags zum Beitrag hinzufügen, wenn vorhanden
    if (tagIds.length > 0 && data) {
      try {
        const tagsToInsert = tagIds.map(tagId => ({
          post_id: data.id,
          tag_id: tagId,
          created_at: new Date().toISOString()
        }));

        const { error: tagsError } = await supabase
          .from('community_post_tags')
          .insert(tagsToInsert);

        if (tagsError) {
          console.error('Error adding tags to post:', tagsError);
          // Wir geben den Post trotzdem zurück, auch wenn das Hinzufügen der Tags fehlschlägt
        }
      } catch (tagsErr) {
        console.error('Failed to add tags to post:', tagsErr);
      }
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to create post:', err);
    return { data: null, error: err };
  }
};

// Neuen Kommentar erstellen
export const createComment = async (postId: string, content: string, isAnonymous: boolean = false) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Debug-Ausgabe
    console.log('Creating comment with is_anonymous:', isAnonymous);

    // Direkter Ansatz: Explizit is_anonymous setzen
    const insertData = {
      post_id: postId,
      user_id: userData.user.id,
      content,
      is_anonymous: isAnonymous, // Explizit auf true oder false setzen
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Insert data:', JSON.stringify(insertData));

    // Versuche zuerst mit is_anonymous
    let result = await supabase
      .from('community_comments')
      .insert(insertData)
      .select()
      .single();

    // Wenn es einen Fehler gibt und der Fehler mit is_anonymous zusammenhängt, versuche es ohne
    if (result.error && result.error.message && result.error.message.includes('is_anonymous')) {
      console.log('Error with is_anonymous field, trying without it');
      const { is_anonymous, ...dataWithoutAnonymous } = insertData;
      result = await supabase
        .from('community_comments')
        .insert(dataWithoutAnonymous)
        .select()
        .single();
    }

    const { data, error } = result;

    if (error) {
      console.error('Error creating comment:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to create comment:', err);
    return { data: null, error: err };
  }
};

// Beitrag liken oder Unlike
export const togglePostLike = async (postId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Prüfen, ob der Benutzer den Beitrag bereits geliked hat
    const { data: existingLike, error: checkError } = await supabase
      .from('community_post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing like:', checkError);
      return { data: null, error: checkError };
    }

    let result;

    if (existingLike) {
      // Unlike: Like entfernen
      result = await supabase
        .from('community_post_likes')
        .delete()
        .eq('id', existingLike.id);
    } else {
      // Like hinzufügen
      result = await supabase
        .from('community_post_likes')
        .insert({
          post_id: postId,
          user_id: userData.user.id,
          created_at: new Date().toISOString()
        });
    }

    if (result.error) {
      console.error('Error toggling post like:', result.error);
      return { data: null, error: result.error };
    }

    return { data: { liked: !existingLike }, error: null };
  } catch (err) {
    console.error('Failed to toggle post like:', err);
    return { data: null, error: err };
  }
};

// Kommentar liken oder Unlike
export const toggleCommentLike = async (commentId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Prüfen, ob der Benutzer den Kommentar bereits geliked hat
    const { data: existingLike, error: checkError } = await supabase
      .from('community_comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing comment like:', checkError);
      return { data: null, error: checkError };
    }

    let result;

    if (existingLike) {
      // Unlike: Like entfernen
      result = await supabase
        .from('community_comment_likes')
        .delete()
        .eq('id', existingLike.id);
    } else {
      // Like hinzufügen
      result = await supabase
        .from('community_comment_likes')
        .insert({
          comment_id: commentId,
          user_id: userData.user.id,
          created_at: new Date().toISOString()
        });
    }

    if (result.error) {
      console.error('Error toggling comment like:', result.error);
      return { data: null, error: result.error };
    }

    return { data: { liked: !existingLike }, error: null };
  } catch (err) {
    console.error('Failed to toggle comment like:', err);
    return { data: null, error: err };
  }
};

// Beitrag löschen
export const deletePost = async (postId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error deleting post:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to delete post:', err);
    return { data: null, error: err };
  }
};

// Kommentar löschen
export const deleteComment = async (commentId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('community_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error deleting comment:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to delete comment:', err);
    return { data: null, error: err };
  }
};
