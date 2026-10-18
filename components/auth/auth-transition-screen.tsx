import { Button, Host } from '@expo/ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

type Props = {
  title: string;
  message: string;
  onBack?: () => void;
  backLabel: string;
};

/** A quiet transition, with no success claim before the destination is ready. */
export function AuthTransitionScreen({ title, message, onBack, backLabel }: Props) {
  return (
    <View style={styles.background}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.brand}>Lotti Baby</Text>
          <View style={styles.card}>
            {!onBack && (
              <View style={styles.indicator}>
                <ActivityIndicator size="small" color={Colors.light.textSecondary} />
              </View>
            )}
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Text selectable accessibilityRole={onBack ? 'alert' : undefined}
              accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
            {onBack && (
              <Host matchContents colorScheme="light" seedColor={Colors.light.textSecondary}
                style={styles.action}>
                <Button testID="auth-transition-back" label={backLabel} onPress={onBack} />
              </Host>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: Colors.light.background },
  safeArea: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 24 },
  brand: { color: Colors.light.textTertiary, fontSize: 18, fontWeight: '600' },
  card: {
    width: '100%', maxWidth: 420, padding: 28, gap: 16, alignItems: 'center',
    borderRadius: 28, borderCurve: 'continuous', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: Colors.light.border,
  },
  indicator: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.light.cardLight,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '600', textAlign: 'center', color: Colors.light.textPrimary },
  message: { fontSize: 16, lineHeight: 25, textAlign: 'center', color: Colors.light.textSecondary },
  action: { alignSelf: 'stretch', marginTop: 8 },
});
