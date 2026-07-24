import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  applyLinkedBabySelection,
  getLinkedBabySelectionOptions,
  type LinkedBabySelectionOption,
} from '@/lib/baby';
import {
  DEFAULT_ACCOUNT_LINKING_LOCALE,
  getAccountLinkingLocaleTag,
  translateAccountLinkingText,
  type AccountLinkingLocale,
  type AccountLinkingTranslationKey,
} from '@/lib/accountLinkingTranslations';

type LinkedBabySelectionModalProps = {
  visible: boolean;
  currentUserId?: string | null;
  linkedUserId?: string | null;
  linkedUserName?: string | null;
  locale?: AccountLinkingLocale;
  onApplied: () => Promise<void> | void;
};

const formatBabyMeta = (
  baby: LinkedBabySelectionOption,
  locale: AccountLinkingLocale,
) => {
  const t = (key: AccountLinkingTranslationKey, params?: Record<string, string | number>) =>
    translateAccountLinkingText(locale, key, params);

  if (baby.birth_date) {
    const date = new Date(baby.birth_date);
    if (!Number.isNaN(date.getTime())) {
      return t('modal.bornOn', {
        date: date.toLocaleDateString(getAccountLinkingLocaleTag(locale)),
      });
    }
    return t('modal.born');
  }

  return t('modal.pregnancy');
};

