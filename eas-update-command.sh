#!/bin/bash

# Führen Sie dieses Skript aus, um ein EAS Update für die Synchronisierungsfunktionalität zu erstellen

# Stellen Sie sicher, dass die EAS CLI installiert ist
if ! command -v eas &> /dev/null
then
    echo "EAS CLI ist nicht installiert. Installiere..."
    npm install -g eas-cli
fi

# Anmelden bei EAS (falls noch nicht angemeldet)
eas whoami || eas login

# Erstellen eines EAS Updates mit einer beschreibenden Nachricht
echo "Erstelle EAS Update für die Synchronisierungsfunktionalität..."
eas update --auto --message "Fix: Synchronisierung von Alltag-Einträgen zwischen verbundenen Benutzern"

echo "EAS Update wurde erstellt. Überprüfen Sie den Status mit 'eas update:list'"
