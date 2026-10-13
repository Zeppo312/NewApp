#!/bin/bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────
# Deploy Group Chat Notifications
# Runs 3 SQL migrations + deploys the Edge Function
# ──────────────────────────────────────────────────────────────────

cd "$(dirname "$0")/.."

echo "=== 1/4  RPCs: get_my_group_chat_summaries + get_total_group_chat_unread_count ==="
supabase db execute --file supabase/migrations/20260401020000_add_group_chat_summaries_rpc.sql
echo "  ✓ RPCs erstellt"

echo ""
echo "=== 2/4  Webhook-Trigger: send_group_message_notification_webhook ==="
supabase db execute --file supabase/migrations/20260401030000_add_group_chat_notification_webhook.sql
echo "  ✓ Trigger erstellt"

echo ""
echo "=== 3/4  Realtime: community_group_chat_reads ==="
supabase db execute --file supabase/migrations/20260401040000_enable_realtime_for_group_chat_reads.sql
echo "  ✓ Realtime aktiviert"

echo ""
echo "=== 4/4  Edge Function: send-group-message-notification ==="
supabase functions deploy send-group-message-notification
echo "  ✓ Edge Function deployed"

echo ""
echo "=== Fertig! ==="
echo "Alle 3 Migrations + Edge Function sind deployed."
echo "Die Edge Function nutzt das bestehende DIRECT_MESSAGE_WEBHOOK_SECRET."
