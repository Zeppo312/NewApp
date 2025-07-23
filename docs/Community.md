# Community-Funktionen Dokumentation

## Überblick

Die Community-Funktionen in der App ermöglichen es Benutzern, miteinander zu interagieren, Beiträge zu teilen, Kommentare zu hinterlassen, anderen Benutzern zu folgen und direkte Nachrichten auszutauschen. Diese Dokumentation bietet einen umfassenden Überblick über alle Komponenten, die mit der Community-Seite verknüpft sind.

## Seiten (Screens)

1. **Community-Hauptseite** (`app/community.tsx`)
   - Zeigt eine Liste von Beiträgen an
   - Ermöglicht das Filtern nach Tags
   - Ermöglicht das Erstellen neuer Beiträge

2. **Benutzer-Profil** (`app/profile/[id].tsx`)
   - Zeigt Profilinformationen eines Benutzers an
   - Enthält Follow/Unfollow-Button
   - Zeigt Chat-Button bei gegenseitigem Folgen an
   - Zeigt Statistiken zu Followern/Following an

3. **Benachrichtigungen** (`app/notifications.tsx`)
   - Tabs: Nachrichten, Follower, Aktivität, Kommentare
   - Zeigt verschiedene Arten von Benachrichtigungen an
   - Ermöglicht das Markieren von Benachrichtigungen als gelesen

4. **Chat** (`app/chat/[id].tsx`)
   - Direkter Chat mit einem anderen Benutzer
   - Anzeige von Chat-Verlauf
   - Senden von neuen Nachrichten

## Komponenten

1. **NotificationsList** (`components/NotificationsList.tsx`)
   - Wiederverwendbare Komponente für Benachrichtigungen
   - Zeigt Benachrichtigungen mit verschiedenen Typen an
   - Ermöglicht Antwort auf Kommentare/Beiträge

2. **FollowButton** (`components/FollowButton.tsx`)
   - Button zum Folgen/Entfolgen von Benutzern
   - Aktualisiert den Follow-Status in Echtzeit
   - Verschiedene Größen und Anzeigeoptionen

3. **PostItem** (`components/PostItem.tsx`)
   - Zeigt einen einzelnen Beitrag an
   - Like-Funktionalität
   - Kommentar-Funktionalität

4. **CommentItem** (`components/CommentItem.tsx`)
   - Zeigt einen Kommentar zu einem Beitrag an
   - Like-Funktionalität
   - Antwort-Funktionalität

## Datenbank-Tabellen

1. **Benutzer und Profile**
   - `profiles`: Grundlegende Benutzerinformationen (Verknüpft mit auth.users)
      - Felder: id, first_name, last_name, user_role, created_at, updated_at

2. **Follow-System**
   - `user_follows`: Speichert Follow-Beziehungen zwischen Benutzern
      - Felder: id, follower_id, following_id, created_at

3. **Beiträge und Kommentare**
   - `community_posts`: Beiträge in der Community
      - Felder: id, user_id, content, type, is_anonymous, image_url, created_at, updated_at
   - `community_comments`: Kommentare zu Beiträgen
      - Felder: id, post_id, user_id, content, is_anonymous, created_at, updated_at
   - `community_nested_comments`: Antworten auf Kommentare
      - Felder: id, parent_comment_id, user_id, content, is_anonymous, created_at, updated_at

4. **Likes**
   - `community_post_likes`: Likes für Beiträge
      - Felder: id, post_id, user_id, created_at
   - `community_comment_likes`: Likes für Kommentare
      - Felder: id, comment_id, user_id, created_at
   - `community_nested_comment_likes`: Likes für verschachtelte Kommentare
      - Felder: id, nested_comment_id, user_id, created_at

5. **Benachrichtigungen**
   - `community_notifications`: Benachrichtigungen für verschiedene Aktivitäten
      - Felder: id, user_id, sender_id, type, content, reference_id, created_at, is_read

6. **Direkte Nachrichten**
   - `direct_messages`: Nachrichten zwischen Benutzern
      - Felder: id, sender_id, receiver_id, content, created_at, is_read

7. **Tags**
   - `community_tags`: Tags für die Kategorisierung von Beiträgen
      - Felder: id, name, category, created_at
   - `community_post_tags`: Verknüpfung zwischen Beiträgen und Tags
      - Felder: id, post_id, tag_id, created_at

## Funktionen

### Community- und Beitrags-Funktionen (`lib/community.ts`)

1. **Beitrags-Management**
   - `getPosts`: Ruft Beiträge ab, mit optionaler Tag-Filterung
   - `createPost`: Erstellt einen neuen Beitrag (Text oder Poll)
   - `deletePost`: Löscht einen Beitrag
   - `togglePostLike`: Like/Unlike eines Beitrags

2. **Kommentar-Management**
   - `getComments`: Holt Kommentare für einen Beitrag
   - `createComment`: Erstellt einen Kommentar zu einem Beitrag
   - `createReply`: Erstellt eine Antwort auf einen Kommentar
   - `deleteComment`: Löscht einen Kommentar
   - `toggleCommentLike`: Like/Unlike eines Kommentars

