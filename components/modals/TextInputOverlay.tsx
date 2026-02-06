import React, { useEffect, useState } from "react";
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
} from "react-native";
import { BlurView } from "expo-blur";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";

type Props = {
  visible: boolean;
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  accentColor?: string;
  keyboardType?: TextInputProps["keyboardType"];
  inputMode?: TextInputProps["inputMode"];
  onClose: () => void;
  onSubmit: (next: string) => void;
};

const DEFAULT_ACCENT = "#5E3DB3";

const TextInputOverlay: React.FC<Props> = ({
  visible,
  label,
  value,
  placeholder,
  multiline,
  accentColor,
  keyboardType,
  inputMode,
  onClose,
  onSubmit,
}) => {
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" ||
    adaptiveColors.isDarkBackground;
  const resolvedAccentColor =
    accentColor ?? (isDark ? adaptiveColors.accent : DEFAULT_ACCENT);
  const blurTint = isDark ? "dark" : "extraLight";
  const palette = {
    backdrop: isDark ? "rgba(0,0,0,0.62)" : "rgba(0,0,0,0.45)",
    card: isDark ? "rgba(10,10,14,0.94)" : "rgba(255,255,255,0.95)",
    cardBorder: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.72)",
    text: isDark ? adaptiveColors.textPrimary : "#7D5A50",
    textSecondary: isDark ? adaptiveColors.textSecondary : "#6B4C3B",
    field: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.92)",
    fieldBorder: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)",
    placeholder: isDark ? "rgba(248,240,229,0.58)" : "rgba(125,90,80,0.55)",
    ghostBg: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.05)",
  };

  const [text, setText] = useState(value);
  const bottomLift = Platform.OS === "ios" ? 200 : 140;

  useEffect(() => {
    if (visible) {
      setText(value);
    }
  }, [visible, value]);

  const handleSubmit = () => {
    onSubmit(text);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={[styles.backdrop, { backgroundColor: palette.backdrop }]}
        />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        style={[styles.center, { paddingBottom: bottomLift }]}
      >
        <BlurView
          intensity={92}
          tint={blurTint}
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.cardBorder },
          ]}
        >
          <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
          <TextInput
            style={[
              styles.input,
              multiline && styles.inputMultiline,
              {
                backgroundColor: palette.field,
                borderColor: palette.fieldBorder,
                color: palette.text,
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={palette.placeholder}
            autoFocus
            multiline={!!multiline}
            textAlignVertical={multiline ? "top" : "center"}
            keyboardType={keyboardType}
            inputMode={inputMode}
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionGhost, { backgroundColor: palette.ghostBg }]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.actionGhostLabel,
                  { color: palette.textSecondary },
                ]}
              >
                Abbrechen
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionPrimary,
                { backgroundColor: resolvedAccentColor },
              ]}
              onPress={handleSubmit}
            >
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
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 30,
    overflow: "hidden",
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  label: {
    fontSize: 17,
    fontWeight: "700",
    color: "#7D5A50",
    textAlign: "center",
    marginBottom: 10,
  },
  input: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#7D5A50",
  },
  inputMultiline: {
    minHeight: 170,
    paddingVertical: 14,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  actionGhost: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  actionGhostLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B4C3B",
  },
  actionPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  actionPrimaryLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});

export default TextInputOverlay;
