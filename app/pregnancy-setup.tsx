/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedBackground } from '@/components/ThemedBackground';
import Header from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import IOSBottomDatePicker from '@/components/modals/IOSBottomDatePicker';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { createBaby, saveBabyInfo } from '@/lib/baby';
import { updateDueDateAndSync } from '@/lib/supabase';
import {
  DEFAULT_PREGNANCY_SETUP_LOCALE,
  getPregnancySetupLocaleTag,
  PregnancySetupTranslationKey,
  translatePregnancySetupText,
} from '@/lib/pregnancySetupTranslations';

type GenderOption = 'male' | 'female' | 'unknown';

let ACTIVE_PREGNANCY_SETUP_LOCALE = DEFAULT_PREGNANCY_SETUP_LOCALE;
let PREGNANCY_SETUP_LOCALE_TAG = getPregnancySetupLocaleTag(ACTIVE_PREGNANCY_SETUP_LOCALE);
const t = (
  key: PregnancySetupTranslationKey,
  params?: Record<string, string | number>,
) => translatePregnancySetupText(ACTIVE_PREGNANCY_SETUP_LOCALE, key, params);

const makeDefaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 280);
  return date;
};

export default function PregnancySetupScreen() {
  ACTIVE_PREGNANCY_SETUP_LOCALE = useLocale().locale;
  PREGNANCY_SETUP_LOCALE_TAG = getPregnancySetupLocaleTag(ACTIVE_PREGNANCY_SETUP_LOCALE);
  const colorScheme = useColorScheme() ?? 'light';
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { babyId: babyIdParam } = useLocalSearchParams<{ babyId?: string }>();
  const { user } = useAuth();
  const { setActiveBabyId, refreshBabies } = useActiveBaby();
  const {
    refreshBabyDetails,
    setIsBabyBorn,
    setTemporaryViewMode,
  } = useBabyStatus();

  const minDueDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxDueDate = useMemo(() => new Date(2100, 11, 31, 23, 59, 59, 999), []);

  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [tempDueDate, setTempDueDate] = useState<Date>(makeDefaultDueDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<GenderOption>('unknown');
  const [babyName, setBabyName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [targetBabyId, setTargetBabyId] = useState<string | null>(
    typeof babyIdParam === 'string' && babyIdParam ? babyIdParam : null,
  );

  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const inputBackground = isDark ? 'rgba(18,18,22,0.76)' : 'rgba(255,255,255,0.9)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(125, 90, 80, 0.2)';

  useEffect(() => {
    if (typeof babyIdParam === 'string' && babyIdParam) {
      setTargetBabyId(babyIdParam);
    }
  }, [babyIdParam]);

  const formattedDueDate = useMemo(() => {
    if (!dueDate) return t('dueDate.placeholder');
    return dueDate.toLocaleDateString(PREGNANCY_SETUP_LOCALE_TAG);
  }, [dueDate]);

  const openDatePicker = () => {
    setTempDueDate(dueDate ?? makeDefaultDueDate());
    setShowDatePicker(true);
  };

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    if (!selectedDate) {
      if (Platform.OS === 'android') setShowDatePicker(false);
      return;
    }

    setTempDueDate(selectedDate);
    if (Platform.OS === 'android') {
      setDueDate(selectedDate);
      setShowDatePicker(false);
    }
  };

  const handleCreatePregnancy = async () => {
    if (isSaving) return;
    if (!user) {
      Alert.alert(t('common.error'), t('validation.signIn'));
      return;
    }
    if (!dueDate) {
      Alert.alert(t('common.missing'), t('validation.dueDate'));
      return;
    }

    setIsSaving(true);
    try {
      let resolvedBabyId = targetBabyId;
      const trimmedName = babyName.trim();
      if (!resolvedBabyId) {
        const fallbackName = trimmedName || t('fallback.name');
        const { data, error } = await createBaby({
          name: fallbackName,
          baby_gender: gender,
          birth_date: null,
        });

        if (error) {
          throw error;
        }

        const created = Array.isArray(data) ? data[0] : data;
        if (!created?.id) {
          throw new Error(t('error.createBaby'));
        }

        resolvedBabyId = created.id;
        setTargetBabyId(created.id);
      }
      if (!resolvedBabyId) {
        throw new Error(t('error.noBaby'));
      }

      await refreshBabies();
      await setActiveBabyId(resolvedBabyId);

      const dueDateResult = await updateDueDateAndSync(user.id, dueDate);
      if (!dueDateResult?.success) {
        throw dueDateResult?.error ?? new Error(t('error.saveDueDate'));
      }

      const updates: { baby_gender: GenderOption; birth_date: null; name?: string } = {
        baby_gender: gender,
        birth_date: null,
      };
      if (trimmedName) {
        updates.name = trimmedName;
      }

      const { error: saveGenderError } = await saveBabyInfo(
        updates,
        resolvedBabyId,
      );
      if (saveGenderError) {
        throw saveGenderError;
      }

      setTemporaryViewMode(null);
      await setIsBabyBorn(false, { babyId: resolvedBabyId });
      await refreshBabies();
      await setActiveBabyId(resolvedBabyId);
      await refreshBabyDetails();

      router.replace('/(tabs)/pregnancy-home' as any);
    } catch (error) {
      console.error('Error creating pregnancy:', error);
      Alert.alert(t('common.error'), t('error.createPregnancy'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Header
          title={t('screen.title')}
          subtitle={t('screen.subtitle')}
          showBackButton
          onBackPress={() => router.back()}
        />

        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: inputBackground, borderColor: inputBorder }]}>
            <ThemedText style={[styles.label, { color: textPrimary }]}>{t('dueDate.label')}</ThemedText>
            <TouchableOpacity
              style={[styles.dateButton, { borderColor: inputBorder }]}
              onPress={openDatePicker}
              disabled={isSaving}
            >
              <ThemedText style={[styles.dateButtonText, { color: textPrimary }]}>{formattedDueDate}</ThemedText>
            </TouchableOpacity>

            {showDatePicker && Platform.OS !== 'ios' && (
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={tempDueDate}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  minimumDate={minDueDate}
                  maximumDate={maxDueDate}
                  themeVariant={isDark ? 'dark' : 'light'}
                />
              </View>
            )}
            {Platform.OS === 'ios' && (
              <IOSBottomDatePicker
                visible={showDatePicker}
                title={t('dueDate.pickerTitle')}
                value={tempDueDate}
                mode="date"
                minimumDate={minDueDate}
                maximumDate={maxDueDate}
                confirmLabel={t('common.done')}
                cancelLabel={t('common.cancel')}
                locale={PREGNANCY_SETUP_LOCALE_TAG}
                onClose={() => setShowDatePicker(false)}
                onConfirm={(date) => {
                  setTempDueDate(date);
                  setDueDate(date);
                  setShowDatePicker(false);
                }}
                initialVariant="calendar"
              />
            )}
          </View>

          <View style={[styles.card, { backgroundColor: inputBackground, borderColor: inputBorder }]}>
            <ThemedText style={[styles.label, { color: textPrimary }]}>
              {t('gender.label')}
            </ThemedText>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'male' && styles.genderButtonActive]}
                onPress={() => setGender('male')}
                disabled={isSaving}
              >
                <ThemedText style={[styles.genderButtonText, { color: textPrimary }]}>{t('gender.boy')}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'female' && styles.genderButtonActive]}
                onPress={() => setGender('female')}
                disabled={isSaving}
              >
                <ThemedText style={[styles.genderButtonText, { color: textPrimary }]}>{t('gender.girl')}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'unknown' && styles.genderButtonActive]}
                onPress={() => setGender('unknown')}
                disabled={isSaving}
              >
                <ThemedText style={[styles.genderButtonText, { color: textPrimary }]}>{t('gender.unknown')}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: inputBackground, borderColor: inputBorder }]}>
            <ThemedText style={[styles.label, { color: textPrimary }]}>
              {t('name.label')}
            </ThemedText>
            <TextInput
              style={[styles.nameInput, { borderColor: inputBorder, color: textPrimary }]}
              value={babyName}
              onChangeText={setBabyName}
              editable={!isSaving}
              placeholder={t('name.placeholder')}
              placeholderTextColor={textSecondary}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.accent }, isSaving && styles.submitButtonDisabled]}
            onPress={handleCreatePregnancy}
            disabled={isSaving}
          >
            <ThemedText style={[styles.submitButtonText, { color: textPrimary }]}>
              {isSaving ? t('submit.saving') : t('submit.idle')}
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  dateButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dateButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  datePickerContainer: {
    marginTop: 8,
  },
  iosActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  iosActionButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  iosActionPrimary: {
    backgroundColor: '#E9C9B6',
    borderColor: '#E9C9B6',
  },
  iosActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.25)',
    backgroundColor: 'rgba(255,255,255,0.35)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: 'rgba(233, 201, 182, 0.5)',
    borderColor: '#E9C9B6',
  },
  genderButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.35)',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
