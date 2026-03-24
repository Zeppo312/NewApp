import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { getSafePickerDate } from '@/lib/safeDate';

type PickerVariant = 'calendar' | 'spinner';
const DEFAULT_MIN_DATE = new Date(2000, 0, 1);
const DEFAULT_MAX_DATE = new Date(2100, 11, 31, 23, 59, 59, 999);

type Props = {
  visible: boolean;
  title: string;
  value: Date | null | undefined;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  mode?: 'date' | 'time' | 'datetime';
  initialVariant?: PickerVariant;
  confirmLabel?: string;
  cancelLabel?: string;
};

export default function IOSBottomDatePicker({
  visible,
  title,
  value,
  onClose,
  onConfirm,
  minimumDate,
  maximumDate,
  mode = 'date',
  confirmLabel = 'Fertig',
  cancelLabel = 'Abbrechen',
}: Props) {
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;

  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const accent = adaptiveColors.accent;

  const sanitizeDateProp = (date?: Date) => {
    if (!date) return undefined;
    return Number.isFinite(date.getTime()) ? date : undefined;
  };

  const normalizeBounds = (min?: Date, max?: Date) => {
    const safeMin = sanitizeDateProp(min);
    const safeMax = sanitizeDateProp(max);
    const shouldApplyFallbackBounds = mode !== 'time';
    const fallbackMin = shouldApplyFallbackBounds ? DEFAULT_MIN_DATE : undefined;
    const fallbackMax = shouldApplyFallbackBounds ? DEFAULT_MAX_DATE : undefined;
    const resolvedMin = safeMin ?? fallbackMin;
    const resolvedMax = safeMax ?? fallbackMax;

    if (!resolvedMin || !resolvedMax) {
      return { minimumDate: resolvedMin, maximumDate: resolvedMax };
    }
    if (resolvedMin.getTime() <= resolvedMax.getTime()) {
      return { minimumDate: resolvedMin, maximumDate: resolvedMax };
    }
    // Prevent iOS UIDatePicker crash when minimumDate is after maximumDate.
    return {
      minimumDate: new Date(resolvedMax.getTime()),
      maximumDate: new Date(resolvedMax.getTime()),
    };
  };

  const normalizedBounds = normalizeBounds(minimumDate, maximumDate);
  const safeDateOptions =
    mode === 'time' ? { minYear: 1900 } : normalizedBounds;
  const [draft, setDraft] = useState<Date>(() =>
    getSafePickerDate(value, new Date(), safeDateOptions)
  );

  const safeValueKey = useMemo(() => (value ? value.getTime() : 0), [value]);
  const minKey = useMemo(
    () => (normalizedBounds.minimumDate ? normalizedBounds.minimumDate.getTime() : 0),
    [normalizedBounds.minimumDate]
  );
  const maxKey = useMemo(
    () => (normalizedBounds.maximumDate ? normalizedBounds.maximumDate.getTime() : 0),
    [normalizedBounds.maximumDate]
  );

  useEffect(() => {
    if (!visible) return;
    setDraft(getSafePickerDate(value, new Date(), safeDateOptions));
  }, [visible, safeValueKey, minKey, maxKey, value, mode]);

  if (Platform.OS !== 'ios') return null;

  const display = 'spinner';

  const handleConfirm = () => {
    const safe = getSafePickerDate(draft, new Date(), safeDateOptions);
    onConfirm(safe);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? 'rgba(24,24,28,0.97)' : 'rgba(255,255,255,0.98)',
              borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.headerAction, { color: textSecondary }]}>{cancelLabel}</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={handleConfirm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.headerAction, { color: accent }]}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={getSafePickerDate(draft, new Date(), safeDateOptions)}
            mode={mode}
            display={display}
            locale="de-DE"
            onChange={(_, date) => {
              if (!date) return;
              setDraft(getSafePickerDate(date, draft, safeDateOptions));
            }}
            minimumDate={normalizedBounds.minimumDate}
            maximumDate={normalizedBounds.maximumDate}
            themeVariant={isDark ? 'dark' : 'light'}
            style={styles.picker}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerAction: {
    fontSize: 16,
    fontWeight: '600',
  },
  picker: {
    width: '100%',
  },
});
