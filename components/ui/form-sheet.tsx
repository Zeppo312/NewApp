import { DialogActions } from '@/components/ui/dialog-actions';
import { GlassSheetSurface } from '@/components/ui/glass-sheet-surface';
import { ActionColors, FormColors } from '@/constants/Colors';
import { FORM_LAYOUT } from '@/constants/Forms';
import { TYPOGRAPHY } from '@/constants/Typography';
import { useLocale } from '@/contexts/LocaleContext';
import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  isDark: boolean;
  onClose: () => unknown;
  onConfirm?: () => unknown;
  confirmLabel?: string;
  cancelLabel?: string;
  cancelVariant?: 'secondary' | 'destructive';
  onCancel?: () => unknown;
  confirmDisabled?: boolean;
  busy?: boolean;
  children: React.ReactNode;
  /** Nested native modals remain inside the presenting Modal. */
  overlays?: React.ReactNode;
  /** Layout only: content-specific rows can reflow, but never restyle the material/header. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Virtualized content supplies its own scroller. */
  scrollable?: boolean;
};

export function FormSheet({
  visible,
  title,
  subtitle,
  isDark,
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel,
  cancelVariant,
  onCancel,
  confirmDisabled,
  busy = false,
  children,
  overlays,
  contentStyle,
  scrollable = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setIsKeyboardVisible] = React.useState(() => Keyboard.isVisible());
  React.useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const { locale } = useLocale();
  const colors = FormColors[isDark ? 'dark' : 'light'];
  const actions = ActionColors[isDark ? 'dark' : 'light'];
  const closeLabel = { de: 'Schließen', en: 'Close', es: 'Cerrar' }[locale];
  const close = () => {
    if (!busy) return onClose();
  };
  const heading = (
    <View style={[styles.header, scrollable && styles.scrollingHeader]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        disabled={busy}
        onPress={close}
        style={({ pressed }) => [
          styles.close,
          {
            backgroundColor: pressed
              ? actions.secondaryPressed
              : actions.secondary,
          },
        ]}
      >
        <Text
          accessible={false}
          style={[TYPOGRAPHY.headline, { color: actions.onSecondary }]}
        >
          ✕
        </Text>
      </Pressable>
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          style={[TYPOGRAPHY.dialogTitle, styles.title, { color: colors.text }]}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={[
              TYPOGRAPHY.bodySmall,
              styles.title,
              { color: colors.secondary },
            ]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.spacer} />
    </View>
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      {visible && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <Pressable
            accessible={false}
            focusable={false}
            disabled={busy}
            onPress={close}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.backdrop },
            ]}
          />
          <View
            pointerEvents="box-none"
            style={[
              styles.viewport,
              {
                paddingTop: insets.top + FORM_LAYOUT.edge,
                // The keyboard already covers the home-indicator safe area.
                paddingBottom: isKeyboardVisible
                  ? FORM_LAYOUT.edge
                  : Math.max(insets.bottom, FORM_LAYOUT.edge),
                paddingLeft: Math.max(insets.left, FORM_LAYOUT.edge),
                paddingRight: Math.max(insets.right, FORM_LAYOUT.edge),
              },
            ]}
          >
            <GlassSheetSurface isDark={isDark} style={styles.panel}>
              <View
                accessible={false}
                style={[styles.handle, { backgroundColor: colors.handle }]}
              />
              {!scrollable && heading}
              {scrollable ? (
                <ScrollView
                  style={styles.scroll}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={[styles.content, contentStyle]}
                >
                  {heading}

                  {children}
                </ScrollView>
              ) : (
                <View style={[styles.scroll, styles.content, contentStyle]}>
                  {children}
                </View>
              )}
              {onConfirm && (
                <DialogActions
                  isDark={isDark}
                  style={styles.actions}
                  busy={busy}
                  confirmDisabled={confirmDisabled}
                  confirmLabel={confirmLabel}
                  cancelLabel={cancelLabel}
                  cancelVariant={cancelVariant}
                  onCancel={onCancel ?? close}
                  onConfirm={onConfirm}
                />
              )}
            </GlassSheetSurface>
          </View>
          {overlays}
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

export function FormSection({
  label,
  children,
  isDark = false,
}: {
  label?: string;
  children: React.ReactNode;
  isDark?: boolean;
}) {
  const colors = FormColors[isDark ? 'dark' : 'light'];
  return (
    <View style={styles.section}>
      {label && (
        <Text style={[TYPOGRAPHY.label, { color: colors.text }]}>{label}</Text>
      )}
      {children}
    </View>
  );
}

export function FormField({
  value,
  placeholder,
  label,
  onPress,
  multiline = false,
  isDark,
  style,
  disabled = false,
}: {
  value?: string;
  placeholder?: string;
  label?: string;
  onPress: () => void;
  multiline?: boolean;
  isDark: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = FormColors[isDark ? 'dark' : 'light'];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        label ? `${label}: ${value || placeholder || ''}` : value || placeholder
      }
      style={[
        styles.field,
        multiline && styles.multiline,
        { backgroundColor: colors.field, borderColor: colors.border },
        style,
      ]}
    >
      {!!label && (
        <Text style={[TYPOGRAPHY.label, { color: colors.secondary }]}>
          {label}
        </Text>
      )}
      <Text
        style={[
          value ? TYPOGRAPHY.bodyStrong : TYPOGRAPHY.body,
          { color: value ? colors.text : colors.placeholder },
        ]}
      >
        {value || placeholder}
      </Text>
    </Pressable>
  );
}

export function FormTextInput({
  isDark,
  style,
  multiline,
  ...props
}: TextInputProps & { isDark: boolean; ref?: React.Ref<TextInput> }) {
  const colors = FormColors[isDark ? 'dark' : 'light'];
  return (
    <TextInput
      {...props}
      multiline={multiline}
      placeholderTextColor={colors.placeholder}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[
        TYPOGRAPHY.body,
        styles.field,
        multiline && styles.multiline,
        {
          backgroundColor: colors.field,
          borderColor: colors.border,
          color: colors.text,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  viewport: { flex: 1, justifyContent: 'flex-end' },
  panel: { maxHeight: '100%', flexShrink: 1 },
  handle: {
    width: FORM_LAYOUT.handleWidth,
    height: FORM_LAYOUT.handleHeight,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: FORM_LAYOUT.contentPadding,
  },
  scrollingHeader: { paddingHorizontal: 0, paddingBottom: 0 },
  close: {
    width: FORM_LAYOUT.closeSize,
    height: FORM_LAYOUT.closeSize,
    borderRadius: FORM_LAYOUT.closeSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: FORM_LAYOUT.closeSize },
  heading: { flex: 1, minWidth: 0, gap: 4 },
  title: { textAlign: 'center' },
  scroll: { flexShrink: 1, minHeight: 0 },
  content: {
    paddingHorizontal: FORM_LAYOUT.contentPadding,
    paddingBottom: FORM_LAYOUT.contentPadding,
    gap: FORM_LAYOUT.sectionGap,
  },
  actions: { marginHorizontal: FORM_LAYOUT.contentPadding },
  section: { gap: FORM_LAYOUT.fieldGap },
  field: {
    minHeight: FORM_LAYOUT.fieldMinHeight,
    borderRadius: FORM_LAYOUT.fieldRadius,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },
  multiline: {
    minHeight: FORM_LAYOUT.notesMinHeight,
    justifyContent: 'flex-start',
  },
});
