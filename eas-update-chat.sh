#!/bin/bash

# Script zum Veröffentlichen eines EAS Updates für die neue Chat-Funktion

# Prüfe, ob die EAS CLI installiert ist
if ! command -v eas &> /dev/null
then
    echo "EAS CLI ist nicht installiert. Installiere..."
    npm install -g eas-cli
fi

# Bei EAS anmelden, falls nicht bereits geschehen
eas whoami || eas login

# EAS Update für alle Plattformen erstellen
echo "Erstelle EAS Update für Chat-Button..."
eas update --auto --message "Feature: Chat-Button in Community"

echo "EAS Update wurde erstellt.\nPrüfe den Status mit 'eas update:list'"
