import React, { type ReactNode } from 'react';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { Button, Column, Host } from '@expo/ui';
import { usePaywallSessionGate, type PaywallSessionGateOptions } from '@/hooks/use-paywall-session-gate';

type Props = PaywallSessionGateOptions & {
  locale: string;
  onSignOut: () => void;
  children: (blocking: boolean) => ReactNode;
};

/** The mounted RootLayout navigator stays mounted during every access check. */
export function RootPaywallGate({ children, locale, onSignOut, ...options }: Props) {
  const gate = usePaywallSessionGate(options);
  const copy = locale === 'en'
    ? { loading: 'Checking access …', error: 'Access could not be checked. Check your connection and try again.', retry: 'Try again', logout: 'Sign out' }
    : locale === 'es'
      ? { loading: 'Comprobando el acceso …', error: 'No se pudo comprobar el acceso. Revisa tu conexión e inténtalo de nuevo.', retry: 'Reintentar', logout: 'Cerrar sesión' }
      : { loading: 'Zugang wird geprüft …', error: 'Dein Zugang konnte nicht geprüft werden. Prüfe deine Verbindung und versuche es erneut.', retry: 'Erneut versuchen', logout: 'Abmelden' };
  return <>
    {/* Keep native stacks laid out while their initial redirect runs. Removing
        their layout with display:none can strand an iOS screen transition.
        The native modal below owns input/focus; the content stays invisible. */}
    <View testID="root-paywall-content" style={{ flex: 1, opacity: gate.blocking ? 0 : 1 }}
      pointerEvents={gate.blocking ? 'none' : 'auto'} accessibilityElementsHidden={gate.blocking}
      importantForAccessibility={gate.blocking ? 'no-hide-descendants' : 'auto'}>
      {children(gate.blocking)}
    </View>
    {/* Keep the presenting navigator attached during redirects. A fullScreen
        presentation removes its native view while the modal is open, which
        can strand a concurrent native-stack transition on iOS. The opaque
        overlay still captures input and hardware-keyboard focus. */}
    {gate.blocking && <Modal testID="root-paywall-modal" visible animationType="none"
      transparent presentationStyle="overFullScreen" onRequestClose={() => {}}>
      <View testID="root-paywall-overlay" accessibilityViewIsModal style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF' }}>
      {!gate.unavailable && <ActivityIndicator size="large" color="#E9C9B6" />}
      <Text accessibilityRole={gate.unavailable ? 'alert' : undefined} style={{ marginTop: 10, color: '#7D5A50', textAlign: 'center' }}>{gate.unavailable ? copy.error : copy.loading}</Text>
      {gate.unavailable && <Host matchContents style={{ marginTop: 20 }}><Column>
        <Button testID="root-paywall-retry" label={copy.retry} onPress={gate.retry} />
        <Button testID="root-paywall-signout" label={copy.logout} variant="text" onPress={onSignOut} />
      </Column></Host>}
      </View>
    </Modal>}
  </>;
}
