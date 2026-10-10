import React, { type ReactNode } from 'react';
import { Modal, View } from 'react-native';
import { ConnectionRecoveryScreen } from '@/components/ui/connection-recovery-screen';
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
    ? { loading: 'One moment …', checking: 'We’re checking your access.', title: 'Let’s reconnect', error: 'We can’t check your access right now. Connect to the internet and try again.', retry: 'Try again', logout: 'Sign out' }
    : locale === 'es'
      ? { loading: 'Un momento …', checking: 'Estamos comprobando tu acceso.', title: 'Vamos a reconectar', error: 'Ahora no podemos comprobar tu acceso. Conéctate a internet e inténtalo de nuevo.', retry: 'Reintentar', logout: 'Cerrar sesión' }
      : { loading: 'Einen Moment …', checking: 'Dein Zugang wird geprüft.', title: 'Kurz verbinden', error: 'Dein Zugang lässt sich gerade nicht prüfen. Verbinde dich mit dem Internet und versuche es erneut.', retry: 'Erneut versuchen', logout: 'Abmelden' };
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
      <ConnectionRecoveryScreen testID="root-paywall-overlay" unavailable={gate.unavailable}
        title={gate.unavailable ? copy.title : copy.loading} message={gate.unavailable ? copy.error : copy.checking}
        retryLabel={copy.retry} retryTestID="root-paywall-retry" onRetry={gate.retry}
        secondaryLabel={copy.logout} secondaryTestID="root-paywall-signout" onSecondaryPress={onSignOut} />
    </Modal>}
  </>;
}
