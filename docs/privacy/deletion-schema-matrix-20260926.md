# Schema-Matrix Kontolöschung – Produktionskatalog 26.09.2026

## Nachprüfung 01.10.2026

Erneuter lesender Katalogabgleich: weiterhin 152 Tabellen (117 App-Tabellen) und 220 FKs, Spaltennamen/-typen/Nullbarkeit sowie FKs unverändert. 54 Unterschiede in angezeigten Defaults sind ausschließlich die Qualifizierung `extensions.uuid_generate_v4()` durch den Abfragekontext. Betriebsregeln inzwischen [festgelegt](deletion-policy-20261001.md); ältere Aussagen „noch keine beschlossen“ unten beschreiben den Stand vom 28.09.

Sieben fehlende nullable UUID-Verweise in Familien-QA explizit als `detach` ergänzt und registriert (`20261001094535`): `sleep_entries.updated_by`, `shopping_items.partner_id`, `paywall_content_config.updated_by`, `startup_messages.created_by/updated_by`, `subscription_plan_features.updated_by`, `subscription_policy_state.updated_by`. Fremde Inhalte bleiben erhalten; Auth-FK allein genügt bei Datenreset nicht. 19 SQL-Tests bestanden, sieben vorhandene QA-Konten erhalten, null Löschaufträge, Einstellungen/Scheduler unverändert, keine neuen Advisor-Meldungen. Aktuell 136 QA-Regeln, davon 113 mit tatsächlicher Spalte; 23 Legacy-Regeln bleiben ohne Match. Belege: `inventory-live-20261001.json`, `qa-actor-rules-20261001.json`. Produktion bislang unverändert.

„Offen“ in der älteren Regelspalte bedeutet zunächst fehlenden direkten Regelmatch. Referenzkataloge und über Eltern-FKs abhängige Tabellen sind gesondert zu klassifizieren, keine pauschalen persönlichen Löschziele. Audit-/Moderationskopien, freie Inhalte und Medien benötigen weiterhin die beschriebene Einzelprüfung; keine vollständige Fingerprint-Freigabe daraus.

## Nachprüfung 28.09.2026

Neue lesende Produktions-/QA-Katalogexporte unter `.family-qa/acceptance-20260928/` bestätigen unveränderte Tabellen/FKs gegenüber 26.09. (152 Tabellen, 220 FKs). Die folgende Matrix bleibt gültig, stellt weiterhin keine fachliche Freigabe dar. UUID-Halteprüfung in `content_reports` und `subscription_policy_audit` auf die vollständige Zeile erweitert und ausschließlich in QA verifiziert; Moderator-/Follow-up-IDs und verschachtelte Auditkopien werden damit erfasst. E-Mail-/Namens-/Medienkopien ohne UUID bleiben offen. Konkrete Eigentums-/Aufbewahrungsoptionen in [Entscheidungsvorlage Auftrag 7](../android-play/release-entscheidung-20260928.md); noch keine beschlossen. 129 Regeln unverändert, Fristen/Fingerprint nicht gesetzt.

Quelle: lesender `pg_catalog`-Export aus `kwniiyayhzgjfqjsjcfu`, ohne Tabelleninhalte. Regelspalte: am 26.09. in QA vorhandene 129 Regeln und die identisch vorbereitete Produktionsmigration. Ein Regelmatch belegt **keine** vollständige Löschbarkeit von JSON, Fremdinhalten oder Medien. Fehlende Regeln bleiben fachlich offen; 23 Regeln zielen auf hier nicht existierende Legacy-Spalten/Tabellen.

