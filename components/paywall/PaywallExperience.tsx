import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import {
  type PaywallContent,
  getPaywallTemplateValues,
  resolvePaywallContent,
} from '@/lib/paywallContent';

type EditableTone = 'dark' | 'light';

type PaywallExperienceProps = {
  content: PaywallContent;
  billingLabel: string;
  isTrialExpired: boolean;
  allowClose?: boolean;
  previewOnly?: boolean;
  editable?: boolean;
  useInternalScrollView?: boolean;
  showAppleEula?: boolean;
  visiblePurchaseError?: string | null;
  pendingAction?: 'monthly' | 'yearly' | 'restore' | null;
  isPurchaseActionDisabled?: boolean;
  onChangeField?: (path: string, value: string) => void;
  onMonthlyPress?: () => void;
  onYearlyPress?: () => void;
  onRestorePress?: () => void;
  onClose?: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenAppleEula?: () => void;
  onOpenImprint?: () => void;
  onOpenDataManagement?: () => void;
};

type InlineEditableTextProps = {
  editable: boolean;
  path?: string;
  value: string;
  displayValue: string;
  style: any;
  multiline?: boolean;
  tone?: EditableTone;
  textAlign?: 'left' | 'center';
  onChangeField?: (path: string, value: string) => void;
};

function InlineEditableText({
  editable,
  path,
  value,
  displayValue,
  style,
  multiline = false,
  tone = 'dark',
  textAlign = 'left',
  onChangeField,
}: InlineEditableTextProps) {
  if (!editable || !path || !onChangeField) {
    return <Text style={style}>{displayValue}</Text>;
  }

  return (
    <View
      style={[
        styles.inlineEditorWrap,
        tone === 'dark' ? styles.inlineEditorWrapDark : styles.inlineEditorWrapLight,
      ]}
    >
      <TextInput
        value={value}
        onChangeText={(nextValue) => onChangeField(path, nextValue)}
        multiline={multiline}
        scrollEnabled={false}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder={displayValue}
        placeholderTextColor={
          tone === 'dark' ? 'rgba(255,255,255,0.48)' : 'rgba(92,64,51,0.38)'
        }
        style={[
          style,
          styles.inlineEditorInput,
          multiline && styles.inlineEditorInputMultiline,
          textAlign === 'center' && styles.inlineEditorInputCentered,
        ]}
      />
    </View>
  );
}

