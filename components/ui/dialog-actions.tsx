import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useLocale } from '@/contexts/LocaleContext';
import { ActionButton } from '@/components/ui/action-button';

type Props = {
  onCancel: () => unknown;
  onConfirm: () => unknown;
  cancelLabel?: string;
  confirmLabel?: string;
  cancelVariant?: 'secondary' | 'destructive';
  busy?: boolean;
  cancelDisabled?: boolean;
  confirmDisabled?: boolean;
  isDark?: boolean;
  bottomInset?: number;
  style?: StyleProp<ViewStyle>;
};

/** A single confirmation position: outside the scrollable form, cancel left/save right. */
export function DialogActions({
  onCancel, onConfirm, cancelLabel, confirmLabel, cancelVariant = 'secondary',
  busy = false, cancelDisabled = false, confirmDisabled = false,
  isDark = false, bottomInset = 0, style,
}: Props) {
  const { locale } = useLocale();
  const labels = {
    de: { cancel: 'Abbrechen', save: 'Speichern' },
    en: { cancel: 'Cancel', save: 'Save' },
    es: { cancel: 'Cancelar', save: 'Guardar' },
  }[locale];
  return (
    <View style={[styles.row, {
      borderTopColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.06)',
      paddingBottom: Math.max(12, bottomInset),
    }, style]}>
      <ActionButton label={cancelLabel ?? labels.cancel} variant={cancelVariant} isDark={isDark}
        disabled={busy || cancelDisabled} onPress={onCancel} style={styles.action} />
      <ActionButton label={confirmLabel ?? labels.save} isDark={isDark}
        busy={busy} disabled={confirmDisabled} onPress={onConfirm} style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 12,
    paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  action: { flexGrow: 1, flexBasis: 120 },
});
