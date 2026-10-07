# Aktueller Tabellen-/Policy-Abgleich – 01.10.2026

Alle 117 App-Tabellen im aktuellen QA-Katalog sind zugeordnet; Schema/Spalten/FKs wurden mit Produktion abgeglichen. 136 Regeln, davon 113 tatsächliche Spaltenmatches und 23 nicht passende Legacy-Regeln. Dies ist eine technische Zuordnung nach den festgelegten Löschregeln, keine globale Fingerprint-Freigabe. Freie Inhalte/JSON/Medien und Anbieterbestände bleiben fallbezogen nachzuweisen. Produktion unverändert.

Quelle: `output/deletion-completion-20260930/inventory-policy-mapping-20261001.json`. Die ältere Matrix vom 26.09. wird damit um die sieben ergänzten Kontoverweise und die Klassifizierung zuvor ungematchter Tabellen ergänzt.

| Tabelle | Behandlung | Aktuelle direkte Regeln |
| --- | --- | --- |
| `caretaker_private.entry_authors` | Über belegte Eltern-FKs an Eintrag/Grant/Baby/Post gebunden; gemeinsame Elternbestände zuerst manuell prüfen. | Über Eltern-FK bzw. gesonderte Prüfung |
| `caretaker_private.grants` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `caregiver_id` delete, `owner_id` delete |
| `public.account_links` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `creator_id` delete, `invited_id` delete |
| `public.account_links_audit_log` | Vor destruktiven Phasen UUID-Bezüge prüfen; freie Namen/E-Mail/Medienkopien gesondert redigieren oder begründete befristete Ausnahme dokumentieren. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.advisor_mama_checkins` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.advisor_messages` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.advisor_relief_events` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.advisor_settings` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.analytics_events` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.baby_care_entries` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.baby_current_phase` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.baby_daily` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.baby_daily_habit_checks` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `checked_by` detach |
| `public.baby_development_phases` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.baby_diary` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.baby_info` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.baby_members` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.baby_milestone_entries` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.baby_milestone_progress` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.baby_milestones` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.baby_name_translations` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.baby_names` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.baby_names_favorites` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.baby_recipes` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.baby_reminder_notifications` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.blog_posts` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `author_id` delete |
| `public.community_comment_likes` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_comments` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_group_chat_reads` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_group_comment_likes` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_group_comments` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_group_event_rsvps` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_group_events` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `cancelled_by_user_id` detach, `created_by_user_id` delete |
| `public.community_group_invites` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `invited_by_user_id` delete, `invited_user_id` delete |
| `public.community_group_members` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_group_messages` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `sender_id` delete |
| `public.community_group_nested_comment_likes` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_group_nested_comments` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_group_post_likes` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_group_posts` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_groups` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `owner_id` delete |
| `public.community_images` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_nested_comment_likes` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_nested_comments` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_notifications` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `sender_id` delete, `user_id` delete |
| `public.community_poll_options` | Über belegte Eltern-FKs an Eintrag/Grant/Baby/Post gebunden; gemeinsame Elternbestände zuerst manuell prüfen. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.community_poll_votes` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_polls` | Über belegte Eltern-FKs an Eintrag/Grant/Baby/Post gebunden; gemeinsame Elternbestände zuerst manuell prüfen. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.community_post_likes` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_post_tags` | Über belegte Eltern-FKs an Eintrag/Grant/Baby/Post gebunden; gemeinsame Elternbestände zuerst manuell prüfen. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.community_posts` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.community_tags` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.content_reports` | Vor destruktiven Phasen UUID-Bezüge prüfen; freie Namen/E-Mail/Medienkopien gesondert redigieren oder begründete befristete Ausnahme dokumentieren. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.contractions` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.custom_activity_types` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `created_by` delete |
| `public.cycle_daily_logs` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.cycle_periods` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.cycle_settings` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.direct_messages` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `receiver_id` detach, `sender_id` delete |
| `public.doctor_questions` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.faq_categories` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.faq_entries` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.feature_requests` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.feeding_events` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.feeding_preferences` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.geburtsplan` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.hospital_checklist` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.inventory_items` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `created_by` delete |
| `public.inventory_transactions` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `created_by` delete |
| `public.lotti_ai_requests` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.lotti_ai_usage_buckets` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.lotti_recommendations` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `created_by` delete |
| `public.lotti_revenuecat_webhook_events` | Nur event_id, Status, Zeiten und error_code im Live-Katalog; keine Payload, E-Mail, User-ID oder Aliasfelder. Anbieterbestand separat bearbeiten. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.lotti_subscription_entitlements` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.loyalty_cards` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.moderation_banned_terms` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.partner_activity_notifications` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `partner_id` delete, `user_id` delete |
| `public.paywall_content_config` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `updated_by` detach |
| `public.planner_blocks` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.planner_calendar_sync_links` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.planner_calendar_sync_settings` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.planner_days` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.planner_items` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.planner_notifications` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.planner_recurring_exceptions` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.planner_recurring_items` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.product_catalog` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `created_by` detach |
| `public.profiles` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `id` delete |
| `public.push_tokens` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.selfcare_entries` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.shopping_items` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `partner_id` detach, `user_id` delete |
| `public.shopping_list_items` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `created_by` delete |
| `public.size_entries` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.sleep_entries` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `partner_id` detach, `shared_with_user_id` detach, `updated_by` detach, `user_id` delete |
| `public.sleep_entry_shares` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `owner_id` delete, `shared_with_id` delete |
| `public.sleep_personalization` | Über belegte Eltern-FKs an Eintrag/Grant/Baby/Post gebunden; gemeinsame Elternbestände zuerst manuell prüfen. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.startup_message_acknowledgements` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.startup_messages` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `created_by` detach, `updated_by` detach |
| `public.subscription_cancellation_feedback` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.subscription_features` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.subscription_plan_features` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `updated_by` detach |
| `public.subscription_plans` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.subscription_policy_audit` | Vor destruktiven Phasen UUID-Bezüge prüfen; freie Namen/E-Mail/Medienkopien gesondert redigieren oder begründete befristete Ausnahme dokumentieren. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.subscription_policy_state` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `updated_by` detach |
| `public.terms_consents` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.tooth_entries` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.user_blocks` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `blocked_id` delete, `blocker_id` delete |
| `public.user_connections` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `invited_id` delete, `inviter_id` delete |
| `public.user_follows` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `follower_id` delete, `following_id` delete |
| `public.user_partners` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `partner_id` delete, `user_id` delete |
| `public.user_push_tokens` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.user_settings` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.voice_log_requests` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.weight_entries` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
| `public.wiki_articles` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.wiki_categories` | Gemeinsamer Referenz-/Redaktionsbestand bleibt bestehen; personenbezogene Inhaltskopien sind eigener manueller Prüffall, kein pauschales persönliches Löschziel. | Über Eltern-FK bzw. gesonderte Prüfung |
| `public.wiki_favorites` | Nur eindeutig zugeordnete Zeilen löschen bzw. Kontoverweise trennen; gemeinsame/JSON-/Medienkopien zusätzlich fallbezogen prüfen. | `user_id` delete |