| Tabelle | Eigentümer-/Identitätsspalten | Gültige Regelspalten | FK-Ziele und Löschaktion | Medien/JSON |
| --- | --- | --- | --- | --- |
| `caretaker_private.entry_authors` | — | **offen** | `daily_entry_id`→`baby_care_entries`/CASCADE, `grant_id`→`caretaker_private.grants`/CASCADE, `sleep_entry_id`→`sleep_entries`/CASCADE | — |
| `caretaker_private.grants` | `owner_id`, `caregiver_id` | `caregiver_id` delete, `owner_id` delete | `baby_id`→`baby_info`/CASCADE, `caregiver_id`→`auth.users`/CASCADE, `owner_id`→`auth.users`/CASCADE | — |
| `public.account_links` | `creator_id`, `invited_id` | `creator_id` delete, `invited_id` delete | `creator_id`→`auth.users`/CASCADE, `invited_id`→`auth.users`/CASCADE | — |
| `public.account_links_audit_log` | `changed_by` | **offen** | — | `old_data`, `new_data` |
| `public.advisor_mama_checkins` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.advisor_messages` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | `facts` |
| `public.advisor_relief_events` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.advisor_settings` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.analytics_events` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | `properties` |
| `public.baby_care_entries` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `custom_activity_type_id, baby_id`→`custom_activity_types`/SET NULL, `user_id`→`auth.users`/CASCADE | — |
| `public.baby_current_phase` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `phase_id`→`baby_development_phases`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.baby_daily` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.baby_daily_habit_checks` | `checked_by` | `checked_by` detach | `baby_id`→`baby_info`/CASCADE, `checked_by`→`auth.users`/SET NULL | — |
| `public.baby_development_phases` | — | **offen** | — | — |
| `public.baby_diary` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | `photo_url` |
| `public.baby_info` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | `photo_url` |
| `public.baby_members` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.baby_milestone_entries` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | `image_url` |
| `public.baby_milestone_progress` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `milestone_id`→`baby_milestones`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.baby_milestones` | — | **offen** | `phase_id`→`baby_development_phases`/CASCADE | — |
| `public.baby_name_translations` | — | **offen** | `baby_name_id`→`baby_names`/CASCADE | — |
| `public.baby_names` | — | **offen** | — | — |
| `public.baby_names_favorites` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.baby_recipes` | `user_id` | `user_id` delete; globale Rezepte vorab gesperrt | `user_id`→`auth.users`/CASCADE | `image_url`, `video_url` |
| `public.baby_reminder_notifications` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | `payload` |
| `public.blog_posts` | `author_id` | `author_id` delete | `author_id`→`profiles`/CASCADE | `cover_image_url` |
| `public.community_comment_likes` | `user_id` | `user_id` delete | `comment_id`→`community_comments`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_comments` | `user_id` | `user_id` delete | `post_id`→`community_posts`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_group_chat_reads` | `user_id` | `user_id` delete | `group_id`→`community_groups`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_group_comment_likes` | `user_id` | `user_id` delete | `comment_id`→`community_group_comments`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_group_comments` | `user_id` | `user_id` delete | `post_id`→`community_group_posts`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_group_event_rsvps` | `user_id` | `user_id` delete | `event_id`→`community_group_events`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_group_events` | `created_by_user_id`, `cancelled_by_user_id` | `cancelled_by_user_id` detach, `created_by_user_id` delete | `cancelled_by_user_id`→`auth.users`/SET NULL, `created_by_user_id`→`auth.users`/CASCADE, `group_id`→`community_groups`/CASCADE | `cover_image_url` |
| `public.community_group_invites` | `invited_user_id`, `invited_by_user_id` | `invited_by_user_id` delete, `invited_user_id` delete | `group_id`→`community_groups`/CASCADE, `invited_by_user_id`→`auth.users`/CASCADE, `invited_user_id`→`auth.users`/CASCADE | — |
| `public.community_group_members` | `user_id` | `user_id` delete | `group_id`→`community_groups`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_group_messages` | `sender_id` | `sender_id` delete | `event_id`→`community_group_events`/SET NULL, `group_id`→`community_groups`/CASCADE, `reply_to_id`→`community_group_messages`/SET NULL, `sender_id`→`auth.users`/CASCADE | `audio_storage_path`, `audio_duration_ms`, `audio_mime_type` |
| `public.community_group_nested_comment_likes` | `user_id` | `user_id` delete | `nested_comment_id`→`community_group_nested_comments`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_group_nested_comments` | `user_id` | `user_id` delete | `parent_comment_id`→`community_group_comments`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_group_post_likes` | `user_id` | `user_id` delete | `post_id`→`community_group_posts`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_group_posts` | `user_id` | `user_id` delete | `group_id`→`community_groups`/CASCADE, `user_id`→`auth.users`/CASCADE | `image_url` |
| `public.community_groups` | `owner_id` | `owner_id` delete | `owner_id`→`auth.users`/CASCADE | `avatar_url`, `cover_image_url` |
| `public.community_images` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | `image_url` |
| `public.community_nested_comment_likes` | `user_id` | `user_id` delete | `nested_comment_id`→`community_nested_comments`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_nested_comments` | `user_id` | `user_id` delete | `parent_comment_id`→`community_comments`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_notifications` | `user_id`, `sender_id` | `sender_id` delete, `user_id` delete | `sender_id`→`auth.users`/SET NULL, `user_id`→`auth.users`/CASCADE | — |
| `public.community_poll_options` | — | **offen** | `poll_id`→`community_polls`/CASCADE | — |
| `public.community_poll_votes` | `user_id` | `user_id` delete | `option_id`→`community_poll_options`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_polls` | — | **offen** | `post_id`→`community_posts`/CASCADE | — |
| `public.community_post_likes` | `user_id` | `user_id` delete | `post_id`→`community_posts`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.community_post_tags` | — | **offen** | `post_id`→`community_posts`/CASCADE, `tag_id`→`community_tags`/CASCADE | — |
| `public.community_posts` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | `image_url` |
| `public.community_tags` | — | **offen** | — | — |
| `public.content_reports` | `reporter_id`, `reported_user_id`, `resolved_by`, `follow_up_by` | **offen** | `follow_up_by`→`auth.users`/SET NULL, `reported_user_id`→`auth.users`/SET NULL, `reporter_id`→`auth.users`/SET NULL, `resolved_by`→`auth.users`/SET NULL | `media_url`, `audio_storage_path` |
| `public.contractions` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.custom_activity_types` | `created_by` | `created_by` delete | `baby_id`→`baby_info`/CASCADE, `created_by`→`auth.users`/SET NULL | — |
| `public.cycle_daily_logs` | `user_id` | `user_id` delete | — | — |
| `public.cycle_periods` | `user_id` | `user_id` delete | — | — |
| `public.cycle_settings` | `user_id` | `user_id` delete | — | — |
| `public.direct_messages` | `sender_id`, `receiver_id` | `receiver_id` detach, `sender_id` delete | `receiver_id`→`auth.users`/CASCADE, `reply_to_id`→`direct_messages`/SET NULL, `sender_id`→`auth.users`/CASCADE | `metadata`, `audio_storage_path`, `audio_duration_ms`, `audio_mime_type` |
| `public.doctor_questions` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.faq_categories` | — | **offen** | — | — |
| `public.faq_entries` | — | **offen** | `category_id`→`faq_categories`/CASCADE | — |
| `public.feature_requests` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.feeding_events` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.feeding_preferences` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.geburtsplan` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.hospital_checklist` | `user_id`, `is_checked` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.inventory_items` | `created_by` | `created_by` delete | `baby_id`→`baby_info`/SET NULL, `created_by`→`auth.users`/CASCADE | — |
| `public.inventory_transactions` | `created_by` | `created_by` delete | `baby_id`→`baby_info`/SET NULL, `created_by`→`auth.users`/CASCADE, `inventory_item_id`→`inventory_items`/CASCADE | — |
| `public.lotti_ai_requests` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/SET NULL, `user_id`→`auth.users`/CASCADE | — |
| `public.lotti_ai_usage_buckets` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.lotti_recommendations` | `created_by` | `created_by` delete | `created_by`→`auth.users`/NO ACTION | `image_url` |
| `public.lotti_revenuecat_webhook_events` | — | **offen** | — | — |
| `public.lotti_subscription_entitlements` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.loyalty_cards` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.moderation_banned_terms` | — | **offen** | — | — |
| `public.partner_activity_notifications` | `user_id`, `partner_id` | `partner_id` delete, `user_id` delete | `partner_id`→`auth.users`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.paywall_content_config` | `updated_by` | **offen** | `updated_by`→`auth.users`/SET NULL | `content` |
| `public.planner_blocks` | `user_id` | `user_id` delete | `day_id`→`planner_days`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.planner_calendar_sync_links` | `user_id` | `user_id` delete | `planner_item_id`→`planner_items`/SET NULL, `planner_recurring_exception_id`→`planner_recurring_exceptions`/SET NULL, `planner_recurring_item_id`→`planner_recurring_items`/SET NULL, `user_id`→`auth.users`/CASCADE | — |
| `public.planner_calendar_sync_settings` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.planner_days` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.planner_items` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/SET NULL, `block_id`→`planner_blocks`/SET NULL, `day_id`→`planner_days`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.planner_notifications` | `user_id` | `user_id` delete | `planner_item_id`→`planner_items`/NO ACTION, `user_id`→`auth.users`/NO ACTION | — |
| `public.planner_recurring_exceptions` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/SET NULL, `recurring_item_id`→`planner_recurring_items`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.planner_recurring_items` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/SET NULL, `user_id`→`auth.users`/CASCADE | — |
| `public.product_catalog` | `created_by` | `created_by` detach | `created_by`→`auth.users`/SET NULL | `provider_payload` |
| `public.profiles` | — | `id` delete | `id`→`auth.users`/CASCADE | `avatar_url` |
| `public.push_tokens` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.selfcare_entries` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.shopping_items` | `user_id`, `partner_id`, `is_checked` | `user_id` delete | `baby_id`→`baby_info`/SET NULL, `partner_id`→`auth.users`/SET NULL, `user_id`→`auth.users`/CASCADE | — |
| `public.shopping_list_items` | `created_by` | `created_by` delete | `baby_id`→`baby_info`/SET NULL, `created_by`→`auth.users`/CASCADE, `inventory_item_id`→`inventory_items`/SET NULL, `source_recipe_id`→`baby_recipes`/SET NULL | — |
| `public.size_entries` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.sleep_entries` | `user_id`, `partner_id`, `updated_by`, `shared_with_user_id` | `partner_id` detach, `shared_with_user_id` detach, `user_id` delete | `partner_id`→`profiles`/SET NULL, `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.sleep_entry_shares` | `owner_id`, `shared_with_id` | `owner_id` delete, `shared_with_id` delete | `entry_id`→`sleep_entries`/CASCADE | — |
| `public.sleep_personalization` | — | **offen** | `baby_id`→`baby_info`/CASCADE | `personalization_data` |
| `public.startup_message_acknowledgements` | `user_id` | `user_id` delete | `message_id`→`startup_messages`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.startup_messages` | `created_by`, `updated_by` | **offen** | `created_by`→`auth.users`/SET NULL, `updated_by`→`auth.users`/SET NULL | `source_url` |
| `public.subscription_cancellation_feedback` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.subscription_features` | — | **offen** | — | — |
| `public.subscription_plan_features` | `updated_by` | **offen** | `feature_key`→`subscription_features`/CASCADE, `plan_key`→`subscription_plans`/CASCADE, `updated_by`→`auth.users`/SET NULL | — |
| `public.subscription_plans` | — | **offen** | — | — |
| `public.subscription_policy_audit` | `changed_by` | **offen** | `changed_by`→`auth.users`/RESTRICT | `matrix` |
| `public.subscription_policy_state` | `updated_by` | **offen** | `updated_by`→`auth.users`/SET NULL | — |
| `public.terms_consents` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.tooth_entries` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.user_blocks` | `blocker_id`, `blocked_id` | `blocked_id` delete, `blocker_id` delete | `blocked_id`→`auth.users`/CASCADE, `blocker_id`→`auth.users`/CASCADE | — |
| `public.user_connections` | `inviter_id`, `invited_id` | `invited_id` delete, `inviter_id` delete | `invited_id`→`auth.users`/CASCADE, `inviter_id`→`auth.users`/CASCADE | — |
| `public.user_follows` | `follower_id`, `following_id` | `follower_id` delete, `following_id` delete | `follower_id`→`auth.users`/CASCADE, `following_id`→`auth.users`/CASCADE | — |
| `public.user_partners` | `user_id`, `partner_id` | `partner_id` delete, `user_id` delete | `partner_id`→`auth.users`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.user_push_tokens` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.user_settings` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | `community_use_avatar` |
| `public.voice_log_requests` | `user_id` | `user_id` delete | `user_id`→`auth.users`/CASCADE | — |
| `public.weight_entries` | `user_id` | `user_id` delete | `baby_id`→`baby_info`/CASCADE, `user_id`→`auth.users`/CASCADE | — |
| `public.wiki_articles` | — | **offen** | `category_id`→`wiki_categories`/CASCADE | `content`, `cover_image_url` |
| `public.wiki_categories` | — | **offen** | — | — |
| `public.wiki_favorites` | `user_id` | `user_id` delete | `article_id`→`wiki_articles`/CASCADE, `user_id`→`auth.users`/CASCADE | — |

`auth` (27 Tabellen) und `storage` (8 Tabellen) werden vom Dienst verwaltet; Auth wird im Worker separat gelöscht, Storage-Dateien über die Storage API. Der private Katalogexport enthält deren Spalten und FKs vollständig. Der Storage-Bucket-Abgleich steht im [Inventar](deletion-inventory.md).
