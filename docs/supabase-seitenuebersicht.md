# Supabase-Aufrufe pro Screen (exakt)

Direkte `supabase.*`-Aufrufe je Screen/Route. Wrapper-Funktionen sind nur aufgeführt, wenn der Screen nichts Direktes ruft.

## Auth / Onboarding
- `app/(auth)/login.tsx`
  - `supabase.auth.signInWithPassword({ email, password })`
  - `supabase.auth.signUp({ email, password })`
  - Demo-Check: `supabaseUrl.includes('example.supabase.co')`
  - Apple: `supabase.auth.signInWithIdToken({ provider:'apple', token, nonce })`
  - Profil-Check: `supabase.from('profiles').select('first_name, is_baby_born').eq('id', userId).single()`
  - Invitation (registrieren, optional): Wrapper `redeemInvitationCode` (siehe `lib/redeemInvitationCode.ts`, dort `account_links`, `user_settings`, RPC `direct_update_invitation`, `sync_sleep_entries_for_partner`)
- `app/(auth)/verify-otp.tsx`
  - `supabase.auth.verifyOtp({ email, token, type:'email' })`
  - `supabase.auth.resend({ type:'signup', email })`
- `app/(auth)/verify-email.tsx`
  - `supabase.auth.resend({ type:'signup', email })`
  - `supabase.auth.getUser()` (in `checkEmailVerification`)
- `app/auth/callback.tsx`
  - `supabase.auth.exchangeCodeForSession(code)`
  - `supabase.auth.getSession()`
  - `supabase.from('profiles').select('first_name, is_baby_born').eq('id', session.user.id).single()`
- `app/auth/reset-password.tsx`
  - `supabase.auth.exchangeCodeForSession(code)`
  - `supabase.auth.getSession()`
  - `supabase.auth.updateUser({ password })`
- `app/(auth)/getUserInfo.tsx`
  - `supabase.from('profiles').upsert({ id: user.id, first_name, last_name, user_role, updated_at })`
  - `supabase.from('user_settings').select('id').eq('user_id', user.id).maybeSingle()`
  - `supabase.from('user_settings').update(...)` / `insert(...)` (due_date, is_baby_born, theme, notifications_enabled)
  - Baby-Daten via `saveBabyInfo` (lib/baby: `babies`, `baby_members`, ggf. `baby_links`)
- `app/app-settings.tsx`
  - Wrapper `getAppSettings` → `user_settings.select('*').eq('user_id', userId)...maybeSingle()`
  - Wrapper `saveAppSettings` → `user_settings.select('id')` + `update`/`insert`

## Due Date / Schwangerschaft
- `app/pregnancy-stats.tsx`
  - `supabase.from('user_settings').select('due_date').eq('user_id', user.id)...maybeSingle()`
  - RPC `supabase.rpc('update_due_date_and_sync', { p_user_id, p_due_date })`
- `app/baby-size.tsx`
  - RPC `supabase.rpc('get_due_date_with_linked_users', { p_user_id })`

## Account-Linking / Partner
- `app/account-linking.tsx`
  - Wrapper `getUserInvitations` → RPC `get_user_invitations_with_info(p_user_id)`
  - Wrapper `getLinkedUsers` → RPC `get_linked_users_with_info(p_user_id)`
  - Wrapper `createInvitationLink` → `account_links.select('id').eq('invitation_code', ...)` (Uniqueness-Check) + `account_links.insert(...)`
  - Wrapper `redeemInvitationCodeFixed` → RPC `redeem_invitation_code_and_sync_due_date(p_invitation_code,p_user_id)` + RPC `sync_sleep_entries_for_partner`

