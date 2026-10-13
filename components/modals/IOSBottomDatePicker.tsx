import DateTimePicker from '@/components/ui/DateTimePicker';
import { FormSheet } from '@/components/ui/form-sheet';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { getAppLocaleTag } from '@/lib/localization';
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
  locale?: string;
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
  confirmLabel,
  cancelLabel,
  locale,
}: Props) {
  const { locale: appLocale } = useLocale();
  const resolvedConfirmLabel =
    confirmLabel ??
    ({ de: 'Fertig', en: 'Done', es: 'Listo' } as const)[appLocale];
  const resolvedCancelLabel =
    cancelLabel ??
    ({ de: 'Abbrechen', en: 'Cancel', es: 'Cancelar' } as const)[appLocale];
  const resolvedLocale = locale ?? getAppLocaleTag(appLocale);
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' ||
    adaptiveColors.isDarkBackground;

  const sanitizeDateProp = (date?: Date) => {
    if (!date) return undefined;
    return Number.isFinite(date.getTime()) ? date : undefined;
  };

  const normalizeBounds = (min?: Date, max?: Date) => {
    const safeMin = sanitizeDateProp(min);
    const safeMax = sanitizeDateProp(max);
    const shouldApplyFallbackBounds = mode !== 'time';
    const fallbackMin = shouldApplyFallbackBounds
      ? DEFAULT_MIN_DATE
      : undefined;
    const fallbackMax = shouldApplyFallbackBounds
      ? DEFAULT_MAX_DATE
      : undefined;
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
    getSafePickerDate(value, new Date(), safeDateOptions),
  );

  const safeValueKey = useMemo(() => (value ? value.getTime() : 0), [value]);
  const minKey = useMemo(
    () =>
      normalizedBounds.minimumDate ? normalizedBounds.minimumDate.getTime() : 0,
    [normalizedBounds.minimumDate],
  );
  const maxKey = useMemo(
    () =>
      normalizedBounds.maximumDate ? normalizedBounds.maximumDate.getTime() : 0,
    [normalizedBounds.maximumDate],
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
    <FormSheet
      visible={visible}
      title={title}
      isDark={isDark}
      onClose={onClose}
      onConfirm={handleConfirm}
      cancelLabel={resolvedCancelLabel}
      confirmLabel={resolvedConfirmLabel}
    >
      <DateTimePicker
        value={getSafePickerDate(draft, new Date(), safeDateOptions)}
        mode={mode}
        display={display}
        locale={resolvedLocale}
        onChange={(_, date) => {
          if (!date) return;
          setDraft(getSafePickerDate(date, draft, safeDateOptions));
        }}
        minimumDate={normalizedBounds.minimumDate}
        maximumDate={normalizedBounds.maximumDate}
        themeVariant={isDark ? 'dark' : 'light'}
        style={styles.picker}
      />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  picker: {
    width: '100%',
  },
});
