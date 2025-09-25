#!/bin/bash

# LottiBaby EAS Update Script
# Erstellt ein EAS Update für das Sleep-Tracker Splash System

echo "🚀 LottiBaby EAS Update - Sleep-Tracker Splash Integration"
echo "=========================================================="

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -f "package.json" ]; then
    echo "❌ Fehler: package.json nicht gefunden!"
    echo "Stelle sicher, dass du im LottiBaby Projektverzeichnis bist."
    exit 1
fi

echo "✅ Im LottiBaby Projektverzeichnis"

# EAS Update erstellen
echo ""
echo "📦 Erstelle EAS Update..."
eas update --auto --message "Sleep-Tracker Splash System Integration - Verbessertes Success-Feedback mit Animationen für Start/Stop/Manual Sleep Tracking"

echo ""
echo "✅ Update erfolgreich erstellt!"
echo ""
echo "📱 Das Update wird automatisch an alle Benutzer verteilt"
echo "🔄 Benutzer erhalten das Update beim nächsten App-Start"
echo ""
echo "📊 Update-Status prüfen:"
echo "eas update:list"