## Start / Home
- `app/(tabs)/home.tsx`
  - `supabase.from('profiles').select('first_name').eq('id', user.id).single()`
  - `supabase.from('baby_care_entries').select('*').gte/lte('start_time', dayRange).order('start_time', { ascending:false })` (+ optional `.eq('baby_id', ...)`)
  - `supabase.from('sleep_entries').select('start_time,end_time').eq('user_id', user.id).or(overlapFilter)` (+ optional `.eq('baby_id', ...)`)
  - `supabase.from('sleep_entries').insert(payload)` (Quick Add Sleep)
  - Wrapper `addBabyCareEntry` → `baby_care_entries.insert(...).select().single()`
  - Empfehlungen via `getRecommendations` (siehe unten)
  - Weitere Baby-Daten via `lib/baby` (Tables: `babies`, `baby_diary`, `baby_phases`, `milestones`, `phase_progress`)
- `app/_layout.tsx` (Sleep-Prediction)
  - `supabase.from('sleep_entries').select('*').eq('baby_id', activeBabyId).gte('start_time', thirtyDaysAgo).order('start_time', { ascending:false })`

## Countdown / Geburtstermin
- `app/(tabs)/countdown.tsx`
  - Wrapper `hasGeburtsplan` → `supabase.from('geburtsplan').select('id').eq('user_id', userId).maybeSingle()`
  - RPC `supabase.rpc('get_due_date_with_linked_users', { p_user_id: user.id })`
  - RPC `supabase.rpc('update_due_date_and_sync', { p_user_id: user.id, p_due_date })`

## Geburtsplan
- `app/(tabs)/geburtsplan.tsx`
  - `supabase.auth.getUser()` (via `getCurrentUser`)
  - `supabase.from('geburtsplan').select('*').eq('user_id', userId).order('updated_at', { ascending:false }).limit(1).single()`
  - `supabase.from('geburtsplan').update({...}).eq('id', existingId).select().single()`
  - `supabase.from('geburtsplan').insert({...}).select().single()`
  - `supabase.from('geburtsplan').delete().eq('user_id', userId)`

## Wehen-Tracker
- `app/(tabs)/index.tsx`
  - RPC `supabase.rpc('get_contractions_with_sync_info', { p_user_id })` (Fallback: `contractions.select('*').eq('user_id', userId).order('start_time', { ascending:false })`)
  - RPC `supabase.rpc('add_contraction_and_sync', { p_user_id, p_start_time, p_end_time, p_duration, p_intensity, p_notes })` (Fallback: `contractions.insert({...}).select().single()`)
  - RPC `supabase.rpc('delete_contraction_and_sync', { p_user_id, p_contraction_id })` (Fallback: `contractions.delete().eq('id', id)`)
  - `supabase.from('contractions').update(updates).eq('id', id).select().single()`
  - RPC `supabase.rpc('sync_all_existing_contractions', { p_user_id })`
  - RPC `supabase.rpc('get_linked_users_with_details', { p_user_id })`

## Krankenhaus-Checkliste
- `app/(tabs)/explore.tsx`
  - `supabase.from('hospital_checklist').select('*').eq('user_id', userId).order('position', { ascending:true })`
  - `supabase.from('hospital_checklist').insert({...}).select().single()`
  - `supabase.from('hospital_checklist').update(updates).eq('id', id).select().single()`
  - `supabase.from('hospital_checklist').delete().eq('id', id)`
  - `supabase.from('hospital_checklist').upsert([{id, position}, ...], { onConflict:'id' }).select()`

## Selfcare
- `app/(tabs)/selfcare.tsx`
  - `supabase.from('profiles').select('first_name').eq('id', user.id).single()`
  - `supabase.from('selfcare_entries').select('*').eq('user_id', user.id).gte('date', start).lt('date', end).order('date', { ascending:true })` (Week/Month)
  - `supabase.from('selfcare_entries').select('*').eq('user_id', user.id).gte('date', dayStart).lt('date', dayEnd).maybeSingle()` (Day)
  - `supabase.from('selfcare_entries').update(entryData).eq('id', selectedEntry.id)`; `supabase.from('selfcare_entries').insert(entryData)`

