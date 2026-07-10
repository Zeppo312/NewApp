#!/bin/bash

# LottiBaby EAS Setup Script
# Führt die notwendige Umgebung einrichtung durch und EAS Befehle aus

echo "🚀 LottiBaby EAS Setup"
echo "======================"

# Environment Setup
if ! node -e 'const [major, minor, patch] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && (minor > 19 || (minor === 19 && patch >= 4))) ? 0 : 1)'; then
  echo "❌ Node.js 20.19.4 oder neuer wird benötigt."
  exit 1
fi

echo "✅ Umgebung bereitgestellt"
echo "📱 Node.js $(node --version)"
echo "📦 npm $(npm --version)"
echo "🛠️  EAS $(eas --version)"

echo ""
echo "Verfügbare EAS Befehle:"
echo "1. eas login                    - Bei EAS anmelden"
echo "2. npm run update:preview -- --message \"...\" - Preview-Update erstellen"
echo "3. eas update:list             - Updates anzeigen"
echo "4. eas build --profile production - Production Build"
echo "5. eas build --profile development - Development Build"

echo ""
echo "Für EAS Login:"
echo "eas login"
echo ""
echo "Für ein Preview-Update:"
echo "npm run update:preview -- --message \"Sleep-Tracker Splash System Integration\""
echo ""
echo "Für Production Build:"
echo "eas build --platform all --profile production"
