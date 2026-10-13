import { FormSheet, FormTextInput } from '@/components/ui/form-sheet';
import { useLocale } from '@/contexts/LocaleContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import React, { useState } from 'react';
import { TextInputProps } from 'react-native';

type Props = {
  visible: boolean;
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  /** @deprecated Action colors come from the shared action palette. */
  accentColor?: string;
  submitLabel?: string;
  keyboardType?: TextInputProps['keyboardType'];
  inputMode?: TextInputProps['inputMode'];
  onClose: () => void;
  onSubmit: (next: string) => void;
  onChangeText?: (next: string) => void;
};

type OverlayContentProps = Omit<Props, 'visible'> & {
  visible: boolean;
  isDark: boolean;
};

const TextInputOverlayContent: React.FC<OverlayContentProps> = ({
  visible,
  label,
  value,
  placeholder,
  multiline,
  submitLabel,
  keyboardType,
  inputMode,
  onClose,
  onSubmit,
  onChangeText,
  isDark,
}) => {
  const { locale } = useLocale();
  const done = { de: 'Fertig', en: 'Done', es: 'Listo' }[locale];
  const [text, setText] = useState(value);
  return (
    <FormSheet
      visible={visible}
      title={label}
      isDark={isDark}
      onClose={onClose}
      onConfirm={() => onSubmit(text)}
      confirmLabel={submitLabel || done}
    >
      <FormTextInput
        isDark={isDark}
        value={text}
        placeholder={placeholder}
        autoFocus
        multiline={!!multiline}
        keyboardType={keyboardType}
        inputMode={inputMode}
        onChangeText={(next) => {
          setText(next);
          onChangeText?.(next);
        }}
      />
    </FormSheet>
  );
};

const TextInputOverlay: React.FC<Props> = ({
  visible,
  label,
  value,
  placeholder,
  multiline,
  submitLabel,
  keyboardType,
  inputMode,
  onClose,
  onSubmit,
  onChangeText,
}) => {
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' ||
    adaptiveColors.isDarkBackground;
  return visible ? (
    <TextInputOverlayContent
      key={label}
      visible={visible}
      label={label}
      value={value}
      placeholder={placeholder}
      multiline={multiline}
      submitLabel={submitLabel}
      keyboardType={keyboardType}
      inputMode={inputMode}
      onClose={onClose}
      onSubmit={onSubmit}
      isDark={isDark}
      onChangeText={onChangeText}
    />
  ) : null;
};

export default TextInputOverlay;