## Gewicht
- `app/(tabs)/weight-tracker.tsx`
  - Wrapper `getWeightEntries` → `supabase.from('weights').select('*').eq('user_id', userId).or(babyFilter).order('date', { ascending:false })`
  - Wrapper `deleteWeightEntry` → `supabase.from('weights').delete().eq('id', id)`
  - Wrapper `addWeightEntry`/`updateWeightEntry` → `supabase.from('weights').insert`/`update`
  - `supabase.from('profiles').select('user_role').eq('id', userId).maybeSingle()`

## Babys & Pflege (gemeinsame Wrapper)
- `lib/supabase.ts` Baby-Care:
  - `baby_care_entries` select/insert/update/delete (siehe `addBabyCareEntry`, `getBabyCareEntriesForDate/Range/Month`, `updateBabyCareEntry`, `deleteBabyCareEntry`, `stopBabyCareEntryTimer`)
  - `sleep_entries` insert/select in Home/Sleep-Quick-Add

## Planner
- `app/planner/index.tsx`
  - `supabase.from('profiles').select('first_name, avatar_url').eq('id', user.id).maybeSingle()`
  - `supabase.from('planner_items').select(..., planner_days!inner(day)) .in('user_id', ownerIds) .gte('planner_days.day', start) .lte('planner_days.day', end)`
  - `supabase.from('planner_items').delete().eq('id', id).eq('user_id', user.id)`
  - Linked Users via RPC `get_linked_users_with_info`
- `services/planner.ts` (indirekt genutzt)
  - `planner_items` insert/update/delete (todos/events)
  - `planner_blocks`, `planner_days` updates
  - RPCs: `sync`/`get_daily_entries_with_sync_info`, `update_daily_entry_and_sync`, `add_daily_entry_and_sync`, `delete_daily_entry_and_sync`, `get_daily_entries_for_date_range`, etc.

## Wiki
- `app/mini-wiki.tsx`
  - `supabase.from('wiki_categories').select('*').order('name')`
  - `supabase.from('wiki_articles').select(..., wiki_categories(name)).order('title')`
  - Favoriten: `supabase.from('wiki_favorites').select('article_id').eq('user_id', userId)`; insert/delete `wiki_favorites`
- `app/mini-wiki/[id].tsx`
  - `supabase.from('wiki_articles').select(..., wiki_categories(name)).eq('id', articleId).single()`
  - Favoriten-Check: `wiki_favorites.select('id').eq('user_id', userId).eq('article_id', articleId).maybeSingle()`
  - Admin: `wiki_articles.insert/update/delete` (mit select)
  - Storage: `supabase.storage.from('community-images').upload(...)`; `getPublicUrl`
- `lib/supabase/wiki.ts` bündelt alle obenstehenden Aufrufe.

## Empfehlungen (Lotti)
- `app/lottis-empfehlungen.tsx`
  - `supabase.from('lotti_recommendations').select('*').order('order_index', { ascending:true }).order('created_at', { ascending:false })`
  - Insert: `lotti_recommendations.insert({...}).select().single()`
  - Update: `lotti_recommendations.update(updates).eq('id', id).select().single()`
  - Delete: `lotti_recommendations.delete().eq('id', id)`
  - Reorder: `lotti_recommendations.update({ order_index }).eq('id', id)` (pro Item)
  - Admin-Check: `supabase.from('profiles').select('is_admin').eq('id', userId).single()`
  - Storage: `supabase.storage.from('public-images').upload(...); getPublicUrl(...)`

## Rezepte
- `app/recipe-admin.tsx`
  - Admin-Check: `profiles.is_admin`
  - `supabase.from('baby_recipes').select('*')` (über `fetchRecipes`)
  - Update: `baby_recipes.update(...)`
  - Delete: `baby_recipes.delete().eq('id', ...)`
  - Insert (Recipes): `baby_recipes.insert(...)`
  - Storage: `supabase.storage.from('baby-recipes').upload/remove/getPublicUrl`
- `app/recipe-generator.tsx`: nur Admin-Check `profiles.is_admin`, keine weiteren Supabase-Calls.