3. **Benachrichtigungs-Management**
   - `createNotification`: Erstellt eine neue Benachrichtigung
   - `getNotifications`: Ruft Benachrichtigungen für einen Benutzer ab
   - `markNotificationAsRead`: Markiert eine Benachrichtigung als gelesen
   - `markAllNotificationsAsRead`: Markiert alle Benachrichtigungen als gelesen

### Follow-System-Funktionen (`lib/follows.ts`)

1. **Follow-Management**
   - `followUser`: Folgt einem Benutzer (erstellt auch Benachrichtigung)
   - `unfollowUser`: Entfolgt einem Benutzer
   - `isFollowingUser`: Prüft, ob ein Benutzer einem anderen folgt
   - `getFollowedUsers`: Ruft Benutzer ab, denen der aktuelle Benutzer folgt
   - `getFollowers`: Ruft Follower des aktuellen Benutzers ab
   - `getFollowerCount`: Zählt Follower eines Benutzers
   - `getFollowingCount`: Zählt Benutzer, denen ein Benutzer folgt
   - `createMissingFollowNotifications`: Erstellt nachträglich Benachrichtigungen für bestehende Follows

### Benachrichtigungs-Service (`lib/notificationService.ts`)

1. **Benachrichtigungs-Routing**
   - `navigateToNotificationTarget`: Navigiert zum entsprechenden Ziel einer Benachrichtigung
   - `displayNotification`: Zeigt eine Benachrichtigung im Vordergrund an

## Datenfluss und Ereignisse

1. **Follow-Ereignis**
   - Benutzer klickt auf Follow-Button → `followUser` wird aufgerufen
   - Follow-Eintrag wird in `user_follows` erstellt
   - Benachrichtigung wird in `community_notifications` erstellt
   - Empfänger sieht Benachrichtigung im "Follower"-Tab
   - Bei gegenseitigem Folgen erscheint Chat-Button auf Profilseiten

2. **Post-Interaktion**
   - Benutzer erstellt Beitrag → `createPost` wird aufgerufen
   - Beitrag wird in `community_posts` gespeichert
   - Bei Like → `togglePostLike` → Eintrag in `community_post_likes` und Benachrichtigung
   - Bei Kommentar → `createComment` → Eintrag in `community_comments` und Benachrichtigung

3. **Benachrichtigungs-Verarbeitung**
   - Benachrichtigung wird erstellt → Echtzeit-Update durch Supabase-Kanäle
   - Benachrichtigung wird in entsprechendem Tab angezeigt
   - Klick auf Benachrichtigung → `navigateToNotificationTarget` → Navigation zum entsprechenden Inhalt

## Datenbank-Schema Beziehungen

1. **Benutzer und Follow-System**
   - `profiles.id` → `auth.users.id` (1:1)
   - `user_follows.follower_id` → `profiles.id` (N:1)
   - `user_follows.following_id` → `profiles.id` (N:1)

2. **Beiträge und Kommentare**
   - `community_posts.user_id` → `profiles.id` (N:1)
   - `community_comments.post_id` → `community_posts.id` (N:1)
   - `community_comments.user_id` → `profiles.id` (N:1)
   - `community_nested_comments.parent_comment_id` → `community_comments.id` (N:1)
   - `community_nested_comments.user_id` → `profiles.id` (N:1)

3. **Likes**
   - `community_post_likes.post_id` → `community_posts.id` (N:1)
   - `community_post_likes.user_id` → `profiles.id` (N:1)
   - `community_comment_likes.comment_id` → `community_comments.id` (N:1)
   - `community_comment_likes.user_id` → `profiles.id` (N:1)

4. **Benachrichtigungen**
   - `community_notifications.user_id` → `profiles.id` (N:1) (Empfänger)
   - `community_notifications.sender_id` → `profiles.id` (N:1) (Absender)
   - `community_notifications.reference_id` → Verschiedene IDs basierend auf `type`

5. **Direkte Nachrichten**
   - `direct_messages.sender_id` → `profiles.id` (N:1)
   - `direct_messages.receiver_id` → `profiles.id` (N:1)

## Best Practices und Hinweise

1. **Follow-Benachrichtigungen**
   - Bei direkten Datenbankeinträgen in `user_follows` werden keine Benachrichtigungen erstellt
   - Verwende `createMissingFollowNotifications` um fehlende Benachrichtigungen zu erzeugen

2. **UI-Konsistenz**
   - Follow-Status wird in Echtzeit über mehrere Komponenten hinweg aktualisiert
   - Benachrichtigungen werden nach Typ in verschiedenen Tabs angezeigt

3. **Performance-Optimierungen**
   - IDs werden für schnellere Abfragen indiziert
   - Daten werden in kleineren Batches geladen (Lazy Loading)

4. **Fehlerbehandlung**
   - Alle Funktionen enthalten umfangreiche Fehlerbehandlung
   - UI zeigt Fallback-Elemente bei Fehlern oder fehlendem Inhalt an 