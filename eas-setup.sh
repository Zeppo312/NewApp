#!/bin/bash

# LottiBaby EAS Setup Script
# Führt die notwendige Umgebung einrichtung durch und EAS Befehle aus

echo "🚀 LottiBaby EAS Setup"
echo "======================"

# Environment Setup
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 18

echo "✅ Umgebung bereitgestellt"
echo "📱 Node.js $(node --version)"
echo "📦 npm $(npm --version)"
echo "🛠️  EAS $(eas --version)"

echo ""
echo "Verfügbare EAS Befehle:"
echo "1. eas login                    - Bei EAS anmelden"
echo "2. eas update --auto           - Update erstellen"
echo "3. eas update:list             - Updates anzeigen"
echo "4. eas build --profile production - Production Build"
echo "5. eas build --profile development - Development Build"

echo ""
echo "Für EAS Login:"
echo "eas login"
echo ""
echo "Für Update mit automatischer Versionsverwaltung:"
echo "eas update --auto --message \"Sleep-Tracker Splash System Integration\""
echo ""
echo "Für Production Build:"
echo "eas build --platform all --profile production"