export function PaywallExperience({
  content,
  billingLabel,
  isTrialExpired,
  allowClose = true,
  previewOnly = false,
  editable = false,
  useInternalScrollView = true,
  showAppleEula = true,
  visiblePurchaseError,
  pendingAction = null,
  isPurchaseActionDisabled = false,
  onChangeField,
  onMonthlyPress,
  onYearlyPress,
  onRestorePress,
  onClose,
  onOpenPrivacy,
  onOpenTerms,
  onOpenAppleEula,
  onOpenImprint,
  onOpenDataManagement,
}: PaywallExperienceProps) {
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(0);

  const contentMaxWidth = Math.min(width - 40, 760);
  const isCompactPlanLayout = width < 720;
  const templateValues = useMemo(
    () => getPaywallTemplateValues(content.settings, billingLabel),
    [billingLabel, content.settings],
  );
  const resolvedContent = useMemo(
    () => resolvePaywallContent(content, templateValues),
    [content, templateValues],
  );
  const stepTransitionX = useRef(new Animated.Value(0)).current;
  const stepTransitionOpacity = useRef(new Animated.Value(1)).current;

  const showCloseButton = allowClose && !isTrialExpired;
  const showSecondaryCtas = !isTrialExpired && (allowClose || editable);
  const purchaseActionsDisabled =
    editable || previewOnly || isPurchaseActionDisabled;

  const goToStep = (nextStep: number) => {
    const clampedStep = Math.max(0, Math.min(nextStep, 2));
    if (clampedStep === step) return;

    const direction = clampedStep > step ? 1 : -1;
    stepTransitionX.setValue(direction * 22);
    stepTransitionOpacity.setValue(0.88);
    setStep(clampedStep);

    Animated.parallel([
      Animated.spring(stepTransitionX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 72,
        friction: 9,
      }),
      Animated.timing(stepTransitionOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleClose = () => {
    if (!showCloseButton) return;
    onClose?.();
  };

  const handleLegalPress = (callback?: () => void) => {
    if (previewOnly || editable) return;
    callback?.();
  };

  const renderText = (
    path: string | undefined,
    rawValue: string,
    displayValue: string,
    style: any,
    options?: {
      multiline?: boolean;
      tone?: EditableTone;
      textAlign?: 'left' | 'center';
    },
  ) => (
    <InlineEditableText
      editable={editable}
      path={path}
      value={rawValue}
      displayValue={displayValue}
      style={style}
      multiline={options?.multiline}
      tone={options?.tone}
      textAlign={options?.textAlign}
      onChangeField={onChangeField}
    />
  );

  const renderStepButton = (
    index: number,
    label: string,
    isActive: boolean,
  ) => (
    <Pressable
      key={label}
      onPress={() => goToStep(index)}
      style={[
        styles.stepTab,
        isActive && styles.stepTabActive,
      ]}
    >
      <Text style={[styles.stepTabText, isActive && styles.stepTabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );

  const renderAdvanceButtonLabel = () =>
    renderText(
      'progressCard.buttonLabel',
      content.progressCard.buttonLabel,
      resolvedContent.progressCard.buttonLabel,
      styles.primaryText,
      { tone: 'light', textAlign: 'center' },
    );
  const swipeResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      !editable &&
      Math.abs(gestureState.dx) > 14 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
    onMoveShouldSetPanResponderCapture: (_, gestureState) =>
      !editable &&
      Math.abs(gestureState.dx) > 14 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx <= -56) {
        goToStep(step + 1);
        return;
      }

      if (gestureState.dx >= 56) {
        goToStep(step - 1);
      }
    },
  });

  const renderSettingsBar = () => {
    if (!editable) return null;

    return (
      <View style={styles.settingsBar}>
        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>Trial Days</Text>
          <InlineEditableText
            editable
            path="settings.trialDays"
            value={content.settings.trialDays}
            displayValue={content.settings.trialDays}
            style={styles.settingValue}
            textAlign="center"
            tone="dark"
            onChangeField={onChangeField}
          />
        </View>
        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>Monat</Text>
          <InlineEditableText
            editable
            path="settings.monthlyPrice"
            value={content.settings.monthlyPrice}
            displayValue={content.settings.monthlyPrice}
            style={styles.settingValue}
            textAlign="center"
            tone="dark"
            onChangeField={onChangeField}
          />
        </View>
        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>Jahr</Text>
          <InlineEditableText
            editable
            path="settings.yearlyPrice"
            value={content.settings.yearlyPrice}
            displayValue={content.settings.yearlyPrice}
            style={styles.settingValue}
            textAlign="center"
            tone="dark"
            onChangeField={onChangeField}
          />
        </View>
      </View>
    );
  };

  const renderPrimaryAction = (
    colors: [string, string],
    contentNode: React.ReactNode,
    onPress?: () => void,
    disabled?: boolean,
    extraStyle?: any,
  ) => {
    if (editable) {
      return (
        <View style={[styles.primaryButton, extraStyle, disabled && styles.actionDisabled]}>
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {contentNode}
        </View>
      );
    }

    return (
      <Pressable
        style={[styles.primaryButton, extraStyle, disabled && styles.actionDisabled]}
        onPress={onPress}
        disabled={disabled}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {contentNode}
      </Pressable>
    );
  };

  const experienceContent = (
    <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <View style={styles.brandBlock}>
            {renderText(
              'brand.logo',
              content.brand.logo,
              resolvedContent.brand.logo,
              styles.logo,
              { tone: 'dark', textAlign: 'center' },
            )}
            {renderText(
              'brand.subtitle',
              content.brand.subtitle,
              resolvedContent.brand.subtitle,
              styles.logoSub,
              { tone: 'dark', textAlign: 'center' },
            )}
          </View>
          {showCloseButton ? (
            <Pressable onPress={handleClose} hitSlop={8} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          ) : (
            <View style={styles.topBarSpacer} />
          )}
        </View>

        {editable ? (
          <View style={styles.stepTabRow}>
            {renderStepButton(0, 'Intro', step === 0)}
            {renderStepButton(1, 'Ablauf', step === 1)}
            {renderStepButton(2, 'Preise', step === 2)}
          </View>
        ) : null}

        {renderSettingsBar()}
        <View
          style={styles.slideGestureArea}
          {...(!editable ? swipeResponder.panHandlers : {})}
        >
          <Animated.View
            style={[
              styles.slideStage,
              {
                opacity: stepTransitionOpacity,
                transform: [{ translateX: stepTransitionX }],
              },
            ]}
          >
            {renderText(
              step === 0
                ? 'steps.introEyebrow'
                : step === 1
                  ? 'steps.reminderEyebrow'
                  : 'steps.pricingEyebrow',
              step === 0
                ? content.steps.introEyebrow
                : step === 1
                  ? content.steps.reminderEyebrow
                  : content.steps.pricingEyebrow,
              step === 0
                ? resolvedContent.steps.introEyebrow
                : step === 1
                  ? resolvedContent.steps.reminderEyebrow
                  : resolvedContent.steps.pricingEyebrow,
              styles.eyebrow,
              { tone: 'dark', textAlign: 'center' },
            )}

            {step === 0 ? (
              <>
                {renderText(
                  'intro.title',
                  content.intro.title,
                  resolvedContent.intro.title,
                  styles.headline,
                  { multiline: true, tone: 'dark', textAlign: 'center' },
                )}
                {renderText(
                  'intro.subtitle',
                  content.intro.subtitle,
                  resolvedContent.intro.subtitle,
                  styles.subline,
                  { multiline: true, tone: 'dark', textAlign: 'center' },
                )}
                {renderText(
                  'intro.summary',
                  content.intro.summary,
                  resolvedContent.intro.summary,
                  styles.sublineAlt,
                  { multiline: true, tone: 'dark', textAlign: 'center' },
                )}
                {renderText(
                  'intro.miniBenefit',
                  content.intro.miniBenefit,
                  resolvedContent.intro.miniBenefit,
                  styles.miniBenefit,
                  { multiline: true, tone: 'dark', textAlign: 'center' },
                )}
              </>
            ) : step === 1 ? (
              <>
                {renderText(
                  'reminder.title',
                  content.reminder.title,
                  resolvedContent.reminder.title,
                  styles.headline,
                  { multiline: true, tone: 'dark', textAlign: 'center' },
                )}
                {renderText(
                  'reminder.subtitle',
                  content.reminder.subtitle,
                  resolvedContent.reminder.subtitle,
                  styles.subline,
                  { multiline: true, tone: 'dark', textAlign: 'center' },
                )}
              </>
            ) : (
              <>
                {renderText(
                  'pricing.title',
                  content.pricing.title,
                  resolvedContent.pricing.title,
                  styles.headline,
                  { multiline: true, tone: 'dark', textAlign: 'center' },
                )}
                {renderText(
                  'pricing.subtitle',
                  content.pricing.subtitle,
                  resolvedContent.pricing.subtitle,
                  styles.subline,
                  { multiline: true, tone: 'dark', textAlign: 'center' },
                )}
              </>
            )}

            <View style={styles.hero}>
              {step === 0 ? (
                <BlurView intensity={32} tint="light" style={styles.heroCard}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.96)', 'rgba(249,239,230,0.88)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.heroStats}>
                    <View style={styles.heroStatsTopRow}>
                      {resolvedContent.intro.heroStats.slice(0, 2).map((item, index) => (
                        <View
                          key={`hero-stat-${index}`}
                          style={[styles.heroStat, styles.heroStatHalf]}
                        >
                          {renderText(
                            `intro.heroStats.${index}.value`,
                            content.intro.heroStats[index]?.value ?? '',
                            item.value,
                            styles.heroStatValue,
                            { tone: 'light', textAlign: 'center' },
                          )}
                          {renderText(
                            `intro.heroStats.${index}.label`,
                            content.intro.heroStats[index]?.label ?? '',
                            item.label,
                            styles.heroStatLabel,
                            { multiline: true, tone: 'light', textAlign: 'center' },
                          )}
                        </View>
                      ))}
                    </View>

                    {resolvedContent.intro.heroStats[2] ? (
                      <View style={styles.heroStatsBottom}>
                        {renderText(
                          'intro.heroDealNote',
                          content.intro.heroDealNote,
                          resolvedContent.intro.heroDealNote,
                          styles.heroDealNote,
                          { multiline: true, tone: 'light', textAlign: 'center' },
                        )}
                        <View style={[styles.heroStat, styles.heroStatWide]}>
                          {renderText(
                            'intro.heroStats.2.value',
                            content.intro.heroStats[2]?.value ?? '',
                            resolvedContent.intro.heroStats[2].value,
                            styles.heroStatValue,
                            { tone: 'light', textAlign: 'center' },
                          )}
                          {renderText(
                            'intro.heroStats.2.label',
                            content.intro.heroStats[2]?.label ?? '',
                            resolvedContent.intro.heroStats[2].label,
                            styles.heroStatLabel,
                            { multiline: true, tone: 'light', textAlign: 'center' },
                          )}
                        </View>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.heroCardHeader}>
                    {renderText(
                      'intro.heroTitle',
                      content.intro.heroTitle,
                      resolvedContent.intro.heroTitle,
                      styles.heroCardTitle,
                      { tone: 'light' },
                    )}
                    {renderText(
                      'intro.heroSubtitle',
                      content.intro.heroSubtitle,
                      resolvedContent.intro.heroSubtitle,
                      styles.heroCardSub,
                      { multiline: true, tone: 'light' },
                    )}
                  </View>

                  <View style={styles.previewCard}>
                    {resolvedContent.intro.previewRows.map((item, index) => (
                      <View
                        key={`preview-row-${index}`}
                        style={[
                          styles.previewRow,
                          index === resolvedContent.intro.previewRows.length - 1 &&
                            styles.previewRowLast,
                        ]}
                      >
                        {renderText(
                          `intro.previewRows.${index}.label`,
                          content.intro.previewRows[index]?.label ?? '',
                          item.label,
                          styles.previewLabel,
                          { tone: 'light' },
                        )}
                        {renderText(
                          `intro.previewRows.${index}.value`,
                          content.intro.previewRows[index]?.value ?? '',
                          item.value,
                          [
                            styles.previewValue,
                            index === resolvedContent.intro.previewRows.length - 1 &&
                              styles.previewAccent,
                          ],
                          { multiline: true, tone: 'light' },
                        )}
                      </View>
                    ))}
                  </View>
                </BlurView>
              ) : step === 1 ? (
                <View style={styles.timelineCard}>
                  <View style={styles.timelineLine} />
                  {resolvedContent.reminder.timelineItems.map((item, index) => (
                    <View
                      key={`timeline-item-${index}`}
                      style={[
                        styles.timelineRow,
                        index === resolvedContent.reminder.timelineItems.length - 1 && {
                          marginBottom: 0,
                        },
                      ]}
                    >
                      <View style={styles.dot}>
                        {renderText(
                          `reminder.timelineItems.${index}.badge`,
                          content.reminder.timelineItems[index]?.badge ?? '',
                          item.badge,
                          styles.dotLabel,
                          { tone: 'light', textAlign: 'center' },
                        )}
                      </View>
                      <View style={styles.timelineTextWrap}>
                        {renderText(
                          `reminder.timelineItems.${index}.label`,
                          content.reminder.timelineItems[index]?.label ?? '',
                          item.label,
                          styles.timelineLabel,
                          { tone: 'dark' },
                        )}
                        {renderText(
                          `reminder.timelineItems.${index}.description`,
                          content.reminder.timelineItems[index]?.description ?? '',
                          item.description,
                          styles.timelineDesc,
                          { multiline: true, tone: 'dark' },
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.pricingBody}>
                  {renderText(
                    'pricing.socialProof',
                    content.pricing.socialProof,
                    resolvedContent.pricing.socialProof,
                    styles.socialProof,
                    { multiline: true, tone: 'dark', textAlign: 'center' },
                  )}
                  <BlurView intensity={20} tint="light" style={styles.featureCard}>
                    {renderText(
                      'pricing.featureTitle',
                      content.pricing.featureTitle,
                      resolvedContent.pricing.featureTitle,
                      styles.featureTitle,
                      { multiline: true, tone: 'dark' },
                    )}
                    {resolvedContent.pricing.features.map((item, index) => (
                      <View key={`feature-item-${index}`} style={styles.featurePill}>
                        <View style={styles.featureIcon}>
                          {renderText(
                            `pricing.features.${index}.badge`,
                            content.pricing.features[index]?.badge ?? '',
                            item.badge,
                            styles.featureIconText,
                            { tone: 'light', textAlign: 'center' },
                          )}
                        </View>
                        {renderText(
                          `pricing.features.${index}.text`,
                          content.pricing.features[index]?.text ?? '',
                          item.text,
                          styles.featureText,
                          { multiline: true, tone: 'dark' },
                        )}
                      </View>
                    ))}
                  </BlurView>
                </View>
              )}
            </View>

            <View style={styles.stepDots}>
              {[
                { id: 'intro', index: 0 },
                { id: 'reminder', index: 1 },
                { id: 'pricing', index: 2 },
              ].map((slide) => (
                <Pressable
                  key={slide.id}
                  onPress={() => goToStep(slide.index)}
                  style={[
                    styles.dotStep,
                    slide.index === step && styles.dotStepActive,
                  ]}
                />
              ))}
            </View>

            {step < 2 ? (
              <View style={styles.ctaCard}>
                {renderText(
                  'progressCard.title',
                  content.progressCard.title,
                  resolvedContent.progressCard.title,
                  styles.ctaTitle,
                  { multiline: true, tone: 'light', textAlign: 'center' },
                )}
                {renderText(
                  'progressCard.subtitle',
                  content.progressCard.subtitle,
                  resolvedContent.progressCard.subtitle,
                  styles.ctaSub,
                  { multiline: true, tone: 'light', textAlign: 'center' },
                )}
                {editable ? (
                  renderPrimaryAction(
                    ['#FFCFAE', '#FEB493'],
                    renderAdvanceButtonLabel(),
                    undefined,
                    false,
                    null,
                  )
                ) : (
                  renderPrimaryAction(
                    ['#FFCFAE', '#FEB493'],
                    renderAdvanceButtonLabel(),
                    () => goToStep(step + 1),
                    false,
                    null,
                  )
                )}
                {showSecondaryCtas ? (
                  editable ? (
                    <View style={styles.skipButton}>
                      {renderText(
                        'progressCard.skipLabel',
                        content.progressCard.skipLabel,
                        resolvedContent.progressCard.skipLabel,
                        styles.skipButtonText,
                        { tone: 'light', textAlign: 'center' },
                      )}
                    </View>
                  ) : (
                    <Pressable onPress={handleClose} hitSlop={8} style={styles.skipButton}>
                      <Text style={styles.skipButtonText}>
                        {resolvedContent.progressCard.skipLabel}
                      </Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            ) : (
              <View style={styles.planStack}>
                <View
                  style={[
                    styles.planGrid,
                    isCompactPlanLayout && styles.planGridCompact,
                  ]}
                >
                  <View
                    style={[
                      styles.planCard,
                      !isCompactPlanLayout && styles.planCardHalf,
                      !isCompactPlanLayout && styles.planCardMonthly,
                      isCompactPlanLayout && styles.planCardCompact,
                    ]}
                  >
                    <View style={styles.planBadgeRow}>
                      {renderText(
                        'pricing.monthlyPlan.badge',
                        content.pricing.monthlyPlan.badge,
                        resolvedContent.pricing.monthlyPlan.badge,
                        styles.planBadge,
                        { tone: 'light' },
                      )}
                      {renderText(
                        'pricing.monthlyPlan.highlight',
                        content.pricing.monthlyPlan.highlight,
                        resolvedContent.pricing.monthlyPlan.highlight,
                        styles.planSave,
                        { tone: 'light', textAlign: 'center' },
                      )}
                    </View>
                    {renderText(
                      'pricing.monthlyPlan.title',
                      content.pricing.monthlyPlan.title,
                      resolvedContent.pricing.monthlyPlan.title,
                      styles.planTitle,
                      { multiline: true, tone: 'light' },
                    )}
                    {editable ? (
                      renderText(
                        'settings.monthlyPrice',
                        content.settings.monthlyPrice,
                        templateValues.monthlyDisplayPrice,
                        styles.planPrice,
                        { tone: 'light', textAlign: 'center' },
                      )
                    ) : (
                      <Text style={styles.planPrice}>
                        {templateValues.monthlyDisplayPrice}
                      </Text>
                    )}
                    <Text style={styles.planMeta}>{billingLabel}</Text>
                    {renderText(
                      'pricing.monthlyPlan.description',
                      content.pricing.monthlyPlan.description,
                      resolvedContent.pricing.monthlyPlan.description,
                      styles.planDesc,
                      { multiline: true, tone: 'light' },
                    )}
                    <View style={styles.planList}>
                      {resolvedContent.pricing.monthlyPlan.bullets.map((item, index) => (
                        <View key={`monthly-bullet-${index}`} style={styles.planListItem}>
                          <View style={styles.planListDot} />
                          {renderText(
                            `pricing.monthlyPlan.bullets.${index}`,
                            content.pricing.monthlyPlan.bullets[index] ?? '',
                            item,
                            styles.planListText,
                            { multiline: true, tone: 'light' },
                          )}
                        </View>
                      ))}
                    </View>
                    {renderText(
                      'pricing.monthlyPlan.note',
                      content.pricing.monthlyPlan.note,
                      resolvedContent.pricing.monthlyPlan.note,
                      styles.planNote,
                      { multiline: true, tone: 'light' },
                    )}
                    {renderPrimaryAction(
                      ['#FFCFAE', '#FEB493'],
                      editable
                        ? renderText(
                            'pricing.monthlyPlan.buttonLabel',
                            content.pricing.monthlyPlan.buttonLabel,
                            resolvedContent.pricing.monthlyPlan.buttonLabel,
                            styles.primaryText,
                            { tone: 'light', textAlign: 'center' },
                          )
                        : (
                          <Text style={styles.primaryText}>
                            {pendingAction === 'monthly'
                              ? 'Bitte warten…'
                              : resolvedContent.pricing.monthlyPlan.buttonLabel}
                          </Text>
                        ),
                      onMonthlyPress,
                      purchaseActionsDisabled,
                    )}
                  </View>

                  <View
                    style={[
                      styles.planCard,
                      !isCompactPlanLayout && styles.planCardHalf,
                      styles.planCardHighlight,
                      isCompactPlanLayout && styles.planCardCompact,
                      isCompactPlanLayout && styles.planCardHighlightCompact,
                    ]}
                  >
                    <View style={styles.planBadgeRow}>
                      {renderText(
                        'pricing.yearlyPlan.badge',
                        content.pricing.yearlyPlan.badge,
                        resolvedContent.pricing.yearlyPlan.badge,
                        [styles.planBadge, styles.planBadgeYearly],
                        { tone: 'light' },
                      )}
                      {renderText(
                        'pricing.yearlyPlan.highlight',
                        content.pricing.yearlyPlan.highlight,
                        resolvedContent.pricing.yearlyPlan.highlight,
                        [styles.planSave, styles.planSaveYearly],
                        { tone: 'light', textAlign: 'center' },
                      )}
                    </View>
                    {renderText(
                      'pricing.yearlyPlan.title',
                      content.pricing.yearlyPlan.title,
                      resolvedContent.pricing.yearlyPlan.title,
                      styles.planTitle,
                      { multiline: true, tone: 'light' },
                    )}
                    <View style={styles.planPriceRow}>
                      {editable ? (
                        renderText(
                          'settings.yearlyPrice',
                          content.settings.yearlyPrice,
                          templateValues.yearlyDisplayPrice,
                          styles.planPrice,
                          { tone: 'light', textAlign: 'center' },
                        )
                      ) : (
                        <Text style={styles.planPrice}>
                          {templateValues.yearlyDisplayPrice}
                        </Text>
                      )}
                      {editable ? (
                        renderText(
                          'pricing.yearlyPlan.savingsInline',
                          content.pricing.yearlyPlan.savingsInline ?? '',
                          resolvedContent.pricing.yearlyPlan.savingsInline ?? '',
                          styles.planSavingsInline,
                          { tone: 'light' },
                        )
                      ) : resolvedContent.pricing.yearlyPlan.savingsInline ? (
                        <Text style={styles.planSavingsInline}>
                          {resolvedContent.pricing.yearlyPlan.savingsInline}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.planMeta}>{billingLabel}</Text>
                    {renderText(
                      'pricing.yearlyPlan.description',
                      content.pricing.yearlyPlan.description,
                      resolvedContent.pricing.yearlyPlan.description,
                      styles.planDesc,
                      { multiline: true, tone: 'light' },
                    )}
                    <View style={styles.planList}>
                      {resolvedContent.pricing.yearlyPlan.bullets.map((item, index) => (
                        <View key={`yearly-bullet-${index}`} style={styles.planListItem}>
                          <View
                            style={[
                              styles.planListDot,
                              styles.planListDotYearly,
                            ]}
                          />
                          {renderText(
                            `pricing.yearlyPlan.bullets.${index}`,
                            content.pricing.yearlyPlan.bullets[index] ?? '',
                            item,
                            styles.planListText,
                            { multiline: true, tone: 'light' },
                          )}
                        </View>
                      ))}
                    </View>
                    {renderText(
                      'pricing.yearlyPlan.note',
                      content.pricing.yearlyPlan.note,
                      resolvedContent.pricing.yearlyPlan.note,
                      styles.planNote,
                      { multiline: true, tone: 'light' },
                    )}
                    {renderPrimaryAction(
                      ['#FFE6C8', '#FFD2A5'],
                      editable
                        ? renderText(
                            'pricing.yearlyPlan.buttonLabel',
                            content.pricing.yearlyPlan.buttonLabel,
                            resolvedContent.pricing.yearlyPlan.buttonLabel,
                            styles.primaryText,
                            { tone: 'light', textAlign: 'center' },
                          )
                        : (
                          <Text style={styles.primaryText}>
                            {pendingAction === 'yearly'
                              ? 'Bitte warten…'
                              : resolvedContent.pricing.yearlyPlan.buttonLabel}
                          </Text>
                        ),
                      onYearlyPress,
                      purchaseActionsDisabled,
                      styles.primaryButtonYearly,
                    )}
                  </View>
                </View>

                {editable ? (
                  <View style={styles.secondaryActionStatic}>
                    {renderText(
                      'pricing.restoreLabel',
                      content.pricing.restoreLabel,
                      resolvedContent.pricing.restoreLabel,
                      styles.secondaryAction,
                      { tone: 'dark', textAlign: 'center' },
                    )}
                  </View>
                ) : (
                  <Pressable
                    onPress={onRestorePress}
                    hitSlop={8}
                    disabled={purchaseActionsDisabled}
                    style={purchaseActionsDisabled && styles.actionDisabled}
                  >
                    <Text style={styles.secondaryAction}>
                      {pendingAction === 'restore'
                        ? 'Aktualisiere…'
                        : resolvedContent.pricing.restoreLabel}
                    </Text>
                  </Pressable>
                )}

                {showSecondaryCtas ? (
                  editable ? (
                    <View style={styles.cancelButton}>
                      {renderText(
                        'pricing.cancelLabel',
                        content.pricing.cancelLabel,
                        resolvedContent.pricing.cancelLabel,
                        styles.cancelButtonText,
                        { tone: 'dark', textAlign: 'center' },
                      )}
                    </View>
                  ) : (
                    <Pressable onPress={handleClose} hitSlop={8} style={styles.cancelButton}>
                      <Text style={styles.cancelButtonText}>
                        {resolvedContent.pricing.cancelLabel}
                      </Text>
                    </Pressable>
                  )
                ) : null}

                {resolvedContent.legal.paragraphs.map((item, index) => (
                  <View key={`legal-paragraph-${index}`}>
                    {renderText(
                      `legal.paragraphs.${index}`,
                      content.legal.paragraphs[index] ?? '',
                      item,
                      styles.legal,
                      { multiline: true, tone: 'dark', textAlign: 'center' },
                    )}
                  </View>
                ))}
                <View style={styles.legalLinksRow}>
                  {editable ? (
                    <>
                      {renderText(
                        'legal.links.privacy',
                        content.legal.links.privacy,
                        resolvedContent.legal.links.privacy,
                        styles.legalLink,
                        { tone: 'dark' },
                      )}
                      {renderText(
                        'legal.links.terms',
                        content.legal.links.terms,
                        resolvedContent.legal.links.terms,
                        styles.legalLink,
                        { tone: 'dark' },
                      )}
                      {renderText(
                        'legal.links.appleEula',
                        content.legal.links.appleEula,
                        resolvedContent.legal.links.appleEula,
                        styles.legalLink,
                        { tone: 'dark' },
                      )}
                      {renderText(
                        'legal.links.imprint',
                        content.legal.links.imprint,
                        resolvedContent.legal.links.imprint,
                        styles.legalLink,
                        { tone: 'dark' },
                      )}
                      {renderText(
                        'legal.links.dataManagement',
                        content.legal.links.dataManagement,
                        resolvedContent.legal.links.dataManagement,
                        styles.legalLink,
                        { tone: 'dark' },
                      )}
                    </>
                  ) : (
                    <>
                      <Pressable
                        accessibilityRole="link"
                        hitSlop={8}
                        onPress={() => handleLegalPress(onOpenPrivacy)}
                      >
                        <Text style={styles.legalLink}>
                          {resolvedContent.legal.links.privacy}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="link"
                        hitSlop={8}
                        onPress={() => handleLegalPress(onOpenTerms)}
                      >
                        <Text style={styles.legalLink}>
                          {resolvedContent.legal.links.terms}
                        </Text>
                      </Pressable>
                      {showAppleEula ? (
                        <Pressable
                          accessibilityRole="link"
                          hitSlop={8}
                          onPress={() => handleLegalPress(onOpenAppleEula)}
                        >
                          <Text style={styles.legalLink}>
                            {resolvedContent.legal.links.appleEula}
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="link"
                        hitSlop={8}
                        onPress={() => handleLegalPress(onOpenImprint)}
                      >
                        <Text style={styles.legalLink}>
                          {resolvedContent.legal.links.imprint}
                        </Text>
                      </Pressable>
                      {isTrialExpired ? (
                        <Pressable
                          accessibilityRole="link"
                          hitSlop={8}
                          onPress={() => handleLegalPress(onOpenDataManagement)}
                        >
                          <Text style={styles.legalLink}>
                            {resolvedContent.legal.links.dataManagement}
                          </Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </View>
              </View>
            )}
          </Animated.View>
        </View>

        {visiblePurchaseError ? (
          <Text style={styles.errorText}>{visiblePurchaseError}</Text>
        ) : null}
    </View>
  );

  return (
    <View style={[styles.shell, useInternalScrollView && styles.shellFill]}>
      <LinearGradient
        colors={['#5E4BC4', '#7C63D8', '#D8CDEA', '#F5EEE6']}
        locations={[0, 0.32, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.ambientOrb, styles.ambientOrbTop]} />
      <View style={[styles.ambientOrb, styles.ambientOrbMiddle]} />
      <View style={[styles.ambientOrb, styles.ambientOrbBottom]} />
      {useInternalScrollView ? (
        <ScrollView
          contentContainerStyle={styles.innerContainer}
          keyboardShouldPersistTaps="handled"
        >
          {experienceContent}
        </ScrollView>
      ) : (
        <View style={styles.innerContainer}>{experienceContent}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
  },
  shellFill: {
    flex: 1,
  },
  innerContainer: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 32,
    paddingBottom: 32,
    alignItems: 'center',
  },
  content: {
    width: '100%',
  },
  ambientOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.28,
  },
  ambientOrbTop: {
    width: 240,
    height: 240,
    backgroundColor: '#FFE0C5',
    top: -60,
    right: -40,
  },
  ambientOrbMiddle: {
    width: 220,
    height: 220,
    backgroundColor: '#BDAEF3',
    top: '34%',
    left: -80,
  },
  ambientOrbBottom: {
    width: 260,
    height: 260,
    backgroundColor: '#FFD8B8',
    bottom: -90,
    right: -70,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  topBarSpacer: {
    width: 36,
    height: 36,
  },
  brandBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  logoSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  stepTabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  stepTab: {
    minHeight: 34,
    minWidth: 92,
    borderRadius: 999,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  stepTabActive: {
    backgroundColor: 'rgba(255,231,200,0.22)',
    borderColor: 'rgba(255,231,200,0.44)',
  },
  stepTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.82)',
  },
  stepTabTextActive: {
    color: '#FFF4E8',
  },
  settingsBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  slideGestureArea: {
    width: '100%',
  },
  slideStage: {
    width: '100%',
  },
  settingCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  settingLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.76)',
  },
  settingValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#FEE7D0',
    marginBottom: 10,
    textAlign: 'center',
  },
  headline: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subline: {
    marginTop: 14,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  sublineAlt: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#FFECD9',
    textAlign: 'center',
  },
  miniBenefit: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
  },
  hero: {
    marginTop: 28,
  },
  heroCard: {
    overflow: 'hidden',
    borderRadius: 28,
    padding: 22,
    gap: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  heroStats: {
    gap: 12,
  },
  heroStatsTopRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStatsBottom: {
    gap: 12,
  },
  heroStat: {
    minWidth: 112,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 6,
  },
  heroStatHalf: {
    minWidth: 0,
  },
  heroStatWide: {
    width: '100%',
    flexGrow: 0,
  },
  heroDealNote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    color: '#91551F',
    textAlign: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,235,214,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(240,193,145,0.72)',
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#5F3E39',
    textAlign: 'center',
  },
  heroStatLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: '#8C675C',
    textAlign: 'center',
  },
  heroCardHeader: {
    gap: 6,
  },
  heroCardTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#503335',
  },
  heroCardSub: {
    fontSize: 15,
    lineHeight: 22,
    color: '#7D5A50',
  },
  previewCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  previewRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(114,83,74,0.18)',
    gap: 6,
  },
  previewRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#9C6A58',
  },
  previewValue: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5F3E39',
  },
  previewAccent: {
    color: '#9A5340',
    fontWeight: '700',
  },
  timelineCard: {
    position: 'relative',
    borderRadius: 28,
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  timelineLine: {
    position: 'absolute',
    left: 38,
    top: 34,
    bottom: 34,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 18,
  },
  dot: {
    width: 36,
    minHeight: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF2E5',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    zIndex: 1,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  dotLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#714A43',
    textAlign: 'center',
  },
  timelineTextWrap: {
    flex: 1,
    paddingTop: 3,
    gap: 6,
  },
  timelineLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timelineDesc: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.88)',
  },
  pricingBody: {
    gap: 16,
  },
  socialProof: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFF6EE',
    textAlign: 'center',
  },
  featureCard: {
    overflow: 'hidden',
    borderRadius: 28,
    padding: 22,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  featureTitle: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featurePill: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 28,
    minHeight: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE5CA',
    flexShrink: 0,
    marginTop: 1,
    paddingHorizontal: 4,
  },
  featureIconText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6E4B43',
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
  },
  dotStep: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotStepActive: {
    width: 28,
    backgroundColor: '#FFE7C8',
  },
  ctaCard: {
    marginTop: 28,
    borderRadius: 28,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.86)',
    alignItems: 'center',
    gap: 8,
  },
  ctaTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#533637',
    textAlign: 'center',
  },
  ctaSub: {
    fontSize: 15,
    lineHeight: 22,
    color: '#7E5A50',
    textAlign: 'center',
  },
  primaryButton: {
    height: 54,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 24,
    minWidth: 220,
  },
  primaryButtonYearly: {
    marginTop: 20,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5A322B',
    textAlign: 'center',
  },
  skipButton: {
    marginTop: 14,
    alignSelf: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8C6459',
    textAlign: 'center',
  },
  planStack: {
    marginTop: 28,
    gap: 16,
  },
  planGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  planGridCompact: {
    flexDirection: 'column',
  },
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 28,
    padding: 22,
  },
  planCardHalf: {
    flex: 1,
  },
  planCardMonthly: {
    backgroundColor: 'rgba(255,250,245,0.92)',
  },
  planCardHighlight: {
    backgroundColor: 'rgba(255,243,225,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,164,0.9)',
    shadowColor: '#8A5A34',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  planCardCompact: {
    width: '100%',
  },
  planCardHighlightCompact: {
    marginTop: 2,
  },
  planBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  planBadge: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#8B5C52',
  },
  planBadgeYearly: {
    color: '#8A5418',
  },
  planSave: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9B6A60',
    textAlign: 'right',
  },
  planSaveYearly: {
    color: '#B06B1E',
  },
  planTitle: {
    marginTop: 16,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#563639',
  },
  planPrice: {
    marginTop: 12,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    color: '#513335',
  },
  planPriceRow: {
    marginTop: 12,
    gap: 6,
  },
  planSavingsInline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B06B1E',
  },
  planMeta: {
    marginTop: 8,
    fontSize: 14,
    color: '#8A655A',
  },
  planDesc: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
    color: '#63484A',
  },
  planList: {
    marginTop: 18,
    gap: 10,
  },
  planListItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  planListDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FEB493',
  },
  planListDotYearly: {
    backgroundColor: '#D18A37',
  },
  planListText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#5F4346',
  },
  planNote: {
    marginTop: 18,
    fontSize: 13,
    lineHeight: 19,
    color: '#88635A',
  },
  secondaryAction: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    color: '#6C473F',
  },
  secondaryActionStatic: {
    alignItems: 'center',
  },
  cancelButton: {
    alignSelf: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7B5B55',
    textAlign: 'center',
  },
  legal: {
    fontSize: 12,
    lineHeight: 19,
    color: '#7A625D',
    textAlign: 'center',
  },
  legalLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  legalLink: {
    fontSize: 13,
    fontWeight: '800',
    color: '#A05E48',
  },
  errorText: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFE4E1',
    backgroundColor: 'rgba(160,48,48,0.28)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  inlineEditorWrap: {
    width: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineEditorWrapDark: {
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  inlineEditorWrapLight: {
    borderColor: 'rgba(92,64,51,0.18)',
    backgroundColor: 'rgba(255,255,255,0.46)',
  },
  inlineEditorInput: {
    width: '100%',
    paddingHorizontal: 0,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  inlineEditorInputMultiline: {
    minHeight: 28,
  },
  inlineEditorInputCentered: {
    textAlign: 'center',
  },
});

export default PaywallExperience;
