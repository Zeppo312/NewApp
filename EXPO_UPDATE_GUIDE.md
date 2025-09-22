# Expo SDK 53 Update Instructions

## 🚀 Update Steps

### 1. Update EAS CLI globally
```bash
npm install --global eas-cli@latest
```

### 2. Update all dependencies
```bash
npx expo install --fix
```

### 3. Check for issues
```bash
npx expo-doctor@latest
```

### 4. Install iOS dependencies (if needed)
```bash
npx pod-install
```

### 5. Clear cache and restart
```bash
npx expo start --clear
```

## 📱 Updated Versions
- Expo SDK: 53.0.11 (latest stable)
- EAS CLI: >= 16.8.0
- React Native: 0.79.2
- Supabase: 2.51.0
- React Native Reanimated: 3.17.6
- React Native Screens: 4.10.10
- React Native SVG: 15.12.0

## ⚠️ Important Notes
- Make sure Xcode 15.3+ is installed
- Update Expo Go app on devices
- Test thoroughly after update
- Backup project before updating

## 🔄 Next Release
Expo SDK 54 is planned for late summer 2025 with React Native 0.81
