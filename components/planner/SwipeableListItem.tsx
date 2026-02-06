import React, { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  GestureResponderEvent,
  TextStyle,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";
import { PRIMARY, TEXT_PRIMARY } from "@/constants/PlannerDesign";

type Props = {
  id: string;
  title: string;
  type: "todo" | "event";
  subtitle?: string;
  completed?: boolean;
  onComplete?: (id: string) => void;
  onMoveTomorrow?: (id: string) => void;
  onDelete?: (id: string) => void;
  onLongPress?: (id: string) => void;
  onPress?: (id: string) => void;
  showLeadingCheckbox?: boolean; // default true for todo
  trailingCheckbox?: boolean; // when true, render checkbox at right instead of left
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export const SwipeableListItem: React.FC<Props> = ({
  id,
  title,
  type,
  subtitle,
  completed,
  onComplete,
  onMoveTomorrow,
  onDelete,
  onLongPress,
  onPress,
  showLeadingCheckbox = true,
  trailingCheckbox = false,
  style,
  titleStyle,
  subtitleStyle,
}) => {
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" ||
    adaptiveColors.isDarkBackground;
  const accentColor = isDark ? adaptiveColors.accent : PRIMARY;
  const textPrimary = isDark ? Colors.dark.textPrimary : TEXT_PRIMARY;
  const textSecondary = isDark ? Colors.dark.textSecondary : TEXT_PRIMARY;

  const ref = useRef<Swipeable | null>(null);
  const scale = useRef(new Animated.Value(completed ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: completed ? 1 : 0,
      bounciness: 12,
      useNativeDriver: true,
    }).start();
  }, [completed, scale]);

  const animateCheck = (to: number) => {
    Animated.spring(scale, {
      toValue: to,
      bounciness: 12,
      useNativeDriver: true,
    }).start();
  };

  const leftActions = () => (
    <View style={[styles.action, styles.left]}>
      <IconSymbol name="checklist" color="#fff" size={24} />
      <Text style={styles.actionText}>Erledigt</Text>
    </View>
  );
  const rightActions = () => (
    <View style={[styles.action, styles.right]}>
      <IconSymbol name="trash" color="#fff" size={24} />
      <Text style={styles.actionText}>Löschen</Text>
    </View>
  );

  const triggerComplete = () => {
    if (type !== "todo" || !onComplete) return;
    Haptics.selectionAsync();
    onComplete(id);
  };

  const handleCheckboxPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    triggerComplete();
  };

  return (
    <Swipeable
      ref={ref}
      renderLeftActions={leftActions}
      renderRightActions={rightActions}
      onSwipeableLeftOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        animateCheck(1);
        onComplete?.(id);
        ref.current?.close();
      }}
      onSwipeableRightOpen={() => {
        Haptics.selectionAsync();
        ref.current?.close();
        if (onDelete) {
          Alert.alert(
            "Eintrag löschen",
            "Möchtest du diesen Eintrag wirklich löschen?",
            [
              { text: "Abbrechen", style: "cancel" },
              {
                text: "Löschen",
                style: "destructive",
                onPress: () => onDelete(id),
              },
            ],
          );
        }
      }}
    >
      <Pressable
        onPress={() => {
          if (onPress) {
            onPress(id);
          }
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (onLongPress) onLongPress(id);
          else
            Alert.alert("Aktionen", title, [
              { text: "Bearbeiten" },
              { text: "Zu Block verschieben" },
              { text: "Tags" },
              { text: "Löschen", style: "destructive" },
              { text: "Abbrechen", style: "cancel" },
            ]);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${type === "todo" ? "Aufgabe" : "Termin"}: ${title}${completed ? ", erledigt" : ""}`}
        accessibilityHint="Doppeltippen für Optionen, nach rechts wischen zum Erledigen, nach links zum Verschieben auf morgen"
        style={[styles.item, style]}
      >
        {/* Leading area */}
        {!trailingCheckbox && (
          <View style={styles.leading}>
            {type === "todo" && showLeadingCheckbox ? (
              <Pressable onPress={handleCheckboxPress} hitSlop={10}>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: accentColor },
                    completed && [
                      styles.checkboxDone,
                      {
                        backgroundColor: accentColor,
                        borderColor: accentColor,
                      },
                    ],
                  ]}
                >
                  <Animated.View
                    style={[styles.checkDot, { transform: [{ scale }] }]}
                  />
                </View>
              </Pressable>
            ) : type === "event" ? (
              <IconSymbol
                name="calendar"
                color={accentColor as any}
                size={20}
              />
            ) : (
              <View style={{ width: 20 }} />
            )}
          </View>
        )}
        <View style={{ flex: 1, minHeight: 32, justifyContent: "center" }}>
          <Text
            style={[
              styles.title,
              { color: textPrimary },
              completed && styles.titleDone,
              titleStyle,
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: textSecondary }, subtitleStyle]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {/* Trailing checkbox (Structured-like) */}
        {trailingCheckbox && type === "todo" && (
          <Pressable
            style={styles.trailing}
            onPress={handleCheckboxPress}
            hitSlop={10}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: accentColor },
                completed && [
                  styles.checkboxDone,
                  { backgroundColor: accentColor, borderColor: accentColor },
                ],
              ]}
            >
              <Animated.View
                style={[styles.checkDot, { transform: [{ scale }] }]}
              />
            </View>
          </Pressable>
        )}
      </Pressable>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  item: {
    minHeight: 48,
    paddingVertical: 10,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  leading: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  trailing: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    backgroundColor: PRIMARY,
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  title: { fontSize: 16, color: TEXT_PRIMARY, fontWeight: "600" },
  titleDone: { textDecorationLine: "line-through", opacity: 0.5 },
  subtitle: { fontSize: 12, opacity: 0.7, marginTop: 2, color: TEXT_PRIMARY },
  action: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  left: { backgroundColor: "#2ecc71" },
  right: { backgroundColor: "#FF6B6B" },
  actionText: { color: "#fff", fontWeight: "600", marginLeft: 8 },
});

export default SwipeableListItem;
