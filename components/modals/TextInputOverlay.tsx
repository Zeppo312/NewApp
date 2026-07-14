import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  TextInputProps,
} from 'react-native';
import { BlurView } from 'expo-blur';

type Props = {
  visible: boolean;
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  accentColor?: string;
  keyboardType?: TextInputProps['keyboardType'];
  inputMode?: TextInputProps['inputMode'];
  onClose: () => void;
  onSubmit: (next: string) => void;
};

const DEFAULT_ACCENT = '#5E3DB3';

const TextInputOverlay: React.FC<Props> = ({
  visible,
  label,
  value,
  placeholder,
  multiline,
  accentColor = DEFAULT_ACCENT,
  keyboardType,
  inputMode,
  onClose,
  onSubmit,
}) => {
  const [text, setText] = useState(value);
  const bottomLift = Platform.OS === 'ios' ? 200 : 140;

  useEffect(() => {
    if (visible) {
      setText(value);
    }
  }, [visible, value]);

  const handleSubmit = () => {
    onSubmit(text);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={[styles.center, { paddingBottom: bottomLift }]}
      >
        <BlurView intensity={92} tint="extraLight" style={styles.card}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={[styles.input, multiline && styles.inputMultiline]}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor="rgba(125,90,80,0.55)"
            autoFocus
            multiline={!!multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            keyboardType={keyboardType}
            inputMode={inputMode}
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionGhost} onPress={onClose}>
              <Text style={styles.actionGhostLabel}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionPrimary, { backgroundColor: accentColor }]} onPress={handleSubmit}>
              <Text style={styles.actionPrimaryLabel}>Fertig</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 30,
    overflow: 'hidden',
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    marginBottom: 10,
  },
  input: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#7D5A50',
  },
  inputMultiline: {
    minHeight: 170,
    paddingVertical: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  actionGhost: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  actionGhostLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B4C3B',
  },
  actionPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  actionPrimaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

export default TextInputOverlay;