export function LinkedBabySelectionModal({
  visible,
  currentUserId,
  linkedUserId,
  linkedUserName,
  locale = DEFAULT_ACCOUNT_LINKING_LOCALE,
  onApplied,
}: LinkedBabySelectionModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const [options, setOptions] = useState<LinkedBabySelectionOption[]>([]);
  const [selectedBabyIds, setSelectedBabyIds] = useState<string[]>([]);
  const [deleteUnselectedOwnedByCurrentUser, setDeleteUnselectedOwnedByCurrentUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const textPrimary = isDark ? Colors.dark.text : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const overlayColor = isDark ? 'rgba(12, 12, 16, 0.72)' : 'rgba(92, 64, 51, 0.34)';
  const sheetColor = isDark ? '#1E1B22' : '#FFF8F4';
  const sheetBorderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(125, 90, 80, 0.12)';
  const cardColor = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const cardBorderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(125, 90, 80, 0.08)';
  const activeCardBorderColor = isDark ? '#E9C9B6' : '#D7A98F';
  const activeCardColor = isDark ? 'rgba(233,201,182,0.14)' : 'rgba(233,201,182,0.16)';
  const primaryButtonColor = '#9DBEBB';
  const secondaryButtonColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(125, 90, 80, 0.08)';
  const t = (key: AccountLinkingTranslationKey, params?: Record<string, string | number>) =>
    translateAccountLinkingText(locale, key, params);

  useEffect(() => {
    if (!visible || !currentUserId || !linkedUserId) {
      if (!visible) {
        setOptions([]);
        setSelectedBabyIds([]);
        setDeleteUnselectedOwnedByCurrentUser(false);
      }
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getLinkedBabySelectionOptions(currentUserId, linkedUserId)
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          throw result.error;
        }

        const nextOptions = result.data ?? [];
        setOptions(nextOptions);
        const initiallySelected = nextOptions
          .filter((baby) => baby.is_shared_between_accounts)
          .map((baby) => baby.id);
        setSelectedBabyIds(initiallySelected.length > 0 ? initiallySelected : nextOptions.map((baby) => baby.id));
        setDeleteUnselectedOwnedByCurrentUser(false);
      })
      .catch((error: any) => {
        console.error('Failed to load linked baby selection modal:', error);
        if (!cancelled) {
          Alert.alert(
            translateAccountLinkingText(locale, 'common.error'),
            error?.message || translateAccountLinkingText(locale, 'modal.loadFailed'),
          );
          setOptions([]);
          setSelectedBabyIds([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, currentUserId, linkedUserId, locale]);

  const currentUserBabies = useMemo(
    () => options.filter((baby) => baby.is_owned_by_current_user),
    [options],
  );
  const linkedUserBabies = useMemo(
    () => options.filter((baby) => !baby.is_owned_by_current_user),
    [options],
  );
  const allSelected = options.length > 0 && selectedBabyIds.length === options.length;
  const ownUnselectedCount = currentUserBabies.filter((baby) => !selectedBabyIds.includes(baby.id)).length;

  const toggleBaby = (babyId: string) => {
    setSelectedBabyIds((current) => (
      current.includes(babyId)
        ? current.filter((id) => id !== babyId)
        : [...current, babyId]
    ));
  };

  const handleApply = async (mode: 'all' | 'selection') => {
    if (!currentUserId || !linkedUserId) return;

    const targetSelection = mode === 'all'
      ? options.map((baby) => baby.id)
      : selectedBabyIds;

    if (targetSelection.length === 0) {
      Alert.alert(t('common.notice'), t('modal.minimumSelection'));
      return;
    }

    setIsApplying(true);
    try {
      const result = await applyLinkedBabySelection({
        currentUserId,
        linkedUserId,
        selectedBabyIds: targetSelection,
        deleteUnselectedOwnedByCurrentUser: mode === 'all' ? false : deleteUnselectedOwnedByCurrentUser,
      });

      if (result.error) {
        throw result.error;
      }

      await onApplied();
    } catch (error: any) {
      console.error('Failed to apply linked baby selection:', error);
      Alert.alert(t('common.error'), error?.message || t('modal.saveFailed'));
    } finally {
      setIsApplying(false);
    }
  };

  const renderBabyGroup = (title: string, babies: LinkedBabySelectionOption[]) => {
    if (babies.length === 0) return null;

    return (
      <View style={styles.group}>
        <ThemedText style={[styles.groupTitle, { color: textSecondary }]}>{title}</ThemedText>
        {babies.map((baby) => {
          const isSelected = selectedBabyIds.includes(baby.id);
          return (
            <TouchableOpacity
              key={baby.id}
              style={[
                styles.babyCard,
                {
                  backgroundColor: isSelected ? activeCardColor : cardColor,
                  borderColor: isSelected ? activeCardBorderColor : cardBorderColor,
                },
              ]}
              onPress={() => toggleBaby(baby.id)}
              activeOpacity={0.9}
              disabled={isApplying}
            >
              <View style={styles.babyCardTopRow}>
                <View style={styles.babyTitleWrap}>
                  <ThemedText style={[styles.babyTitle, { color: textPrimary }]}>
                    {baby.name?.trim() || t('modal.unnamedBaby')}
                  </ThemedText>
                  <ThemedText style={[styles.babyMeta, { color: textSecondary }]}>
                    {formatBabyMeta(baby, locale)}
                  </ThemedText>
                </View>
                <IconSymbol
                  name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                  size={24}
                  color={isSelected ? primaryButtonColor : textSecondary}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <View style={[styles.sheet, { backgroundColor: sheetColor, borderColor: sheetBorderColor }]}>
          {isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={primaryButtonColor} />
              <ThemedText style={[styles.centerStateText, { color: textSecondary }]}>
                {t('modal.loading')}
              </ThemedText>
            </View>
          ) : (
            <>
              <ThemedText style={[styles.title, { color: textPrimary }]}>
                {t('modal.title')}
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: textSecondary }]}>
                {t('modal.subtitle', {
                  name: linkedUserName || t('modal.linkedAccountFallback'),
                })}
              </ThemedText>

              {options.length === 0 ? (
                <>
                  <View style={[styles.emptyStateCard, { backgroundColor: cardColor, borderColor: cardBorderColor }]}>
                    <ThemedText style={[styles.emptyStateTitle, { color: textPrimary }]}>
                      {t('modal.emptyTitle')}
                    </ThemedText>
                    <ThemedText style={[styles.emptyStateText, { color: textSecondary }]}>
                      {t('modal.emptyText')}
                    </ThemedText>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: primaryButtonColor, marginTop: 8 }]}
                    onPress={() => void onApplied()}
                    activeOpacity={0.9}
                  >
                    <ThemedText style={styles.primaryButtonText}>{t('modal.continue')}</ThemedText>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.selectAllRow}
                    onPress={() => setSelectedBabyIds(options.map((baby) => baby.id))}
                    disabled={isApplying || allSelected || options.length === 0}
                  >
                    <IconSymbol
                      name={allSelected ? 'checkmark.circle.fill' : 'plus.circle'}
                      size={18}
                      color={allSelected ? primaryButtonColor : textSecondary}
                    />
                    <ThemedText style={[styles.selectAllText, { color: allSelected ? primaryButtonColor : textSecondary }]}>
                      {allSelected ? t('modal.allSelected') : t('modal.selectAll')}
                    </ThemedText>
                  </TouchableOpacity>

                  <ScrollView
                    style={styles.scrollArea}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {renderBabyGroup(t('modal.ownAccount'), currentUserBabies)}
                    {renderBabyGroup(linkedUserName || t('modal.linkedAccount'), linkedUserBabies)}
                  </ScrollView>

                  <TouchableOpacity
                    style={[
                      styles.deleteToggle,
                      {
                        backgroundColor: deleteUnselectedOwnedByCurrentUser ? activeCardColor : cardColor,
                        borderColor: deleteUnselectedOwnedByCurrentUser ? activeCardBorderColor : cardBorderColor,
                        opacity: ownUnselectedCount === 0 ? 0.6 : 1,
                      },
                    ]}
                    onPress={() => {
                      if (ownUnselectedCount === 0 || isApplying) return;
                      setDeleteUnselectedOwnedByCurrentUser((current) => !current);
                    }}
                    disabled={ownUnselectedCount === 0 || isApplying}
                    activeOpacity={0.9}
                  >
                    <View style={styles.deleteToggleTextWrap}>
                      <ThemedText style={[styles.deleteToggleTitle, { color: textPrimary }]}>
                        {t('modal.deleteTitle')}
                      </ThemedText>
                      <ThemedText style={[styles.deleteToggleSubtitle, { color: textSecondary }]}>
                        {t('modal.deleteDescription')}
                      </ThemedText>
                    </View>
                    <IconSymbol
                      name={deleteUnselectedOwnedByCurrentUser ? 'checkmark.circle.fill' : 'circle'}
                      size={22}
                      color={deleteUnselectedOwnedByCurrentUser ? primaryButtonColor : textSecondary}
                    />
                  </TouchableOpacity>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { backgroundColor: secondaryButtonColor }]}
                      onPress={() => handleApply('all')}
                      disabled={isApplying || options.length === 0}
                      activeOpacity={0.9}
                    >
                      <ThemedText style={[styles.secondaryButtonText, { color: textPrimary }]}>
                        {t('modal.keepAll')}
                      </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        { backgroundColor: primaryButtonColor },
                        (isApplying || selectedBabyIds.length === 0) && styles.buttonDisabled,
                      ]}
                      onPress={() => handleApply('selection')}
                      disabled={isApplying || selectedBabyIds.length === 0}
                      activeOpacity={0.9}
                    >
                      {isApplying ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>{t('modal.applySelection')}</ThemedText>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheet: {
    maxHeight: '88%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 12,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  centerStateText: {
    marginTop: 12,
    fontSize: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 14,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollArea: {
    maxHeight: 320,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  emptyStateCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 6,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  group: {
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  babyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  babyCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  babyTitleWrap: {
    flex: 1,
  },
  babyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  babyMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  deleteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
  },
  deleteToggleTextWrap: {
    flex: 1,
  },
  deleteToggleTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  deleteToggleSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1.3,
    borderRadius: 16,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