## FAQ
- `app/faq.tsx`
  - `supabase.from('faq_categories').select('*').order('name')`
  - `supabase.from('faq_entries').select('id,category_id,question,answer,order_number,faq_categories(name)').order('order_number')`

## Baby-Namen
- `app/baby-names.tsx`
  - `supabase.from('baby_names_favorites').select('name').eq('user_id', user.id)`; insert/delete Favorit
  - `supabase.from('baby_names').select('id,name,meaning,origin,gender')` + Filter (`eq`, `in`, `or`, `ilike`, `order`)
  - Insert/Update/Delete `baby_names` (Single & Bulk)
  - Duplicate-Checks: `supabase.from('baby_names').select('name').in('name', names)`
  - Admin-Check: `profiles.is_admin`

## Feature Requests
- `app/feature-requests.tsx`
  - `supabase.from('feature_requests').select('*').eq('user_id', userId).order('created_at', { ascending:false })`
  - `supabase.from('feature_requests').insert({...}).select().single()`
  - `supabase.from('feature_requests').delete().eq('id', id).eq('user_id', userId)`

## Doctor Questions
- `app/doctor-questions.tsx` (über Service)
  - `supabase.from('doctor_questions').select('*').eq('user_id', userId).order('created_at', { ascending:false })`
  - `supabase.from('doctor_questions').insert({...}).select().single()`
  - `supabase.from('doctor_questions').update({...}).eq('id', id).select().single()`
  - `supabase.from('doctor_questions').delete().eq('id', id)`

## Community / Posts / Notifications
- `app/community.tsx`
  - `supabase.from('profiles').select('first_name,last_name,username,is_admin').eq('id', user.id).maybeSingle()`
  - Blog-CRUD via `lib/community`: `blog_posts` select/insert/update/delete; Storage-Upload Cover (bucket in lib)
- `app/notifications.tsx`
  - `supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending:false })`
  - Messages: `supabase.from('received_messages').select('*').eq('receiver_id', userId)`; `sent_messages` select
  - Sender-Info: `supabase.from('profiles').select('first_name,last_name').eq('id', senderId).single()` → Fallback RPC `get_user_profile` → Fallback `user_settings`
  - Mark read: `supabase.from('notifications').update({ is_read:true }).eq('id', id)`
  - Partner-Ping: RPC `supabase.rpc('send_partner_notification', { p_user_id, p_partner_id, p_type, p_message })`
  - Settings: `supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()`; update toggles via `user_settings.update`

## Profile
- `app/profile/[id].tsx` (und `app/profile/[id] 2.tsx`)
  - `supabase.from('profiles').select(...).eq('id', profileUserId).single()` → Fallback RPC `get_user_profile` → Fallback `user_settings`
  - Placeholder-Upsert (falls nötig): `supabase.from('profiles').upsert({...})`
  - Following-Liste: `supabase.from('user_follows').select('following_id').eq('follower_id', ownerId)` + `profiles`/RPC pro Folge-ID
  - Mutual Follow: `user_follows` select on both directions
  - Posts: via `getPosts` (Supabase `blog_posts`/`comments` in lib)

## Planner-Notifications / Partner-Debug
- `app/debug-notifications.tsx`
  - `supabase.from('account_links').select('*').eq('status','accepted')`
  - `supabase.from('partner_activity_notifications').select('*').eq('user_id', ...)` + `.eq('partner_id', ...)`
  - `supabase.from('sleep_entries').insert({...}).select()`
  - `supabase.from('user_push_tokens').select('*').eq('user_id', ...)`
  - `supabase.from('planner_notifications').select('*').eq('user_id', ...).order('scheduled_for', { ascending:false })`

## Sonstiges
- `app/babyweather.tsx`: kein Supabase.
- `app/(tabs)/debug.tsx`: kein Supabase.

Falls du zu einer RPC/Table die Rückgabe-Felder brauchst, bitte gewünschte Funktion nennen.***
